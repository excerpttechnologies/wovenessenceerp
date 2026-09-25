import mongoose, { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import Grc from '@/models/Grc';
import Item from '@/models/Item';
import { Supplier } from '@/lib/contacts';
import { handler, json } from '@/lib/apiError';
import { requirePermission, PERMISSIONS } from '@/lib/rbac';
import { escapeRegex } from '@/lib/validate';
import { nextDocNumber } from '@/lib/docnumber';
import { BarcodeLabel, BARCODE_STATUS } from '@/lib/barcodeLabel';
import { reserveBarcodeNumbers, loadFormat, uomTypeOf, batchTypeOf } from '@/lib/barcodeEngine';
import { withTransaction, receiveIntoStock, restateReceipt, voidUnits, InventoryError } from '@/lib/inventory';
import { screenDenialAny, ACTIONS as PERM, BARCODE_ROW_SCREENS } from '@/lib/screenPermission';
import { matchRowsToUnits, editedFields, toGridRow, rowBarcode, unitBarcode, clientIdOf, pmfOf, PMF_REQUIRED_MESSAGE } from '@/lib/barcodeRowSync';
import {
  BARCODE_SEPARATOR, composeBarcodeValue, barcodeValueProblem, billSlNoProblem, billSlNoForBarcode,
  grcNumberForBarcode, nextSeqStart, highestSeq, hasComposedBarcode, highestSerialNo, serialFloorOf,
  serialFloorKey, legacySerialFloor, composedValueOf, parseBarcodeValue, isComposedBarcodeValue,
  barcodeKey, barcodeSpellings, barcodeSearchPattern,
} from '@/lib/barcodeValue';
import { purchasePriceError, normalisePurchasePrice } from '@/lib/purchasePrice';
import { saveBatchTypeOf } from '@/lib/barcodeUnits';
import { grcTotals } from '@/lib/grcMoney';

/* /api/barcode-generation

   Barcode Generation is where stock ENTERS the system - it is the only thing
   that creates a barcodeLabel row, and a barcodeLabel row is one unit of
   stock. Two things changed here:

   1. The barcode NUMBER is issued by the server, from the atomic counter, not
      by the browser. See ../reserve/route.js for why.
   2. Saving now also places the stock: each new row is stamped IN_STOCK at
      the receiving location and gets its opening entry in the movement
      ledger. Before this, a generated barcode existed but was nowhere, which
      is why nothing downstream could tell available stock from sold stock.

   Both happen in one transaction with the GRC header, so a half-generated
   receipt is not a state the database can be left in. */

const PER_PAGE = 20;

/* ================================================================= list === */

export const GET = handler(async (req) => {
  const session = await requirePermission(null);
  await dbConnect();
  const sp = new URL(req.url).searchParams;

  /* The generated barcode rows. Answers to Print Label, GRC or GRT read -
     this one list is what Print Label prints from AND what the GRT vendor
     items picker chooses from, so gating it on Print Label alone would break
     a Goods Return Note. Only refuses when the role has a saved matrix that
     withholds all three. See lib/screenPermission.js. */
  const denied = await screenDenialAny({
    session, screens: BARCODE_ROW_SCREENS, action: PERM.READ,
    businessId: sp.get('business'), label: 'barcode rows',
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const page = Math.max(1, Number(sp.get('page') || 1));
  const perPage = Math.min(1000, Number(sp.get('perPage') || PER_PAGE));

  const filter = {};
  const business = sp.get('business');
  const location = sp.get('location');
  const finYear = sp.get('finYear');
  const grcId = sp.get('grcId');
  const supplier = sp.get('supplier');
  if (business) filter.businessId = business;
  if (location) filter.locationId = location;
  if (finYear) filter.finYear = finYear;
  if (grcId) filter.grcId = grcId;
  if (supplier) filter.supplierId = supplier;
  const status = sp.get('status'); if (status) filter.status = status;

  const code = (sp.get('code') || '').trim();
  const name = (sp.get('name') || '').trim();

  const andClauses = [];
  if (code) {
    const rx = { $regex: escapeRegex(code), $options: 'i' };
    /* a barcode is found by either spelling of its value - the label prints
       "G1319*05182*1*6", the record stores "G1319 * 05182 * 1 * 6" */
    const barcodeRx = { $regex: barcodeSearchPattern(code), $options: 'i' };
    andClauses.push({ $or: [{ itemCode: rx }, { oldBarcode: barcodeRx }, { barcodeGenerated: barcodeRx }, { barcodeNo: barcodeRx }] });
  }
  if (name) {
    const rx = { $regex: escapeRegex(name), $options: 'i' };
    andClauses.push({ $or: [{ supplierDescription: rx }, { printDescription: rx }] });
  }
  if (andClauses.length) filter.$and = andClauses;

  const total = await BarcodeLabel.countDocuments(filter);
  const rows = await BarcodeLabel.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * perPage)
    .limit(perPage)
    .lean();

  /* Supplier name and GRC number, resolved for the screens that list these
     rows - NOT for the printed label. A label no longer carries either
     (lib/barcodeLabelPrint.js toLabelData whitelists what it may print); they
     stay here because they are ERP data the listing screens show.

     Resolved per page rather than denormalised onto every row - a supplier's
     name can be corrected, and a screen opened tomorrow should show the
     corrected one. */
  const supplierIds = [...new Set(
    rows.map((r) => r.supplierId).filter((s) => s && isValidObjectId(String(s))).map(String)
  )];
  const grcIds = [...new Set(
    rows.filter((r) => !r.grcNo).map((r) => r.grcId).filter((g) => g && isValidObjectId(String(g))).map(String)
  )];

  const [suppliers, grcs] = await Promise.all([
    supplierIds.length
      ? Supplier.find({ _id: { $in: supplierIds } }).select('businessName firstName lastName contactId').lean()
      : [],
    grcIds.length
      ? Grc.find({ _id: { $in: grcIds } }).select('grcNumber').lean()
      : [],
  ]);

  const supplierName = new Map(suppliers.map((s) => [
    String(s._id),
    (s.businessName || [s.firstName, s.lastName].filter(Boolean).join(' ') || '').trim(),
  ]));
  const grcNumber = new Map(grcs.map((g) => [String(g._id), g.grcNumber || '']));

  return json({
    rows: rows.map((r) => ({
      ...r,
      _id: String(r._id),
      supplierName: supplierName.get(String(r.supplierId)) || '',
      grcNo: r.grcNo || grcNumber.get(String(r.grcId)) || '',
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / perPage)),
    perPage,
  });
});

/* ============================================================== generate === */

export const POST = handler(async (req) => {
  const body = await req.json().catch(() => ({}));
  const {
    rows, business, location, finYear, totals,
    supplierId, vendorDocNo, grcDate, grcId, stockPointId,
  } = body || {};
  /* Saved barcodes the operator removed and confirmed on the screen, by id.
     Deletion is only ever what is named here - see the edit path below. */
  const deleteIds = [...new Set(
    (Array.isArray(body?.deleteIds) ? body.deleteIds : []).map(String).filter((id) => isValidObjectId(id))
  )];

  const session = await requirePermission(PERMISSIONS.BARCODE_GENERATE, { locationId: location });
  await dbConnect();

  /* an edit of an existing GRC may consist of deletions alone */
  if (!Array.isArray(rows) || (rows.length === 0 && !(grcId && deleteIds.length))) {
    return json({ error: 'No rows to save', code: 'EMPTY' }, 400);
  }

  /* Purchase price - must be greater than 0. The same rule the Add Item form,
     the grid and its Excel import apply (lib/purchasePrice.js), enforced here
     so it holds for a request that never went through them. Checked before
     anything is written, so a refused save changes nothing.

     The value checked is exactly the one buildDocs below will store -
     `r.purRate || r.purchaseRate` - and once it passes it is stored as the
     plain number the check read: "₹1,980" passes, but written as typed it
     would read back as NaN everywhere. */
  const priceErrors = [];
  rows.forEach((row, index) => {
    const field = row.purRate ? 'purRate' : 'purchaseRate';
    const problem = purchasePriceError(row[field]);
    if (problem) {
      priceErrors.push({ ref: row.itemCode || row.itemName || `Row ${index + 1}`, problem });
      return;
    }
    row[field] = normalisePurchasePrice(row[field]);
  });

  if (priceErrors.length > 0) {
    return json({
      /* the operator's words, not a code */
      error: priceErrors[0].problem,
      code: 'INVALID_PRICE',
      details: priceErrors.slice(0, 5).map((p) => `${p.ref}: ${p.problem}`),
      totalErrors: priceErrors.length,
    }, 400);
  }

  /* SM is optional. P-M-F is required on every barcode this save CREATES
     (buildDocs); a saved barcode keeps the P-M-F it has. */

  /* An Old Barcode that is supplied must actually EXIST.

     The Add Item form makes it mandatory and will not submit until the code
     has resolved, but the client is not trusted to have done that - a typed
     or replayed code that matches nothing would otherwise be saved onto the
     new label, pointing its traceability at a record that is not there.

     Deliberately NOT mandatory here: the Excel import on this same screen
     builds rows without an Old Barcode, and requiring one server-side would
     break that existing path. So this validates what is sent, and does not
     demand that something be sent. */
  const suppliedOldBarcodes = [...new Set(
    rows.map((r) => String(r.oldBarcode || '').trim()).filter(Boolean)
  )];
  if (suppliedOldBarcodes.length) {
    /* either spelling of a composed value - a scanned label reads back
       "G1319*05182*1*6", the record holds "G1319 * 05182 * 1 * 6" */
    const spellings = [...new Set(suppliedOldBarcodes.flatMap(barcodeSpellings))];
    const found = await BarcodeLabel.find({
      $or: [
        { barcodeNo: { $in: spellings } },
        { barcodeGenerated: { $in: spellings } },
        { oldBarcode: { $in: spellings } },
      ],
      ...(business ? { businessId: String(business) } : {}),
    }).select('barcodeNo barcodeGenerated oldBarcode').lean();

    const known = new Set(found.flatMap((u) => [u.barcodeNo, u.barcodeGenerated, u.oldBarcode].filter(Boolean).map(barcodeKey)));
    const missing = suppliedOldBarcodes.filter((c) => !known.has(barcodeKey(c)));
    if (missing.length) {
      return json({
        error: 'Barcode not found. Please enter or scan a valid barcode.',
        code: 'INVALID_INPUT',
        missing,
      }, 400);
    }
  }

  /* ---- money, derived from the rows rather than trusted from the form ---
     An existing GRC is re-totalled from every row it holds once the save has
     landed, since the request may carry only some of them (grcTotals). */
  const { totalQuantity, gst, taxable, netAmount } = grcTotals(rows);

  /* Item codes on the rows are free text; resolving them once here means the
     barcode carries a real itemId and the reports stop having to re-match on
     a string. Unmatched codes are not an error - the operator may be
     receiving something not yet in the item master. */
  const itemByCode = await resolveItems(rows, business);

  const result = await withTransaction(async (dbSession) => {
    /* ---------------------------------------------- editing an existing --

       NON-DESTRUCTIVE. This used to void and delete every barcode row of the
       GRC and insert whatever the request carried: every row got a new _id on
       every save, the ledger gained a void and a receipt per row per save,
       and any row the request did not carry was gone - Generate For Changes
       sends only the changed rows, so it deleted all the others.

       Now each submitted row is matched to the barcode it already is
       (lib/barcodeRowSync.js). A matched row is updated in place, and only
       where something actually changed; a row that matches nothing is the
       only thing inserted, numbered and received into stock; and a stored row
       the request does not mention is left exactly as it is. A barcode leaves
       a GRC only by explicit deletion: the ids in deleteIds, applied in this
       same transaction, or the DELETE below.

       Everything is checked before anything is written, and a refusal is
       thrown rather than returned, so the transaction rolls back whole. */
    if (grcId) {
      if (!isValidObjectId(grcId)) return json({ error: 'Invalid grcId', code: 'BAD_INPUT' }, 400);

      /* Written FIRST, so two saves of one GRC cannot interleave: the second
         conflicts on this document, and withTransaction runs it again once
         the first has committed - when it can see the rows the first one
         inserted. That is what stops a double-clicked Submit inserting its
         new rows twice. */
      const existing = await Grc.findByIdAndUpdate(
        grcId,
        { $set: { updatedAt: new Date() } },
        { new: true, timestamps: false, ...(dbSession ? { session: dbSession } : {}) }
      );
      if (!existing) return json({ error: 'GRC not found', code: 'NOT_FOUND' }, 404);

      const current = await BarcodeLabel.find({ grcId: String(grcId) })
        .session(dbSession || null).lean();

      /* Rows removed on the screen and confirmed, named by id - never
         inferred from what the request leaves out. An id no longer on this
         GRC was deleted already and is skipped. A row of this same save may
         not name one, by id or by number: that would delete a barcode and
         bring it straight back. */
      const deleting = current.filter((u) => deleteIds.includes(String(u._id)));
      if (deleting.length) {
        /* the same three identities matchRowsToUnits uses - never a barcode
           number for a row the screen made, since those need not be unique */
        const deletingIds = new Set(deleting.map((u) => String(u._id)));
        const deletingClientIds = new Set(deleting.map((u) => String(u.clientRowId ?? '').trim()).filter(Boolean));
        const deletingNos = new Set(deleting.map(unitBarcode).filter(Boolean));
        const clash = rows.filter((row) => {
          if (row?._id) return deletingIds.has(String(row._id));
          if (clientIdOf(row)) return deletingClientIds.has(clientIdOf(row));
          return deletingNos.has(rowBarcode(row));
        });
        if (clash.length) {
          throw new InventoryError('DELETE_CONFLICT',
            'Barcode ' + [...new Set(clash.map(rowBarcode))].slice(0, 8).join(', ') +
            ' is both deleted and kept in this save. Nothing was saved. Reload the page and try again.',
            { status: 409, skipped: clash.map(rowBarcode) });
        }
        const movedAway = deleting.filter(hasMoved);
        if (movedAway.length) {
          throw new InventoryError('BARCODE_LOCKED',
            movedAway.length + ' barcode(s) marked for deletion have already moved (' +
            [...new Set(movedAway.map((u) => u.status))].join(', ') +
            ') and cannot be deleted: ' + movedAway.map(unitBarcode).slice(0, 8).join(', ') +
            '. Nothing was saved.',
            { status: 409, skipped: movedAway.map(unitBarcode) });
        }
      }
      const kept = current.filter((u) => !deleteIds.includes(String(u._id)));
      const { matched, fresh, stale, duplicated } = matchRowsToUnits(rows, kept);

      /* A row naming an _id this GRC does not hold comes from a screen opened
         before that barcode was deleted. Saving it as new would bring a
         deliberately deleted barcode back. */
      if (stale.length) {
        throw new InventoryError('STALE_ROWS',
          'This screen is out of date: ' + stale.length + ' barcode(s) on it are no longer on this GRC (' +
          stale.map(rowBarcode).filter(Boolean).slice(0, 8).join(', ') +
          ') - they were deleted from another screen. Nothing was saved. Reload the page and make your changes again.',
          { status: 409, skipped: stale.map(rowBarcode) });
      }
      if (duplicated.length) {
        throw new InventoryError('DUPLICATE_BARCODE',
          'Barcode ' + [...new Set(duplicated.map(rowBarcode))].slice(0, 8).join(', ') +
          ' appears more than once in this save. Nothing was saved. Reload the page and try again.',
          { status: 409, skipped: duplicated.map(rowBarcode) });
      }

      const docScope = {
        /* the GRC's own business when the request does not name one: the
           barcode counter is keyed by business, and reserving from an unscoped
           series could hand out numbers this business has already printed */
        business: business || String(existing.businessId || ''),
        location, finYear, grcId: String(grcId),
        supplierId: body.supplierId || String(existing.supplierId || ''),
        grcNo: existing.grcNumber, itemByCode,
      };

      /* The supplier's code, once for the whole save: every barcode value on
         this GRC is SUPPLIER_CODE * GRC_NUMBER * BILL_SL_NO * SERIAL_NO
         (lib/barcodeValue.js). */
      docScope.supplierCode = await supplierCodeOf(docScope.supplierId);
      const valueParts = { supplierCode: docScope.supplierCode, grcNumber: existing.grcNumber };

      /* The serial floors, read raw: lastSerialByBill has to come back as
         stored - absent on a GRC that has never numbered serials per line,
         which is what tells serialFloorOf to fall back to its SEQs. */
      const grcFloors = await Grc.collection.findOne(
        { _id: existing._id },
        { projection: { lastSerialByBill: 1, serialFloorBase: 1, lastBarcodeSeq: 1 }, ...(dbSession ? { session: dbSession } : {}) }
      );
      /* A GRC saved before serials were numbered per line gets its map now,
         with the floor its SEQs leave - counted without the barcodes this
         save deletes, whose values then count as given out. */
      const floorsInit = grcFloors?.lastSerialByBill && typeof grcFloors.lastSerialByBill === 'object'
        ? null
        : legacySerialFloor(kept, grcFloors?.lastBarcodeSeq);
      /* the highest serial this save gives on each Bill Sl No. */
      const savedFloors = new Map();

      /* What the operator changed on each matched row: the row as submitted
         against the same row as the screen shows it untouched, both through
         the one mapping that stores them. Comparing with the stored document
         directly would read every blank the screen fills in on load as an
         edit. The submitted row is laid over the untouched one, so a field
         the request leaves out is left as it is, not blanked. */
      const updates = [];
      const locked = [];
      /* Every COMPOSED value this GRC's barcodes hold - including the ones
         being deleted, whose labels may still be on the goods - by its
         canonical key, so no two barcodes ever share one in either
         spelling. buildDocs adds the values already on goods elsewhere in
         the business under the same supplier code and GRC number. */
      const takenValues = new Set(current.map((u) => barcodeKey(composedValueOf(u))).filter(Boolean));
      matched.forEach(({ row, unit }) => {
        const untouched = untouchedRow(unit);
        const set = editedFields(
          buildDoc({ ...untouched, ...row }, docScope),
          buildDoc(untouched, docScope),
        );
        /* A barcode value carries the Bill Sl No. of the line it was received
           on. When that is corrected the value follows - new BILL SL NO, and
           the same SERIAL_NO when that is free on the new line, otherwise the
           line's next one - so the bars, the text beside them, the grid and
           the Item Summary never disagree. Only for a value composed from this
           GRC's own supplier code, number and Bill Sl No.; a counter number
           stays exactly as it was printed (hasComposedBarcode).

           The quantity does not move the value: it is not in it. Correcting
           a received quantity therefore leaves every sticker already on those
           goods valid. */
        if ('billSlNo' in set && hasComposedBarcode(unit, valueParts)) {
          const newBill = billSlNoForBarcode(set.billSlNo);
          const valueAt = (serial) => composeBarcodeValue({ ...valueParts, billSlNo: newBill, serialNo: serial });
          let serial = Number(parseBarcodeValue(composedValueOf(unit))?.serialNo) || 0;
          if (!newBill || !serial) {
            throw new InventoryError('BARCODE_VALUE', billSlNoProblem({ ...unit, billSlNo: newBill }), { status: 400 });
          }
          if (takenValues.has(barcodeKey(valueAt(serial)))) {
            serial = Math.max(savedFloors.get(newBill) || 0, highestSerialNo(current, newBill), serialFloorOf(grcFloors, newBill, current)) + 1;
            while (takenValues.has(barcodeKey(valueAt(serial)))) serial += 1;
          }
          /* The value it had stays taken: its label may be on the goods. */
          takenValues.add(barcodeKey(valueAt(serial)));
          savedFloors.set(newBill, Math.max(savedFloors.get(newBill) || 0, serial));
          /* ONLY the printed reference moves. The unit's own number, the
             batch key and everything the ledger and the till resolve a piece
             of goods by stay exactly as they were issued - correcting which
             bill line an item came in on must not renumber goods that are
             already on a shelf with a sticker. */
          set.barcodeGenerated = valueAt(serial);
          set.serialNo = String(serial);
        }
        if (!Object.keys(set).length) return;
        if (hasMoved(unit)) locked.push(unit);
        else updates.push({ unit, set });
      });

      /* A unit that has been sold, transferred or returned has a history that
         editing it here would rewrite. It no longer blocks the rest of the GRC
         as it used to - left unchanged it is simply skipped - but it cannot
         itself be changed from this screen. */
      if (locked.length) {
        throw new InventoryError('BARCODE_LOCKED',
          locked.length + ' barcode(s) on this GRC have already moved (' +
          [...new Set(locked.map((u) => u.status))].join(', ') +
          ') and can no longer be changed here: ' +
          locked.map(unitBarcode).slice(0, 8).join(', ') +
          '. Nothing was saved. Undo the changes to those rows, or raise a stock adjustment instead.',
          { status: 409, skipped: locked.map(unitBarcode) });
      }

      if (deleting.length) {
        /* written off in the ledger first, so the trail shows the deletion
           rather than a silent disappearance */
        await voidUnits({
          units: deleting,
          ref: { model: 'grc', _id: existing._id, no: existing.grcNumber },
          reason: 'Barcode row deleted from the GRC',
          user: session, session: dbSession,
        });
        /* guarded on the unit still being in stock - one sold in between is
           not deleted */
        const gone = await BarcodeLabel.deleteMany(
          {
            _id: { $in: deleting.map((u) => u._id) },
            grcId: String(grcId),
            status: { $in: [BARCODE_STATUS.IN_STOCK, '', null] },
          },
          dbSession ? { session: dbSession } : {}
        );
        if (gone.deletedCount !== deleting.length) {
          throw new InventoryError('MOVEMENT_CONFLICT',
            'Some of the barcodes being deleted were changed by someone else while this was saving. Nothing was saved. Reload and try again.',
            { status: 409 });
        }
      }

      if (updates.length) {
        const res = await BarcodeLabel.bulkWrite(
          updates.map(({ unit, set }) => ({
            updateOne: {
              /* guarded on the status just read, so a unit sold in between is not edited */
              filter: { _id: unit._id, grcId: String(grcId), ...(unit.status ? { status: unit.status } : {}) },
              update: { $set: set },
            },
          })),
          dbSession ? { session: dbSession, ordered: true } : { ordered: true }
        );
        if (res.matchedCount !== updates.length) {
          throw new InventoryError('MOVEMENT_CONFLICT',
            'Some of these barcodes were changed by someone else while this was saving. Nothing was saved. Reload and try again.',
            { status: 409 });
        }

        /* the stock reports add the ledger up by item code, so a corrected
           quantity or item has to reach it as well */
        const corrections = updates
          .filter(({ set }) => LEDGER_FIELDS.some((key) => key in set))
          .map(({ unit, set }) => ({ before: unit, after: set }));
        if (corrections.length) {
          await restateReceipt({ corrections, grc: existing, user: session, session: dbSession });
        }
      }

      let created = [];
      if (fresh.length) {
        /* SERIAL_NO carries on after every serial the line has ever been
           given (serialFloorOf), and SEQ after every SEQ the GRC has given -
           so a value once printed is never given out again */
        const docs = await buildDocs({
          rows: fresh, ...docScope, takenValues,
          units: current, grcFloors, floors: savedFloors, session: dbSession,
          startSeq: nextSeqStart(current, Number(grcFloors?.lastBarcodeSeq) || 0),
        });
        created = await BarcodeLabel.insertMany(docs, dbSession ? { session: dbSession, ordered: true } : { ordered: true });

        /* only the new barcodes become stock and get an opening entry - the
           existing ones were received when they were created */
        await receiveIntoStock({
          units: created.map((d) => d.toObject()),
          businessId: business, locationId: location, stockPointId,
          grc: existing, user: session, session: dbSession,
        });
      }

      /* re-totalled from every row the GRC now holds, not just the ones sent */
      const all = await BarcodeLabel.find({ grcId: String(grcId) }).session(dbSession || null).lean();
      await Grc.findByIdAndUpdate(
        grcId,
        { ...grcTotals(all), $max: { lastBarcodeSeq: highestSeq(all) } },
        dbSession ? { session: dbSession } : {}
      );
      await raiseSerialFloors(existing._id, savedFloors, { base: floorsInit, session: dbSession });

      return {
        grcId: String(grcId), grcNumber: existing.grcNumber, count: all.length,
        created: created.length, updated: updates.length, unchanged: matched.length - updates.length,
        deleted: deleting.length,
        /* the stored values - the screen shows and prints these, never its own */
        rows: savedRowsOf(all),
        createdRows: created.map((doc, i) => ({ id: clientIdOf(fresh[i]), ...savedRowOf(doc) })),
      };
    }

    /* ------------------------------------------------- a brand new GRC -- */
    const grcPayload = {
      grcDate: grcDate || new Date(),
      vendorDocNo: vendorDocNo || '',
      totalQuantity: totals?.count || totalQuantity,
      gst,
      /* All three from the rows (grcTotals), not the screen's own total,
         which already had GST in it and was then stored as the taxable value
         too. taxable is netAmount - gst by construction, so what is stored
         here reads back as TAXABLE + GST = NET AMOUNT. */
      netAmount,
      taxable,
    };
    if (business && isValidObjectId(business)) grcPayload.businessId = business;
    if (location && isValidObjectId(location)) grcPayload.locationId = location;
    if (finYear) grcPayload.finYear = finYear;
    if (supplierId && isValidObjectId(supplierId)) grcPayload.supplierId = supplierId;
    if (stockPointId && isValidObjectId(stockPointId)) grcPayload.stockPointId = stockPointId;

    /* checked before a GRC number is taken: a GRC that cannot give its
       barcodes a value is not made at all */
    const supplierCode = await supplierCodeOf(grcPayload.supplierId);
    const supplierProblem = barcodeValueProblem({ supplierCode, grcNumber: 'pending' });
    if (supplierProblem) throw new InventoryError('BARCODE_VALUE', supplierProblem, { status: 400 });

    grcPayload.grcNumber = await nextDocNumber(Grc, 'grcNumber', 'Goods Receipt Challan', {
      businessId: grcPayload.businessId,
      locationId: grcPayload.locationId,
      finYear: grcPayload.finYear,
    });

    const [grc] = await Grc.create([grcPayload], dbSession ? { session: dbSession } : {});

    /* a new GRC numbers every line's serials from 1 - it has no history */
    const floors = new Map();
    const docs = await buildDocs({
      rows, business, location, finYear, grcId: String(grc._id),
      supplierId, supplierCode, grcNo: grcPayload.grcNumber, itemByCode,
      startSeq: 1, takenValues: new Set(),
      units: [], grcFloors: { lastSerialByBill: {} }, floors, session: dbSession,
    });

    const created = await BarcodeLabel.insertMany(docs, dbSession ? { session: dbSession, ordered: true } : { ordered: true });

    /* the barcodes become stock at the receiving location, and the ledger
       gets each unit's opening entry */
    await receiveIntoStock({
      units: created.map((d) => d.toObject()),
      businessId: business, locationId: location, stockPointId,
      grc, user: session, session: dbSession,
    });

    await Grc.updateOne({ _id: grc._id }, { $max: { lastBarcodeSeq: highestSeq(created) } }, dbSession ? { session: dbSession } : {});
    await raiseSerialFloors(grc._id, floors, { base: 0, session: dbSession });

    return {
      grcId: String(grc._id), grcNumber: grcPayload.grcNumber, count: created.length,
      rows: savedRowsOf(created),
      createdRows: created.map((doc, i) => ({ id: clientIdOf(rows[i]), ...savedRowOf(doc) })),
    };
  });

  /* a validation short-circuit inside the transaction returns a Response */
  if (result instanceof Response) return result;

  return json({ ok: true, ...result });
});

/* ================================================================ delete === */

export const DELETE = handler(async (req) => {
  const body = await req.json().catch(() => ({}));
  const session = await requirePermission(PERMISSIONS.GRC_MANAGE);
  await dbConnect();

  if (body?.grcId) {
    return withTransaction(async (dbSession) => {
      const units = await BarcodeLabel.find({ grcId: body.grcId }).session(dbSession || null).lean();

      const moved = units.filter((u) => u.status && u.status !== BARCODE_STATUS.IN_STOCK);
      if (moved.length) {
        throw new InventoryError('GRC_LOCKED',
          'This GRC cannot be deleted: ' + moved.length + ' of its barcodes have already moved ('
          + [...new Set(moved.map((m) => m.status))].join(', ') + ').',
          { status: 409, skipped: moved.map((m) => m.barcodeNo || m.barcodeGenerated) });
      }

      const grc = await Grc.findById(body.grcId).session(dbSession || null).lean();
      if (units.length) {
        await voidUnits({
          units,
          ref: { model: 'grc', _id: body.grcId, no: grc?.grcNumber || '' },
          reason: 'GRC deleted',
          user: session, session: dbSession,
        });
      }

      await Grc.findByIdAndDelete(body.grcId, dbSession ? { session: dbSession } : {});
      await BarcodeLabel.deleteMany({ grcId: body.grcId }, dbSession ? { session: dbSession } : {});
      return json({ ok: true });
    });
  }

  if (body?.id) {
    return withTransaction(async (dbSession) => {
      const unit = await BarcodeLabel.findById(body.id).session(dbSession || null).lean();
      if (!unit) return json({ ok: true });

      if (unit.status && unit.status !== BARCODE_STATUS.IN_STOCK) {
        throw new InventoryError('BARCODE_LOCKED',
          'Barcode ' + (unit.barcodeNo || unit.barcodeGenerated) + ' has already moved (' + unit.status + ') and cannot be deleted.',
          { status: 409 });
      }
      await voidUnits({
        units: [unit], ref: { model: 'barcodeLabel', _id: unit._id, no: unit.barcodeNo },
        reason: 'Barcode row deleted', user: session, session: dbSession,
      });
      await BarcodeLabel.findByIdAndDelete(body.id, dbSession ? { session: dbSession } : {});

      /* the GRC it came off is re-totalled from the rows it still holds */
      if (unit.grcId && isValidObjectId(unit.grcId)) {
        const rest = await BarcodeLabel.find({ grcId: unit.grcId }).session(dbSession || null).lean();
        await Grc.findByIdAndUpdate(unit.grcId, grcTotals(rest), dbSession ? { session: dbSession } : {});
      }
      return json({ ok: true });
    });
  }

  return json({ error: 'id or grcId required', code: 'BAD_INPUT' }, 400);
});

/* ------------------------------------------------------------- internals -- */

/* Turns the screen's NEW rows into barcode documents, each COMPLETE: its own
   unit number and the value it will carry everywhere - the bars, the text
   beside them, the grid, the till:

      SUPPLIER_CODE * GRC_NUMBER * BILL_SL_NO * SERIAL_NO   e.g. "G512 * 05173 * 5 * 1"

   (lib/barcodeValue.js). BILL_SL_NO is that row's own Bill Sl No. - the bill
   line the item was received on, as the GRC's Item Summary shows it against
   that item - taken from the row being saved and from nothing else. SERIAL_NO
   is the barcode's own running number within its Bill Sl No. - 1, 2, 3 ... -
   given when the barcode is created and never given out again on that line.

   The third part is NOT the quantity, a row number or a counter. Two barcodes
   of the same bill line are told apart by their SERIAL_NO.

   `units` are the GRC's barcodes as this save read them, `grcFloors` its raw
   serial floors (serialFloorOf) and `floors` the highest serial this save has
   given per line so far - raised here and written back by raiseSerialFloors.
   `takenValues` holds canonical keys (barcodeKey). */
async function buildDocs({ rows, startSeq = 1, takenValues = new Set(), units = [], grcFloors = null, floors = new Map(), session = null, ...scope }) {
  const supplierCode = scope.supplierCode ?? await supplierCodeOf(scope.supplierId);
  const problem = barcodeValueProblem({ supplierCode, grcNumber: scope.grcNo });
  if (problem) throw new InventoryError('BARCODE_VALUE', problem, { status: 400 });

  /* Every row has to name its bill line BEFORE a number is reserved: a
     refused save must not spend numbers from the series. Nothing stands in
     for a missing one - not the quantity, not the row's position. */
  rows.forEach((r) => {
    if (!billSlNoForBarcode(r.billSlNo)) {
      throw new InventoryError('BARCODE_VALUE', billSlNoProblem(r), { status: 400 });
    }
    /* P-M-F is required on every barcode this save CREATES - the P-M-F
       buildDoc stores, never a value made up for it. Saved barcodes never
       reach here, so a GRC saved before the rule still saves. */
    if (!pmfOf(r)) {
      throw new InventoryError('INVALID_INPUT',
        (String(r.itemCode || r.itemName || '').trim() || 'A row') + ': ' + PMF_REQUIRED_MESSAGE + ' Nothing was saved.',
        { status: 400 });
    }
  });

  /* Values already on goods ANYWHERE in the business under this supplier
     code and GRC number. A GRC number can come round again (each financial
     year restarts the series), and two labels with one value would scan as
     either piece. An anchored, case-sensitive prefix - index-bounded on both
     fields, never a collection scan. */
  const stem = '^' + escapeRegex(String(supplierCode).trim() + BARCODE_SEPARATOR + grcNumberForBarcode(scope.grcNo) + BARCODE_SEPARATOR);
  const elsewhere = await BarcodeLabel.find({
    ...(scope.business ? { businessId: String(scope.business) } : {}),
    $or: [{ barcodeGenerated: { $regex: stem } }, { barcodeNo: { $regex: stem } }],
  }).select('barcodeNo barcodeGenerated').session(session || null).lean();
  elsewhere.forEach((u) => {
    const key = barcodeKey(composedValueOf(u));
    if (key) takenValues.add(key);
  });

  /* EVERY NEW BARCODE GETS ITS OWN NUMBER.

     Two different things go on a sticker and they are not interchangeable:

       barcodeNo         "9A1143" - the unit's own number, from the Barcode
                         Setting period in force and the atomic counter
                         (lib/barcodeEngine.js). Printed on the LEFT of the
                         label; what a POS invoice line and the stock ledger
                         name a piece of goods by.
       barcodeGenerated  "G1319 * 05182 * 1 * 6" - the composed value. The bars
                         encode it, in its canonical spelling "G1319*05182*1*6",
                         and the same string is printed on the RIGHT.

     This route once wrote the composed value into both, and before that the
     number into both. Either way the label hid its right-hand side (the two
     fields held one string), and a record had no number of its own or no
     value of its own. assertCompleteBarcode below refuses both shapes.

     Reserved here, once per save, for the rows being INSERTED only: matched
     rows never reach buildDocs (matchRowsToUnits claims them by _id or by the
     screen's own row id first), so re-submitting a grid cannot burn numbers
     or renumber a barcode that is already on goods.

     Deliberately NOT inside the transaction - the same choice nextDocNumber
     makes for the GRC number above. A rolled-back save then leaves a gap in
     the series, which is harmless; sharing one hot counter document across
     concurrent transactions would trade that for write conflicts, and a
     reissued number is a duplicate on physical goods that no later correction
     can undo. */
  const unitNumbers = await reserveBarcodeNumbers(rows.length, {
    businessId: scope.business,
    finYear: scope.finYear,
  });

  const valueParts = { supplierCode, grcNumber: scope.grcNo };
  let seq = startSeq;
  return rows.map((r, index) => {
    const billSlNo = billSlNoForBarcode(r.billSlNo);
    const valueAt = (serial) => composeBarcodeValue({ ...valueParts, billSlNo, serialNo: serial });

    /* after every serial the line carries, after every serial the GRC ever
       gave on it, and after the ones this save has already given */
    let serial = Math.max(
      floors.get(billSlNo) || 0,
      highestSerialNo(units, billSlNo),
      serialFloorOf(grcFloors, billSlNo, units),
    ) + 1;
    /* The Add Item form sends the Serial No. the operator may have typed as
       the entry's starting serial. It can move the line ON - never back onto
       a serial already given, whose label may be on the goods - so a lower
       one (or the same suggestion sent by a second entry not yet saved)
       simply starts from the next free serial. */
    const requested = /^\d+$/.test(String(r.serialNo ?? '').trim()) ? Number(r.serialNo) : 0;
    if (requested > serial) serial = requested;
    while (takenValues.has(barcodeKey(valueAt(serial)))) serial += 1;
    const barcodeGenerated = valueAt(serial);
    takenValues.add(barcodeKey(barcodeGenerated));
    floors.set(billSlNo, serial);

    /* The reservation is one block for the whole save, so row i takes the i-th
       number. A row with no number left (the counter could not be read) is
       refused rather than stored with no number of its own. */
    const unitNo = unitNumbers[index];
    if (!unitNo) {
      throw new InventoryError('BARCODE_VALUE',
        (r.itemCode || r.itemName || 'A row')
        + ' could not be given a barcode number of its own. Check the Barcode Setting master for this business'
        + ' (prefix, start number and the period covering today) and try again. Nothing was saved.',
        { status: 400 });
    }

    const doc = buildDoc(r, { ...scope, barcodeNo: unitNo, barcodeGenerated, seq: String(seq), serialNo: String(serial) });
    assertCompleteBarcode(doc, valueParts);
    seq += 1;
    return doc;
  });
}

/* A new barcode record is saved COMPLETE or not at all: a supplier code, a
   GRC number, a Bill Sl No., a Serial No., the composed value those four make,
   and a number of its own that is not that value. Anything less is the
   half-written record that prints a label with no reference beside the bars,
   or a reference with bars too dense to print. */
function assertCompleteBarcode(doc, { supplierCode, grcNumber }) {
  const item = doc.itemCode || doc.itemName || 'A row';
  const refuse = (why) => {
    throw new InventoryError('BARCODE_VALUE', item + ': ' + why + ' Nothing was saved.', { status: 400 });
  };
  if (!String(supplierCode ?? '').trim()) refuse('the supplier has no supplier code.');
  if (!grcNumberForBarcode(grcNumber)) refuse('the GRC has no GRC number.');
  if (!billSlNoForBarcode(doc.billSlNo)) refuse('Bill Sl No is required for barcode generation.');
  if (!/^\d+$/.test(String(doc.serialNo ?? '')) || Number(doc.serialNo) < 1) refuse('the barcode has no Serial No.');
  const expected = composeBarcodeValue({ supplierCode, grcNumber, billSlNo: doc.billSlNo, serialNo: doc.serialNo });
  if (!doc.barcodeGenerated || doc.barcodeGenerated !== expected) refuse('the barcode value could not be generated.');
  if (!String(doc.barcodeNo ?? '').trim() || isComposedBarcodeValue(doc.barcodeNo) || barcodeKey(doc.barcodeNo) === barcodeKey(doc.barcodeGenerated)) {
    refuse('the barcode has no number of its own.');
  }
}

/* Raises the GRC's per-line serial floors (serialFloorOf) to the highest
   serial a save gave on each line. Written through the driver: the GRC model
   a long-running server holds may predate these fields, and mongoose would
   drop them without a word. `base` initialises the floor of a GRC that is
   getting its map for the first time (null leaves it alone). */
async function raiseSerialFloors(grcId, floors, { base = null, session = null } = {}) {
  if (!floors || !floors.size) return;
  const max = {};
  floors.forEach((serial, billSlNo) => { max['lastSerialByBill.' + serialFloorKey(billSlNo)] = serial; });
  if (base !== null) max.serialFloorBase = Number(base) || 0;
  await Grc.collection.updateOne(
    { _id: new mongoose.Types.ObjectId(String(grcId)) },
    { $max: max },
    session ? { session } : {}
  );
}

/* One screen row as the document it is stored as. Pure: the barcode value
   and its SEQ/SERIAL_NO are decided by buildDocs. The edit path also runs an untouched
   copy of a stored row through here to see what the operator changed - the
   value and SEQ/SERIAL_NO are not editable fields, so they play no part there. */
function buildDoc(r, { business, location, finYear, grcId, supplierId, grcNo, barcodeNo = '', barcodeGenerated = '', seq = '', serialNo = '', itemByCode }) {
  const uomType = uomTypeOf(r.uom);
  /* the same expression as always, now shared with the label printer
     (lib/barcodeUnits.js), so a row prints under the type it is stored with */
  const batchType = saveBatchTypeOf(r);
  const item = itemByCode.get(String(r.itemCode || '').trim());

  return {
    grcId,
    grcNo: grcNo || '',
    supplierId: supplierId || '',
    groupId: r.groupId || '',
    oldBarcode: r.oldBarcode || '',
    itemCode: r.itemCode || '',
    batchUnique: batchType,
    billSlNo: r.billSlNo || '',
    /* the barcode's running number within its GRC - see buildDocs */
    seq,
    /* the barcode's running number within its Bill Sl No. - see buildDocs.
       Never the Bill Sl No.: that fallback is how every barcode saved before
       2026-09-17 came to carry its bill line here. */
    serialNo: serialNo || String(r.serialNo || ''),
    /* the screen's own id for this row, so a repeated Submit finds the unit
       it already made (see matchRowsToUnits) */
    clientRowId: clientIdOf(r),
    dummy: r.dummy || '',
    supplierDescription: r.supplierDescription || '',
    goodsType: r.goodsType || '',
    sm: r.sm || (r.goodsType === 'SM' ? 'SM' : ''),
    p_m_f: r.p_m_f || (r.goodsType === 'P-M-F' ? 'P-M-F' : ''),
    qty: String(r.qty ?? ''),
    /* "-" is how the grid shows no cuts - stored as none */
    noOfCuts: String(r.noOfCuts ?? '').trim().replace(/^-$/, ''),
    uom: r.uom || '',
    hsn: r.hsn || '',
    /* The Barcode Generation grid names these two purchaseRate and
       finalPrice; only an imported row ever arrives under the stored names.
       Reading just the stored names wrote an empty string for every row
       generated on screen, so the cost price was lost on save and the
       label's CP line came out blank after a reload. The stored name is
       still preferred, so an import keeps behaving exactly as it did.

       `disc` is deliberately NOT given the same treatment. It is read back
       in grcTotals as a PERCENTAGE (rate * disc / 100), while the grid's
       `discount` is a percentage or a flat rupee amount depending on the
       row's Discount Type. Feeding a flat amount into that sum would
       quietly change the GRC's taxable value, which is worse than the
       blank it leaves today. Reconciling the two is a separate change. */
    purRate: r.purRate || r.purchaseRate || '',
    /* buildDoc is a whitelist - a key the client adds to a row does not
       reach the database unless it is copied here. Same stored/grid name
       pair as purRate/purchaseRate above. */
    encodedPurRate: r.encodedPurRate || r.encodedPurchaseRate || '',
    disc: r.disc || '',
    finalNet: r.finalNet || r.finalPrice || '',
    gst: r.gst || '',
    printDescription: r.printDescription || '',
    retailPrice: r.retailPrice || '',
    disc2: r.disc2 || '',
    offerPrice: r.offerPrice || '',
    wspPrice: r.wspPrice || '',
    dpPrice: r.dpPrice || '',
    customFields: r.customFields && typeof r.customFields === 'object' ? r.customFields : {},
    fma: r.fma || '',
    silkMark: r.silkMark || '',

    /* TWO DIFFERENT THINGS, and no longer one string written twice.
       barcodeNo is the unit's own number (the bars, the till, the ledger);
       barcodeGenerated is the composed reference printed beside it. */
    barcodeNo,
    barcodeGenerated,

    /* ---- lifecycle ---- */
    itemId: item?._id || null,
    /* The name on the row wins - what the operator typed on the grid, or
       picked from the item master on Add Item - and the master's name fills
       in only when the row has none. Master-first quietly threw away an Item
       name edited on the grid. */
    itemName: r.itemName || item?.name || r.printDescription || r.supplierDescription || '',
    uomType,
    batchType,
    qtyNum: Number(r.qty) || 1,
    batchNo: batchType === 'batch' ? String(r.batchNo || barcodeNo) : '',
    status: BARCODE_STATUS.IN_STOCK,
    currentLocationId: isValidObjectId(location) ? location : null,
    currentBusinessId: isValidObjectId(business) ? business : null,

    businessId: business || '',
    locationId: location || '',
    finYear: finYear || '',
  };
}

/* A stored unit as the screen holds it when it loads the GRC, with its price
   in the form the POST handler normalises every submitted row to. */
function untouchedRow(unit) {
  const row = toGridRow(unit);
  const field = row.purRate ? 'purRate' : 'purchaseRate';
  row[field] = normalisePurchasePrice(row[field]);
  return row;
}

/* The supplier's code - Contact.contactId, "G1318" - the first part of every
   barcode value. '' when the GRC has no supplier or the supplier no code. */
async function supplierCodeOf(supplierId) {
  if (!supplierId || !isValidObjectId(String(supplierId))) return '';
  const contact = await Supplier.findById(supplierId).select('contactId').lean();
  return String(contact?.contactId || '').trim();
}

/* What the screen gets back about every barcode of the GRC after a save: the
   stored values to show and print, never ones the browser made up.

   BOTH barcode fields, as they are stored. A label prints the unit's own
   number on the left and the composed value on the right, off the SAME
   record - so a print taken straight after a Submit has to be given both.
   With only barcodeNo here the screen had nothing to put on the right of the
   sticker and copied the number into it, which printed the left-hand value
   twice for any barcode whose two fields differ. */
function savedRowsOf(units) {
  return (units || []).map((u) => ({ ...savedRowOf(u), clientRowId: u.clientRowId || '', qty: u.qty || '' }));
}

/* One stored barcode as the screen merges it back - the identity fields and
   the parts its value was made from, so a row shown or printed straight after
   Submit carries the same Bill Sl No. and Serial No. as its value. */
function savedRowOf(u) {
  return {
    /* barcodeNo as stored - never barcodeGenerated in its place */
    _id: String(u._id), barcodeNo: String(u.barcodeNo ?? '').trim(), barcodeGenerated: u.barcodeGenerated || '',
    seq: u.seq || '', billSlNo: u.billSlNo || '', serialNo: u.serialNo || '',
  };
}

/* The stored fields the stock reports add the ledger up by. */
const LEDGER_FIELDS = ['itemCode', 'qtyNum'];

/* A unit that has left the shelf it was received onto: sold, in transit,
   returned or written off - or received at another branch, which leaves it
   IN_STOCK but no longer here. */
function hasMoved(unit) {
  if (unit.status && unit.status !== BARCODE_STATUS.IN_STOCK) return true;
  const at = String(unit.currentLocationId || '');
  const from = String(unit.locationId || '');
  return Boolean(at && from && at !== from);
}

/* The GRC header's money, from barcode rows - stored (finalNet / purRate) or
   submitted (finalPrice / purchaseRate) - is worked out in lib/grcMoney.js
   (grcTotals, imported above), the one place every GRC screen and route reads
   its arithmetic from:

     1. netAmount = sum(line taxable) + sum(line GST)
     2. gst       = each line's taxable x its own GST% / 100, summed - an AMOUNT
     3. taxable   = netAmount - gst

   so a stored header always satisfies TAXABLE + GST = NET AMOUNT.

   It used to add up selling prices (offerPrice || retailPrice) for the net
   amount, take a discount off a rate that is already net of it, and add up
   the rows' GST PERCENTAGES as the GST - so a GRC of 15 rows at 5% stored a
   GST of 75, and the same selling-price sum in both taxable and netAmount.
   Headers written before that was fixed are read back through grcMoney (see
   /api/purchase-grc), which never trusts such a `gst` as an amount. */

async function resolveItems(rows, businessId) {
  const codes = [...new Set(rows.map((r) => String(r.itemCode || '').trim()).filter(Boolean))];
  if (!codes.length) return new Map();

  const items = await Item.find({
    itemCode: { $in: codes },
    ...(businessId && isValidObjectId(businessId) ? { businessId } : {}),
  }).select('_id name itemCode').lean();

  return new Map(items.map((i) => [String(i.itemCode), i]));
}
