import dbConnect from '@/lib/db';
import CityGroup from '@/models/CityGroup';
import { requireSession } from '@/lib/session';
import { validate } from '@/lib/validate';
import { FIELDS } from '@/app/admin/setting/citygroup/fields';
import { screenDenial, SCREENS, ACTIONS as PERM } from '@/lib/screenPermission';

const CITY_GROUP = { screen: SCREENS.CITY_GROUP, label: 'city groups' };

/* /api/city-group/<id> - read one, update, delete. */

const json = (d, s = 200) => Response.json(d, { status: s });

export async function GET(req, { params }) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const { id } = await params;
  await dbConnect();

  const doc = await CityGroup.findById(id).lean();
  if (!doc) return json({ doc: null }, 404);

  /* Scoped to the group's own business, not to whichever business the screen
     happens to be switched to. */
  const denied = await screenDenial({
    session, ...CITY_GROUP, action: PERM.READ, businessId: doc.businessId,
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

  /* Before validate(), and scoped on the stored record rather than on the
     body. */
  const target = await CityGroup.findById(id).select('businessId').lean();
  if (!target) return json({ error: 'Not found' }, 404);

  const denied = await screenDenial({
    session, ...CITY_GROUP, action: PERM.UPDATE, businessId: target.businessId,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const { errors, doc, ok } = validate(FIELDS, body.data || {});
  if (!ok) return json({ errors }, 422);

  const updated = await CityGroup.findByIdAndUpdate(id, doc, { new: true, runValidators: true });
  if (!updated) return json({ error: 'Not found' }, 404);

  return json({ ok: true, id });
}

export async function DELETE(req, { params }) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const { id } = await params;
  await dbConnect();

  const target = await CityGroup.findById(id).select('businessId').lean();
  if (!target) return json({ ok: true });

  const denied = await screenDenial({
    session, ...CITY_GROUP, action: PERM.DELETE, businessId: target.businessId,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  await CityGroup.findByIdAndDelete(id);
  return json({ ok: true });
}
