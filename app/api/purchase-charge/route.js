import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import PurchaseCharge from '@/models/PurchaseCharge';
import { requireSession } from '@/lib/session';
import { validate, escapeRegex } from '@/lib/validate';
import { FIELDS } from '@/app/admin/setting/purchase/master/charge/fields';
import { screenDenial, SCREENS, ACTIONS as PERM } from '@/lib/screenPermission';

/* Permission gate for this screen.

   Nothing else reads this route. Forms pick one through
   /api/options?ref=purchase/master/charge, lib/refLabels.js resolves a stored id
   through the model on the server, and the purchase invoice print route
   reads the model directly too - none of which comes through here. So
   gating this closes the master and touches no document screen. */
const PURCHASE_CHARGE = { screen: SCREENS.PURCHASE_CHARGE, label: 'purchase charges' };

/* /api/purchase-charge - list + create. */

const json = (d, s = 200) => Response.json(d, { status: s });
const PER_PAGE = 10;

export async function GET(req) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const sp = new URL(req.url).searchParams;
  await dbConnect();

  const page = Math.max(1, Number(sp.get('page') || 1));
  const perPage = Math.min(500, Number(sp.get('perPage') || PER_PAGE));
  const search = (sp.get('search') || '').trim();

  /* Only refuses when this role has a saved permission matrix that
     withholds it - see lib/screenPermission.js. */
  const denied = await screenDenial({
    session, ...PURCHASE_CHARGE, action: PERM.READ, businessId: sp.get('business'),
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const filter = {};
  const b = sp.get('business'); if (b && isValidObjectId(b)) filter.businessId = b;

  if (search) {
    const rx = { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = [{ chargeName: rx }];
  }

  const total = await PurchaseCharge.countDocuments(filter);
  const rows = await PurchaseCharge.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * perPage)
    .limit(perPage)
    .lean();

  /* resolve ObjectId columns to their display labels */
  const labels = {};

  return json({
    rows: rows.map((r) => ({ ...r, _id: String(r._id) })),
    labels,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / perPage)),
    perPage,
  });
}

export async function POST(req) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const body = await req.json();
  await dbConnect();

  /* Ahead of validate(), so a refused record comes back as 403 "not allowed"
     rather than 422 "your form is wrong". */
  const denied = await screenDenial({
    session, ...PURCHASE_CHARGE, action: PERM.CREATE, businessId: body.business,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const { errors, doc, ok } = validate(FIELDS, body.data || {});
  if (!ok) return json({ errors }, 422);
  if (body.business && isValidObjectId(body.business)) doc.businessId = body.business;

  const created = await PurchaseCharge.create(doc);
  return json({ ok: true, id: String(created._id) });
}
