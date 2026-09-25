import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import EcomSetting from '@/models/EcomSetting';
import { requireSession } from '@/lib/session';
import { screenDenial, SCREENS, ACTIONS as PERM } from '@/lib/screenPermission';

/* Permission gate for this screen.

   ONE DOCUMENT PER SCOPE, ONE SAVE BUTTON: the same POST creates the row
   the first time and rewrites it every time after, so saving answers to
   UPDATE OR CREATE. Requiring one alone would refuse either the first save
   or every save after it.

   Nothing else reads this route or the model. The markup, COD and shipping
   values are stored but not applied anywhere - there is no checkout or
   pricing code that consults them - so gating this closes the screen and
   changes no selling behaviour.
   */
const ECOM_SETTING = { screen: SCREENS.ECOM_SETTING, label: 'e-commerce settings' };
import { validate } from '@/lib/validate';
import { FIELDS } from '@/app/admin/setting/ecom_setting/fields';

/* /api/ecom-setting - single document per scope: read + upsert. */

const json = (d, s = 200) => Response.json(d, { status: s });

function scopeOf(sp) {
  const filter = {};
  const b = sp.get('business'); if (b && isValidObjectId(b)) filter.businessId = b;
  return filter;
}

export async function GET(req) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const sp = new URL(req.url).searchParams;
  await dbConnect();

  /* Only refuses when this role has a saved permission matrix that
     withholds it - see lib/screenPermission.js. */
  const denied = await screenDenial({
    session, ...ECOM_SETTING, action: PERM.READ, businessId: sp.get('business'),
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const doc = await EcomSetting.findOne(scopeOf(sp)).lean();
  return json({ doc: doc ? { ...doc, _id: String(doc._id) } : null });
}

export async function POST(req) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const body = await req.json();
  await dbConnect();

  /* Update OR create, ahead of everything below - see the note at the top. */
  let gate = await screenDenial({
    session, ...ECOM_SETTING, action: PERM.UPDATE, businessId: body.business,
  });
  if (gate) {
    gate = await screenDenial({
      session, ...ECOM_SETTING, action: PERM.CREATE, businessId: body.business,
    });
  }
  if (gate) return json({ error: gate.message, code: gate.code }, 403);

  const { errors, doc, ok } = validate(FIELDS, body.data || {});
  if (!ok) return json({ errors }, 422);
  if (body.business && isValidObjectId(body.business)) doc.businessId = body.business;

  const sp = new URLSearchParams({
    business: body.business || '', location: body.location || '', finYear: body.finYear || '',
  });
  await EcomSetting.findOneAndUpdate(scopeOf(sp), doc, { upsert: true, new: true });

  return json({ ok: true });
}
