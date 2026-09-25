import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import StockAdjustment from '@/models/StockAdjustment';
import { requireSession } from '@/lib/session';
import { resolveRefLabels } from '@/lib/refLabels';
import { validate, escapeRegex } from '@/lib/validate';
import { handler } from '@/lib/apiError';
import { requirePermission, PERMISSIONS } from '@/lib/rbac';
import { withTransaction, adjustStock } from '@/lib/inventory';
import { screenDenial, SCREENS, ACTIONS as PERM } from '@/lib/screenPermission';

const STOCK_ADJUSTMENT = { screen: SCREENS.STOCK_ADJUSTMENT, label: 'stock adjustments' };

import { FORM } from '@/app/admin/inventory/stock-adjustment/form';

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

/* /api/stock-adjustment - list + create. */

const json = (d, s = 200) => Response.json(d, { status: s });
const PER_PAGE = 10;

export async function GET(req) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const sp = new URL(req.url).searchParams;
  await dbConnect();

  const page = Math.max(1, Number(sp.get('page') || 1));
  const perPage = Math.min(500, Number(sp.get('perPage') || PER_PAGE));
  const search = (sp.get('search') || '').trim();

  /* Only refuses when this role has a saved permission matrix that
     withholds it - see lib/screenPermission.js. */
  const denied = await screenDenial({
    session, ...STOCK_ADJUSTMENT, action: PERM.READ, businessId: sp.get('business'),
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const filter = {};
  const b = sp.get('business'); if (b && isValidObjectId(b)) filter.businessId = b;
  const l = sp.get('location'); if (l && isValidObjectId(l)) filter.locationId = l;
  const y = sp.get('finYear'); if (y) filter.finYear = y;

  if (search) {
    const rx = { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = [{ remarks: rx }];
  }

  const total = await StockAdjustment.countDocuments(filter);
  const rows = await StockAdjustment.find(filter)
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

export const POST = handler(async (req) => {
  const session = await requirePermission(PERMISSIONS.MASTERS_MANAGE, { locationId: null });

  const body = await req.json();
  await dbConnect();

  const denied = await screenDenial({
    session, ...STOCK_ADJUSTMENT, action: PERM.CREATE, businessId: body.business,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const { errors, doc, ok } = validate(FIELDS, body.data || {});
  if (!ok) return json({ errors }, 422);
  if (body.business && isValidObjectId(body.business)) doc.businessId = body.business;
  if (body.location && isValidObjectId(body.location)) doc.locationId = body.location;
  if (body.finYear) doc.finYear = body.finYear;

  /* line items are free-form per document type */
  if (Array.isArray(body.data?.items)) doc.items = body.data.items;
  if (body.data?.type) doc.type = String(body.data.type);

  /* An adjustment is a stock movement like any other, so it is written to the
     ledger in the same transaction as the document. Without this the stock
     reports and the adjustment register would tell two different stories -
     which is the exact failure the ledger exists to prevent.

     Stock Addition adds, Stock Subtraction removes; the screen's tab is
     stored in `type`. */
  const created = await withTransaction(async (dbSession) => {
    const [adjustment] = await StockAdjustment.create(
      [doc], dbSession ? { session: dbSession } : {}
    );

    if (Array.isArray(doc.items) && doc.items.length) {
      await adjustStock({
        lines: doc.items,
        direction: String(doc.type || '').toLowerCase().startsWith('sub') ? 'out' : 'in',
        businessId: doc.businessId,
        locationId: doc.locationId,
        finYear: doc.finYear,
        ref: adjustment,
        reason: doc.adjustmentReason || '',
        user: session,
        session: dbSession,
      });
    }

    return adjustment;
  });

  return json({ ok: true, id: String(created._id) });
});
