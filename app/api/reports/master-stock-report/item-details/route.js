import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import { requireSession } from '@/lib/session';
import { BarcodeLabel } from '@/lib/barcodeLabel';
import Item from '@/models/Item';
import ProductGroup from '@/models/ProductGroup';
import Hsn from '@/models/Hsn';
import Uom from '@/models/Uom';
import Grc from '@/models/Grc';
import Delivery from '@/models/Delivery';
import CompanyLocation from '@/models/CompanyLocation';
import Transporter from '@/models/Transporter';

const json = (data, status = 200) => Response.json(data, { status });
const str = (value) => String(value ?? '').trim();

export async function GET(req) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const sp = new URL(req.url).searchParams;
  const business = str(sp.get('business'));
  const itemId = str(sp.get('itemId'));
  const itemCode = str(sp.get('itemCode'));
  const itemName = str(sp.get('itemName'));
  if (!business || !isValidObjectId(business)) return json({ error: 'A valid business is required.' }, 422);
  if (!itemId && !itemCode && !itemName) return json({ error: 'An item is required.' }, 422);

  await dbConnect();

  const identity = itemId && isValidObjectId(itemId)
    ? { _id: itemId, businessId: business }
    : {
      businessId: business,
      $or: [
        ...(itemCode ? [{ itemCode }] : []),
        ...(itemName ? [{ name: itemName }] : []),
      ],
    };
  const item = await Item.findOne(identity)
    .select('name itemCode subGroupId uomId hsnId uniqueBarcode itemType')
    .lean();
  if (!item) return json({ error: 'Item details were not found.' }, 404);

  const [group, hsn, uom] = await Promise.all([
    item.subGroupId && isValidObjectId(String(item.subGroupId))
      ? ProductGroup.findById(item.subGroupId).select('name').lean() : null,
    item.hsnId && isValidObjectId(String(item.hsnId))
      ? Hsn.findById(item.hsnId).select('code description').lean() : null,
    item.uomId && isValidObjectId(String(item.uomId))
      ? Uom.findById(item.uomId).select('name shortName').lean() : null,
  ]);

  const barcodeFilter = {
    businessId: business,
    ...(itemId && isValidObjectId(itemId)
      ? { $or: [{ itemId }, ...(itemCode ? [{ itemCode }] : []), ...(itemName ? [{ itemName }] : [])] }
      : { $or: [...(itemCode ? [{ itemCode }] : []), ...(itemName ? [{ itemName }] : [])] }),
  };
  const labels = await BarcodeLabel.find(barcodeFilter).select('grcId').lean();
  const grcIds = [...new Set(labels.map((label) => str(label.grcId)).filter(isValidObjectId))];
  const grcs = grcIds.length
    ? await Grc.find({ _id: { $in: grcIds }, businessId: business })
      .select('locationId grcNumber grcDate stockPointName lrTransactionId lrTransactionNo')
      .sort({ grcDate: -1 }).lean()
    : [];

  const deliveryIds = [...new Set(grcs.map((grc) => grc.lrTransactionId).filter(Boolean).map(String))];
  const deliveries = deliveryIds.length
    ? await Delivery.find({ _id: { $in: deliveryIds }, businessId: business })
      .select('transactionNo transactionDate lrNumber transporterId').lean()
    : [];
  const deliveryById = new Map(deliveries.map((delivery) => [String(delivery._id), delivery]));
  const locationIds = [...new Set(grcs.map((grc) => grc.locationId).filter(Boolean).map(String))];
  const locations = locationIds.length
    ? await CompanyLocation.find({ _id: { $in: locationIds } }).select('name').lean()
    : [];
  const locationById = new Map(locations.map((location) => [String(location._id), location.name]));
  const transporterIds = [...new Set(deliveries.map((delivery) => delivery.transporterId).filter(Boolean).map(String))];
  const transporters = transporterIds.length
    ? await Transporter.find({ _id: { $in: transporterIds } }).select('transporterName').lean()
    : [];
  const transporterById = new Map(transporters.map((transporter) => [String(transporter._id), transporter.transporterName]));

  return json({
    item: {
      name: str(item.name),
      group: str(group?.name),
      uom: str(uom?.shortName) || str(uom?.name),
      hsnCode: str(hsn?.code),
      hsnDescription: str(hsn?.description),
      itemType: str(item.itemType) || 'Simple',
      uniqueBarcode: str(item.uniqueBarcode) || 'No',
    },
    receipts: grcs.map((grc) => {
      const delivery = grc.lrTransactionId ? deliveryById.get(String(grc.lrTransactionId)) : null;
      return {
        location: locationById.get(String(grc.locationId)) || '',
        grcNo: str(grc.grcNumber),
        grcDate: grc.grcDate || null,
        stockPoint: str(grc.stockPointName),
        deliveryNo: str(delivery?.transactionNo),
        deliveryDate: delivery?.transactionDate || null,
        lrNo: str(delivery?.lrNumber) || str(grc.lrTransactionNo),
        transporter: delivery?.transporterId
          ? str(transporterById.get(String(delivery.transporterId)))
          : '',
      };
    }),
  });
}
