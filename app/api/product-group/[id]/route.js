import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import ProductGroup from '@/models/ProductGroup';
import { requireSession } from '@/lib/session';
import { validate } from '@/lib/validate';
import { screenDenial, SCREENS, ACTIONS as PERM } from '@/lib/screenPermission';

/* Permission gate for this screen.

   READING ONE GROUP answers to EITHER Product Group read or GRC read. Barcode
   Generation resolves a sub-group and its parent by id to fill in the group
   name, and it is reached from a GRC - so a role that may work a GRC must be
   able to make that lookup without also being granted the Group master.
   Anything that WRITES still needs Product Group's own permission. */
const PRODUCT_GROUP = { screen: SCREENS.PRODUCT_GROUP, label: 'product groups' };

import { FIELDS } from '@/app/admin/inventory/product/group/fields';

/* /api/product-group/<id> - read one, update, delete. */

const json = (d, s = 200) => Response.json(d, { status: s });

export async function GET(req, { params }) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const { id } = await params;
  await dbConnect();

  const doc = await ProductGroup.findById(id).lean();
  if (!doc) return json({ doc: null }, 404);

  /* Product Group read, or failing that GRC read - see the note above.
     Scoped to the record's own business either way. */
  let denied = await screenDenial({
    session, ...PRODUCT_GROUP, action: PERM.READ, businessId: doc.businessId,
  });
  if (denied) {
    denied = await screenDenial({
      session, screen: SCREENS.GRC, label: 'product groups',
      action: PERM.READ, businessId: doc.businessId,
    });
  }
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
    ? await ProductGroup.findById(id, { businessId: 1 }).lean()
    : null;
  if (!current) return json({ error: 'Not found' }, 404);

  const denied = await screenDenial({
    session, ...PRODUCT_GROUP, action: PERM.UPDATE, businessId: body.business || current.businessId,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const { errors, doc, ok } = validate(FIELDS, body.data || {});
  if (!ok) return json({ errors }, 422);

  const updated = await ProductGroup.findByIdAndUpdate(id, doc, { new: true, runValidators: true });
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
    ? await ProductGroup.findById(id, { businessId: 1 }).lean()
    : null;
  if (!existing) return json({ ok: true });

  const denied = await screenDenial({
    session, ...PRODUCT_GROUP, action: PERM.DELETE, businessId: existing.businessId,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  await ProductGroup.findByIdAndDelete(id);
  return json({ ok: true });
}
