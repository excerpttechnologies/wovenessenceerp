import dbConnect from '@/lib/db';
import PosReturn from '@/models/PosReturn';
import { requireSession } from '@/lib/session';
import { validate } from '@/lib/validate';
import { screenDenial, SCREENS, ACTIONS as PERM } from '@/lib/screenPermission';

const POS_RETURN = { screen: SCREENS.POS_RETURN, label: 'POS returns' };
const FIELDS = [];

/* /api/sell-pos-return/<id> - read one, update, delete. */

const json = (d, s = 200) => Response.json(d, { status: s });

export async function GET(req, { params }) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const { id } = await params;
  await dbConnect();

  const doc = await PosReturn.findById(id).lean();
  if (!doc) return json({ doc: null }, 404);

  /* Scoped to the credit note's own business, not to whichever business the
     screen happens to be switched to - otherwise a restricted role could read
     a neighbouring branch's refund through the company selector. */
  const denied = await screenDenial({
    session, ...POS_RETURN, action: PERM.READ, businessId: doc.businessId,
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

  /* Before validate(), and scoped on the stored record rather than on the
     body, so the caller cannot name a business it may edit and then save over
     one it may not. */
  const target = await PosReturn.findById(id).select('businessId').lean();
  if (!target) return json({ error: 'Not found' }, 404);

  const denied = await screenDenial({
    session, ...POS_RETURN, action: PERM.UPDATE, businessId: target.businessId,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const { errors, doc, ok } = validate(FIELDS, body.data || {});
  if (!ok) return json({ errors }, 422);

  if (Array.isArray(body.data?.items)) doc.items = body.data.items;

  /* never overwrite the document number on edit */
  delete doc.invoiceNo;

  const updated = await PosReturn.findByIdAndUpdate(id, doc, { new: true, runValidators: true });
  if (!updated) return json({ error: 'Not found' }, 404);

  return json({ ok: true, id });
}

export async function DELETE(req, { params }) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const { id } = await params;
  await dbConnect();

  const target = await PosReturn.findById(id).select('businessId').lean();
  if (!target) return json({ ok: true });

  const denied = await screenDenial({
    session, ...POS_RETURN, action: PERM.DELETE, businessId: target.businessId,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  await PosReturn.findByIdAndDelete(id);
  return json({ ok: true });
}
