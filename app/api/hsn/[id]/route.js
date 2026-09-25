// import dbConnect from '@/lib/db';
// import Hsn from '@/models/Hsn';
// import { requireSession } from '@/lib/session';
// import { validate } from '@/lib/validate';
// import { FIELDS } from '@/app/admin/setting/hsn/fields';

// /* /api/hsn/<id> - read one, update, delete. */

// const json = (d, s = 200) => Response.json(d, { status: s });

// export async function GET(req, { params }) {
//   const session = await requireSession();
//   if (!session) return json({ error: 'Unauthorized' }, 401);

//   const { id } = await params;
//   await dbConnect();

//   const doc = await Hsn.findById(id).lean();
//   if (!doc) return json({ doc: null }, 404);
//   return json({ doc: { ...doc, _id: String(doc._id) } });
// }

// export async function PUT(req, { params }) {
//   const session = await requireSession();
//   if (!session) return json({ error: 'Unauthorized' }, 401);

//   const { id } = await params;
//   const body = await req.json();
//   await dbConnect();

//   const { errors, doc, ok } = validate(FIELDS, body.data || {});
//   if (!ok) return json({ errors }, 422);

//   const updated = await Hsn.findByIdAndUpdate(id, doc, { new: true, runValidators: true });
//   if (!updated) return json({ error: 'Not found' }, 404);

//   return json({ ok: true, id });
// }

// export async function DELETE(req, { params }) {
//   const session = await requireSession();
//   if (!session) return json({ error: 'Unauthorized' }, 401);

//   const { id } = await params;
//   await dbConnect();

//   await Hsn.findByIdAndDelete(id);
//   return json({ ok: true });
// }






/* FILE: app/api/hsn/[id]/route.js */
import dbConnect from '@/lib/db';
import Hsn from '@/models/Hsn';
import { requireSession } from '@/lib/session';
import { validate } from '@/lib/validate';
import { FIELDS, ROWS_TABLE } from '@/app/admin/setting/hsn/fields';
import {
  screenDenial, screenDenialAny, SCREENS, ACTIONS as PERM, HSN_LOOKUP_SCREENS,
} from '@/lib/screenPermission';

const HSN = { screen: SCREENS.HSN, label: 'HSN codes' };

/* /api/hsn/<id> - read one, update, delete. */

const json = (d, s = 200) => Response.json(d, { status: s });

export async function GET(req, { params }) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const { id } = await params;
  await dbConnect();

  const doc = await Hsn.findById(id).lean();
  if (!doc) return json({ doc: null }, 404);

  /* Same rule as the list: the master, or a screen that resolves a rate.
     A picked HSN is read back through here by the forms that store one. */
  const denied = await screenDenialAny({
    session, screens: HSN_LOOKUP_SCREENS, action: PERM.READ,
    businessId: doc.businessId, label: 'HSN codes',
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  return json({ doc: { ...doc, _id: String(doc._id) } });
}

export async function PUT(req, { params }) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const { id } = await params;
  const body = await req.json();
  await dbConnect();

  /* Before validate(), and on the master alone. Scoped on the stored record. */
  const target = await Hsn.findById(id).select('businessId').lean();
  if (!target) return json({ error: 'Not found' }, 404);

  const denied = await screenDenial({
    session, ...HSN, action: PERM.UPDATE, businessId: target.businessId,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const { errors, doc, ok } = validate(FIELDS, body.data || {});
  if (!ok) return json({ errors }, 422);

  /* the Tax Slabs row table is not a declared field, so validate() drops it -
     carried across explicitly, otherwise every HSN saves with no GST rate */
  if (Array.isArray(body.data?.[ROWS_TABLE.key])) {
    doc[ROWS_TABLE.key] = body.data[ROWS_TABLE.key];
  }

  const updated = await Hsn.findByIdAndUpdate(id, doc, { new: true, runValidators: true });
  if (!updated) return json({ error: 'Not found' }, 404);

  return json({ ok: true, id });
}

export async function DELETE(req, { params }) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const { id } = await params;
  await dbConnect();

  const target = await Hsn.findById(id).select('businessId').lean();
  if (!target) return json({ ok: true });

  const denied = await screenDenial({
    session, ...HSN, action: PERM.DELETE, businessId: target.businessId,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  await Hsn.findByIdAndDelete(id);
  return json({ ok: true });
}