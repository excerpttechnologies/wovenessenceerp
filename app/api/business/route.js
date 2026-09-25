// import { isValidObjectId } from 'mongoose';
// import dbConnect from '@/lib/db';
// import Business from '@/models/Business';
// import { requireSession } from '@/lib/session';
// import { validate, escapeRegex } from '@/lib/validate';
// import { FIELDS } from '@/app/admin/setting/business/fields';

// /* /api/business - list + create. */

// const json = (d, s = 200) => Response.json(d, { status: s });
// const PER_PAGE = 10;

// export async function GET(req) {
//   const session = await requireSession();
//   if (!session) return json({ error: 'Unauthorized' }, 401);

//   const sp = new URL(req.url).searchParams;
//   await dbConnect();

//   const page = Math.max(1, Number(sp.get('page') || 1));
//   const perPage = Math.min(500, Number(sp.get('perPage') || PER_PAGE));
//   const search = (sp.get('search') || '').trim();

//   const filter = {};
//   /* global - no tenant scope */

//   if (search) {
//     const rx = { $regex: escapeRegex(search), $options: 'i' };
//     filter.$or = [{ name: rx }, { businessPrintName: rx }, { landmark: rx }, { city: rx }, { state: rx }, { country: rx }, { zipCode: rx }, { addressLine1: rx }, { addressLine2: rx }, { mobile: rx }, { alternateContactNumber: rx }, { email: rx }, { websiteUrl: rx }, { gstin: rx }];
//   }

//   const total = await Business.countDocuments(filter);
//   const rows = await Business.find(filter)
//     .sort({ createdAt: -1 })
//     .skip((page - 1) * perPage)
//     .limit(perPage)
//     .lean();

//   /* resolve ObjectId columns to their display labels */
//   const labels = {};

//   return json({
//     rows: rows.map((r) => ({ ...r, _id: String(r._id) })),
//     labels,
//     total,
//     page,
//     pages: Math.max(1, Math.ceil(total / perPage)),
//     perPage,
//   });
// }

// export async function POST(req) {
//   const session = await requireSession();
//   if (!session) return json({ error: 'Unauthorized' }, 401);

//   const body = await req.json();
//   await dbConnect();

//   const { errors, doc, ok } = validate(FIELDS, body.data || {});
//   if (!ok) return json({ errors }, 422);


//   const created = await Business.create(doc);
//   return json({ ok: true, id: String(created._id) });
// }



import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import Business from '@/models/Business';
import { requireSession } from '@/lib/session';
import { validate, escapeRegex } from '@/lib/validate';
import { FIELDS } from '@/app/admin/setting/business/fields';
import { screenDenial, SCREENS, ACTIONS as PERM } from '@/lib/screenPermission';

/* Permission gate for this screen.

   THE BUSINESS MASTER IS GLOBAL - the list carries no tenant scope, and the
   page sends scope: [], so there is no business to judge against. That puts
   these two checks on the cross-business branch of screenDenial(): the role
   may browse or add branches if it holds the permission ANYWHERE. Which is
   the only reading that makes sense for a list that is not about one
   business - and it is still a real check, because a governed role that was
   never granted it is refused.

   Editing one branch is different and IS scoped to that branch - see
   ./[id]/route.js.

   THE COMPANY SELECTOR IS NOT AFFECTED. The top bar fills itself from
   /api/options?ref=business, a different endpoint, so a role refused here
   still has its company dropdown and the rest of the app keeps working. */
const BUSINESS = { screen: SCREENS.BUSINESS, label: 'businesses' };

/* /api/business - list + create. */

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
    session, ...BUSINESS, action: PERM.READ, businessId: sp.get('business'),
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const filter = {};
  /* global - no tenant scope */

  if (search) {
    const rx = { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = [{ name: rx }, { businessPrintName: rx }, { landmark: rx }, { city: rx }, { state: rx }, { country: rx }, { zipCode: rx }, { addressLine1: rx }, { addressLine2: rx }, { mobile: rx }, { alternateContactNumber: rx }, { email: rx }, { websiteUrl: rx }, { gstin: rx }];
  }

  const total = await Business.countDocuments(filter);
  const rows = await Business.find(filter)
    /* main store first, then newest - it's the parent of everything else,
       so it shouldn't drift down the list as branches are added */
    .sort({ isMainBranch: -1, createdAt: -1 })
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

  /* Ahead of validate(), so a refused branch comes back as 403 "not allowed"
     rather than 422 "your form is wrong". */
  const denied = await screenDenial({
    session, ...BUSINESS, action: PERM.CREATE, businessId: body.business,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const { errors, doc, ok } = validate(FIELDS, body.data || {});
  if (!ok) return json({ errors }, 422);

  /* Branch hierarchy is stamped here, never taken from the client. The main
     store is created once by scripts/seed.mjs; anything added through this
     form is a sub-branch of it.

     validate() only emits keys present in FIELDS, and isMainBranch isn't one
     of them, so a request body carrying "isMainBranch": true is already
     dropped before this point - these two lines make that explicit rather
     than incidental. */
  const main = await Business.findOne({ isMainBranch: true }).select('_id').lean();
  doc.isMainBranch = false;
  doc.parentBusinessId = main ? main._id : null;

  const created = await Business.create(doc);
  return json({ ok: true, id: String(created._id) });
}