import { isValidObjectId, Types } from 'mongoose';
import dbConnect from '@/lib/db';
import { requireSession } from '@/lib/session';
import { escapeRegex } from '@/lib/validate';
import { Supplier } from '@/lib/contacts';
import { isSplitContactStorage } from '@/lib/contactStorage';

/* /api/reports/supplier-cities?q=<part>&business=<id>

   The cities the City filter on the Master Stock Report offers - taken from
   the SUPPLIER master (billing and shipping city), not from the all-India
   city list at /api/cities. The filter exists to pick a city and then that
   city's suppliers, so a city no supplier sits in is a dead end and is not
   offered.

   Names starting with what was typed come first ("BA" -> Bangalore before
   Hubballi), then the ones merely containing it. Spellings that differ only
   in case or spaces collapse into one entry. */

const json = (d, s = 200) => Response.json(d, {
  status: s,
  headers: { 'Cache-Control': 'no-store' },
});

const LIMIT = 30;

export async function GET(req) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const sp = new URL(req.url).searchParams;
  await dbConnect();

  const q = String(sp.get('q') || '').trim();
  const business = sp.get('business');

  const match = {};
  if (business && isValidObjectId(business)) match.businessId = new Types.ObjectId(business);
  /* the shared `contact` collection holds customers and agents too */
  if (!isSplitContactStorage()) match.contactKind = 'Supplier';

  const rows = await Supplier.aggregate([
    { $match: match },
    { $project: { c: ['$billingCity', '$shippingCity'] } },
    { $unwind: '$c' },
    { $project: { c: { $trim: { input: { $ifNull: ['$c', ''] } } } } },
    { $match: { c: q ? { $regex: escapeRegex(q), $options: 'i' } : { $ne: '' } } },
    { $group: { _id: { $toUpper: '$c' }, name: { $first: '$c' } } },
  ]);

  const lq = q.toLowerCase();
  const cities = rows
    .map((r) => r.name)
    .filter(Boolean)
    .sort((a, b) => {
      const pa = a.toLowerCase().startsWith(lq) ? 0 : 1;
      const pb = b.toLowerCase().startsWith(lq) ? 0 : 1;
      return pa - pb || a.localeCompare(b);
    })
    .slice(0, LIMIT);

  return json({ options: cities.map((c) => ({ value: c, label: c })) });
}
