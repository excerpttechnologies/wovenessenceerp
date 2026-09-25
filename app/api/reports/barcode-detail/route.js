import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import { BarcodeLabel } from '@/lib/barcodeLabel';
import StockMovement from '@/models/StockMovement';
import Item from '@/models/Item';
import CompanyLocation from '@/models/CompanyLocation';
import { Supplier } from '@/lib/contacts';
import { requireSession } from '@/lib/session';
import { barcodeFilter } from '@/lib/inventory';

/* /api/reports/barcode-detail?barcodeNo=<no>&business=<id>

   ONE BARCODE, IN FULL: the row itself, the names behind its ids, and every
   movement it has ever been part of. This is what the Barcode Report shows
   when it is opened from a barcode link on the Master Stock Report.

   Separate from /api/reports/barcode-report, which lists MANY barcodes for one
   item code. That one answers "what barcodes does this item have"; this one
   answers "what has happened to this piece". */

const json = (d, s = 200) => Response.json(d, { status: s });
const str = (v) => String(v ?? '').trim();

export async function GET(req) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const sp = new URL(req.url).searchParams;
  const code = str(sp.get('barcodeNo'));
  if (!code) return json({ error: 'No barcode given.' }, 400);

  await dbConnect();

  const business = sp.get('business');

  /* Matched on every spelling the number can take - its own number, the
     composed value the bars carry, or the vendor's old printed one - which is
     the same rule the till scans by. See lib/barcodeValue. */
  const unit = await BarcodeLabel.findOne({
    ...barcodeFilter([code]),
    ...(business && isValidObjectId(business) ? { businessId: business } : {}),
  }).lean();

  if (!unit) return json({ error: 'Barcode ' + code + ' was not found.' }, 404);

  /* The labels behind the ids. Each is optional: a row whose item or location
     has since been deleted still has to render, so a missing name falls back
     to what the barcode row itself carries. */
  const [item, currentLoc, originLoc, supplier] = await Promise.all([
    unit.itemId && isValidObjectId(String(unit.itemId))
      ? Item.findById(unit.itemId).select('name itemCode description imageUrl').lean() : null,
    /* currentLocationId is where the piece is NOW; locationId is where it was
       generated, which the screen shows as its origin. */
    unit.currentLocationId && isValidObjectId(String(unit.currentLocationId))
      ? CompanyLocation.findById(unit.currentLocationId).select('name').lean() : null,
    unit.locationId && isValidObjectId(String(unit.locationId))
      ? CompanyLocation.findById(unit.locationId).select('name').lean() : null,
    unit.supplierId && isValidObjectId(String(unit.supplierId))
      ? Supplier.findById(unit.supplierId).select('businessName firstName lastName contactId').lean() : null,
  ]);

  /* The trail, oldest first - it reads as a story that way, and the running
     balance below only makes sense in that order. Matched on the barcode row's
     id when there is one and on the number as well, because movements written
     before the id was denormalised carry only the number. */
  const movements = await StockMovement.find({
    $or: [
      ...(unit._id ? [{ barcodeId: unit._id }] : []),
      { barcodeNo: str(unit.barcodeNo) || code },
    ],
  }).sort({ createdAt: 1 }).lean();

  const locIds = [...new Set(
    movements.flatMap((m) => [m.fromLocationId, m.toLocationId])
      .filter((v) => v && isValidObjectId(String(v)))
      .map(String)
  )];
  const locs = locIds.length
    ? await CompanyLocation.find({ _id: { $in: locIds } }).select('name').lean()
    : [];
  const locName = new Map(locs.map((l) => [String(l._id), l.name]));

  /* Receipts and issues are the two halves of the signed qty the ledger
     stores, and the balance is their running sum - so the last row of the
     table is the quantity the barcode holds today. */
  let balance = 0;
  const rows = movements.map((m) => {
    const qty = Number(m.qty || 0);
    balance += qty;
    const at = qty >= 0 ? m.toLocationId : m.fromLocationId;
    return {
      _id: String(m._id),
      location: locName.get(String(at)) || '',
      docDate: m.createdAt || null,
      docNo: m.refNo || '',
      message: m.type || '',
      stockPoint: m.stockPoint || m.reason || '',
      receipts: qty > 0 ? qty : null,
      issues: qty < 0 ? Math.abs(qty) : null,
      balanceQty: balance,
      finalPrice: Number(unit.purRate || 0),
      netAmount: Math.abs(qty) * Number(unit.purRate || 0),
    };
  });

  const supplierName = supplier
    ? [supplier.businessName || [supplier.firstName, supplier.lastName].filter(Boolean).join(' ')]
      .filter(Boolean)
      .concat(supplier.contactId ? ['[' + supplier.contactId + ']'] : [])
      .join(' ')
    : str(unit.supplierId);

  return json({
    detail: {
      itemName: item?.name || str(unit.itemName) || str(unit.itemCode),
      itemCode: str(unit.itemCode) || item?.itemCode || '',
      barcodeNo: str(unit.barcodeNo),
      barcodeGenerated: str(unit.barcodeGenerated),
      description: str(unit.printDescription) || str(unit.supplierDescription)
        || item?.description || '',
      hsn: str(unit.hsn),
      gst: unit.gst ?? '',
      uom: str(unit.uom),
      status: str(unit.status),
      quantity: Number(unit.qty || 0),
      imageUrl: str(unit.imageUrl) || item?.imageUrl || '',

      purchaseRate: unit.purRate ?? null,
      rsp: unit.retailPrice ?? null,
      offerPrice: unit.offerPrice ?? null,
      wsp: unit.wspPrice ?? null,

      supplierName,
      currentLocation: currentLoc?.name || '',
      originLocation: originLoc?.name || '',
      grcNo: str(unit.grcNo),
      grcDate: unit.createdAt || null,
      serialNo: unit.serialNo ?? unit.billSlNo ?? '',
      batchNo: str(unit.batchNo),
      transferNo: str(unit.transferNo),
      billingNo: str(unit.billingNo),
    },
    movements: rows,
  });
}
