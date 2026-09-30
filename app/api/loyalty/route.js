import dbConnect from '@/lib/db';
import { requireSession } from '@/lib/session';
import { loyaltyRules, pointsBalance, allowedRedemption } from '@/lib/loyalty';

/* /api/loyalty?business=<id>&customer=<id>&amount=<bill>

   What the till needs to show the loyalty strip: is loyalty on, what does this
   customer hold, and how much of it may come off the bill in front of them.

   SEPARATE FROM /api/loyalty-point, which is the Masters screen's CRUD for the
   settings themselves. That one is gated on the Loyalty Point master, so a
   cashier who may run the till but not edit the master would be refused it -
   and the till would lose the balance. This returns no settings a cashier
   could not already infer from their own screen: the conversion rate, the
   caps, and this one customer's number.

   A read only. Nothing here moves a point; that happens when the sale is
   saved, inside the same transaction - see app/api/sell-pos/route.js. */

const json = (d, s = 200) => Response.json(d, {
  status: s,
  headers: { 'Cache-Control': 'no-store' },
});

export async function GET(req) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const sp = new URL(req.url).searchParams;
  await dbConnect();

  const rules = await loyaltyRules(sp.get('business'));
  /* Not configured, or switched off. `active: false` rather than an error -
     the till hides the strip and sells exactly as it did before. */
  if (!rules) return json({ active: false });

  const customer = sp.get('customer');
  const amount = Number(sp.get('amount') || 0);

  /* A walk-in has nobody to credit. The rules still come back so the till can
     say what a named customer WOULD earn, but the balance is zero. */
  const balance = customer ? await pointsBalance({ businessId: sp.get('business'), customerId: customer }) : 0;
  /* points earned TODAY spend from TOMORROW - the redemption ceiling is
     worked on the balance without them, while `balance` above stays the
     full figure for display */
  const redeemable = customer
    ? await pointsBalance({ businessId: sp.get('business'), customerId: customer, excludeEarnedToday: true })
    : 0;
  const allowed = allowedRedemption({ rules, balance: redeemable, billAmount: amount });
  const todayLockedPoints = Math.max(0, balance - redeemable);

  return json({
    active: true,
    name: rules.name,
    pointsToInr: rules.pointsToInr,
    /* the six-field master's earning model, for the till's preview */
    perAmountModel: rules.hasPerAmount,
    purchaseAmountForOnePoint: rules.purchaseAmountForOnePoint,
    otpRequired: rules.otpRequired,
    earningPercentage: rules.earningPercentage,
    minPurchaseAmount: rules.minPurchaseAmount,
    maxRewardPoint: rules.maxRewardPoint,
    minRedemptionPoints: rules.minRedemptionPoints,
    maxRedemptionPoints: rules.maxRedemptionPoints,
    minAmountForRedemption: rules.minAmountForRedemption,
    balance,
    balanceValue: balance * rules.pointsToInr,
    todayLockedPoints,
    allowedPoints: allowed.points,
    allowedAmount: allowed.amount,
    reason: allowed.points === 0 && todayLockedPoints > 0 && balance > 0
      ? 'Points earned today can be redeemed from tomorrow.'
      : allowed.reason,
  });
}
