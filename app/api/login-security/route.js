import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import LoginSecurity from '@/models/LoginSecurity';
import { requireSession } from '@/lib/session';
import { screenDenial, SCREENS, ACTIONS as PERM } from '@/lib/screenPermission';

/* Permission gate for this screen.

   ONE DOCUMENT PER SCOPE, ONE SAVE BUTTON: the same POST creates the row
   the first time and rewrites it every time after, so saving answers to
   UPDATE OR CREATE. Requiring update alone would refuse the very first
   save on a business never configured; requiring create alone would
   refuse every save after it. The operator sees one button and cannot
   tell which of the two the server is about to do.

   THIS DOES NOT GATE SIGNING IN. Nothing reads this model outside
   its own screen - the IP allowlist and authentication block are stored
   but never consulted by lib/auth.js, lib/session.js or middleware.js - so
   refusing a role here only hides the settings screen. Sign-in, sessions
   and every other screen are untouched. */
const LOGIN_SECURITY = { screen: SCREENS.LOGIN_SECURITY, label: 'login security settings' };
import { validate } from '@/lib/validate';
import { FIELDS } from '@/app/admin/setting/login-security/fields';

/* /api/login-security - single document per scope: read + upsert. */

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
    session, ...LOGIN_SECURITY, action: PERM.READ, businessId: sp.get('business'),
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const doc = await LoginSecurity.findOne(scopeOf(sp)).lean();
  return json({ doc: doc ? { ...doc, _id: String(doc._id) } : null });
}

export async function POST(req) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const body = await req.json();
  await dbConnect();

  /* Update OR create, ahead of validate() - see the note at the top. */
  let gate = await screenDenial({
    session, ...LOGIN_SECURITY, action: PERM.UPDATE, businessId: body.business,
  });
  if (gate) {
    gate = await screenDenial({
      session, ...LOGIN_SECURITY, action: PERM.CREATE, businessId: body.business,
    });
  }
  if (gate) return json({ error: gate.message, code: gate.code }, 403);

  const { errors, doc, ok } = validate(FIELDS, body.data || {});
  if (!ok) return json({ errors }, 422);
  if (body.business && isValidObjectId(body.business)) doc.businessId = body.business;

  const sp = new URLSearchParams({
    business: body.business || '', location: body.location || '', finYear: body.finYear || '',
  });
  await LoginSecurity.findOneAndUpdate(scopeOf(sp), doc, { upsert: true, new: true });

  return json({ ok: true });
}
