// // import { isValidObjectId } from 'mongoose';
// // import dbConnect from '@/lib/db';
// // import { requireSession } from '@/lib/session';
// // import { escapeRegex } from '@/lib/validate';
// // import { BarcodeLabel } from '@/lib/barcodeLabel';
// // import { canonicalBarcodeValue } from '@/lib/barcodeValue';
// // import Grc from '@/models/Grc';
// // import { json, num, r2, scopeOf, pageOf, paged } from '@/lib/reports';

// // /* /api/reports/barcode-report - read-only.

// //    Every barcode row generated for one item code, with the rate it was
// //    received at and the four prices printed on its label.

// //    Item Code is required: this reads the barcode collection one item at a
// //    time rather than dumping it, which is what the deployed screen does. */

// // export async function GET(req) {
// //   const session = await requireSession();
// //   if (!session) return json({ error: 'Unauthorized' }, 401);

// //   const sp = new URL(req.url).searchParams;
// //   await dbConnect();

// //   const { businessId, locationId, finYear } = scopeOf(sp);
// //   const { page, perPage } = pageOf(sp);

// //   const itemCode = String(sp.get('itemCode') || '').trim();
// //   if (!itemCode) return json({ error: 'Item Code is required.' }, 422);

// //   /* BarcodeLabel stores its scope as plain strings, and locationId is very
// //      often blank - the barcode screen does not always set it. Filtering
// //      strictly on a location would hide real rows, so a chosen location matches
// //      that location OR an unassigned one. The same compromise the inter company
// //      item lookup makes, and for the same reason. */
// //   const filter = { itemCode: { $regex: escapeRegex(itemCode), $options: 'i' } };
// //   if (businessId) filter.businessId = String(businessId);
// //   if (finYear) filter.finYear = finYear;
// //   if (locationId) filter.locationId = { $in: [String(locationId), '', null] };

// //   const rows = await BarcodeLabel.find(filter).sort({ createdAt: -1 }).limit(5000).lean();

// //   /* the GRC each barcode was received on */
// //   const grcIds = [...new Set(
// //     rows.map((r) => r.grcId).filter((id) => id && isValidObjectId(String(id)))
// //   )];
// //   const grcs = grcIds.length
// //     ? await Grc.find({ _id: { $in: grcIds } }).select('grcNumber').lean()
// //     : [];
// //   const grcNoById = new Map(grcs.map((g) => [String(g._id), g.grcNumber || '']));

// //   const mapped = rows.map((r) => ({
// //     _id: String(r._id),
// //     /* shown - and exported - in the spelling the label prints and the bars
// //        encode ("G1318*05178*1*1"); the stored value is not touched */
// //     barcodeGenerated: canonicalBarcodeValue(r.barcodeGenerated),
// //     itemCode: r.itemCode || '',
// //     description: r.printDescription || r.supplierDescription || '',
// //     qty: num(r.qty),
// //     uom: r.uom || '',
// //     hsn: r.hsn || '',
// //     purRate: num(r.purRate),
// //     finalNet: num(r.finalNet),
// //     gst: num(r.gst),
// //     retailPrice: num(r.retailPrice),
// //     offerPrice: num(r.offerPrice),
// //     wspPrice: num(r.wspPrice),
// //     dpPrice: num(r.dpPrice),
// //     grcNo: grcNoById.get(String(r.grcId)) || '',
// //   }));

// //   const p = paged(mapped, page, perPage);

// //   return json({
// //     tiles: {},
// //     sections: [{
// //       rows: p.rows,
// //       count: p.total,
// //       totals: {
// //         qty: r2(mapped.reduce((a, r) => a + r.qty, 0)),
// //         /* value received = line rate x quantity, summed over the whole result
// //            set rather than the visible page */
// //         finalNet: r2(mapped.reduce((a, r) => a + r.finalNet * r.qty, 0)),
// //       },
// //     }],
// //     total: p.total,
// //     pages: p.pages,
// //     page,
// //     perPage,
// //   });
// // }























// import { isValidObjectId } from 'mongoose';
// import dbConnect from '@/lib/db';
// import { requireSession } from '@/lib/session';
// import { escapeRegex } from '@/lib/validate';
// import { BarcodeLabel } from '@/lib/barcodeLabel';
// import { canonicalBarcodeValue } from '@/lib/barcodeValue';
// import Grc from '@/models/Grc';
// import Item from '@/models/Item';
// import ProductGroup from '@/models/ProductGroup';
// import { Supplier } from '@/lib/contacts';
// import { json, num, r2, scopeOf, pageOf, paged } from '@/lib/reports';

// /* /api/reports/barcode-report - read-only.

//    Every barcode row generated for one item code, with the rate it was
//    received at and the four prices printed on its label.

//    Item Code is required: this reads the barcode collection one item at a
//    time rather than dumping it, which is what the deployed screen does. */

// export async function GET(req) {
//   const session = await requireSession();
//   if (!session) return json({ error: 'Unauthorized' }, 401);

//   const sp = new URL(req.url).searchParams;
//   await dbConnect();

//   const { businessId, locationId, finYear } = scopeOf(sp);
//   const { page, perPage } = pageOf(sp);

//   const itemCode = String(sp.get('itemCode') || '').trim();
//   if (!itemCode) return json({ error: 'Item Code is required.' }, 422);

//   /* BarcodeLabel stores its scope as plain strings, and locationId is very
//      often blank - the barcode screen does not always set it. Filtering
//      strictly on a location would hide real rows, so a chosen location matches
//      that location OR an unassigned one. The same compromise the inter company
//      item lookup makes, and for the same reason. */
//   const filter = { itemCode: { $regex: escapeRegex(itemCode), $options: 'i' } };
//   if (businessId) filter.businessId = String(businessId);
//   if (finYear) filter.finYear = finYear;
//   if (locationId) filter.locationId = { $in: [String(locationId), '', null] };

//   /* the list never carries an imported unit's history - that is the Details
//      screen's (/api/reports/barcode-detail) */
//   const rows = await BarcodeLabel.find(filter)
//     .select('-sourceMovements -sourceStock -sourceTotals -sourcePayload -customFields')
//     .sort({ createdAt: -1 }).limit(5000).lean();

//   /* Group / Sub Group are the ITEM's masters - a barcode keeps none of its
//      own - and Supplier is the supplier master's name */
//   const ids = (list) => [...new Set(list.filter((id) => id && isValidObjectId(String(id))).map(String))];
//   const items = await Item.find({ _id: { $in: ids(rows.map((r) => r.itemId)) } }).select('subGroupId').lean();
//   const subs = await ProductGroup.find({ _id: { $in: ids(items.map((i) => i.subGroupId)) } }).select('name parentId').lean();
//   const parents = await ProductGroup.find({ _id: { $in: ids(subs.map((s) => s.parentId)) } }).select('name').lean();
//   const suppliers = await Supplier.find({ _id: { $in: ids(rows.map((r) => r.supplierId)) } }).select('businessName contactId').lean();
//   const subOfItem = new Map(items.map((i) => [String(i._id), String(i.subGroupId || '')]));
//   const subById = new Map(subs.map((s) => [String(s._id), s]));
//   const groupName = new Map(parents.map((p) => [String(p._id), p.name || '']));
//   const supplierName = new Map(suppliers.map((s) => [String(s._id), s.businessName || '']));

//   /* the GRC each barcode was received on */
//   const grcIds = [...new Set(
//     rows.map((r) => r.grcId).filter((id) => id && isValidObjectId(String(id)))
//   )];
//   const grcs = grcIds.length
//     ? await Grc.find({ _id: { $in: grcIds } }).select('grcNumber').lean()
//     : [];
//   const grcNoById = new Map(grcs.map((g) => [String(g._id), g.grcNumber || '']));

//   const mapped = rows.map((r) => ({
//     _id: String(r._id),
//     /* shown - and exported - in the spelling the label prints and the bars
//        encode ("G1318*05178*1*1"); the stored value is not touched */
//     barcodeGenerated: canonicalBarcodeValue(r.barcodeGenerated) || r.barcodeNo || '',
//     barcodeNo: r.barcodeNo || '',
//     itemCode: r.itemCode || '',
//     description: r.printDescription || r.supplierDescription || '',
//     subGroup: subById.get(subOfItem.get(String(r.itemId)))?.name || '',
//     group: groupName.get(String(subById.get(subOfItem.get(String(r.itemId)))?.parentId || '')) || '',
//     designNo: r.designNo || '',
//     supplier: supplierName.get(String(r.supplierId)) || '',
//     qty: num(r.qty),
//     uom: r.uom || '',
//     hsn: r.hsn || '',
//     purRate: num(r.purRate),
//     finalNet: num(r.finalNet),
//     gst: num(r.gst),
//     retailPrice: num(r.retailPrice),
//     offerPrice: num(r.offerPrice),
//     wspPrice: num(r.wspPrice),
//     dpPrice: num(r.dpPrice),
//     /* a unit imported from the other ERP's report has no GRC here - it keeps
//        the GRC number it was received on over there */
//     grcNo: grcNoById.get(String(r.grcId)) || r.grcNo || '',
//   }));

//   const p = paged(mapped, page, perPage);

//   return json({
//     tiles: {},
//     sections: [{
//       rows: p.rows,
//       count: p.total,
//       totals: {
//         qty: r2(mapped.reduce((a, r) => a + r.qty, 0)),
//         /* value received = line rate x quantity, summed over the whole result
//            set rather than the visible page */
//         finalNet: r2(mapped.reduce((a, r) => a + r.finalNet * r.qty, 0)),
//       },
//     }],
//     total: p.total,
//     pages: p.pages,
//     page,
//     perPage,
//   });
// }


































//////////////////











import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import { requireSession } from '@/lib/session';
import { escapeRegex } from '@/lib/validate';
import { BarcodeLabel } from '@/lib/barcodeLabel';
import { canonicalBarcodeValue } from '@/lib/barcodeValue';
import Grc from '@/models/Grc';
import Item from '@/models/Item';
import ProductGroup from '@/models/ProductGroup';
import { Supplier } from '@/lib/contacts';
import { json, num, r2, scopeOf, pageOf } from '@/lib/reports';

/* /api/reports/barcode-report - read-only.

   Barcode rows, with the rate each was received at and the four prices
   printed on its label - found by

     barcodeNo   THE BARCODE NUMBER - barcodeLabel.barcodeNo, the number
                 Barcode Generation issued ("8A1881") - matched from its
                 start, case aside:
                   the start of a number, a SERIES ("6A")  -> every barcode
                                                              beginning with it
                   a whole barcode number ("6A1000"), one  -> that barcode,
                   a barcode of this business has             not the longer
                                                              ones that begin
                                                              with it (6A1000-01)
                 Never the item code, the composed reference barcodeGenerated
                 ("G1093 * 05079 * 5 * 5") or an old barcode: text no barcode
                 number begins with finds nothing.
     itemCode    every barcode of an item code, as the report always listed

   One of the two is required (both narrow it together).

   Count, pages, totals and export are all cut from ONE ordered list of the
   whole result, so they always agree: `export=1` answers every row of it, in
   the order the pages show them - the screen's Export CSV / Excel / Print
   (spec exportAll) - where a page answers its slice. A series runs to
   thousands of barcodes, so the result is no longer cut at 5,000 rows: the
   list is read light (four fields a barcode), and only the rows answered are
   read in full. Only an export has a ceiling (EXPORT_MAX), and says so. */

/* a series in number order - OT9990 before OT10016, 6A2393 before
   6A2393-100 - the way a person reads barcode numbers, not character by
   character */
const BY_NUMBER = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
/* newest first, as the report always listed an item's barcodes; the id
   settles a tie (a batch is stamped with one time), so every page of the
   same search is cut from the same order */
const newestFirst = (a, b) =>
  (new Date(b.createdAt || 0) - new Date(a.createdAt || 0)) || String(a._id).localeCompare(String(b._id));
const byBarcodeNumber = (a, b) =>
  BY_NUMBER.compare(String(a.barcodeNo || ''), String(b.barcodeNo || '')) || newestFirst(a, b);
/* an export answers every row up to the ceiling ListView's exports keep;
   past it, `total` still counts them all, and the screen says the file is
   short */
const EXPORT_MAX = 50000;

export async function GET(req) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const sp = new URL(req.url).searchParams;
  await dbConnect();

  const { businessId, locationId, finYear } = scopeOf(sp);
  /* a page number / size that is not one (0, "abc") is the first page of
     the usual size - never NaN or Infinity pages */
  const asked = pageOf(sp);
  const perPage = Number.isFinite(asked.perPage) && asked.perPage >= 1 ? Math.floor(asked.perPage) : 15;
  const page = Number.isFinite(asked.page) && asked.page >= 1 ? Math.floor(asked.page) : 1;
  /* every row of the result, not a page of it - the exports */
  const everything = sp.get('export') === '1';

  /* a NUL can be typed or pasted, but MongoDB refuses a $regex holding one -
     it is no part of any barcode or item code */
  const typed = (key) => String(sp.get(key) || '').replace(/\u0000/g, '').trim();
  const barcode = typed('barcodeNo');
  const itemCode = typed('itemCode');
  if (!barcode && !itemCode) return json({ error: 'Enter a Barcode or an Item Code.' }, 422);
  /* never unscoped: without a business this would read every business's
     barcodes - and an export would write them all to one file */
  if (!businessId) return json({ error: 'Select a business in the top bar.' }, 422);

  /* BarcodeLabel stores its scope as plain strings, and locationId is very
     often blank - the barcode screen does not always set it. Filtering
     strictly on a location would hide real rows, so a chosen location matches
     that location OR an unassigned one. The same compromise the inter company
     item lookup makes, and for the same reason.

     The financial year likewise: the opening stock was loaded with none (most
     barcodes carry ''), and a barcode lives on from one year into the next -
     so a chosen year matches that year OR an unrecorded one. Strictly, a
     series of opening-stock barcodes would find nothing at all. */
  const filter = {};
  if (businessId) filter.businessId = String(businessId);

  /* THE BARCODE: a whole barcode number - one a barcode of this business has,
     wherever it is - is that barcode; anything else is the start of a series.
     Decided from the number alone, before the item code / location / year
     narrow the rows: what the typed text means does not change with them. */
  let mode = '';
  if (barcode) {
    const whole = { $regex: '^' + escapeRegex(barcode) + '$', $options: 'i' };
    mode = (await BarcodeLabel.exists({ ...filter, barcodeNo: whole })) ? 'exact' : 'series';
    /* the series: the barcode NUMBER from its start - "6A" is the 6A series */
    filter.barcodeNo = mode === 'exact' ? whole : { $regex: '^' + escapeRegex(barcode), $options: 'i' };
  }
  if (itemCode) filter.itemCode = { $regex: escapeRegex(itemCode), $options: 'i' };
  if (finYear) filter.finYear = { $in: [finYear, '', null] };
  if (locationId) filter.locationId = { $in: [String(locationId), '', null] };

  /* the whole result, light: what the count, the order, the totals and the
     page are all cut from */
  const list = await BarcodeLabel.find(filter).select('barcodeNo qty finalNet createdAt').lean();
  list.sort(barcode ? byBarcodeNumber : newestFirst);

  const total = list.length;
  const pages = everything ? 1 : Math.max(1, Math.ceil(total / perPage));
  const slice = everything ? list.slice(0, EXPORT_MAX) : list.slice((page - 1) * perPage, page * perPage);

  /* only the rows answered are read in full - in the list's order. The list
     never carries an imported unit's history - that is the Details screen's
     (/api/reports/barcode-detail) */
  const full = slice.length
    ? await BarcodeLabel.find({ _id: { $in: slice.map((r) => r._id) } })
      .select('-sourceMovements -sourceStock -sourceTotals -sourcePayload -customFields')
      .lean()
    : [];
  const fullById = new Map(full.map((r) => [String(r._id), r]));
  const rows = slice.map((r) => fullById.get(String(r._id))).filter(Boolean);

  /* Group / Sub Group are the ITEM's masters - a barcode keeps none of its
     own - and Supplier is the supplier master's name */
  const ids = (values) => [...new Set(values.filter((id) => id && isValidObjectId(String(id))).map(String))];
  const items = await Item.find({ _id: { $in: ids(rows.map((r) => r.itemId)) } }).select('subGroupId').lean();
  const subs = await ProductGroup.find({ _id: { $in: ids(items.map((i) => i.subGroupId)) } }).select('name parentId').lean();
  const parents = await ProductGroup.find({ _id: { $in: ids(subs.map((s) => s.parentId)) } }).select('name').lean();
  const suppliers = await Supplier.find({ _id: { $in: ids(rows.map((r) => r.supplierId)) } }).select('businessName contactId').lean();
  const subOfItem = new Map(items.map((i) => [String(i._id), String(i.subGroupId || '')]));
  const subById = new Map(subs.map((s) => [String(s._id), s]));
  const groupName = new Map(parents.map((p) => [String(p._id), p.name || '']));
  const supplierName = new Map(suppliers.map((s) => [String(s._id), s.businessName || '']));

  /* the GRC each barcode was received on */
  const grcIds = [...new Set(
    rows.map((r) => r.grcId).filter((id) => id && isValidObjectId(String(id)))
  )];
  const grcs = grcIds.length
    ? await Grc.find({ _id: { $in: grcIds } }).select('grcNumber').lean()
    : [];
  const grcNoById = new Map(grcs.map((g) => [String(g._id), g.grcNumber || '']));

  const mapped = rows.map((r) => ({
    _id: String(r._id),
    /* THE BARCODE: the unit's own number ("8A1881") - the composed reference
       stands in only for a row that has no number at all */
    barcodeNo: r.barcodeNo || canonicalBarcodeValue(r.barcodeGenerated) || '',
    /* the composed reference, kept apart ("G1093*05079*5*5", the spelling
       the label prints) - not shown as the barcode */
    barcodeGenerated: canonicalBarcodeValue(r.barcodeGenerated) || '',
    itemCode: r.itemCode || '',
    description: r.printDescription || r.supplierDescription || '',
    subGroup: subById.get(subOfItem.get(String(r.itemId)))?.name || '',
    group: groupName.get(String(subById.get(subOfItem.get(String(r.itemId)))?.parentId || '')) || '',
    designNo: r.designNo || '',
    supplier: supplierName.get(String(r.supplierId)) || '',
    qty: num(r.qty),
    uom: r.uom || '',
    hsn: r.hsn || '',
    purRate: num(r.purRate),
    finalNet: num(r.finalNet),
    gst: num(r.gst),
    retailPrice: num(r.retailPrice),
    offerPrice: num(r.offerPrice),
    wspPrice: num(r.wspPrice),
    dpPrice: num(r.dpPrice),
    /* a unit imported from the other ERP's report has no GRC here - it keeps
       the GRC number it was received on over there */
    grcNo: grcNoById.get(String(r.grcId)) || r.grcNo || '',
  }));

  /* what the Barcode search was taken as, said beside the count - true
     whatever else (item code, location, year) narrowed the rows */
  const note = !barcode ? ''
    : mode === 'exact'
      ? (total ? `Barcode ${barcode} - that barcode only` : `Barcode ${barcode} exists, but not within these filters`)
      : (total ? `Series ${barcode} - barcodes beginning with ${barcode}` : `No barcode beginning with ${barcode} matches this search`);

  return json({
    tiles: {},
    sections: [{
      rows: mapped,
      count: total,
      totals: {
        qty: r2(list.reduce((a, r) => a + num(r.qty), 0)),
        /* value received = line rate x quantity, summed over the whole result
           set rather than the visible page */
        finalNet: r2(list.reduce((a, r) => a + num(r.finalNet) * num(r.qty), 0)),
      },
    }],
    total,
    pages,
    page: everything ? 1 : page,
    perPage: everything ? total : perPage,
    barcodeSearch: barcode ? { text: barcode, mode } : null,
    note,
  });
}
