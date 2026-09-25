import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import PosInvoice from '@/models/PosInvoice';
import Business from '@/models/Business';
import CompanyLocation from '@/models/CompanyLocation';
import { Customer } from '@/lib/contacts';
import PosCounter from '@/models/PosCounter';
import StockAdjustment from '@/models/StockAdjustment';
import { requireSession } from '@/lib/session';
import { resolveRefLabels } from '@/lib/refLabels';
import { validate, escapeRegex } from '@/lib/validate';
import { nextDocNumber } from '@/lib/docnumber';
import {
  withTransaction, loadUnits, sellUnits, unitsByCode, InventoryError, BARCODE_STATUS,
} from '@/lib/inventory';
import { barcodeKey, sameBarcode } from '@/lib/barcodeValue';
import { handler } from '@/lib/apiError';
import { requirePermission, PERMISSIONS } from '@/lib/rbac';
import { screenDenial, SCREENS, ACTIONS as PERM } from '@/lib/screenPermission';

/* Permission gate for this screen.

   THE TILL ITSELF LIVES AT /admin/pos/add, not under this path, but it is
   the ADD screen of this list - so it answers to this screen's create.

   POS is also the fallback permission on three shared endpoints
   (ITEM_LOOKUP_SCREENS and BARCODE_LIST_SCREENS in lib/screenPermission.js),
   which answer to POS *read*. So a counter role needs read as well as
   create: without read it could raise a sale but not look an item up to put
   on it. Read is the ordinary grant for a till operator anyway - a cashier
   who may not see the day's bills is not a configuration anyone asks for.

   The older requirePermission(POS_SELL) check on POST stays exactly where it
   was. This layer only ever narrows, never widens. */
const POS = { screen: SCREENS.POS, label: 'POS bills' };
const FIELDS = [];

/* /api/sell-pos - list + create. */

const json = (d, s = 200) => Response.json(d, { status: s });
const PER_PAGE = 10;

export async function GET(req) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const sp = new URL(req.url).searchParams;
  await dbConnect();

  const page = Math.max(1, Number(sp.get('page') || 1));
  const perPage = Math.min(500, Number(sp.get('perPage') || PER_PAGE));

  /* Only refuses when this role has a saved permission matrix that
     withholds it - see lib/screenPermission.js. */
  const denied = await screenDenial({
    session, ...POS, action: PERM.READ, businessId: sp.get('business'),
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const filter = {};
  const b = sp.get('business'); if (b && isValidObjectId(b)) filter.businessId = b;
  const l = sp.get('location'); if (l && isValidObjectId(l)) filter.locationId = l;
  const y = sp.get('finYear'); if (y) filter.finYear = y;


  const from = sp.get('startDate');
  const to = sp.get('endDate');
  if (from) filter.date = { ...(filter.date || {}), $gte: new Date(from) };
  if (to) filter.date = { ...(filter.date || {}), $lte: new Date(to + 'T23:59:59') };

  /* "unconverted" upstream documents: a GRC with no purchase invoice yet, a
     GRT with no debit note yet. $eq: null matches missing AND null - passing
     '' here would be cast against an ObjectId path and throw. */
  const unconverted = sp.get('unconverted');
  if (unconverted) filter[unconverted] = { $eq: null };

  const search = (sp.get('search') || '').trim();
  if (search) {
    const rx = { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = [{ invoiceNo: rx }];
  }

  const total = await PosInvoice.countDocuments(filter);
  const rows = await PosInvoice.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * perPage)
    .limit(perPage)
    .lean();

  const [businesses, locations, customers, counters] = await Promise.all([
    Business.find({ _id: { $in: rows.map((r) => r.businessId).filter(Boolean) } }).select('_id name businessPrintName').lean(),
    CompanyLocation.find({ _id: { $in: rows.map((r) => r.locationId).filter(Boolean) } }).select('_id name businessPrintName').lean(),
    Customer.find({ _id: { $in: rows.map((r) => r.customerId).filter(Boolean) } }).select('_id businessName firstName middleName lastName billingMobile').lean(),
    PosCounter.find({ _id: { $in: rows.map((r) => r.counterId).filter(Boolean) } }).select('_id counterName').lean(),
  ]);
  const byId = (list) => new Map(list.map((item) => [String(item._id), item]));
  const businessById = byId(businesses);
  const locationById = byId(locations);
  const customerById = byId(customers);
  const counterById = byId(counters);

  return json({
    rows: rows.map((r) => {
      const customer = customerById.get(String(r.customerId));
      return {
        ...r,
        _id: String(r._id),
        businessName: businessById.get(String(r.businessId))?.name || businessById.get(String(r.businessId))?.businessPrintName || '',
        locationName: locationById.get(String(r.locationId))?.name || locationById.get(String(r.locationId))?.businessPrintName || '',
        counterName: counterById.get(String(r.counterId))?.counterName || '',
        customerName: customer ? customer.businessName || [customer.firstName, customer.middleName, customer.lastName].filter(Boolean).join(' ') : r.customerSnapshot?.businessName || [r.customerSnapshot?.firstName, r.customerSnapshot?.middleName, r.customerSnapshot?.lastName].filter(Boolean).join(' ') || 'Walk-in Customer',
        customerContact: r.customerContact || customer?.billingMobile || r.customerSnapshot?.billingMobile || '',
      };
    }),
    labels: await resolveRefLabels(rows),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / perPage)),
    perPage,
  });
}

/* handler() so a typed engine failure - an already-sold barcode, a lost race
   with another till - reaches the operator as its own message and status
   rather than an unhandled rejection. */
export const POST = handler(async (req) => {
  const session = await requirePermission(PERMISSIONS.POS_SELL);

  const body = await req.json();
  await dbConnect();

  /* Ahead of validate(), so a refused sale comes back as 403 "not allowed"
     rather than 422 "your cart is wrong". */
  const denied = await screenDenial({
    session, ...POS, action: PERM.CREATE, businessId: body.business,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const { errors, doc, ok } = validate(FIELDS, body.data || {});
  if (!ok) return json({ errors }, 422);
  if (body.business && isValidObjectId(body.business)) doc.businessId = body.business;
  if (body.location && isValidObjectId(body.location)) doc.locationId = body.location;
  if (body.finYear) doc.finYear = body.finYear;

  doc.date = body.data?.date ? new Date(body.data.date) : new Date();
  doc.customerId = body.data?.customerId && isValidObjectId(body.data.customerId) ? body.data.customerId : null;
  doc.customerContact = String(body.data?.customerContact || '');
  doc.counterId = body.data?.counterId && isValidObjectId(body.data.counterId) ? body.data.counterId : null;
  doc.billingType = String(body.data?.billingType || '');
  doc.exempted = String(body.data?.exempted || 'NO');

  /* Line items are normalised before they are stored. The till was writing
     `code` while every report reads `itemCode` (lib/reports.js lineItemCode),
     so no POS sale ever matched an item: outward stock came out as zero and
     the item-stock report showed closing stock equal to everything ever
     received. normaliseLines() writes both keys, so old screens that read
     `code` keep working and the reports start matching. */
  if (Array.isArray(body.data?.items)) doc.items = normaliseLines(body.data.items);
  if (Array.isArray(body.data?.payments)) doc.payments = body.data.payments;
  if (body.data?.customerSnapshot) doc.customerSnapshot = body.data.customerSnapshot;
  if (body.data?.sellNote !== undefined) doc.sellNote = body.data.sellNote;
  if (body.data?.staffNote !== undefined) doc.staffNote = body.data.staffNote;
  doc.shipping = Number(body.data?.shipping || 0);
  doc.totalAmount = Number(body.data?.totalAmount || 0);
  doc.paid = Number(body.data?.paid || 0);
  doc.sellDue = Math.max(0, doc.totalAmount - doc.paid);
  doc.paymentStatus = doc.sellDue === 0 ? 'Paid' : doc.paid > 0 ? 'Part Paid' : 'Unpaid';

  /* Barcoded lines are the ones that move stock. A line entered from the item
     master without a barcode still bills, but cannot decrement a specific
     unit - there is nothing physical to decrement. */
  const codes = [...new Set((doc.items || []).map((l) => String(l.barcodeNo || '').trim()).filter(Boolean))];

  const created = await withTransaction(async (dbSession) => {
    /* Re-read and re-check every barcode INSIDE the transaction. The till may
       have scanned it a minute ago; another counter may have sold it since.
       This is what stops the same unit being billed twice. */
    const units = codes.length
      ? await loadUnits(codes, { businessId: doc.businessId, session: dbSession })
      : [];

    /* a code may be any spelling the unit answers to - its own number, its
       composed value, its old barcode. Each code needs a unit of its own: a
       second code for a unit already on the bill (another spelling of it,
       its old barcode) has none left, and is refused rather than billed twice. */
    const unitOf = unitsByCode(codes, units);
    const missing = codes.filter((c, i) =>
      !unitOf.has(barcodeKey(c)) || codes.findIndex((d) => sameBarcode(d, c)) < i);
    if (missing.length) {
      throw new InventoryError('BARCODE_NOT_FOUND',
        'These barcodes are no longer in the system: ' + missing.slice(0, 8).join(', '),
        { status: 422, skipped: missing });
    }

    /* The line keeps the unit's own number, whatever spelling reached the
       till - returns and exchanges look the sale up by it. */
    (doc.items || []).forEach((l) => {
      const unit = l.barcodeNo ? unitOf.get(barcodeKey(l.barcodeNo)) : null;
      if (unit) l.barcodeNo = unit.barcodeNo || unit.barcodeGenerated || l.barcodeNo;
    });

    const unavailable = units.filter((u) => u.status && u.status !== BARCODE_STATUS.IN_STOCK);
    if (unavailable.length) {
      throw new InventoryError('BARCODE_UNAVAILABLE',
        unavailable.map((u) =>
          (u.barcodeNo || u.barcodeGenerated) +
          (u.status === BARCODE_STATUS.SOLD
            ? ' was already sold' + (u.billingNo ? ' on ' + u.billingNo : '')
            : ' is ' + String(u.status).toLowerCase().replace(/_/g, ' '))
        ).join('; ') + '.',
        { status: 409, skipped: unavailable.map((u) => u.barcodeNo || u.barcodeGenerated) });
    }

    if (!doc.invoiceNo) {
      doc.invoiceNo = await nextDocNumber(PosInvoice, 'invoiceNo', 'POS', {
        businessId: doc.businessId, locationId: doc.locationId, finYear: doc.finYear,
      });
    }

    const [invoice] = await PosInvoice.create([doc], dbSession ? { session: dbSession } : {});

    /* The write that was missing entirely: without it a barcode stayed in
       stock after being billed and could be sold again from another till. */
    if (units.length) {
      await sellUnits({
        units, invoice, locationId: doc.locationId, user: session, session: dbSession,
      });
    }

    /* Lines the operator ticked STOCK ISSUE on are also recorded as a Stock
       Adjustment, so they show on Inventory -> Stock Adjustment. One document
       per bill carrying only the ticked lines; an untouched line stays a
       plain sale and is not repeated here.

       DELIBERATELY NOT calling adjustStock(). That is what the manual
       adjustment screen does, and it is right there because nothing else has
       moved the stock yet. Here sellUnits() above has ALREADY taken these
       units out (IN_STOCK -> SOLD) and written their POS_OUT ledger rows, so
       adjusting again would remove the same stock twice and leave the
       movement ledger disagreeing with the barcode rows. This record is the
       register entry, not a second movement.

       Inside the same transaction as the invoice: a bill that rolls back must
       not leave an adjustment behind pointing at a sale that never happened. */
    const issueLines = (doc.items || []).filter((l) => l.stockIssue === true);
    if (issueLines.length) {
      const adjustmentNo = await nextDocNumber(
        StockAdjustment, 'adjustmentNo', 'Stock Adjustment',
        { businessId: doc.businessId, locationId: doc.locationId, finYear: doc.finYear },
        dbSession
      );

      await StockAdjustment.create([{
        businessId: doc.businessId,
        locationId: doc.locationId,
        finYear: doc.finYear,
        adjustmentNo,
        type: 'ISSUE',
        adjustmentReason: 'POS Stock Issue',
        adjustmentDate: doc.date,
        remarks: 'Auto-created from POS invoice ' + (invoice.invoiceNo || ''),
        createdBy: session?.name || session?.email || '',
        items: issueLines,
      }], dbSession ? { session: dbSession } : {});
    }

    return invoice;
  });

  return json({ ok: true, id: String(created._id), invoiceNo: created.invoiceNo });
});

/* Writes both key spellings, and carries the barcode through so the sale can
   be traced back to the physical unit and returned against it later. */
function normaliseLines(items) {
  return (items || []).map((l) => {
    const itemCode = String(l.itemCode ?? l.code ?? l['Item Code'] ?? '').trim();
    const qty = Number(l.qty ?? l.Qty ?? l.QTY ?? 1) || 1;
    const rate = Number(l.rsp ?? l.rate ?? l.price ?? 0) || 0;
    const discountPct = Number(l.discountPct ?? 0) || 0;
    const gross = rate * qty;
    const netAmount = Math.round((gross - (gross * discountPct) / 100) * 100) / 100;

    return {
      ...l,
      itemCode,
      code: itemCode || l.code || '',
      itemName: l.itemName || l.name || '',
      barcodeNo: String(l.barcodeNo || l.barcode || '').trim(),
      qty,
      rate,
      netAmount,
    };
  });
}
