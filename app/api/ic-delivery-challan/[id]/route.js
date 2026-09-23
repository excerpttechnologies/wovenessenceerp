import dbConnect from '@/lib/db';
import IcDeliveryChallan from '@/models/IcDeliveryChallan';
import { requireSession } from '@/lib/session';
import { screenDenial, SCREENS, ACTIONS as PERM } from '@/lib/screenPermission';

const IC_DC = { screen: SCREENS.IC_DELIVERY_CHALLAN, label: 'inter company delivery challans' };

import { validate } from '@/lib/validate';
import { FIELDS, computeTotals } from '@/app/admin/transaction/intercompanysell/deliverychallan/fields';

/* /api/ic-delivery-challan/<id> - read one, update, delete. */

const json = (d, s = 200) => Response.json(d, { status: s });

function applyTotals(doc, body) {
  const items = Array.isArray(body.data?.items) ? body.data.items : [];
  const t = computeTotals(items, {
    discountPercent: body.data?.discountPercent,
    roundOffDiscountAmt: body.data?.roundOffDiscountAmt,
  });

  doc.items = items;
  doc.discountPercent = Number(body.data?.discountPercent) || 0;
  doc.roundOffDiscountAmt = Number(body.data?.roundOffDiscountAmt) || 0;
  doc.taxableValue = t.taxableValue;
  doc.igstTotal = t.igstTotal;
  doc.cgstTotal = t.cgstTotal;
  doc.sgstTotal = t.sgstTotal;
  doc.roundOff = t.roundOff;
  doc.totalQty = t.totalQty;
  doc.netValue = t.netValue;
}

export async function GET(req, { params }) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const { id } = await params;
  await dbConnect();

  const doc = await IcDeliveryChallan.findById(id).lean();
  if (!doc) return json({ doc: null }, 404);

  /* Scoped to the challan's own business - the id arrives in the path, so
     there is no query string to take it from. */
  const denied = await screenDenial({
    session, ...IC_DC, action: PERM.READ, businessId: doc.businessId,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  return json({ doc: { ...doc, _id: String(doc._id) } });
}

export async function PUT(req, { params }) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const { id } = await params;
  const body = await req.json();
  await dbConnect();

  /* A challan already pulled into an invoice must not change underneath it -
     the invoice's own lines were copied from these. Release it by deleting
     the invoice, then edit. */
  const existing = await IcDeliveryChallan.findById(id).select('icSalesInvoiceId businessId').lean();
  if (!existing) return json({ error: 'Not found' }, 404);

  const denied = await screenDenial({
    session, ...IC_DC, action: PERM.UPDATE, businessId: body.business || existing.businessId,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  if (existing.icSalesInvoiceId) {
    return json(
      { error: 'This challan is already on an inter company sales invoice and cannot be edited.' },
      409
    );
  }

  const { errors, doc, ok } = validate(FIELDS, body.data || {});
  if (!ok) return json({ errors }, 422);

  applyTotals(doc, body);

  /* never overwrite the document number on edit */
  delete doc.dcNo;

  const updated = await IcDeliveryChallan.findByIdAndUpdate(id, doc, { new: true, runValidators: true });
  if (!updated) return json({ error: 'Not found' }, 404);

  return json({ ok: true, id });
}

export async function DELETE(req, { params }) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const { id } = await params;
  await dbConnect();

  const existing = await IcDeliveryChallan.findById(id).select('icSalesInvoiceId businessId').lean();
  if (!existing) return json({ ok: true });

  const denied = await screenDenial({
    session, ...IC_DC, action: PERM.DELETE, businessId: existing.businessId,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  if (existing.icSalesInvoiceId) {
    return json(
      { error: 'This challan is on an inter company sales invoice. Delete the invoice first.' },
      409
    );
  }

  await IcDeliveryChallan.findByIdAndDelete(id);
  return json({ ok: true });
}
