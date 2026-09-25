import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import PosInvoice from '@/models/PosInvoice';
import { requireSession } from '@/lib/session';
import { escapeRegex } from '@/lib/validate';
import { barcodeCandidates, linesAnswering, lineBarcodeSpellings } from '@/lib/inventory';
import { screenDenial, SCREENS, ACTIONS as PERM } from '@/lib/screenPermission';

const POS = { screen: SCREENS.POS, label: 'POS bills' };

/* /api/sell-pos/recent?code=<barcode|item code>&business=&location=

   The past sales that contain a given piece, newest first. The till uses it in
   exchange mode: the operator scans what the customer is handing back and
   picks which sale it came from, instead of having to know the invoice number.

   Matched on barcodeNo OR itemCode because both are on the line and the
   operator may have either in hand - a label that still scans, or a code read
   off the garment. Matching is exact but case-insensitive; a partial match
   would pull in unrelated items whose code merely starts the same. */

const json = (d, s = 200) => Response.json(d, {
  status: s,
  headers: { 'Cache-Control': 'no-store' },
});

const LIMIT = 20;

export async function GET(req) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const sp = new URL(req.url).searchParams;
  const code = (sp.get('code') || '').trim();
  if (!code) return json({ rows: [] });

  await dbConnect();

  /* Read OR create, not read alone: this is the till's exchange lookup, used
     while a sale is being rung up. A role allowed to bill but not to browse
     the day's sales would otherwise be unable to take a return against the
     bill it is allowed to raise. */
  let gate = await screenDenial({
    session, ...POS, action: PERM.READ, businessId: sp.get('business'),
  });
  if (gate) {
    gate = await screenDenial({
      session, ...POS, action: PERM.CREATE, businessId: sp.get('business'),
    });
  }
  if (gate) return json({ error: gate.message, code: gate.code }, 403);

  const b = sp.get('business');
  const l = sp.get('location');

  /* The line stores the unit's own number; the label in hand may carry its
     composed value or its old barcode. So the code is resolved to the units
     it may mean first, and the lines are matched on every exact spelling of
     the code and of those units' values - as well as, as before, on the code
     itself ignoring case. */
  const candidates = await barcodeCandidates([code], { businessId: b && isValidObjectId(b) ? b : null });
  const exact = { $regex: '^' + escapeRegex(code) + '$', $options: 'i' };
  const filter = {
    $or: [
      { 'items.barcodeNo': { $in: lineBarcodeSpellings([code], candidates) } },
      { 'items.barcodeNo': exact },
      { 'items.itemCode': exact },
    ],
  };

  if (b && isValidObjectId(b)) filter.businessId = b;
  if (l && isValidObjectId(l)) filter.locationId = l;

  const invoices = await PosInvoice.find(filter)
    .sort({ date: -1, createdAt: -1 })
    .limit(LIMIT)
    .lean();

  /* Only the matching line is of interest - an invoice may carry twenty others
     and the operator is choosing between SALES of this piece, not browsing
     bills. */
  const rows = invoices.map((inv) => {
    const items = inv.items || [];
    const line = linesAnswering(items, code, candidates)[0]
      || items.find((l) => (
        String(l.barcodeNo || '').toLowerCase() === code.toLowerCase()
        || String(l.itemCode || '').toLowerCase() === code.toLowerCase()
      )) || {};

    return {
      _id: String(inv._id),
      invoiceNo: inv.invoiceNo || '',
      date: inv.date,
      customerName: inv.customerSnapshot?.businessName
        || [inv.customerSnapshot?.firstName, inv.customerSnapshot?.lastName].filter(Boolean).join(' ')
        || 'Walk-in Customer',
      totalAmount: Number(inv.totalAmount || 0),
      barcodeNo: line.barcodeNo || '',
      itemCode: line.itemCode || line.code || '',
      itemName: line.itemName || line.name || '',
      qty: Number(line.qty || 0),
      rsp: Number(line.rsp || line.rate || 0),
      netAmount: Number(line.netAmount || 0),
      salesPerson: line.salesPerson ? String(line.salesPerson) : '',
    };
  });

  return json({ rows });
}
