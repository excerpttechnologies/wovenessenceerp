import { isValidObjectId, Types } from 'mongoose';
import dbConnect from '@/lib/db';
import IcDeliveryChallan from '@/models/IcDeliveryChallan';
import { requireSession } from '@/lib/session';
import { resolveRefLabels } from '@/lib/refLabels';
import { escapeRegex } from '@/lib/validate';
import { restoreReturnedStock, withdrawReceivedStock } from '@/lib/icStock';
import { receiveChallan } from '@/lib/icReceive';
import StockAdjustment from '@/models/StockAdjustment';
import { nextDocNumber } from '@/lib/docnumber';

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

  const view = sp.get('view') === 'returns' ? 'returns' : 'incoming';

  /* Incoming looks at where the goods are GOING; returns looks at where they
     came FROM, because a return travels back to whoever sent the challan. */
  const filter = view === 'returns'
    ? {
      'returns.0': { $exists: true },
      $or: [{ businessId: business }, { toBusinessId: business }],
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
    .select('businessId locationId toBusinessId toLocationId finYear receivedAt dcNo items returns').lean();
  if (!challan) return json({ error: 'Challan not found.' }, 404);

  /* Only the addressee may receive it, and only once. Checked here and not
     just in the screen, because the id arrives in the request body. */
  const business = String(body.business || '');
  if (!isValidObjectId(business) || String(challan.toBusinessId) !== business) {
    return json({ error: 'This challan is not addressed to the selected branch.' }, 403);
  }
  /* ---------------------------------------------------------- RETURN ----

     Part of a received challan going back: the receiver keeps what is sound
     and sends the damaged quantity back to whoever shipped it.

     Recorded on the CHALLAN, not in a collection of its own. A return only
     ever means something relative to the challan it came from - which
     barcode, out of how many, against which document - and splitting that
     across two collections buys nothing while giving the two a chance to
     disagree.

     `returnedQty` on each line is the running total, so the remaining
     returnable quantity is qty - returnedQty and a line cannot be returned
     twice over. `returns[]` keeps each event, so the sender can see what came
     back and when rather than just a final number. */
  if (body.action === 'return') {
    if (!challan.receivedAt) {
      return json({ error: 'Receive the challan before returning anything from it.' }, 409);
    }

    const asked = Array.isArray(body.lines) ? body.lines : [];
    const wanted = new Map();
    asked.forEach((l) => {
      const key = String(l.barcodeNo || '').trim().toLowerCase();
      const qty = Number(l.qty) || 0;
      if (key && qty > 0) wanted.set(key, (wanted.get(key) || 0) + qty);
    });
    if (!wanted.size) return json({ error: 'Enter a quantity to return.' }, 400);

    const lines = Array.isArray(challan.items) ? challan.items : [];
    const logged = [];
    const nextItems = lines.map((line) => {
      const key = String(line.barcodeNo || '').trim().toLowerCase();
      const want = wanted.get(key);
      if (!want) return line;

      const already = Number(line.returnedQty) || 0;
      const left = (Number(line.qty) || 0) - already;
      if (want > left) {
        throw Object.assign(new Error(
          'Only ' + left + ' left to return on barcode ' + (line.barcodeNo || '') + '.'
        ), { status: 422 });
      }

      wanted.delete(key);
      logged.push({ barcodeNo: line.barcodeNo || '', itemName: line.itemName || '', qty: want });
      return { ...line, returnedQty: already + want };
    });

    if (wanted.size) {
      return json({ error: 'Barcode ' + [...wanted.keys()][0] + ' is not on this challan.' }, 422);
    }

    await IcDeliveryChallan.collection.updateOne(
      { _id: new Types.ObjectId(id) },
      {
        $set: { items: nextItems },
        $push: {
          returns: {
            at: new Date(),
            by: session.name || session.email || '',
            lines: logged,
          },
        },
      }
    );

    /* The returned quantity goes back into the SENDING branch's stock - it
       left there when the challan was raised. Done after the document is
       written so a failure here cannot lose the record of the return. */
    /* both ends move: the damaged goods leave this branch and rejoin the
       sender's stock */
    await withdrawReceivedStock({ challan, asked: logged });
    await restoreReturnedStock({ challan, asked: logged, user: session });

    await writeRegister({
      businessId: challan.toBusinessId,
      locationId: challan.toLocationId,
      finYear: challan.finYear || '',
      type: 'ISSUE',
      reason: 'Inter Company Return - Damaged',
      remarks: 'Returned on challan ' + (challan.dcNo || ''),
      items: logged,
      user: session,
    });

    return json({ ok: true, id, returned: logged });
  }

  /* ------------------------------------------------------------ RECEIVE --

     Receipt is now automatic: /api/ic-delivery-challan lands the goods at the
     destination in the same request that ships them, so nothing normally
     reaches this branch any more. It is kept because it is the retry path for
     a despatch whose receipt failed, and the backfill script uses the same
     helper - removing it would leave no way to complete a stranded challan.

     One definition of what receiving does lives in lib/icReceive.js so this
     and the send path cannot drift apart. */
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
