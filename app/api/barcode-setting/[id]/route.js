import dbConnect from '@/lib/db';
import BarcodeSetting from '@/models/BarcodeSetting';
import { requireSession } from '@/lib/session';
import { validate } from '@/lib/validate';
import { ROW_FIELDS, sampleBarcode, rowName } from '@/app/admin/setting/barcodesetting/fields';
import { screenDenial, SCREENS, ACTIONS as PERM } from '@/lib/screenPermission';

/* The by-id route is the edit dialog and the row delete, not the
   generation view's lookup - that reads the list - so it answers to this
   master alone. */
const BARCODE_SETTING = { screen: SCREENS.BARCODE_SETTING, label: 'barcode settings' };

/* /api/barcode-setting/<id> - read one period row, update, delete.

   This route did not exist: the page had no list, so nothing could address a
   single period. The edit dialog and the row delete action both use it. */

const json = (d, s = 200) => Response.json(d, { status: s });

export async function GET(req, { params }) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const { id } = await params;
  await dbConnect();

  const doc = await BarcodeSetting.findById(id).lean();
  if (!doc) return json({ doc: null }, 404);

  /* Scoped to the row's own business, not to whichever business the screen
     happens to be switched to. */
  const denied = await screenDenial({
    session, ...BARCODE_SETTING, action: PERM.READ, businessId: doc.businessId,
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

  const existing = await BarcodeSetting.findById(id).lean();
  if (!existing) return json({ error: 'Not found' }, 404);

  /* Before validate(), and scoped on the stored row rather than on the body. */
  const denied = await screenDenial({
    session, ...BARCODE_SETTING, action: PERM.UPDATE, businessId: existing.businessId,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const incoming = body.data || {};
  const row = {
    ...incoming,
    /* type / subType / period position are fixed once created - the dialog
       shows them readonly, and they are taken from the stored row rather than
       the request so they cannot be switched underneath the list */
    type: existing.type,
    subType: existing.subType,
    periodIndex: existing.periodIndex,
    periodLabel: existing.periodLabel,
    sampleBarcode: sampleBarcode(incoming),
  };

  const { errors, doc, ok } = validate(ROW_FIELDS, row);
  if (!ok) return json({ errors }, 422);

  /* kept in step with the edited values, so dropdown labels don't keep
     showing the pre-edit barcode */
  doc.name = rowName(doc);

  const updated = await BarcodeSetting.findByIdAndUpdate(id, doc, { new: true, runValidators: true });
  if (!updated) return json({ error: 'Not found' }, 404);

  return json({ ok: true, id });
}

export async function DELETE(req, { params }) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const { id } = await params;
  await dbConnect();

  const target = await BarcodeSetting.findById(id).select('businessId').lean();
  if (!target) return json({ ok: true });

  const denied = await screenDenial({
    session, ...BARCODE_SETTING, action: PERM.DELETE, businessId: target.businessId,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  await BarcodeSetting.findByIdAndDelete(id);
  return json({ ok: true });
}