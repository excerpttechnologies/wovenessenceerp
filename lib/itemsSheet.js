/* The ITEMS tab of GRC Barcode Generation as a spreadsheet: what each column
   shows, what typing or pasting into it means, and what it refuses.

   Pure and client-safe. components/ItemsSheet.jsx renders the grid from these
   definitions, and the Submit check in GCRBarcodeGeneration runs the very
   same parsers over the rows, so a value the grid accepts is a value the save
   accepts and nothing is judged by two different rules.

   Every edit writes the grid's own field names AND the stored names the save
   route reads first - purRate / finalNet / encodedPurRate - the same pairing
   the Excel import makes in mergeImportedRow. A row loaded from the database
   carries both, so without it an edited rate on a saved row would be quietly
   replaced by its old stored value on Submit. */

import { purchasePriceError, normalisePurchasePrice } from '@/lib/purchasePrice';
import { encodeRate } from '@/lib/purchaseRateCode';
import { uomTypeOf, saveBatchTypeOf } from '@/lib/barcodeUnits';

/* The highest GST rate in force - the 40% slab. */
export const GST_MAX = 40;

/* THE ITEM FIELDS, in order, under the names the business uses: the ITEMS
   grid's columns and Export Excel's headings both come from this one list,
   keyed by the grid row's own field names (toGridRow in lib/barcodeRowSync.js),
   so the sheet and the workbook cannot disagree about a column or its value.
   The grid leaves out one of them - Attribute Add On - see sheetColumns. */
export const ITEM_FIELD_LABELS = {
  itemCode: 'Item Code',
  itemName: 'Item Name',
  goodsType: 'Attribute Add On',
  sm: 'SM',
  p_m_f: 'P-M-F',
  hsn: 'HSN',
  gst: 'GST',
  uom: 'UOM',
  qty: 'Quantity',
  noOfCuts: 'No. of Cuts',
  totalMtr: 'Total MTR',
  billSlNo: 'Bill Sl No.',
  purchaseRate: 'Purchase Rate',
  discountType: 'Discount Type',
  discount: 'Discount',
  finalPrice: 'Final Price',
  retailPrice: 'Retail Price',
  disc1: 'Disc 1',
  uniqueBarcode: 'Unique Barcode',
  barcodeNo: 'Barcode No',
  supplierDescription: 'Supplier Description',
  printDescription: 'Print Description',
  rsp: 'RSP',
  wsp: 'WSP',
  dp: 'E-COMM',
  offerPrice: 'Offer Price',
  wspPrice: 'WSP Offer Price',
  dpPrice: 'E-COMM Offer Price',
  rspOfferPct: 'RSP Offer %',
  wspOfferPct: 'WSP Offer %',
  dpOfferPct: 'E-COMM Offer %',
  markupRSP: 'Markup RSP %',
  markupWSP: 'Markup WSP %',
  markupDP: 'Markup E-COMM %',
};

/* What a new row takes from the row above it. The ITEMS sheet has no column
   for how a unit is counted (UOM, unique or batch), its attribute or its
   discount, and a GRC's lines usually share them, so they follow the row
   above rather than falling back to defaults nobody chose. The item, the
   quantity, the rates and the barcode always start empty. */
export const SHEET_INHERITED_FIELDS = [
  'uom', 'uniqueBarcode', 'mode', 'batchUnique', 'goodsType', 'sm', 'p_m_f',
  'discountType', 'discount', 'markupRSP', 'markupWSP', 'markupDP',
];

const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

/* Rupees as every table on the screen shows them: 1,980.00. */
export const money = (value) => {
  const n = Number(value || 0);
  return Number.isFinite(n)
    ? n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00';
};

/* "1980" and "1980.00" are the same price - comparing them as text would
   count a reformatted cell as an edit. */
export function sameValue(a, b) {
  const x = String(a ?? '').trim();
  const y = String(b ?? '').trim();
  if (x === y) return true;
  return x !== '' && y !== '' && Number.isFinite(Number(x)) && Number.isFinite(Number(y)) && Number(x) === Number(y);
}

/* The purchase rate less its discount - the Final Price rule the Add Item
   form applies through calculatePrices, and the Excel import re-derives a
   changed rate by. One definition, so the grid cannot drift from either. */
export function finalRateOf(row) {
  const purchaseRate = Number(row.purchaseRate || 0);
  const discount = Number(row.discount || row.disc1 || 0);
  const discountType = row.discountType || 'Percentage';
  return discountType === 'Flat'
    ? Math.max(0, purchaseRate - discount)
    : Math.max(0, purchaseRate - (purchaseRate * discount) / 100);
}

/* GST on one row - the same expression the totals bar adds up. */
export function gstAmountOf(row) {
  return (Number(row?.finalPrice || 0) * Number(row?.qty || 0)) * (Number(row?.gst || 0) / 100);
}

/* A row the save will store as a UNIQUE PIECE barcode - one barcode per
   piece, so its quantity has to be whole. Read the way the save route reads
   it (lib/barcodeUnits.js), so the grid refuses exactly what would be stored
   wrong. */
export function isUniquePiece(row) {
  return uomTypeOf(row?.uom) === 'PC' && saveBatchTypeOf(row) === 'unique';
}

const STATUS_WORDS = {
  SOLD: 'Sold',
  IN_TRANSIT: 'In transit',
  RETURN_IN_TRANSIT: 'Being returned',
  VOID: 'Written off',
};

/* Why a saved unit cannot be changed from this screen, or '' when it can.
   One that has left the shelf it was received onto - sold, in transit,
   returned, written off, or received at another branch - is refused by the
   save route (hasMoved in app/api/barcode-generation/route.js), so the grid
   does not offer to edit or delete it. */
export function lockReason(row) {
  if (!row?._id) return '';
  if (row.status && row.status !== 'IN_STOCK') {
    return `${STATUS_WORDS[row.status] || row.status} - a unit that has left stock cannot be changed here`;
  }
  const at = String(row.currentLocationId || '');
  const from = String(row.locationId || '');
  if (at && from && at !== from) return 'Received at another location - it cannot be changed here';
  return '';
}

export const isLockedRow = (row) => lockReason(row) !== '';

/* Rows the Submit check judges: new ones, and saved ones the operator edited
   or imported over. A saved row nobody touched is sent back unchanged and the
   save leaves it alone, so an old value it happens to carry never blocks
   today's Submit. */
export const needsCheck = (row) => !row?._id || Boolean(row?._edited || row?._importStatus);

const DATA_KEYS = ['itemCode', 'itemName', 'hsn', 'gst', 'qty', 'noOfCuts', 'purchaseRate', 'finalPrice'];

/* An empty row the sheet holds for typing into. It is not saved and not
   judged - the way Excel ignores the empty rows under a table. */
export function isBlankRow(row) {
  if (!row || row._id || String(row.barcodeNo ?? '').trim()) return false;
  if (DATA_KEYS.some((key) => String(row[key] ?? '').trim() !== '')) return false;
  return !Object.values(row.customFields || {}).some((value) => String(value ?? '').trim() !== '');
}

/* ------------------------------------------------------------- parsing -- */

/* Money, quantity and percentage text as it is typed or pasted: "1,980",
   "₹74.00", "5%". */
const cleanNumber = (text) => String(text ?? '').trim().replace(/[,\s₹%]/g, '');
const isNumeric = (text) => text !== '' && Number.isFinite(Number(text));
const decimalsOf = (text) => (String(text).split('.')[1] || '').length;
/* the sheet shows an empty cell as "-", so a "-" typed or pasted is empty */
const dash = (text) => {
  const value = String(text ?? '').trim();
  return value === '-' ? '' : value;
};
const oneLine = (text) => String(text ?? '').replace(/[\t\r\n]+/g, ' ');

/* A parser takes the text for one cell and the row it lands on, and returns
   { patch } - the fields to write - or { error } - why the text is refused.
   A refused value is never written, not even partly. */

function textColumn(key, label, max) {
  return (text) => {
    const value = dash(oneLine(text));
    if (value.length > max) return { error: `${label} can be at most ${max} characters` };
    return { patch: { [key]: value } };
  };
}

function parseHsn(text) {
  const value = dash(text);
  if (value === '') return { patch: { hsn: '' } };
  const digits = value.replace(/[\s.]/g, '');
  if (!/^\d+$/.test(digits) || digits.length < 2 || digits.length > 8) {
    return { error: 'HSN must be 2 to 8 digits' };
  }
  return { patch: { hsn: digits } };
}

function parseGst(text) {
  const value = cleanNumber(dash(text));
  if (value === '') return { patch: { gst: '' } };
  if (!isNumeric(value)) return { error: 'GST must be a number' };
  const n = Number(value);
  if (n < 0 || n > GST_MAX) return { error: `GST must be between 0 and ${GST_MAX}` };
  if (decimalsOf(value) > 2) return { error: 'GST can have at most 2 decimals' };
  return { patch: { gst: String(n) } };
}

function parseQty(text, row) {
  const value = cleanNumber(dash(text));
  if (value === '') return { error: 'Quantity is required' };
  if (!isNumeric(value)) return { error: 'Quantity must be a number' };
  const n = Number(value);
  if (n <= 0) return { error: 'Quantity must be greater than 0' };
  if (decimalsOf(value) > 3) return { error: 'Quantity can have at most 3 decimals' };
  if (isUniquePiece(row) && !Number.isInteger(n)) return { error: 'A unique piece quantity must be a whole number' };
  return { patch: { qty: String(n) } };
}

function parseCuts(text) {
  const value = dash(text).replace(/\s/g, '');
  if (value === '') return { patch: { noOfCuts: '' } };
  if (!/^\d+$/.test(value)) return { error: 'No. of Cuts must be a whole number, or - for none' };
  return { patch: { noOfCuts: String(Number(value)) } };
}

/* "74.00 / 70.30" - the Purchase Rate, then the Final Rate after discount.

   A single number is a new Purchase Rate. The Final Rate then follows it by
   the Add Item rule when the row's discount is known, and is otherwise kept -
   exactly how the Excel import re-derives a changed rate. The encoded rate
   printed on the label is re-encoded only when the Purchase Rate changes. */
function parseRate(text, row, ctx = {}) {
  const parts = String(text ?? '').split('/').map((part) => cleanNumber(part));
  if (parts.length > 2) return { error: 'Rate is Purchase Rate / Final Rate, e.g. 74.00 / 70.30' };

  const problem = purchasePriceError(dash(parts[0]));
  if (problem) return { error: problem };
  const purchaseRate = String(Number(normalisePurchasePrice(parts[0])));

  let finalPrice;
  if (parts.length === 2 && parts[1] !== '') {
    if (!isNumeric(parts[1]) || Number(parts[1]) < 0) return { error: 'Final rate must be a number, 0 or more' };
    finalPrice = String(round2(Number(parts[1])));
  } else {
    const before = String(row?.finalPrice ?? '').trim();
    const discountKnown = before === '' || sameValue(before, round2(finalRateOf(row || {})));
    finalPrice = discountKnown ? String(round2(finalRateOf({ ...(row || {}), purchaseRate }))) : before;
  }

  const encoded = sameValue(purchaseRate, row?.purchaseRate)
    ? String(row?.encodedPurchaseRate ?? '')
    : encodeRate(purchaseRate, ctx.rateCodeMapping);

  return {
    patch: {
      purchaseRate, purRate: purchaseRate,
      finalPrice, finalNet: finalPrice,
      encodedPurchaseRate: encoded, encodedPurRate: encoded,
    },
  };
}

/* Both rates - only for the Submit check (rowErrors), so a row whose stored
   Final Rate is not a number is still refused. The cell and its editor show
   the Purchase Rate alone: a number typed there is a new Purchase Rate, and
   parseRate works the Final Rate out from it as described above. */
function rateText(row) {
  const purchase = String(row?.purchaseRate ?? '').trim();
  const final = String(row?.finalPrice ?? '').trim();
  return purchase || final ? `${purchase} / ${final}` : '';
}

function customColumn(name) {
  return (text, row) => {
    const value = dash(oneLine(text));
    if (value.length > 200) return { error: `${name} can be at most 200 characters` };
    return { patch: { customFields: { ...(row?.customFields || {}), [name]: value } } };
  };
}

/* ------------------------------------------------------------- columns -- */

const shown = (key) => (row) => String(row?.[key] ?? '').trim() || '-';
const raw = (key) => (row) => String(row?.[key] ?? '');
/* an amount as the grid shows money (1,895.00), "-" when the row has none;
   a value that is not a number is shown as it stands rather than as 0.00 */
const shownMoney = (key) => (row) => {
  const value = String(row?.[key] ?? '').trim();
  if (value === '') return '-';
  const n = cleanNumber(value);
  return isNumeric(n) ? money(n) : value;
};

/* A field the grid SHOWS but does not edit: its value is worked out on Add
   Item (prices, markups, offers) or belongs to the barcode itself (number,
   Bill Sl No., unique/batch), and changing it here would bypass the rules
   that set it. It still takes part in selection and copy. */
const REFERENCE = 'shown for reference - set on Add Item, or change it through Import Excel';
/* ...except these, which the barcode record has no field for: what Add Item
   entered is gone once the row is saved, so the note must not promise that
   Import Excel changes it. RSP / WSP / E-COMM then fall back to the stored
   Retail Price and offer prices (toGridRow). */
const NOT_SAVED = 'shown for reference - entered on Add Item but not saved with the barcode, so it is blank once the row is saved';
const NOT_SAVED_PRICE = 'shown for reference - not saved with the barcode: once the row is saved this shows its stored Retail Price (RSP) or offer price (WSP, E-COMM)';
const NOTES = {
  ...Object.fromEntries(['discountType', 'discount', 'disc1', 'totalMtr', 'rspOfferPct', 'wspOfferPct', 'dpOfferPct',
    'markupRSP', 'markupWSP', 'markupDP'].map((key) => [key, NOT_SAVED])),
  rsp: NOT_SAVED_PRICE, wsp: NOT_SAVED_PRICE, dp: NOT_SAVED_PRICE,
};
const view = (key, width, display = shown(key)) => ({
  key, label: ITEM_FIELD_LABELS[key], readOnly: true, note: NOTES[key] || REFERENCE, width, display,
});

/* The ITEMS columns, in order, then one per custom field.

     display(row, index)  what the cell shows, and what Copy puts on the
                          clipboard - "-" for empty, as the table always did
     text(row)            what the editor opens with
     checkText(row)       optional: what the Submit check parses instead
     parse(text, row)     see above; absent on read-only columns

   Sl No is the row's position and GST Amount is calculated, so neither can
   be typed into; both still take part in selection and copy. So does the
   Barcode Identifier, shown when the screen hands in identifierOf(row,
   index) - it is worked out from the GRC and the row, never typed. */
export function sheetColumns(customFields = [], { identifierOf = null } = {}) {
  const L = ITEM_FIELD_LABELS;
  return [
    { key: 'slNo', label: 'Sl No', readOnly: true, width: 64, display: (row, index) => String(index + 1) },

    /* ---- the 34 item fields, in ITEM_FIELD_LABELS order ---- */
    { key: 'itemCode', label: L.itemCode, width: 140, display: shown('itemCode'), text: raw('itemCode'), parse: textColumn('itemCode', 'Item Code', 60) },
    {
      key: 'itemName', label: L.itemName, width: 200,
      display: (row) => String(row?.itemName || row?.supplierDescription || '').trim() || '-',
      text: (row) => String(row?.itemName || row?.supplierDescription || ''),
      parse: textColumn('itemName', 'Item', 200),
    },
    /* Attribute Add On (goodsType) is not shown on the grid (user,
       2026-09-28). It stays on the row and in Export / Import Excel. */
    view('sm', 70),
    view('p_m_f', 70),
    { key: 'hsn', label: L.hsn, width: 90, display: shown('hsn'), text: raw('hsn'), parse: parseHsn },
    { key: 'gst', label: L.gst, width: 64, display: shown('gst'), text: raw('gst'), parse: parseGst },
    view('uom', 70),
    { key: 'qty', label: L.qty, width: 90, display: shown('qty'), text: raw('qty'), parse: parseQty },
    { key: 'noOfCuts', label: L.noOfCuts, width: 100, display: shown('noOfCuts'), text: raw('noOfCuts'), parse: parseCuts },
    view('totalMtr', 90),
    view('billSlNo', 90),
    /* The Purchase Rate - the column that was "Rate". A number typed here is
       a new Purchase Rate and the Final Rate follows it (parseRate); the
       Submit check still judges both (checkText). Key kept, so its editing,
       paste and validation are exactly what they were. */
    {
      key: 'rate', label: L.purchaseRate, width: 120,
      display: (row) => money(row?.purchaseRate || 0),
      text: raw('purchaseRate'), checkText: rateText, parse: parseRate,
    },
    view('discountType', 110),
    view('discount', 90),
    view('finalPrice', 110, shownMoney('finalPrice')),
    view('retailPrice', 110, shownMoney('retailPrice')),
    view('disc1', 80),
    view('uniqueBarcode', 110),
    view('barcodeNo', 110),
    view('supplierDescription', 200),
    view('printDescription', 200),
    view('rsp', 100, shownMoney('rsp')),
    view('wsp', 100, shownMoney('wsp')),
    view('dp', 100, shownMoney('dp')),
    view('offerPrice', 110, shownMoney('offerPrice')),
    view('wspPrice', 130, shownMoney('wspPrice')),
    view('dpPrice', 140, shownMoney('dpPrice')),
    view('rspOfferPct', 100),
    view('wspOfferPct', 100),
    view('dpOfferPct', 120),
    view('markupRSP', 110),
    view('markupWSP', 110),
    view('markupDP', 130),

    /* ---- worked out by this screen, after the item fields ---- */
    ...(identifierOf ? [{
      key: 'barcodeIdentifier', label: 'Barcode Identifier', readOnly: true, width: 170, variant: 'identifier',
      display: (row, index) => identifierOf(row, index) || '—',
    }] : []),
    { key: 'gstAmount', label: 'GST Amount', readOnly: true, width: 100, display: (row) => money(gstAmountOf(row)) },
    ...customFields.map((name) => ({
      key: `custom:${name}`, label: name, width: 130,
      display: (row) => String(row?.customFields?.[name] ?? '').trim() || '-',
      text: (row) => String(row?.customFields?.[name] ?? ''),
      parse: customColumn(name),
    })),
  ];
}

/* --------------------------------------------------------- validation -- */

/* Every problem with one row, as { [columnKey]: message }, or null. Each
   editable column's own parser is run over the value the row holds now, so
   the Submit check refuses exactly what typing it in would have refused. */
export function rowErrors(row, columns) {
  if (isBlankRow(row)) return null;
  const errors = {};
  if (!String(row.itemCode ?? '').trim() && !String(row.itemName ?? '').trim()) {
    errors.itemCode = 'Item Code or Item is required';
  }
  columns.forEach((col) => {
    if (col.readOnly || errors[col.key]) return;
    const result = col.parse((col.checkText || col.text)(row), row, {});
    if (result.error) errors[col.key] = result.error;
  });
  return Object.keys(errors).length ? errors : null;
}

/* Every cell the Submit check refuses, in grid order - [{ index, rowId,
   key, label, message }]. Locked rows are left out: they are never saved. */
export function sheetProblems(rows, columns) {
  const out = [];
  (rows || []).forEach((row, index) => {
    if (!needsCheck(row) || isLockedRow(row)) return;
    const errors = rowErrors(row, columns);
    if (!errors) return;
    columns.forEach((col) => {
      if (errors[col.key]) out.push({ index, rowId: row.id, key: col.key, label: col.label, message: errors[col.key] });
    });
  });
  return out;
}

/* ----------------------------------------------------------- clipboard -- */

/* Tab-separated text as Excel puts it on the clipboard: rows on line breaks,
   cells on tabs, and a cell that holds a tab, a line break or a quote wrapped
   in double quotes with "" for a quote. The line break Excel adds after the
   last row is not a row. */
export function parseTsv(text) {
  const src = String(text ?? '').replace(/\r\n?/g, '\n');
  const rows = [];
  let row = [];
  let cell = '';
  let atCellStart = true;
  let i = 0;

  while (i < src.length) {
    const ch = src[i];
    if (atCellStart && ch === '"') {
      let j = i + 1;
      let value = '';
      let closed = false;
      while (j < src.length) {
        if (src[j] === '"') {
          if (src[j + 1] === '"') { value += '"'; j += 2; continue; }
          closed = true;
          j += 1;
          break;
        }
        value += src[j];
        j += 1;
      }
      if (closed && (j >= src.length || src[j] === '\t' || src[j] === '\n')) {
        cell = value;
        atCellStart = false;
        i = j;
        continue;
      }
      /* not a well-formed quoted cell - the quote is just a character */
      cell += ch;
      atCellStart = false;
      i += 1;
      continue;
    }
    if (ch === '\t') { row.push(cell); cell = ''; atCellStart = true; i += 1; continue; }
    if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; atCellStart = true; i += 1; continue; }
    cell += ch;
    atCellStart = false;
    i += 1;
  }
  if (!(atCellStart && row.length === 0 && cell === '')) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/* The reverse, for Copy - what Excel reads back into the same cells. */
export function toTsv(matrix) {
  return (matrix || []).map((line) => line.map((value) => {
    const text = String(value ?? '');
    return /[\t\n\r"]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }).join('\t')).join('\r\n');
}

const labelKey = (text) => String(text ?? '').toLowerCase().replace(/[^a-z0-9%]/g, '');

/* A pasted first line whose cells name the columns they land on is the
   header of a copied table, not an item. */
function isHeaderLine(line, columns, left) {
  let named = 0;
  line.forEach((text, j) => {
    const col = columns[left + j];
    if (col && labelKey(text) !== '' && labelKey(text) === labelKey(col.label)) named += 1;
  });
  return named >= 2;
}

/* Text that would leave a cell as it is - "-" over an empty cell, a copied
   value pasted back onto itself. A locked row given its own values back is
   not a problem worth reporting. */
function unchanged(col, row, index, text) {
  const value = String(text ?? '').trim();
  return value === String(col.display(row, index)).trim() || sameValue(dash(value), col.text(row));
}

/* What a paste does to the rows. Pure: returns a new rows array (the input
   is never changed) and what was left out, and why.

     matrix     the clipboard, parsed (parseTsv)
     top, left  the cell the paste starts at - the top-left of the selection
     fill       the selection { r1, c1, r2, c2 } when ONE value is pasted
                over several cells: like Excel, every selected cell gets it
     createRow  (rowAbove) => a new row, for a paste that runs past the end

   Read-only columns (Sl No, GST Amount) keep their place in the block, so a
   copied table lines up, but are never written. A locked row, and a value
   its column refuses, are skipped and reported - never half-applied. Cells
   of one row are applied left to right, so a pasted quantity is in place
   before the rate beside it is judged. */
export function planPaste({ rows, columns, top, left, matrix, fill = null, ctx = {}, createRow }) {
  const next = (rows || []).slice();
  const skipped = [];
  let changed = 0;
  let added = 0;
  let droppedCols = 0;
  let bottom = top;
  let right = left;

  let lines = (matrix || []).filter((line) => Array.isArray(line));
  if (lines.length > 1 && isHeaderLine(lines[0], columns, left)) lines = lines.slice(1);

  const cells = [];
  if (fill && lines.length === 1 && lines[0].length === 1) {
    for (let r = fill.r1; r <= fill.r2; r += 1) {
      for (let c = fill.c1; c <= fill.c2; c += 1) cells.push({ r, c, text: lines[0][0] });
    }
  } else {
    lines.forEach((line, i) => line.forEach((text, j) => {
      const c = left + j;
      if (c >= columns.length) { droppedCols += 1; return; }
      cells.push({ r: top + i, c, text });
    }));
  }

  cells.forEach(({ r, c, text }) => {
    while (r >= next.length) {
      next.push(createRow(next[next.length - 1] || null));
      added += 1;
    }
    bottom = Math.max(bottom, r);
    right = Math.max(right, c);
    const col = columns[c];
    if (col.readOnly) return;
    const row = next[r];
    const locked = lockReason(row);
    if (locked) {
      if (!unchanged(col, row, r, text)) skipped.push({ r, c, text, reason: locked });
      return;
    }
    const result = col.parse(text, row, ctx);
    if (result.error) { skipped.push({ r, c, text, reason: result.error }); return; }
    next[r] = { ...row, ...result.patch, _edited: true };
    changed += 1;
  });

  return { rows: next, changed, added, skipped, droppedCols, bottom, right };
}

/* Delete / Backspace over a selection: every editable cell in it emptied,
   except where empty is not a value its column accepts (a quantity, a rate)
   - those are reported and left as they are. */
export function planClear({ rows, columns, rect, ctx = {} }) {
  const next = (rows || []).slice();
  const skipped = [];
  let changed = 0;
  for (let r = rect.r1; r <= rect.r2; r += 1) {
    for (let c = rect.c1; c <= rect.c2; c += 1) {
      const col = columns[c];
      const row = next[r];
      if (!row || !col || col.readOnly) continue;
      if (String(col.text(row) ?? '').trim() === '') continue;
      const locked = lockReason(row);
      if (locked) { skipped.push({ r, c, text: '', reason: locked }); continue; }
      const result = col.parse('', row, ctx);
      if (result.error) { skipped.push({ r, c, text: '', reason: result.error }); continue; }
      next[r] = { ...row, ...result.patch, _edited: true };
      changed += 1;
    }
  }
  return { rows: next, changed, skipped };
}

/* "Row 3 GST% "abc": GST% must be a number · ..." for a notice line. */
export function describeSkipped(skipped, columns, limit = 3) {
  const shown = (skipped || []).slice(0, limit).map((item) => {
    const value = String(item.text ?? '').trim();
    return `Row ${item.r + 1} ${columns[item.c]?.label || ''}${value ? ` "${value.slice(0, 24)}"` : ''}: ${item.reason}`;
  });
  const more = (skipped || []).length - shown.length;
  return shown.join(' · ') + (more > 0 ? ` · and ${more} more` : '');
}
