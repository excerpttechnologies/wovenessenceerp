import { isValidObjectId, Types } from 'mongoose';
import dbConnect from '@/lib/db';
import IcDeliveryChallan from '@/models/IcDeliveryChallan';
import { requireSession } from '@/lib/session';
import { resolveRefLabels } from '@/lib/refLabels';
import { escapeRegex } from '@/lib/validate';
import { receivedInStock, restoreReturnedStock, withdrawReceivedStock } from '@/lib/icStock';
import { receiveChallan } from '@/lib/icReceive';
import StockAdjustment from '@/models/StockAdjustment';
import { nextDocNumber } from '@/lib/docnumber';
import { screenDenial, SCREENS, ACTIONS as PERM } from '@/lib/screenPermission';

/* Receiving and returning are both UPDATES to a challan somebody else raised.
   This screen creates no document and deletes none, so the Create and Delete
   ticks against it on Staff Management > Roles & Permissions have nothing to
   gate - Read controls the list, Update controls both buttons. */
const IC_RDC = {
  screen: SCREENS.IC_RECEIVE_DELIVERY_CHALLAN,
  label: 'incoming inter company challans',
};

/* The register entry every stock event in this app leaves behind.

   POS writes one of these from sell-pos/route.js - "Auto-created from POS
   invoice 0028" - and it is a RECORD, not a second movement: the stock itself
   has already moved on the barcodeLabel rows. Receiving and returning follow
   the same shape so the Stock Adjustment register reads consistently
   whichever screen caused the change. */
async function writeRegister({ businessId, locationId, finYear, type, reason, remarks, items, user }) {
  if (!items.length) return;
  const adjustmentNo = await nextDocNumber(
    StockAdjustment, 'adjustmentNo', 'Stock Adjustment', { businessId, locationId, finYear }
  );
  await StockAdjustment.create({
    businessId, locationId, finYear,
    adjustmentNo,
    type,
    adjustmentReason: reason,
    adjustmentDate: new Date(),
    remarks,
    createdBy: user?.name || user?.email || '',
    items,
  });
}

/* /api/ic-receive-delivery-challan

   The INBOX of the branch in the top bar: delivery challans somebody else
   raised and addressed HERE.

   Note which way the scope points. Every other list in this module filters on
   businessId / locationId - the branch that RAISED the document. This one
   filters on toBusinessId / toLocationId, because the question it answers is
   "what is on its way to me", not "what did I send". Passing the top bar's
   business as `businessId` here would list the branch's own outgoing
   challans, which is the opposite of the screen's purpose.

   GET  ?view=incoming (default) - challans addressed HERE.
          &received=yes for ones already accepted.
        ?view=returns - every challan with a return that THIS branch is part
          of, whichever end it stands at: ones it sent that have come back, and
          ones it received and returned from. Both sides need to see a return -
          the sender to expect the goods, the receiver to confirm what they
          sent back - so it matches on businessId OR toBusinessId.

   POST { id, business }                    - receive a challan (retry path;
                                              receipt is automatic on send).
        { id, business, action: 'return',
          lines: [{ barcodeNo, qty }] }     - return PART of a received one.

   RECEIVING MOVES STOCK - it creates barcodeLabel rows under the receiving
   business, which is what lets that branch sell the goods. The comment that
   used to sit here said no stock was moved; it had been wrong since
   receiveChallanStock() was added. See lib/icReceive.js. */

const json = (d, s = 200) => Response.json(d, {
  status: s,
  headers: { 'Cache-Control': 'no-store' },
});
const PER_PAGE = 10;

export async function GET(req) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const sp = new URL(req.url).searchParams;
  await dbConnect();

  const page = Math.max(1, Number(sp.get('page') || 1));
  const perPage = Math.min(500, Number(sp.get('perPage') || PER_PAGE));

  const business = sp.get('business');
  const location = sp.get('location');

  /* No branch in the top bar means no inbox - returning everything would show
     one branch another's incoming goods. */
  if (!business || !isValidObjectId(business)) {
    return json({ rows: [], labels: {}, total: 0, page: 1, pages: 1, perPage });
  }

  /* Only refuses when this role has a saved permission matrix that withholds
     it - see lib/screenPermission.js. */
  const denied = await screenDenial({
    session, ...IC_RDC, action: PERM.READ, businessId: business,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const view = sp.get('view') === 'returns' ? 'returns' : 'incoming';

  /* Incoming looks at where the goods are GOING; returns looks at where they
     came FROM, because a return travels back to whoever sent the challan. */
  const filter = view === 'returns'
    ? {
      /* anything with return history OR an open request - the Consignment
         page shows requests awaiting approval alongside finished returns */
      $and: [
        { $or: [{ 'returns.0': { $exists: true } }, { 'returnRequests.0': { $exists: true } }] },
        { $or: [{ businessId: business }, { toBusinessId: business }] },
      ],
    }
    : { toBusinessId: business };

  /* Location narrows the INCOMING list only. On returns the branch may be at
     either end, and pinning one side would hide the rows where it sits at the
     other - which is what stopped the receiver seeing its own return. */
  if (view === 'incoming' && location && isValidObjectId(location)) {
    filter.toLocationId = location;
  }

  const y = sp.get('finYear'); if (y) filter.finYear = y;

  if (view === 'incoming') {
    filter.receivedAt = sp.get('received') === 'yes' ? { $ne: null } : { $eq: null };
  }

  const from = sp.get('startDate');
  const to = sp.get('endDate');
  if (from) filter.dcDate = { ...(filter.dcDate || {}), $gte: new Date(from) };
  if (to) filter.dcDate = { ...(filter.dcDate || {}), $lte: new Date(to + 'T23:59:59') };

  const search = (sp.get('search') || '').trim();
  if (search) {
    const rx = { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = [{ dcNo: rx }, { customerGstn: rx }];
  }

  const total = await IcDeliveryChallan.countDocuments(filter);
  const rows = await IcDeliveryChallan.find(filter)
    .sort(view === 'returns' ? { updatedAt: -1 } : { dcDate: -1, createdAt: -1 })
    .skip((page - 1) * perPage)
    .limit(perPage)
    .lean();

  /* what the receiver still holds from each received challan, per barcode -
     the screen caps "Return Qty" at it (a sold piece cannot go back) */
  const held = await receivedInStock(rows.filter((r) => r.receivedAt).map((r) => r._id));

  return json({
    rows: rows.map((r) => ({
      ...r,
      _id: String(r._id),
      ...(r.receivedAt ? { stockLeft: Object.fromEntries(held.get(String(r._id)) || []) } : {}),
    })),
    labels: await resolveRefLabels(rows),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / perPage)),
    perPage,
  });
}

export async function POST(req) {
  try {
    return await handlePost(req);
  } catch (err) {
    /* an over-return throws with a status so the message reaches the screen
       instead of a bare 500 */
    if (err && err.status) return json({ error: err.message }, err.status);
    throw err;
  }
}

async function handlePost(req) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const body = await req.json();
  const id = String(body.id || '');
  if (!isValidObjectId(id)) return json({ error: 'A challan id is required.' }, 400);

  await dbConnect();

  const challan = await IcDeliveryChallan.findById(id)
    .select('businessId locationId toBusinessId toLocationId finYear receivedAt dcNo items returns returnRequests')
    .lean();
  if (!challan) return json({ error: 'Challan not found.' }, 404);

  const business = String(body.business || '');
  if (!isValidObjectId(business)) return json({ error: 'No business selected.' }, 400);

  /* one permission covers the whole handshake - requesting, approving and
     receiving are all updates to a challan this branch did not raise alone */
  const denied = await screenDenial({
    session, ...IC_RDC, action: PERM.UPDATE, businessId: business,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  /* ------------------------------------------- the two-step return ----

     RETURNING IS A HANDSHAKE NOW (user, 01-10-2026). The receiver no
     longer sends defective goods straight back: it RAISES A REQUEST naming
     lines and quantities, and nothing moves until somebody at the SENDING
     branch approves it - approval runs exactly the movement the old
     one-step return ran directly. A rejected request moves nothing.

     Requests live on the challan, like returns[] - a request only means
     anything against the challan it names. Writes go through the raw
     driver for the same schema-cache reason receivedAt does. */
  if (body.action === 'return') return requestReturn({ challan, body, business, session });
  if (body.action === 'approve-return') return approveReturn({ challan, body, business, session });
  if (body.action === 'reject-return') return rejectReturn({ challan, body, business, session });

  /* ------------------------------------------------------------ RECEIVE --

     Only the addressee may receive it, and only once. Checked here and not
     just in the screen, because the id arrives in the request body.

     Kept as the retry path for a despatch whose receipt failed; the
     backfill script uses the same helper. One definition of what receiving
     does lives in lib/icReceive.js so this and the send path cannot drift
     apart. */
  if (String(challan.toBusinessId) !== business) {
    return json({ error: 'This challan is not addressed to the selected branch.' }, 403);
  }

  const { received, already } = await receiveChallan({ challan, user: session });

  if (already) {
    return json({ error: 'Challan ' + (challan.dcNo || '') + ' is already received.' }, 409);
  }
  /* never report success on a write that did not happen */
  if (!received) {
    return json({ error: 'The receipt was not saved. Please try again.', code: 'NOT_PERSISTED' }, 500);
  }

  return json({ ok: true, id });
}

/* quantity per barcode already sitting in PENDING requests, so the same
   piece cannot be requested twice while the first ask waits */
const pendingByKey = (challan) => {
  const map = new Map();
  (challan.returnRequests || [])
    .filter((r) => r.status === 'pending')
    .forEach((r) => (r.lines || []).forEach((l) => {
      const key = String(l.barcodeNo || '').trim().toLowerCase();
      if (key) map.set(key, (map.get(key) || 0) + (Number(l.qty) || 0));
    }));
  return map;
};

/* The RECEIVER asks. Validated like the old direct return, PLUS the open
   requests: qty - returned - pending is what may still be asked for. */
async function requestReturn({ challan, body, business, session }) {
  if (String(challan.toBusinessId) !== business) {
    return json({ error: 'Only the branch that received the challan can request a return.' }, 403);
  }
  if (!challan.receivedAt) {
    return json({ error: 'Receive the challan before requesting a return from it.' }, 409);
  }

  const asked = Array.isArray(body.lines) ? body.lines : [];
  const wanted = new Map();
  asked.forEach((l) => {
    const key = String(l.barcodeNo || '').trim().toLowerCase();
    const qty = Number(l.qty) || 0;
    if (key && qty > 0) wanted.set(key, (wanted.get(key) || 0) + qty);
  });
  if (!wanted.size) return json({ error: 'Enter a quantity to return.' }, 400);

  const pending = pendingByKey(challan);
  /* what this store STILL HOLDS from the challan - sold pieces are gone and
     cannot be sent back, however many the challan carried */
  const inStock = (await receivedInStock([challan._id])).get(String(challan._id)) || new Map();
  const logged = [];
  for (const line of (Array.isArray(challan.items) ? challan.items : [])) {
    const key = String(line.barcodeNo || '').trim().toLowerCase();
    const want = wanted.get(key);
    if (!want) continue;

    const already = Number(line.returnedQty) || 0;
    const held = pending.get(key) || 0;
    const onHand = inStock.get(key) || 0;
    const left = Math.max(0, Math.min((Number(line.qty) || 0) - already, onHand) - held);
    if (want > left) {
      throw Object.assign(new Error(
        'Only ' + left + ' left to request on barcode ' + (line.barcodeNo || '')
        + ' - ' + onHand + ' still in stock here'
        + (held ? ', ' + held + ' already awaiting approval' : '')
        + ' (sold pieces cannot be returned).'
      ), { status: 422 });
    }
    wanted.delete(key);
    logged.push({ barcodeNo: line.barcodeNo || '', itemName: line.itemName || '', qty: want });
  }
  if (wanted.size) {
    return json({ error: 'Barcode ' + [...wanted.keys()][0] + ' is not on this challan.' }, 422);
  }

  const rid = new Types.ObjectId().toString();
  await IcDeliveryChallan.collection.updateOne(
    { _id: new Types.ObjectId(String(challan._id)) },
    {
      $push: {
        returnRequests: {
          rid,
          at: new Date(),
          by: session.name || session.email || '',
          lines: logged,
          status: 'pending',
        },
      },
    }
  );

  return json({ ok: true, rid, requested: logged });
}

/* The SENDER approves - THIS is what moves the stock: the receiver's rows
   give the quantity up and the sender's own rows take it back, exactly as
   the old one-step return did. Guarded on the request still being pending,
   so two approvers cannot run it twice. */
async function approveReturn({ challan, body, business, session }) {
  if (String(challan.businessId) !== business) {
    return json({ error: 'Only the branch that sent the challan can approve a return request.' }, 403);
  }
  const rid = String(body.rid || '');
  const request = (challan.returnRequests || []).find((r) => String(r.rid) === rid);
  if (!request) return json({ error: 'That return request was not found.' }, 404);
  if (request.status !== 'pending') {
    return json({ error: 'That request was already ' + request.status + '.' }, 409);
  }

  const wanted = new Map();
  (request.lines || []).forEach((l) => {
    const key = String(l.barcodeNo || '').trim().toLowerCase();
    if (key && Number(l.qty) > 0) wanted.set(key, (wanted.get(key) || 0) + Number(l.qty));
  });
  if (!wanted.size) return json({ error: 'That request carries no quantities.' }, 422);

  const lines = Array.isArray(challan.items) ? challan.items : [];
  /* the receiver may have SOLD pieces since asking - approving more than it
     still holds would hand the sender stock that no longer exists */
  const inStock = (await receivedInStock([challan._id])).get(String(challan._id)) || new Map();
  const logged = [];
  const nextItems = lines.map((line) => {
    const key = String(line.barcodeNo || '').trim().toLowerCase();
    const want = wanted.get(key);
    if (!want) return line;

    const onHand = inStock.get(key) || 0;
    if (want > onHand) {
      throw Object.assign(new Error(
        'The receiving store now holds only ' + onHand + ' of barcode ' + (line.barcodeNo || '')
        + ' (the rest was sold). Reject this request and ask them to raise it again.'
      ), { status: 409 });
    }
    const already = Number(line.returnedQty) || 0;
    const left = (Number(line.qty) || 0) - already;
    if (want > left) {
      throw Object.assign(new Error(
        'Only ' + left + ' left to return on barcode ' + (line.barcodeNo || '')
        + ' - the challan changed since this was requested.'
      ), { status: 409 });
    }
    wanted.delete(key);
    logged.push({ barcodeNo: line.barcodeNo || '', itemName: line.itemName || '', qty: want });
    return { ...line, returnedQty: already + want };
  });
  if (wanted.size) {
    return json({ error: 'Barcode ' + [...wanted.keys()][0] + ' is not on this challan.' }, 422);
  }

  const actedAt = new Date();
  const actedBy = session.name || session.email || '';
  const res = await IcDeliveryChallan.collection.updateOne(
    {
      _id: new Types.ObjectId(String(challan._id)),
      returnRequests: { $elemMatch: { rid, status: 'pending' } },
    },
    {
      $set: {
        items: nextItems,
        'returnRequests.$.status': 'approved',
        'returnRequests.$.actedAt': actedAt,
        'returnRequests.$.actedBy': actedBy,
      },
      $push: {
        returns: { at: actedAt, by: request.by || '', approvedBy: actedBy, lines: logged },
      },
    }
  );
  if (!res.modifiedCount) {
    return json({ error: 'That request was acted on by someone else a moment ago. Refresh and try again.' }, 409);
  }

  /* both ends move, only now: the goods leave the receiver and rejoin the
     sender's stock. After the document write, so a failure here cannot
     lose the record of the approval. */
  await withdrawReceivedStock({ challan, asked: logged });
  await restoreReturnedStock({ challan, asked: logged, user: session });

  await writeRegister({
    businessId: challan.toBusinessId,
    locationId: challan.toLocationId,
    finYear: challan.finYear || '',
    type: 'ISSUE',
    reason: 'Inter Company Return - Damaged',
    remarks: 'Returned on challan ' + (challan.dcNo || '') + ' (request approved)',
    items: logged,
    user: session,
  });

  return json({ ok: true, id: String(challan._id), returned: logged });
}

/* The SENDER declines - the request closes and nothing moves anywhere. */
async function rejectReturn({ challan, body, business, session }) {
  if (String(challan.businessId) !== business) {
    return json({ error: 'Only the branch that sent the challan can reject a return request.' }, 403);
  }
  const rid = String(body.rid || '');
  const res = await IcDeliveryChallan.collection.updateOne(
    {
      _id: new Types.ObjectId(String(challan._id)),
      returnRequests: { $elemMatch: { rid, status: 'pending' } },
    },
    {
      $set: {
        'returnRequests.$.status': 'rejected',
        'returnRequests.$.actedAt': new Date(),
        'returnRequests.$.actedBy': session.name || session.email || '',
      },
    }
  );
  if (!res.modifiedCount) {
    return json({ error: 'That request was not found, or was already acted on.' }, 409);
  }
  return json({ ok: true, id: String(challan._id) });
}
