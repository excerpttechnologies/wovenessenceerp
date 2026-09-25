import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import ProductGroup from '@/models/ProductGroup';
import { requireSession } from '@/lib/session';
import { resolveRefLabels } from '@/lib/refLabels';
import { validate, escapeRegex } from '@/lib/validate';
import { screenDenial, SCREENS, ACTIONS as PERM } from '@/lib/screenPermission';

/* Permission gate for this screen.

   THE LIST IS FULLY GATED. Barcode Generation only ever asks for ONE group by
   id (components/GCRBarcodeGeneration.jsx), never for the list, so gating the
   list costs it nothing. The by-id route keeps a second way in - see the note
   there. */
const PRODUCT_GROUP = { screen: SCREENS.PRODUCT_GROUP, label: 'product groups' };

import { FIELDS } from '@/app/admin/inventory/product/group/fields';

/* /api/product-group - list + create. */

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
    session, ...PRODUCT_GROUP, action: PERM.READ, businessId: sp.get('business'),
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const filter = {};
  const b = sp.get('business'); if (b && isValidObjectId(b)) filter.businessId = b;

  if (search) {
    const rx = { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = [{ name: rx }, { prefix: rx }];
  }

  const total = await ProductGroup.countDocuments(filter);
  const rows = await ProductGroup.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * perPage)
    .limit(perPage)
    .lean();

  return json({
    rows: rows.map((r) => ({ ...r, _id: String(r._id) })),
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
    session, ...PRODUCT_GROUP, action: PERM.CREATE, businessId: body.business,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const { errors, doc, ok } = validate(FIELDS, body.data || {});
  if (!ok) return json({ errors }, 422);
  if (body.business && isValidObjectId(body.business)) doc.businessId = body.business;

  const created = await ProductGroup.create(doc);
  return json({ ok: true, id: String(created._id) });
}
