/* Receives inter company delivery challans left sitting in the old
   "To Receive" queue.

   Receipt is now automatic - /api/ic-delivery-challan lands the goods at the
   destination in the same request that ships them - and the "To Receive" tab
   that used to hold them has been removed from the screen. Any challan that
   was sent but never accepted before that change is therefore in the worst
   possible state: its stock LEFT the sender when it was raised, never arrived
   at the destination, and there is no longer a button anywhere to land it.
   This finishes those.

   SAFE BY CONSTRUCTION:

     - only challans with receivedAt == null are touched; an already-received
       challan is skipped, so running it twice is a no-op
     - the work is done by receiveChallan() in lib/icReceive.js - the SAME
       function the send path and the API route call, so a backfilled challan
       is indistinguishable from one received normally
     - receiveChallanStock() is idempotent on { sourceBarcodeId, icChallanId },
       so a challan half-landed by an earlier failure is completed rather than
       duplicated
     - a challan whose lines carry no stockMoves is reported and SKIPPED, not
       guessed at: without stockMoves there is no record of which of the
       sender's rows the goods came off, and inventing one would create stock
       that never existed
     - nothing is written at all without --apply

   Dry run:  npm run ic:receive-pending
   Apply:    npm run ic:receive-pending:apply
*/

import mongoose from 'mongoose';
import IcDeliveryChallan from '@/models/IcDeliveryChallan';
import { receiveChallan } from '@/lib/icReceive';

const APPLY = process.argv.includes('--apply');

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is not set. Run with --env-file=.env');
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);

const pending = await IcDeliveryChallan.find({ receivedAt: { $eq: null } })
  .sort({ dcDate: 1, createdAt: 1 })
  .lean();

if (!pending.length) {
  console.log('Nothing pending - every inter company challan is already received.');
  await mongoose.disconnect();
  process.exit(0);
}

console.log((APPLY ? 'APPLYING' : 'DRY RUN') + ' - ' + pending.length + ' challan(s) awaiting receipt\n');

let done = 0;
let skipped = 0;
let failed = 0;

for (const challan of pending) {
  const lines = Array.isArray(challan.items) ? challan.items : [];
  const moves = lines.reduce((n, l) => n + (Array.isArray(l.stockMoves) ? l.stockMoves.length : 0), 0);
  const qty = lines.reduce((n, l) => n + (Number(l.qty) || 0), 0);
  const tag = (challan.dcNo || String(challan._id)) + '  ' + lines.length + ' line(s), qty ' + qty;

  /* No stockMoves means nothing recorded which rows the goods came off. */
  if (!moves) {
    console.log('  SKIP  ' + tag + '  - no stockMoves on any line, cannot place the goods');
    skipped += 1;
    continue;
  }

  if (!APPLY) {
    console.log('  would receive  ' + tag + '  (' + moves + ' stock move(s))');
    done += 1;
    continue;
  }

  try {
    const { received, already } = await receiveChallan({ challan, user: { name: 'backfill' } });
    if (already) {
      console.log('  SKIP  ' + tag + '  - already received');
      skipped += 1;
    } else if (received) {
      console.log('  received  ' + tag);
      done += 1;
    }
  } catch (err) {
    console.log('  FAILED  ' + tag + '  - ' + (err?.message || err));
    failed += 1;
  }
}

console.log('\n' + (APPLY ? 'Received' : 'Would receive') + ': ' + done
  + '   Skipped: ' + skipped + '   Failed: ' + failed);
if (!APPLY) console.log('\nNothing was written. Re-run with --apply to land these.');

await mongoose.disconnect();
