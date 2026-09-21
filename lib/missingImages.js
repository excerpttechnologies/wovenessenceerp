import { BarcodeLabel, BARCODE_STATUS } from '@/lib/barcodeLabel';

/* ==========================================================================
   Which units in stock have no picture to show.

   "Missing" is not the same as "imageUrl is empty". The Image column on
   Master Stock Report prints a blank marker for an empty field, but a row
   whose imageUrl points at a link that no longer resolves renders as a
   broken image - and to the person looking at the screen those are the same
   complaint. Both are reported here, told apart by `reason`.

   Two causes are detectable from the data alone:

     No image      imageUrl is empty / absent.
     Link expired  the URL states its own lifetime and that lifetime has
                   passed. The legacy ERP stored S3/Spaces presigned links
                   carrying X-Amz-Date and X-Amz-Expires=300, so each was
                   valid for five minutes after it was signed; the ones on
                   file were signed 2026-08-07 and answer 403 today. This is
                   the same test scripts/seedBarcodeImages.mjs makes before
                   it is willing to overwrite a stored photo.

   A data: URI carries the image itself, so it always displays and is never
   reported. An ordinary http(s) URL that happens to 404 cannot be told from
   a working one without fetching it, so it is NOT reported - this module
   never makes a network call.
   ========================================================================== */

export const MISSING_REASONS = {
  NONE: 'No image',
  EXPIRED: 'Link expired',
};

const s = (v) => String(v ?? '').trim();

/* The moment a presigned URL stopped being valid, or null if it is not a
   presigned URL at all / is still inside its window. */
export function expiredAt(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  const date = u.searchParams.get('X-Amz-Date');
  const expires = u.searchParams.get('X-Amz-Expires');
  if (!date || !expires || !u.searchParams.get('X-Amz-Signature')) return null;
  const iso = date.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z');
  const signed = new Date(iso);
  if (Number.isNaN(signed.getTime())) return null;
  const dead = new Date(signed.getTime() + Number(expires) * 1000);
  return dead < new Date() ? dead : null;
}

/* null when the row will display a picture. */
export function imageProblem(imageUrl) {
  const url = s(imageUrl);
  if (!url) return { reason: MISSING_REASONS.NONE, deadAt: null };
  if (url.startsWith('data:')) return null;
  const dead = expiredAt(url);
  if (dead) return { reason: MISSING_REASONS.EXPIRED, deadAt: dead };
  return null;
}

/* The same scope clause Master Stock Report itself applies, so the two
   screens always agree on which units are in play: current stock only, and
   a blank finYear / locationId is included because the barcode screens do
   not always set them and filtering strictly would hide real stock
   (app/api/reports/master-stock-report/route.js). */
export function stockScope({ businessId, locationId, finYear }) {
  const filter = { status: BARCODE_STATUS.IN_STOCK };
  if (businessId) filter.businessId = String(businessId);
  if (finYear) filter.finYear = { $in: [finYear, '', null] };
  if (locationId) filter.locationId = { $in: [String(locationId), '', null] };
  return filter;
}

/* ONE ROW PER BARCODE NUMBER. The same number can sit on more than one
   barcodeLabel row (a unit that passed through more than one GRC), and this
   list exists to be worked through by someone taking photographs - the same
   barcode listed twice is a second trip to the same shelf, not new
   information. The row kept is the earliest, so the oldest stock leads. */
export async function findMissingImages(scope) {
  const rows = await BarcodeLabel.find(stockScope(scope))
    .select('barcodeNo itemCode itemName uom hsn imageUrl createdAt')
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  const out = [];
  const seen = new Set();
  for (const r of rows) {
    const problem = imageProblem(r.imageUrl);
    if (!problem) continue;
    const key = s(r.barcodeNo);
    /* a row with no barcode number at all cannot be looked up on the shelf,
       so it is counted but never collapsed into one nameless line */
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push({
      barcodeNo: key,
      itemCode: s(r.itemCode),
      itemName: s(r.itemName),
      uom: s(r.uom),
      hsn: s(r.hsn),
      reason: problem.reason,
      storedUrl: s(r.imageUrl),
      createdAt: r.createdAt || null,
    });
  }

  const counts = out.reduce((a, r) => ({ ...a, [r.reason]: (a[r.reason] || 0) + 1 }), {});
  return { rows: out, counts, scanned: rows.length };
}

/* The sheet, as an array of arrays - the shape both the download and any
   script writing the file hand to SheetJS. Barcode Number leads because it
   is what the list is for. */
export const SHEET_HEADERS = [
  'Barcode Number', 'Item Code', 'Item Name', 'UOM', 'HSN', 'Reason', 'Stored URL', 'Created',
];

export const sheetRows = (rows) => rows.map((r) => [
  r.barcodeNo || '',
  r.itemCode || '',
  r.itemName || '',
  r.uom || '',
  r.hsn || '',
  r.reason,
  r.storedUrl || '',
  r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : '',
]);
