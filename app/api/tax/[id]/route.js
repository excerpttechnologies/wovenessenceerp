import dbConnect from '@/lib/db';
import Tax from '@/models/Tax';
import { requireSession } from '@/lib/session';
import { validate } from '@/lib/validate';
import { FIELDS } from '@/app/admin/setting/tax/fields';
import {
  screenDenial, screenDenialAny, SCREENS, ACTIONS as PERM, TAX_LOOKUP_SCREENS,
} from '@/lib/screenPermission';

/* READING ONE SLAB IS HOW A DOCUMENT LINE IS PRICED. Every transaction
   screen resolves its GST through this route, so it answers to any of
   them as well as to the master - see TAX_LOOKUP_SCREENS. Changing a slab
   still needs the master. */
const TAX = { screen: SCREENS.TAX, label: 'taxes' };

/* /api/tax/<id> - read one, update, delete. */

const json = (d, s = 200) => Response.json(d, { status: s });

export async function GET(req, { params }) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const { id } = await params;
  await dbConnect();

  const doc = await Tax.findById(id).lean();
  if (!doc) return json({ doc: null }, 404);

  /* The master, or any screen that has to price a line with it. */
  const denied = await screenDenialAny({
    session, screens: TAX_LOOKUP_SCREENS, action: PERM.READ,
    businessId: doc.businessId, label: 'taxes',
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

  /* Before validate(), and on the master alone - pricing a line with a slab
     is not editing the slab. Scoped on the stored record. */
  const target = await Tax.findById(id).select('businessId').lean();
  if (!target) return json({ error: 'Not found' }, 404);

  const denied = await screenDenial({
    session, ...TAX, action: PERM.UPDATE, businessId: target.businessId,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const { errors, doc, ok } = validate(FIELDS, body.data || {});
  if (!ok) return json({ errors }, 422);

  const updated = await Tax.findByIdAndUpdate(id, doc, { new: true, runValidators: true });
  if (!updated) return json({ error: 'Not found' }, 404);

  return json({ ok: true, id });
}

export async function DELETE(req, { params }) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const { id } = await params;
  await dbConnect();

  const target = await Tax.findById(id).select('businessId').lean();
  if (!target) return json({ ok: true });

  const denied = await screenDenial({
    session, ...TAX, action: PERM.DELETE, businessId: target.businessId,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  await Tax.findByIdAndDelete(id);
  return json({ ok: true });
}
