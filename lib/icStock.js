import { Types } from 'mongoose';
import { BarcodeLabel, BARCODE_STATUS } from '@/lib/barcodeLabel';
import StockMovement, { MOVEMENT_TYPES } from '@/models/StockMovement';

/* ==========================================================================
   STOCK for Inter Company Delivery Challans.

   Raising a challan takes the goods OUT of the sending branch; a return puts
   the returned quantity BACK. Until now the challan was paperwork only and
   stock never moved, so a branch could ship the same 33 metres every day.

   WHY NOT lib/inventory.js applyMovement(). That moves a whole unit by
   flipping its status - right for a sale or a transfer of complete pieces,
   wrong here, where a batch barcode holding 33 can ship 5 and keep 28. This
   works in QUANTITY on the same barcodeLabel rows and writes the same
   StockMovement ledger, so both mechanisms stay readable side by side.

   HOW A LINE IS ALLOCATED. One printed barcode is spread over many rows, one
   per unit received, so 5 may come off several rows. The rows it actually
   came off are recorded on the line as `stockMoves`, and a return puts the
   quantity back on exactly those rows rather than guessing.

   A row emptied to 0 becomes IN_TRANSIT: it has left the branch but has not
   been taken in anywhere, which is what that status means. Coming back it
   returns to IN_STOCK.
   ========================================================================== */

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const r2 = (v) => Math.round(num(v) * 100) / 100;

const codeMatch = (code) => ({
  $regex: '^\\s*' + String(code).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$',
  $options: 'i',
});

/* Same business scoping the item lookup uses: rows carrying a blank business
   belong to whoever is asking, because the barcode screen saves '' when the
   top bar has not resolved yet. */
const scopeOf = (businessId) => (businessId
  ? {
    $or: [
      { businessId: String(businessId) },
      { businessId: '' },
      { businessId: { $exists: false } },
    ],
  }
  : {});

export class IcStockError extends Error {
  constructor(message) {
    super(message);
    this.name = 'IcStockError';
    this.status = 422;
  }
}

/* Take the challan's quantities out of the sending branch.

   Throws IcStockError before writing ANYTHING when a line asks for more than
   the branch holds - a partly-shipped challan would be worse than a refused
   one. Returns the lines with `stockMoves` filled in, for the caller to save. */
export async function shipChallanStock({ challan, lines, user = null }) {
  const businessId = challan.businessId;
  const out = [];

  /* pass 1 - plan every line and prove the whole document is affordable */
  for (const line of lines) {
    const barcode = String(line.barcodeNo || '').trim();
    const want = r2(line.qty);
    if (!barcode || want <= 0) { out.push({ line, plan: [] }); continue; }

    const rows = await BarcodeLabel.find({
      $and: [
        { $or: [{ barcodeNo: codeMatch(barcode) }, { barcodeGenerated: codeMatch(barcode) }] },
        { status: BARCODE_STATUS.IN_STOCK },
        scopeOf(businessId),
      ],
    }).sort({ createdAt: 1 }).lean();

    const held = r2(rows.reduce((a, r) => a + num(r.qtyNum), 0));
    if (held < want) {
      throw new IcStockError(
        'Only ' + held + ' of barcode ' + barcode + ' in stock at this branch - the challan asks for ' + want + '.'
      );
    }

    let left = want;
    const plan = [];
    for (const row of rows) {
      if (left <= 0) break;
      const take = r2(Math.min(left, num(row.qtyNum)));
      if (take <= 0) continue;
      plan.push({ row, take });
      left = r2(left - take);
    }
    out.push({ line, plan });
  }

  /* pass 2 - write */
  const ledger = [];
  const saved = [];

  for (const { line, plan } of out) {
    const moves = [];
    for (const { row, take } of plan) {
      /* the guard is part of the write: another request may have taken this
         row's quantity between the read above and here */
      const res = await BarcodeLabel.collection.updateOne(
        { _id: new Types.ObjectId(String(row._id)), qtyNum: { $gte: take } },
        {
          $inc: { qtyNum: -take },
          $set: { updatedAt: new Date() },
        }
      );
      if (!res.modifiedCount) {
        throw new IcStockError(
          'Barcode ' + (row.barcodeNo || '') + ' was changed by someone else. Reload and try again.'
        );
      }

      const emptied = r2(num(row.qtyNum) - take) <= 0;
      if (emptied) {
        await BarcodeLabel.collection.updateOne(
          { _id: new Types.ObjectId(String(row._id)) },
          { $set: { status: BARCODE_STATUS.IN_TRANSIT } }
        );
      }

      moves.push({ barcodeId: String(row._id), qty: take });
      ledger.push({
        businessId: challan.businessId || null,
        finYear: challan.finYear || row.finYear || '',
        type: MOVEMENT_TYPES.TRANSFER_OUT,
        barcodeId: row._id,
        barcodeNo: row.barcodeNo || row.barcodeGenerated || '',
        itemCode: row.itemCode || '',
        itemName: row.printDescription || row.supplierDescription || '',
        uom: row.uom || row.uomType || '',
        batchType: row.batchType || '',
        qty: -take,
        fromLocationId: challan.locationId || null,
        toLocationId: challan.toLocationId || null,
        statusBefore: BARCODE_STATUS.IN_STOCK,
        statusAfter: emptied ? BARCODE_STATUS.IN_TRANSIT : BARCODE_STATUS.IN_STOCK,
        refModel: 'icDeliveryChallan',
        refId: challan._id || null,
        refNo: challan.dcNo || '',
        reason: 'Inter company delivery challan',
        userName: user?.name || '',
        userEmail: user?.email || '',
        at: new Date(),
      });
    }
    saved.push({ ...line, stockMoves: moves });
  }

  if (ledger.length) await StockMovement.insertMany(ledger, { ordered: true });
  return saved;
}

/* Put a returned quantity back into the SENDING branch.

   `asked` is [{ barcodeNo, qty }] - what the receiver sent back. The quantity
   goes onto the very rows it came off, newest allocation first, so a row
   cannot end up holding more than it started with. */
export async function restoreReturnedStock({ challan, asked, user = null }) {
  const wanted = new Map();
  asked.forEach((a) => {
    const key = String(a.barcodeNo || '').trim().toLowerCase();
    const qty = r2(a.qty);
    if (key && qty > 0) wanted.set(key, r2((wanted.get(key) || 0) + qty));
  });
  if (!wanted.size) return;

  const ledger = [];

  for (const line of (challan.items || [])) {
    const key = String(line.barcodeNo || '').trim().toLowerCase();
    let left = wanted.get(key);
    if (!left) continue;

    for (const move of (line.stockMoves || [])) {
      if (left <= 0) break;
      const give = r2(Math.min(left, num(move.qty)));
      if (give <= 0) continue;

      const _id = new Types.ObjectId(String(move.barcodeId));
      await BarcodeLabel.collection.updateOne(
        { _id },
        {
          $inc: { qtyNum: give },
          /* a row emptied on despatch went IN_TRANSIT - anything coming back
             is on hand again */
          $set: { status: BARCODE_STATUS.IN_STOCK, updatedAt: new Date() },
        }
      );

      const row = await BarcodeLabel.findById(_id).lean();
      ledger.push({
        businessId: challan.businessId || null,
        finYear: challan.finYear || '',
        type: MOVEMENT_TYPES.TRANSFER_RETURN_IN,
        barcodeId: _id,
        barcodeNo: (row && (row.barcodeNo || row.barcodeGenerated)) || line.barcodeNo || '',
        itemCode: (row && row.itemCode) || line.itemCode || '',
        itemName: line.itemName || '',
        uom: line.uom || '',
        qty: give,
        fromLocationId: challan.toLocationId || null,
        toLocationId: challan.locationId || null,
        statusAfter: BARCODE_STATUS.IN_STOCK,
        refModel: 'icDeliveryChallan',
        refId: challan._id || null,
        refNo: challan.dcNo || '',
        reason: 'Inter company return - damaged',
        userName: user?.name || '',
        userEmail: user?.email || '',
        at: new Date(),
      });

      left = r2(left - give);
    }

    wanted.set(key, left);
  }

  if (ledger.length) await StockMovement.insertMany(ledger, { ordered: true });
}

/* Land the challan's goods in the RECEIVING branch.

   POS finds sellable stock with { barcodeLabel.businessId, status IN_STOCK }
   (see loadUnits in lib/inventory.js), so the receiver can only sell what has
   a row under THEIR business. This creates those rows - rows in the existing
   barcodeLabel collection, not a new collection.

   Why new rows rather than relocating the sender's, which is what a Stock
   Transfer does: a transfer moves whole units, so flipping currentLocationId
   is enough. Here a batch row holding 33 can send 5 and keep 28, so the one
   row has to become two - 28 at the sender, 5 at the receiver.

   `sourceBarcodeId` ties each new row back to the row it came from, so a
   return can find it again. */
export async function receiveChallanStock({ challan, user = null }) {
  const created = [];
  const ledger = [];

  for (const line of (challan.items || [])) {
    for (const move of (line.stockMoves || [])) {
      const qty = r2(move.qty);
      if (qty <= 0) continue;

      const src = await BarcodeLabel.findById(new Types.ObjectId(String(move.barcodeId))).lean();
      if (!src) continue;

      /* already landed - receiving twice must not double the stock */
      const existing = await BarcodeLabel.findOne({
        sourceBarcodeId: String(src._id),
        icChallanId: String(challan._id),
      }).lean();
      if (existing) continue;

      const { _id, createdAt, updatedAt, __v, ...rest } = src;
      const doc = {
        ...rest,
        businessId: String(challan.toBusinessId || ''),
        locationId: String(challan.toLocationId || ''),
        currentBusinessId: challan.toBusinessId || null,
        currentLocationId: challan.toLocationId || null,
        finYear: challan.finYear || src.finYear || '',
        qtyNum: qty,
        qty: String(qty),
        status: BARCODE_STATUS.IN_STOCK,
        /* provenance, so the unit can be traced and returned */
        sourceBarcodeId: String(src._id),
        icChallanId: String(challan._id),
        icChallanNo: challan.dcNo || '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const res = await BarcodeLabel.collection.insertOne(doc);
      created.push({ _id: res.insertedId, barcodeNo: doc.barcodeNo, qty });

      ledger.push({
        businessId: challan.toBusinessId || null,
        finYear: doc.finYear,
        type: MOVEMENT_TYPES.TRANSFER_IN,
        barcodeId: res.insertedId,
        barcodeNo: doc.barcodeNo || doc.barcodeGenerated || '',
        itemCode: doc.itemCode || '',
        itemName: doc.printDescription || doc.supplierDescription || '',
        uom: doc.uom || doc.uomType || '',
        batchType: doc.batchType || '',
        qty,
        fromLocationId: challan.locationId || null,
        toLocationId: challan.toLocationId || null,
        statusAfter: BARCODE_STATUS.IN_STOCK,
        refModel: 'icDeliveryChallan',
        refId: challan._id || null,
        refNo: challan.dcNo || '',
        reason: 'Inter company challan received',
        userName: user?.name || '',
        userEmail: user?.email || '',
        at: new Date(),
      });
    }
  }

  if (ledger.length) await StockMovement.insertMany(ledger, { ordered: true });
  return created;
}

/* Take a returned quantity back OUT of the receiving branch.

   Called alongside restoreReturnedStock: the damaged goods leave the receiver
   and rejoin the sender, so both ends have to move. Only rows this challan
   created are touched - never the receiver's own stock. */
/* What the RECEIVER still holds from each challan, per barcode: the
   quantity on its IN_STOCK rows that this challan created. A piece the
   store has SOLD (or that was already returned) is not on an IN_STOCK row
   any more, so it is not counted - which is what caps a return at what is
   physically still there. Received 2, sold 1 -> 1 can go back, not 2.

   -> Map<challanId, Map<lowercased barcodeNo, qty>> */
export async function receivedInStock(challanIds) {
  const ids = [...new Set((challanIds || []).map(String).filter(Boolean))];
  const out = new Map(ids.map((id) => [id, new Map()]));
  if (!ids.length) return out;
  const rows = await BarcodeLabel.find({
    icChallanId: { $in: ids },
    status: BARCODE_STATUS.IN_STOCK,
  }).select('icChallanId barcodeNo qtyNum qty').lean();
  rows.forEach((row) => {
    const key = String(row.barcodeNo || '').trim().toLowerCase();
    if (!key) return;
    const per = out.get(String(row.icChallanId));
    if (!per) return;
    per.set(key, r2((per.get(key) || 0) + num(row.qtyNum ?? row.qty)));
  });
  return out;
}

export async function withdrawReceivedStock({ challan, asked }) {
  const wanted = new Map();
  asked.forEach((a) => {
    const key = String(a.barcodeNo || '').trim().toLowerCase();
    const qty = r2(a.qty);
    if (key && qty > 0) wanted.set(key, r2((wanted.get(key) || 0) + qty));
  });
  if (!wanted.size) return;

  for (const [key, want] of wanted) {
    let left = want;
    const rows = await BarcodeLabel.find({
      icChallanId: String(challan._id),
      status: BARCODE_STATUS.IN_STOCK,
    }).lean();

    for (const row of rows) {
      if (left <= 0) break;
      if (String(row.barcodeNo || '').trim().toLowerCase() !== key) continue;

      const take = r2(Math.min(left, num(row.qtyNum)));
      if (take <= 0) continue;

      await BarcodeLabel.collection.updateOne(
        { _id: row._id, qtyNum: { $gte: take } },
        { $inc: { qtyNum: -take }, $set: { updatedAt: new Date() } }
      );
      if (r2(num(row.qtyNum) - take) <= 0) {
        await BarcodeLabel.collection.updateOne(
          { _id: row._id }, { $set: { status: BARCODE_STATUS.VOID } }
        );
      }
      left = r2(left - take);
    }
  }
}
