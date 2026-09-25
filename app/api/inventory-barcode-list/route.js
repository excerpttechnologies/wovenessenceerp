import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import Grc from '@/models/Grc';
import Grt from '@/models/Grt';
import { BarcodeLabel } from '@/lib/barcodeLabel';
import { requireSession } from '@/lib/session';
import { screenDenialAny, ACTIONS as PERM, BARCODE_LIST_SCREENS } from '@/lib/screenPermission';
import { escapeRegex } from '@/lib/validate';
import { imageUrl } from '@/lib/inventory';
import { barcodeSearchPattern } from '@/lib/barcodeValue';

/* /api/inventory-barcode-list - read-only list for Inventory > Barcode Item.
   Separate from /api/barcodeitem on purpose (that route/model is left
   untouched). Sourced from BarcodeLabel, the collection barcode-generation
   actually writes rows into, joined back to Grc for the GRC number. */

const json = (d, s = 200) => Response.json(d, { status: s });
const PER_PAGE = 10;

export async function GET(req) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  await dbConnect();
  const sp = new URL(req.url).searchParams;

  const page = Math.max(1, Number(sp.get('page') || 1));
  const perPage = Math.min(500, Number(sp.get('perPage') || PER_PAGE));

  const business = sp.get('business');
  const location = sp.get('location');

  /* Barcode Item read, or POS read - see BARCODE_LIST_SCREENS. Only
     refuses when the role has a saved matrix withholding both.
     lib/screenPermission.js. */
  const denied = await screenDenialAny({
    session, screens: BARCODE_LIST_SCREENS, action: PERM.READ,
    businessId: sp.get('business'), label: 'barcode items',
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const filter = {};
  if (business && isValidObjectId(business)) filter.businessId = business;
  if (location && isValidObjectId(location)) filter.locationId = location;

  const returnedFilter = {};
  if (business && isValidObjectId(business)) returnedFilter.businessId = business;
  if (location && isValidObjectId(location)) returnedFilter.locationId = location;
  const returnedGrts = await Grt.find(returnedFilter).select('items').lean();
  const returnedItems = returnedGrts.flatMap((grt) => Array.isArray(grt.items) ? grt.items : []);
  const returnedIds = returnedItems.map((item) => String(item._id || '')).filter(Boolean);
  const returnedBarcodes = returnedItems.map((item) => item.barcodeGenerated || item.barcodeNo).filter(Boolean);
  if (returnedIds.length) filter._id = { $nin: returnedIds };
  if (returnedBarcodes.length) filter.barcodeGenerated = { $nin: returnedBarcodes };

  /* groupId / subGroupId both point at the same product-group collection on
     the filter panel, but BarcodeLabel only carries one groupId field today.
     subGroupId, if given, is treated as the more specific selection. */
  const groupId = sp.get('groupId');
  const subGroupId = sp.get('subGroupId');
  if (subGroupId) filter.groupId = subGroupId;
  else if (groupId) filter.groupId = groupId;

  /* No real itemId ref stored on BarcodeLabel - itemCode is free text from
     the barcode-generation screen, so match against that. */
  const itemId = sp.get('itemId');
  if (itemId) filter.itemCode = itemId;

  const rspStart = sp.get('rspStart');
  const rspEnd = sp.get('rspEnd');
  if (rspStart || rspEnd) {
    filter.retailPrice = {};
    if (rspStart) filter.retailPrice.$gte = Number(rspStart);
    if (rspEnd) filter.retailPrice.$lte = Number(rspEnd);
  }

  const cpStart = sp.get('cpStart');
  const cpEnd = sp.get('cpEnd');
  if (cpStart || cpEnd) {
    filter.finalNet = {};
    if (cpStart) filter.finalNet.$gte = Number(cpStart);
    if (cpEnd) filter.finalNet.$lte = Number(cpEnd);
  }

  const barcodeStart = sp.get('barcodeStart');
  const barcodeEnd = sp.get('barcodeEnd');
  /* the "Barcode No" Start / End filter - on the stored barcodeNo */
  if (barcodeStart || barcodeEnd) {
    filter.barcodeNo = {};
    if (barcodeStart) filter.barcodeNo.$gte = barcodeStart;
    if (barcodeEnd) filter.barcodeNo.$lte = barcodeEnd;
  }

  const search = (sp.get('search') || '').trim();
  if (search) {
    const rx = { $regex: escapeRegex(search), $options: 'i' };
    /* a barcode may be typed with or without the spaces around '*' */
    const barcodeRx = { $regex: barcodeSearchPattern(search), $options: 'i' };
    filter.$or = [
      { barcodeNo: barcodeRx },
      { barcodeGenerated: barcodeRx },
      { oldBarcode: barcodeRx },
      { itemCode: rx },
      { printDescription: rx },
      { supplierDescription: rx },
      { retailPrice: rx },
      { finalNet: rx },
      { offerPrice: rx },
      { wspPrice: rx },
    ];
  }

  /* supplierId and grcNo both live on the parent Grc doc - resolve matching
     grc ids first, then constrain BarcodeLabel.grcId to that set. */
  const supplierId = sp.get('supplierId');
  const grcNo = (sp.get('grcNo') || '').trim();
  if (supplierId || grcNo) {
    const grcFilter = {};
    if (supplierId && isValidObjectId(supplierId)) grcFilter.supplierId = supplierId;
    if (grcNo) grcFilter.grcNumber = { $regex: escapeRegex(grcNo), $options: 'i' };
    if (business && isValidObjectId(business)) grcFilter.businessId = business;
    if (location && isValidObjectId(location)) grcFilter.locationId = location;

    const matches = await Grc.find(grcFilter).select('_id').lean();
    filter.grcId = { $in: matches.map((g) => String(g._id)) };
  }

  const total = await BarcodeLabel.countDocuments(filter);
  const rows = await BarcodeLabel.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * perPage)
    .limit(perPage)
    .lean();

  /* join grcNumber back in for display */
  const grcIds = [...new Set(rows.map((r) => r.grcId).filter(Boolean))];
  const grcs = grcIds.length
    ? await Grc.find({ _id: { $in: grcIds } }).select('_id grcNumber').lean()
    : [];
  const grcNumberById = Object.fromEntries(grcs.map((g) => [String(g._id), g.grcNumber]));

  return json({
    rows: rows.map((r) => ({
      _id: String(r._id),
      /* Barcode No is the stored barcodeNo ("9A1163"); the composed
         barcodeGenerated ("G1319 * 05183 * 1 * 1") comes back as itself */
      barcodeNo: r.barcodeNo || '',
      barcodeGenerated: r.barcodeGenerated || '',
      itemCode: r.itemCode || '',
      itemId: r.printDescription || r.supplierDescription || r.itemCode || '',
      description: r.printDescription || r.supplierDescription || '',
      hsn: r.hsn || '',
      gst: Number(String(r.gst || '').match(/[\d.]+/)?.[0] || 0),
      quantity: Number(r.qty) || 0,
      rsp: Number(r.retailPrice) || 0,
      cp: Number(r.finalNet || r.purRate) || 0,
      grcNo: grcNumberById[r.grcId] || '',
      /* The mobile app writes the staff-uploaded photo straight onto the
         barcode row, so it arrives with the row - no join, no second
         collection. Units that never got one fall back to the photo shipped
         under public/ for that barcode. */
      productImageUrl: imageUrl(r.imageUrl || r.filePath || '', r.barcodeGenerated || r.barcodeNo, r.oldBarcode),
    })),
    labels: {},
    total,
    page,
    pages: Math.max(1, Math.ceil(total / perPage)),
    perPage,
  });

  
}

/* was a byte-for-byte copy of lib/inventory's imageUrl() - it has since grown
   the public/ barcode-photo fallback, and a second copy would not have it */