import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import { screenDenial, SCREENS, ACTIONS as PERM } from '@/lib/screenPermission';

const STOCK_ADJUSTMENT = { screen: SCREENS.STOCK_ADJUSTMENT, label: 'stock adjustments' };

import StockAdjustment from '@/models/StockAdjustment';
import { requireSession } from '@/lib/session';
import { validate } from '@/lib/validate';
import { FORM } from '@/app/admin/inventory/stock-adjustment/form';

/* header fields AND the totals rows - the totals card holds real stored
   numbers (taxable value, round off, net value, the editable discounts).
   Leaving them out meant validate() silently dropped them on every save. */
const FIELDS = (FORM.cards || []).flatMap((c) => {
  if (c.type === 'fields') return c.fields || [];
  if (c.type === 'totals') {
    return (c.rows || []).flatMap((r) => [
      ...(r.value ? [{ k: r.value, label: r.label, type: 'number' }] : []),
      ...(r.input ? [{ k: r.input, label: r.label, type: 'number', def: 0 }] : []),
    ]);
  }
  return [];
});

/* /api/stock-adjustment/<id> - read one, update, delete. */

const json = (d, s = 200) => Response.json(d, { status: s });

export async function GET(req, { params }) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const { id } = await params;
  await dbConnect();

  const doc = await StockAdjustment.findById(id).lean();
  if (!doc) return json({ doc: null }, 404);

  const denied = await screenDenial({
    session, ...STOCK_ADJUSTMENT, action: PERM.READ, businessId: doc.businessId,
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

  /* Read first only to learn which business owns it, then decide
     permission BEFORE validating. */
  const current = isValidObjectId(id)
    ? await StockAdjustment.findById(id, { businessId: 1 }).lean()
    : null;
  if (!current) return json({ error: 'Not found' }, 404);

  const denied = await screenDenial({
    session, ...STOCK_ADJUSTMENT, action: PERM.UPDATE, businessId: body.business || current.businessId,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const { errors, doc, ok } = validate(FIELDS, body.data || {});
  if (!ok) return json({ errors }, 422);

  if (Array.isArray(body.data?.items)) doc.items = body.data.items;
  if (body.data?.type) doc.type = String(body.data.type);

  const updated = await StockAdjustment.findByIdAndUpdate(id, doc, { new: true, runValidators: true });
  if (!updated) return json({ error: 'Not found' }, 404);

  return json({ ok: true, id });
}

export async function DELETE(req, { params }) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const { id } = await params;
  await dbConnect();

  /* Already gone is still a success, exactly as before. */
  const existing = isValidObjectId(id)
    ? await StockAdjustment.findById(id, { businessId: 1 }).lean()
    : null;
  if (!existing) return json({ ok: true });

  const denied = await screenDenial({
    session, ...STOCK_ADJUSTMENT, action: PERM.DELETE, businessId: existing.businessId,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  await StockAdjustment.findByIdAndDelete(id);
  return json({ ok: true });
}
