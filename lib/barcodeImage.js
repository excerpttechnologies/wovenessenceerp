/* A BARCODE'S IMAGE - the picture of one barcode, kept on its own barcode
   row: BarcodeLabel.imageUrl (lib/barcodeLabel.js).

   That field already IS the barcode's photo - the mobile app writes it
   straight onto the row, and every screen that shows a barcode's picture
   reads it through lib/inventory.js imageUrl() - so a picture added from the
   web goes into the same field rather than a second one. It is never written
   to the Item master (Item.image), a supplier or a group.

   The file itself goes through the app's own upload flow: the browser
   downsizes it (lib/imageFile.js compressImage) and sends it to POST
   /api/upload -> lib/uploads.js saveBuffer, which keeps it on the server's
   disk, named by the sha256 of its content, served back by /api/files
   (session-gated). Only its URL is saved on the barcode - never image bytes,
   never a data: URI, and never a URL the browser supplies unchecked: the
   server accepts only a URL of its own store, for a file that is still there,
   still hashes to its own name and really is a JPG, PNG or WEBP
   (lib/barcodeImageService.js verifyBarcodeImage).

   Why the file is not named barcodes/<barcode>.jpg: /api/files serves every
   file as immutable (cached for a year), so a replaced picture under the same
   name would keep showing the old one; and a name built from typed text is a
   path the server would have to trust. The barcode <-> image link is the
   barcode row's field, set by barcode.

   Pure - used by the browser and the server alike. */

export const BARCODE_IMAGE_TYPES = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
};
export const BARCODE_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp';
/* the upload store's own limit (lib/uploads.js MAX_UPLOAD_BYTES) */
export const BARCODE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export const BARCODE_IMAGE_MESSAGES = {
  invalid: 'Invalid barcode image. Please upload JPG, JPEG, PNG or WEBP.',
  notImage: 'Please copy an image and paste it here.',
  unreadable: 'Invalid barcode image - that file could not be read as an image. Please upload JPG, JPEG, PNG or WEBP.',
  tooBig: `Invalid barcode image - it is larger than ${BARCODE_IMAGE_MAX_BYTES / (1024 * 1024)} MB.`,
  uploadFailed: '⚠ Barcode image upload failed. Please try again.',
  clipboardBlocked: 'This browser did not let the page read the clipboard - click in the Barcode Image box and press Ctrl+V.',
};

/* A browser's name for a JPG, and its bare lower-case type */
const typeOf = (file) => {
  const t = String(file?.type || '').toLowerCase().split(';')[0].trim();
  return t === 'image/jpg' || t === 'image/pjpeg' ? 'image/jpeg' : t;
};

/* Why a picked, pasted or dropped file cannot be a barcode image, or '':
   its type, its extension (the two must agree - a pasted screenshot has no
   extension at all) and its size. Whether its bytes really are an image is
   checked by decoding it (the browser) and by its first bytes (the server). */
export function barcodeImageProblem(file) {
  if (!file) return BARCODE_IMAGE_MESSAGES.notImage;
  const type = typeOf(file);
  const exts = BARCODE_IMAGE_TYPES[type];
  if (!exts) return BARCODE_IMAGE_MESSAGES.invalid;
  const ext = (String(file.name || '').match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
  if (ext && !Object.values(BARCODE_IMAGE_TYPES).flat().includes(ext)) return BARCODE_IMAGE_MESSAGES.invalid;
  if (ext && !exts.includes(ext)) return BARCODE_IMAGE_MESSAGES.invalid;
  if (!(Number(file.size) > 0)) return BARCODE_IMAGE_MESSAGES.unreadable;
  if (Number(file.size) > BARCODE_IMAGE_MAX_BYTES) return BARCODE_IMAGE_MESSAGES.tooBig;
  return '';
}

/* A URL of the app's own upload store holding an image:
   /api/files/<first two hex>/<sha256>.<jpg|png|webp> -> { segments, ext },
   else null. Anything else - an http(s) link, a data: URI, a path that
   climbs out, another route, a PDF - is not one the server issued for a
   barcode image. */
const STORED_IMAGE = /^\/api\/files\/([0-9a-f]{2})\/([0-9a-f]{64})\.(jpg|png|webp)$/;
export function storedImageRef(url) {
  const m = STORED_IMAGE.exec(String(url ?? '').trim());
  if (!m || m[2].slice(0, 2) !== m[1]) return null;
  return { segments: [m[1], `${m[2]}.${m[3]}`], ext: m[3] };
}

/* What a file's first bytes say it is: 'jpg' | 'png' | 'webp' | ''. */
export function imageKindOfBytes(bytes) {
  const b = bytes || [];
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return 'png';
  if (b.length >= 12 && String.fromCharCode(...Array.from(b).slice(0, 4)) === 'RIFF' && String.fromCharCode(...Array.from(b).slice(8, 12)) === 'WEBP') return 'webp';
  return '';
}

/* The MIME a stored image extension is served as */
export const MIME_OF_EXT = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

/* The barcode row's fields an image sets - and clears - all four describing
   the one file: its URL, its key in the upload store (filePath - where the
   mobile backend kept its own disk path; lib/inventory.js imageUrl() maps
   the key to the same /api/files URL), its type and its original name. A
   replaced mobile photo leaves nothing of itself behind. */
export function imageFieldsOf(image) {
  const url = String(image?.url || '');
  return {
    imageUrl: url,
    filePath: url.startsWith('/api/files/') ? url.slice('/api/files/'.length) : '',
    mimeType: String(image?.mime || ''),
    originalName: String(image?.name || '').slice(0, 200),
  };
}
export const CLEAR_IMAGE_FIELDS = { imageUrl: '', filePath: '', mimeType: '', originalName: '' };

/* The filter that finds a barcode row only while it still holds the image
   the operator saw - '' (none) matches an empty, null or missing field. */
export const imageStillIs = (seen) => {
  const value = String(seen ?? '');
  return value === '' ? { $in: ['', null] } : value;
};

/* WHAT ONE BARCODE'S IMAGE BECOMES on Import - on its own, never tied to the
   barcode's data decision (KEEP EXISTING / REPLACE WITH IMPORTED DATA):
     none      no new image attached - the barcode's image stays as it is
     save      a new barcode, or one with no image yet: the new image is saved
     replace   it has an image and the operator chose Replace Image
     keep      it has an image and the operator chose (or left) Keep Existing
     blocked   the barcode cannot take one here (it cannot be imported)
   `status` - the row's (new | same | changed | locked | invalid);
   `existing` - the image it already has ('' for none); `pending` - a new
   image is attached; `decision` - 'keep' | 'replace' | undefined. */
export function imagePlan({ status, existing = '', pending = false, decision } = {}) {
  if (!pending) return 'none';
  if (!['new', 'same', 'changed', 'locked'].includes(status)) return 'blocked';
  if (status === 'new' || !String(existing || '').trim()) return 'save';
  return decision === 'replace' ? 'replace' : 'keep';
}

/* THE SERVER'S DECISION for one barcode's image on Import, against its
   FRESH classification (checked again inside the import's transaction - the
   preview is never trusted to still be true), by barcode, never by row:
     row     the barcode's row as classifyRecords made it (status, unitId,
             existing.imageUrl - what the barcode holds now, as stored)
     entry   what the operator sent: { url, mime, name, unitId, seen,
             replace } - its url already verified (verifyBarcodeImage)
     seeded  a NEW barcode is being inserted now (ticked)
   Returns { write: 'insert' | 'update' | null, action, reason?, filter?,
   set? } - action 'saved' | 'replaced' | 'kept' | 'retained' | 'skipped' |
   'error'. An image is written only where the barcode still holds exactly
   the image the operator saw (`seen`), on the unit they saw (`unitId`), and
   replaces a saved one only when they chose Replace Image. It never touches
   the barcode's data, and the data decision never touches it. */
export function imageWriteFor(row, entry, { seeded = false } = {}) {
  if (!entry) return { write: null, action: 'skipped' };
  if (!row) return { write: null, action: 'error', reason: 'This barcode is not in the import - its image was not saved' };
  const set = imageFieldsOf(entry);
  if (row.status === 'new') {
    return seeded
      ? { write: 'insert', action: 'saved', set }
      : { write: null, action: 'skipped', reason: 'The barcode was not seeded, so its image was not saved' };
  }
  if (!['same', 'changed', 'locked'].includes(row.status) || !row.unitId) {
    return { write: null, action: 'error', reason: row.reason ? `${row.reason} - its image was not saved` : 'The barcode cannot be imported - its image was not saved' };
  }
  if (entry.unitId && String(entry.unitId) !== String(row.unitId)) {
    return { write: null, action: 'retained', reason: 'This barcode now answers to another unit - its image was left as it is; check it again' };
  }
  const current = String(row.existing?.imageUrl ?? '');
  if (String(entry.seen ?? '') !== current) {
    return { write: null, action: 'retained', reason: 'The barcode image was changed here meanwhile - it was left as it is; check it again' };
  }
  if (current.trim() && !entry.replace) return { write: null, action: 'kept', reason: 'Existing barcode image kept' };
  return {
    write: 'update',
    action: current.trim() ? 'replaced' : 'saved',
    filter: { _id: row.unitId, imageUrl: imageStillIs(current) },
    set,
  };
}
