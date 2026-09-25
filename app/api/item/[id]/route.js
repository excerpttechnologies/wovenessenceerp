import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import Item from '@/models/Item';
import { requireSession } from '@/lib/session';
import { validate } from '@/lib/validate';
import { screenDenial, SCREENS, ACTIONS as PERM } from '@/lib/screenPermission';

/* Permission gate for this screen.

   THE PLAIN BY-ID ROUTE IS THE EDIT FORM, so it answers to Item read alone.
   The lookups other screens make go to ./detail, which accepts any screen
   that resolves item codes - see ITEM_LOOKUP_SCREENS. */
const ITEM = { screen: SCREENS.ITEM, label: 'items' };

import { FIELDS } from '@/app/admin/inventory/item/fields';

/* /api/item/<id> - read one, update, delete. */

const json = (d, s = 200) => Response.json(d, { status: s });

export async function GET(req, { params }) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const { id } = await params;
  await dbConnect();

  const doc = await Item.findById(id).lean();
  if (!doc) return json({ doc: null }, 404);

  /* Scoped to the item's own business, not to whichever business the screen
     happens to be switched to. */
  const denied = await screenDenial({
    session, ...ITEM, action: PERM.READ, businessId: doc.businessId,
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
    ? await Item.findById(id, { businessId: 1 }).lean()
    : null;
  if (!current) return json({ error: 'Not found' }, 404);

  const denied = await screenDenial({
    session, ...ITEM, action: PERM.UPDATE, businessId: body.business || current.businessId,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const { errors, doc, ok } = validate(FIELDS, body.data || {});
  if (!ok) return json({ errors }, 422);

  const updated = await Item.findByIdAndUpdate(id, doc, { new: true, runValidators: true });
  if (!updated) return json({ error: 'Not found' }, 404);

  return json({ ok: true, id });
}

export async function DELETE(req, { params }) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const { id } = await params;
  await dbConnect();

  /* Already gone is still a success, exactly as before - the guard only
     has something to say when there is a record to protect. */
  const existing = isValidObjectId(id)
    ? await Item.findById(id, { businessId: 1 }).lean()
    : null;
  if (!existing) return json({ ok: true });

  const denied = await screenDenial({
    session, ...ITEM, action: PERM.DELETE, businessId: existing.businessId,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  await Item.findByIdAndDelete(id);
  return json({ ok: true });
}
