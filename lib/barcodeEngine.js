// import Counter, { reserveSequence, ensureFloor, counterKey } from '@/models/Counter';
// import BarcodeSetting from '@/models/BarcodeSetting';
// import { BarcodeLabel } from '@/lib/barcodeLabel';
// import { uomTypeOf, batchTypeOf } from '@/lib/barcodeUnits';

// /* ==========================================================================
//    THE BARCODE ENGINE - the single definition of how many barcodes a received
//    quantity produces, and what each one stands for.

//    The rule the client specified, in full:

//      UOM   TYPE     QTY   BARCODES   EACH BARCODE REPRESENTS
//      ---   ------   ---   --------   -----------------------
//      PC    batch      1          1   the whole batch (1 pc)
//      PC    batch      5          1   the whole batch (5 pc)
//      PC    unique     5          5   1 pc
//      MTR   batch      5          1   the whole batch (5 mtr)
//      MTR   unique     5          5   1 cut each (metres per cut)

//    Read as one rule rather than four cases:

//      batch  -> ONE barcode carrying the entire quantity
//      unique -> ONE barcode per unit; UOM decides what a "unit" is
//                (PC: one piece. MTR: one cut, carrying that cut's metres.)

//    This was previously implemented inside the Barcode Generation screen only
//    (components/GCRBarcodeGeneration.jsx buildBarcodePlan), in the browser,
//    with a client-held running sequence. That meant POS, stock transfer,
//    receiving, returns and the reports each had to re-derive what a barcode
//    meant from free text, and two operators generating at once could issue the
//    same number. Both problems are fixed by moving the rule here and the
//    numbering onto an atomic counter.

//    Nothing in this module touches the database except to reserve numbers.
//    ========================================================================== */

// /* uomTypeOf and batchTypeOf live in ./barcodeUnits.js - pure, so the label
//    printing rule reads a unit exactly the way this engine does, in the browser
//    as well as here - and are re-exported, unchanged, so every existing import
//    of them from this module keeps working. */
// export { uomTypeOf, batchTypeOf };

// /* --------------------------------------------------------------- the plan --

//    Returns one entry per barcode to be created. The caller then attaches
//    numbers (reserveBarcodeNumbers below) and the commercial fields.

//    `cuts` only applies to MTR + unique: it is the metres on each individual
//    cut. When it is absent or does not add up, the total is divided evenly,
//    with the rounding remainder put on the last cut so the plan always sums to
//    exactly the received quantity.

//    Throws on input that cannot produce a sane plan, rather than silently
//    generating the wrong number of labels - a wrong label count is a physical
//    stock error, not a display bug. */
// export function planBarcodes({ uom, batchType, qty, cuts = [] } = {}) {
//   const type = uomTypeOf(uom);
//   const mode = batchTypeOf(batchType);
//   const quantity = Number(qty);

//   if (!Number.isFinite(quantity) || quantity <= 0) {
//     throw new BarcodePlanError('Quantity must be a positive number.');
//   }

//   /* ---- batch: one barcode, whole quantity, whatever the UOM ------------ */
//   if (mode === 'batch') {
//     return [{
//       index: 1,
//       qty: round3(quantity),
//       uomType: type,
//       batchType: 'batch',
//       /* every batch row of one generation shares a group id, so the label and
//          the reports can tell that the five metres are one physical piece */
//       groupId: 'batch',
//       groupSize: 1,
//     }];
//   }

//   /* ---- unique + PC: one barcode per piece ------------------------------ */
//   if (type === 'PC') {
//     if (!Number.isInteger(quantity)) {
//       throw new BarcodePlanError(
//         'A unique piece quantity must be a whole number - ' + quantity + ' cannot be split into individual pieces.'
//       );
//     }
//     if (quantity > MAX_UNITS) throw new BarcodePlanError(tooMany(quantity));

//     return Array.from({ length: quantity }, (_, i) => ({
//       index: i + 1,
//       qty: 1,
//       uomType: 'PC',
//       batchType: 'unique',
//       groupId: 'pc-' + (i + 1),
//       groupSize: 1,
//     }));
//   }

//   /* ---- unique + MTR: one barcode per cut ------------------------------- */
//   const given = (Array.isArray(cuts) ? cuts : [])
//     .map((c) => Number(typeof c === 'object' ? c?.value : c))
//     .filter((n) => Number.isFinite(n) && n > 0);

//   /* With explicit cut lengths, the number of barcodes is the number of cuts.
//      Without them, `qty` is read as the number of cuts of one metre each,
//      which is what the generation screen sends when the operator only enters a
//      count. */
//   const count = given.length || Math.round(quantity);
//   if (count < 1) throw new BarcodePlanError('Enter at least one cut.');
//   if (count > MAX_UNITS) throw new BarcodePlanError(tooMany(count));

//   const values = given.length ? given : splitEvenly(quantity, count);

//   return values.map((value, i) => ({
//     index: i + 1,
//     qty: round3(value),
//     uomType: 'MTR',
//     batchType: 'unique',
//     groupId: 'mtr-' + (i + 1),
//     groupSize: 1,
//   }));
// }

// /* How many labels a given input will produce, without building the plan.
//    Used by the UI to show the operator the count before they commit. */
// export function barcodeCount(input) {
//   try {
//     return planBarcodes(input).length;
//   } catch {
//     return 0;
//   }
// }

// /* The total quantity a plan accounts for. Always equals the received
//    quantity - asserted by the caller so a rounding slip cannot put the wrong
//    amount of stock into the system. */
// export function planQty(plan) {
//   return round3((plan || []).reduce((sum, p) => sum + Number(p.qty || 0), 0));
// }

// /* ------------------------------------------------------------- numbering --

//    Barcode numbers come from the Barcode Setting master (prefix, running
//    number width, suffix) and an atomic counter, never from a value the
//    browser sends. Two operators generating simultaneously get disjoint
//    blocks.

//    Returns an array of `count` formatted numbers. */
// export async function reserveBarcodeNumbers(count, { businessId, locationId, finYear, setting } = {}, session = null) {
//   const n = Math.max(0, Number(count) || 0);
//   if (!n) return [];

//   const format = setting || await loadFormat(businessId, finYear);

//   /* Keyed on the business and the format in force - NOT on the location.
//      A barcode is scanned wherever the goods end up, so its number has to be
//      unique across the whole business; a per-location counter would issue the
//      same number at two branches and make a scan ambiguous the moment stock
//      was transferred. Including the format means rolling into a new period
//      (a new prefix) starts that prefix's own series rather than continuing the
//      previous month's numbers. */
//   const name = 'barcode:' + (format.prefix || '-') + ':' + (format.suffix || '-');
//   const scope = { businessId };

//   await applyFloors(name, scope, format, session);

//   const first = await reserveSequence(name, scope, n, session);

//   return Array.from({ length: n }, (_, i) => formatBarcode(format, first + i));
// }

// /* Where the series is not allowed to start below.

//    TWO floors, both applied through ensureFloor's $max, so they can only ever
//    move the series FORWARD and applying them twice changes nothing:

//      1. START NUMBER from the Barcode Setting master. This was simply never
//         read - loadFormat returned prefix/suffix/width and dropped it - so
//         reserveSequence upserted a counter at 0 and issued 1. A master
//         configured "Prefix 9A, Start Number 1000" previewed 9A1000 on the
//         settings screen (lib/barcodeFormat.js DOES use startNumber) and then
//         generated 9A0001, which is the whole bug.

//         It is re-applied on every reservation rather than only when the
//         counter is created, because a series whose counter already exists -
//         9A was sitting at 28 - would otherwise keep ignoring the number the
//         operator configured. Raising Start Number therefore takes effect;
//         lowering it deliberately does not, since $max never walks a counter
//         back onto numbers already issued.

//      2. THE HIGHEST NUMBER ALREADY PRINTED under this prefix, read once when
//         the counter does not exist yet. Without it a Start Number set BELOW
//         what has already been issued would reissue live labels - a duplicate
//         on physical goods, which no later correction can undo. The scan is
//         one-time: once the counter exists it is itself the record, and a
//         full-collection scan on every save would not be defensible. */
// async function applyFloors(name, scope, format, session) {
//   const start = Math.max(0, (Number(format.start) || 1) - 1);

//   const existing = await Counter.findOne({ key: counterKey(name, scope) }).select('_id').lean();

//   let issued = 0;
//   if (!existing && format.prefix) {
//     const rows = await BarcodeLabel.find({
//       barcodeNo: { $regex: '^' + escapeRegex(format.prefix) },
//       ...(scope.businessId ? { businessId: String(scope.businessId) } : {}),
//     }).select('barcodeNo').lean();

//     issued = rows.reduce((max, r) => {
//       /* strip the prefix, then take the leading digits - a suffix after the
//          number must not turn the parse into NaN */
//       const tail = String(r.barcodeNo ?? '').slice(format.prefix.length);
//       const num = parseInt(tail.match(/^\d+/)?.[0] ?? '', 10);
//       return Number.isNaN(num) ? max : Math.max(max, num);
//     }, 0);
//   }

//   await ensureFloor(name, scope, Math.max(start, issued), session);
// }

// function escapeRegex(s) {
//   return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// }

// /* prefix + zero-padded serial + suffix, matching lib/barcodeFormat.js so the
//    preview on the settings screen and the issued number agree. */
// export function formatBarcode({ prefix = '', suffix = '', width = 4 } = {}, serial = 1) {
//   const pad = Math.max(1, Number(width) || 4);
//   return String(prefix || '') + String(serial).padStart(pad, '0') + String(suffix || '');
// }

// /* Reads the Barcode Setting period that is in force for a business today.

//    The master holds one row per period (monthly gives 12 rows for a financial
//    year), each with its own prefix and effective/expiry dates, so "the format"
//    is whichever period covers the generation date - the same test the Barcode
//    Generation screen applies before it previews a sample.

//    Falls back to a bare 4-digit series so a fresh install can still generate
//    rather than refusing to receive stock. */
// export async function loadFormat(businessId, finYear = '', when = new Date()) {
//   const fallback = { prefix: '', suffix: '', width: 4, start: 1 };
//   try {
//     const rows = await BarcodeSetting.find({
//       ...(businessId ? { businessId } : {}),
//       ...(finYear ? { finYear } : {}),
//     }).sort({ periodIndex: 1, createdAt: -1 }).lean();

//     if (!rows.length) return fallback;

//     const at = when instanceof Date ? when : new Date(when);
//     const inForce = rows.find((r) => {
//       const from = r.effectiveDate ? new Date(r.effectiveDate) : null;
//       const to = r.expiryDate ? new Date(r.expiryDate) : null;
//       if (from && Number.isFinite(from.getTime()) && at < from) return false;
//       if (to && Number.isFinite(to.getTime()) && at > to) return false;
//       return true;
//     });

//     /* No period covers today - the master is incomplete rather than absent,
//        so use the most recent row instead of silently dropping the prefix. */
//     const row = inForce || rows[rows.length - 1];

//     return {
//       prefix: String(row.prefix ?? ''),
//       suffix: String(row.suffix ?? ''),
//       /* the master spells it "numberLenght" - kept, not corrected, so the
//          stored documents and this reader agree */
//       width: Number(row.numberLenght ?? row.numberLength ?? 4) || 4,
//       /* the number the FIRST barcode of this period carries. Was missing
//          here, which is why the generator ignored it - see applyFloors. */
//       start: Number(row.startNumber) || 1,
//       settingId: String(row._id),
//     };
//   } catch {
//     return fallback;
//   }
// }

// /* ------------------------------------------------------------- internals -- */

// const MAX_UNITS = 5000;

// class BarcodePlanError extends Error {
//   constructor(message) {
//     super(message);
//     this.name = 'BarcodePlanError';
//     this.code = 'BARCODE_PLAN';
//     /* 422, so lib/apiError.js reports the operator's own mistake with the
//        explanation - "a unique piece quantity must be a whole number" - rather
//        than falling through to the generic 500 that says nothing useful. */
//     this.status = 422;
//   }
// }
// export { BarcodePlanError };

// const tooMany = (n) =>
//   'That would generate ' + n + ' barcodes in one go (the limit is ' + MAX_UNITS +
//   '). Split the quantity across several lines, or use a batch barcode.';

// /* Divides a total into `count` parts that sum back to exactly the total.
//    The remainder lands on the last part rather than being lost to rounding. */
// function splitEvenly(total, count) {
//   const each = round3(total / count);
//   const parts = Array.from({ length: count }, () => each);
//   const drift = round3(total - each * count);
//   if (drift) parts[count - 1] = round3(parts[count - 1] + drift);
//   return parts;
// }

// /* Metres are commonly quoted to 2 or 3 decimals; 3 keeps a 1/3-metre cut
//    honest without carrying float noise into the database. */
// function round3(v) {
//   return Math.round((Number(v) || 0) * 1000) / 1000;
// }

























import Counter, { reserveSequence, ensureFloor, counterKey } from '@/models/Counter';
import BarcodeSetting from '@/models/BarcodeSetting';
import { BarcodeLabel } from '@/lib/barcodeLabel';
import { uomTypeOf, batchTypeOf } from '@/lib/barcodeUnits';

/* ==========================================================================
   THE BARCODE ENGINE - the single definition of how many barcodes a received
   quantity produces, and what each one stands for.

   The rule the client specified, in full:

     UOM   TYPE     QTY   BARCODES   EACH BARCODE REPRESENTS
     ---   ------   ---   --------   -----------------------
     PC    batch      1          1   the whole batch (1 pc)
     PC    batch      5          1   the whole batch (5 pc)
     PC    unique     5          5   1 pc
     MTR   batch      5          1   the whole batch (5 mtr)
     MTR   unique     5          5   1 cut each (metres per cut)

   Read as one rule rather than four cases:

     batch  -> ONE barcode carrying the entire quantity
     unique -> ONE barcode per unit; UOM decides what a "unit" is
               (PC: one piece. MTR: one cut, carrying that cut's metres.)

   This was previously implemented inside the Barcode Generation screen only
   (components/GCRBarcodeGeneration.jsx buildBarcodePlan), in the browser,
   with a client-held running sequence. That meant POS, stock transfer,
   receiving, returns and the reports each had to re-derive what a barcode
   meant from free text, and two operators generating at once could issue the
   same number. Both problems are fixed by moving the rule here and the
   numbering onto an atomic counter.

   Nothing in this module touches the database except to reserve numbers.
   ========================================================================== */

/* uomTypeOf and batchTypeOf live in ./barcodeUnits.js - pure, so the label
   printing rule reads a unit exactly the way this engine does, in the browser
   as well as here - and are re-exported, unchanged, so every existing import
   of them from this module keeps working. */
export { uomTypeOf, batchTypeOf };

/* --------------------------------------------------------------- the plan --

   Returns one entry per barcode to be created. The caller then attaches
   numbers (reserveBarcodeNumbers below) and the commercial fields.

   `cuts` only applies to MTR + unique: it is the metres on each individual
   cut. When it is absent or does not add up, the total is divided evenly,
   with the rounding remainder put on the last cut so the plan always sums to
   exactly the received quantity.

   Throws on input that cannot produce a sane plan, rather than silently
   generating the wrong number of labels - a wrong label count is a physical
   stock error, not a display bug. */
export function planBarcodes({ uom, batchType, qty, cuts = [] } = {}) {
  const type = uomTypeOf(uom);
  const mode = batchTypeOf(batchType);
  const quantity = Number(qty);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new BarcodePlanError('Quantity must be a positive number.');
  }

  /* ---- batch: one barcode, whole quantity, whatever the UOM ------------ */
  if (mode === 'batch') {
    return [{
      index: 1,
      qty: round3(quantity),
      uomType: type,
      batchType: 'batch',
      /* every batch row of one generation shares a group id, so the label and
         the reports can tell that the five metres are one physical piece */
      groupId: 'batch',
      groupSize: 1,
    }];
  }

  /* ---- unique + PC: one barcode per piece ------------------------------ */
  if (type === 'PC') {
    if (!Number.isInteger(quantity)) {
      throw new BarcodePlanError(
        'A unique piece quantity must be a whole number - ' + quantity + ' cannot be split into individual pieces.'
      );
    }
    if (quantity > MAX_UNITS) throw new BarcodePlanError(tooMany(quantity));

    return Array.from({ length: quantity }, (_, i) => ({
      index: i + 1,
      qty: 1,
      uomType: 'PC',
      batchType: 'unique',
      groupId: 'pc-' + (i + 1),
      groupSize: 1,
    }));
  }

  /* ---- unique + MTR: one barcode per cut ------------------------------- */
  const given = (Array.isArray(cuts) ? cuts : [])
    .map((c) => Number(typeof c === 'object' ? c?.value : c))
    .filter((n) => Number.isFinite(n) && n > 0);

  /* With explicit cut lengths, the number of barcodes is the number of cuts.
     Without them, `qty` is read as the number of cuts of one metre each,
     which is what the generation screen sends when the operator only enters a
     count. */
  const count = given.length || Math.round(quantity);
  if (count < 1) throw new BarcodePlanError('Enter at least one cut.');
  if (count > MAX_UNITS) throw new BarcodePlanError(tooMany(count));

  const values = given.length ? given : splitEvenly(quantity, count);

  return values.map((value, i) => ({
    index: i + 1,
    qty: round3(value),
    uomType: 'MTR',
    batchType: 'unique',
    groupId: 'mtr-' + (i + 1),
    groupSize: 1,
  }));
}

/* How many labels a given input will produce, without building the plan.
   Used by the UI to show the operator the count before they commit. */
export function barcodeCount(input) {
  try {
    return planBarcodes(input).length;
  } catch {
    return 0;
  }
}

/* The total quantity a plan accounts for. Always equals the received
   quantity - asserted by the caller so a rounding slip cannot put the wrong
   amount of stock into the system. */
export function planQty(plan) {
  return round3((plan || []).reduce((sum, p) => sum + Number(p.qty || 0), 0));
}

/* ------------------------------------------------------------- numbering --

   Barcode numbers come from the Barcode Setting master (prefix, running
   number width, suffix) and an atomic counter, never from a value the
   browser sends. Two operators generating simultaneously get disjoint
   blocks.

   Returns an array of `count` formatted numbers. */
export async function reserveBarcodeNumbers(count, { businessId, locationId, finYear, setting } = {}, session = null) {
  const n = Math.max(0, Number(count) || 0);
  if (!n) return [];

  const format = setting || await loadFormat(businessId, finYear);

  /* Keyed on the business and the format in force - NOT on the location.
     A barcode is scanned wherever the goods end up, so its number has to be
     unique across the whole business; a per-location counter would issue the
     same number at two branches and make a scan ambiguous the moment stock
     was transferred. Including the format means rolling into a new period
     (a new prefix) starts that prefix's own series rather than continuing the
     previous month's numbers. */
  const name = 'barcode:' + (format.prefix || '-') + ':' + (format.suffix || '-');
  const scope = { businessId };

  await applyFloors(name, scope, format, session);

  const first = await reserveSequence(name, scope, n, session);

  return Array.from({ length: n }, (_, i) => formatBarcode(format, first + i));
}

/* Where the series is not allowed to start below.

   TWO floors, both applied through ensureFloor's $max, so they can only ever
   move the series FORWARD and applying them twice changes nothing:

     1. START NUMBER from the Barcode Setting master. This was simply never
        read - loadFormat returned prefix/suffix/width and dropped it - so
        reserveSequence upserted a counter at 0 and issued 1. A master
        configured "Prefix 9A, Start Number 1000" previewed 9A1000 on the
        settings screen (lib/barcodeFormat.js DOES use startNumber) and then
        generated 9A0001, which is the whole bug.

        It is re-applied on every reservation rather than only when the
        counter is created, because a series whose counter already exists -
        9A was sitting at 28 - would otherwise keep ignoring the number the
        operator configured. Raising Start Number therefore takes effect;
        lowering it deliberately does not, since $max never walks a counter
        back onto numbers already issued.

     2. THE HIGHEST NUMBER ALREADY PRINTED under this prefix, read once when
        the counter does not exist yet. Without it a Start Number set BELOW
        what has already been issued would reissue live labels - a duplicate
        on physical goods, which no later correction can undo. The scan is
        one-time: once the counter exists it is itself the record, and a
        full-collection scan on every save would not be defensible. */
async function applyFloors(name, scope, format, session) {
  const start = Math.max(0, (Number(format.start) || 1) - 1);

  const existing = await Counter.findOne({ key: counterKey(name, scope) }).select('_id').lean();

  let issued = 0;
  if (!existing && format.prefix) {
    const rows = await BarcodeLabel.find({
      barcodeNo: { $regex: '^' + escapeRegex(format.prefix) },
      ...(scope.businessId ? { businessId: String(scope.businessId) } : {}),
    }).select('barcodeNo').lean();

    issued = rows.reduce((max, r) => {
      /* strip the prefix, then take the leading digits - a suffix after the
         number must not turn the parse into NaN */
      const tail = String(r.barcodeNo ?? '').slice(format.prefix.length);
      const num = parseInt(tail.match(/^\d+/)?.[0] ?? '', 10);
      return Number.isNaN(num) ? max : Math.max(max, num);
    }, 0);
  }

  await ensureFloor(name, scope, Math.max(start, issued), session);
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* A number of a Barcode Setting series that came in WITHOUT reserveBarcode
   Numbers - a barcode seeded by Barcode Report -> Import from the other
   ERP's report (lib/barcodeReportImportService.js) - lifts that series'
   counter past it, so Barcode Generation can never issue it again to other
   goods. lib/docnumber.js raiseSeriesFloor does the same for a document
   number typed by hand.

   The counter reserveBarcodeNumbers uses - the same name, the same scope -
   and only through ensureFloor's $max, so it only ever moves FORWARD: a
   number below the counter changes nothing, and nothing about how
   Generation numbers is changed. A series whose counter does not exist yet
   first gets applyFloors' one-time floor (the highest number already
   printed), exactly as its first generation would. `formats` - the
   business's Barcode Setting rows [{ prefix, suffix }]. Returns
   { series, floor } for the series lifted, or null. */
export async function raiseBarcodeFloor(barcodeNo, formats, businessId, session = null) {
  const value = String(barcodeNo ?? '').trim();
  for (const f of formats || []) {
    const prefix = String(f.prefix || '');
    const suffix = String(f.suffix || '');
    if (!value.startsWith(prefix) || !value.endsWith(suffix) || value.length <= prefix.length + suffix.length) continue;
    const digits = value.slice(prefix.length, value.length - suffix.length);
    if (!/^\d+$/.test(digits)) continue;
    const name = 'barcode:' + (prefix || '-') + ':' + (suffix || '-');
    const scope = { businessId };
    await applyFloors(name, scope, { prefix, suffix, start: 1 }, session);
    await ensureFloor(name, scope, Number(digits), session);
    return { series: prefix + '…' + suffix, floor: Number(digits) };
  }
  return null;
}

/* prefix + zero-padded serial + suffix, matching lib/barcodeFormat.js so the
   preview on the settings screen and the issued number agree. */
export function formatBarcode({ prefix = '', suffix = '', width = 4 } = {}, serial = 1) {
  const pad = Math.max(1, Number(width) || 4);
  return String(prefix || '') + String(serial).padStart(pad, '0') + String(suffix || '');
}

/* Reads the Barcode Setting period that is in force for a business today.

   The master holds one row per period (monthly gives 12 rows for a financial
   year), each with its own prefix and effective/expiry dates, so "the format"
   is whichever period covers the generation date - the same test the Barcode
   Generation screen applies before it previews a sample.

   Falls back to a bare 4-digit series so a fresh install can still generate
   rather than refusing to receive stock. */
export async function loadFormat(businessId, finYear = '', when = new Date()) {
  const fallback = { prefix: '', suffix: '', width: 4, start: 1 };
  try {
    const rows = await BarcodeSetting.find({
      ...(businessId ? { businessId } : {}),
      ...(finYear ? { finYear } : {}),
    }).sort({ periodIndex: 1, createdAt: -1 }).lean();

    if (!rows.length) return fallback;

    const at = when instanceof Date ? when : new Date(when);
    const inForce = rows.find((r) => {
      const from = r.effectiveDate ? new Date(r.effectiveDate) : null;
      const to = r.expiryDate ? new Date(r.expiryDate) : null;
      if (from && Number.isFinite(from.getTime()) && at < from) return false;
      if (to && Number.isFinite(to.getTime()) && at > to) return false;
      return true;
    });

    /* No period covers today - the master is incomplete rather than absent,
       so use the most recent row instead of silently dropping the prefix. */
    const row = inForce || rows[rows.length - 1];

    return {
      prefix: String(row.prefix ?? ''),
      suffix: String(row.suffix ?? ''),
      /* the master spells it "numberLenght" - kept, not corrected, so the
         stored documents and this reader agree */
      width: Number(row.numberLenght ?? row.numberLength ?? 4) || 4,
      /* the number the FIRST barcode of this period carries. Was missing
         here, which is why the generator ignored it - see applyFloors. */
      start: Number(row.startNumber) || 1,
      settingId: String(row._id),
    };
  } catch {
    return fallback;
  }
}

/* ------------------------------------------------------------- internals -- */

const MAX_UNITS = 5000;

class BarcodePlanError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BarcodePlanError';
    this.code = 'BARCODE_PLAN';
    /* 422, so lib/apiError.js reports the operator's own mistake with the
       explanation - "a unique piece quantity must be a whole number" - rather
       than falling through to the generic 500 that says nothing useful. */
    this.status = 422;
  }
}
export { BarcodePlanError };

const tooMany = (n) =>
  'That would generate ' + n + ' barcodes in one go (the limit is ' + MAX_UNITS +
  '). Split the quantity across several lines, or use a batch barcode.';

/* Divides a total into `count` parts that sum back to exactly the total.
   The remainder lands on the last part rather than being lost to rounding. */
function splitEvenly(total, count) {
  const each = round3(total / count);
  const parts = Array.from({ length: count }, () => each);
  const drift = round3(total - each * count);
  if (drift) parts[count - 1] = round3(parts[count - 1] + drift);
  return parts;
}

/* Metres are commonly quoted to 2 or 3 decimals; 3 keeps a 1/3-metre cut
   honest without carrying float noise into the database. */
function round3(v) {
  return Math.round((Number(v) || 0) * 1000) / 1000;
}



