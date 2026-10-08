// /* Barcode Report -> Import: the DATABASE side, shared by the import route
//    (app/api/reports/barcode-report/import/route.js) and the sample seed
//    (scripts/seedBarcodeReportSample.mjs). What a row IS, and every decision
//    about it, stays in lib/barcodeReportImport.js (pure); this reads what those
//    decisions need and writes what they decide.

//    MASTERS ARE FOUND, NEVER CREATED OR CHANGED (user, 2026-09-29 - the GST
//    Parse rule: it fills a form, it never writes a master). Each name from the
//    source is matched, normalised (trimmed, lower-cased, spaces collapsed),
//    against the master that owns it:

//      Item Name            item (name or item code)          -> barcode itemId
//      Group / Sub Group    productGroup (sub group = child)  -> checked against the item's
//      HSN                  hsn (code)                        -> checked against the item's
//      GST Slab "GST 5 %"   tax (5 %, preferring the HSN's slab)
//      Supplier             supplier (businessName)           -> barcode supplierId
//      Location             companyLocation (a live business's) -> movement / stock links
//      Stock Point          stockPoint (at that location)     -> movement / stock links
//      UOM (when the page has none)  the item's uom master

//    Found -> its _id. Not found -> the source's text stays on the barcode and
//    the name is listed as "unmatched" in the result. One lookup per distinct
//    name per run (the cache), however many rows name it. */

// import { isValidObjectId } from 'mongoose';
// import { BarcodeLabel, BARCODE_STATUS } from '@/lib/barcodeLabel';
// import { MOVEMENT_TYPES } from '@/models/StockMovement';
// import BarcodeSetting from '@/models/BarcodeSetting';
// import Business from '@/models/Business';
// import CompanyLocation from '@/models/CompanyLocation';
// import Item from '@/models/Item';
// import ProductGroup from '@/models/ProductGroup';
// import Hsn from '@/models/Hsn';
// import Tax from '@/models/Tax';
// import StockPoint from '@/models/StockPoint';
// import Uom from '@/models/Uom';
// import PurchaseRateCode from '@/models/PurchaseRateCode';
// import { Supplier } from '@/lib/contacts';
// import { withTransaction, applyMovement, barcodeFilter } from '@/lib/inventory';
// import { raiseBarcodeFloor } from '@/lib/barcodeEngine';
// import { uomTypeOf } from '@/lib/barcodeUnits';
// import { barcodeKey } from '@/lib/barcodeValue';
// import {
//   IMPORT_SOURCE, normaliseRecord, normaliseDetails, classifyRecords, countByStatus, updateFor, unitDocFor,
//   gstPercent, stockLeft, splitSupplier,
// } from '@/lib/barcodeReportImport';

// export const normName = (value) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
// const exactName = (value) => new RegExp('^\\s*' + normName(value).split(' ').map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+') + '\\s*$', 'i');

// /* ------------------------------------------------------------- masters -- */

// /* Every master lookup of one import run, each done once. */
// function masterCache(businessId, session) {
//   const memo = new Map();
//   const once = (key, load) => { if (!memo.has(key)) memo.set(key, load()); return memo.get(key); };
//   const s = session || null;
//   return {
//     groups: () => once('groups', () => ProductGroup.find({ businessId }).select('name parentId').session(s).lean().exec()),
//     hsns: () => once('hsns', () => Hsn.find({ businessId }).select('code taxSlabs').session(s).lean().exec()),
//     taxes: () => once('taxes', () => Tax.find({ businessId }).select('taxName igst').session(s).lean().exec()),
//     /* a location left behind by a deleted business is never a match */
//     locations: () => once('locations', async () => {
//       const live = new Set((await Business.find({}).select('_id').session(s).lean()).map((b) => String(b._id)));
//       return (await CompanyLocation.find({}).select('name businessId').session(s).lean()).filter((l) => live.has(String(l.businessId)));
//     }),
//     stockPoints: () => once('stockPoints', () => StockPoint.find({}).select('stockPoint locationId businessId').session(s).lean().exec()),
//     item: (name) => once('item:' + normName(name), () => Item.findOne({ businessId, $or: [{ name: exactName(name) }, { itemCode: exactName(name) }] })
//       .select('name itemCode subGroupId hsnId uomId').session(s).lean().exec()),
//     supplierByCode: (code) => once('supplierCode:' + code, () => Supplier.find({ businessId, contactId: code })
//       .select('businessName billingState contactId').limit(2).session(s).lean().exec()),
//     supplier: (name) => once('supplier:' + normName(name), () => Supplier.find({ businessId, businessName: exactName(name) })
//       .select('businessName billingState contactId').limit(2).session(s).lean().exec()),
//     uom: (id) => once('uom:' + id, () => (id ? Uom.findById(id).select('name shortName').session(s).lean().exec() : Promise.resolve(null))),
//   };
// }

// /* The masters one Details record names, found - { links, unmatched,
//    warnings, matched } - and its UOM: the Item master's, else the page's.
//    `businessId` - the import's: stock is only ever placed at one of its own
//    locations, and only one `canUse` allows (the operator's own locations). */
// async function resolveDetails(record, cache, businessId, canUse = () => true) {
//   const d = record.details;
//   const links = { problems: [], movementLocations: [], movementStockPoints: [], stockLocations: [], stockStockPoints: [], stockAt: [] };
//   const unmatched = [];
//   const warnings = [];
//   let matched = 0;
//   const miss = (type, name) => { if (name && !unmatched.some((u) => u.type === type && normName(u.name) === normName(name))) unmatched.push({ type, name }); };

//   /* the item, and through it group / sub group / HSN / UOM */
//   const item = d.itemName || record.values.itemCode ? await cache.item(d.itemName || record.values.itemCode) : null;
//   if (item) { links.itemId = item._id; matched += 1; } else miss('Item', d.itemName || record.values.itemCode);

//   const groups = await cache.groups();
//   const group = d.group ? groups.find((g) => !g.parentId && normName(g.name) === normName(d.group)) : null;
//   if (group) { links.groupId = group._id; matched += 1; } else miss('Group', d.group);
//   const sub = d.subGroup ? groups.find((g) => g.parentId && normName(g.name) === normName(d.subGroup) && (!group || String(g.parentId) === String(group._id))) : null;
//   if (sub) { links.subGroupId = sub._id; matched += 1; } else miss('Sub Group', d.subGroup);
//   if (item && sub && String(item.subGroupId || '') !== String(sub._id)) {
//     warnings.push(`Item ${item.name || item.itemCode} is in a different sub group here - the item master was left as it is`);
//   }

//   const hsnRows = record.values.hsn ? (await cache.hsns()).filter((h) => String(h.code).trim() === record.values.hsn) : [];
//   if (hsnRows.length) {
//     links.hsnId = hsnRows[0]._id; matched += 1;
//     if (hsnRows.length > 1) warnings.push(`HSN ${record.values.hsn} is in the HSN master ${hsnRows.length} times - the first was used`);
//     if (item && item.hsnId && !hsnRows.some((h) => String(h._id) === String(item.hsnId))) warnings.push(`Item ${item.name || item.itemCode} has a different HSN in the item master - it was left as it is`);
//   } else miss('HSN', record.values.hsn);

//   const pct = gstPercent(d.gstSlab);
//   if (pct !== null) {
//     const taxes = await cache.taxes();
//     const slabIds = new Set((hsnRows[0]?.taxSlabs || []).map((t) => String(t.gstTaxNameId)));
//     const at = taxes.filter((t) => Number(t.igst) === pct);
//     /* the HSN's own slab first, then one named plainly "GST n%", then any */
//     const tax = at.find((t) => slabIds.has(String(t._id)))
//       || at.find((t) => normName(t.taxName).replace(/[\s%]/g, '') === 'gst' + pct)
//       || at[0];
//     if (tax) { links.taxId = tax._id; matched += 1; } else miss('GST Slab', d.gstSlab);
//   }

//   if (d.supplier) {
//     /* its code first ("KARNATAKA SAREE CENTRE, MYSORE (G524)" -> G524), then
//        its name without the code */
//     const { name, code } = splitSupplier(d.supplier);
//     const byCode = code || d.supplierCode ? await cache.supplierByCode(code || d.supplierCode) : [];
//     const found = byCode.length ? byCode : await cache.supplier(name);
//     if (found.length) {
//       links.supplierId = found[0]._id; matched += 1;
//       if (found.length > 1) warnings.push(`Supplier "${d.supplier}" is in the supplier master more than once - the first was used`);
//       if (d.taxRegion && normName(found[0].billingState) !== normName(d.taxRegion)) {
//         warnings.push(`Tax Region "${d.taxRegion}" kept on the barcode - the supplier master says "${found[0].billingState || 'nothing'}" and was left as it is`);
//       }
//     } else miss('Supplier', d.supplier);
//   }

//   /* locations and stock points of the movements and the stock summary - a
//      location of the import's business first, when two businesses have one
//      of that name */
//   const locations = await cache.locations();
//   const points = await cache.stockPoints();
//   const findLocation = (name) => {
//     if (!name) return null;
//     const named = locations.filter((l) => normName(l.name) === normName(name));
//     return named.find((l) => String(l.businessId) === String(businessId)) || named[0] || null;
//   };
//   const findPoint = (name, loc) => (name ? points.find((p) => normName(p.stockPoint) === normName(name) && (!loc || String(p.locationId) === String(loc._id))) : null);
//   const link = (name, pointName, type) => {
//     const loc = findLocation(name);
//     if (loc) matched += 1; else miss('Location', name);
//     const point = findPoint(pointName, loc);
//     if (point) matched += 1; else miss('Stock Point', pointName);
//     return { loc, point, type };
//   };
//   d.movements.forEach((m) => {
//     const { loc, point } = link(m.location, m.stockPoint);
//     links.movementLocations.push(loc?._id || null);
//     links.movementStockPoints.push(point?._id || null);
//   });
//   d.stock.forEach((row) => {
//     const { loc, point } = link(row.location, row.stockPoint);
//     links.stockLocations.push(loc?._id || null);
//     links.stockStockPoints.push(point?._id || null);
//   });
//   /* where a unit kept as history is filed: the first movement location of
//      the import's own business (never another business's) */
//   links.originLocationId = d.movements
//     .map((m, i) => links.movementLocations[i] && findLocation(m.location))
//     .find((l) => l && String(l.businessId) === String(businessId))?._id || null;
//   stockLeft(d).forEach((held) => {
//     /* stock goes only to a location of the business being imported into,
//        and one the operator may receive into - never to a location of the
//        same name in another business */
//     const named = held.location ? locations.filter((l) => normName(l.name) === normName(held.location)) : [];
//     const loc = named.find((l) => String(l.businessId) === String(businessId)) || null;
//     if (!loc && named.length) {
//       links.problems.push({ field: 'location', message: `Its stock (${held.qty}) is at "${held.location}", a location of another business - import it into that business` });
//       return;
//     }
//     if (!loc) {
//       links.problems.push({ field: 'location', message: `Its stock (${held.qty}) is at "${held.location}", which is not a location in this ERP - add the location, then import again` });
//       return;
//     }
//     if (!canUse(String(loc._id))) {
//       links.problems.push({ field: 'location', message: `Its stock (${held.qty}) is at "${held.location}", a location your account is not assigned to - it can be imported by someone who works there` });
//       return;
//     }
//     links.stockAt.push({ locationId: loc._id, businessId: loc.businessId, stockPointId: findPoint(held.stockPoint, loc)?._id || null, qty: held.qty, location: loc.name });
//   });
//   if (links.stockAt.length > 1) links.problems.push({ field: 'location', message: 'The source holds this one barcode at more than one location - it cannot be imported as one unit' });

//   /* the UOM: the Item master's when it has one (the page's is kept only
//      when the master has none - a master is never changed) */
//   const pageUom = record.values.uom;
//   if (item?.uomId) {
//     const uom = await cache.uom(item.uomId);
//     const master = uom ? String(uom.shortName || uom.name || '').toUpperCase() : '';
//     if (master) {
//       if (pageUom && uomTypeOf(pageUom) !== uomTypeOf(master)) {
//         warnings.push(`The page says UOM ${pageUom}, the Item master ${master} - ${master} was used, and the Item master was left as it is`);
//       }
//       record.values.uom = master;
//       record.sources = { ...(record.sources || {}), uom: 'item_master' };
//     }
//   }
//   if (!record.values.uom) warnings.push('No UOM on the page or on the item - add it to the item master, or paste the report table instead');
//   return { links, unmatched, warnings, matched };
// }

// /* -------------------------------------------------------- classifying -- */

// /* Every record, its masters found, then classified against what this ERP
//    holds. `canUse(locationId)` - the operator may receive stock there. */
// export async function prepareImport(records, { businessId }, session = null, { canUse = () => true } = {}) {
//   const cache = masterCache(businessId, session);
//   const prepared = [];
//   let mastersMatched = 0;
//   for (const [index, raw] of (records || []).entries()) {
//     const line = Number(raw?.line) || index + 1;
//     const origin = raw?.origin === 'image' || raw?.origin === 'ocr' ? raw.origin : '';
//     /* AN IMAGE IS LOOKED UP, NEVER IMPORTED: a barcode it showed - or a
//        Details page read from one, whatever the browser sent with it - is
//        only its barcode here, looked up and shown with this ERP's values */
//     if (raw?.lookupOnly || (origin && raw?.details)) {
//       prepared.push({
//         line, lookupOnly: true, origin: origin || 'image',
//         values: { barcode: String(raw?.values?.barcode ?? '').slice(0, 80) },
//         candidate: raw?.lookupOnly && raw?.candidate ? raw.candidate : { source: 'standalone' },
//         crossCheck: raw?.crossCheck || null,
//       });
//       continue;
//     }
//     const record = {
//       line, values: normaliseRecord(raw?.values || raw),
//       ...(Array.isArray(raw?.review) ? { review: raw.review } : {}),
//       ...(origin ? { origin } : {}),
//       ...(raw?.sources && typeof raw.sources === 'object' ? { sources: raw.sources } : {}),
//       /* a barcode a pasted page printed on its own: classifyRecords takes it
//          only as a barcode this ERP could have printed, or one it holds */
//       ...(raw?.candidate?.source === 'standalone' ? { candidate: { source: 'standalone' } } : {}),
//     };
//     if (raw?.details) {
//       record.details = normaliseDetails(raw.details);
//       const found = await resolveDetails(record, cache, businessId, canUse);
//       Object.assign(record, found);
//       mastersMatched += found.matched;
//     }
//     prepared.push(record);
//   }

//   /* every number as given and in capitals, looked for across the whole
//      ERP: this business's units and those here now are the ones a row is;
//      another business's are only ever named, never imported over twice */
//   const codes = [...new Set(prepared.flatMap((r) => [r.values.barcode, String(r.values.barcode ?? '').toUpperCase()]).filter(Boolean))];
//   /* one after another: operations on a transaction's session must not overlap */
//   const all = codes.length
//     ? await BarcodeLabel.find(barcodeFilter(codes))
//       .select('barcodeNo barcodeGenerated oldBarcode itemCode itemName itemId printDescription supplierDescription qty qtyNum uom hsn purRate finalNet gst retailPrice offerPrice wspPrice dpPrice grcNo grcId source status designNo p_m_f supplierId supplierTaxRegion discount wsp dp sourceMovements businessId currentBusinessId currentLocationId')
//       .session(session || null).lean()
//     : [];
//   const ours = (u) => String(u.businessId || '') === String(businessId) || String(u.currentBusinessId || '') === String(businessId);
//   const units = all.filter(ours);
//   const elsewhere = all.filter((u) => !ours(u));
//   const formats = await BarcodeSetting.find({ businessId }).select('prefix suffix numberLenght').session(session || null).lean();
//   /* the Item master's item for each row - for "not in Item master", and to
//      tell whether a row and the unit under its number are the same goods */
//   const itemCodes = new Set();
//   const items = new Map();
//   const recordCodes = new Set(prepared.map((r) => r.values.itemCode).filter(Boolean));
//   for (const name of new Set([...recordCodes, ...prepared.map((r) => r.details?.itemName).filter(Boolean)])) {
//     const item = await cache.item(name);
//     if (!item) continue;
//     items.set(normName(name), item);
//     if (recordCodes.has(name)) itemCodes.add(name);
//   }
//   /* names for what the preview shows */
//   const ids = (list, key) => [...new Set(list.map((u) => u[key]).filter((id) => id && isValidObjectId(id)).map(String))];
//   const named = async (Model, list, key, field) => {
//     const map = new Map();
//     const want = ids(list, key);
//     if (want.length) (await Model.find({ _id: { $in: want } }).select(field).session(session || null).lean()).forEach((d) => map.set(String(d._id), d[field]));
//     return map;
//   };
//   const itemNames = await named(Item, units, 'itemId', 'name');
//   const locationNames = await named(CompanyLocation, all, 'currentLocationId', 'name');
//   const supplierNames = await named(Supplier, units, 'supplierId', 'businessName');
//   const businessNames = await named(Business, elsewhere, 'businessId', 'name');
//   const rows = classifyRecords(prepared, { units, elsewhere, formats, itemCodes, items, businessId, itemNames, locationNames, supplierNames, businessNames });
//   return { rows, mastersMatched, formats };
// }

// /* The run's summary of unmatched masters, errors and warnings. */
// function summarise(rows) {
//   const unmatched = [];
//   rows.forEach((r) => (r.unmatched || []).forEach((u) => {
//     const at = unmatched.find((x) => x.type === u.type && normName(x.name) === normName(u.name));
//     if (at) at.rows.push(r.line); else unmatched.push({ ...u, rows: [r.line] });
//   }));
//   return {
//     unmatched,
//     errors: rows.flatMap((r) => r.errors || []),
//     warnings: rows.flatMap((r) => (r.warnings || []).map((w) => `Line ${r.line}: ${w}`)),
//   };
// }

// export async function checkImport(records, scope, { canUse } = {}) {
//   const { rows, mastersMatched } = await prepareImport(records, scope, null, { canUse });
//   return { rows, counts: countByStatus(rows), mastersMatched, ...summarise(rows) };
// }

// /* ------------------------------------------------------------ writing --- */

// const text = (v) => String(v ?? '').trim();

// /* Does it, in one transaction, from a FRESH classification - nothing the
//    browser previewed is trusted to still be true:
//      new      -> SEEDED: the unit (in stock where the source still holds it -
//                  with its GRC_IN receipt in the ledger - or HISTORY when
//                  nothing is left). A number of this ERP's own series lifts
//                  that series' counter past it (raiseBarcodeFloor), so Barcode
//                  Generation never issues it again. Never a second unit: a
//                  number held here is 'same' / 'changed', one another business
//                  holds is refused (classifyRecords).
//      changed  -> only the differences the operator APPROVED, each written
//                  only while this ERP still holds the value they saw (a value
//                  changed meanwhile is left alone and reported), only on the
//                  unit they saw (unitId), and only while that unit is in stock
//                  or kept as history (the guard is part of the write). Blank
//                  fills and history rows the browser ticked by default arrive
//                  here the same way as a replacement: approved.
//    `approved` - Map(key -> { unitId, fields: Map(field -> saved value seen),
//    all }); `skipNew` - keys of new rows left unticked.
//    Returns { total, inserted, updated, replaced, filled, skipped, failed,
//    mastersMatched, unmatched, errors, warnings, missed, itemCodes, actions,
//    floors }. */
// export async function applyImport(records, { businessId, locationId, finYear }, {
//   approved = new Map(), skipNew = new Set(), user = null, canUse = () => true,
// } = {}) {
//   return withTransaction(async (session) => {
//     const opts = session ? { session } : {};
//     const { rows, mastersMatched, formats } = await prepareImport(records, { businessId }, session, { canUse });
//     const fresh = rows.filter((r) => r.status === 'new' && !skipNew.has(r.key));
//     const changes = rows.filter((r) => r.status === 'changed' && r.updatable && approved.has(r.key));
//     const mapping = fresh.length || changes.length ? await rateMapping(businessId, locationId, session) : null;
//     const actions = new Map();          // row line -> { barcode, action, fields, reason }

//     let inserted = 0;
//     const floors = [];
//     if (fresh.length) {
//       const cache = masterCache(businessId, session);
//       const docs = [];
//       for (const r of fresh) {
//         docs.push(unitDocFor(r.values, {
//           businessId, locationId, finYear, item: await cache.item(r.values.itemCode), mapping, details: r.details || null, links: r.links || null,
//         }));
//       }
//       const saved = (await BarcodeLabel.insertMany(docs, opts)).map((doc) => doc.toObject());
//       inserted = saved.length;
//       fresh.forEach((r) => actions.set(r.line, { barcode: r.barcode, action: 'seeded' }));
//       /* Barcode Generation must never issue a seeded number again */
//       for (const unit of saved) {
//         const lifted = await raiseBarcodeFloor(unit.barcodeNo, formats, businessId, session);
//         if (lifted) floors.push({ barcode: unit.barcodeNo, ...lifted });
//       }
//       /* the ledger: a receipt for each unit now in stock, one call per
//          source GRC and location, so each names where it came in */
//       const groups = new Map();
//       saved.filter((u) => u.status === BARCODE_STATUS.IN_STOCK).forEach((unit) => {
//         const key = `${unit.grcNo}|${unit.currentLocationId}`;
//         if (!groups.has(key)) groups.set(key, []);
//         groups.get(key).push(unit);
//       });
//       for (const units of groups.values()) {
//         const [first] = units;
//         await applyMovement({
//           units,
//           expect: null,
//           set: { status: BARCODE_STATUS.IN_STOCK, currentLocationId: first.currentLocationId, currentBusinessId: first.currentBusinessId },
//           movement: {
//             type: MOVEMENT_TYPES.GRC_IN,
//             direction: 'in',
//             toLocationId: first.currentLocationId,
//             refModel: IMPORT_SOURCE,
//             refNo: first.grcNo || '',
//             reason: 'Imported from the Barcode Report on erp.orbiteerp.com',
//             finYear,
//           },
//           user,
//           session,
//         });
//       }
//     }

//     let updated = 0;
//     let replaced = 0;
//     let filled = 0;
//     const missed = [];
//     for (const row of changes) {
//       const ok = approved.get(row.key);
//       /* the unit they saw - not another one that took the number since */
//       if (ok.unitId && ok.unitId !== row.unitId) {
//         missed.push(row.barcode);
//         actions.set(row.line, { barcode: row.barcode, action: 'retained', reason: 'This barcode now answers to another unit - nothing was changed; check it again' });
//         continue;
//       }
//       const take = [];
//       const stale = [];
//       row.diffs.filter((d) => d.updatable).forEach((d) => {
//         if (ok.all) { take.push(d); return; }
//         if (!ok.fields.has(d.field)) return;
//         if (text(ok.fields.get(d.field)) === text(d.local)) take.push(d); else stale.push(d.label);
//       });
//       if (!take.length) {
//         actions.set(row.line, { barcode: row.barcode, action: 'retained', ...(stale.length ? { reason: `${stale.join(', ')} changed here meanwhile - left as it is` } : {}) });
//         continue;
//       }
//       const res = await BarcodeLabel.updateOne(
//         { _id: row.unitId, status: { $in: [BARCODE_STATUS.IN_STOCK, BARCODE_STATUS.HISTORY] } },
//         { $set: { ...updateFor(row, mapping, new Set(take.map((d) => d.field))), updatedAt: new Date() } },
//         opts,
//       );
//       if (!res.matchedCount) {
//         missed.push(row.barcode);
//         actions.set(row.line, { barcode: row.barcode, action: 'retained', reason: 'Sold or moved meanwhile - not updated' });
//         continue;
//       }
//       updated += 1;
//       const replacing = take.some((d) => d.kind === 'replace');
//       if (replacing) replaced += 1; else filled += 1;
//       actions.set(row.line, {
//         barcode: row.barcode,
//         action: replacing ? 'replaced' : 'filled',
//         fields: take.map((d) => d.label),
//         ...(stale.length ? { reason: `${stale.join(', ')} changed here meanwhile - left as it is` } : {}),
//       });
//     }

//     /* every other row: why nothing was written */
//     rows.forEach((r) => {
//       if (actions.has(r.line)) return;
//       if (r.status === 'new') actions.set(r.line, { barcode: r.barcode, action: 'skipped', reason: 'Not ticked' });
//       else if (r.status === 'invalid') actions.set(r.line, { barcode: r.barcode, action: 'error', reason: r.reason });
//       else if (r.status === 'locked') actions.set(r.line, { barcode: r.barcode, action: 'retained', reason: r.reason });
//       else if (r.status === 'same') actions.set(r.line, { barcode: r.barcode, action: 'retained', reason: 'No changes' });
//       else if (r.status === 'changed') actions.set(r.line, { barcode: r.barcode, action: 'retained', reason: 'Existing data kept' });
//     });

//     const counts = countByStatus(rows);
//     return {
//       total: rows.length,
//       inserted,
//       updated,
//       replaced,
//       filled,
//       skipped: rows.length - inserted - updated - counts.invalid,
//       failed: counts.invalid,
//       mastersMatched,
//       ...summarise(rows),
//       missed,
//       floors,
//       actions: rows.map((r) => ({ line: r.line, ...actions.get(r.line) })).filter((a) => a.action),
//       itemCodes: [...new Set(rows.filter((r) => ['new', 'same', 'changed', 'locked'].includes(r.status)).map((r) => r.values.itemCode))],
//     };
//   });
// }

// /* The Purchase Rate Code Master's digit table, as the Add Item form reads it
//    (business + location) - the label prints the cost price through it. */
// async function rateMapping(businessId, locationId, session) {
//   const doc = await PurchaseRateCode.findOne({ businessId, locationId }).session(session || null).lean();
//   return doc && doc.isActive !== false ? doc.digitMappings : null;
// }

// /* ------------------------------------------------------------ indexes --- */

// /* The indexes this import relies on - created ONLY by the seed script with
//    --apply (the schema does not declare them, so starting the app never
//    builds them on its own):
//      one imported barcode per number and business - partial, so it touches
//        nothing Barcode Generation or the warehouse seed wrote
//      design and supplier - the Barcode Report's lookups */
// export const IMPORT_INDEXES = [
//   { key: { businessId: 1, barcodeNo: 1 }, options: { name: 'orbiteerp_import_barcode_unique', unique: true, partialFilterExpression: { source: IMPORT_SOURCE } } },
//   { key: { businessId: 1, designNo: 1 }, options: { name: 'businessId_designNo', partialFilterExpression: { designNo: { $type: 'string', $gt: '' } } } },
//   { key: { supplierId: 1 }, options: { name: 'supplierId_1' } },
// ];

// export { barcodeKey };










/* Barcode Report -> Import: the DATABASE side, shared by the import route
   (app/api/reports/barcode-report/import/route.js) and the sample seed
   (scripts/seedBarcodeReportSample.mjs). What a row IS, and every decision
   about it, stays in lib/barcodeReportImport.js (pure); this reads what those
   decisions need and writes what they decide.

   MASTERS ARE FOUND, NEVER CREATED OR CHANGED (user, 2026-09-29 - the GST
   Parse rule: it fills a form, it never writes a master). Each name from the
   source is matched, normalised (trimmed, lower-cased, spaces collapsed),
   against the master that owns it:

     Item Name            item (name or item code)          -> barcode itemId
     Group / Sub Group    productGroup (sub group = child)  -> checked against the item's
     HSN                  hsn (code)                        -> checked against the item's
     GST Slab "GST 5 %"   tax (5 %, preferring the HSN's slab)
     Supplier             supplier (businessName)           -> barcode supplierId
     Location             companyLocation (a live business's) -> movement / stock links
     Stock Point          stockPoint (at that location)     -> movement / stock links
     UOM (when the page has none)  the item's uom master

   Found -> its _id. Not found -> the source's text stays on the barcode and
   the name is listed as "unmatched" in the result. One lookup per distinct
   name per run (the cache), however many rows name it. */

import { isValidObjectId } from 'mongoose';
import { BarcodeLabel, BARCODE_STATUS } from '@/lib/barcodeLabel';
import { MOVEMENT_TYPES } from '@/models/StockMovement';
import BarcodeSetting from '@/models/BarcodeSetting';
import Business from '@/models/Business';
import CompanyLocation from '@/models/CompanyLocation';
import Item from '@/models/Item';
import ProductGroup from '@/models/ProductGroup';
import Hsn from '@/models/Hsn';
import Tax from '@/models/Tax';
import StockPoint from '@/models/StockPoint';
import Uom from '@/models/Uom';
import PurchaseRateCode from '@/models/PurchaseRateCode';
import { Supplier } from '@/lib/contacts';
import { withTransaction, applyMovement, barcodeFilter } from '@/lib/inventory';
import { raiseBarcodeFloor } from '@/lib/barcodeEngine';
import { barcodeImageSrc } from '@/lib/barcodeImageService';
import { imageWriteFor } from '@/lib/barcodeImage';
import { uomTypeOf } from '@/lib/barcodeUnits';
import { barcodeKey } from '@/lib/barcodeValue';
import {
  IMPORT_SOURCE, normaliseRecord, normaliseDetails, classifyRecords, countByStatus, updateFor, unitDocFor,
  gstPercent, stockLeft, splitSupplier,
} from '@/lib/barcodeReportImport';

export const normName = (value) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const exactName = (value) => new RegExp('^\\s*' + normName(value).split(' ').map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+') + '\\s*$', 'i');

/* ------------------------------------------------------------- masters -- */

/* Every master lookup of one import run, each done once. */
function masterCache(businessId, session) {
  const memo = new Map();
  const once = (key, load) => { if (!memo.has(key)) memo.set(key, load()); return memo.get(key); };
  const s = session || null;
  return {
    groups: () => once('groups', () => ProductGroup.find({ businessId }).select('name parentId').session(s).lean().exec()),
    hsns: () => once('hsns', () => Hsn.find({ businessId }).select('code taxSlabs').session(s).lean().exec()),
    taxes: () => once('taxes', () => Tax.find({ businessId }).select('taxName igst').session(s).lean().exec()),
    /* a location left behind by a deleted business is never a match */
    locations: () => once('locations', async () => {
      const live = new Set((await Business.find({}).select('_id').session(s).lean()).map((b) => String(b._id)));
      return (await CompanyLocation.find({}).select('name businessId').session(s).lean()).filter((l) => live.has(String(l.businessId)));
    }),
    stockPoints: () => once('stockPoints', () => StockPoint.find({}).select('stockPoint locationId businessId').session(s).lean().exec()),
    item: (name) => once('item:' + normName(name), () => Item.findOne({ businessId, $or: [{ name: exactName(name) }, { itemCode: exactName(name) }] })
      .select('name itemCode subGroupId hsnId uomId').session(s).lean().exec()),
    supplierByCode: (code) => once('supplierCode:' + code, () => Supplier.find({ businessId, contactId: code })
      .select('businessName billingState contactId').limit(2).session(s).lean().exec()),
    supplier: (name) => once('supplier:' + normName(name), () => Supplier.find({ businessId, businessName: exactName(name) })
      .select('businessName billingState contactId').limit(2).session(s).lean().exec()),
    uom: (id) => once('uom:' + id, () => (id ? Uom.findById(id).select('name shortName').session(s).lean().exec() : Promise.resolve(null))),
  };
}

/* The masters one Details record names, found - { links, unmatched,
   warnings, matched } - and its UOM: the Item master's, else the page's.
   `businessId` - the import's: stock is only ever placed at one of its own
   locations, and only one `canUse` allows (the operator's own locations). */
async function resolveDetails(record, cache, businessId, canUse = () => true) {
  const d = record.details;
  const links = { problems: [], movementLocations: [], movementStockPoints: [], stockLocations: [], stockStockPoints: [], stockAt: [] };
  const unmatched = [];
  const warnings = [];
  let matched = 0;
  const miss = (type, name) => { if (name && !unmatched.some((u) => u.type === type && normName(u.name) === normName(name))) unmatched.push({ type, name }); };

  /* the item, and through it group / sub group / HSN / UOM */
  const item = d.itemName || record.values.itemCode ? await cache.item(d.itemName || record.values.itemCode) : null;
  if (item) { links.itemId = item._id; matched += 1; } else miss('Item', d.itemName || record.values.itemCode);

  const groups = await cache.groups();
  const group = d.group ? groups.find((g) => !g.parentId && normName(g.name) === normName(d.group)) : null;
  if (group) { links.groupId = group._id; matched += 1; } else miss('Group', d.group);
  const sub = d.subGroup ? groups.find((g) => g.parentId && normName(g.name) === normName(d.subGroup) && (!group || String(g.parentId) === String(group._id))) : null;
  if (sub) { links.subGroupId = sub._id; matched += 1; } else miss('Sub Group', d.subGroup);
  if (item && sub && String(item.subGroupId || '') !== String(sub._id)) {
    warnings.push(`Item ${item.name || item.itemCode} is in a different sub group here - the item master was left as it is`);
  }

  const hsnRows = record.values.hsn ? (await cache.hsns()).filter((h) => String(h.code).trim() === record.values.hsn) : [];
  if (hsnRows.length) {
    links.hsnId = hsnRows[0]._id; matched += 1;
    if (hsnRows.length > 1) warnings.push(`HSN ${record.values.hsn} is in the HSN master ${hsnRows.length} times - the first was used`);
    if (item && item.hsnId && !hsnRows.some((h) => String(h._id) === String(item.hsnId))) warnings.push(`Item ${item.name || item.itemCode} has a different HSN in the item master - it was left as it is`);
  } else miss('HSN', record.values.hsn);

  const pct = gstPercent(d.gstSlab);
  if (pct !== null) {
    const taxes = await cache.taxes();
    const slabIds = new Set((hsnRows[0]?.taxSlabs || []).map((t) => String(t.gstTaxNameId)));
    const at = taxes.filter((t) => Number(t.igst) === pct);
    /* the HSN's own slab first, then one named plainly "GST n%", then any */
    const tax = at.find((t) => slabIds.has(String(t._id)))
      || at.find((t) => normName(t.taxName).replace(/[\s%]/g, '') === 'gst' + pct)
      || at[0];
    if (tax) { links.taxId = tax._id; matched += 1; } else miss('GST Slab', d.gstSlab);
  }

  if (d.supplier) {
    /* its code first ("KARNATAKA SAREE CENTRE, MYSORE (G524)" -> G524), then
       its name without the code */
    const { name, code } = splitSupplier(d.supplier);
    const byCode = code || d.supplierCode ? await cache.supplierByCode(code || d.supplierCode) : [];
    const found = byCode.length ? byCode : await cache.supplier(name);
    if (found.length) {
      links.supplierId = found[0]._id; matched += 1;
      if (found.length > 1) warnings.push(`Supplier "${d.supplier}" is in the supplier master more than once - the first was used`);
      if (d.taxRegion && normName(found[0].billingState) !== normName(d.taxRegion)) {
        warnings.push(`Tax Region "${d.taxRegion}" kept on the barcode - the supplier master says "${found[0].billingState || 'nothing'}" and was left as it is`);
      }
    } else miss('Supplier', d.supplier);
  }

  /* locations and stock points of the movements and the stock summary - a
     location of the import's business first, when two businesses have one
     of that name */
  const locations = await cache.locations();
  const points = await cache.stockPoints();
  
  /* Enhanced location resolution using the new mapping system.
     Pre-compute all V0 → V1 location mappings before processing. */
  const { resolveLocation: resolveLocationFn, normalizeLocationName } = await import('@/lib/locationMapping');
  
  // Build a lookup map for quick synchronous resolution
  const locationResolutionMap = new Map();
  const uniqueLocationNames = new Set([
    ...d.movements.map(m => m.location),
    ...d.stock.map(s => s.location),
    ...(stockLeft(d).map(h => h.location)),
  ].filter(Boolean));
  
  for (const v0Name of uniqueLocationNames) {
    const resolution = await resolveLocationFn(v0Name, businessId, locations, {
      fuzzyThreshold: 0.85,
      allowMultiple: false,
    });
    locationResolutionMap.set(v0Name, resolution);
  }
  
  const findLocation = (name) => {
    if (!name) return null;
    
    // Check if we have a pre-computed resolution
    const resolution = locationResolutionMap.get(name);
    if (resolution && resolution.location && 
        ['exact', 'case_insensitive', 'normalized', 'alias'].includes(resolution.matchType)) {
      return resolution.location;
    }
    
    // For fuzzy matches with medium/high confidence, use if unambiguous
    if (resolution && resolution.location && resolution.matchType === 'fuzzy' && 
        resolution.confidence !== 'low') {
      return resolution.location;
    }
    
    // Fall back to original logic for backward compatibility
    const named = locations.filter((l) => normName(l.name) === normName(name));
    return named.find((l) => String(l.businessId) === String(businessId)) || named[0] || null;
  };
  
  const findPoint = (name, loc) => (name ? points.find((p) => normName(p.stockPoint) === normName(name) && (!loc || String(p.locationId) === String(loc._id))) : null);
  const link = (name, pointName, type) => {
    const loc = findLocation(name);
    if (loc) matched += 1; else miss('Location', name);
    const point = findPoint(pointName, loc);
    if (point) matched += 1; else miss('Stock Point', pointName);
    return { loc, point, type };
  };
  d.movements.forEach((m) => {
    const { loc, point } = link(m.location, m.stockPoint);
    links.movementLocations.push(loc?._id || null);
    links.movementStockPoints.push(point?._id || null);
  });
  d.stock.forEach((row) => {
    const { loc, point } = link(row.location, row.stockPoint);
    links.stockLocations.push(loc?._id || null);
    links.stockStockPoints.push(point?._id || null);
  });
  /* where a unit kept as history is filed: the first movement location of
     the import's own business (never another business's) */
  links.originLocationId = d.movements
    .map((m, i) => links.movementLocations[i] && findLocation(m.location))
    .find((l) => l && String(l.businessId) === String(businessId))?._id || null;
  stockLeft(d).forEach((held) => {
    /* stock goes to a location of the business being imported into,
       and one the operator may receive into. When the source stock is at
       a location of another business or not found in this ERP, it is noted
       as informational but does not block the import - the barcode will be
       imported into the selected destination warehouse */
    const named = held.location ? locations.filter((l) => normName(l.name) === normName(held.location)) : [];
    const loc = named.find((l) => String(l.businessId) === String(businessId)) || null;
    if (!loc && named.length) {
      /* Stock exists at another business's location - informational only, not blocking */
      warnings.push(`Stock (${held.qty}) exists at "${held.location}", a location of another business - it will be imported into the selected destination warehouse`);
      return;
    }
    if (!loc) {
      /* Stock location not found in this ERP - informational only, not blocking */
      warnings.push(`Stock (${held.qty}) is noted at "${held.location}", which is not a location in this ERP - it will be imported into the selected destination warehouse`);
      return;
    }
    if (!canUse(String(loc._id))) {
      /* Location not accessible to operator - informational only, not blocking */
      warnings.push(`Stock (${held.qty}) is at "${held.location}", a location your account is not assigned to - it will be imported into the selected destination warehouse`);
      return;
    }
    links.stockAt.push({ locationId: loc._id, businessId: loc.businessId, stockPointId: findPoint(held.stockPoint, loc)?._id || null, qty: held.qty, location: loc.name });
  });
  if (links.stockAt.length > 1) warnings.push('The source holds this one barcode at more than one location - it will be imported into the selected destination warehouse');

  /* the UOM: the Item master's when it has one (the page's is kept only
     when the master has none - a master is never changed) */
  const pageUom = record.values.uom;
  if (item?.uomId) {
    const uom = await cache.uom(item.uomId);
    const master = uom ? String(uom.shortName || uom.name || '').toUpperCase() : '';
    if (master) {
      if (pageUom && uomTypeOf(pageUom) !== uomTypeOf(master)) {
        warnings.push(`The page says UOM ${pageUom}, the Item master ${master} - ${master} was used, and the Item master was left as it is`);
      }
      record.values.uom = master;
      record.sources = { ...(record.sources || {}), uom: 'item_master' };
    }
  }
  if (!record.values.uom) warnings.push('No UOM on the page or on the item - add it to the item master, or paste the report table instead');
  return { links, unmatched, warnings, matched };
}

/* -------------------------------------------------------- classifying -- */

/* Every record, its masters found, then classified against what this ERP
   holds. `canUse(locationId)` - the operator may receive stock there. */
export async function prepareImport(records, { businessId }, session = null, { canUse = () => true } = {}) {
  const cache = masterCache(businessId, session);
  const prepared = [];
  let mastersMatched = 0;
  for (const [index, raw] of (records || []).entries()) {
    const line = Number(raw?.line) || index + 1;
    const origin = raw?.origin === 'image' || raw?.origin === 'ocr' ? raw.origin : '';
    /* a barcode only to be looked up (an older screen's image look-up): only
       its barcode here, shown with this ERP's values, never written */
    if (raw?.lookupOnly) {
      prepared.push({
        line, lookupOnly: true, origin: origin || 'image',
        values: { barcode: String(raw?.values?.barcode ?? '').slice(0, 80) },
        candidate: raw?.candidate || { source: 'standalone' },
        crossCheck: raw?.crossCheck || null,
      });
      continue;
    }
    /* A Details page read from a SCREENSHOT is imported like a pasted one
       (user, 2026-09-30) - the operator said it is a Barcode Report, saw
       every value beside the image and corrected what OCR misread; the route
       takes it only with their word that they compared it (`compared`). */
    const record = {
      line, values: normaliseRecord(raw?.values || raw),
      ...(Array.isArray(raw?.review) ? { review: raw.review } : {}),
      ...(origin ? { origin } : {}),
      ...(raw?.sources && typeof raw.sources === 'object' ? { sources: raw.sources } : {}),
      /* a barcode a page printed on its own, or its Item Code taken as its
         barcode: classifyRecords checks each again (acceptProblem - a
         barcode this ERP could have printed, or holds; never the Item Name) */
      ...(['standalone', 'item_code'].includes(raw?.candidate?.source) ? { candidate: { source: raw.candidate.source } } : {}),
    };
    if (raw?.details) {
      record.details = normaliseDetails(raw.details);
      const found = await resolveDetails(record, cache, businessId, canUse);
      Object.assign(record, found);
      mastersMatched += found.matched;
    }
    prepared.push(record);
  }

  /* every number as given and in capitals, looked for across the whole
     ERP: this business's units and those here now are the ones a row is;
     another business's are only ever named, never imported over twice */
  const codes = [...new Set(prepared.flatMap((r) => [r.values.barcode, String(r.values.barcode ?? '').toUpperCase()]).filter(Boolean))];
  /* one after another: operations on a transaction's session must not overlap */
  const all = codes.length
    ? await BarcodeLabel.find(barcodeFilter(codes))
      .select('barcodeNo barcodeGenerated oldBarcode itemCode itemName itemId printDescription supplierDescription qty qtyNum uom hsn purRate finalNet gst retailPrice offerPrice wspPrice dpPrice grcNo grcId source status designNo p_m_f supplierId supplierTaxRegion discount wsp dp sourceMovements businessId currentBusinessId currentLocationId imageUrl')
      .session(session || null).lean()
    : [];
  const ours = (u) => String(u.businessId || '') === String(businessId) || String(u.currentBusinessId || '') === String(businessId);
  const units = all.filter(ours);
  const elsewhere = all.filter((u) => !ours(u));
  const formats = await BarcodeSetting.find({ businessId }).select('prefix suffix numberLenght').session(session || null).lean();
  /* the Item master's item for each row - for "not in Item master", and to
     tell whether a row and the unit under its number are the same goods */
  const itemCodes = new Set();
  const items = new Map();
  const recordCodes = new Set(prepared.map((r) => r.values.itemCode).filter(Boolean));
  for (const name of new Set([...recordCodes, ...prepared.map((r) => r.details?.itemName).filter(Boolean)])) {
    const item = await cache.item(name);
    if (!item) continue;
    items.set(normName(name), item);
    if (recordCodes.has(name)) itemCodes.add(name);
  }
  /* names for what the preview shows */
  const ids = (list, key) => [...new Set(list.map((u) => u[key]).filter((id) => id && isValidObjectId(id)).map(String))];
  const named = async (Model, list, key, field) => {
    const map = new Map();
    const want = ids(list, key);
    if (want.length) (await Model.find({ _id: { $in: want } }).select(field).session(session || null).lean()).forEach((d) => map.set(String(d._id), d[field]));
    return map;
  };
  const itemNames = await named(Item, units, 'itemId', 'name');
  const locationNames = await named(CompanyLocation, all, 'currentLocationId', 'name');
  const supplierNames = await named(Supplier, units, 'supplierId', 'businessName');
  const businessNames = await named(Business, elsewhere, 'businessId', 'name');
  const rows = classifyRecords(prepared, { units, elsewhere, formats, itemCodes, items, businessId, itemNames, locationNames, supplierNames, businessNames });
  /* the barcode image a barcode already has, as the preview shows it beside
     a new one (its stored value stays in existing.imageUrl) */
  rows.forEach((r) => { if (r.existing) r.existing.image = barcodeImageSrc(r.existing.imageUrl); });
  return { rows, mastersMatched, formats };
}

/* The run's summary of unmatched masters, errors and warnings. */
function summarise(rows) {
  const unmatched = [];
  rows.forEach((r) => (r.unmatched || []).forEach((u) => {
    const at = unmatched.find((x) => x.type === u.type && normName(x.name) === normName(u.name));
    if (at) at.rows.push(r.line); else unmatched.push({ ...u, rows: [r.line] });
  }));
  return {
    unmatched,
    errors: rows.flatMap((r) => r.errors || []),
    warnings: rows.flatMap((r) => (r.warnings || []).map((w) => `Line ${r.line}: ${w}`)),
  };
}

export async function checkImport(records, scope, { canUse } = {}) {
  const { rows, mastersMatched } = await prepareImport(records, scope, null, { canUse });
  return { rows, counts: countByStatus(rows), mastersMatched, ...summarise(rows) };
}

/* ------------------------------------------------------------ writing --- */

const text = (v) => String(v ?? '').trim();

/* Does it, in one transaction, from a FRESH classification - nothing the
   browser previewed is trusted to still be true:
     new      -> SEEDED: the unit (in stock where the source still holds it -
                 with its GRC_IN receipt in the ledger - or HISTORY when
                 nothing is left). A number of this ERP's own series lifts
                 that series' counter past it (raiseBarcodeFloor), so Barcode
                 Generation never issues it again. Never a second unit: a
                 number held here is 'same' / 'changed', one another business
                 holds is refused (classifyRecords).
     changed  -> only the differences the operator APPROVED, each written
                 only while this ERP still holds the value they saw (a value
                 changed meanwhile is left alone and reported), only on the
                 unit they saw (unitId), and only while that unit is in stock
                 or kept as history (the guard is part of the write). Blank
                 fills and history rows the browser ticked by default arrive
                 here the same way as a replacement: approved.
   `approved` - Map(key -> { unitId, fields: Map(field -> saved value seen),
   all }); `skipNew` - keys of new rows left unticked.
   `images` - Map(key -> { barcode, unitId, url, mime, name, seen, replace }),
   each url already verified (lib/barcodeImageService.js): the BARCODE IMAGE
   the operator attached to that barcode, decided on its own - never by the
   data's KEEP / REPLACE, and never changing the data (imageWriteFor). A new
   barcode's goes in with its insert; an existing barcode's is written only
   while it still holds the image the operator saw.
   Returns { total, inserted, updated, replaced, filled, skipped, failed,
   mastersMatched, unmatched, errors, warnings, missed, itemCodes, actions
   (each with its `image` outcome), images, imagesSaved, imagesReplaced,
   floors }. */
export async function applyImport(records, { businessId, locationId, finYear }, {
  approved = new Map(), skipNew = new Set(), user = null, canUse = () => true, images = new Map(),
} = {}) {
  return withTransaction(async (session) => {
    const opts = session ? { session } : {};
    const { rows, mastersMatched, formats } = await prepareImport(records, { businessId }, session, { canUse });
    const fresh = rows.filter((r) => r.status === 'new' && !skipNew.has(r.key));
    const changes = rows.filter((r) => r.status === 'changed' && r.updatable && approved.has(r.key));
    const mapping = fresh.length || changes.length ? await rateMapping(businessId, locationId, session) : null;
    const actions = new Map();          // row line -> { barcode, action, fields, reason }
    /* each barcode's image outcome: key -> { barcode, line, action, url, reason } */
    const imageResults = new Map();
    /* the row a barcode's image belongs to - the one the import can act on
       when a number is in it twice (the second is refused as a duplicate) */
    const rowOfKey = (key) => rows.find((r) => r.key === key && r.status !== 'invalid') || rows.find((r) => r.key === key) || null;

    let inserted = 0;
    const floors = [];
    if (fresh.length) {
      const cache = masterCache(businessId, session);
      const docs = [];
      for (const r of fresh) {
        const doc = unitDocFor(r.values, {
          businessId, locationId, finYear, item: await cache.item(r.values.itemCode), mapping, details: r.details || null, links: r.links || null,
        });
        /* its barcode image, in the same insert */
        const image = images.get(r.key);
        if (image) {
          const plan = imageWriteFor(r, image, { seeded: true });
          if (plan.write === 'insert') Object.assign(doc, plan.set);
          imageResults.set(r.key, { barcode: r.barcode, line: r.line, action: plan.action, ...(plan.write ? { url: image.url } : {}), ...(plan.reason ? { reason: plan.reason } : {}) });
        }
        docs.push(doc);
      }
      const saved = (await BarcodeLabel.insertMany(docs, opts)).map((doc) => doc.toObject());
      inserted = saved.length;
      fresh.forEach((r) => actions.set(r.line, { barcode: r.barcode, action: 'seeded' }));
      /* Barcode Generation must never issue a seeded number again */
      for (const unit of saved) {
        const lifted = await raiseBarcodeFloor(unit.barcodeNo, formats, businessId, session);
        if (lifted) floors.push({ barcode: unit.barcodeNo, ...lifted });
      }
      /* the ledger: a receipt for each unit now in stock, one call per
         source GRC and location, so each names where it came in */
      const groups = new Map();
      saved.filter((u) => u.status === BARCODE_STATUS.IN_STOCK).forEach((unit) => {
        const key = `${unit.grcNo}|${unit.currentLocationId}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(unit);
      });
      for (const units of groups.values()) {
        const [first] = units;
        await applyMovement({
          units,
          expect: null,
          set: { status: BARCODE_STATUS.IN_STOCK, currentLocationId: first.currentLocationId, currentBusinessId: first.currentBusinessId },
          movement: {
            type: MOVEMENT_TYPES.GRC_IN,
            direction: 'in',
            toLocationId: first.currentLocationId,
            refModel: IMPORT_SOURCE,
            refNo: first.grcNo || '',
            reason: 'Imported from the Barcode Report on erp.orbiteerp.com',
            finYear,
          },
          user,
          session,
        });
      }
    }

    let updated = 0;
    let replaced = 0;
    let filled = 0;
    const missed = [];
    for (const row of changes) {
      const ok = approved.get(row.key);
      /* the unit they saw - not another one that took the number since */
      if (ok.unitId && ok.unitId !== row.unitId) {
        missed.push(row.barcode);
        actions.set(row.line, { barcode: row.barcode, action: 'retained', reason: 'This barcode now answers to another unit - nothing was changed; check it again' });
        continue;
      }
      const take = [];
      const stale = [];
      row.diffs.filter((d) => d.updatable).forEach((d) => {
        if (ok.all) { take.push(d); return; }
        if (!ok.fields.has(d.field)) return;
        if (text(ok.fields.get(d.field)) === text(d.local)) take.push(d); else stale.push(d.label);
      });
      if (!take.length) {
        actions.set(row.line, { barcode: row.barcode, action: 'retained', ...(stale.length ? { reason: `${stale.join(', ')} changed here meanwhile - left as it is` } : {}) });
        continue;
      }
      const res = await BarcodeLabel.updateOne(
        { _id: row.unitId, status: { $in: [BARCODE_STATUS.IN_STOCK, BARCODE_STATUS.HISTORY] } },
        { $set: { ...updateFor(row, mapping, new Set(take.map((d) => d.field))), updatedAt: new Date() } },
        opts,
      );
      if (!res.matchedCount) {
        missed.push(row.barcode);
        actions.set(row.line, { barcode: row.barcode, action: 'retained', reason: 'Sold or moved meanwhile - not updated' });
        continue;
      }
      updated += 1;
      const replacing = take.some((d) => d.kind === 'replace');
      if (replacing) replaced += 1; else filled += 1;
      actions.set(row.line, {
        barcode: row.barcode,
        action: replacing ? 'replaced' : 'filled',
        fields: take.map((d) => d.label),
        ...(stale.length ? { reason: `${stale.join(', ')} changed here meanwhile - left as it is` } : {}),
      });
    }

    /* THE BARCODE IMAGES of barcodes already here (and of any the import
       could not act on) - apart from their data: a barcode whose data was
       kept can still take an image, and one whose data was replaced keeps
       its image unless its own image was replaced. Written by barcode, on
       the unit this fresh classification found, only while it still holds
       the image the operator saw. */
    for (const [key, image] of images) {
      if (imageResults.has(key)) continue;
      const row = rowOfKey(key);
      const plan = imageWriteFor(row, image, { seeded: row?.status === 'new' && !skipNew.has(key) });
      let { action, reason } = plan;
      if (plan.write === 'update') {
        const res = await BarcodeLabel.updateOne(plan.filter, { $set: { ...plan.set, updatedAt: new Date() } }, opts);
        if (!res.matchedCount) {
          action = 'retained';
          reason = 'The barcode image was changed here meanwhile - it was left as it is; check it again';
        }
      }
      imageResults.set(key, {
        barcode: row?.barcode || image.barcode, line: row?.line ?? null, action,
        ...(action === 'saved' || action === 'replaced' ? { url: image.url } : {}), ...(reason ? { reason } : {}),
      });
    }
    const imageOf = new Map([...imageResults.values()].filter((i) => i.line !== null).map((i) => [i.line, i]));

    /* every other row: why nothing was written */
    rows.forEach((r) => {
      if (actions.has(r.line)) return;
      if (r.status === 'new') actions.set(r.line, { barcode: r.barcode, action: 'skipped', reason: 'Not ticked' });
      else if (r.status === 'invalid') actions.set(r.line, { barcode: r.barcode, action: 'error', reason: r.reason });
      else if (r.status === 'locked') actions.set(r.line, { barcode: r.barcode, action: 'retained', reason: r.reason });
      else if (r.status === 'same') actions.set(r.line, { barcode: r.barcode, action: 'retained', reason: 'No changes' });
      else if (r.status === 'changed') actions.set(r.line, { barcode: r.barcode, action: 'retained', reason: 'Existing data kept' });
    });

    const counts = countByStatus(rows);
    const imageList = [...imageResults.values()];
    return {
      total: rows.length,
      inserted,
      updated,
      replaced,
      filled,
      skipped: rows.length - inserted - updated - counts.invalid,
      failed: counts.invalid,
      mastersMatched,
      ...summarise(rows),
      missed,
      floors,
      /* each barcode's data outcome, and - apart from it - its image's */
      actions: rows.map((r) => {
        const image = imageOf.get(r.line);
        return { line: r.line, ...actions.get(r.line), ...(image ? { image: { action: image.action, ...(image.url ? { url: image.url } : {}), ...(image.reason ? { reason: image.reason } : {}) } } : {}) };
      }).filter((a) => a.action),
      images: imageList,
      imagesSaved: imageList.filter((i) => i.action === 'saved').length,
      imagesReplaced: imageList.filter((i) => i.action === 'replaced').length,
      itemCodes: [...new Set(rows.filter((r) => ['new', 'same', 'changed', 'locked'].includes(r.status)).map((r) => r.values.itemCode))],
    };
  });
}

/* The Purchase Rate Code Master's digit table, as the Add Item form reads it
   (business + location) - the label prints the cost price through it. */
async function rateMapping(businessId, locationId, session) {
  const doc = await PurchaseRateCode.findOne({ businessId, locationId }).session(session || null).lean();
  return doc && doc.isActive !== false ? doc.digitMappings : null;
}

/* ------------------------------------------------------------ indexes --- */

/* The indexes this import relies on - created ONLY by the seed script with
   --apply (the schema does not declare them, so starting the app never
   builds them on its own):
     one imported barcode per number and business - partial, so it touches
       nothing Barcode Generation or the warehouse seed wrote
     design and supplier - the Barcode Report's lookups */
export const IMPORT_INDEXES = [
  { key: { businessId: 1, barcodeNo: 1 }, options: { name: 'orbiteerp_import_barcode_unique', unique: true, partialFilterExpression: { source: IMPORT_SOURCE } } },
  { key: { businessId: 1, designNo: 1 }, options: { name: 'businessId_designNo', partialFilterExpression: { designNo: { $type: 'string', $gt: '' } } } },
  { key: { supplierId: 1 }, options: { name: 'supplierId_1' } },
];

export { barcodeKey };
