// import { isValidObjectId } from 'mongoose';
// import dbConnect from '@/lib/db';
// import { Customer } from '@/lib/contacts';
// import { requireSession } from '@/lib/session';
// import { resolveRefLabels } from '@/lib/refLabels';
// import { validate, escapeRegex } from '@/lib/validate';
// import { TABS } from '@/app/admin/contact/customer/tabs';

// import ContactType from '@/models/ContactType';
// import { nextContactId } from '@/lib/contactId';

// const FIELDS = TABS.flatMap((t) => (t.sections || []).flatMap((s) => [
//   ...(s.fields || []),
//   ...(s.toggle ? [{ k: s.toggle.k, label: s.toggle.label, type: 'checkbox' }] : []),
// ]));

// /* /api/customer - list + create. */

// const json = (d, s = 200) => Response.json(d, {
//   status: s,
//   headers: { 'Cache-Control': 'no-store' },
// });
// const PER_PAGE = 10;
// /* The POS quick-add contract. Anything not named here is dropped on save, so
//    this list has to stay in step with the dialog in components/PosTill.jsx -
//    a field the form offers but this omits saves silently as blank.

//    Widened to cover the whole Basic Information tab of the full customer form
//    (short name, DOB, gender, and the complete billing block) because the till's
//    dialog now mirrors that layout. Still deliberately excludes the Sales and
//    Financial tabs and the shipping block - the counter does not collect them. */
// const QUICK_FIELDS = FIELDS.filter((field) => [
//   'typeId', 'businessType', 'gstNo', 'businessName', 'shortName',
//   'prefix', 'firstName', 'middleName', 'lastName', 'dob', 'gender',
//   'billingAddressLine1', 'billingAddressLine2', 'billingCity', 'billingState',
//   'billingCountry', 'billingDistrict', 'billingTaluk', 'billingZipCode',
//   'billingMobile', 'billingAlternateContactNumber', 'billingLandline', 'billingFax',
//   'billingEmail', 'billingEmail2', 'billingWebsiteUrl',
//   'additionalDetails',
// ].includes(field.k));

// export async function GET(req) {
//   const session = await requireSession();
//   if (!session) return json({ error: 'Unauthorized' }, 401);

//   const sp = new URL(req.url).searchParams;
//   await dbConnect();

//   const page = Math.max(1, Number(sp.get('page') || 1));
//   const perPage = Math.min(500, Number(sp.get('perPage') || PER_PAGE));
//   const search = (sp.get('search') || '').trim();

//   const filter = {};
//   const b = sp.get('business'); if (b && isValidObjectId(b)) filter.businessId = b;
//   /* pinned server-side so the discriminator can't be spoofed */
//   filter.contactKind = 'Customer';

//   if (search) {
//     const rx = { $regex: escapeRegex(search), $options: 'i' };
//     filter.$or = [{ gstNo: rx }, { businessName: rx }, { shortName: rx }, { firstName: rx }, { middleName: rx }, { lastName: rx }, { userName: rx }, { billingAddressLine1: rx }, { billingMobile: rx }, { billingAlternateContactNumber: rx }];
//   }

//   const total = await Customer.countDocuments(filter);
//   const rows = await Customer.find(filter)
//     .sort({ createdAt: -1 })
//     .skip((page - 1) * perPage)
//     .limit(perPage)
//     .lean();

//   return json({
//     rows: rows.map((r) => ({ ...r, _id: String(r._id) })),
//     labels: await resolveRefLabels(rows),
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

//   /* POS quick-add deliberately omits the full customer page's sales and
//      ledger tabs. Keep that smaller contract explicit instead of making those
//      fields optional for every customer submission. */
//   const fields = body.quick ? QUICK_FIELDS : FIELDS;
//   const quickData = body.quick
//     ? { priceList: 'ON RSP', openingBalance: 0, ...(body.data || {}) }
//     : body.data || {};
//   const { errors, doc, ok } = validate(fields, quickData);
//   if (!ok) return json({ errors }, 422);
//   if (body.business && isValidObjectId(body.business)) doc.businessId = body.business;

//   /* stamped here, never taken from the client */
//   doc.contactKind = 'Customer';
//   doc.contactId = await nextContactId(ContactType, doc.typeId);

//   const created = await Customer.create(doc);
//   return json({
//     ok: true,
//     id: String(created._id),
//     customer: {
//       _id: String(created._id),
//       businessId: created.businessId ? String(created.businessId) : '',
//       contactKind: created.contactKind,
//       contactId: created.contactId,
//       businessName: created.businessName || '',
//       firstName: created.firstName || '',
//       lastName: created.lastName || '',
//       billingMobile: created.billingMobile || '',
//     },
//   });
// }




//sagar


import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import Contact from '@/models/Contact';
import { requireSession } from '@/lib/session';
import { resolveRefLabels } from '@/lib/refLabels';
import { validate, escapeRegex } from '@/lib/validate';
import { TABS } from '@/app/admin/contact/customer/tabs';

import ContactType from '@/models/ContactType';
import { nextContactId } from '@/lib/contactId';
import { screenDenial, SCREENS, ACTIONS as PERM } from '@/lib/screenPermission';

const CUSTOMER = { screen: SCREENS.CUSTOMER, label: 'customers' };

const FIELDS = TABS.flatMap((t) => (t.sections || []).flatMap((s) => [
  ...(s.fields || []),
  ...(s.toggle ? [{ k: s.toggle.k, label: s.toggle.label, type: 'checkbox' }] : []),
]));

/* /api/customer - list + create. */

const json = (d, s = 200) => Response.json(d, {
  status: s,
  headers: { 'Cache-Control': 'no-store' },
});
const PER_PAGE = 10;
/* The POS quick-add contract. Anything not named here is dropped on save, so
   this list has to stay in step with the dialog in components/PosTill.jsx -
   a field the form offers but this omits saves silently as blank.

   Widened to cover the whole Basic Information tab of the full customer form
   (short name, DOB, gender, and the complete billing block) because the till's
   dialog now mirrors that layout. Still deliberately excludes the Sales and
   Financial tabs and the shipping block - the counter does not collect them. */
const QUICK_FIELDS = FIELDS.filter((field) => [
  'typeId', 'businessType', 'gstNo', 'businessName', 'shortName',
  'prefix', 'firstName', 'middleName', 'lastName', 'dob', 'gender',
  'billingAddressLine1', 'billingAddressLine2', 'billingCity', 'billingState',
  'billingCountry', 'billingDistrict', 'billingTaluk', 'billingZipCode',
  'billingMobile', 'billingAlternateContactNumber', 'billingLandline', 'billingFax',
  'billingEmail', 'billingEmail2', 'billingWebsiteUrl',
  'additionalDetails',
].includes(field.k));

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
    session, ...CUSTOMER, action: PERM.READ, businessId: sp.get('business'),
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const filter = {};
  const b = sp.get('business'); if (b && isValidObjectId(b)) filter.businessId = b;
  /* pinned server-side so the discriminator can't be spoofed */
  filter.contactKind = 'Customer';

  if (search) {
    const rx = { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = [{ gstNo: rx }, { businessName: rx }, { shortName: rx }, { firstName: rx }, { middleName: rx }, { lastName: rx }, { userName: rx }, { billingAddressLine1: rx }, { billingMobile: rx }, { billingAlternateContactNumber: rx }];
  }

  const total = await Contact.countDocuments(filter);
  const rows = await Contact.find(filter)
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

  /* POS quick-add deliberately omits the full customer page's sales and
     ledger tabs. Keep that smaller contract explicit instead of making those
     fields optional for every customer submission. */
  /* ALSO COVERS THE TILL'S QUICK-ADD (body.quick). Creating a customer is
     creating a customer wherever the form lives, so the permission that
     governs it is Customers > Create - a counter that should be able to add a
     walk-in needs that ticked for its role. Gating quick-add on the POS screen
     instead would give one question two answers.

     Asked before the fields are validated: a request that is not allowed to
     happen should be refused as not allowed. */
  const denied = await screenDenial({
    session, ...CUSTOMER, action: PERM.CREATE, businessId: body.business,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const fields = body.quick ? QUICK_FIELDS : FIELDS;
  const quickData = body.quick
    ? { priceList: 'ON RSP', openingBalance: 0, ...(body.data || {}) }
    : body.data || {};
  const { errors, doc, ok } = validate(fields, quickData);
  if (!ok) return json({ errors }, 422);
  if (body.business && isValidObjectId(body.business)) doc.businessId = body.business;

  /* stamped here, never taken from the client */
  doc.contactKind = 'Customer';
  /* Two arguments, not three. nextContactId(ContactType, typeId) takes the
     Contact Type model and the chosen type's id; the extra Contact model this
     used to pass landed in the typeId slot, and a Mongoose model is a
     function, so findById() read it as a callback and threw. Suppliers and
     agents have always called it this way. */
  doc.contactId = await nextContactId(ContactType, doc.typeId);

  const created = await Contact.create(doc);
  return json({
    ok: true,
    id: String(created._id),
    customer: {
      _id: String(created._id),
      businessId: created.businessId ? String(created.businessId) : '',
      contactKind: created.contactKind,
      contactId: created.contactId,
      businessName: created.businessName || '',
      firstName: created.firstName || '',
      lastName: created.lastName || '',
      billingMobile: created.billingMobile || '',
    },
  });
}
