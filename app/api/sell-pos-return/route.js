import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import PosReturn from '@/models/PosReturn';
import PosInvoice from '@/models/PosInvoice';
import { requireSession } from '@/lib/session';
import { resolveRefLabels } from '@/lib/refLabels';
import { escapeRegex } from '@/lib/validate';
import { nextDocNumber } from '@/lib/docnumber';
import { handler } from '@/lib/apiError';
import { requirePermission, PERMISSIONS } from '@/lib/rbac';
import { screenDenial, SCREENS, ACTIONS as PERM } from '@/lib/screenPermission';

/* Permission gate for this screen.

   The return counter lives at /admin/transaction/sell/pos-return/add - the
   ADD screen of this list, so it answers to this screen's create.

   DELIBERATELY NOT ALSO GATED ON POS. A return is taken against a sale, so
   the screen has to show the parent bill; requiring POS read on top would
   mean nobody could work the returns counter without also being given the
   day's sales list. Taking returns and browsing sales are different jobs.

   The older requirePermission(POS_RETURN) checks stay exactly where they
   are. This layer only ever narrows, never widens. */
const POS_RETURN = { screen: SCREENS.POS_RETURN, label: 'POS returns' };
import {
  withTransaction, loadUnits, returnSoldUnits, barcodeCandidates, linesAnswering, lineBarcodeSpellings,
  unitsByCode, InventoryError, BARCODE_STATUS,
} from '@/lib/inventory';
import { barcodeKey, sameBarcode } from '@/lib/barcodeValue';

/* /api/sell-pos-return - list + create. */

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
    session, ...POS_RETURN, action: PERM.READ, businessId: sp.get('business'),
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const filter = {};
  const b = sp.get('business'); if (b && isValidObjectId(b)) filter.businessId = b;
  const l = sp.get('location'); if (l && isValidObjectId(l)) filter.locationId = l;
  const y = sp.get('finYear'); if (y) filter.finYear = y;


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

  const total = await PosReturn.countDocuments(filter);
  const rows = await PosReturn.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * perPage)
    .limit(perPage)
    .lean();

  return json({
    rows: rows.map((r) => ({ ...r, _id: String(r._id) })),
    labels: await resolveRefLabels(rows),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / perPage)),
    perPage,
  });
}

/* POST /api/sell-pos-return
   { business, location, finYear, data: { parentInvoiceId, barcodes[], reason,
     notes, refundMode } }

   The customer return / refund flow, which was previously a stub that wrote
   whatever it was handed and touched neither stock nor the original sale.

   What it now enforces, in this order:

     1. the original invoice exists and belongs to this business
     2. every barcode being returned was sold ON THAT INVOICE
     3. none of them has already been credited on an earlier return
     4. the refund cannot exceed what was actually charged for those lines

   Rules 2 and 3 together are what make "more quantity returned than was
   sold" and "the same unit refunded twice" impossible - and because a line
   IS a barcode, the check is exact rather than a running quantity total that
   can be argued with.

   The units go back into sellable stock in the same transaction as the credit
   note, so a refund can never leave stock unaccounted for. */
export const POST = handler(async (req) => {
  const body = await req.json().catch(() => ({}));
  const data = body?.data || {};
  const session = await requirePermission(PERMISSIONS.POS_RETURN, { locationId: body.business ? data.locationId : null });
  await dbConnect();

  /* Ahead of every field check below, so a refused refund comes back as 403
     "not allowed" rather than 422 "pick an invoice first". */
  const denied = await screenDenial({
    session, ...POS_RETURN, action: PERM.CREATE, businessId: body.business,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const businessId = isValidObjectId(body.business) ? body.business : null;
  const locationId = isValidObjectId(body.location) ? body.location : null;

  const parentId = data.parentInvoiceId;
  if (!isValidObjectId(parentId)) {
    return json({ errors: { parentInvoiceId: 'Choose the invoice being returned against.' } }, 422);
  }

  const scanned = [...new Set((data.barcodes || []).map((c) => String(c || '').trim()).filter(Boolean))];
  if (!scanned.length) {
    return json({ errors: { barcodes: 'Scan or select the items being returned.' } }, 422);
  }

  const reason = String(data.reason || '').trim();
  if (!reason) return json({ errors: { reason: 'Give a reason for the return.' } }, 422);

  const invoice = await PosInvoice.findById(parentId).lean();
  if (!invoice) return json({ errors: { parentInvoiceId: 'That invoice was not found.' } }, 422);
  if (businessId && String(invoice.businessId) !== String(businessId)) {
    return json({ errors: { parentInvoiceId: 'That invoice belongs to a different business.' } }, 422);
  }

  /* --- rule 2: everything being returned must be on the invoice ---------- */
  const soldLines = new Map(
    (invoice.items || [])
      .filter((l) => l.barcodeNo)
      .map((l) => [String(l.barcodeNo), l])
  );
  /* A line stores the unit's own number; a scanned label may carry its
     composed value or its old barcode. Each scanned code is matched to its
     line, and from here on stands for that line's own number. */
  const barcodeLines = [...soldLines.values()];
  const candidates = await barcodeCandidates(scanned, {
    businessId: businessId || invoice.businessId,
    lines: barcodeLines,
  });
  const lineOf = (c) => linesAnswering(barcodeLines, c, candidates)[0];
  const notOnInvoice = scanned.filter((c) => !lineOf(c));
  const codes = [...new Set(scanned.map((c) => lineOf(c)?.barcodeNo).filter(Boolean).map(String))];
  if (notOnInvoice.length) {
    return json({
      error: 'Not sold on invoice ' + invoice.invoiceNo + ': ' + notOnInvoice.slice(0, 8).join(', ')
        + '. A unit can only be returned against the invoice it was sold on.',
      code: 'NOT_ON_INVOICE',
      skipped: notOnInvoice,
    }, 422);
  }

  /* --- rule 3: not already credited ------------------------------------- */
  const priorReturns = await PosReturn.find({ parentInvoiceId: parentId }).select('items invoiceNo').lean();
  const alreadyReturned = new Map();
  priorReturns.forEach((r) => (r.items || []).forEach((l) => {
    if (l.barcodeNo) alreadyReturned.set(barcodeKey(l.barcodeNo), r.invoiceNo);
  }));
  const duplicates = codes.filter((c) => alreadyReturned.has(barcodeKey(c)));
  if (duplicates.length) {
    return json({
      error: 'Already returned: ' + duplicates.map((c) => c + ' (on ' + alreadyReturned.get(barcodeKey(c)) + ')').slice(0, 6).join(', ') + '.',
      code: 'ALREADY_RETURNED',
      skipped: duplicates,
    }, 409);
  }

  /* --- the money, computed from the original lines ---------------------- */
  const lines = codes.map((c) => {
    const sold = soldLines.get(c);
    const qty = Number(sold.qty) || 1;
    const rate = Number(sold.rate ?? sold.rsp ?? 0) || 0;
    const discountPct = Number(sold.discountPct || 0) || 0;
    const gross = rate * qty;
    const net = round2(gross - (gross * discountPct) / 100);
    return {
      barcodeNo: c,
      itemCode: sold.itemCode || sold.code || '',
      code: sold.itemCode || sold.code || '',
      itemName: sold.itemName || sold.name || '',
      description: sold.description || '',
      hsn: sold.hsn || '',
      gst: Number(sold.gst || 0),
      uom: sold.uom || '',
      qty,
      rate,
      rsp: Number(sold.rsp ?? rate) || 0,
      discountPct,
      netAmount: net,
      image: sold.image || '',
    };
  });

  const refundable = round2(lines.reduce((a, l) => a + l.netAmount * (1 + (l.gst || 0) / 100), 0));

  /* --- rule 4: never refund more than was charged ----------------------- */
  const asked = data.refundAmount === undefined || data.refundAmount === ''
    ? refundable
    : round2(Number(data.refundAmount) || 0);
  if (asked > refundable) {
    return json({
      errors: { refundAmount: 'The refund cannot exceed ' + refundable.toFixed(2) + ', which is what these items were billed at.' },
    }, 422);
  }
  if (asked < 0) return json({ errors: { refundAmount: 'The refund cannot be negative.' } }, 422);

  const created = await withTransaction(async (dbSession) => {
    /* re-check inside the transaction: another till may have credited the
       same unit while this form was open */
    const clash = await PosReturn.findOne({
      parentInvoiceId: parentId,
      'items.barcodeNo': { $in: lineBarcodeSpellings(codes) },
    }).session(dbSession || null).lean();
    if (clash) {
      throw new InventoryError('ALREADY_RETURNED',
        'One of those items was credited on ' + clash.invoiceNo + ' a moment ago. Reload and try again.',
        { status: 409 });
    }

    const units = await loadUnits(codes, { businessId, session: dbSession, prefer: BARCODE_STATUS.SOLD });
    /* each line needs a unit of its own - two lines that resolve to one
       unit would refund it twice */
    const unitOf = unitsByCode(codes, units);
    const missing = codes.filter((c, i) =>
      !unitOf.has(barcodeKey(c)) || codes.findIndex((d) => sameBarcode(d, c)) < i);
    if (missing.length) {
      throw new InventoryError('BARCODE_NOT_FOUND',
        'These barcodes are no longer in the system: ' + missing.join(', '), { status: 422, skipped: missing });
    }

    const doc = {
      businessId, locationId,
      finYear: body.finYear || invoice.finYear || '',
      date: data.date ? new Date(data.date) : new Date(),
      parentInvoice: invoice.invoiceNo || '',
      parentInvoiceId: invoice._id,
      customerId: invoice.customerId || null,
      customerName: data.customerName || '',
      customerContact: invoice.customerContact || '',
      items: lines,
      returnedQty: round2(lines.reduce((a, l) => a + l.qty, 0)),
      returnedCount: lines.length,
      totalAmount: refundable,
      refundAmount: asked,
      refundMode: String(data.refundMode || 'Cash'),
      paymentStatus: asked >= refundable ? 'Refunded' : 'Part Refunded',
      reason, notes: String(data.notes || ''),
      processedBy: session.name || session.email || '',
    };

    doc.invoiceNo = await nextDocNumber(PosReturn, 'invoiceNo', 'POS Return', {
      businessId, locationId, finYear: doc.finYear,
    });

    const [credit] = await PosReturn.create([doc], dbSession ? { session: dbSession } : {});

    /* back into sellable stock at the till's location, guarded on SOLD so a
       unit that is not actually sold cannot be "returned" into existence */
    await returnSoldUnits({
      units, credit, locationId, businessId, reason,
      user: session, session: dbSession,
    });

    return credit;
  });

  return json({
    ok: true,
    id: String(created._id),
    invoiceNo: created.invoiceNo,
    refundAmount: created.refundAmount,
    returnedCount: created.returnedCount,
  }, 201);
});

const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
