import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import DeliveryChallan from '@/models/DeliveryChallan';
import { requireSession } from '@/lib/session';
import { resolveRefLabels } from '@/lib/refLabels';
import { validate, escapeRegex } from '@/lib/validate';
import { nextDocNumber } from '@/lib/docnumber';
import { screenDenial, SCREENS, ACTIONS as PERM } from '@/lib/screenPermission';

/* Permission gate for this screen.

   The Sales Invoice screen picks its source challans from this same list
   (app/admin/transaction/sell/salesinvoice/form.js), so a role that may
   raise a sales invoice needs Sell Delivery Challan read as well - which is
   the right way round: you cannot invoice challans you may not see. */
const SELL_DC = { screen: SCREENS.SELL_DELIVERY_CHALLAN, label: 'delivery challans' };

import { FORM } from '@/app/admin/transaction/sell/deliverychallan/form';

/* header fields AND the totals rows - the totals card holds real stored
   numbers (taxable value, round off, net value, the editable discounts).
   Leaving them out meant validate() silently dropped them on every save. */
const FIELDS = (FORM.cards || []).flatMap((c) => {
  if (c.type === 'fields') return c.fields || [];
  if (c.type === 'totals') {
    return (c.rows || []).flatMap((r) => [
      ...(r.value ? [{ k: r.value, label: r.label, type: 'number' }] : []),
      ...(r.input ? [{ k: r.input, label: r.label, type: 'number', def: 0 }] : []),
    ]);
  }
  return [];
});

/* /api/sell-deliverychallan - list + create. */

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
    session, ...SELL_DC, action: PERM.READ, businessId: sp.get('business'),
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const filter = {};
  const b = sp.get('business'); if (b && isValidObjectId(b)) filter.businessId = b;
  const l = sp.get('location'); if (l && isValidObjectId(l)) filter.locationId = l;
  const y = sp.get('finYear'); if (y) filter.finYear = y;
  /* Sales Invoice picks challans for ONE customer - the old API ignored this */
  const cus = sp.get('customerId'); if (cus && isValidObjectId(cus)) filter.customerId = cus;

  const from = sp.get('startDate');
  const to = sp.get('endDate');
  if (from) filter.dcDate = { ...(filter.dcDate || {}), $gte: new Date(from) };
  if (to) filter.dcDate = { ...(filter.dcDate || {}), $lte: new Date(to + 'T23:59:59') };

  /* "unconverted" upstream documents: a GRC with no purchase invoice yet, a
     GRT with no debit note yet. $eq: null matches missing AND null - passing
     '' here would be cast against an ObjectId path and throw. */
  const unconverted = sp.get('unconverted');
  if (unconverted) filter[unconverted] = { $eq: null };

  const search = (sp.get('search') || '').trim();
  if (search) {
    const rx = { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = [{ deliveryChallanNo: rx }];
  }

  const total = await DeliveryChallan.countDocuments(filter);
  const rows = await DeliveryChallan.find(filter)
    .sort({ createdAt: -1 })
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
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const body = await req.json();
  await dbConnect();

  const denied = await screenDenial({
    session, ...SELL_DC, action: PERM.CREATE, businessId: body.business,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const { errors, doc, ok } = validate(FIELDS, body.data || {});
  if (!ok) return json({ errors }, 422);
  if (body.business && isValidObjectId(body.business)) doc.businessId = body.business;
  if (body.location && isValidObjectId(body.location)) doc.locationId = body.location;
  if (body.finYear) doc.finYear = body.finYear;

  if (Array.isArray(body.data?.items)) doc.items = body.data.items;

  /* document number from the Doc Setup master */
  if (!doc.deliveryChallanNo) {
    doc.deliveryChallanNo = await nextDocNumber(DeliveryChallan, 'deliveryChallanNo', "Delivery Challan", {
      businessId: doc.businessId, locationId: doc.locationId, finYear: doc.finYear,
    });
  }

  const created = await DeliveryChallan.create(doc);

  return json({ ok: true, id: String(created._id) });
}
