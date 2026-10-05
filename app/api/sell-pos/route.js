import { isValidObjectId, Types } from 'mongoose';
import dbConnect from '@/lib/db';
import PosInvoice from '@/models/PosInvoice';
import Business from '@/models/Business';
import CompanyLocation from '@/models/CompanyLocation';
import { Customer } from '@/lib/contacts';
import PosCounter from '@/models/PosCounter';
import SalesPerson from '@/models/SalesPerson';
import StockAdjustment from '@/models/StockAdjustment';
import { requireSession } from '@/lib/session';
import { resolveRefLabels } from '@/lib/refLabels';
import { validate, escapeRegex } from '@/lib/validate';
import { nextDocNumber } from '@/lib/docnumber';
import {
  withTransaction, loadUnits, sellUnits, unitsByCode, InventoryError, BARCODE_STATUS, inHandQty,
} from '@/lib/inventory';
import { barcodeKey, sameBarcode } from '@/lib/barcodeValue';
import { BarcodeLabel } from '@/lib/barcodeLabel';
import { uomTypeOf } from '@/lib/barcodeUnits';
import { handler } from '@/lib/apiError';
import { requirePermission, PERMISSIONS } from '@/lib/rbac';
import { screenDenial, SCREENS, ACTIONS as PERM } from '@/lib/screenPermission';
import LoyaltyLedger from '@/models/LoyaltyLedger';
import {
  loyaltyRules, pointsBalance, allowedRedemption, redemptionValue, saleLedgerRows,
} from '@/lib/loyalty';

/* Permission gate for this screen.

   THE TILL ITSELF LIVES AT /admin/pos/add, not under this path, but it is
   the ADD screen of this list - so it answers to this screen's create.

   POS is also the fallback permission on three shared endpoints
   (ITEM_LOOKUP_SCREENS and BARCODE_LIST_SCREENS in lib/screenPermission.js),
   which answer to POS *read*. So a counter role needs read as well as
   create: without read it could raise a sale but not look an item up to put
   on it. Read is the ordinary grant for a till operator anyway - a cashier
   who may not see the day's bills is not a configuration anyone asks for.

   The older requirePermission(POS_SELL) check on POST stays exactly where it
   was. This layer only ever narrows, never widens. */
const POS = { screen: SCREENS.POS, label: 'POS bills' };
const FIELDS = [];

/* /api/sell-pos - list + create. */

const json = (d, s = 200) => Response.json(d, { status: s });
const PER_PAGE = 10;

export async function GET(req) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const sp = new URL(req.url).searchParams;
  await dbConnect();

  const page = Math.max(1, Number(sp.get('page') || 1));
  const perPage = Math.min(500, Number(sp.get('perPage') || PER_PAGE));

  /* Only refuses when this role has a saved permission matrix that
     withholds it - see lib/screenPermission.js. */
  const denied = await screenDenial({
    session, ...POS, action: PERM.READ, businessId: sp.get('business'),
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const filter = {};
  const b = sp.get('business'); if (b && isValidObjectId(b)) filter.businessId = b;
  const l = sp.get('location'); if (l && isValidObjectId(l)) filter.locationId = l;
  const y = sp.get('finYear'); if (y) filter.finYear = y;


  const from = sp.get('startDate');
  const to = sp.get('endDate');
  if (from) filter.date = { ...(filter.date || {}), $gte: new Date(from) };
  if (to) filter.date = { ...(filter.date || {}), $lte: new Date(to + 'T23:59:59') };

  /* "unconverted" upstream documents: a GRC with no purchase invoice yet, a
     GRT with no debit note yet. $eq: null matches missing AND null - passing
     '' here would be cast against an ObjectId path and throw. */
  const unconverted = sp.get('unconverted');
  if (unconverted) filter[unconverted] = { $eq: null };

  const search = (sp.get('search') || '').trim();
  if (search) {
    const rx = { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = [{ invoiceNo: rx }];
  }

  const total = await PosInvoice.countDocuments(filter);

  /* ------------------------------------------------------------------
     THE BOXES ABOVE THE LIST, over the WHOLE filtered set rather than the
     page on screen. Counting the ten rows in view would report a different
     figure on every page, which is worse than no figure at all - so this is a
     second round trip on purpose, rather than fetching every invoice just to
     add up five columns.

     It follows the filter, so picking a Start and End Date turns these into
     that day's takings. That is the point of them.

     THE IDS HAVE TO BE CAST BY HAND. find() and countDocuments() run the
     filter through the schema, so the id strings off the query string become
     ObjectIds on the way; aggregate() hands the pipeline straight to the
     driver with no casting, and the same strings never match an ObjectId
     field - the count would be right while every total came back 0. The same
     trap is documented on /api/ic-delivery-challan.
     ------------------------------------------------------------------ */
  /* THE CARDS DEFAULT TO TODAY. With no Start/End Date chosen the LIST
     shows every bill, but the boxes above it read as the day's takings
     (user, 01-10-2026) - so the summary is narrowed to today's business
     date unless the operator picked a range, in which case it follows the
     range exactly as before. Built the same way the client's own date
     filter builds it, so the two mean the same day. */
  const hasRange = Boolean(from || to);
  let summaryFilter = filter;
  if (!hasRange) {
    const now = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const ymd = now.getFullYear() + '-' + p(now.getMonth() + 1) + '-' + p(now.getDate());
    summaryFilter = { ...filter, date: { $gte: new Date(ymd), $lte: new Date(ymd + 'T23:59:59') } };
  }
  const summaryCount = hasRange ? total : await PosInvoice.countDocuments(summaryFilter);

  const idFields = ['businessId', 'locationId', 'customerId', 'counterId'];
  const matchIds = Object.fromEntries(Object.entries(summaryFilter).map(([k, v]) => (
    idFields.includes(k) && typeof v === 'string' && isValidObjectId(v)
      ? [k, new Types.ObjectId(v)]
      : [k, v]
  )));

  /* Quantity is summed out of the line items, which are Mixed - a qty may be
     stored as a number or as a string depending on how the line reached the
     till. $convert with onError/onNull keeps a stray value from failing the
     whole pipeline and losing every other figure with it. */
  const [sums] = await PosInvoice.aggregate([
    { $match: matchIds },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: { $ifNull: ['$totalAmount', 0] } },
        paid: { $sum: { $ifNull: ['$paid', 0] } },
        sellDue: { $sum: { $ifNull: ['$sellDue', 0] } },
        totalQty: {
          $sum: {
            $reduce: {
              input: { $ifNull: ['$items', []] },
              initialValue: 0,
              in: {
                $add: [
                  '$$value',
                  { $convert: { input: '$$this.qty', to: 'double', onError: 0, onNull: 0 } },
                ],
              },
            },
          },
        },
      },
    },
  ]);

  const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

  /* WHAT THE COLLECTED FIGURE WAS PAID WITH, over the same filtered set.

     Read from the payments rows, the same way the list's own "paid with"
     line does: only rows carrying an amount count, and a bill with no
     payment rows at all (older bills, from before Multiple Pay) is counted
     under its billingType for whatever it has paid. That keeps the
     breakdown adding up to the Collected total. */
  const amountOf = { $convert: { input: '$$p.amount', to: 'double', onError: 0, onNull: 0 } };
  const byMethod = await PosInvoice.aggregate([
    { $match: matchIds },
    {
      $project: {
        rows: {
          $let: {
            vars: {
              real: {
                $filter: {
                  input: { $cond: [{ $isArray: '$payments' }, '$payments', []] },
                  as: 'p',
                  cond: { $gt: [amountOf, 0] },
                },
              },
            },
            in: {
              $cond: [
                { $gt: [{ $size: '$$real' }, 0] },
                {
                  $map: {
                    input: '$$real',
                    as: 'p',
                    in: { method: '$$p.method', loyalty: '$$p.loyalty', amount: amountOf },
                  },
                },
                [{ method: '$billingType', loyalty: false, amount: { $ifNull: ['$paid', 0] } }],
              ],
            },
          },
        },
      },
    },
    { $unwind: '$rows' },
    {
      $group: {
        _id: { method: '$rows.method', loyalty: '$rows.loyalty' },
        amount: { $sum: '$rows.amount' },
      },
    },
  ]);

  /* Folded into the buckets the counter reads: Cash, UPI (UPI/Card and the
     wallets added under it on the payment dialog), Loyalty Points, and any
     other method under its own name - Bank Deposit, Credit and the like. */
  const UPI_METHODS = ['upi/card', 'upi', 'paytm', 'phonepe', 'gpay'];
  const paidBy = new Map();
  byMethod.forEach(({ _id, amount }) => {
    const method = String(_id?.method || '').trim();
    const key = method.toLowerCase();
    const bucket = _id?.loyalty === true ? 'Loyalty Points'
      : key === 'cash' ? 'Cash'
        : UPI_METHODS.includes(key) ? 'UPI'
          : method || 'Other';
    paidBy.set(bucket, (paidBy.get(bucket) || 0) + (Number(amount) || 0));
  });
  /* Only Cash and UPI are shown on the card, as asked - shown even at zero
     so the card reads the same every day. Loyalty, Bank Deposit and the
     rest are still inside the Collected total, just not itemised. */
  const paidByList = ['Cash', 'UPI'].map((label) => ({ label, amount: round2(paidBy.get(label)) }));

  /* QTY SOLD SPLIT INTO PIECES AND METRES, over the same filtered set - 15
     sarees and 10 metres of cloth is not 25 of anything.

     A line's kind is its own uomType when the till stored one (every
     barcoded line carries it), otherwise it is read from the free-text UOM
     by uomTypeOf(), the app's single definition of "is this metres". */
  const byUom = await PosInvoice.aggregate([
    { $match: matchIds },
    { $unwind: '$items' },
    {
      $group: {
        _id: { uomType: '$items.uomType', uom: '$items.uom' },
        qty: { $sum: { $convert: { input: '$items.qty', to: 'double', onError: 0, onNull: 0 } } },
      },
    },
  ]);
  const qtyBy = { PC: 0, MTR: 0 };
  byUom.forEach(({ _id, qty }) => {
    const stored = String(_id?.uomType || '').trim().toUpperCase();
    const kind = stored === 'PC' || stored === 'MTR' ? stored : uomTypeOf(_id?.uom);
    qtyBy[kind] += Number(qty) || 0;
  });
  const qtyByList = [
    { label: 'Pcs', amount: round2(qtyBy.PC) },
    { label: 'Mtrs', amount: round2(qtyBy.MTR) },
  ];

  const rows = await PosInvoice.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * perPage)
    .limit(perPage)
    .lean();

  /* The sales person sits on each LINE (the till's Sales Person column), as
     a Staff Management -> Sales Persons id - one lookup for the whole page. */
  const spIds = [...new Set(rows.flatMap((r) => (r.items || []).map((l) => String(l.salesPerson || ''))).filter((v) => isValidObjectId(v)))];

  const [businesses, locations, customers, counters, salesPeople] = await Promise.all([
    Business.find({ _id: { $in: rows.map((r) => r.businessId).filter(Boolean) } }).select('_id name businessPrintName').lean(),
    CompanyLocation.find({ _id: { $in: rows.map((r) => r.locationId).filter(Boolean) } }).select('_id name businessPrintName').lean(),
    Customer.find({ _id: { $in: rows.map((r) => r.customerId).filter(Boolean) } }).select('_id businessName firstName middleName lastName billingMobile').lean(),
    PosCounter.find({ _id: { $in: rows.map((r) => r.counterId).filter(Boolean) } }).select('_id counterName').lean(),
    spIds.length ? SalesPerson.find({ _id: { $in: spIds } }).select('_id name').lean() : [],
  ]);
  const spName = new Map(salesPeople.map((p) => [String(p._id), p.name || '']));
  const byId = (list) => new Map(list.map((item) => [String(item._id), item]));
  const businessById = byId(businesses);
  const locationById = byId(locations);
  const customerById = byId(customers);
  const counterById = byId(counters);

  return json({
    rows: rows.map((r) => {
      const customer = customerById.get(String(r.customerId));
      return {
        ...r,
        _id: String(r._id),
        businessName: businessById.get(String(r.businessId))?.name || businessById.get(String(r.businessId))?.businessPrintName || '',
        locationName: locationById.get(String(r.locationId))?.name || locationById.get(String(r.locationId))?.businessPrintName || '',
        counterName: counterById.get(String(r.counterId))?.counterName || '',
        customerName: customer ? customer.businessName || [customer.firstName, customer.middleName, customer.lastName].filter(Boolean).join(' ') : r.customerSnapshot?.businessName || [r.customerSnapshot?.firstName, r.customerSnapshot?.middleName, r.customerSnapshot?.lastName].filter(Boolean).join(' ') || 'Walk-in Customer',
        customerContact: r.customerContact || customer?.billingMobile || r.customerSnapshot?.billingMobile || '',
        /* every sales person on the bill, once each */
        salesPersonName: [...new Set((r.items || []).map((l) => spName.get(String(l.salesPerson || ''))).filter(Boolean))].join(', '),
        /* the number of lines on the bill */
        totalItems: (r.items || []).length,
      };
    }),
    labels: await resolveRefLabels(rows),
    summary: {
      count: summaryCount,
      totalAmount: round2(sums && sums.totalAmount),
      paid: round2(sums && sums.paid),
      paidBy: paidByList,
      sellDue: round2(sums && sums.sellDue),
      totalQty: round2(sums && sums.totalQty),
      qtyBy: qtyByList,
    },
    total,
    page,
    pages: Math.max(1, Math.ceil(total / perPage)),
    perPage,
  });
}

/* handler() so a typed engine failure - an already-sold barcode, a lost race
   with another till - reaches the operator as its own message and status
   rather than an unhandled rejection. */
export const POST = handler(async (req) => {
  const session = await requirePermission(PERMISSIONS.POS_SELL);

  const body = await req.json();
  await dbConnect();

  /* Ahead of validate(), so a refused sale comes back as 403 "not allowed"
     rather than 422 "your cart is wrong". */
  const denied = await screenDenial({
    session, ...POS, action: PERM.CREATE, businessId: body.business,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const { errors, doc, ok } = validate(FIELDS, body.data || {});
  if (!ok) return json({ errors }, 422);
  if (body.business && isValidObjectId(body.business)) doc.businessId = body.business;
  if (body.location && isValidObjectId(body.location)) doc.locationId = body.location;
  if (body.finYear) doc.finYear = body.finYear;

  doc.date = body.data?.date ? new Date(body.data.date) : new Date();
  doc.customerId = body.data?.customerId && isValidObjectId(body.data.customerId) ? body.data.customerId : null;
  doc.customerContact = String(body.data?.customerContact || '');
  doc.counterId = body.data?.counterId && isValidObjectId(body.data.counterId) ? body.data.counterId : null;
  doc.billingType = String(body.data?.billingType || '');
  doc.exempted = String(body.data?.exempted || 'NO');

  /* Line items are normalised before they are stored. The till was writing
     `code` while every report reads `itemCode` (lib/reports.js lineItemCode),
     so no POS sale ever matched an item: outward stock came out as zero and
     the item-stock report showed closing stock equal to everything ever
     received. normaliseLines() writes both keys, so old screens that read
     `code` keep working and the reports start matching. */
  if (Array.isArray(body.data?.items)) doc.items = normaliseLines(body.data.items);
  if (Array.isArray(body.data?.payments)) doc.payments = body.data.payments;
  if (body.data?.customerSnapshot) doc.customerSnapshot = body.data.customerSnapshot;
  if (body.data?.sellNote !== undefined) doc.sellNote = body.data.sellNote;
  if (body.data?.staffNote !== undefined) doc.staffNote = body.data.staffNote;
  doc.shipping = Number(body.data?.shipping || 0);
  doc.totalAmount = Number(body.data?.totalAmount || 0);
  doc.paid = Number(body.data?.paid || 0);

  /* ------------------------------------------------------------------
     LOYALTY POINTS.

     The till sends how many points the customer wants to spend; the SERVER
     decides how many they may. Everything below is recomputed here from the
     ledger and the master - the request's own figure is only ever used as a
     ceiling, never as an answer. A till with a stale balance, or a second
     counter that spent the same points a moment ago, is refused rather than
     allowed to overdraw.

     Off unless the business has an active Loyalty Point master, and never
     for a walk-in: points belong to a named customer. Both of those leave
     every line below at zero, which is the sale exactly as it behaved before
     any of this existed.
     ------------------------------------------------------------------ */
  const rules = await loyaltyRules(doc.businessId);
  const wantsPoints = Math.max(0, Math.floor(Number(body.data?.loyaltyRedeemPoints || 0)));

  let redeemPoints = 0;
  let redeemAmount = 0;

  if (rules && doc.customerId && wantsPoints > 0) {
    /* points earned TODAY spend from TOMORROW - the ceiling leaves them out */
    const balance = await pointsBalance({
      businessId: doc.businessId, customerId: doc.customerId, excludeEarnedToday: true,
    });
    const allowed = allowedRedemption({ rules, balance, billAmount: doc.totalAmount });

    /* Asked for more than the rules or the balance permit. Refused outright
       rather than quietly trimmed: the customer has been told a price, and a
       till that silently takes fewer points than it showed sends them away
       having paid more than the screen said. */
    if (wantsPoints > allowed.points) {
      return json({
        error: allowed.reason
          || `Only ${allowed.points} of the ${wantsPoints} points asked for can be redeemed on this bill.`,
        code: 'LOYALTY_NOT_AVAILABLE',
        allowedPoints: allowed.points,
        balance,
      }, 409);
    }

    redeemPoints = wantsPoints;
    redeemAmount = redemptionValue(rules, redeemPoints);
  }

  /* Points are a PAYMENT, not a discount. totalAmount stays the value of the
     goods - which is what the tax on the bill was worked out from, and what
     a return has to credit - and the points settle part of it, exactly as
     cash would. So a 1000 bill met with 300 points leaves 700 to collect. */
  doc.loyaltyPointsRedeemed = redeemPoints;
  doc.loyaltyAmount = redeemAmount;

  if (redeemAmount > 0) {
    doc.paid = Number(doc.paid || 0) + redeemAmount;
    doc.payments = [
      ...(Array.isArray(doc.payments) ? doc.payments : []),
      {
        method: rules.name || 'Loyalty Points',
        amount: redeemAmount,
        note: `${redeemPoints} points`,
        loyalty: true,
      },
    ];
  }

  doc.sellDue = Math.max(0, doc.totalAmount - doc.paid);
  doc.paymentStatus = doc.sellDue === 0 ? 'Paid' : doc.paid > 0 ? 'Part Paid' : 'Unpaid';

  /* Barcoded lines are the ones that move stock. A line entered from the item
     master without a barcode still bills, but cannot decrement a specific
     unit - there is nothing physical to decrement. */
  const codes = [...new Set((doc.items || []).map((l) => String(l.barcodeNo || '').trim()).filter(Boolean))];

  const created = await withTransaction(async (dbSession) => {
    /* Re-read and re-check every barcode INSIDE the transaction. The till may
       have scanned it a minute ago; another counter may have sold it since.
       This is what stops the same unit being billed twice. */
    const units = codes.length
      ? await loadUnits(codes, { businessId: doc.businessId, session: dbSession })
      : [];

    /* a code may be any spelling the unit answers to - its own number, its
       composed value, its old barcode. Each code needs a unit of its own: a
       second code for a unit already on the bill (another spelling of it,
       its old barcode) has none left, and is refused rather than billed twice. */
    const unitOf = unitsByCode(codes, units);
    const missing = codes.filter((c, i) =>
      !unitOf.has(barcodeKey(c)) || codes.findIndex((d) => sameBarcode(d, c)) < i);
    if (missing.length) {
      throw new InventoryError('BARCODE_NOT_FOUND',
        'These barcodes are no longer in the system: ' + missing.slice(0, 8).join(', '),
        { status: 422, skipped: missing });
    }

    /* The line keeps the unit's own number, whatever spelling reached the
       till - returns and exchanges look the sale up by it. */
    (doc.items || []).forEach((l) => {
      const unit = l.barcodeNo ? unitOf.get(barcodeKey(l.barcodeNo)) : null;
      if (unit) l.barcodeNo = unit.barcodeNo || unit.barcodeGenerated || l.barcodeNo;
    });

    const unavailable = units.filter((u) => u.status && u.status !== BARCODE_STATUS.IN_STOCK);
    if (unavailable.length) {
      throw new InventoryError('BARCODE_UNAVAILABLE',
        unavailable.map((u) =>
          (u.barcodeNo || u.barcodeGenerated) +
          (u.status === BARCODE_STATUS.SOLD
            ? ' was already sold' + (u.billingNo ? ' on ' + u.billingNo : '')
            : ' is ' + String(u.status).toLowerCase().replace(/_/g, ' '))
        ).join('; ') + '.',
        { status: 409, skipped: unavailable.map((u) => u.barcodeNo || u.barcodeGenerated) });
    }

    if (!doc.invoiceNo) {
      doc.invoiceNo = await nextDocNumber(PosInvoice, 'invoiceNo', 'POS', {
        businessId: doc.businessId, locationId: doc.locationId, finYear: doc.finYear,
      });
      /* POS INVOICE NUMBERS READ "POS0070". With no prefix set for POS on the
         Doc Setup master the series is bare digits, so "POS" goes in front -
         the running number is the same counter as before, so numbering
         carries on (0069 -> POS0070) rather than restarting. A prefix set on
         Doc Setup still wins: a number that already starts with letters is
         left exactly as issued. */
      if (/^\d/.test(doc.invoiceNo)) doc.invoiceNo = 'POS' + doc.invoiceNo;
    }

    const [invoice] = await PosInvoice.create([doc], dbSession ? { session: dbSession } : {});

    /* POINTS MOVE WITH THE BILL, in this same transaction. A sale that rolls
       back must not leave a customer's balance spent or credited, and points
       earned against an invoice that does not exist can never be explained.

       saleLedgerRows works the earning out on what was actually PAID - the
       bill less whatever the points just took off it - so spending points
       cannot itself earn more of them.

       Written straight to the collection rather than through a helper that
       re-reads: everything was decided above, under the same rules, and the
       rows are the record of that decision. */
    if (rules && doc.customerId) {
      const ledgerRows = saleLedgerRows({
        rules,
        businessId: doc.businessId,
        locationId: doc.locationId,
        customerId: doc.customerId,
        invoiceId: invoice._id,
        invoiceNo: invoice.invoiceNo,
        billAmount: doc.totalAmount,
        redeemPoints,
        createdBy: session?.name || session?.email || '',
      });

      if (ledgerRows.length) {
        await LoyaltyLedger.create(ledgerRows, dbSession ? { session: dbSession } : {});
        const earnedRow = ledgerRows.find((r) => r.points > 0);
        /* stamped on the invoice too, so the bill can say what it gave
           without the ledger having to be joined to read it */
        if (earnedRow) {
          await PosInvoice.updateOne(
            { _id: invoice._id },
            { $set: { loyaltyPointsEarned: earnedRow.points } },
            dbSession ? { session: dbSession } : {}
          );
          invoice.loyaltyPointsEarned = earnedRow.points;
        }
      }
    }

    /* The write that was missing entirely: without it a barcode stayed in
       stock after being billed and could be sold again from another till. */
    /* HOW MUCH EACH ROW GIVES UP. The bill's line quantity, not the whole
       row: a batch row holding 3 pieces sells 1 and keeps 2 (see sellUnits).
       A line asking for more than its row holds draws the rest from other
       in-stock rows of the same barcode at this business (an IC challan can
       land one barcode as several rows); short even then, the bill is
       refused rather than selling stock that is not there. */
    const toSell = [...units];
    const qtyByUnit = new Map();
    if (units.length) {
      const asked = new Map();
      (doc.items || []).forEach((l) => {
        const unit = l.barcodeNo ? unitOf.get(barcodeKey(l.barcodeNo)) : null;
        const q = Number(l.qty);
        if (unit && q > 0) asked.set(String(unit._id), (asked.get(String(unit._id)) || 0) + q);
      });
      const taken = new Set(units.map((u) => String(u._id)));
      for (const unit of units) {
        let need = asked.get(String(unit._id));
        if (!(need > 0)) continue;
        const have = inHandQty(unit);
        qtyByUnit.set(String(unit._id), Math.min(need, have));
        need = Math.round((need - have) * 1000) / 1000;
        if (need <= 0.0005) continue;

        const more = await BarcodeLabel.find({
          businessId: String(doc.businessId),
          barcodeNo: unit.barcodeNo,
          status: BARCODE_STATUS.IN_STOCK,
          _id: { $nin: [...taken] },
        }).session(dbSession || null).lean();
        for (const row of more) {
          if (need <= 0.0005) break;
          const take = Math.min(need, inHandQty(row));
          if (take <= 0) continue;
          taken.add(String(row._id));
          toSell.push(row);
          qtyByUnit.set(String(row._id), take);
          need = Math.round((need - take) * 1000) / 1000;
        }
        if (need > 0.0005) {
          throw new InventoryError('INSUFFICIENT_QTY',
            (unit.barcodeNo || '') + ': only ' + Math.round((asked.get(String(unit._id)) - need) * 1000) / 1000
            + ' in stock, ' + asked.get(String(unit._id)) + ' on the bill.',
            { status: 409, skipped: [unit.barcodeNo || ''] });
        }
      }

      await sellUnits({
        units: toSell, invoice, locationId: doc.locationId, user: session, session: dbSession, qtyByUnit,
      });
    }

    /* Lines the operator ticked STOCK ISSUE on are also recorded as a Stock
       Adjustment, so they show on Inventory -> Stock Adjustment. One document
       per bill carrying only the ticked lines; an untouched line stays a
       plain sale and is not repeated here.

       DELIBERATELY NOT calling adjustStock(). That is what the manual
       adjustment screen does, and it is right there because nothing else has
       moved the stock yet. Here sellUnits() above has ALREADY taken these
       units out (IN_STOCK -> SOLD) and written their POS_OUT ledger rows, so
       adjusting again would remove the same stock twice and leave the
       movement ledger disagreeing with the barcode rows. This record is the
       register entry, not a second movement.

       Inside the same transaction as the invoice: a bill that rolls back must
       not leave an adjustment behind pointing at a sale that never happened. */
    /* ONE VOCABULARY ACROSS BOTH SCREENS. The manual adjustment screen's scan
       tabs are "Stock Addition" and "Stock Subtraction", and the rows it
       writes carry type "Addition" - so the till files "Subtraction" and
       "Addition" rather than the "ISSUE" it used to write, which was the same
       idea under a third name. Rows already stored as "ISSUE" keep that value;
       nothing rewrites history. */
    const registerEntry = async (lines, type, reason) => {
      if (!lines.length) return;

      const adjustmentNo = await nextDocNumber(
        StockAdjustment, 'adjustmentNo', 'Stock Adjustment',
        { businessId: doc.businessId, locationId: doc.locationId, finYear: doc.finYear },
        dbSession
      );

      await StockAdjustment.create([{
        businessId: doc.businessId,
        locationId: doc.locationId,
        finYear: doc.finYear,
        adjustmentNo,
        type,
        adjustmentReason: reason,
        adjustmentDate: doc.date,
        remarks: 'Auto-created from POS invoice ' + (invoice.invoiceNo || ''),
        createdBy: session?.name || session?.email || '',
        items: lines,
      }], dbSession ? { session: dbSession } : {});
    };

    /* Each tick files its own document, so a bill carrying both produces one
       of each rather than a mixed one that neither screen could read. */
    await registerEntry(
      (doc.items || []).filter((l) => l.stockIssue === true),
      'Subtraction', 'POS Stock Issue'
    );
    await registerEntry(
      (doc.items || []).filter((l) => l.stockAddition === true),
      'Addition', 'POS Stock Addition'
    );

    return invoice;
  });

  return json({ ok: true, id: String(created._id), invoiceNo: created.invoiceNo });
});

/* Writes both key spellings, and carries the barcode through so the sale can
   be traced back to the physical unit and returned against it later. */
function normaliseLines(items) {
  return (items || []).map((l) => {
    const itemCode = String(l.itemCode ?? l.code ?? l['Item Code'] ?? '').trim();
    const qty = Number(l.qty ?? l.Qty ?? l.QTY ?? 1) || 1;
    const rate = Number(l.rsp ?? l.rate ?? l.price ?? 0) || 0;
    const discountPct = Number(l.discountPct ?? 0) || 0;
    const gross = rate * qty;
    const netAmount = Math.round((gross - (gross * discountPct) / 100) * 100) / 100;

    return {
      ...l,
      itemCode,
      code: itemCode || l.code || '',
      itemName: l.itemName || l.name || '',
      barcodeNo: String(l.barcodeNo || l.barcode || '').trim(),
      qty,
      rate,
      netAmount,
    };
  });
}
