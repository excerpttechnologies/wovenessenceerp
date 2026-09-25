import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { BarcodeLabel, BARCODE_STATUS } from '@/lib/barcodeLabel';
import StockMovement, { MOVEMENT_TYPES } from '@/models/StockMovement';
import {
  barcodeSpellings, barcodeKey, sameBarcode, unitAnswersTo, serialNoOfUnit,
} from '@/lib/barcodeValue';

/* ==========================================================================
   THE INVENTORY ENGINE.

   Every change to where stock is, or whose it is, goes through this module.
   GRC, POS, stock transfer, receiving, returns, e-commerce and adjustments
   all call the same functions, so there is ONE definition of what each event
   does to a unit - which is the whole point of the exercise. A module that
   updates barcodeLabel.status directly is a bug.

   Two invariants hold every transition together:

   1. EVERY state change is guarded.
      A unit is moved with updateOne({ _id, status: <the status we read> }),
      never with a bare save. If another request changed it in between, the
      update matches nothing and the caller is told - so a barcode cannot be
      sold twice, despatched twice, or received twice, no matter how the two
      requests interleave. This is the protection that actually matters; the
      pair lock in lib/locks.js only turns a lost race into a clearer message.

   2. EVERY state change writes its history.
      The barcode row carries current state; models/StockMovement.js carries
      how it got there. They are written in one transaction, so the ledger can
      never disagree with the stock.

   Errors are typed (InventoryError.code) so the API layer can map them to a
   status code and the screens can show the operator something specific -
   "already sold at INV/26/0142" rather than "save failed".
   ========================================================================== */

export { BARCODE_STATUS, MOVEMENT_TYPES };

export class InventoryError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'InventoryError';
    this.code = code;
    this.status = extra.status || 409;
    Object.assign(this, extra);
  }
}

/* The scan failures an operator can actually hit, each with the message they
   should see. Kept in one table so POS and Stock Transfer word them the same. */
export const SCAN_ERRORS = {
  NOT_FOUND: 'BARCODE_NOT_FOUND',
  WRONG_BUSINESS: 'BARCODE_WRONG_BUSINESS',
  WRONG_LOCATION: 'BARCODE_WRONG_LOCATION',
  ALREADY_SOLD: 'BARCODE_ALREADY_SOLD',
  IN_TRANSIT: 'BARCODE_IN_TRANSIT',
  RETURN_IN_TRANSIT: 'BARCODE_RETURN_IN_TRANSIT',
  VOID: 'BARCODE_VOID',
  DUPLICATE: 'BARCODE_DUPLICATE_SCAN',
  NOT_ON_INVOICE: 'BARCODE_NOT_ON_INVOICE',
  ALREADY_RETURNED: 'BARCODE_ALREADY_RETURNED',
  NOT_FOR_THIS_LOCATION: 'BARCODE_NOT_FOR_THIS_LOCATION',
};

/* ======================================================== transactions ==== */

/* Runs fn inside a MongoDB transaction.

   The database is a replica set (Atlas), so multi-document transactions are
   available and every movement uses one: a transfer that updates 40 barcode
   rows and writes 40 ledger rows either lands completely or not at all.

   A single-node mongod cannot do this and reports IllegalOperation /
   "Transaction numbers are only allowed on a replica set". Rather than fail
   the write, fall back to running without a session - the guarded updates
   still prevent double-commits, only the all-or-nothing guarantee is lost.
   That keeps a developer on a local standalone able to work. */
export async function withTransaction(fn) {
  let session;
  try {
    session = await mongoose.startSession();
  } catch {
    return fn(null);
  }

  try {
    let out;
    await session.withTransaction(async () => { out = await fn(session); });
    return out;
  } catch (err) {
    if (isNoTransactionSupport(err)) return fn(null);
    throw err;
  } finally {
    session.endSession().catch(() => {});
  }
}

function isNoTransactionSupport(err) {
  const text = String(err?.message || '');
  return err?.code === 20 ||
    /Transaction numbers are only allowed/i.test(text) ||
    /replica set|mongos/i.test(text) && /transaction/i.test(text);
}

/* ============================================================= scanning === */

/* The one filter a scanned or typed code is looked up by.

   A unit answers to its own number ("9A1135"), its composed value - which a
   label printed today encodes compactly ("G1318*05178*1*1") while the row
   stores it spaced ("G1318 * 05178 * 1 * 1") - and its old vendor number.
   Every spelling is listed for an exact, indexed $in; never a regex. */
export function barcodeFilter(codes) {
  const list = [...new Set((Array.isArray(codes) ? codes : [codes]).flatMap((c) => barcodeSpellings(c)))];
  return {
    $or: [
      { barcodeNo: { $in: list } },
      { barcodeGenerated: { $in: list } },
      { oldBarcode: { $in: list } },
    ],
  };
}

/* How closely a unit answers to a code: 0 its own number, 1 its composed
   value, 2 its old barcode, 3 not at all. */
function matchRank(unit, code) {
  const rank = [unit?.barcodeNo, unit?.barcodeGenerated, unit?.oldBarcode].findIndex((v) => sameBarcode(v, code));
  return rank === -1 ? 3 : rank;
}

/* Of some units, the one a code means (the closest match - see matchRank),
   or null. For mapping a document's typed text back to the unit loaded for it. */
export function unitFor(units, code) {
  let best = null;
  (units || []).forEach((u) => {
    const rank = matchRank(u, code);
    if (rank < 3 && (!best || rank < matchRank(best, code))) best = u;
  });
  return best;
}

/* Resolves a scanned code to a unit and checks it may be used for `intent`.

   Returns the barcode row. Throws InventoryError with a specific code and a
   message written for the person holding the scanner.

   `intent` is one of:
     SELL            - billing at the till
     TRANSFER        - adding to an outbound stock transfer
     RECEIVE         - accepting an inbound transfer at the destination
     RETURN_TO_SOURCE- destination sending stock back
     RECEIVE_RETURN  - source taking a return back into stock
     POS_RETURN      - customer returning a sold unit
     LOOKUP          - read-only, no state requirement                     */
export async function scanBarcode({
  code, businessId, locationId, intent = 'LOOKUP',
  invoiceId = null, transferId = null, alreadyScanned = [], session = null,
} = {}) {
  const text = String(code || '').trim();
  if (!text) throw new InventoryError(SCAN_ERRORS.NOT_FOUND, 'Scan or enter a barcode.', { status: 400 });

  /* The scan must not be slowed by a regex - every field here is indexed and
     matched exactly, which is what makes the till feel instant.

     oldBarcode is included because most of the stock in this database came in
     from a supplier dump carrying the vendor's own printed number and no
     generated one. That number is what is physically on the goods, so it is
     what the scanner will read.

     Any spelling of the code is accepted - see barcodeFilter. When several
     rows answer, the one whose own number it is comes first, then the one
     whose composed value it is, then the one whose old barcode it is; the
     usable-pick below still decides among them. */
  const q = BarcodeLabel.find({
    ...barcodeFilter([text]),
    ...(businessId ? { businessId: String(businessId) } : {}),
  }).limit(50);
  if (session) q.session(session);
  const matches = (await q.lean()).sort((a, b) => matchRank(a, text) - matchRank(b, text));

  /* ONE NUMBER, SEVERAL ROWS.

     Barcode numbers issued before the atomic counter existed are not all
     unique - the browser held its own running number, so two operators
     generating at once produced overlapping labels. Those duplicates are on
     physical goods and cannot be recalled.

     Taking the first match would mean only ONE of, say, ten pieces sharing a
     number could ever be sold, and the other nine would be stuck in stock
     forever. So when a number is ambiguous, the unit that can actually be
     used for this intent is chosen: each scan consumes the next available
     one. Piece-level traceability is degraded for those labels - that is
     inherent to a duplicated label, not something this code can recover -
     but the stock figures stay correct. */
  const unit = matches.length > 1 ? pickUsable(matches, { intent, locationId, invoiceId, transferId }) : matches[0];

  if (!unit) {
    /* Distinguish "no such barcode" from "that barcode belongs to another
       business" - the second is a real situation when one operator has the
       wrong branch selected, and the generic message sends them hunting. */
    const elsewhere = businessId
      ? await BarcodeLabel.find(barcodeFilter([text])).select('businessId').limit(20).lean()
      : [];
    if (elsewhere.length) {
      /* NAME THE BUSINESS. "A different business" leaves the operator to guess
         which of several branches to switch to; naming it turns the refusal
         into an instruction.

         Several rows can answer one number - legacy labels are not unique, see
         the note above - so every distinct owner is listed rather than
         whichever row happened to come back first.

         The lookup is only ever reached on this failure, never on a good scan,
         so it costs the till nothing. If it fails the refusal still stands
         with the old wording: knowing the name is a help, not a condition. */
      let owners = '';
      try {
        const { default: Business } = await import('@/models/Business');
        const ids = [...new Set(elsewhere.map((row) => String(row.businessId)).filter(Boolean))];
        const rows = await Business.find({ _id: { $in: ids } })
          .select('name businessPrintName').lean();
        owners = rows
          .map((b) => b.name || b.businessPrintName)
          .filter(Boolean)
          .join(', ');
      } catch {
        owners = '';
      }

      throw new InventoryError(SCAN_ERRORS.WRONG_BUSINESS,
        'Barcode ' + text + ' belongs to '
          + (owners || 'a different business')
          + '. Check the business selected at the top.',
        { status: 404, barcodeNo: text, businessName: owners });
    }
    throw new InventoryError(SCAN_ERRORS.NOT_FOUND,
      'Barcode ' + text + ' is not in the system.', { status: 404, barcodeNo: text });
  }

  /* a repeat scan of a unique barcode within the same document is the single
     most common scanner mishap - a double trigger - and must never add twice */
  if (alreadyScanned.some((b) => sameBarcode(b, unit.barcodeNo || unit.barcodeGenerated))) {
    throw new InventoryError(SCAN_ERRORS.DUPLICATE,
      'Barcode ' + text + ' is already on this document.',
      { status: 409, barcodeNo: text, unit: shape(unit) });
  }

  if (intent !== 'LOOKUP') assertUsable(unit, { intent, locationId, invoiceId, transferId });
  return unit;
}

/* Of several rows sharing one barcode number, the one this scan can use.

   Falls back to the first row when none is usable, so the caller still gets a
   specific unit to report on - "already sold on INV/26/0142" is a better
   answer than "not found", and assertUsable will produce it. */
function pickUsable(matches, ctx) {
  for (const candidate of matches) {
    try {
      assertUsable(candidate, ctx);
      return candidate;
    } catch {
      /* not this one - try the next row sharing the number */
    }
  }
  return matches[0];
}

/* The state rules, one place, so POS and Stock Transfer cannot drift. */
function assertUsable(unit, { intent, locationId, invoiceId, transferId }) {
  const no = unit.barcodeNo || unit.barcodeGenerated || '';
  const at = String(unit.currentLocationId || unit.locationId || '');
  const want = String(locationId || '');

  const sold = () => new InventoryError(SCAN_ERRORS.ALREADY_SOLD,
    'Barcode ' + no + ' was already sold' + (unit.billingNo ? ' on ' + unit.billingNo : '') + '.',
    { barcodeNo: no, unit: shape(unit) });
  const transit = () => new InventoryError(SCAN_ERRORS.IN_TRANSIT,
    'Barcode ' + no + ' is in transit' + (unit.transferNo ? ' on transfer ' + unit.transferNo : '') +
    ' and has not been received yet.', { barcodeNo: no, unit: shape(unit) });
  const returning = () => new InventoryError(SCAN_ERRORS.RETURN_IN_TRANSIT,
    'Barcode ' + no + ' is on its way back to the source location and cannot be used here.',
    { barcodeNo: no, unit: shape(unit) });
  const voided = () => new InventoryError(SCAN_ERRORS.VOID,
    'Barcode ' + no + ' has been written off or returned to the vendor.',
    { barcodeNo: no, unit: shape(unit) });
  const elsewhere = () => new InventoryError(SCAN_ERRORS.WRONG_LOCATION,
    'Barcode ' + no + ' is held at another location, not the one selected.',
    { barcodeNo: no, unit: shape(unit) });

  const mustBeInStockHere = () => {
    if (unit.status === BARCODE_STATUS.SOLD) throw sold();
    if (unit.status === BARCODE_STATUS.IN_TRANSIT) throw transit();
    if (unit.status === BARCODE_STATUS.RETURN_IN_TRANSIT) throw returning();
    if (unit.status === BARCODE_STATUS.VOID) throw voided();
    if (unit.status !== BARCODE_STATUS.IN_STOCK) {
      throw new InventoryError(SCAN_ERRORS.NOT_FOUND,
        'Barcode ' + no + ' is not available (' + unit.status + ').', { barcodeNo: no, unit: shape(unit) });
    }
    /* Only enforced when the caller names a location. Rows generated before
       this module existed have no currentLocationId; treating those as
       "wrong location" would make every pre-existing barcode unscannable, so
       an unplaced unit is accepted where it is scanned and placed by the
       movement that follows. */
    if (want && at && at !== want) throw elsewhere();
  };

  switch (intent) {
    case 'SELL':
    case 'TRANSFER':
      mustBeInStockHere();
      return;

    case 'RECEIVE': {
      if (unit.status === BARCODE_STATUS.IN_STOCK && String(unit.currentLocationId || '') === want) {
        throw new InventoryError(SCAN_ERRORS.DUPLICATE,
          'Barcode ' + no + ' has already been received at this location.',
          { barcodeNo: no, unit: shape(unit) });
      }
      if (unit.status !== BARCODE_STATUS.IN_TRANSIT) {
        throw new InventoryError(SCAN_ERRORS.NOT_FOR_THIS_LOCATION,
          'Barcode ' + no + ' is not on an inbound transfer (' + unit.status + ').',
          { barcodeNo: no, unit: shape(unit) });
      }
      if (transferId && String(unit.transferId || '') !== String(transferId)) {
        throw new InventoryError(SCAN_ERRORS.NOT_FOR_THIS_LOCATION,
          'Barcode ' + no + ' belongs to transfer ' + (unit.transferNo || 'another document') + ', not this one.',
          { barcodeNo: no, unit: shape(unit) });
      }
      return;
    }

    case 'RETURN_TO_SOURCE':
      mustBeInStockHere();
      return;

    case 'RECEIVE_RETURN': {
      if (unit.status !== BARCODE_STATUS.RETURN_IN_TRANSIT) {
        throw new InventoryError(SCAN_ERRORS.NOT_FOR_THIS_LOCATION,
          'Barcode ' + no + ' is not on an inbound return (' + unit.status + ').',
          { barcodeNo: no, unit: shape(unit) });
      }
      return;
    }

    case 'POS_RETURN': {
      if (unit.status !== BARCODE_STATUS.SOLD) {
        throw new InventoryError(SCAN_ERRORS.ALREADY_RETURNED,
          unit.status === BARCODE_STATUS.IN_STOCK
            ? 'Barcode ' + no + ' is in stock - it has not been sold, or it has already been returned.'
            : 'Barcode ' + no + ' cannot be returned (' + unit.status + ').',
          { barcodeNo: no, unit: shape(unit) });
      }
      if (invoiceId && String(unit.billingId || '') !== String(invoiceId)) {
        throw new InventoryError(SCAN_ERRORS.NOT_ON_INVOICE,
          'Barcode ' + no + ' was sold on ' + (unit.billingNo || 'a different invoice') + ', not this one.',
          { barcodeNo: no, unit: shape(unit) });
      }
      return;
    }

    default:
  }
}

/* The shape every screen receives for a scanned unit. Flattened so the till
   and the transfer table read the same fields. */
export function shape(u) {
  if (!u) return null;
  return {
    _id: String(u._id),
    barcodeNo: u.barcodeNo || u.barcodeGenerated || '',
    itemId: u.itemId ? String(u.itemId) : '',
    itemCode: u.itemCode || '',
    itemName: u.itemName || u.printDescription || u.supplierDescription || u.itemCode || '',
    description: u.printDescription || u.supplierDescription || '',
    /* the two descriptions kept SEPARATE as well as merged into `description`
       above: the GRC barcode screen edits them as distinct fields, and the
       merged form cannot say which of the two it came from. Additive - every
       existing caller still reads `description`. */
    printDescription: u.printDescription || '',
    supplierDescription: u.supplierDescription || '',
    uom: u.uom || '',
    uomType: u.uomType || '',
    batchType: u.batchType || u.batchUnique || '',
    qty: Number(u.qtyNum ?? u.qty ?? 1) || 1,
    hsn: u.hsn || '',
    gst: Number(String(u.gst || '').match(/[\d.]+/)?.[0] || 0),
    rate: Number(u.finalNet || u.purRate) || 0,
    rsp: Number(u.retailPrice) || 0,
    offerPrice: Number(u.offerPrice) || 0,
    wsp: Number(u.wspPrice) || 0,
    status: u.status || '',
    currentLocationId: u.currentLocationId ? String(u.currentLocationId) : '',
    grcId: u.grcId || '',
    grcNo: u.grcNo || '',
    supplierId: u.supplierId || '',
    /* the Serial No. the unit's value carries - never its Bill Sl No. */
    serialNo: serialNoOfUnit(u) || u.serialNo || '',
    batchNo: u.batchNo || '',
    transferNo: u.transferNo || '',
    billingNo: u.billingNo || '',
    /* Both barcodes are offered as a fallback: the August photo set is filed
       under the code the unit was originally labelled with, which for a
       relabelled unit is oldBarcode rather than the current one. */
    image: imageUrl(u.imageUrl || u.filePath || '', u.barcodeNo || u.barcodeGenerated, u.oldBarcode),
  };
}

/* ------------------------------------------------------------ images ---- */

/* Photos that ship with the repo under public/, filed by barcode -
   public/august_8A_images/8A1002.jpg is served at /august_8A_images/8A1002.jpg.

   These units carry no imageUrl of their own: the mobile app writes a photo
   onto the barcode row when staff upload one, and for this batch nobody did -
   the pictures came over as a folder instead. Rather than backfill 98 rows
   and have the next drop need the same treatment, the folder IS the lookup.

   The listing is read once per process and only for barcodes we are actually
   asked about, so a screen full of units costs one readdir, not one stat per
   row. A missing folder is not an error - it just means nothing to serve. */
const LOCAL_IMAGE_DIR = 'august_8A_images';
let localImages = null;

function localImageFor(barcode) {
  const code = String(barcode || '').trim();
  if (!code) return '';
  if (!localImages) {
    localImages = new Map();
    try {
      const dir = path.join(process.cwd(), 'public', LOCAL_IMAGE_DIR);
      for (const file of fs.readdirSync(dir)) {
        localImages.set(file.replace(/\.[^.]+$/, '').toUpperCase(), file);
      }
    } catch { /* folder absent - leaves the map empty, every lookup misses */ }
  }
  const file = localImages.get(code.toUpperCase());
  return file ? `/${LOCAL_IMAGE_DIR}/${file}` : '';
}

/* `value` is whatever the row stored; the barcodes are only consulted when it
   stored nothing, so an uploaded photo always wins over the shipped one. */
export function imageUrl(value, ...barcodes) {
  const stored = String(value || '').trim();
  if (stored) {
    if (/^(https?:|data:|blob:|\/)/i.test(stored)) return stored;
    return '/api/files/' + stored.replace(/^\/+/, '');
  }
  for (const barcode of barcodes) {
    const local = localImageFor(barcode);
    if (local) return local;
  }
  return '';
}

/* ============================================================ movements === */

/* The one function that changes a unit's state.

   `units`       rows already read (must carry _id and the status we expect)
   `expect`      the status each unit must still be in, or null to skip
   `set`         fields to write on the barcode row
   `movement`    the ledger row template; per-unit fields are filled in here

   Returns { moved, skipped } - skipped carries the units another request got
   to first, so the caller can report exactly which barcodes did not commit
   rather than failing the whole document. */
export async function applyMovement({
  units, expect, set = {}, movement, user = null, session = null, strict = true,
}) {
  const moved = [];
  const skipped = [];
  const ledger = [];

  for (const unit of units) {
    const filter = { _id: unit._id, ...(expect ? { status: expect } : {}) };

    const res = await BarcodeLabel.updateOne(
      filter,
      { $set: { ...set, updatedAt: new Date() } },
      session ? { session } : {}
    );

    /* matchedCount 0 means the guard failed: between the read and here, some
       other request moved this unit. That is exactly the double-scan /
       double-submit case, and it is why the check is part of the write. */
    if (!res.matchedCount) { skipped.push(unit); continue; }

    moved.push(unit);
    ledger.push(ledgerRow(unit, { set, movement, user, expect }));
  }

  if (strict && skipped.length) {
    throw new InventoryError('MOVEMENT_CONFLICT',
      skipped.length === units.length
        ? 'None of these barcodes could be moved - another user changed them first. Reload and try again.'
        : skipped.length + ' of ' + units.length + ' barcodes were changed by someone else and were not included: ' +
          skipped.map((u) => u.barcodeNo || u.barcodeGenerated).slice(0, 8).join(', ') +
          (skipped.length > 8 ? '...' : ''),
      { skipped: skipped.map((u) => u.barcodeNo || u.barcodeGenerated) });
  }

  if (ledger.length) {
    await StockMovement.insertMany(ledger, session ? { session, ordered: true } : { ordered: true });
  }

  return { moved, skipped };
}

function ledgerRow(unit, { set, movement, user, expect }) {
  const qty = Number(unit.qtyNum ?? unit.qty ?? 1) || 1;
  return {
    businessId: toId(unit.businessId),
    finYear: unit.finYear || movement.finYear || '',
    type: movement.type,
    barcodeId: unit._id,
    barcodeNo: unit.barcodeNo || unit.barcodeGenerated || '',
    itemId: toId(unit.itemId),
    itemCode: unit.itemCode || '',
    itemName: unit.itemName || unit.printDescription || unit.supplierDescription || '',
    uom: unit.uom || '',
    batchType: unit.batchType || unit.batchUnique || '',
    /* signed: an outward event carries the quantity away from fromLocationId */
    qty: movement.direction === 'out' ? -qty : qty,
    fromLocationId: toId(movement.fromLocationId),
    toLocationId: toId(movement.toLocationId),
    statusBefore: expect || unit.status || '',
    statusAfter: set.status || unit.status || '',
    refModel: movement.refModel || '',
    refId: toId(movement.refId),
    refNo: movement.refNo || '',
    reason: movement.reason || '',
    notes: movement.notes || '',
    userId: toId(user?.id),
    userName: user?.name || '',
    userEmail: user?.email || '',
    at: movement.at ? new Date(movement.at) : new Date(),
  };
}

/* ====================================================== the operations ==== */

/* GRC -> stock. Called after barcode rows are inserted; stamps them into
   stock at the receiving location and opens their history. */
export async function receiveIntoStock({ units, businessId, locationId, stockPointId, grc, user, session }) {
  return applyMovement({
    units,
    expect: null,                       // freshly created, nothing to guard against
    set: {
      status: BARCODE_STATUS.IN_STOCK,
      currentLocationId: toId(locationId),
      currentBusinessId: toId(businessId),
      currentStockPointId: toId(stockPointId),
    },
    movement: {
      type: MOVEMENT_TYPES.GRC_IN,
      direction: 'in',
      toLocationId: locationId,
      refModel: 'grc',
      refId: grc?._id,
      refNo: grc?.grcNumber || '',
      at: grc?.grcDate || new Date(),
    },
    user, session, strict: false,
  });
}

/* A received unit whose quantity or item was CORRECTED on its GRC.

   The unit keeps its row, its barcode and its _id - it is corrected, not
   received again - but the ledger has to follow: the stock reports add
   movement quantities up by item code, and the unit's GRC_IN still says what
   was first received. So the receipt is reversed as first recorded and
   recorded again as corrected, against the same barcode. The unit's state
   does not change, so nothing here touches the barcode row.

   `corrections` is [{ before: <unit as read>, after: <the fields changed> }]. */
export async function restateReceipt({ corrections, grc, user, session }) {
  const at = new Date();
  const reason = 'Received quantity/item corrected on the GRC';
  const ledger = (corrections || []).flatMap(({ before, after }) => {
    const where = before.currentLocationId || before.locationId || null;
    const movement = { refModel: 'grc', refId: grc?._id, refNo: grc?.grcNumber || '', reason, at };
    return [
      ledgerRow(before, {
        set: {}, user, expect: null,
        movement: { ...movement, type: MOVEMENT_TYPES.GRC_VOID, direction: 'out', fromLocationId: where },
      }),
      ledgerRow({ ...before, ...after }, {
        set: {}, user, expect: null,
        movement: { ...movement, type: MOVEMENT_TYPES.GRC_IN, direction: 'in', toLocationId: where },
      }),
    ];
  });

  if (ledger.length) {
    await StockMovement.insertMany(ledger, session ? { session, ordered: true } : { ordered: true });
  }
  return { recorded: ledger.length };
}

/* Stock leaves the source on a transfer. Units become IN_TRANSIT: they are no
   longer sellable at the source and not yet countable at the destination,
   which is what stops them being billed twice during the journey. */
export async function despatchTransfer({ units, transfer, fromLocationId, toLocationId, user, session }) {
  return applyMovement({
    units,
    expect: BARCODE_STATUS.IN_STOCK,
    set: {
      status: BARCODE_STATUS.IN_TRANSIT,
      transferId: toId(transfer._id),
      transferNo: transfer.transferNo || '',
      receivedId: null,
      returnId: null,
      returnReason: '',
    },
    movement: {
      type: MOVEMENT_TYPES.TRANSFER_OUT,
      direction: 'out',
      fromLocationId, toLocationId,
      refModel: 'stockTransfer',
      refId: transfer._id,
      refNo: transfer.transferNo || '',
      at: transfer.transferDate || new Date(),
    },
    user, session,
  });
}

/* Destination accepts. The unit lands in the destination's stock. */
export async function receiveTransfer({ units, transfer, toLocationId, toBusinessId, toStockPointId, user, session }) {
  return applyMovement({
    units,
    expect: BARCODE_STATUS.IN_TRANSIT,
    set: {
      status: BARCODE_STATUS.IN_STOCK,
      currentLocationId: toId(toLocationId),
      currentBusinessId: toId(toBusinessId),
      currentStockPointId: toId(toStockPointId),
      receivedId: toId(transfer._id),
    },
    movement: {
      type: MOVEMENT_TYPES.TRANSFER_IN,
      direction: 'in',
      fromLocationId: transfer.fromLocationId,
      toLocationId,
      refModel: 'stockTransfer',
      refId: transfer._id,
      refNo: transfer.transferNo || '',
      at: new Date(),
    },
    user, session,
  });
}

/* Destination sends stock back - damaged, wrong item, excess.

   Accepts units that are still IN_TRANSIT (rejected on arrival, never taken
   into stock) as well as units already received, because both are real: a
   damaged carton is refused at the door, a wrong item is found the next day. */
export async function returnToSource({ units, transfer, fromLocationId, toLocationId, reason, notes, user, session }) {
  const out = { moved: [], skipped: [] };

  for (const expect of [BARCODE_STATUS.IN_STOCK, BARCODE_STATUS.IN_TRANSIT]) {
    const batch = units.filter(
      (u) => u.status === expect && !out.moved.some((m) => String(m._id) === String(u._id))
    );
    if (!batch.length) continue;

    const res = await applyMovement({
      units: batch,
      expect,
      set: {
        status: BARCODE_STATUS.RETURN_IN_TRANSIT,
        returnId: toId(transfer.returnId || transfer._id),
        returnReason: reason || '',
      },
      movement: {
        type: MOVEMENT_TYPES.TRANSFER_RETURN_OUT,
        direction: 'out',
        fromLocationId, toLocationId,
        refModel: 'stockTransferReturn',
        refId: transfer.returnId || transfer._id,
        refNo: transfer.returnNo || transfer.transferNo || '',
        reason: reason || '', notes: notes || '',
        at: new Date(),
      },
      user, session, strict: false,
    });
    out.moved.push(...res.moved);
    out.skipped.push(...res.skipped);
  }

  const unmoved = units.filter((u) => !out.moved.some((m) => String(m._id) === String(u._id)));
  if (unmoved.length) {
    throw new InventoryError('MOVEMENT_CONFLICT',
      unmoved.length + ' barcode(s) could not be returned - they are no longer in a returnable state: ' +
      unmoved.map((u) => u.barcodeNo || u.barcodeGenerated).slice(0, 8).join(', '),
      { skipped: unmoved.map((u) => u.barcodeNo || u.barcodeGenerated) });
  }
  return out;
}

/* Source takes the returned stock back in. */
export async function receiveReturnAtSource({ units, ref, locationId, businessId, stockPointId, user, session }) {
  return applyMovement({
    units,
    expect: BARCODE_STATUS.RETURN_IN_TRANSIT,
    set: {
      status: BARCODE_STATUS.IN_STOCK,
      currentLocationId: toId(locationId),
      currentBusinessId: toId(businessId),
      currentStockPointId: toId(stockPointId),
    },
    movement: {
      type: MOVEMENT_TYPES.TRANSFER_RETURN_IN,
      direction: 'in',
      toLocationId: locationId,
      refModel: 'stockTransferReturn',
      refId: ref?._id,
      refNo: ref?.returnNo || ref?.transferNo || '',
      at: new Date(),
    },
    user, session,
  });
}

/* Sold at the till. This is the write that was missing entirely - without it
   a barcode stayed in stock after being billed and could be sold again. */
export async function sellUnits({ units, invoice, locationId, user, session }) {
  return applyMovement({
    units,
    expect: BARCODE_STATUS.IN_STOCK,
    set: {
      status: BARCODE_STATUS.SOLD,
      billingId: toId(invoice._id),
      billingNo: invoice.invoiceNo || '',
      soldAt: invoice.date ? new Date(invoice.date) : new Date(),
    },
    movement: {
      type: MOVEMENT_TYPES.POS_OUT,
      direction: 'out',
      fromLocationId: locationId,
      refModel: 'posInvoice',
      refId: invoice._id,
      refNo: invoice.invoiceNo || '',
      at: invoice.date || new Date(),
    },
    user, session,
  });
}

/* Customer return at the till - the unit goes back into sellable stock. */
export async function returnSoldUnits({ units, credit, locationId, businessId, reason, user, session }) {
  return applyMovement({
    units,
    expect: BARCODE_STATUS.SOLD,
    set: {
      status: BARCODE_STATUS.IN_STOCK,
      currentLocationId: toId(locationId),
      currentBusinessId: toId(businessId),
      billingId: null,
      billingNo: '',
      soldAt: null,
      returnReason: reason || '',
    },
    movement: {
      type: MOVEMENT_TYPES.POS_RETURN_IN,
      direction: 'in',
      toLocationId: locationId,
      refModel: 'posReturn',
      refId: credit?._id,
      refNo: credit?.invoiceNo || '',
      reason: reason || '',
      at: new Date(),
    },
    user, session,
  });
}

/* Written off, or returned to the vendor on a GRT. */
export async function voidUnits({ units, ref, reason, user, session }) {
  return applyMovement({
    units,
    expect: null,
    set: { status: BARCODE_STATUS.VOID, returnReason: reason || '' },
    movement: {
      type: MOVEMENT_TYPES.GRC_VOID,
      direction: 'out',
      fromLocationId: units[0]?.currentLocationId || null,
      refModel: ref?.model || '',
      refId: ref?._id,
      refNo: ref?.no || '',
      reason: reason || '',
      at: new Date(),
    },
    user, session, strict: false,
  });
}

/* Stock adjustment.

   Adjustments are the one movement that is NOT barcode-driven: the screen
   records "we are 3 short of item X", not which three pieces. So this writes
   quantity-level ledger rows, with barcodeNo left blank, and moves an actual
   unit only for the lines that do name one.

   That is why it lives here rather than in the route: the adjustment still
   has to reach the same ledger every other movement uses, or the stock
   reports would silently disagree with the adjustment register. A line with
   no barcode is still a real change to the quantity on hand, and the report
   must see it.

   `direction` is 'in' for a stock addition and 'out' for a subtraction. */
export async function adjustStock({
  lines, direction, businessId, locationId, finYear, ref, reason, user, session,
}) {
  const out = direction === 'out';
  const rows = (lines || []).map((l) => {
    const qty = Math.abs(Number(pickLine(l, 'qty', 'QTY', 'Qty')) || 0);
    return {
      businessId: toId(businessId),
      finYear: finYear || '',
      type: out ? MOVEMENT_TYPES.ADJUST_OUT : MOVEMENT_TYPES.ADJUST_IN,
      barcodeNo: String(pickLine(l, 'barcodeNo', 'Barcode No', 'barcode') || ''),
      itemCode: String(pickLine(l, 'itemCode', 'Item Code') || ''),
      itemName: String(pickLine(l, 'itemName', 'Item Name') || ''),
      uom: String(pickLine(l, 'uom', 'UOM') || ''),
      qty: out ? -qty : qty,
      fromLocationId: out ? toId(locationId) : null,
      toLocationId: out ? null : toId(locationId),
      statusBefore: '', statusAfter: '',
      refModel: 'stockAdjustment',
      refId: toId(ref?._id),
      refNo: ref?.adjustmentNo || '',
      reason: reason || '',
      userId: toId(user?.id),
      userName: user?.name || '',
      userEmail: user?.email || '',
      at: ref?.adjustmentDate ? new Date(ref.adjustmentDate) : new Date(),
    };
  }).filter((r) => r.qty !== 0 && (r.itemCode || r.barcodeNo));

  if (!rows.length) return { recorded: 0, unitsMoved: 0 };

  /* Lines that DO name a barcode move that unit as well - a subtraction
     writes it off, an addition puts it back - so the barcode's own status
     never contradicts the ledger entry just written for it.

     Resolved before the ledger is written: the line holds whatever was typed
     or scanned (a composed value, an old vendor number), and the ledger row
     records the unit's own number and id, which is what its history is
     looked up by. */
  const codes = rows.map((r) => r.barcodeNo).filter(Boolean);
  const units = codes.length
    ? await loadUnits(codes, {
      businessId,
      session,
      prefer: out ? BARCODE_STATUS.IN_STOCK : BARCODE_STATUS.VOID,
    })
    : [];
  const unitOf = unitsByCode(codes, units);
  rows.forEach((r) => {
    const unit = r.barcodeNo ? unitOf.get(barcodeKey(r.barcodeNo)) : null;
    if (!unit) return;
    r.barcodeNo = unit.barcodeNo || unit.barcodeGenerated || r.barcodeNo;
    r.barcodeId = unit._id;
  });

  await StockMovement.insertMany(rows, session ? { session, ordered: true } : { ordered: true });

  let unitsMoved = 0;
  if (units.length) {
    const res = await BarcodeLabel.updateMany(
      { _id: { $in: units.map((u) => u._id) } },
      {
        $set: out
          ? { status: BARCODE_STATUS.VOID, returnReason: reason || 'Stock adjustment' }
          : { status: BARCODE_STATUS.IN_STOCK, currentLocationId: toId(locationId) },
      },
      session ? { session } : {}
    );
    unitsMoved = res.modifiedCount || 0;
  }

  return { recorded: rows.length, unitsMoved };
}

/* The adjustment screen keys its lines by column heading, the same way the
   generic Sell screens do - see lib/reports.js, which reads both spellings
   for exactly this reason. */
function pickLine(line, ...keys) {
  for (const k of keys) {
    if (line?.[k] !== undefined && line[k] !== null && line[k] !== '') return line[k];
  }
  return undefined;
}

/* ============================================================== queries === */

/* Loads the rows for a set of scanned barcodes, in one query.

   Returns them in the order the codes were given, which is the order the
   operator scanned - so the document reads the way the shelf was worked.

   `prefer` is the status a caller expects its units to be in. It matters
   because of the duplicated barcode numbers described in scanBarcode: when
   several rows share a number, the one in the expected state is the one this
   document means. Without it, a transfer could pick a sold row and commit
   nothing while the shelf unit stayed available.

   A row is never returned twice, so a document cannot accidentally move the
   same physical unit for two different scans.

   A code may be given in any spelling (see barcodeFilter); two spellings of
   one value are one code. */
export async function loadUnits(codes, { businessId, session = null, prefer = BARCODE_STATUS.IN_STOCK } = {}) {
  const list = uniqueCodes(codes);
  if (!list.length) return [];

  const q = BarcodeLabel.find({
    ...barcodeFilter(list),
    ...(businessId ? { businessId: String(businessId) } : {}),
  });
  if (session) q.session(session);
  const rows = await q.lean();

  /* every row that answers to a given number, keyed by barcodeKey so either
     spelling finds it - rows answering by their own number first, then by
     their composed value, then by their old barcode */
  const byNo = new Map();
  const add = (value, row) => {
    const key = barcodeKey(value);
    if (!key) return;
    if (!byNo.has(key)) byNo.set(key, []);
    if (!byNo.get(key).includes(row)) byNo.get(key).push(row);
  };
  ['barcodeNo', 'barcodeGenerated', 'oldBarcode'].forEach((field) => rows.forEach((r) => add(r[field], r)));

  const used = new Set();
  const out = [];
  list.forEach((code) => {
    const candidates = byNo.get(barcodeKey(code)) || [];
    const free = candidates.filter((r) => !used.has(String(r._id)));
    /* the one in the expected state, or failing that any unused one - so the
       caller still gets a unit to report a specific error about */
    const pick = free.find((r) => r.status === prefer) || free[0];
    if (!pick) return;
    used.add(String(pick._id));
    out.push(pick);
  });
  return out;
}

/* The codes as loadUnits reads them: trimmed, blanks dropped, and two
   spellings of one value kept once - the first. */
function uniqueCodes(codes) {
  const byKey = new Map();
  (codes || []).forEach((c) => {
    const key = barcodeKey(c);
    if (key && !byKey.has(key)) byKey.set(key, String(c).trim());
  });
  return [...byKey.values()];
}

/* The unit loadUnits gave each code, as a Map keyed by barcodeKey(code).
   `codes` must be the list loadUnits was given.

   loadUnits returns its units in the codes' order and gives a unit to one
   code only, so the two lists are walked together. Matching by value alone
   would hand one unit to two codes that both answer to it - its own number
   and its old barcode, say - and a document would carry two lines for one
   piece. */
export function unitsByCode(codes, units) {
  const byKey = new Map();
  let next = 0;
  uniqueCodes(codes).forEach((code) => {
    const unit = (units || [])[next];
    if (!unit || !unitAnswersTo(unit, code)) return;
    byKey.set(barcodeKey(code), unit);
    next += 1;
  });
  return byKey;
}

/* ------------------------------------------- codes against documents ---- */

/* A POS invoice, a POS return and a stock transfer store, per line, only the
   unit's own number (and a transfer line its barcodeId). A scanned label may
   carry the unit's composed value or its old vendor number instead, so the
   code is first resolved to the units it may mean - and only then matched
   against the lines.

   The units some codes may mean, identity fields only. With `lines`, a code
   some line already carries (in either spelling) is not looked up at all: it
   means that line, and a screen that sends back its own lines' numbers costs
   no query. */
export async function barcodeCandidates(codes, { businessId = null, session = null, lines = null } = {}) {
  const list = (codes || []).filter((c) =>
    barcodeKey(c) && !(lines || []).some((l) => sameBarcode(l?.barcodeNo, c)));
  if (!list.length) return [];

  const q = BarcodeLabel.find({
    ...barcodeFilter(list),
    ...(businessId ? { businessId: String(businessId) } : {}),
  }).select('_id barcodeNo barcodeGenerated oldBarcode');
  if (session) q.session(session);
  return q.lean();
}

/* The lines of a document a code means. A code that is a line's own number,
   in either spelling, means that line and nothing else; any other code means
   the lines of the units it resolved to (`candidates`, from
   barcodeCandidates). Lines without a barcode never match. */
export function linesAnswering(lines, code, candidates = []) {
  const list = (lines || []).filter((l) => l && l.barcodeNo);
  const direct = list.filter((l) => sameBarcode(l.barcodeNo, code));
  if (direct.length) return direct;

  const units = (candidates || []).filter((u) => unitAnswersTo(u, code));
  if (!units.length) return [];
  return list.filter((l) => units.some((u) =>
    (l.barcodeId && String(l.barcodeId) === String(u._id))
    || sameBarcode(l.barcodeNo, u.barcodeNo)
    || sameBarcode(l.barcodeNo, u.barcodeGenerated)));
}

/* Every exact string a document line may store for these codes - the codes
   and the candidates' own values, in each spelling - for an $in on
   items.barcodeNo / lines.barcodeNo. */
export function lineBarcodeSpellings(codes, candidates = []) {
  const values = [...(codes || []), ...(candidates || []).flatMap((u) => [u.barcodeNo, u.barcodeGenerated])];
  return [...new Set(values.flatMap((v) => barcodeSpellings(v)))];
}

/* Full history of one barcode, oldest first - the audit trail screen.
   Matched on the number in either spelling, and on the unit's id when the
   caller has it, so a ledger row written under another spelling still shows. */
export async function barcodeHistory(barcodeNo, { barcodeId = null } = {}) {
  const or = [{ barcodeNo: { $in: barcodeSpellings(barcodeNo) } }];
  const id = toId(barcodeId);
  if (id) or.push({ barcodeId: id });
  return StockMovement.find({ $or: or })
    .sort({ at: 1, createdAt: 1 })
    .lean();
}

/* ------------------------------------------------------------- internals -- */

function toId(v) {
  if (!v) return null;
  const s = String(v);
  return mongoose.isValidObjectId(s) ? new mongoose.Types.ObjectId(s) : null;
}
