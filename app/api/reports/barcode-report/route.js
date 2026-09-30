// import { isValidObjectId } from 'mongoose';
// import dbConnect from '@/lib/db';
// import { requireSession } from '@/lib/session';
// import { escapeRegex } from '@/lib/validate';
// import { BarcodeLabel } from '@/lib/barcodeLabel';
// import { canonicalBarcodeValue } from '@/lib/barcodeValue';
// import Grc from '@/models/Grc';
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

//   const rows = await BarcodeLabel.find(filter).sort({ createdAt: -1 }).limit(5000).lean();

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
//     barcodeGenerated: canonicalBarcodeValue(r.barcodeGenerated),
//     itemCode: r.itemCode || '',
//     description: r.printDescription || r.supplierDescription || '',
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
//     grcNo: grcNoById.get(String(r.grcId)) || '',
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
import { json, num, r2, scopeOf, pageOf, paged } from '@/lib/reports';

/* /api/reports/barcode-report - read-only.

   Every barcode row generated for one item code, with the rate it was
   received at and the four prices printed on its label.

   Item Code is required: this reads the barcode collection one item at a
   time rather than dumping it, which is what the deployed screen does. */

export async function GET(req) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const sp = new URL(req.url).searchParams;
  await dbConnect();

  const { businessId, locationId, finYear } = scopeOf(sp);
  const { page, perPage } = pageOf(sp);

  const itemCode = String(sp.get('itemCode') || '').trim();
  if (!itemCode) return json({ error: 'Item Code is required.' }, 422);

  /* BarcodeLabel stores its scope as plain strings, and locationId is very
     often blank - the barcode screen does not always set it. Filtering
     strictly on a location would hide real rows, so a chosen location matches
     that location OR an unassigned one. The same compromise the inter company
     item lookup makes, and for the same reason. */
  const filter = { itemCode: { $regex: escapeRegex(itemCode), $options: 'i' } };
  if (businessId) filter.businessId = String(businessId);
  if (finYear) filter.finYear = finYear;
  if (locationId) filter.locationId = { $in: [String(locationId), '', null] };

  /* the list never carries an imported unit's history - that is the Details
     screen's (/api/reports/barcode-detail) */
  const rows = await BarcodeLabel.find(filter)
    .select('-sourceMovements -sourceStock -sourceTotals -sourcePayload -customFields')
    .sort({ createdAt: -1 }).limit(5000).lean();

  /* Group / Sub Group are the ITEM's masters - a barcode keeps none of its
     own - and Supplier is the supplier master's name */
  const ids = (list) => [...new Set(list.filter((id) => id && isValidObjectId(String(id))).map(String))];
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
    /* shown - and exported - in the spelling the label prints and the bars
       encode ("G1318*05178*1*1"); the stored value is not touched */
    barcodeGenerated: canonicalBarcodeValue(r.barcodeGenerated) || r.barcodeNo || '',
    barcodeNo: r.barcodeNo || '',
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

  const p = paged(mapped, page, perPage);

  return json({
    tiles: {},
    sections: [{
      rows: p.rows,
      count: p.total,
      totals: {
        qty: r2(mapped.reduce((a, r) => a + r.qty, 0)),
        /* value received = line rate x quantity, summed over the whole result
           set rather than the visible page */
        finalNet: r2(mapped.reduce((a, r) => a + r.finalNet * r.qty, 0)),
      },
    }],
    total: p.total,
    pages: p.pages,
    page,
    perPage,
  });
}
