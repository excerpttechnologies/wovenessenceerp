import mongoose, { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import { Customer } from '@/lib/contacts';
import PosInvoice from '@/models/PosInvoice';
import PosReturn from '@/models/PosReturn';
import { handler, json } from '@/lib/apiError';
import { requireUser } from '@/lib/rbac';
import { imageUrl } from '@/lib/inventory';
import { screenDenial, SCREENS, ACTIONS as PERM } from '@/lib/screenPermission';

const CUSTOMER = { screen: SCREENS.CUSTOMER, label: 'customers' };


/* GET /api/customer/<id>/history?business=&limit=

   The customer profile the till shows once a customer is selected: who they
   are, what they have bought, what they have brought back, and what it adds
   up to.

   Read-only and scoped to one customer, so it stays cheap enough to fire on
   every customer selection at the counter. The invoice list is capped and the
   item roll-up is computed from that same page rather than a second scan of
   the collection. */

const DEFAULT_LIMIT = 20;

export const GET = handler(async (req, { params }) => {
  const session = await requireUser();
  const { id } = await params;
  const sp = new URL(req.url).searchParams;
  await dbConnect();

  if (!isValidObjectId(id)) return json({ error: 'Customer not found.', code: 'NOT_FOUND' }, 404);

  const business = sp.get('business');
  const limit = Math.min(100, Math.max(1, Number(sp.get('limit') || DEFAULT_LIMIT)));
  const scope = business && isValidObjectId(business) ? { businessId: business } : {};

  const customer = await Customer.findById(id).lean();
  if (!customer) return json({ error: 'Customer not found.', code: 'NOT_FOUND' }, 404);

  /* The same gate as the Customers list. This is a customer's buying history,
     so a role that may not read customers must not be able to pull it here
     instead. The till reads this endpoint, which is exactly why it needs
     guarding rather than being left as the way round the list's permission. */
  const denied = await screenDenial({
    session, ...CUSTOMER, action: PERM.READ, businessId: business || customer.businessId,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const [invoices, returns, totals] = await Promise.all([
    PosInvoice.find({ customerId: id, ...scope })
      .sort({ date: -1, createdAt: -1 })
      .limit(limit)
      .lean(),
    PosReturn.find({ customerId: id, ...scope })
      .sort({ date: -1, createdAt: -1 })
      .limit(limit)
      .lean(),
    /* lifetime figures come from an aggregate rather than the capped page,
       so "total spent" is the real number and not just the last 20 bills */
    PosInvoice.aggregate([
      { $match: { customerId: toObjectId(id), ...(scope.businessId ? { businessId: toObjectId(scope.businessId) } : {}) } },
      {
        $group: {
          _id: null,
          invoiceCount: { $sum: 1 },
          totalSpent: { $sum: '$totalAmount' },
          totalPaid: { $sum: '$paid' },
          totalDue: { $sum: '$sellDue' },
          firstPurchase: { $min: '$date' },
          lastPurchase: { $max: '$date' },
        },
      },
    ]),
  ]);

  /* what they actually buy - rolled up from the visible invoices */
  const byItem = new Map();
  invoices.forEach((inv) => (inv.items || []).forEach((l) => {
    const key = String(l.itemCode || l.code || l.itemName || '').trim();
    if (!key) return;
    const row = byItem.get(key) || {
      itemCode: key,
      itemName: l.itemName || l.name || key,
      image: imageUrl(l.image || ''),
      qty: 0, value: 0, times: 0, lastBought: null,
    };
    row.qty += Number(l.qty) || 0;
    row.value += Number(l.netAmount ?? (Number(l.rate || 0) * Number(l.qty || 0))) || 0;
    row.times += 1;
    const when = inv.date ? new Date(inv.date) : null;
    if (when && (!row.lastBought || when > row.lastBought)) row.lastBought = when;
    if (!row.image && l.image) row.image = imageUrl(l.image);
    byItem.set(key, row);
  }));

  const agg = totals[0] || {};

  return json({
    ok: true,
    customer: {
      _id: String(customer._id),
      contactId: customer.contactId || '',
      businessName: customer.businessName || '',
      name: [customer.firstName, customer.middleName, customer.lastName].filter(Boolean).join(' '),
      mobile: customer.billingMobile || '',
      email: customer.billingEmail || '',
      gstNo: customer.gstNo || '',
      city: customer.billingCity || '',
      state: customer.billingState || '',
      address: [customer.billingAddressLine1, customer.billingAddressLine2].filter(Boolean).join(', '),
      creditLimit: customer.invoiceCreditLimit ?? null,
      priceList: customer.priceList || '',
      remarks: customer.remarks || '',
    },
    summary: {
      invoiceCount: agg.invoiceCount || 0,
      totalSpent: round2(agg.totalSpent || 0),
      totalPaid: round2(agg.totalPaid || 0),
      totalDue: round2(agg.totalDue || 0),
      firstPurchase: agg.firstPurchase || null,
      lastPurchase: agg.lastPurchase || null,
      returnCount: returns.length,
      returnValue: round2(returns.reduce((a, r) => a + (Number(r.refundAmount) || 0), 0)),
    },
    invoices: invoices.map((i) => ({
      _id: String(i._id),
      invoiceNo: i.invoiceNo,
      date: i.date,
      totalAmount: i.totalAmount,
      paid: i.paid,
      sellDue: i.sellDue,
      paymentStatus: i.paymentStatus,
      billingType: i.billingType,
      itemCount: (i.items || []).length,
      items: (i.items || []).map((l) => ({
        barcodeNo: l.barcodeNo || '',
        itemCode: l.itemCode || l.code || '',
        itemName: l.itemName || l.name || '',
        qty: Number(l.qty) || 0,
        rate: Number(l.rate ?? l.rsp ?? 0) || 0,
        netAmount: Number(l.netAmount || 0) || 0,
        image: imageUrl(l.image || ''),
      })),
    })),
    returns: returns.map((r) => ({
      _id: String(r._id),
      invoiceNo: r.invoiceNo,
      parentInvoice: r.parentInvoice,
      date: r.date,
      refundAmount: r.refundAmount,
      reason: r.reason,
      itemCount: (r.items || []).length,
    })),
    topItems: [...byItem.values()]
      .map((r) => ({ ...r, value: round2(r.value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12),
  });
});

function toObjectId(v) {
  return new mongoose.Types.ObjectId(String(v));
}

const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
