import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import { BarcodeLabel } from '@/lib/barcodeLabel';
import { requireSession } from '@/lib/session';
import { escapeRegex } from '@/lib/validate';

/* /api/reports/barcode-suggest?q=<part>&business=<id>

   Barcode numbers that start with, or contain, what has been typed - for the
   Barcode Number filter on the Master Stock Report, which lets the operator
   name several barcodes and needs to offer them rather than expect the whole
   number to be typed from memory.

   ITS OWN ROUTE, not /api/inventory-barcode-list. That one answers to the
   Barcode Item and POS screens (BARCODE_LIST_SCREENS in lib/screenPermission),
   so a role that may run this report but works neither of those screens would
   have its suggestions refused while the report itself still loaded. This
   returns nothing but barcode numbers, scoped to the business in the top bar.

   Capped at 20: a suggestion list is for recognising a number, not for
   browsing seven thousand of them. */

const json = (d, s = 200) => Response.json(d, {
  status: s,
  headers: { 'Cache-Control': 'no-store' },
});

const LIMIT = 20;

export async function GET(req) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const sp = new URL(req.url).searchParams;
  const q = String(sp.get('q') || '').trim();

  /* Nothing typed, nothing offered - the alternative is the first twenty
     barcodes in the warehouse, which tell the operator nothing. */
  if (!q) return json({ options: [] });

  await dbConnect();

  const business = sp.get('business');
  const rx = { $regex: escapeRegex(q), $options: 'i' };

  const rows = await BarcodeLabel.find({
    ...(business && isValidObjectId(business) ? { businessId: business } : {}),
    /* both spellings a label can be read by: its own number and the composed
       value the bars carry */
    $or: [{ barcodeNo: rx }, { barcodeGenerated: rx }],
  })
    .select('barcodeNo itemCode itemName')
    .limit(LIMIT)
    .lean();

  /* One entry per NUMBER. Legacy barcode numbers are not unique - several
     rows can share one - and offering the same number three times would look
     like a fault. */
  const seen = new Set();
  const options = [];
  for (const row of rows) {
    const value = String(row.barcodeNo || '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    const name = String(row.itemName || row.itemCode || '').trim();
    options.push({ value, label: name ? value + '  -  ' + name : value });
  }

  return json({ options });
}
