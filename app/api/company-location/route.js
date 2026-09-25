import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import CompanyLocation from '@/models/CompanyLocation';
import { requireSession } from '@/lib/session';
import { resolveRefLabels } from '@/lib/refLabels';
import { validate, escapeRegex } from '@/lib/validate';
import { FIELDS } from '@/app/admin/setting/companylocations/fields';
import { screenDenial, SCREENS, ACTIONS as PERM } from '@/lib/screenPermission';

/* Permission gate for this screen.

   THE LOCATION SELECTOR IS NOT AFFECTED. The top bar fills itself from
   /api/options?ref=companylocations, a different endpoint, so a role refused
   here still has its location dropdown and every screen that depends on one
   keeps working. Administering the branches is the thing being gated, not
   standing in one. */
const LOCATION = { screen: SCREENS.COMPANY_LOCATION, label: 'company locations' };

/* /api/company-location - list + create. */

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
    session, ...LOCATION, action: PERM.READ, businessId: sp.get('business'),
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const filter = {};
  const b = sp.get('business'); if (b && isValidObjectId(b)) filter.businessId = b;

  if (search) {
    const rx = { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = [{ name: rx }, { businessPrintName: rx }, { landmark: rx }, { city: rx }, { state: rx }, { country: rx }, { zipCode: rx }, { addressLine1: rx }, { addressLine2: rx }, { mobile: rx }, { alternateContactNumber: rx }, { email: rx }, { websiteUrl: rx }, { gstin: rx }, { termsAndConditions: rx }];
  }

  const total = await CompanyLocation.countDocuments(filter);
  const rows = await CompanyLocation.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * perPage)
    .limit(perPage)
    .lean();

  /* resolve ObjectId columns to their display labels */
  const labels = await resolveRefLabels(rows);

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

  /* Ahead of validate(), so a refused branch comes back as 403 "not allowed"
     rather than 422 "your form is wrong". */
  const denied = await screenDenial({
    session, ...LOCATION, action: PERM.CREATE, businessId: body.business,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const { errors, doc, ok } = validate(FIELDS, body.data || {});
  if (!ok) return json({ errors }, 422);
  if (body.business && isValidObjectId(body.business)) doc.businessId = body.business;

  const created = await CompanyLocation.create(doc);
  return json({ ok: true, id: String(created._id) });
}

