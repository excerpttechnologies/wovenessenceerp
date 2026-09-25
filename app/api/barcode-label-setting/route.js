import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import BarcodeLabelSetting from '@/models/BarcodeLabelSetting';
import { requireSession } from '@/lib/session';
import {
  screenDenial, screenDenialAny, SCREENS, ACTIONS as PERM, BARCODE_LABEL_SCREENS,
} from '@/lib/screenPermission';

/* Permission gate for this screen.

   READING THE LAYOUT IS HOW A LABEL GETS DRAWN, so the read answers to
   Print Label and GRC as well as to this master - see
   BARCODE_LABEL_SCREENS.

   ONE DOCUMENT PER SCOPE, ONE SAVE BUTTON: the same POST creates the row
   the first time and rewrites it every time after, so saving answers to
   UPDATE OR CREATE. Requiring one alone would refuse either the first save
   or every save after it. */
const LABEL_SETTING = { screen: SCREENS.BARCODE_LABEL_SETTING, label: 'barcode label settings' };

/* /api/barcode-label-setting - single document per scope: read + upsert. */

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

  /* This master, or a screen that has to draw a label with it. */
  const denied = await screenDenialAny({
    session, screens: BARCODE_LABEL_SCREENS, action: PERM.READ,
    businessId: sp.get('business'), label: 'barcode label settings',
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const doc = await BarcodeLabelSetting.findOne(scopeOf(sp)).lean();
  return json({ doc: doc ? { ...doc, _id: String(doc._id) } : null });
}

export async function POST(req) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const body = await req.json();
  await dbConnect();

  /* Update OR create - see the note at the top. On this master alone: drawing
     a label with a layout is not choosing what the layout is. */
  let gate = await screenDenial({
    session, ...LABEL_SETTING, action: PERM.UPDATE, businessId: body.business,
  });
  if (gate) {
    gate = await screenDenial({
      session, ...LABEL_SETTING, action: PERM.CREATE, businessId: body.business,
    });
  }
  if (gate) return json({ error: gate.message, code: gate.code }, 403);

  const doc = { rows: body.rows || [] };
  if (body.business && isValidObjectId(body.business)) doc.businessId = body.business;
  if (body.location && isValidObjectId(body.location)) doc.locationId = body.location;

  const sp = new URLSearchParams({
    business: body.business || '', location: body.location || '', finYear: body.finYear || '',
  });
  await BarcodeLabelSetting.findOneAndUpdate(scopeOf(sp), doc, { upsert: true, new: true });

  return json({ ok: true });
}
