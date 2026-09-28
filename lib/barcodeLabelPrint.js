import { uomTypeOf, batchTypeOf, saveBatchTypeOf } from '@/lib/barcodeUnits';
import { composedValueOf, unitNumberOf } from '@/lib/barcodeValue';

/* ==========================================================================
   BARCODE LABEL PRINTING - which barcode type a row is, how many stickers it
   gets, and what may be printed on them.

   Client-safe and pure, so the SAME function runs on the server (GET
   /api/grc/[id] stamps every row with barcodeType / labelCount) and in the
   browser (the Barcode Generation print picker - preview AND print run - and
   the GRC Barcode Print page, for rows that exist only on screen until they
   are saved). One definition; nothing re-derives it anywhere else.

   WHERE THE TYPE COMES FROM - the fields Barcode Generation writes onto every
   barcodeLabel row (app/api/barcode-generation/route.js buildDocs):
     uomType    'PC' | 'MTR'        from the row's uom, which the Add Item
                                    form sets from its MTR checkbox
     batchType  'unique' | 'batch'  from its Unique Barcode checkbox - ticked
                                    is unique, unticked is batch
   The Item master's own uniqueBarcode is NOT read: 141 of its 143 items still
   carry the schema default "No", while most generated barcodes are unique.

   THE COUNT RULE
     MTR     1 barcode -> 2 labels
     UNIQUE  1 barcode -> 1 label
     BATCH   1 barcode -> the number the operator enters, never more than the
                          quantity that batch barcode stands for

   These are PRINT copies. Every copy carries the same barcode number, and
   nothing in this module reserves, generates or saves a barcode - so printing
   two stickers for a metre barcode cannot move the barcode sequence, and
   printing twenty-five for a batch cannot create twenty-four more records.
   ========================================================================== */

export const LABEL_MODE = { METER: 'MTR', UNIQUE: 'UNIQUE', BATCH: 'BATCH' };
export const METER_LABELS_PER_BARCODE = 2;

export const BATCH_COUNT_INVALID = 'Please enter a valid number of labels greater than 0.';
export const BATCH_COUNT_TOO_MANY = 'Label quantity cannot exceed the available batch quantity.';
export const BATCH_NO_QUANTITY = 'This batch barcode has no quantity recorded, so no labels can be printed for it.';

const filled = (v) => v !== undefined && v !== null && String(v).trim() !== '';
const missing = (v) => v === undefined || v === null;

/* 'batch' | 'unique', or undefined when the row records neither.

   A SAVED row answers with its stored batchType - the save route wrote it,
   and it is what stock and every report read.

   A row NOT saved yet answers with what the save route WILL store for it
   (saveBatchTypeOf - the route's own expression), not with whichever of the
   grid's columns looks most plausible. The grid's columns can disagree: an
   Excel-imported row is seeded mode "unique" beside uniqueBarcode "No", and
   the route reads mode first. Reading them any other way printed such a row
   as a batch before Submit and as a unique barcode after it - the same
   barcode, two different sticker counts. Labels follow the stored rule. */
function declaredBatchType(r) {
  if (filled(r.batchType)) return batchTypeOf(r.batchType);
  if (missing(r.batchUnique) && missing(r.mode) && missing(r.uniqueBarcode)) return undefined;
  return saveBatchTypeOf(r);
}

/* Which rule a barcode prints under: { mode, assumed }.

   Metres come first, read from the structured uomType the save route writes
   or, for a row not saved yet, from its uom through the same normaliser the
   route uses. MTR and Unique are not exclusive in this ERP - MTR + Unique is
   one barcode per cut, MTR without it one barcode for the whole length - and
   either way the barcode is metres of cloth, so it gets its two stickers.

   Otherwise batch or unique, as declaredBatchType above.

   Nothing declared at all -> UNIQUE with `assumed: true`. One sticker never
   over-prints, and 'unique' is the schema's own default for batchType; the
   picker says it was assumed rather than hiding it. */
export function resolveLabelMode(row) {
  const r = row || {};
  if (String(r.uomType || '').toUpperCase() === 'MTR' || uomTypeOf(r.uom) === 'MTR') {
    return { mode: LABEL_MODE.METER, assumed: false };
  }
  const declared = declaredBatchType(r);
  if (declared === undefined) return { mode: LABEL_MODE.UNIQUE, assumed: true };
  return { mode: declared === 'batch' ? LABEL_MODE.BATCH : LABEL_MODE.UNIQUE, assumed: false };
}

/* 'UNIQUE' | 'MTR' | 'BATCH' - the name the business rule is written in. */
export function resolveBarcodeType(row) {
  return resolveLabelMode(row).mode;
}

/* The most stickers a batch barcode may have: the quantity it stands for.
   qtyNum is the saved number (lib/barcodeLabel.js); a row not saved yet only
   has the form's qty text. Whole stickers only, so 12.5 allows 12. */
export function batchAvailableQty(row) {
  const n = Number(row?.qtyNum ?? row?.qty);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/* The operator's answer to "how many labels?".

   Taken as TEXT and checked here, because a number input quietly turns
   "2.5", "-2" or "abc" into something else before any rule sees it. Only a
   run of digits is a count: that refuses blank, zero, negatives, decimals,
   exponents and letters in one test.

   Returns { ok: true, value } or { ok: false, error }. */
export function validateBatchLabelCount(raw, available) {
  const text = String(raw ?? '').trim();
  if (!/^\d+$/.test(text)) return { ok: false, error: BATCH_COUNT_INVALID };
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value < 1) return { ok: false, error: BATCH_COUNT_INVALID };
  if (!(Number(available) > 0)) return { ok: false, error: BATCH_NO_QUANTITY };
  if (value > Number(available)) return { ok: false, error: BATCH_COUNT_TOO_MANY };
  return { ok: true, value };
}

/* Stickers for ONE barcode.

   `batchCount` is the operator's answer for a BATCH barcode and is ignored
   for the other two - an MTR or UNIQUE count is never asked for, so neither
   a typed number nor the row's quantity can change it (UNIQUE with a
   quantity of 50 is still 1 label). A batch with no valid answer yet prints
   nothing rather than a guess. */
export function getLabelPrintCount(row, batchCount) {
  const { mode } = resolveLabelMode(row);
  if (mode === LABEL_MODE.METER) return METER_LABELS_PER_BARCODE;
  if (mode === LABEL_MODE.UNIQUE) return 1;
  const check = validateBatchLabelCount(batchCount, batchAvailableQty(row));
  return check.ok ? check.value : 0;
}

export function resolveBarcodeLabelCount(row, batchCount) {
  return getLabelPrintCount(row, batchCount);
}

/* Every row with its sticker count as `copies`, which is what
   components/BarcodeLabelSheet.jsx expands. `batchCounts` is keyed the same
   way `keyOf` keys the rows. */
export function withLabelCounts(rows, batchCounts = {}, keyOf = labelKey) {
  return (rows || []).map((row) => ({ ...row, copies: getLabelPrintCount(row, batchCounts[keyOf(row)]) }));
}

/* BATCH rows Print still has to ask about: no valid count yet.

   A batch barcode with no whole quantity recorded (batchAvailableQty 0) is
   left out. No count can ever be valid for it, so asking would only put a
   dialog in front of the operator that can do nothing but cancel - and stop
   every other label on the sheet from printing with it. It prints 0 labels
   and the screens say why (isUnprintableBatch). */
export function pendingBatchRows(rows, batchCounts = {}, keyOf = labelKey) {
  return (rows || []).filter((row) => resolveLabelMode(row).mode === LABEL_MODE.BATCH
    && batchAvailableQty(row) > 0
    && !validateBatchLabelCount(batchCounts[keyOf(row)], batchAvailableQty(row)).ok);
}

/* A batch barcode that can never have a label: no whole quantity recorded. */
export function isUnprintableBatch(row) {
  return resolveLabelMode(row).mode === LABEL_MODE.BATCH && batchAvailableQty(row) === 0;
}

/* A price as a sticker prints it: whole rupees without ".00", paise kept when
   there are any - 100 and "100.00" -> "100", 100.5 -> "100.50". Worked on the
   number (rounded to paise), not on the text; the stored price is untouched.
   '' for a blank price; a value that is not a number prints as stored. */
export function formatLabelPrice(value) {
  const text = String(value ?? '').trim().replace(/,/g, '');
  if (text === '') return '';
  const n = Number(text);
  if (!Number.isFinite(n)) return String(value).trim();
  const paise = Math.round((n + Number.EPSILON) * 100);
  return paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);
}

export function labelKey(row) {
  return String(row?.barcodeNo || row?.barcodeGenerated || '');
}

/* ==========================================================================
   THE LABEL DATA CONTRACT - the only fields a printed label may carry.

   Built by WHITELIST: a field not named below cannot reach a sticker however
   the row it came from is shaped. That is the point. A barcode row carries
   supplierId, and the screens that feed the printer have at various times
   added supplierName, supplierCode, grcNo, grcNumber and billSlNo to it -
   some for label display, others not. They remain on the barcode row, the
   GRC and every report; only what's explicitly whitelisted here reaches paper.

   Both the saved shape (purRate, finalNet, qtyNum, batchType) and the
   generation grid's shape (purchaseRate, finalPrice, qty, uniqueBarcode) are
   accepted, so a row does not have to be re-mapped before it is printed.

   `description` falls back to supplierDescription - the item as the vendor
   worded it, which is product text, not the vendor's identity - exactly as
   the label always has.
   ========================================================================== */
export function toLabelData(row) {
  const r = row || {};
  const quantity = Number(r.qtyNum ?? r.qty ?? 0);
  /* ONE VALUE FOR THE BARS AND THE TEXT (lib/barcodeValue.js).

     barcode           what the bars encode: the record's composed value in
                       its canonical spelling, "G1319*05182*1*6" - or, for a
                       record made before composed values existed, its own
                       number. The item code only when a record has neither.
     barcodeGenerated  the right-hand text: that SAME composed value, the same
                       string the bars were drawn from, never a second
                       rendering of it. '' when the record has none.
     barcodeNo         the left-hand text: the unit's own number ("9A1135"),
                       never a composed value. '' for a record that has no
                       number of its own.

     These used to be read straight off the two stored fields, so a record
     that held one string in both printed it once on the left, left the right
     blank, and encoded whichever it was - a 21-character value in bars too
     dense to print. Every shape of record now resolves the same way. */
  const composed = composedValueOf(r);
  const unitNo = unitNumberOf(r);
  const barcode = composed || unitNo || String(r.itemCode || '');
  return {
    barcode,
    barcodeNo: unitNo,
    barcodeGenerated: composed ? barcode : '',
    description: String(r.printDescription || r.supplierDescription || r.itemName || ''),
    quantity: Number.isFinite(quantity) ? quantity : 0,
    unit: String(r.uom || r.uomType || ''),
    isBatch: declaredBatchType(r) === 'batch',
    sellingPrice: r.offerPrice || r.retailPrice || r.rsp || '',
    /* the RATE and OFFER of the GRC label, kept apart (sellingPrice above
       folds them into one for the Inventory label sheet) */
    retailPrice: r.retailPrice || r.rsp || '',
    offerPrice: r.offerPrice || '',
    costPrice: r.finalNet || r.finalPrice || r.purRate || r.purchaseRate || '',
    encodedCostPrice: String(r.encodedPurRate || r.encodedPurchaseRate || ''),
    wspPrice: r.wspPrice || r.wsp || '',
    hsn: String(r.hsn || ''),
    itemCode: String(r.itemCode || ''),
    pmf: String(r.p_m_f || ''),
    /* The line at the foot of the label: the SAME barcode value, not another
       representation of it. It used to be composed here from other fields
       (groupId * billSlNo * seq * qty), and a "GRC ... · Supplier ..." line
       sat beside the number - two more ways of writing one barcode, neither
       of them what the bars encode. */
    labelIdentifier: barcode,
  };
}
