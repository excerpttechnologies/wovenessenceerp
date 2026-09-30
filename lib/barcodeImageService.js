/* A barcode's image, on the SERVER (what and why: lib/barcodeImage.js).

   verifyBarcodeImage(url)   a URL the browser sends for a barcode image -
                             refused unless this ERP's own upload store
                             issued it, the file is still there, it still
                             hashes to its own name and its bytes really are
                             the JPG / PNG / WEBP its name says
   setBarcodeImage(...)      put an image on one barcode row - or take it off
                             - only while the row still holds the image the
                             operator saw
   barcodeImageSrc(stored)   what a stored value is shown as (the app's one
                             resolver) - the barcode's OWN image, nothing
                             borrowed from the Item master or a shipped folder

   Used by the Barcode Report import (lib/barcodeReportImportService.js, its
   route) and the Details screen's image route (app/api/barcode-image). The
   upload itself is the app's existing one (POST /api/upload). */

import crypto from 'crypto';
import fs from 'fs/promises';
import { resolveStored, MAX_UPLOAD_BYTES } from '@/lib/uploads';
import { BarcodeLabel } from '@/lib/barcodeLabel';
import { imageUrl } from '@/lib/inventory';
import {
  storedImageRef, imageKindOfBytes, imageFieldsOf, imageStillIs, CLEAR_IMAGE_FIELDS, MIME_OF_EXT, BARCODE_IMAGE_MESSAGES,
} from '@/lib/barcodeImage';

/* A refusal the route answers with its own status (lib/apiError.js). */
export class BarcodeImageError extends Error {
  constructor(message, status = 422, code = 'BARCODE_IMAGE') {
    super(message);
    this.name = 'BarcodeImageError';
    this.status = status;
    this.code = code;
  }
}

/* Returns { url, mime, bytes } for a URL of a real stored image; throws
   BarcodeImageError otherwise - so no URL the server did not issue, and no
   file that is not an image, is ever saved on a barcode. */
export async function verifyBarcodeImage(url) {
  const ref = storedImageRef(url);
  if (!ref) throw new BarcodeImageError(`${BARCODE_IMAGE_MESSAGES.invalid} It must be uploaded here, not linked.`);
  const abs = resolveStored(ref.segments);
  if (!abs) throw new BarcodeImageError(BARCODE_IMAGE_MESSAGES.invalid);
  let data;
  try {
    const stat = await fs.stat(abs);
    if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_UPLOAD_BYTES) throw new Error('size');
    data = await fs.readFile(abs);
  } catch {
    throw new BarcodeImageError(`${BARCODE_IMAGE_MESSAGES.uploadFailed} The uploaded image could not be found on the server.`);
  }
  /* the name IS the content's hash - a file changed after upload is refused */
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  if (hash !== ref.segments[1].slice(0, 64)) throw new BarcodeImageError(BARCODE_IMAGE_MESSAGES.invalid);
  if (imageKindOfBytes(data.subarray(0, 12)) !== ref.ext) throw new BarcodeImageError(BARCODE_IMAGE_MESSAGES.unreadable);
  return { url: '/api/files/' + ref.segments.join('/'), mime: MIME_OF_EXT[ref.ext], bytes: data.length };
}

/* Puts `image` ({ url, mime, name }) on one barcode row, or clears it when
   `image` is null - only while the row still holds `seen` (the image the
   operator saw: '' for none). true when written; false when the row has a
   different image by now (or is gone), and nothing was changed. */
export async function setBarcodeImage(unitId, image, seen, session = null) {
  const res = await BarcodeLabel.updateOne(
    { _id: unitId, imageUrl: imageStillIs(seen) },
    { $set: { ...(image ? imageFieldsOf(image) : CLEAR_IMAGE_FIELDS), updatedAt: new Date() } },
    session ? { session } : {},
  );
  return res.matchedCount > 0;
}

/* The barcode's own stored image as the screen shows it ('' for none) */
export const barcodeImageSrc = (stored) => imageUrl(String(stored ?? '').trim());
