import { isValidObjectId, Types } from 'mongoose';
import LoyaltyPoint from '@/models/LoyaltyPoint';
import LoyaltyLedger, { LOYALTY_KIND } from '@/models/LoyaltyLedger';

/* Loyalty Points - the rules, in one place.

   Masters -> Loyalty Point holds the settings; this turns them into the two
   answers the till needs: how many points a bill earns, and how much a
   customer may take off the next one.

   EVERYTHING HERE IS OFF BY DEFAULT. A business with no Loyalty Point record,
   or one marked Active = No, gets `null` from rules() and every function below
   then does nothing at all. That is what lets this be added to a live till
   without changing a single existing sale.

   POINTS BELONG TO A NAMED CUSTOMER. A walk-in bill has nobody to credit and
   nobody to charge, so it neither earns nor redeems. */

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const asId = (v) => (v && isValidObjectId(String(v)) ? new Types.ObjectId(String(v)) : null);

/* The settings for a business, or null when loyalty is not in play.

   Read fresh rather than cached: it is one small document, and a cache here
   would mean an operator changing the earning rate has to wait for something
   invisible to expire before the till agrees. */
export async function loyaltyRules(businessId) {
  const id = asId(businessId);
  if (!id) return null;

  const doc = await LoyaltyPoint.findOne({ businessId: id }).lean();
  if (!doc) return null;
  if (String(doc.active || '').trim().toLowerCase() !== 'yes') return null;

  const rules = {
    name: String(doc.loyaltyPointName || 'Loyalty Points'),
    /* what one point is worth in rupees */
    pointsToInr: num(doc.pointsToInr),
    /* percent of the bill given back as points */
    earningPercentage: num(doc.earningPercentage),
    minPurchaseAmount: num(doc.minPurchaseAmount),
    /* 0 means no cap, on both of these */
    maxRewardPoint: num(doc.maxRewardPoint),
    maxRedemptionPoints: num(doc.maxRedemptionPoints),
    minRedemptionPoints: num(doc.minRedemptionPoints),
    minAmountForRedemption: num(doc.minAmountForRedemption),
    expiryDays: num(doc.expiryPeriod),
  };

  /* Configured but useless. A point worth nothing cannot be spent and a rate
     of zero earns nothing, so rather than have the till offer a feature that
     can only disappoint, it stays switched off until the master is filled in. */
  if (rules.pointsToInr <= 0 && rules.earningPercentage <= 0) return null;

  return rules;
}

/* WHAT A CUSTOMER HAS, counted as dated lots.

   Points expire, so a balance is not simply the sum of the column. Earnings
   are laid out oldest first, past redemptions are taken off the front of that
   queue, and what remains is counted only if it has not passed its date.

   FIFO because the alternative spends the newest points first and quietly
   lets the oldest expire - the customer loses points they were entitled to,
   and nothing in the record explains why.

   Returns whole points. A fraction of a point cannot be spent, and rounding
   at the point of display rather than here is how a balance that says 4 buys
   only 3. */
export async function pointsBalance({ businessId, customerId, now = new Date() }) {
  const business = asId(businessId);
  const customer = asId(customerId);
  if (!business || !customer) return 0;

  const rows = await LoyaltyLedger
    .find({ businessId: business, customerId: customer })
    .sort({ createdAt: 1 })
    .lean();

  const lots = [];
  let spent = 0;

  for (const row of rows) {
    const points = num(row.points);
    if (points > 0) lots.push({ points, expiresAt: row.expiresAt || null });
    else spent += Math.abs(points);
  }

  /* take what has already been spent off the oldest lots first */
  for (const lot of lots) {
    if (spent <= 0) break;
    const taken = Math.min(lot.points, spent);
    lot.points -= taken;
    spent -= taken;
  }

  const live = lots.reduce((sum, lot) => (
    lot.points > 0 && (!lot.expiresAt || new Date(lot.expiresAt) > now)
      ? sum + lot.points
      : sum
  ), 0);

  return Math.max(0, Math.floor(live));
}

/* HOW MANY POINTS A BILL EARNS.

   points = bill x earning%, floored, subject to the two gates in the master:
   the bill must reach minPurchaseAmount, and no more than maxRewardPoint is
   given for one bill (0 = no cap).

   Floored, not rounded: a bill that earns 3.9 points earns 3. Rounding up
   would hand out points the percentage did not earn, and half a point cannot
   be spent anyway. */
export function pointsEarnedFor(rules, amount) {
  if (!rules || rules.earningPercentage <= 0) return 0;

  const value = num(amount);
  if (value <= 0) return 0;
  if (rules.minPurchaseAmount > 0 && value < rules.minPurchaseAmount) return 0;

  let points = Math.floor((value * rules.earningPercentage) / 100);
  if (rules.maxRewardPoint > 0) points = Math.min(points, rules.maxRewardPoint);

  return Math.max(0, points);
}

/* WHAT A NUMBER OF POINTS TAKES OFF A BILL, in rupees. */
export function redemptionValue(rules, points) {
  if (!rules || rules.pointsToInr <= 0) return 0;
  return Math.max(0, Math.floor(num(points))) * rules.pointsToInr;
}

/* THE MOST THIS BILL MAY TAKE, given what the customer holds.

   Four ceilings, and the smallest wins:
     the balance          - cannot spend what is not there
     maxRedemptionPoints  - the master's per-bill cap (0 = none)
     the bill itself      - points may settle a bill, never overpay it and
                            turn into change
     minRedemptionPoints  - below this the answer is zero, not a part of it

   Returned as whole points and as the rupees they are worth, so the till and
   the server can agree without either recomputing the other's figure. */
export function allowedRedemption({ rules, balance, billAmount }) {
  const none = { points: 0, amount: 0, reason: '' };
  if (!rules || rules.pointsToInr <= 0) return { ...none, reason: 'Loyalty redemption is not configured.' };

  const held = Math.max(0, Math.floor(num(balance)));
  const bill = num(billAmount);

  if (held <= 0) return { ...none, reason: 'No points available.' };
  if (rules.minAmountForRedemption > 0 && bill < rules.minAmountForRedemption) {
    return { ...none, reason: `A bill of at least ${rules.minAmountForRedemption} is needed to redeem points.` };
  }

  let points = held;
  if (rules.maxRedemptionPoints > 0) points = Math.min(points, rules.maxRedemptionPoints);
  /* never more than the bill is worth */
  points = Math.min(points, Math.floor(bill / rules.pointsToInr));

  if (points < rules.minRedemptionPoints) {
    return { ...none, reason: `At least ${rules.minRedemptionPoints} points are needed to redeem.` };
  }

  return { points, amount: redemptionValue(rules, points), reason: '' };
}

/* THE ROWS A COMPLETED SALE WRITES.

   Returns the documents rather than saving them, so the caller can insert
   them inside the transaction that creates the invoice - points and the bill
   that moved them land together or not at all.

   Earning is on what the customer actually PAID, after any points came off.
   Points are a discount; earning on the pre-discount figure would pay the
   customer twice for the same money and lets a balance grow by being spent. */
export function saleLedgerRows({
  rules, businessId, locationId, customerId, invoiceId, invoiceNo,
  billAmount, redeemPoints = 0, createdBy = '', now = new Date(),
}) {
  const rows = [];
  if (!rules) return rows;

  const business = asId(businessId);
  const customer = asId(customerId);
  if (!business || !customer) return rows;

  const base = {
    businessId: business,
    locationId: asId(locationId),
    customerId: customer,
    invoiceId: asId(invoiceId),
    invoiceNo: String(invoiceNo || ''),
    createdBy: String(createdBy || ''),
  };

  const spent = Math.max(0, Math.floor(num(redeemPoints)));
  if (spent > 0) {
    rows.push({
      ...base,
      kind: LOYALTY_KIND.REDEEM,
      points: -spent,
      amount: redemptionValue(rules, spent),
      expiresAt: null,
      note: `${spent} points redeemed on ${base.invoiceNo || 'this bill'}`,
    });
  }

  const payable = Math.max(0, num(billAmount) - redemptionValue(rules, spent));
  const earned = pointsEarnedFor(rules, payable);
  if (earned > 0) {
    rows.push({
      ...base,
      kind: LOYALTY_KIND.EARN,
      points: earned,
      amount: payable,
      /* 0 days in the master means these never expire */
      expiresAt: rules.expiryDays > 0
        ? new Date(now.getTime() + rules.expiryDays * 24 * 60 * 60 * 1000)
        : null,
      note: `${earned} points earned on ${base.invoiceNo || 'this bill'}`,
    });
  }

  return rows;
}
