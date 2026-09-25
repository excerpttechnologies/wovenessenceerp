import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import InvoiceLayoutSetting from '@/models/InvoiceLayoutSetting';
import { requireSession } from '@/lib/session';
import { screenDenial, SCREENS, ACTIONS as PERM } from '@/lib/screenPermission';

/* Permission gate for this screen.

   ONE DOCUMENT PER SCOPE, ONE SAVE BUTTON: the same POST creates the row
   the first time and rewrites it every time after, so saving answers to
   UPDATE OR CREATE. Requiring one alone would refuse either the first save
   or every save after it.

   Nothing else reads this route or the model - no print or invoice path
   consults it - so gating it closes the screen and changes nothing that
   prints today.
   */
const INVOICE_LAYOUT_SETTING = { screen: SCREENS.INVOICE_LAYOUT_SETTING, label: 'invoice layout settings' };

/* /api/invoice-layout-setting - single document per scope: read + upsert. */

const json = (d, s = 200) => Response.json(d, { status: s });

function scopeOf(sp) {
  const filter = {};
  const b = sp.get('business'); if (b && isValidObjectId(b)) filter.businessId = b;
  const l = sp.get('location'); if (l && isValidObjectId(l)) filter.locationId = l;
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
    session, ...INVOICE_LAYOUT_SETTING, action: PERM.READ, businessId: sp.get('business'),
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const doc = await InvoiceLayoutSetting.findOne(scopeOf(sp)).lean();
  return json({ doc: doc ? { ...doc, _id: String(doc._id) } : null });
}

export async function POST(req) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const body = await req.json();
  await dbConnect();

  /* Update OR create, ahead of everything below - see the note at the top. */
  let gate = await screenDenial({
    session, ...INVOICE_LAYOUT_SETTING, action: PERM.UPDATE, businessId: body.business,
  });
  if (gate) {
    gate = await screenDenial({
      session, ...INVOICE_LAYOUT_SETTING, action: PERM.CREATE, businessId: body.business,
    });
  }
  if (gate) return json({ error: gate.message, code: gate.code }, 403);

  const doc = { rows: body.rows || [] };
  if (body.business && isValidObjectId(body.business)) doc.businessId = body.business;
  if (body.location && isValidObjectId(body.location)) doc.locationId = body.location;

  const sp = new URLSearchParams({
    business: body.business || '', location: body.location || '', finYear: body.finYear || '',
  });
  await InvoiceLayoutSetting.findOneAndUpdate(scopeOf(sp), doc, { upsert: true, new: true });

  return json({ ok: true });
}
