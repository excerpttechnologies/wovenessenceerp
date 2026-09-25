import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import PosHold from '@/models/PosHold';
import { requireSession } from '@/lib/session';
import { screenDenial, SCREENS, ACTIONS as PERM } from '@/lib/screenPermission';

/* A PARKED BILL IS PART OF MAKING A SALE, not a document of its own, so it
   answers to the POS screen rather than to one of its own. Parking needs
   create - it is a sale in progress. Listing them accepts read OR create,
   for the same reason the exchange lookup does. */
const POS = { screen: SCREENS.POS, label: 'POS bills' };

/* /api/pos-hold - list + create.

   Parked POS bills. Scoped to the business, location and financial year the
   till is standing in, so a cashier only ever sees holds from their own
   counter. Newest first, because the one just parked is the one most likely
   to be picked up again. */

const json = (d, s = 200) => Response.json(d, {
  status: s,
  headers: { 'Cache-Control': 'no-store' },
});

export async function GET(req) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const sp = new URL(req.url).searchParams;
  await dbConnect();

  let gate = await screenDenial({
    session, ...POS, action: PERM.READ, businessId: sp.get('business'),
  });
  if (gate) {
    gate = await screenDenial({
      session, ...POS, action: PERM.CREATE, businessId: sp.get('business'),
    });
  }
  if (gate) return json({ error: gate.message, code: gate.code }, 403);

  const filter = {};
  const b = sp.get('business'); if (b && isValidObjectId(b)) filter.businessId = b;
  const l = sp.get('location'); if (l && isValidObjectId(l)) filter.locationId = l;
  const y = sp.get('finYear'); if (y) filter.finYear = y;

  const rows = await PosHold.find(filter).sort({ createdAt: -1 }).limit(50).lean();

  return json({
    rows: rows.map((r) => ({ ...r, _id: String(r._id) })),
    total: rows.length,
  });
}

export async function POST(req) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const body = await req.json();
  await dbConnect();

  /* Ahead of the empty-cart check, so a refused hold reads as 403 rather
     than as a complaint about the cart. */
  const denied = await screenDenial({
    session, ...POS, action: PERM.CREATE, businessId: body.business,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const data = body.data || {};

  /* An empty cart is not worth parking, and a hold with no lines would sit in
     the list forever with nothing to resume. */
  const items = Array.isArray(data.items) ? data.items : [];
  if (!items.length) return json({ error: 'Add an item before holding the bill.' }, 422);

  const doc = {
    businessId: body.business && isValidObjectId(body.business) ? body.business : null,
    locationId: body.location && isValidObjectId(body.location) ? body.location : null,
    finYear: body.finYear || '',

    /* Time-of-day label, which is how a cashier actually refers to a parked
       bill ("the one from just before lunch"). Not a document number - a hold
       is not a document and must not consume a series. */
    holdNo: data.holdNo || new Date().toTimeString().slice(0, 5),
    date: data.date ? new Date(data.date) : new Date(),

    customerId: data.customerId && isValidObjectId(data.customerId) ? data.customerId : null,
    customerName: String(data.customerName || ''),
    customerContact: String(data.customerContact || ''),
    customerSnapshot: data.customerSnapshot || null,
    counterId: data.counterId && isValidObjectId(data.counterId) ? data.counterId : null,
    billingType: String(data.billingType || ''),
    exempted: String(data.exempted || 'NO'),
    salesPerson: String(data.salesPerson || ''),

    items,
    shipping: Number(data.shipping || 0),
    totalAmount: Number(data.totalAmount || 0),
    totalQty: Number(data.totalQty || 0),
    createdBy: session?.name || session?.email || '',
  };

  const created = await PosHold.create(doc);
  return json({ ok: true, id: String(created._id), holdNo: created.holdNo });
}
