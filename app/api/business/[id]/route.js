// import dbConnect from '@/lib/db';
// import Business from '@/models/Business';
// import { requireSession } from '@/lib/session';
// import { validate } from '@/lib/validate';
// import { FIELDS } from '@/app/admin/setting/business/fields';

// /* /api/business/<id> - read one, update, delete. */

// const json = (d, s = 200) => Response.json(d, { status: s });

// export async function GET(req, { params }) {
//   const session = await requireSession();
//   if (!session) return json({ error: 'Unauthorized' }, 401);

//   const { id } = await params;
//   await dbConnect();

//   const doc = await Business.findById(id).lean();
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

//   const updated = await Business.findByIdAndUpdate(id, doc, { new: true, runValidators: true });
//   if (!updated) return json({ error: 'Not found' }, 404);

//   return json({ ok: true, id });
// }

// export async function DELETE(req, { params }) {
//   const session = await requireSession();
//   if (!session) return json({ error: 'Unauthorized' }, 401);

//   const { id } = await params;
//   await dbConnect();

//   await Business.findByIdAndDelete(id);
//   return json({ ok: true });
// }





import dbConnect from '@/lib/db';
import Business from '@/models/Business';
import { requireSession } from '@/lib/session';
import { validate } from '@/lib/validate';
import { FIELDS } from '@/app/admin/setting/business/fields';
import {
  screenDenial, screenDenialAny, SCREENS, ACTIONS as PERM, BUSINESS_HEADER_SCREENS,
} from '@/lib/screenPermission';

const BUSINESS = { screen: SCREENS.BUSINESS, label: 'businesses' };

/* /api/business/<id> - read one, update, delete. */

const json = (d, s = 200) => Response.json(d, { status: s });

export async function GET(req, { params }) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const { id } = await params;
  await dbConnect();

  const doc = await Business.findById(id).lean();
  if (!doc) return json({ doc: null }, 404);

  /* READING ONE BUSINESS IS THE COMPANY LETTERHEAD, not the master screen.
     The IC challan form and print view fetch both branches by id, and the GRT
     list fetches its own - so this answers to any of those screens as well as
     to the Business master. See BUSINESS_HEADER_SCREENS.

     Deliberately NOT scoped to the branch being fetched: an inter-company
     challan names two companies, and scoping would refuse the receiving
     branch's half of a document the operator is allowed to print. */
  const denied = await screenDenialAny({
    session, screens: BUSINESS_HEADER_SCREENS, action: PERM.READ, label: 'businesses',
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

  /* Before validate(), and scoped to the branch BEING EDITED - a branch's own
     details answer to the matrix saved with that branch selected in the top
     bar, so permission over one company does not carry to another. */
  const target = await Business.findById(id).select('_id').lean();
  if (!target) return json({ error: 'Not found' }, 404);

  const denied = await screenDenial({
    session, ...BUSINESS, action: PERM.UPDATE, businessId: target._id,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const { errors, doc, ok } = validate(FIELDS, body.data || {});
  if (!ok) return json({ errors }, 422);

  /* isMainBranch and parentBusinessId are not in FIELDS, so validate() never
     emits them and this update leaves whatever is stored untouched. That is
     what keeps the main store from being demoted - or a sub-branch promoted -
     through the edit form. */
  const updated = await Business.findByIdAndUpdate(id, doc, { new: true, runValidators: true });
  if (!updated) return json({ error: 'Not found' }, 404);

  return json({ ok: true, id });
}

export async function DELETE(req, { params }) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const { id } = await params;
  await dbConnect();

  /* The main store is the parent of every other branch and the anchor for the
     seeded reference data, so deleting it would orphan the lot. */
  const target = await Business.findById(id).select('isMainBranch').lean();
  if (!target) return json({ ok: true });

  /* Scoped to the branch being deleted, exactly as the edit above is. Checked
     before the main-branch rule so a role that may not delete at all is told
     that, rather than being told which branch it may not delete. */
  const denied = await screenDenial({
    session, ...BUSINESS, action: PERM.DELETE, businessId: target._id,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  if (target.isMainBranch) {
    return json(
      { error: 'The main branch cannot be deleted. Only sub-branches can be removed.' },
      409
    );
  }

  await Business.findByIdAndDelete(id);
  return json({ ok: true });
}