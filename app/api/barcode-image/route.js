import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import { handler, json } from '@/lib/apiError';
import { requireUser, requirePermission, PERMISSIONS } from '@/lib/rbac';
import { BarcodeLabel } from '@/lib/barcodeLabel';
import { verifyBarcodeImage, setBarcodeImage, barcodeImageSrc } from '@/lib/barcodeImageService';

/* /api/barcode-image - ONE barcode's BARCODE IMAGE, from Barcode Report ->
   Details (components/BarcodeDetailView.jsx).

     POST    { unitId, url, name, seen, business }   save / replace
     DELETE  { unitId, seen, business }              remove

   The picture is uploaded first through the app's own upload flow (POST
   /api/upload); here its URL is checked against the upload store - it must
   be one this server issued, for a file that is still there and really is a
   JPG / PNG / WEBP (lib/barcodeImageService.js verifyBarcodeImage) - and
   saved on that barcode's own row, barcodeLabel.imageUrl. Nothing else of the
   barcode changes, and no Item, supplier or group master is touched.

   `seen` is the image the operator saw on the screen, as stored: the write
   happens only while the barcode still holds exactly that, so a picture
   someone else saved meanwhile (the mobile app, another screen) is never
   overwritten or removed unseen - the answer is 409 and the screen reloads.

   The same permission Barcode Report -> Import needs (Barcode Generation), at
   the barcode's own location. */

async function unitFor(body) {
  const unitId = String(body?.unitId || '');
  if (!isValidObjectId(unitId)) return { error: json({ error: 'No barcode was given for the image.' }, 422) };
  await dbConnect();
  const unit = await BarcodeLabel.findById(unitId).select('barcodeNo barcodeGenerated imageUrl businessId currentLocationId locationId').lean();
  if (!unit) return { error: json({ error: 'That barcode no longer exists.' }, 404) };
  const business = String(body?.business || '');
  if (business && String(unit.businessId || '') !== business) {
    return { error: json({ error: 'That barcode belongs to another business - its image was not changed.' }, 403) };
  }
  await requirePermission(PERMISSIONS.BARCODE_GENERATE, { locationId: String(unit.currentLocationId || unit.locationId || '') || undefined });
  return { unit };
}

export const POST = handler(async (req) => {
  await requireUser();
  const body = await req.json().catch(() => ({}));
  const { unit, error } = await unitFor(body);
  if (error) return error;
  /* checked after the permission, so an unauthorised caller cannot probe the store */
  const stored = await verifyBarcodeImage(body?.url);
  const written = await setBarcodeImage(unit._id, { ...stored, name: String(body?.name || '') }, body?.seen);
  if (!written) {
    return json({ error: 'This barcode\'s image was changed meanwhile - it was left as it is. Look at it again, then save.', code: 'IMAGE_CHANGED' }, 409);
  }
  return json({ ok: true, barcodeNo: unit.barcodeNo || unit.barcodeGenerated || '', barcodeImageUrl: barcodeImageSrc(stored.url), barcodeImageStored: stored.url });
});

export const DELETE = handler(async (req) => {
  await requireUser();
  const body = await req.json().catch(() => ({}));
  const { unit, error } = await unitFor(body);
  if (error) return error;
  const written = await setBarcodeImage(unit._id, null, body?.seen);
  if (!written) {
    return json({ error: 'This barcode\'s image was changed meanwhile - it was left as it is. Look at it again, then remove it.', code: 'IMAGE_CHANGED' }, 409);
  }
  return json({ ok: true, barcodeNo: unit.barcodeNo || unit.barcodeGenerated || '', barcodeImageUrl: '', barcodeImageStored: '' });
});
