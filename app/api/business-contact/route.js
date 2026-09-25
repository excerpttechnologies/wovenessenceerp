import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import BusinessContact from '@/models/BusinessContact';
import { requireSession } from '@/lib/session';
import { screenDenial, SCREENS, ACTIONS as PERM } from '@/lib/screenPermission';

/* Permission gate for this screen.

   ONE DOCUMENT PER SCOPE, ONE SAVE BUTTON: the same POST creates the row
   the first time and rewrites it every time after, so saving answers to
   UPDATE OR CREATE. Requiring one alone would refuse either the first save
   or every save after it.

   THIS SCREEN IS GLOBAL, NOT PER BUSINESS. scopeOf() returns {} on purpose:
   there is exactly one BusinessContact document for the whole deployment,
   shared by every company, and the page sends scope: []. With no business
   to judge against, both checks land on the cross-business branch of
   screenDenial() - the role may read or save if it holds the permission
   ANYWHERE. That is the only reading that fits a screen that is not about
   one business, and it is still a real check: a governed role that was
   never granted it is refused.
   */
const BUSINESS_CONTACT = { screen: SCREENS.BUSINESS_CONTACT, label: 'business contacts' };

/* /api/business-contact - single document per scope: read + upsert. */

const json = (d, s = 200) => Response.json(d, { status: s });

function scopeOf(sp) {
  const filter = {};
  /* global - no tenant scope */
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
    session, ...BUSINESS_CONTACT, action: PERM.READ, businessId: sp.get('business'),
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const doc = await BusinessContact.findOne(scopeOf(sp)).lean();
  return json({ doc: doc ? { ...doc, _id: String(doc._id) } : null });
}

export async function POST(req) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const body = await req.json();
  await dbConnect();

  /* Update OR create, ahead of everything below - see the note at the top. */
  let gate = await screenDenial({
    session, ...BUSINESS_CONTACT, action: PERM.UPDATE, businessId: body.business,
  });
  if (gate) {
    gate = await screenDenial({
      session, ...BUSINESS_CONTACT, action: PERM.CREATE, businessId: body.business,
    });
  }
  if (gate) return json({ error: gate.message, code: gate.code }, 403);

  const doc = { pairs: body.pairs || {} };


  const sp = new URLSearchParams({
    business: body.business || '', location: body.location || '', finYear: body.finYear || '',
  });
  await BusinessContact.findOneAndUpdate(scopeOf(sp), doc, { upsert: true, new: true });

  return json({ ok: true });
}
