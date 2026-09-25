import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import LedgerGroupMapping from '@/models/LedgerGroupMapping';
import { requireSession } from '@/lib/session';
import { screenDenial, SCREENS, ACTIONS as PERM } from '@/lib/screenPermission';

/* Permission gate for this screen.

   ONE DOCUMENT PER BUSINESS, ONE SAVE BUTTON. There is no separate add and
   edit here - the same POST creates the row the first time and rewrites it
   every time after - so saving answers to UPDATE OR CREATE rather than to one
   of them. Requiring update alone would refuse the very first save on a
   business that has never been configured; requiring create alone would
   refuse every save after it. The operator sees one button and cannot tell
   which of the two the server is about to do.

   Reading is plain read. */
const LEDGER_MAPPING = { screen: SCREENS.LEDGER_MAPPING, label: 'ledger mapping' };

/* /api/ledger-group-mapping - single document per scope: read + upsert. */

const json = (d, s = 200) => Response.json(d, { status: s });

function scopeOf(sp) {
  const filter = {};
  const b = sp.get('business'); if (b && isValidObjectId(b)) filter.businessId = b;
  return filter;
}

export async function GET(req) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const sp = new URL(req.url).searchParams;
  await dbConnect();

  /* Only refuses when this role has a saved permission matrix that
     withholds it - see lib/screenPermission.js. */
  const denied = await screenDenial({
    session, ...LEDGER_MAPPING, action: PERM.READ, businessId: sp.get('business'),
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const doc = await LedgerGroupMapping.findOne(scopeOf(sp)).lean();
  return json({ doc: doc ? { ...doc, _id: String(doc._id) } : null });
}

export async function POST(req) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const body = await req.json();
  await dbConnect();

  /* Update OR create - see the note at the top of this file. */
  let gate = await screenDenial({
    session, ...LEDGER_MAPPING, action: PERM.UPDATE, businessId: body.business,
  });
  if (gate) {
    gate = await screenDenial({
      session, ...LEDGER_MAPPING, action: PERM.CREATE, businessId: body.business,
    });
  }
  if (gate) return json({ error: gate.message, code: gate.code }, 403);

  const doc = { pairs: body.pairs || {} };
  if (body.business && isValidObjectId(body.business)) doc.businessId = body.business;

  const sp = new URLSearchParams({
    business: body.business || '', location: body.location || '', finYear: body.finYear || '',
  });
  await LedgerGroupMapping.findOneAndUpdate(scopeOf(sp), doc, { upsert: true, new: true });

  return json({ ok: true });
}
