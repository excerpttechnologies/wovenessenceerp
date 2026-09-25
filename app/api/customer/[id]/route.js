import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import { Customer } from '@/lib/contacts';
import { requireSession } from '@/lib/session';
import { validate } from '@/lib/validate';
import { TABS } from '@/app/admin/contact/customer/tabs';
import { screenDenial, SCREENS, ACTIONS as PERM } from '@/lib/screenPermission';

const CUSTOMER = { screen: SCREENS.CUSTOMER, label: 'customers' };


const FIELDS = TABS.flatMap((t) => (t.sections || []).flatMap((s) => [
  ...(s.fields || []),
  ...(s.toggle ? [{ k: s.toggle.k, label: s.toggle.label, type: 'checkbox' }] : []),
]));

/* /api/customer/<id> - read one, update, delete. */

const json = (d, s = 200) => Response.json(d, { status: s });

export async function GET(req, { params }) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const { id } = await params;
  await dbConnect();

  const doc = await Customer.findById(id).lean();
  if (!doc) return json({ doc: null }, 404);

  /* Scoped to the customer's own business, not to whichever business the
     screen happens to be switched to. */
  const denied = await screenDenial({
    session, ...CUSTOMER, action: PERM.READ, businessId: doc.businessId,
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

  /* Read first only to learn which business owns it, then decide permission
     BEFORE validating. */
  const current = isValidObjectId(id)
    ? await Customer.findById(id, { businessId: 1 }).lean()
    : null;
  if (!current) return json({ error: 'Not found' }, 404);

  const denied = await screenDenial({
    session, ...CUSTOMER, action: PERM.UPDATE,
    businessId: body.business || current.businessId,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const { errors, doc, ok } = validate(FIELDS, body.data || {});
  if (!ok) return json({ errors }, 422);

  const updated = await Customer.findByIdAndUpdate(id, doc, { new: true, runValidators: true });
  if (!updated) return json({ error: 'Not found' }, 404);

  return json({ ok: true, id });
}

export async function DELETE(req, { params }) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const { id } = await params;
  await dbConnect();

  /* Already gone is still a success, exactly as before - the guard only has
     something to say when there is a record to protect. */
  const existing = isValidObjectId(id)
    ? await Customer.findById(id, { businessId: 1 }).lean()
    : null;
  if (!existing) return json({ ok: true });

  const denied = await screenDenial({
    session, ...CUSTOMER, action: PERM.DELETE, businessId: existing.businessId,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  await Customer.findByIdAndDelete(id);
  return json({ ok: true });
}
