// import { isValidObjectId } from 'mongoose';
// import dbConnect from '@/lib/db';
// import BarcodeSetting from '@/models/BarcodeSetting';
// import { requireSession } from '@/lib/session';
// import { validate } from '@/lib/validate';
// import { FIELDS } from '@/app/admin/setting/barcodesetting/fields';

// /* /api/barcode-setting - single document per scope: read + upsert. */

// const json = (d, s = 200) => Response.json(d, { status: s });

// function scopeOf(sp) {
//   const filter = {};
//   const b = sp.get('business'); if (b && isValidObjectId(b)) filter.businessId = b;
//   const y = sp.get('finYear'); if (y) filter.finYear = y;
//   return filter;
// }

// export async function GET(req) {
//   const session = await requireSession();
//   if (!session) return json({ error: 'Unauthorized' }, 401);

//   const sp = new URL(req.url).searchParams;
//   await dbConnect();

//   const doc = await BarcodeSetting.findOne(scopeOf(sp)).lean();
//   return json({ doc: doc ? { ...doc, _id: String(doc._id) } : null });
// }

// export async function POST(req) {
//   const session = await requireSession();
//   if (!session) return json({ error: 'Unauthorized' }, 401);

//   const body = await req.json();
//   await dbConnect();

//   const { errors, doc, ok } = validate(FIELDS, body.data || {});
//   if (!ok) return json({ errors }, 422);
//   if (body.business && isValidObjectId(body.business)) doc.businessId = body.business;
//   if (body.finYear) doc.finYear = body.finYear;

//   const sp = new URLSearchParams({
//     business: body.business || '', location: body.location || '', finYear: body.finYear || '',
//   });
//   await BarcodeSetting.findOneAndUpdate(scopeOf(sp), doc, { upsert: true, new: true });

//   return json({ ok: true });
// }







import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import BarcodeSetting from '@/models/BarcodeSetting';
import { requireSession } from '@/lib/session';
import { validate, escapeRegex } from '@/lib/validate';
import { ROW_FIELDS, sampleBarcode, rowName } from '@/app/admin/setting/barcodesetting/fields';
import {
  screenDenial, screenDenialAny, SCREENS, ACTIONS as PERM, BARCODE_SETTING_SCREENS,
} from '@/lib/screenPermission';

/* Permission gate for this screen.

   READING THE LIST IS ALSO HOW LABELS GET GENERATED. The barcode
   generation view (components/GCRBarcodeGeneration.jsx) pulls this list and
   picks the newest row whose effective date has passed, and it is mounted
   on the GRC barcode-generation and GRC print pages - so generating labels
   would stop working if the list answered to this master alone. It answers
   to GRC and Print Label too; see BARCODE_SETTING_SCREENS.

   Writing needs this master's own permission: using the format in force is
   not the same as defining it. */
const BARCODE_SETTING = { screen: SCREENS.BARCODE_SETTING, label: 'barcode settings' };

/* /api/barcode-setting - list + create.

   Was a single-document upsert per scope, which could not represent the
   deployed screen: one row per period, each independently editable. POST now
   accepts the whole configuration ({ type, subType, periods: [...] }) and
   writes one document per period. */

const json = (d, s = 200) => Response.json(d, { status: s });
const PER_PAGE = 10;

function scopeOf(sp) {
  const filter = {};
  const b = sp.get('business'); if (b && isValidObjectId(b)) filter.businessId = b;
  const y = sp.get('finYear'); if (y) filter.finYear = y;
  return filter;
}

export async function GET(req) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const sp = new URL(req.url).searchParams;
  await dbConnect();

  const page = Math.max(1, Number(sp.get('page') || 1));
  const perPage = Math.min(500, Number(sp.get('perPage') || PER_PAGE));

  /* This master, or a screen that has to know which format is in force. */
  const denied = await screenDenialAny({
    session, screens: BARCODE_SETTING_SCREENS, action: PERM.READ,
    businessId: sp.get('business'), label: 'barcode settings',
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const filter = scopeOf(sp);

  const search = (sp.get('search') || '').trim();
  if (search) {
    const rx = { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = [
      { type: rx }, { subType: rx }, { prefix: rx },
      { suffix: rx }, { sampleBarcode: rx }, { periodLabel: rx },
    ];
  }

  const total = await BarcodeSetting.countDocuments(filter);
  const rows = await BarcodeSetting.find(filter)
    /* the natural reading order of the screen: oldest configuration first,
       then period 1..n within it */
    .sort({ createdAt: 1, periodIndex: 1 })
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

  /* Ahead of every field check below, so a refused save reads as 403 "not
     allowed" rather than as a complaint about the periods. */
  const denied = await screenDenial({
    session, ...BARCODE_SETTING, action: PERM.CREATE, businessId: body.business,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const type = String(body.type || 'Periodic');
  const subType = String(body.subType || 'Monthly');
  const periods = Array.isArray(body.periods) ? body.periods : [];

  if (!periods.length) return json({ error: 'No periods submitted' }, 400);

  /* Errors are keyed by period index so the form can highlight the offending
     block: { "2": { startNumber: "Start Number is required" } } */
  const errors = {};
  const docs = [];

  periods.forEach((p, i) => {
    const row = {
      ...p,
      type,
      subType,
      periodIndex: Number(p.periodIndex) || i + 1,
      periodLabel: p.periodLabel || subType.toUpperCase() + ' ' + (i + 1),
      /* recomputed server-side: the client shows it readonly, but nothing
         stops a crafted body from sending a mismatched value */
      sampleBarcode: sampleBarcode(p),
    };

    const { errors: rowErrors, doc, ok } = validate(ROW_FIELDS, row);
    if (!ok) errors[String(row.periodIndex)] = rowErrors;
    else {
      /* the label dropdowns resolve this row by (see models/BarcodeSetting.js) */
      doc.name = rowName(doc);
      docs.push(doc);
    }
  });

  if (Object.keys(errors).length) return json({ errors }, 422);

  if (body.business && isValidObjectId(body.business)) {
    docs.forEach((d) => { d.businessId = body.business; });
  }
  if (body.finYear) docs.forEach((d) => { d.finYear = body.finYear; });

  const created = await BarcodeSetting.create(docs);

  return json({ ok: true, count: created.length, ids: created.map((c) => String(c._id)) });
}