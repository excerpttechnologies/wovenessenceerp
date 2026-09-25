import dbConnect from '@/lib/db';
import ContactType from '@/models/ContactType';
import { requireSession } from '@/lib/session';
import { validate } from '@/lib/validate';
import { FIELDS } from '@/app/admin/contact/contact-type/fields';
import { screenDenial, SCREENS, ACTIONS as PERM } from '@/lib/screenPermission';

const CONTACT_TYPE = { screen: SCREENS.CONTACT_TYPE, label: 'contact types' };


/* /api/contact-type/<id> - read one, update, delete. */

const json = (d, s = 200) => Response.json(d, { status: s });

export async function GET(req, { params }) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const { id } = await params;
  await dbConnect();

  const doc = await ContactType.findById(id).lean();
  if (!doc) return json({ doc: null }, 404);

  /* Scoped to the record's own business - the id arrives in the path, so there
     is no query string to take it from. */
  const denied = await screenDenial({
    session, ...CONTACT_TYPE, action: PERM.READ, businessId: doc.businessId,
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

  /* Read first only to learn which business owns it; the update itself is
     unchanged. A missing record still answers 404, as it did before. */
  const existing = await ContactType.findById(id).select('businessId').lean();
  if (!existing) return json({ error: 'Not found' }, 404);

  const denied = await screenDenial({
    session, ...CONTACT_TYPE, action: PERM.UPDATE,
    businessId: body.business || existing.businessId,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const { errors, doc, ok } = validate(FIELDS, body.data || {});
  if (!ok) return json({ errors }, 422);
  doc.name = String(doc.name || '').trim().toUpperCase();

  const updated = await ContactType.findByIdAndUpdate(id, doc, { new: true, runValidators: true });
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
  const existing = await ContactType.findById(id).select('businessId').lean();
  if (!existing) return json({ ok: true });

  const denied = await screenDenial({
    session, ...CONTACT_TYPE, action: PERM.DELETE, businessId: existing.businessId,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  await ContactType.findByIdAndDelete(id);
  return json({ ok: true });
}
