import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import ContactType from '@/models/ContactType';
import { requireSession } from '@/lib/session';
import { resolveRefLabels } from '@/lib/refLabels';
import { validate, escapeRegex } from '@/lib/validate';
import { FIELDS } from '@/app/admin/contact/contact-type/fields';
import { screenDenial, SCREENS, ACTIONS as PERM } from '@/lib/screenPermission';

const CONTACT_TYPE = { screen: SCREENS.CONTACT_TYPE, label: 'contact types' };


/* /api/contact-type - list + create. */

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

  /* Only refuses when this role has a saved permission matrix that withholds
     it - see lib/screenPermission.js. */
  const denied = await screenDenial({
    session, ...CONTACT_TYPE, action: PERM.READ, businessId: sp.get('business'),
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const filter = {};
  const b = sp.get('business'); if (b && isValidObjectId(b)) filter.businessId = b;

  if (search) {
    const rx = { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = [{ name: rx }, { prefix: rx }, { colorLebel: rx }, { description: rx }];
  }

  const total = await ContactType.countDocuments(filter);
  const rows = await ContactType.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * perPage)
    .limit(perPage)
    .lean();

  return json({
    rows: rows.map((r) => ({ ...r, name: String(r.name || '').toUpperCase(), _id: String(r._id) })),
    labels: await resolveRefLabels(rows),
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

  const denied = await screenDenial({
    session, ...CONTACT_TYPE, action: PERM.CREATE, businessId: body.business,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const { errors, doc, ok } = validate(FIELDS, body.data || {});
  if (!ok) return json({ errors }, 422);
  doc.name = String(doc.name || '').trim().toUpperCase();
  if (body.business && isValidObjectId(body.business)) doc.businessId = body.business;

  const created = await ContactType.create(doc);
  return json({ ok: true, id: String(created._id) });
}
