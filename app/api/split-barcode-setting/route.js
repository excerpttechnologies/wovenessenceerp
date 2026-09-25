import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import SplitBarcodeSetting from '@/models/SplitBarcodeSetting';
import { requireSession } from '@/lib/session';
import { validate, escapeRegex } from '@/lib/validate';
import { FIELDS } from '@/app/admin/setting/split-barcode-setting/fields';
import { screenDenial, SCREENS, ACTIONS as PERM } from '@/lib/screenPermission';

/* Permission gate for this screen.

   Nothing else reads this route, and nothing in the barcode generation or
   print path reads the model either - this master is stored but not yet
   consumed anywhere. So gating it closes the screen and touches nothing
   else. */
const SPLIT_BARCODE = { screen: SCREENS.SPLIT_BARCODE_SETTING, label: 'split barcode settings' };

/* /api/split-barcode-setting - list + create. */

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
    session, ...SPLIT_BARCODE, action: PERM.READ, businessId: sp.get('business'),
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const filter = {};
  const b = sp.get('business'); if (b && isValidObjectId(b)) filter.businessId = b;
  const y = sp.get('finYear'); if (y) filter.finYear = y;

  if (search) {
    const rx = { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = [{ prefix: rx }, { suffix: rx }, { sampleBarcode: rx }];
  }

  const total = await SplitBarcodeSetting.countDocuments(filter);
  const rows = await SplitBarcodeSetting.find(filter)
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

  /* Ahead of validate(), so a refused setting comes back as 403 "not allowed"
     rather than 422 "your form is wrong". */
  const denied = await screenDenial({
    session, ...SPLIT_BARCODE, action: PERM.CREATE, businessId: body.business,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const { errors, doc, ok } = validate(FIELDS, body.data || {});
  if (!ok) return json({ errors }, 422);
  if (body.business && isValidObjectId(body.business)) doc.businessId = body.business;
  if (body.finYear) doc.finYear = body.finYear;

  const created = await SplitBarcodeSetting.create(doc);
  return json({ ok: true, id: String(created._id) });
}
