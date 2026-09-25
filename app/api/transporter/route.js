import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import Transporter from '@/models/Transporter';
import { requireSession } from '@/lib/session';
import { validate, escapeRegex } from '@/lib/validate';
import { FIELDS } from '@/app/admin/transport/transporter/fields';
import { screenDenial, SCREENS, ACTIONS as PERM } from '@/lib/screenPermission';

/* Permission gate for this screen.

   THE DELIVERY (LR) SCREEN QUICK-ADDS A TRANSPORTER through this same POST
   (components/DeliveryView.jsx), so raising an LR for a carrier that is not
   on file needs Transport Master create. That is the right way round - a
   quick-add writes a master record, and it should answer to the master's
   own permission rather than smuggle one in through another screen.

   Picking an EXISTING transporter on that form is unaffected: the dropdown
   reads /api/options?ref=transporter, not this route. */
const TRANSPORTER = { screen: SCREENS.TRANSPORTER, label: 'transporters' };

/* /api/transporter - list + create. */

const json = (d, s = 200) => Response.json(d, { status: s });
const PER_PAGE = 10;

export async function GET(req) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const sp = new URL(req.url).searchParams;
  await dbConnect();

  const page = Math.max(1, Number(sp.get('page') || 1));
  const perPage = Math.min(500, Number(sp.get('perPage') || PER_PAGE));

  /* Only refuses when this role has a saved permission matrix that
     withholds it - see lib/screenPermission.js. */
  const denied = await screenDenial({
    session, ...TRANSPORTER, action: PERM.READ, businessId: sp.get('business'),
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const filter = {};
  const b = sp.get('business'); if (b && isValidObjectId(b)) filter.businessId = b;

  const search = (sp.get('search') || '').trim();
  if (search) {
    const rx = { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = [{ transporterName: rx }, { transporterCode: rx }];
  }

  const total = await Transporter.countDocuments(filter);
  const rows = await Transporter.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * perPage)
    .limit(perPage)
    .lean();

  return json({
    rows: rows.map((r) => ({ ...r, _id: String(r._id) })),
    labels: {},
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

  /* Ahead of validate(), so a refused transporter comes back as 403 "not
     allowed" rather than 422 "your form is wrong". */
  const denied = await screenDenial({
    session, ...TRANSPORTER, action: PERM.CREATE, businessId: body.business,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const { errors, doc, ok } = validate(FIELDS, body.data || {});
  if (!ok) return json({ errors }, 422);

  if (body.business && isValidObjectId(body.business)) doc.businessId = body.business;
  if (body.location && isValidObjectId(body.location)) doc.locationId = body.location;

  const created = await Transporter.create(doc);
  return json({ ok: true, id: String(created._id) });
}
