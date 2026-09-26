import { isValidObjectId, Types } from 'mongoose';
import dbConnect from '@/lib/db';
import IcDeliveryChallan from '@/models/IcDeliveryChallan';
import { requireSession } from '@/lib/session';
import { screenDenial, SCREENS, ACTIONS as PERM } from '@/lib/screenPermission';

const IC_DC = { screen: SCREENS.IC_DELIVERY_CHALLAN, label: 'inter company delivery challans' };

import { resolveRefLabels } from '@/lib/refLabels';
import { validate, escapeRegex } from '@/lib/validate';
import Business from '@/models/Business';
import { reserveSequence } from '@/models/Counter';
import { checkRoute } from '@/lib/icRouting';
import { shipChallanStock, IcStockError } from '@/lib/icStock';
import { FIELDS, TOTAL_KEYS, computeTotals } from '@/app/admin/transaction/intercompanysell/deliverychallan/fields';

/* /api/ic-delivery-challan - list + create. */

const json = (d, s = 200) => Response.json(d, { status: s });
const PER_PAGE = 10;

/* ---------------------------------------------------------- DC number ----

   DC/26-27/TF/1000

     DC     fixed
     26-27  the financial year, short form
     TF     the branch RAISING the challan - Temple Fabrics. Suvarna Fabrics
            gives SF, Omshree Fabs OF.
     1000   a running number, per branch and per financial year

   Built here rather than through lib/docnumber.js and the Doc Setup master
   on purpose: this format is fixed for inter company challans and is not
   meant to be re-configured per business.

   The running number still comes from models/Counter.js, so it is atomic -
   two challans saved at the same moment cannot take the same number, and
   deleting one does not hand its number to the next. */

const FY_SHORT = (finYear) => {
  const [a, b] = String(finYear || '').split('-');
  return a && b ? a.slice(2) + '-' + b.slice(2) : String(finYear || '');
};

/* Initials of the first two meaningful words of the branch name.

   Anything in brackets is dropped first - "OMSHREE FABS (TEMPLE FABRICS,
   SILKS AND SAREES)" is Omshree Fabs, and carrying the parent's name into
   the code would make every branch read TF. */
const BRANCH_CODE = (name) => {
  const words = String(name || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^A-Za-z ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const code = words.slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return code || 'XX';
};

async function nextDcNo({ businessId, finYear }) {
  const business = businessId
    ? await Business.findById(businessId).select('name').lean()
    : null;

  const branch = BRANCH_CODE(business && business.name);
  const fy = FY_SHORT(finYear);

  /* one series per branch per year - the counter name carries both, so
     Suvarna's numbering is independent of Temple Fabrics' */
  const seq = await reserveSequence('icDcNo|' + branch, { businessId, finYear }, 1);

  return ['DC', fy, branch, 999 + seq].join('/');
}

/* Totals are RECOMPUTED here from the line items rather than trusted from the
   form, the way the Transport module handles freight. A request carrying its
   own taxableValue or netValue has those values ignored. */
function applyTotals(doc, body) {
  const items = Array.isArray(body.data?.items) ? body.data.items : [];
  const t = computeTotals(items, {
    discountPercent: body.data?.discountPercent,
    roundOffDiscountAmt: body.data?.roundOffDiscountAmt,
  });

  doc.items = items;
  doc.discountPercent = Number(body.data?.discountPercent) || 0;
  doc.roundOffDiscountAmt = Number(body.data?.roundOffDiscountAmt) || 0;
  doc.taxableValue = t.taxableValue;
  doc.igstTotal = t.igstTotal;
  doc.cgstTotal = t.cgstTotal;
  doc.sgstTotal = t.sgstTotal;
  doc.roundOff = t.roundOff;
  doc.totalQty = t.totalQty;
  doc.netValue = t.netValue;
}

export async function GET(req) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const sp = new URL(req.url).searchParams;
  await dbConnect();

  /* Only refuses when this role has a saved permission matrix that withholds
     it - see lib/screenPermission.js. */
  const denied = await screenDenial({
    session, ...IC_DC, action: PERM.READ, businessId: sp.get('business'),
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const page = Math.max(1, Number(sp.get('page') || 1));
  const perPage = Math.min(500, Number(sp.get('perPage') || PER_PAGE));

  const filter = {};
  const b = sp.get('business'); if (b && isValidObjectId(b)) filter.businessId = b;
  const l = sp.get('location'); if (l && isValidObjectId(l)) filter.locationId = l;
  const y = sp.get('finYear'); if (y) filter.finYear = y;

  /* the Sales Invoice picker asks for one destination at a time */
  const tb = sp.get('toBusinessId'); if (tb && isValidObjectId(tb)) filter.toBusinessId = tb;
  const tl = sp.get('toLocationId'); if (tl && isValidObjectId(tl)) filter.toLocationId = tl;

  const from = sp.get('startDate');
  const to = sp.get('endDate');
  if (from) filter.dcDate = { ...(filter.dcDate || {}), $gte: new Date(from) };
  if (to) filter.dcDate = { ...(filter.dcDate || {}), $lte: new Date(to + 'T23:59:59') };

  /* WHICH HALF OF THE BOOK: waiting for the receiver, or accepted by them.

     The Delivery Challan screen shows two sections and asks once for each.
     receivedAt is stamped by lib/icReceive.js when somebody standing in the
     DESTINATION branch approves the challan, so null is "still sitting there"
     and a date is "landed".

     $eq/$ne null both match a MISSING field as well as a null one, which
     matters for challans written before receivedAt joined the schema.

     Absent means no condition at all, so every other caller of this route -
     the Sales Invoice picker, the print screens - is unaffected. */
  const received = sp.get('received');
  if (received === 'yes') filter.receivedAt = { $ne: null };
  if (received === 'no') filter.receivedAt = { $eq: null };

  /* "unconverted" challans: no inter company sales invoice raised yet.
     $eq: null matches missing AND null - passing '' here would be cast
     against an ObjectId path and throw. */
  const unconverted = sp.get('unconverted');
  if (unconverted) filter[unconverted] = { $eq: null };

  const search = (sp.get('search') || '').trim();
  if (search) {
    const rx = { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = [{ dcNo: rx }, { customerGstn: rx }, { customerAddress: rx }];
  }

  const total = await IcDeliveryChallan.countDocuments(filter);

  /* THE SUMMARY BOXES REPORT THE WHOLE BOOK, not the half in the table below
     them. The two sections each ask with their own `received`, so honouring
     that split here too would make Total DC No read 23 on a screen holding 25
     challans - it would count the section the boxes happen to sit above.

     Only the received condition is dropped. To Business, the dates and the
     search are all still applied, so the boxes react to the filter exactly as
     they did before there were two sections. With no `received` in the query
     this is the same object as `filter`, so every other caller is unchanged.

     `total` above is left alone - that one drives pagination, which must
     count the rows actually being paged through. */
  const { receivedAt: _receivedSplit, ...summaryFilter } = filter;
  const summaryTotal = received
    ? await IcDeliveryChallan.countDocuments(summaryFilter)
    : total;
  const rows = await IcDeliveryChallan.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * perPage)
    .limit(perPage)
    .lean();

  /* Summary over the WHOLE filtered set, not the page.

     Counting the ten rows on screen would report a different figure on every
     page, which is worse than no figure at all. This is a second round trip
     to the database on purpose - the alternative is fetching every matching
     challan just to add up two columns.

     The ids have to be CAST BY HAND. find() and countDocuments() run the
     filter through the schema, so the id strings off the query string become
     ObjectIds on the way; aggregate() passes the pipeline straight to the
     driver with no casting, so the same strings never match an ObjectId
     field. That is why the count was right while the quantity came back 0. */
  const idFields = ['businessId', 'locationId', 'toBusinessId', 'toLocationId'];
  const matchIds = Object.fromEntries(Object.entries(summaryFilter).map(([k, v]) => (
    idFields.includes(k) && typeof v === 'string' && isValidObjectId(v)
      ? [k, new Types.ObjectId(v)]
      : [k, v]
  )));

  const [sums] = await IcDeliveryChallan.aggregate([
    { $match: matchIds },
    {
      $group: {
        _id: null,
        totalQty: { $sum: { $ifNull: ['$totalQty', 0] } },
        netValue: { $sum: { $ifNull: ['$netValue', 0] } },
      },
    },
  ]);

  return json({
    rows: rows.map((r) => ({ ...r, _id: String(r._id) })),
    labels: await resolveRefLabels(rows),
    summary: {
      count: summaryTotal,
      totalQty: Math.round(((sums && sums.totalQty) || 0) * 100) / 100,
      netValue: Math.round(((sums && sums.netValue) || 0) * 100) / 100,
    },
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

  const denied = await screenDenial({
    session, ...IC_DC, action: PERM.CREATE, businessId: body.business,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const { errors, doc, ok } = validate(FIELDS, body.data || {});
  if (!ok) return json({ errors }, 422);

  if (!Array.isArray(body.data?.items) || body.data.items.length === 0) {
    return json({ errors: { items: 'Add at least one item' } }, 422);
  }

  if (body.business && isValidObjectId(body.business)) doc.businessId = body.business;
  if (body.location && isValidObjectId(body.location)) doc.locationId = body.location;
  if (body.finYear) doc.finYear = body.finYear;

  /* Branch to branch, directly. Checked here as well as in the dropdown
     because this route takes both branch ids straight from the request body.
     See lib/icRouting.js. */
  const badRoute = await checkRoute(doc.businessId, doc.toBusinessId);
  if (badRoute) return json({ error: badRoute.error, code: badRoute.code }, 422);

  applyTotals(doc, body);

  /* DC/26-27/TF/1000 - see nextDcNo above */
  if (!doc.dcNo) {
    doc.dcNo = await nextDcNo({ businessId: doc.businessId, finYear: doc.finYear });
  }

  const created = await IcDeliveryChallan.create(doc);

  /* Take the goods out of this branch's stock.

     After create, because the ledger rows reference the challan by id and
     number. If the movement fails - a line asking for more than is held, or
     another request taking the quantity first - the challan is REMOVED again
     rather than left standing for stock that never left. */
  let shipped = [];
  try {
    shipped = await shipChallanStock({
      challan: created,
      lines: Array.isArray(created.items) ? created.items : [],
      user: session,
    });
    await IcDeliveryChallan.collection.updateOne(
      { _id: created._id },
      { $set: { items: shipped } }
    );
  } catch (err) {
    await IcDeliveryChallan.deleteOne({ _id: created._id });
    if (err instanceof IcStockError) return json({ error: err.message }, err.status);
    throw err;
  }

  /* THE GOODS ARE NOW IN TRANSIT, NOT RECEIVED.

     Sending no longer lands them at the destination. The receiving branch
     approves the challan on Inter Company Sell > Receive Delivery Challan,
     and that approval is what creates the rows at the far end - see the
     RECEIVE section of app/api/ic-receive-delivery-challan/route.js, which
     calls the one definition of receiving in lib/icReceive.js.

     The stock has still LEFT this branch: shipChallanStock above took the
     quantity off the sender's barcode rows, so a piece promised to another
     branch cannot also be sold here while the challan waits. `receivedAt`
     stays null until the approval, which is exactly what the To Receive tab
     lists.

     Nothing is rolled back here any more, because nothing is attempted here
     any more - the despatch either shipped (above) or was undone there. */
  return json({ ok: true, id: String(created._id), dcNo: created.dcNo, received: false });
}
