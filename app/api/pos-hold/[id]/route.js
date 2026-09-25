import dbConnect from '@/lib/db';
import PosHold from '@/models/PosHold';
import { requireSession } from '@/lib/session';
import { screenDenial, SCREENS, ACTIONS as PERM } from '@/lib/screenPermission';

const POS = { screen: SCREENS.POS, label: 'POS bills' };

/* Resuming a hold is GET then DELETE, so BOTH have to answer to create -
   gating the delete on POS delete would mean a cashier could pull a parked
   bill onto the screen and then fail to clear it, and the same bill could be
   resumed at a second counter and billed twice. POS delete is about deleting
   a real invoice, which is a different act. */
async function holdGate(session, hold, action) {
  return screenDenial({
    session, ...POS, action, businessId: hold?.businessId,
  });
}

/* /api/pos-hold/<id> - read one, discard one.

   Resuming is GET then DELETE: the till pulls the parked bill back onto the
   screen and the hold is removed, so the same bill cannot be resumed twice at
   two counters and end up billed twice. */

const json = (d, s = 200) => Response.json(d, {
  status: s,
  headers: { 'Cache-Control': 'no-store' },
});

export async function GET(req, { params }) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  /* Next 15 hands `params` over as a Promise - destructuring it directly
     yields undefined and every lookup silently misses. */
  const { id } = await params;
  await dbConnect();

  const doc = await PosHold.findById(id).lean();
  if (!doc) return json({ doc: null }, 404);

  let gate = await holdGate(session, doc, PERM.CREATE);
  if (gate) gate = await holdGate(session, doc, PERM.READ);
  if (gate) return json({ error: gate.message, code: gate.code }, 403);

  return json({ doc: { ...doc, _id: String(doc._id) } });
}

export async function DELETE(req, { params }) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const { id } = await params;
  await dbConnect();

  const doc = await PosHold.findById(id).select('businessId').lean();
  if (!doc) return json({ ok: true });

  let gate = await holdGate(session, doc, PERM.CREATE);
  if (gate) gate = await holdGate(session, doc, PERM.DELETE);
  if (gate) return json({ error: gate.message, code: gate.code }, 403);

  await PosHold.findByIdAndDelete(id);
  return json({ ok: true });
}
