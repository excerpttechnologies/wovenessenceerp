import { isValidObjectId, Types } from 'mongoose';
import dbConnect from '@/lib/db';
import { requireSession } from '@/lib/session';
import { escapeRegex } from '@/lib/validate';
import { BarcodeLabel, BARCODE_STATUS } from '@/lib/barcodeLabel';
import StockMovement from '@/models/StockMovement';
import Item from '@/models/Item';
import ProductGroup from '@/models/ProductGroup';
import CompanyLocation from '@/models/CompanyLocation';
import Uom from '@/models/Uom';
import { Supplier } from '@/lib/contacts';
import { json, num, r2, scopeOf, pageOf } from '@/lib/reports';

/* ==========================================================================
   /api/reports/master-stock-report  -  read-only.

   THE GRAIN: ONE ROW = ONE barcodeLabel RECORD that is currently IN_STOCK.
   A barcode row IS one unit of stock in this ERP (lib/barcodeLabel.js:4), so
   the report neither aggregates several barcodes into a line nor lets a join
   multiply one barcode into several rows - every lookup below resolves to at
   most one document and is applied by map lookup after the page is read.

   WHY IN_STOCK AND NOT "every barcode ever printed": status is the current
   state of the unit (lib/barcodeLabel.js:131, maintained inside one
   transaction by lib/inventory.js). SOLD and VOID units are not stock, so a
   closing-stock report must not carry them.

   NO N+1: one count, one page read, then FIVE batched lookups for the whole
   page regardless of its size - items, groups, suppliers, locations and the
   receipt dates. The same shape app/api/reports/barcode-report/route.js uses
   for its GRC lookup.
   ========================================================================== */

/* the report's own column order, used by the route and the export alike */
const EMPTY = '-';
const s = (v) => {
  const t = String(v ?? '').trim();
  return t || '';
};

/* The money and percentage columns are String paths on this schema
   (lib/barcodeLabel.js:59-75), and the rows the warehouse workbook imported
   went in through the raw driver holding real Numbers - the same split the
   GST filter below documents. A range filter therefore has to compare the
   CONVERTED value, never the stored spelling.
   onError/onNull give null rather than 0 on purpose: a blank price is "not
   recorded", and treating it as zero would pull every unpriced unit into a
   "Max 500" answer. */
const asNum = (path) => ({ $convert: { input: path, to: 'double', onError: null, onNull: null } });

/* COST PRICE as every other reader of this collection computes it: finalNet
   when it carries a figure, else purRate (lib/grcMoney.js rowRate, and the
   totals pipeline at the foot of this file). */
const COST_EXPR = {
  $let: {
    vars: {
      fn: { $convert: { input: '$finalNet', to: 'double', onError: 0, onNull: 0 } },
      pr: { $convert: { input: '$purRate', to: 'double', onError: 0, onNull: 0 } },
    },
    in: { $cond: [{ $gt: ['$$fn', 0] }, '$$fn', '$$pr'] },
  },
};

export async function GET(req) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const sp = new URL(req.url).searchParams;
  await dbConnect();

  const { businessId, locationId, finYear } = scopeOf(sp);
  const { page, perPage } = pageOf(sp);

  /* ---- scope -----------------------------------------------------------
     barcodeLabel keeps its scope as plain STRINGS (lib/barcodeLabel.js:93-94)
     and carries the same ids again as ObjectIds on the current* twins. The
     string pair is what every barcode screen filters on, so it is what this
     report filters on too. A blank locationId is included for the same
     reason app/api/reports/barcode-report/route.js includes it: the barcode
     screen does not always set it, and filtering strictly would hide real
     stock. */
  const filter = { status: BARCODE_STATUS.IN_STOCK };
  if (businessId) filter.businessId = String(businessId);
  if (finYear) filter.finYear = { $in: [finYear, '', null] };
  if (locationId) filter.locationId = { $in: [String(locationId), '', null] };

  /* Two filters now need an $or of their own (Search, and Group Name), and
     six need an $expr (GST plus the five price ranges). Assigning either key
     twice would silently drop the first one, so both are collected here and
     merged onto the filter once, below. */
  const ands = [];
  const exprs = [];

  /* ---- filters, all server-side ---------------------------------------- */
  const search = s(sp.get('search'));
  if (search) {
    const rx = { $regex: escapeRegex(search), $options: 'i' };
    /* Supplier Code and Supplier Name are columns on this report, but neither
       is a field on barcodeLabel - the row carries only the supplier KEY. So
       the vendors whose code or name matches are resolved first and both
       spellings of their key (id and code) join the $or, which is what lets
       "AMEERA" or "G1319" find that vendor's stock. Deliberately unbounded:
       capping the vendor list would drop stock from the result with nothing
       on screen to say so. */
    const vendors = await Supplier.find({
      $or: [{ contactId: rx }, { businessName: rx },
        { firstName: rx }, { middleName: rx }, { lastName: rx }],
    }).select('contactId').lean();
    const supKeys = [...new Set(
      vendors.flatMap((v) => [String(v._id), s(v.contactId)]).filter(Boolean)
    )];
    ands.push({
      $or: [
        { barcodeNo: rx }, { itemCode: rx }, { itemName: rx },
        { printDescription: rx }, { supplierDescription: rx }, { hsn: rx },
        ...(supKeys.length ? [{ supplierId: { $in: supKeys } }] : []),
      ],
    });
  }
  const barcodeNo = s(sp.get('barcodeNo'));
  if (barcodeNo) filter.barcodeNo = { $regex: escapeRegex(barcodeNo), $options: 'i' };
  const hsn = s(sp.get('hsn'));
  if (hsn) filter.hsn = { $regex: escapeRegex(hsn), $options: 'i' };
  /* UOM: the picker is a ref, so it sends the Uom's _id (/api/options returns
     value: String(r._id)), but barcodeLabel.uom stores the unit's NAME
     ("PCS", "Mtr", "METERS"). Matching the id against the name found nothing
     whatever was chosen, so the id is resolved to its name and short name
     first. A name typed straight into the query string still works. */
  const uom = s(sp.get('uom'));
  if (uom) {
    let names = [uom];
    if (isValidObjectId(uom)) {
      const u = await Uom.findById(uom).select('name shortName').lean();
      names = [s(u?.name), s(u?.shortName)].filter(Boolean);
    }
    /* an id that resolves to nothing matches nothing, rather than silently
       dropping the filter and returning the whole warehouse */
    filter.uom = { $in: names.map((n) => new RegExp('^' + escapeRegex(n) + '$', 'i')) };
  }
  /* GST %: matched on the NUMBER, never on the spelling.
     lib/barcodeLabel.js:69 declares gst as a String, and the rows GRC created
     honour that ("", "0", "5"), but the rows the warehouse workbook imported
     went in through the raw driver and so hold a real Number (5, 12). A plain
     equality would therefore see only half the warehouse: `{ gst: '5' }`
     misses the numeric rows, and `{ gst: 5 }` is cast back to '5' by the
     model and misses them too. Converting the STORED value and comparing
     numerically matches both spellings, and treats 5, "5" and "5.00" as the
     one slab. $expr is left uncast by Mongoose, which is what makes this
     work; it costs no index, because gst carries none.
     A blank gst converts to null and so matches no slab - including 0, since
     "not recorded" is not the same as "zero rated". */
  const gstRaw = s(sp.get('gst')).replace(/%/g, '').trim();
  if (gstRaw) {
    const gstNum = Number(gstRaw);
    exprs.push(Number.isFinite(gstNum)
      /* a GST that is not a number matches nothing, the same way a nonsense
         HSN does - quietly ignoring it would return the whole warehouse and
         read as though the filter had been applied */
      ? { $eq: [asNum('$gst'), gstNum] }
      : { $literal: false });
  }
  const itemCode = s(sp.get('itemCode'));
  if (itemCode) filter.itemCode = { $regex: escapeRegex(itemCode), $options: 'i' };
  /* SUPPLIER: the same vendor is keyed two ways on this collection - barcode
     generation stamps the contact's _id, the warehouse import stamps the
     vendor's own code ("G1000"). Of the supplier keys in stock today 66 are
     ids and 361 are codes, so accepting only the id the picker sends returned
     none of the imported stock. Both spellings of the chosen vendor are
     looked up, so one dropdown choice finds all of its units. */
  const supplier = s(sp.get('supplierId'));
  if (supplier) {
    const keys = new Set([supplier]);
    const vendor = isValidObjectId(supplier)
      ? await Supplier.findById(supplier).select('contactId').lean()
      : await Supplier.findOne({ contactId: supplier }).select('contactId').lean();
    if (vendor) {
      keys.add(String(vendor._id));
      if (s(vendor.contactId)) keys.add(s(vendor.contactId));
    }
    filter.supplierId = { $in: [...keys] };
  }
  const startDate = s(sp.get('startDate'));
  const endDate = s(sp.get('endDate'));
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
  }

  /* GROUP NAME is the ITEM's group - mapRow below reads it from the Item
     master's subGroupId, never from barcodeLabel.groupId, which is not a
     productGroup reference on this schema. So the groups whose name matches
     are resolved first, then the items sitting in them, and the row is
     matched on every key itemOf() below would have used to reach that item:
     the real itemId reference, the itemCode, and the itemName the 2026-08
     import left the style code in. */
  const groupNameQ = s(sp.get('groupName'));
  if (groupNameQ) {
    const matchGroups = await ProductGroup.find({
      name: { $regex: escapeRegex(groupNameQ), $options: 'i' },
    }).select('_id').lean();
    const groupItems = matchGroups.length
      ? await Item.find({ subGroupId: { $in: matchGroups.map((g) => g._id) } })
        .select('itemCode name').lean()
      : [];
    const itemKeys = [...new Set(
      groupItems.flatMap((i) => [s(i.itemCode), s(i.name)]).filter(Boolean)
    )];
    /* a group that reaches no item matches no stock, rather than dropping
       the filter and returning the whole warehouse */
    ands.push({
      $or: [
        { itemId: { $in: groupItems.map((i) => i._id) } },
        ...(itemKeys.length
          ? [{ itemCode: { $in: itemKeys } }, { itemName: { $in: itemKeys } }]
          : []),
      ],
    });
  }

  /* PRICE RANGES. Each pair is inclusive, and a bound left blank or typed as
     nonsense is no bound at all - an empty box must not narrow anything.
     The non-null guard is not decoration: in BSON order null sorts BELOW
     every number, so a row with a blank price would satisfy "<= 500" and a
     "Max" filter would quietly return all the unpriced stock as well. */
  const addRange = (expr, minKey, maxKey) => {
    const minRaw = s(sp.get(minKey)).replace(/%/g, '').trim();
    const maxRaw = s(sp.get(maxKey)).replace(/%/g, '').trim();
    const lo = Number(minRaw);
    const hi = Number(maxRaw);
    const hasLo = minRaw !== '' && Number.isFinite(lo);
    const hasHi = maxRaw !== '' && Number.isFinite(hi);
    if (!hasLo && !hasHi) return;
    exprs.push({ $ne: [expr, null] });
    if (hasLo) exprs.push({ $gte: [expr, lo] });
    if (hasHi) exprs.push({ $lte: [expr, hi] });
  };
  addRange(COST_EXPR, 'costPriceMin', 'costPriceMax');
  addRange(asNum('$retailPrice'), 'rspMin', 'rspMax');
  addRange(asNum('$offerPrice'), 'rspOfferPriceMin', 'rspOfferPriceMax');
  addRange(asNum('$wspPrice'), 'wspMin', 'wspMax');
  addRange(asNum('$dpPrice'), 'ecomMin', 'ecomMax');

  /* DISCOUNT % is a single figure rather than a range, matched on the number
     the way GST is - disc2 is the column the report prints as Discount %. */
  const discRaw = s(sp.get('discount')).replace(/%/g, '').trim();
  if (discRaw) {
    const discNum = Number(discRaw);
    exprs.push(Number.isFinite(discNum)
      ? { $eq: [asNum('$disc2'), discNum] }
      : { $literal: false });
  }

  /* Merged once, for the reason given where `ands` and `exprs` are declared. */
  if (ands.length) filter.$and = ands;
  if (exprs.length) filter.$expr = exprs.length === 1 ? exprs[0] : { $and: exprs };

  /* AGE (days) is not a field - it is derived, in mapRow below, from the date
     this unit entered stock: the earliest inward StockMovement for the
     barcode, and the row's own createdAt only when the unit predates the
     ledger. So it cannot be a plain clause on barcodeLabel, and filtering it
     after the page is read would page and total the wrong set.
     Instead the bounds are turned into a DATE WINDOW over that same derived
     date, and the ids inside it are resolved first - against the rows every
     other filter has already narrowed this to, so the lookup runs over the
     result and not over the whole warehouse. Because age floors to whole
     days:
       age >= N  ->  entered on or before  now - N days
       age <= M  ->  entered strictly after now - (M+1) days  */
  const ageMinRaw = s(sp.get('ageMin'));
  const ageMaxRaw = s(sp.get('ageMax'));
  const ageMin = Number(ageMinRaw);
  const ageMax = Number(ageMaxRaw);
  const hasAgeMin = ageMinRaw !== '' && Number.isFinite(ageMin);
  const hasAgeMax = ageMaxRaw !== '' && Number.isFinite(ageMax);
  if (hasAgeMin || hasAgeMax) {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const ageWindow = {};
    if (hasAgeMin) ageWindow.$lte = new Date(now - ageMin * DAY_MS);
    if (hasAgeMax) ageWindow.$gt = new Date(now - (ageMax + 1) * DAY_MS);

    const inAge = await BarcodeLabel.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: 'stockmovement',
          let: { bid: '$_id' },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$barcodeId', '$$bid'] }, { $gt: ['$qty', 0] }] } } },
            { $sort: { at: 1 } },
            { $limit: 1 },
            { $project: { at: 1 } },
          ],
          as: 'inward',
        },
      },
      /* the same fallback mapRow uses, so the rows this keeps are exactly
         the rows whose printed Age satisfies the filter */
      { $addFields: { enteredAt: { $ifNull: [{ $arrayElemAt: ['$inward.at', 0] }, '$createdAt'] } } },
      { $match: { enteredAt: ageWindow } },
      { $project: { _id: 1 } },
    ]);
    filter._id = { $in: inAge.map((r) => r._id) };
  }

  /* ---- SERVER-SIDE pagination: count, then read only this page ---------- */
  const total = await BarcodeLabel.countDocuments(filter);
  const rows = await BarcodeLabel.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * perPage)
    .limit(perPage)
    .lean();

  /* ---- the five batched lookups ---------------------------------------- */
  const ids = rows.map((r) => r._id);
  /* itemCode AND the row's own itemName are both used as KEYS into the Item
     master below - never as a displayed value. */
  const codes = [...new Set(rows.flatMap((r) => [s(r.itemCode), s(r.itemName)]).filter(Boolean))];
  const itemIds = [...new Set(rows.map((r) => r.itemId).filter((v) => v && isValidObjectId(String(v))).map(String))];
  const supKeys = [...new Set(rows.map((r) => s(r.supplierId)).filter(Boolean))];
  const locKeys = [...new Set(rows.map((r) => s(r.currentLocationId) || s(r.locationId)).filter((v) => v && isValidObjectId(v)))];

  /* ITEM. The Item master is reached three ways, in this order of trust:
       1. itemId          the real reference the save route stamps
       2. itemCode -> Item.itemCode   an exact code match
       3. itemCode -> Item.name       because barcode generation puts the
          STYLE code in barcodeLabel.itemCode, and this master keeps the style
          code in Item.name (142 of 145 Items have a blank itemCode).
       4. itemName -> Item.name       for the rows imported by the 2026-08
          barcode dump, whose itemCode holds the LEGACY PER-UNIT code
          ("100002") and so reaches no Item at all. Their itemName does carry
          the style code - 72 of its 75 distinct values are an Item.name - and
          it is used here only as a KEY to look the master up, never as the
          value displayed. Without it 290 rows of real stock would read "-".
     Nothing falls back to printDescription or supplierDescription: those are
     the label's own text, not the item's name. A row that resolves through
     none of the four shows the empty marker rather than an invented name. */
  const items = (codes.length || itemIds.length)
    ? await Item.find({
      $or: [
        ...(itemIds.length ? [{ _id: { $in: itemIds.map((v) => new Types.ObjectId(v)) } }] : []),
        ...(codes.length ? [{ itemCode: { $in: codes } }, { name: { $in: codes } }] : []),
      ],
    }).select('name itemCode subGroupId').lean()
    : [];
  const itemById = new Map(items.map((i) => [String(i._id), i]));
  const itemByCode = new Map();
  const itemByName = new Map();
  items.forEach((i) => {
    if (s(i.itemCode)) itemByCode.set(s(i.itemCode), i);
    if (s(i.name)) itemByName.set(s(i.name), i);
  });
  const itemOf = (r) => {
    if (r.itemId && itemById.has(String(r.itemId))) return itemById.get(String(r.itemId));
    const code = s(r.itemCode);
    return itemByCode.get(code)
      || itemByName.get(code)
      || itemByName.get(s(r.itemName))
      || null;
  };

  /* GROUP: from the ITEM's own group, never from barcodeLabel.groupId, which
     is not a productGroup reference on this schema. */
  const groupIds = [...new Set(items.map((i) => i.subGroupId).filter(Boolean).map(String))];
  const groups = groupIds.length
    ? await ProductGroup.find({ _id: { $in: groupIds } }).select('name').lean()
    : [];
  const groupName = new Map(groups.map((g) => [String(g._id), s(g.name)]));

  /* SUPPLIER: generated rows hold the id, imported rows hold the code. */
  const supIds = supKeys.filter((v) => isValidObjectId(v));
  const supCodes = supKeys.filter((v) => !isValidObjectId(v));
  const suppliers = supKeys.length
    ? await Supplier.find({
      $or: [
        ...(supIds.length ? [{ _id: { $in: supIds.map((v) => new Types.ObjectId(v)) } }] : []),
        ...(supCodes.length ? [{ contactId: { $in: supCodes } }] : []),
      ],
    }).select('contactId businessName firstName middleName lastName').lean()
    : [];
  /* businessName is blank on a vendor entered as a person - the same fallback
     lib/refLabels.js and /api/options use */
  const vendorName = (v) => s(v.businessName)
    || [v.firstName, v.middleName, v.lastName].map(s).filter(Boolean).join(' ');
  const supById = new Map(suppliers.map((v) => [String(v._id), v]));
  const supByCode = new Map(suppliers.map((v) => [s(v.contactId), v]));
  const supOf = (r) => {
    const key = s(r.supplierId);
    if (!key) return null;
    return supById.get(key) || supByCode.get(key) || null;
  };

  /* LOCATION */
  const locs = locKeys.length
    ? await CompanyLocation.find({ _id: { $in: locKeys.map((v) => new Types.ObjectId(v)) } }).select('name').lean()
    : [];
  const locName = new Map(locs.map((l) => [String(l._id), s(l.name)]));

  /* DATE: when this unit entered stock. The ledger's own inward row is the
     authoritative answer (models/StockMovement.js is append-only and is what
     every stock report reads), so the earliest inward movement for the
     barcode is used, and the row's own createdAt only when the unit predates
     the ledger. */
  const moves = ids.length
    ? await StockMovement.find({ barcodeId: { $in: ids }, qty: { $gt: 0 } })
      .select('barcodeId at').sort({ at: 1 }).lean()
    : [];
  const inwardAt = new Map();
  moves.forEach((m) => {
    const k = String(m.barcodeId);
    if (!inwardAt.has(k) && m.at) inwardAt.set(k, m.at);
  });

  /* ---- the mapper: ONE place that turns a barcode row into a report row -- */
  const asOf = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const mapRow = (r) => {
    const item = itemOf(r);
    const sup = supOf(r);
    const date = inwardAt.get(String(r._id)) || r.createdAt || null;
    /* Close Qty: the unit's own current quantity. qtyNum is the number the
       whole application sums (lib/icStock.js, the IC challan picker), and it
       already carries the UOM rule - PC+unique 1, PC+batch the received
       quantity, MTR the metreage (lib/barcodeLabel.js:118-123). It is NOT
       multiplied again here, so one barcode is counted exactly once. */
    const closeQty = num(r.qtyNum ?? r.qty);
    /* COST PRICE: the purchase rate AFTER discount, exactly as lib/grcMoney.js
       rowRate() reads it - never a selling price. */
    const costPrice = num(r.finalNet || r.purRate);
    return {
      _id: String(r._id),
      locationName: locName.get(s(r.currentLocationId) || s(r.locationId)) || EMPTY,
      groupName: (item && groupName.get(String(item.subGroupId))) || EMPTY,
      /* the Item MASTER's name - never itemCode, printDescription or
         supplierDescription */
      itemName: (item && s(item.name)) || EMPTY,
      supplierCode: (sup && s(sup.contactId)) || EMPTY,
      supplierName: (sup && vendorName(sup)) || EMPTY,
      date: date || null,
      age: date ? Math.max(0, Math.floor((asOf - new Date(date).getTime()) / DAY)) : null,
      /* the unit's OWN number, never the composed barcodeGenerated */
      barcodeNumber: s(r.barcodeNo) || EMPTY,
      closeQty,
      /* Close Value = Close Qty x COST PRICE. This is the valuation the
         source report uses - verified against all 4,603 rows of the reference
         workbook, where Close Value equals Close Qty x COST PRICE exactly. */
      closeValue: r2(closeQty * costPrice),
      costPrice: r2(costPrice),
      hsn: s(r.hsn) || EMPTY,
      gst: num(r.gst),
      rsp: num(r.retailPrice),
      discount: num(r.disc2),
      rspOfferPrice: num(r.offerPrice),
      wsp: num(r.wspPrice),
      ecom: num(r.dpPrice),
      uom: s(r.uom) || EMPTY,
      imageUrl: s(r.imageUrl),
    };
  };
  const mapped = rows.map(mapRow);

  /* ---- totals over the WHOLE result set, not the visible page -----------
     Only the additive columns: a quantity and a valuation sum, a per-unit
     price does not. */
  /* $convert with onError/onNull, NOT $toDouble: purRate, finalNet and qty
     are String paths on this schema (lib/barcodeLabel.js:59-75) and are very
     often '' - and $toDouble throws ConversionFailure on an empty string,
     which would abort the whole pipeline. Nor is the failure swallowed: a
     caught error here would quietly print a total of 0.00, which reads
     exactly like a warehouse holding nothing. */
  const toNum = (input) => ({ $convert: { input, to: 'double', onError: 0, onNull: 0 } });
  /* the quantity the rest of the application sums, with the same fallback */
  const qtyExpr = { $ifNull: ['$qtyNum', toNum('$qty')] };
  /* finalNet when it carries a figure, else purRate - lib/grcMoney.js rowRate */
  const costExpr = {
    $let: {
      vars: { fn: toNum('$finalNet'), pr: toNum('$purRate') },
      in: { $cond: [{ $gt: ['$$fn', 0] }, '$$fn', '$$pr'] },
    },
  };
  const [agg] = await BarcodeLabel.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        closeQty: { $sum: qtyExpr },
        closeValue: { $sum: { $multiply: [qtyExpr, costExpr] } },
      },
    },
  ]);

  return json({
    tiles: {},
    sections: [{
      key: 'stock',
      rows: mapped,
      count: total,
      totals: {
        closeQty: r2(agg?.closeQty || 0),
        closeValue: r2(agg?.closeValue || 0),
      },
    }],
    total,
    pages: Math.max(1, Math.ceil(total / perPage)),
    page,
    perPage,
  });
}
