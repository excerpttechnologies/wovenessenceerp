import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import { Supplier } from '@/lib/contacts';
import Grc from '@/models/Grc';
import CompanyLocation from '@/models/CompanyLocation';
import StockPoint from '@/models/StockPoint';
import { requireSession } from '@/lib/session';

const json = (data, status = 200) => Response.json(data, { status });
const str = (value) => String(value ?? '').trim();

export async function GET(req) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const sp = new URL(req.url).searchParams;
  const business = str(sp.get('business'));
  const supplierId = str(sp.get('supplierId'));
  const supplierCode = str(sp.get('supplierCode'));
  const requestedPage = Number(sp.get('page') || 1);
  const requestedPerPage = Number(sp.get('perPage') || 15);
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
  const perPage = Number.isFinite(requestedPerPage)
    ? Math.min(50, Math.max(1, Math.floor(requestedPerPage)))
    : 15;

  if (!isValidObjectId(business)) return json({ error: 'A valid business is required.' }, 422);
  if ((!supplierId || !isValidObjectId(supplierId)) && !supplierCode) {
    return json({ error: 'A valid supplier is required.' }, 422);
  }

  await dbConnect();

  const supplierQuery = supplierId && isValidObjectId(supplierId)
    ? {
      _id: supplierId,
      $or: [
        { businessId: business },
        { businessId: null },
        { businessId: { $exists: false } },
      ],
    }
    : { contactId: supplierCode, businessId: business };
  const supplier = await Supplier.findOne(supplierQuery)
    .select('contactId businessName prefix firstName middleName lastName gstStatus billingMobile shippingMobile')
    .lean();
  if (!supplier) return json({ error: 'Supplier details were not found for this business.' }, 404);

  const contactName = [str(supplier.prefix), str(supplier.firstName), str(supplier.middleName), str(supplier.lastName)]
    .filter(Boolean).join(' ');
  const legalName = str(supplier.businessName) || contactName;
  const filter = { businessId: business, supplierId: supplier._id };
  const total = await Grc.countDocuments(filter);
  const grcs = await Grc.find(filter)
    .select('locationId grcNumber grcDate stockPointId stockPointName')
    .sort({ grcDate: -1, _id: -1 })
    .skip((page - 1) * perPage)
    .limit(perPage)
    .lean();

  const locationIds = [...new Set(grcs.map((grc) => grc.locationId).filter(Boolean).map(String))];
  const stockPointIds = [...new Set(grcs.map((grc) => grc.stockPointId).filter(Boolean).map(String))];
  const [locations, stockPoints] = await Promise.all([
    locationIds.length
      ? CompanyLocation.find({ _id: { $in: locationIds } }).select('name').lean()
      : [],
    stockPointIds.length
      ? StockPoint.find({ _id: { $in: stockPointIds } }).select('stockPoint').lean()
      : [],
  ]);
  const locationName = new Map(locations.map((location) => [String(location._id), str(location.name)]));
  const stockPointName = new Map(stockPoints.map((stockPoint) => [String(stockPoint._id), str(stockPoint.stockPoint)]));

  return json({
    supplier: {
      supplierNo: str(supplier.contactId),
      legalName,
      contactPerson: contactName,
      gstStatus: str(supplier.gstStatus) || 'NOT SPECIFIED',
      mobile: str(supplier.billingMobile) || str(supplier.shippingMobile),
    },
    transactions: grcs.map((grc) => ({
      location: locationName.get(String(grc.locationId)) || '',
      docNo: str(grc.grcNumber),
      docDate: grc.grcDate || null,
      stockPoint: str(grc.stockPointName) || stockPointName.get(String(grc.stockPointId)) || '',
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / perPage)),
    perPage,
  });
}
