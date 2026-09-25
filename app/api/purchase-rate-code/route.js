import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import PurchaseRateCode from '@/models/PurchaseRateCode';
import { requireSession } from '@/lib/session';
import { normaliseMapping, validateMapping } from '@/lib/purchaseRateCode';
import {
  screenDenial, screenDenialAny, SCREENS, ACTIONS as PERM, RATE_CODE_SCREENS,
} from '@/lib/screenPermission';

/* Permission gate for this screen.

   READING THE MAPPING IS HOW A RATE GETS ENCODED onto a label, so the read
   answers to GRC as well as to this master - see RATE_CODE_SCREENS.

   WRITING IS DELIBERATELY NARROWER than reading, more so than on the other
   masters: changing the mapping makes every code already printed decode to
   a different rate, so it stays with this screen alone. Update OR create,
   because one Save button serves both. */
const RATE_CODE = { screen: SCREENS.PURCHASE_RATE_CODE, label: 'purchase rate codes' };

/* /api/purchase-rate-code - single document per scope: read + upsert.

   Shaped after /api/barcode-label-setting, which is this project's pattern for
   a one-record-per-scope master: GET returns { doc } or { doc: null }, POST
   upserts. POST rather than PUT because that is what every other settings
   master here uses. */

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

  /* This master, or the generation screen that has to encode with it. */
  const denied = await screenDenialAny({
    session, screens: RATE_CODE_SCREENS, action: PERM.READ,
    businessId: sp.get('business'), label: 'purchase rate codes',
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const doc = await PurchaseRateCode.findOne(scopeOf(sp)).lean();

  /* digitMappings is re-normalised on the way out as well as in. A record
     written by an earlier build, or edited straight in the database, would
     otherwise hand the encoder untrimmed or lower-case codes and quietly
     produce a value that will not decode. */
  return json({
    doc: doc
      ? { ...doc, _id: String(doc._id), digitMappings: normaliseMapping(doc.digitMappings) }
      : null,
  });
}

export async function POST(req) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const body = await req.json().catch(() => ({}));
  await dbConnect();

  /* Ahead of validateMapping(), so a refused save reads as 403 "not allowed"
     rather than as a complaint about the mapping. */
  let gate = await screenDenial({
    session, ...RATE_CODE, action: PERM.UPDATE, businessId: body.business,
  });
  if (gate) {
    gate = await screenDenial({
      session, ...RATE_CODE, action: PERM.CREATE, businessId: body.business,
    });
  }
  if (gate) return json({ error: gate.message, code: gate.code }, 403);

  /* Validated server-side as well as in the page: the browser is not trusted
     to have run the duplicate check, and an incomplete or ambiguous mapping
     saved here would break decoding everywhere it is used. */
  const { ok, errors, mapping } = validateMapping(body.digitMappings);
  if (!ok) return json({ error: errors[0], errors }, 422);

  const doc = {
    digitMappings: mapping,
    isActive: body.isActive === undefined ? true : Boolean(body.isActive),
  };
  if (body.business && isValidObjectId(body.business)) doc.businessId = body.business;
  if (body.location && isValidObjectId(body.location)) doc.locationId = body.location;

  const sp = new URLSearchParams({
    business: body.business || '', location: body.location || '',
  });
  await PurchaseRateCode.findOneAndUpdate(scopeOf(sp), doc, { upsert: true, new: true });

  return json({ ok: true });
}
