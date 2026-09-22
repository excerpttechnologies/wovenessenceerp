import { Types } from 'mongoose';
import IcDeliveryChallan from '@/models/IcDeliveryChallan';
import StockAdjustment from '@/models/StockAdjustment';
import { BarcodeLabel } from '@/lib/barcodeLabel';
import { nextDocNumber } from '@/lib/docnumber';
import { receiveChallanStock, restoreReturnedStock } from '@/lib/icStock';

/* ==========================================================================
   RECEIVING AN INTER COMPANY CHALLAN - one definition, two callers.

   Receipt used to be a separate step the destination branch performed from
   the "To Receive" tab. It is now automatic: raising a challan ships the
   goods out of the sender AND lands them at the destination in the same
   request, because a branch-to-branch despatch inside one company has no
   acceptance decision to make - the goods are the receiver's the moment they
   leave.

   The logic lives here rather than in either route so the send path and the
   (still supported) manual endpoint cannot drift into two different ideas of
   what "received" means. scripts/receivePendingIcChallans.mjs uses it too.

   RECEIVING MOVES STOCK. The older comments on the route and the screen said
   it did not; they were wrong even before this change - receiveChallanStock()
   has been creating barcodeLabel rows under the receiving business for some
   time, which is what lets the receiver sell the goods at all.
   ========================================================================== */

/* The register entry every stock event in this app leaves behind - the same
   shape POS writes from sell-pos/route.js. A RECORD of a movement that has
   already happened on the barcodeLabel rows, never a second movement. */
export async function writeReceiptRegister({ challan, user = null }) {
  const items = Array.isArray(challan.items) ? challan.items : [];
  if (!items.length) return;

  const businessId = challan.toBusinessId;
  const locationId = challan.toLocationId;
  const finYear = challan.finYear || '';

  const adjustmentNo = await nextDocNumber(
    StockAdjustment, 'adjustmentNo', 'Stock Adjustment', { businessId, locationId, finYear }
  );

  await StockAdjustment.create({
    businessId,
    locationId,
    finYear,
    adjustmentNo,
    type: 'RECEIPT',
    adjustmentReason: 'Inter Company Challan Received',
    adjustmentDate: new Date(),
    remarks: 'Auto-created from delivery challan ' + (challan.dcNo || ''),
    createdBy: user?.name || user?.email || '',
    items,
  });
}

/* Lands the goods and stamps the challan.

   Returns { received: true } when this call did the work, or
   { received: false, already: true } when the challan was already receipted -
   receiving twice must not double the stock, so this is a no-op rather than
   an error. receiveChallanStock() is itself idempotent on
   { sourceBarcodeId, icChallanId }, so a retry after a partial failure
   completes what is missing instead of duplicating what landed.

   `challan` must carry the SHIPPED lines - the ones shipChallanStock()
   returned, with their stockMoves - because stockMoves is what says which of
   the sender's rows each unit came off. */
export async function receiveChallan({ challan, user = null }) {
  if (challan.receivedAt) return { received: false, already: true };

  await receiveChallanStock({ challan, user });
  await writeReceiptRegister({ challan, user });

  /* Written through the raw driver, and guarded on receivedAt still being
      null so two simultaneous callers cannot both stamp it.

      Mongoose caches compiled models on `mongoose.models` and Next's dev
      server hot-reloads route files without re-registering them, so a process
      that started before `receivedAt` joined the schema keeps the old model
      and strict mode drops the $set silently - the request answers 200 while
      the document never changes. .collection bypasses the schema, so the
      write lands whatever the running process last compiled. _id has to be
      cast by hand here, because that casting is the model's job and we have
      just stepped around the model. */
  const res = await IcDeliveryChallan.collection.updateOne(
    { _id: new Types.ObjectId(String(challan._id)), receivedAt: { $eq: null } },
    { $set: { receivedAt: new Date(), receivedBy: user?.name || user?.email || '' } }
  );

  if (!res.modifiedCount) return { received: false, already: true };
  return { received: true };
}

/* Undoes a receipt that could not be completed.

   Only ever called on the send path, where the challan is being abandoned
   wholesale: the rows this challan created at the destination are deleted and
   the quantity is put back on the sender's own rows. Rows the receiver
   already had are never touched - the delete is keyed on icChallanId, which
   only rows created BY this challan carry. */
export async function undoReceive({ challan, user = null }) {
  await BarcodeLabel.deleteMany({ icChallanId: String(challan._id) });

  const asked = (challan.items || [])
    .map((line) => ({ barcodeNo: line.barcodeNo || '', qty: Number(line.qty) || 0 }))
    .filter((l) => l.barcodeNo && l.qty > 0);

  if (asked.length) await restoreReturnedStock({ challan, asked, user });
}
