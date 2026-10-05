// /* Barcode Report IMPORT - the other ERP's Barcode Report, read into ours.

//    The same arrangement as Supplier -> GST Parse (lib/gstPasteParser.js): the
//    operator opens the report on erp.orbiteerp.com themselves, searches the
//    item, and copies the table - or saves its Excel export - and brings it here.
//    Nothing in this file touches the network or the database. It is a pure
//    function over the pasted text / sheet rows, so the browser shows what it
//    read and the server re-reads the very same rows by the very same rules
//    before anything is saved.

//    Read by HEADING, not by column position: the headings the report prints
//    ("Barcode", "Item Code", "Pur Rate", "Final Net" ...) are matched loosely,
//    so a column moved, added or renamed in a small way does not shift the
//    others, and a heading nobody recognises is reported, never guessed at.

//    The server (app/api/reports/barcode-report/import/route.js) decides what
//    each row becomes: a new unit of stock, a barcode this ERP already holds
//    (unchanged, or changed - the operator ticks which changes to take), or a
//    row that cannot be imported, and why. */

// import { barcodeKey, parseBarcodeValue, sameBarcode } from '@/lib/barcodeValue';
// import { uomTypeOf } from '@/lib/barcodeUnits';
// import { encodeRate } from '@/lib/purchaseRateCode';

// /* What an imported barcode is tagged with (barcodeLabel.source, and the
//    GRC_IN ledger row's refModel) - so these units can always be told apart
//    from stock received on a GRC here, the way WHSTK_EXCEL rows are. */
// export const IMPORT_SOURCE = 'ORBITEERP_BARCODE_REPORT';
// export const SOURCE_URL = 'https://erp.orbiteerp.com/admin/reports/barcode-report';
// /* one import at a time is one report search, at most a few hundred rows;
//    this is a guard against a runaway paste, not a business rule */
// export const IMPORT_LIMIT = 2000;
// const GST_MAX = 40;

// /* The report's columns, as this ERP's Barcode Report shows them (fields.js)
//    and as the other system labels them. `aliases` are squashed (see squash). */
// export const IMPORT_FIELDS = [
//   { key: 'barcode', label: 'Barcode', aliases: ['barcode', 'barcodeno', 'barcodenumber', 'barcodegenerated', 'barcodes', 'barcodeid'] },
//   { key: 'itemCode', label: 'Item Code', aliases: ['itemcode', 'itemno', 'itemnumber', 'stylecode', 'styleno'] },
//   { key: 'description', label: 'Description', aliases: ['description', 'itemname', 'itemdescription', 'printdescription', 'desc', 'name', 'productname'] },
//   { key: 'qty', label: 'Qty', aliases: ['qty', 'quantity', 'qtymtr', 'stock'] },
//   { key: 'uom', label: 'UOM', aliases: ['uom', 'unit', 'units'] },
//   { key: 'hsn', label: 'HSN', aliases: ['hsn', 'hsncode', 'hsnsac', 'hsnsaccode'] },
//   { key: 'purRate', label: 'Pur Rate', aliases: ['purrate', 'purchaserate', 'purchaseprice', 'prate', 'purchase', 'rate'] },
//   { key: 'finalNet', label: 'Final Net', aliases: ['finalnet', 'finalrate', 'finalprice', 'netrate', 'cp', 'costprice', 'finalnetrate'] },
//   { key: 'gst', label: 'GST %', aliases: ['gst%', 'gst', 'gstpercent', 'gstrate', 'tax%', 'tax'] },
//   { key: 'retailPrice', label: 'Retail Price', aliases: ['retailprice', 'rsp', 'mrp', 'retail', 'sellingprice', 'rspprice'] },
//   { key: 'offerPrice', label: 'Offer Price', aliases: ['offerprice', 'offer', 'rspofferprice'] },
//   { key: 'wspPrice', label: 'WSP Price', aliases: ['wspprice', 'wsp', 'wholesaleprice', 'wspofferprice'] },
//   { key: 'dpPrice', label: 'DP Price', aliases: ['dpprice', 'dp', 'ecomm', 'ecommprice', 'ecommofferprice'] },
//   { key: 'grcNo', label: 'GRC No', aliases: ['grcno', 'grc', 'grcnumber'] },
// ];
// const FIELD_BY_ALIAS = new Map(IMPORT_FIELDS.flatMap((f) => f.aliases.map((a) => [a, f.key])));
// export const FIELD_LABELS = Object.fromEntries(IMPORT_FIELDS.map((f) => [f.key, f.label]));
// const NUMBER_FIELDS = ['qty', 'purRate', 'finalNet', 'gst', 'retailPrice', 'offerPrice', 'wspPrice', 'dpPrice'];
// /* without these a row is not a unit of stock */
// const REQUIRED = ['barcode', 'itemCode', 'qty', 'uom'];

// /* What an import may change on a barcode this ERP already holds: its prices
//    and how it is described. Never its item, quantity or unit - those are
//    stock, and the ledger says how much of what is where; correcting them is
//    a stock adjustment, not an import. */
// export const UPDATABLE_FIELDS = ['description', 'hsn', 'purRate', 'finalNet', 'gst', 'retailPrice', 'offerPrice', 'wspPrice', 'dpPrice'];
// /* compared, and shown when they differ, but never written by an import */
// const COMPARED_FIELDS = ['itemCode', 'qty', 'uom', ...UPDATABLE_FIELDS];

// /* "Pur. Rate", "Pur Rate" and "PUR_RATE" are one heading; "GST %" keeps its % */
// export const squash = (text) => String(text ?? '').toLowerCase().replace(/[^a-z0-9%]/g, '');
// const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
// /* the report prints an empty cell as "-" */
// const cell = (value) => { const v = clean(value); return v === '-' || v === '—' ? '' : v; };
// /* "1,980.00", "₹1,980", "5%" -> "1980", "5" */
// const numberText = (value) => cell(value).replace(/[₹,\s]/g, '').replace(/%$/, '');
// const isNumber = (text) => text !== '' && Number.isFinite(Number(text));
// const decimals = (text) => (String(text).split('.')[1] || '').length;

// /* ------------------------------------------- what a barcode looks like -- */

// /* A value as a barcode is written: a composed value's separators closed up
//    ("G1318 * 05178 * 1 * 1" -> "G1318*05178*1*1"). Nothing else is touched -
//    never a character dropped, never a part cut off: "9A1136-TWN0LPID" stays
//    what it is, and is never taken for "9A1136". */
// export const closeSeparators = (value) => clean(value).replace(/\s*\*\s*/g, '*');

// /* A composed SUPPLIER*GRC*BILL*SERIAL value (lib/barcodeValue.js) as this
//    ERP makes it: a supplier's contact code (letters, then digits - G1318),
//    then three numbers. parseBarcodeValue alone only counts four parts, so
//    "RSP*1590*Qty*2" would pass it. */
// export function composedValue(value) {
//   const parts = parseBarcodeValue(closeSeparators(value));
//   if (!parts) return false;
//   return /^[A-Za-z]+\d+[A-Za-z0-9]*$/.test(parts.supplierCode)
//     && [parts.grcNumber, parts.billSlNo, parts.serialNo].every((p) => /^\d+$/.test(p));
// }

// /* Whether a value is SHAPED like a barcode - one token with a digit in it
//    (a composed value only when it is a whole composed value). Only decides
//    what may be looked at as a barcode; whether it IS one is the Barcode
//    Setting format and the lookup's decision (classifyRecords).
//      loose  a value the page labels as the barcode, or a report's Barcode
//             column: "-", "/", "." and "_" allowed inside it
//      strict a value printed on its own, with nothing saying what it is:
//             letters and digits only, 3 to 30 of them                      */
// export function barcodeShaped(value, { loose = false } = {}) {
//   const v = closeSeparators(value);
//   if (!v || v.length > 60 || /\s/.test(v) || !/\d/.test(v)) return false;
//   if (v.includes('*')) return composedValue(v);
//   return loose ? /^[A-Za-z0-9](?:[A-Za-z0-9\-/._]*[A-Za-z0-9])?$/.test(v) : /^[A-Za-z0-9]{3,30}$/.test(v);
// }

// /* ---------------------------------------------------------------- read -- */

// /* Tab-separated text as a browser or Excel puts a copied table on the
//    clipboard: rows on line breaks, cells on tabs, a cell holding a tab or a
//    line break wrapped in double quotes. */
// export function splitTable(text) {
//   const src = String(text ?? '').replace(/\r\n?/g, '\n');
//   const rows = [];
//   let row = [];
//   let value = '';
//   let quoted = false;
//   for (let i = 0; i < src.length; i += 1) {
//     const ch = src[i];
//     if (quoted) {
//       if (ch === '"' && src[i + 1] === '"') { value += '"'; i += 1; } else if (ch === '"') quoted = false; else value += ch;
//     } else if (ch === '"' && value === '') quoted = true;
//     else if (ch === '\t') { row.push(value); value = ''; } else if (ch === '\n') { row.push(value); rows.push(row); row = []; value = ''; } else value += ch;
//   }
//   if (value !== '' || row.length) { row.push(value); rows.push(row); }
//   return rows;
// }

// /* Which report column each cell of a line is, or null when fewer than three
//    cells - one of them Barcode - name a column: that line is not the header. */
// function headerOf(line) {
//   const fields = line.map((text) => FIELD_BY_ALIAS.get(squash(text)) || null);
//   const named = fields.filter(Boolean);
//   if (named.length < 3 || !named.includes('barcode')) return null;
//   /* a heading twice ("Barcode" and "Barcode No") - the first one is the column */
//   return fields.map((f, i) => (f && fields.indexOf(f) === i ? f : null));
// }

// /* A copied report table, as rows of cells -> the barcodes it holds.

//    Returns
//      records    [{ line, values, problems }]  one per data row, in order
//      columns    [{ heading, field }]           how each heading was read
//      unmapped   headings nobody recognised (their cells are ignored)
//      missing    required columns the table does not have
//      ignored    lines that are not barcodes: the totals row, a repeated
//                 header from a second page, blank lines
//      left       the lines left out that were not blank, and why
//                 [{ line, text, reason }] - a row whose Barcode cell is not
//                 a barcode ("ECom ID", "Showing 1 to 1 of 1 entries"), or
//                 anything after the table ends (a Details view below it)
//      error      why nothing could be read at all, or ''                  */
// export function readTable(matrix) {
//   const lines = (matrix || []).map((line) => (Array.isArray(line) ? line : []));
//   const at = lines.findIndex((line) => headerOf(line));
//   if (at < 0) {
//     return {
//       records: [], columns: [], unmapped: [], missing: REQUIRED, ignored: 0, left: [],
//       error: 'No report headings were found. Copy the whole table from the Barcode Report - from the "Barcode" heading to the last row - or choose its Excel file.',
//     };
//   }
//   const fields = nearHeadings(lines[at], headerOf(lines[at]));
//   const columns = lines[at].map((heading, i) => ({ heading: clean(heading), field: fields[i] })).filter((c) => c.heading);
//   const unmapped = columns.filter((c) => !c.field).map((c) => c.heading);
//   const missing = REQUIRED.filter((key) => !fields.includes(key));
//   if (missing.length) {
//     return {
//       records: [], columns, unmapped, missing, ignored: 0, left: [],
//       error: `The table has no ${missing.map((key) => FIELD_LABELS[key]).join(', ')} column - copy the whole report table, every column.`,
//     };
//   }

//   const records = [];
//   const left = [];
//   let ignored = 0;
//   let ended = false;
//   const leave = (line, text, reason) => { ignored += 1; if (left.length < 50) left.push({ line, text: String(text).slice(0, 80), reason }); };
//   lines.slice(at + 1).forEach((line, i) => {
//     const lineNo = at + i + 2;
//     const filled = line.map((c) => cell(c)).filter(Boolean);
//     const text = filled.join(' | ');
//     if (!text) { ignored += 1; return; }
//     /* a second page's heading row: the report goes on */
//     if (headerOf(line)) { ended = false; ignored += 1; return; }
//     /* the table ends where a Details view starts - its "Details" heading or
//        a band standing alone on its line, or its movement table - and
//        nothing below it is a row of the report, until the headings repeat */
//     if (!ended && (movementHeader(line.join('\t')) || (filled.length === 1 && DETAILS_START.test(filled[0]) && !barcodeShaped(filled[0], { loose: true })))) ended = true;
//     if (ended) { leave(lineNo, text, 'below the report table'); return; }
//     const values = {};
//     fields.forEach((field, c) => { if (field) values[field] = cell(line[c]); });
//     /* the totals row: no barcode and no item, or a first cell reading "Total" */
//     if ((!values.barcode && !values.itemCode) || /^(grand\s*)?total/i.test(cell(line[0]))) { ignored += 1; return; }
//     /* only a barcode makes a row: text in the Barcode column ("ECom ID",
//        "Showing 1 to 1 of 1 entries") is page text that fell under the
//        headings, never a barcode made up from it */
//     if (values.barcode && !barcodeShaped(values.barcode, { loose: true })) { leave(lineNo, text, `"${values.barcode.slice(0, 40)}" in the Barcode column is not a barcode`); return; }
//     records.push({ line: lineNo, values: normaliseRecord(values) });
//   });
//   if (records.length > IMPORT_LIMIT) {
//     return { records: [], columns, unmapped, missing, ignored, left, error: `That is ${records.length} barcodes - import at most ${IMPORT_LIMIT} at a time.` };
//   }

//   /* the same barcode twice: a second page copied over the first repeats
//      rows exactly (kept once); two DIFFERENT rows under one barcode cannot
//      both be right, so the later one is refused */
//   const seen = new Map();
//   const kept = [];
//   records.forEach((record) => {
//     const key = barcodeKey(record.values.barcode);
//     const first = key ? seen.get(key) : null;
//     if (first && JSON.stringify(first.values) === JSON.stringify(record.values)) { ignored += 1; return; }
//     record.problems = checkRecord(record.values);
//     if (first) record.problems.push(`The same barcode is on line ${first.line} with different details`);
//     if (key && !first) seen.set(key, record);
//     kept.push(record);
//   });
//   return { records: kept, columns, unmapped, missing, ignored, left, error: '' };
// }

// /* A REQUIRED column whose heading was read with one letter wrong - OCR of a
//    screenshot reads "QTY" as "Qry" - is still found: an unplaced heading one
//    edit away from exactly one of that column's names takes it. Only the
//    required columns, only when nothing else claimed them, and only a single
//    candidate - "DATE" can never become "RATE" this way. */
// const oneEdit = (a, b) => {
//   if (a === b || Math.abs(a.length - b.length) > 1 || Math.min(a.length, b.length) < 3) return false;
//   let i = 0;
//   let j = 0;
//   let edits = 0;
//   while (i < a.length && j < b.length) {
//     if (a[i] === b[j]) { i += 1; j += 1; continue; }
//     edits += 1;
//     if (edits > 1) return false;
//     if (a.length > b.length) i += 1; else if (b.length > a.length) j += 1; else { i += 1; j += 1; }
//   }
//   return edits + (a.length - i) + (b.length - j) <= 1;
// };
// function nearHeadings(line, fields) {
//   const out = [...fields];
//   REQUIRED.filter((key) => !out.includes(key)).forEach((key) => {
//     const aliases = IMPORT_FIELDS.find((f) => f.key === key).aliases;
//     const near = line.map((text, i) => (!out[i] && aliases.some((a) => oneEdit(squash(text), a)) ? i : -1)).filter((i) => i >= 0);
//     if (near.length === 1) out[near[0]] = key;
//   });
//   return out;
// }

// /* A report-table heading row's fields, cell by cell, or null when the row is
//    not one - for lib/barcodeReportOcr.js's check of the TOTAL row. */
// export function headingFields(cells) {
//   const list = (cells || []).map((c) => String(c ?? ''));
//   const fields = headerOf(list);
//   return fields ? nearHeadings(list, fields) : null;
// }

// /* Whether a row of cells is a table's heading row - the report list's
//    (Barcode, Item Code, ...) or a Details page's movement table (Location,
//    Doc Date, Doc No, ...). lib/barcodeReportOcr.js asks this of a screenshot's
//    rows, so the headings are known in one place only. */
// export function isTableHeading(cells) {
//   const list = (cells || []).map((c) => String(c ?? ''));
//   return Boolean(headerOf(list)) || Boolean(movementHeader(list.join('\t')));
// }

// /* Pasted text -> readTable. Text with no tab in it is not a copied table:
//    copying the page as a whole, or a PDF, runs the cells together. */
// export function readPastedText(text) {
//   const trimmed = String(text ?? '').trim();
//   if (!trimmed) return { ...readTable([]), error: 'Paste the Barcode Report table first.' };
//   if (!trimmed.includes('\t')) {
//     return {
//       ...readTable([]),
//       error: 'That text has no table columns in it. Select the report table itself (from the "Barcode" heading to the last row), copy it and paste it here - or choose its Excel file.',
//     };
//   }
//   return readTable(splitTable(trimmed));
// }

// /* Numbers as plain text ("1,980.00" -> "1980"), everything else trimmed. */
// export function normaliseRecord(values) {
//   const out = {};
//   IMPORT_FIELDS.forEach(({ key }) => {
//     const raw = cell(values?.[key]);
//     if (NUMBER_FIELDS.includes(key)) {
//       const n = numberText(raw);
//       out[key] = isNumber(n) ? String(Number(n)) : raw;
//     } else if (key === 'hsn') out[key] = raw.replace(/[\s.]/g, '');
//     else if (key === 'uom') out[key] = raw.toUpperCase();
//     else out[key] = raw;
//   });
//   return out;
// }

// /* Why one row cannot be a unit of stock, as [{ field, message }]; empty when
//    it can. The server runs this again over what it is sent. */
// export function checkFields(values) {
//   const v = values || {};
//   const problems = [];
//   const bad = (field, message) => problems.push({ field, message });
//   REQUIRED.forEach((key) => { if (!cell(v[key])) bad(key, `${FIELD_LABELS[key]} is missing`); });
//   if (cell(v.barcode).length > 60) bad('barcode', 'Barcode is longer than 60 characters');
//   /* one barcode value - never a phrase ("Details", "ITEM CODE DESCRIPTION") */
//   else if (cell(v.barcode) && !barcodeShaped(v.barcode, { loose: true })) bad('barcode', `"${cell(v.barcode).slice(0, 40)}" is not a barcode number`);
//   if (cell(v.itemCode).length > 60) bad('itemCode', 'Item Code is longer than 60 characters');
//   if (cell(v.qty)) {
//     if (!isNumber(v.qty) || Number(v.qty) <= 0) bad('qty', 'Qty must be a number greater than 0');
//     else if (decimals(v.qty) > 3) bad('qty', 'Qty can have at most 3 decimals');
//   }
//   if (cell(v.uom).length > 20) bad('uom', 'UOM is longer than 20 characters');
//   if (cell(v.hsn) && !/^\d{2,8}$/.test(v.hsn)) bad('hsn', 'HSN must be 2 to 8 digits');
//   if (cell(v.gst) && (!isNumber(v.gst) || Number(v.gst) < 0 || Number(v.gst) > GST_MAX)) bad('gst', `GST % must be between 0 and ${GST_MAX}`);
//   ['purRate', 'finalNet', 'retailPrice', 'offerPrice', 'wspPrice', 'dpPrice'].forEach((key) => {
//     if (cell(v[key]) && (!isNumber(v[key]) || Number(v[key]) < 0)) bad(key, `${FIELD_LABELS[key]} must be a number, 0 or more`);
//   });
//   if (cell(v.description).length > 200) bad('description', 'Description is longer than 200 characters');
//   return problems;
// }

// /* the same, as messages */
// export const checkRecord = (values) => checkFields(values).map((p) => p.message);

// /* ------------------------------------------- one barcode's Details page -- */

// /* The other ERP's Barcode Report DETAILS page - one barcode, or several one
//    after another - copied and pasted, or its Excel export read into the same
//    lines. Two layouts are known, and both are read:

//      "Item Name: 15-SRT", "Purchase Rate 550.00 | Discount 0.00"
//          a label at the start of a cell, cells on tabs or " | "
//      "PRICE INFO   PURCHASE RATE : 620.00   DISCOUNT : 0.00   FINAL RATE : 620.00"
//          several KEY : VALUE pairs on one line after a band heading, the
//          pairs apart by runs of spaces or by tabs, a value may be empty

//    and the movement table in either form: Type / Supplier/Cust/Location /
//    Particulars columns and 24-hour times, or a Message column, 12-hour times
//    ("03:08 PM"), a blank Qty and an issue printed as -1.

//    Read BY LABEL, never by position, like lib/gstPasteParser.js reads the GST
//    portal. The text is normalised first - non-breaking spaces, \r\n, the
//    screen's chrome (NOTE :, NO IMAGE, PRINT) - and every match is
//    case-insensitive: the screen shows the report in capitals, the text copied
//    from it may not be. What cannot be read is said, per field; nothing is
//    guessed. `barcode` - the number typed beside a pasted page that does not
//    print one. */
// const DETAIL_LABELS = [
//   ['barcode', ['Barcode Number', 'Barcode No', 'Barcode']],
//   ['itemName', ['Item Name']],
//   ['itemCode', ['Item Code']],
//   ['subGroup', ['Sub Group', 'Subgroup']],
//   ['group', ['Group']],
//   ['hsn', ['HSN Code', 'HSN']],
//   ['gstSlab', ['GST Slab', 'Tax Slab']],
//   ['pma', ['PMA', 'P-M-F', 'PMF']],
//   ['purRate', ['Purchase Rate', 'Pur Rate']],
//   ['discount', ['Discount']],
//   ['finalNet', ['Final Rate', 'Final Net']],
//   ['rsp', ['RSP', 'Retail Price']],
//   ['wsp', ['WSP']],
//   ['dp', ['DP', 'E-COMM']],
//   ['designNo', ['Design NO.', 'Design No', 'Design Number', 'Design']],
//   ['supplier', ['Supplier Name', 'Supplier']],
//   ['taxRegion', ['Tax Region']],
//   ['uom', ['UOM']],
//   /* the whole label, so "Supplier Description" is never read as "Supplier" */
//   ['description', ['Supplier Description', 'Description']],
//   /* only with a colon after it ("GRC No: 05165") - a GRC number is the one
//      the page names, never a "GRC Date" or a Doc No in the movement table */
//   ['grcNo', ['GRC Number', 'GRC No'], { colonOnly: true }],
//   /* "Unit: Pc(s)" - the page's own unit, used only when the Item master has
//      none (lib/barcodeReportImportService.js resolveDetails); never "Unit Price" */
//   ['uom', ['Unit'], { colonOnly: true }],
// ].flatMap(([key, labels, opts = {}]) => labels.map((label) => ({ key, label, ...opts })))
//   .sort((a, b) => b.label.length - a.label.length);
// const labelPattern = (label) => label.split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*');
// /* a label at the start of a cell: "Item Name 15-SRT", "Item Name: 15-SRT" */
// const LABEL_RES = DETAIL_LABELS.map(({ key, label, colonOnly }) => ({
//   key,
//   re: colonOnly
//     ? new RegExp('^\\s*' + labelPattern(label) + '\\s*:\\s*(.*)$', 'i')
//     : new RegExp('^\\s*' + labelPattern(label) + '(?=$|[\\s:.\\-])\\s*[:.\\-]?\\s*(.*)$', 'i'),
//   colon: new RegExp('^\\s*' + labelPattern(label) + '\\s*:', 'i'),
// }));
// /* labels followed by a colon, anywhere on a line: "PMA : FAUX   RSP : 1080" */
// const COLON_LABELS = new RegExp('(?:^|(?<=[\\s|]))(' + DETAIL_LABELS.map(({ label }) => labelPattern(label)).join('|') + ')\\s*:', 'gi');
// const keyOfLabel = (text) => DETAIL_LABELS.find(({ label }) => new RegExp('^' + labelPattern(label) + '$', 'i').test(String(text).trim()))?.key;
// /* A value that starts with one of these words and a colon belongs to a
//    longer label the page printed - "Unit Price : 1590" is not UOM "Price :
//    1590", "DP Price Code : 900" is not DP "Price Code : 900". Only these
//    words: "Design NO. SS: 2024" is the design "SS: 2024". */
// const LONGER_LABEL = /^(price|code|type|name|rate|date|no\.?|number|qty|quantity|group|id|value|amount)\b[^:]{0,20}:/i;
// /* a value with no letter or digit (in any script) - the "*" a form prints
//    beside a required filter ("Item Code *"), a "-" or ":" - is no value */
// const hasValue = (text) => /[\p{L}\p{N}]/u.test(String(text ?? ''));

// /* the page's bands, and lines that are its chrome rather than its data */
// const BANDS = [
//   ['itemInfo', 'ITEM INFO'], ['otherInfo', 'OTHER INFO'], ['priceInfo', 'PRICE INFO'], ['designInfo', 'DESIGN INFO'], ['supplierDetails', 'SUPPLIER DETAILS'],
// ];
// const BAND_RE = /\b(item\s+info|other\s+info|price\s+info|design\s+info|supplier\s+details)\b\s*:?/gi;
// /* where a Details view starts: its "Details" heading or one of its bands */
// const DETAILS_START = /^(details|item\s+info|other\s+info|price\s+info|design\s+info|supplier\s+details)\b/i;
// const NOISE =/^(note\b.*|no\s+image|image|print|back|close|details|download\b.*|export\b.*|barcode\s+report|stock[\s-]*by[\s-]*location.*|stock[\s-]*summary.*|stock\s+movements?(\s+rows?)?\s*:?|movement\s+columns?\s*:?)$/i;

// /* the movement table's columns */
// const MOVE_COLUMNS = [
//   ['location', ['location']],
//   ['docDate', ['docdate', 'date']],
//   ['docType', ['type', 'doctype']],
//   ['docNo', ['docno', 'documentno', 'docnumber']],
//   ['party', ['suppliercustlocation', 'suppliercustomerlocation', 'suppliercust', 'party']],
//   ['particulars', ['particulars', 'message', 'narration', 'remarks']],
//   ['stockPoint', ['stockpoint']],
//   ['receipts', ['receipts', 'receipt']],
//   ['issues', ['issues', 'issue']],
//   ['balance', ['balance', 'balanceqty']],
//   ['qty', ['qty', 'quantity']],
//   ['finalPrice', ['finalprice', 'rate', 'price']],
//   ['netAmount', ['netamt', 'netamount', 'amount']],
// ];
// const MOVE_BY_HEAD = new Map(MOVE_COLUMNS.flatMap(([key, heads]) => heads.map((h) => [h, key])));
// /* the same headings as they run together on a line with single spaces -
//    longest first, so SUPPLIER/CUST/LOCATION is not read as LOCATION */
// const MOVE_PHRASES = [
//   ['party', /SUPPLIER\s*\/\s*CUST(OMER)?\s*\/\s*LOCATION/], ['finalPrice', /FINAL\s+PRICE/], ['netAmount', /NET\s+AM(OUN)?T/],
//   ['docDate', /DOC\.?\s+DATE/], ['docNo', /DOC\.?\s+NO\.?/], ['stockPoint', /STOCK\s+POINT/], ['particulars', /PARTICULARS|MESSAGE|NARRATION/],
//   ['location', /LOCATION/], ['docType', /\bTYPE\b/], ['receipts', /RECEIPTS?/], ['issues', /ISSUES?/], ['balance', /BALANCE/], ['qty', /\bQTY\b|QUANTITY/],
// ];
// const MOVE_NUMBERS = ['receipts', 'issues', 'balance', 'qty', 'finalPrice', 'netAmount'];
// /* which blank a row most likely has, first */
// const BLANK_FIRST = ['qty', 'balance', 'finalPrice', 'netAmount', 'issues', 'receipts'];

// /* "2025-09-01 19:12:28", "2026-09-02 03:08 PM", "01-09-2025 19:12" */
// const DATE_RE = /(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([AaPp])\.?[Mm]\.?)?)?|(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([AaPp])\.?[Mm]\.?)?)?/;
// const NUMBER_CELL = /^[-+]?(\d{1,3}(,\d{2,3})+|\d+)?(\.\d+)?$/;
// const isNumberCell = (text) => NUMBER_CELL.test(String(text).trim()) && /\d/.test(text);

// /* text as read: non-breaking spaces as spaces, one kind of line ending,
//    trimmed lines, no empty ones, a leading "- " bullet dropped */
// export function normaliseLines(text) {
//   return String(text ?? '').replace(/ /g, ' ').replace(/\r\n?/g, '\n').split('\n')
//     .map((l) => l.replace(/^[ \t]*[-•*][ \t]+/, '').trim())
//     .filter(Boolean);
// }

// /* a line's cells: tabs as a browser copies a table (empty cells kept), " | ",
//    or runs of two or more spaces; a line with single spaces only is one cell */
// function cellsOf(line) {
//   const text = String(line ?? '');
//   if (text.includes('\t')) return text.split('\t').map((c) => c.trim());
//   if (/\|/.test(text)) return text.split(/\s*\|\s*/).map((c) => c.trim());
//   return text.split(/\s{2,}/).map((c) => c.trim());
// }
// /* the first non-empty cell of some text - a labelled value's own cell. A
//    column break is a tab or " | ", or a run of spaces before another label
//    ("GST 5 %   Unit: Pc(s)"); a double space inside a value ("KARNATAKA
//    SAREE CENTRE,  MYSORE (G524)") is not one */
// const firstCellOf = (text) => String(text ?? '')
//   .split(/\t|\s*\|\s*|\s{2,}(?=[\p{L}][\p{L} .()/&'-]{0,40}?\s*:)/u)
//   .map((c) => c.trim()).find((c) => c !== '') || '';
// /* A label at the start of a cell -> { key, value }. value '' when nothing
//    follows the label (its value is in the next cell or on the next line),
//    null when what follows is no value at all ("Item Code *"). */
// const labelIn = (text) => {
//   const t = String(text ?? '');
//   /* a cell that is nothing but a label ("GRC No", "Item Name") - its value
//      is in the next cell or on the next line */
//   const exact = keyOfLabel(t.replace(/\s*:\s*$/, ''));
//   if (exact) return { key: exact, value: '' };
//   for (const { key, re, colon } of LABEL_RES) {
//     const m = t.match(re);
//     if (!m) continue;
//     /* "Unit Price : 1590" - the start of a longer label, not this one */
//     if (!colon.test(t) && LONGER_LABEL.test(m[1])) return null;
//     if (cell(m[1]) === '') return { key, value: '' };
//     return { key, value: hasValue(m[1]) ? cell(m[1]) : null };
//   }
//   return null;
// };
// const num = (text) => { const n = numberText(text); return n === '' || !isNumber(n) ? 0 : Number(n); };

// /* "2025-09-01 19:12:28" (or "2026-09-02 03:08 PM", "01-09-2025 19:12") ->
//    a Date, read as India time unless the text names a zone */
// export function istDate(text) {
//   const m = cell(text).match(DATE_RE);
//   if (!m) return null;
//   const [y, mo, d, h, mi, s, ap] = m[1] ? [m[1], m[2], m[3], m[4], m[5], m[6], m[7]] : [m[10], m[9], m[8], m[11], m[12], m[13], m[14]];
//   let hour = Number(h || 0);
//   if (ap) hour = (hour % 12) + (/p/i.test(ap) ? 12 : 0);
//   const pad = (v) => String(v).padStart(2, '0');
//   const date = new Date(`${y}-${pad(mo)}-${pad(d)}T${pad(hour)}:${pad(mi || 0)}:${pad(s || 0)}+05:30`);
//   return Number.isNaN(date.getTime()) ? null : date;
// }

// /* The key a re-import dedupes a movement row on. */
// export function movementKey(m) {
//   const date = m?.docDate instanceof Date ? m.docDate.toISOString() : cell(m?.docDate);
//   return [m?.docType, m?.docNo, date, m?.location, m?.stockPoint].map((v) => cell(v).toLowerCase()).join('|');
// }

// /* "GST 5 %" -> 5 */
// export const gstPercent = (text) => {
//   const m = cell(text).match(/(\d+(?:\.\d+)?)\s*%?/);
//   return m ? Number(m[1]) : null;
// };

// /* "KARNATAKA SAREE CENTRE, MYSORE (G524)" -> { name, code } */
// export function splitSupplier(text) {
//   const raw = cell(text);
//   const m = raw.match(/^(.*?)\s*\(\s*([A-Za-z]{0,4}\d+[A-Za-z0-9]*)\s*\)\s*$/);
//   return m ? { name: m[1].trim(), code: m[2].toUpperCase() } : { name: raw, code: '' };
// }

// /* A movement's document type, from its Type column - or, in the layout that
//    has a Message instead, from what the message says. */
// export function docTypeOf(text) {
//   const t = cell(text);
//   if (/delivery\s+challan|\bD\.?C\b/i.test(t)) return 'Delivery Challan';
//   if (/\bGRC\b|purchase|received\s+from\s+supplier/i.test(t)) return 'GRC';
//   if (/sales?\s+return|return/i.test(t)) return 'Return';
//   if (/\bsale|sold|invoice|\bPOS\b/i.test(t)) return 'Sale';
//   if (/transfer/i.test(t)) return 'Transfer';
//   return '';
// }

// /* The movements' own totals, and whether they agree with the ones printed. */
// export function movementTotals(movements, printed = null) {
//   const sum = (key) => Math.round((movements || []).reduce((a, m) => a + (Number(m[key]) || 0), 0) * 100) / 100;
//   const computed = { receipts: sum('receipts'), issues: sum('issues'), netAmount: sum('netAmount') };
//   computed.balance = Math.round((computed.receipts - computed.issues) * 1000) / 1000;
//   const mismatches = printed
//     ? ['receipts', 'issues', 'balance', 'netAmount'].filter((k) => printed[k] !== undefined && printed[k] !== null && Math.abs(Number(printed[k])) !== Math.abs(computed[k]))
//     : [];
//   return { computed, printed, mismatches };
// }

// /* The movement table's heading line -> its columns in order, or null. */
// function movementHeader(line) {
//   const upper = cell(line).toUpperCase();
//   if (!/DOC\.?\s*DATE/.test(upper) || !(/DOC\.?\s*NO/.test(upper) || /RECEIPT|ISSUE/.test(upper))) return null;
//   /* a caption before the headings: "Stock movement rows (Location | ...)",
//      "Movement columns: Location | ..." */
//   const cells = cellsOf(line.replace(/^[^(]*\(/, '').replace(/\)+\s*$/, '').replace(/^[^|\t:]*:\s*/, ''));
//   let keys;
//   if (cells.length > 2) {
//     keys = cells.map((c) => MOVE_BY_HEAD.get(squash(c)) || null);
//   } else {
//     /* one run of single spaces: find each heading, in the order they stand */
//     const found = [];
//     let rest = upper;
//     MOVE_PHRASES.forEach(([key, re]) => {
//       const g = new RegExp(re.source, 'g');
//       let m;
//       while ((m = g.exec(rest))) {
//         found.push({ key, at: m.index });
//         rest = rest.slice(0, m.index) + ' '.repeat(m[0].length) + rest.slice(m.index + m[0].length);
//         g.lastIndex = m.index + m[0].length;
//       }
//     });
//     keys = found.sort((a, b) => a.at - b.at).map((f) => f.key);
//   }
//   if (!keys.includes('docDate')) return null;
//   const firstNumber = keys.findIndex((k) => MOVE_NUMBERS.includes(k));
//   return {
//     keys,
//     text: (firstNumber < 0 ? keys : keys.slice(0, firstNumber)),
//     numbers: firstNumber < 0 ? [] : keys.slice(firstNumber).filter((k) => MOVE_NUMBERS.includes(k)),
//   };
// }

// /* Whether one reading of a movement's numbers adds up: the Qty (or, when it
//    is blank, the receipt / issue) times the Final Price is the Net Amt, a Qty
//    given is the receipt or the issue, and a Balance given is the running or
//    the row's own balance. */
// function readingOf(values, previous) {
//   const R = Math.abs(values.receipts ?? 0);
//   const I = Math.abs(values.issues ?? 0);
//   const qtyGiven = values.qty !== null && values.qty !== undefined;
//   const qty = qtyGiven ? Math.abs(values.qty) : (R || I);
//   if (!(qty > 0)) return null;
//   if (qtyGiven && qty !== R && qty !== I) return null;
//   const hasPrice = values.finalPrice !== null && values.finalPrice !== undefined;
//   const hasNet = values.netAmount !== null && values.netAmount !== undefined;
//   if (hasPrice && hasNet && Math.abs(qty * values.finalPrice - Math.abs(values.netAmount)) > 0.01) return null;
//   const running = Math.round((previous + R - I) * 1000) / 1000;
//   const own = Math.round((R - I) * 1000) / 1000;
//   if (values.balance !== null && values.balance !== undefined && values.balance !== running && values.balance !== own) return null;
//   return {
//     receipts: R, issues: I, qty,
//     balance: values.balance ?? running,
//     finalPrice: values.finalPrice ?? 0,
//     netAmount: Math.abs(values.netAmount ?? 0),
//   };
// }

// /* the numbers of a row -> its numeric columns. As many as there are
//    columns: in place. Fewer - a copy that dropped blank cells - each way of
//    leaving out that many columns is tried, and the row is read only if every
//    reading that adds up says the same thing. */
// function numbersOf(values, columns, previous) {
//   if (values.length === columns.length) {
//     const v = Object.fromEntries(columns.map((k, i) => [k, values[i]]));
//     return readingOf(v, previous) || {
//       receipts: Math.abs(v.receipts ?? 0), issues: Math.abs(v.issues ?? 0), qty: Math.abs(v.qty ?? (Math.abs(v.receipts ?? 0) || Math.abs(v.issues ?? 0))),
//       balance: v.balance ?? 0, finalPrice: v.finalPrice ?? 0, netAmount: Math.abs(v.netAmount ?? 0),
//     };
//   }
//   const missing = columns.length - values.length;
//   if (missing < 1 || missing > 2) return null;
//   const sets = [];
//   const choose = (start, picked) => {
//     if (picked.length === missing) { sets.push(picked); return; }
//     for (let i = start; i < columns.length; i += 1) choose(i + 1, [...picked, columns[i]]);
//   };
//   choose(0, []);
//   const rank = (set) => set.reduce((a, k) => a + BLANK_FIRST.indexOf(k), 0);
//   const readings = sets.sort((a, b) => rank(a) - rank(b)).map((set) => {
//     const present = columns.filter((k) => !set.includes(k));
//     const v = Object.fromEntries(present.map((k, i) => [k, values[i]]));
//     return readingOf(v, previous);
//   }).filter(Boolean);
//   if (!readings.length) return null;
//   const same = (a, b) => ['receipts', 'issues', 'qty', 'finalPrice', 'netAmount'].every((k) => a[k] === b[k]);
//   return readings.every((r) => same(r, readings[0])) ? readings[0] : null;
// }

// /* One movement row -> { location, docDate, docType, docNo, party,
//    particulars, stockPoint, receipts, issues, balance, qty, finalPrice,
//    netAmount, signedQty } or null. Numbers are taken from the RIGHT; what is
//    left of them is text, split on its column breaks, or - when a copy ran the
//    columns together with single spaces - by the date and the document number. */
// function movementRow(line, head, previous, warn) {
//   const cells = cellsOf(line);
//   let textCells;
//   let numberCells;
//   if (cells.length > 1) {
//     let i = cells.length - 1;
//     const run = [];
//     while (i >= 0 && (isNumberCell(cells[i]) || cells[i] === '')) { run.unshift(cells[i]); i -= 1; }
//     while (run.length && run[0] === '') { run.shift(); i += 1; }
//     /* never more numbers than the table has numeric columns: a document
//        number such as 05160 belongs to the text */
//     while (run.length > head.numbers.length) { run.shift(); i += 1; }
//     textCells = cells.slice(0, i + 1);
//     numberCells = run;
//   } else {
//     const tokens = cell(line).split(' ');
//     let i = tokens.length - 1;
//     const run = [];
//     while (i >= 0 && isNumberCell(tokens[i]) && run.length < head.numbers.length) { run.unshift(tokens[i]); i -= 1; }
//     textCells = [tokens.slice(0, i + 1).join(' ')];
//     numberCells = run;
//   }
//   const blanks = numberCells.map((c) => (c === '' ? null : num(c)));
//   const numbers = numbersOf(blanks.length === head.numbers.length ? blanks : blanks.filter((v) => v !== null), head.numbers, previous);
//   if (!numbers) return null;

//   /* the text side */
//   const m = {};
//   const keys = head.text;
//   if (textCells.length === keys.length) {
//     keys.forEach((k, i) => { if (k) m[k] = cell(textCells[i]); });
//   } else {
//     const joined = textCells.join('\t');
//     const date = joined.match(DATE_RE);
//     if (!date) return null;
//     m.location = cell(joined.slice(0, date.index));
//     m.docDate = date[0];
//     const after = cellsOf(joined.slice(date.index + date[0].length).replace(/^\t+/, '').trim()).filter((c) => c !== '');
//     const rest = keys.slice(keys.indexOf('docDate') + 1);
//     if (after.length === rest.length) rest.forEach((k, i) => { m[k] = cell(after[i]); });
//     else {
//       /* the columns ran together: the document number is the first word,
//          the stock point (when the table has one) the last, the rest is the
//          message */
//       const words = after.join(' ').split(' ').filter(Boolean);
//       if (rest.includes('docNo')) m.docNo = words.shift() || '';
//       if (rest.includes('stockPoint') && words.length > 1) m.stockPoint = words.pop();
//       m[rest.includes('particulars') ? 'particulars' : 'party'] = words.join(' ');
//       warn('columns ran together - read as document no. / message / stock point');
//     }
//   }
//   const docDate = istDate(m.docDate);
//   if (!docDate) return null;
//   return {
//     location: cell(m.location),
//     docDate,
//     docType: cell(m.docType) || docTypeOf(m.particulars || m.party),
//     docNo: cell(m.docNo),
//     party: cell(m.party),
//     particulars: cell(m.particulars),
//     stockPoint: cell(m.stockPoint),
//     ...numbers,
//     /* receipts and issues are kept as quantities (an issue printed -1 is an
//        issue of 1, as the older layout prints it); the direction is here */
//     signedQty: Math.round((numbers.receipts - numbers.issues) * 1000) / 1000,
//   };
// }

// /* The page's TOTAL row: "TOTAL  1.00  1.00  0.00" (receipts, issues,
//    balance, and a net amount when there are four), or "Totals row: Receipts 1 |
//    Issues 1 | Balance 0 | Net Amt 1182.50". */
// function totalsOf(line) {
//   const text = cell(line).replace(/^(grand\s*)?totals?(\s*row)?\s*:?/i, '');
//   const labelled = {};
//   text.split(/\s*\|\s*|\t|\s{2,}/).forEach((part) => {
//     const m = part.trim().match(/^([A-Za-z][A-Za-z .]*?)\s*:?\s*(-?[\d,.]+)$/);
//     const key = m && MOVE_BY_HEAD.get(squash(m[1]));
//     if (key) labelled[key] = num(m[2]);
//   });
//   if (Object.keys(labelled).length) return labelled;
//   const values = (text.match(/-?[\d,]*\.?\d+/g) || []).map(num);
//   return Object.fromEntries(['receipts', 'issues', 'balance', 'netAmount'].slice(0, values.length).map((k, i) => [k, values[i]]));
// }

// /* What in the text says it is a Barcode Report Details page. */
// function anchorsIn(lines) {
//   const found = new Set();
//   lines.forEach((line) => {
//     BANDS.forEach(([key, words]) => { if (new RegExp('\\b' + words.replace(' ', '\\s+') + '\\b', 'i').test(line)) found.add(key); });
//     if (/^barcode\b(?!\s*report)/i.test(line)) found.add('barcode');
//     if (movementHeader(line)) found.add('movements');
//   });
//   return found;
// }
// const ANCHOR_NAMES = {
//   barcode: 'BARCODE heading', itemInfo: 'ITEM INFO', otherInfo: 'OTHER INFO', priceInfo: 'PRICE INFO', designInfo: 'DESIGN INFO',
//   supplierDetails: 'SUPPLIER DETAILS', movements: 'movement table (LOCATION / DOC DATE / DOC NO)',
// };

// /* Where a Details view's own content starts: its "Details" heading, a band,
//    the Item Name, a BARCODE line with a number, or the movement table. */
// const startsDetails = (line) => {
//   const t = cell(line);
//   return DETAILS_START.test(t) || Boolean(movementHeader(t)) || /^item\s*name\b/i.test(t)
//     || (/^barcode\b(?!\s*report)/i.test(t) && hasValue(t.replace(/^barcode\s*(no\.?|number)?\s*:?/i, '')));
// };

// /* A copied page's Filters panel ("Filters", "Item Code *", "Business
//    Location:" and its list) is the search form above the Details, never
//    data: from a "Filters" line to where the Details start, nothing is read.
//    No "Filters" line, or no Details after it: nothing is dropped. */
// function withoutFilters(lines) {
//   const from = lines.findIndex((l) => /^filters?\s*:?$/i.test(cell(l)));
//   const to = from < 0 ? -1 : lines.findIndex((l, i) => i > from && startsDetails(l));
//   if (to < 0) return { lines, skipped: 0, from: -1 };
//   return { lines: [...lines.slice(0, from), ...lines.slice(to)], skipped: to - from, from };
// }

// /* Each barcode's lines: a new one starts at a second BARCODE line or a
//    second ITEM INFO band. */
// function blocksOf(lines) {
//   const blocks = [];
//   let current = null;
//   lines.forEach((line) => {
//     const isBarcode = /^barcode\b(?!\s*report)/i.test(line);
//     const isItem = /\bitem\s+info\b/i.test(line);
//     if (!current || (isBarcode && (current.barcode || current.item)) || (isItem && current.item)) {
//       current = { lines: [], barcode: false, item: false };
//       blocks.push(current);
//     }
//     if (isBarcode) current.barcode = true;
//     if (isItem) current.item = true;
//     current.lines.push(line);
//   });
//   return blocks.map((b) => b.lines);
// }

// /* ONE barcode's lines -> { record, warnings }. */
// function readDetailsBlock(lines, { barcode = '', line: first = 1 } = {}) {
//   const found = {};
//   const warnings = [];
//   const movements = [];
//   const stock = [];
//   let head = null;
//   let printedTotals = null;
//   let pending = null;
//   let band = '';

//   const setField = (key, value) => {
//     const v = cell(value);
//     if (v === '' || !hasValue(v)) return;
//     if (found[key] === undefined) found[key] = v;
//     else if (key === 'gstSlab' && gstPercent(found[key]) !== gstPercent(v)) warnings.push(`GST Slab is printed twice, as "${found[key]}" and "${v}" - the first was used`);
//   };

//   lines.forEach((raw, index) => {
//     const at = first + index;
//     /* the movement table's heading first: a caption before it must not read as noise */
//     const header = movementHeader(raw);
//     if (header) { head = header; pending = null; return; }
//     if (NOISE.test(raw)) return;
//     if (head) {
//       if (/^(grand\s*)?totals?\b/i.test(raw)) { printedTotals = totalsOf(raw); return; }
//       if (DATE_RE.test(raw)) {
//         const prev = movements.length ? movements[movements.length - 1].balance : 0;
//         const notes = [];
//         const m = movementRow(raw, head, prev, (w) => notes.push(w));
//         if (!m) {
//           warnings.push(`Movement on line ${at} could not be read (its numbers do not fit the ${head.numbers.length} columns) - it was left out: "${raw.slice(0, 80)}"`);
//           return;
//         }
//         notes.forEach((w) => warnings.push(`Movement on line ${at}: ${w}`));
//         m.key = movementKey(m);
//         if (!movements.some((x) => x.key === m.key)) movements.push(m);
//         return;
//       }
//       /* the stock-by-location summary: "location | stock point | qty" */
//       const cells = cellsOf(raw).filter((c) => c !== '');
//       if (cells.length >= 2 && cells.length <= 3 && isNumberCell(cells[cells.length - 1]) && !labelIn(cells[0]) && !isNumberCell(cells[0])) {
//         stock.push({ location: cell(cells[0]), stockPoint: cells.length === 3 ? cell(cells[1]) : '', qty: num(cells[cells.length - 1]) });
//         return;
//       }
//       if (/^location\b.*stock\s*point/i.test(raw)) return;
//     }

//     /* the band this line is in, and the line without its heading */
//     const bands = [...raw.matchAll(BAND_RE)];
//     if (bands.length) band = bands[bands.length - 1][1].toLowerCase().replace(/\s+/g, ' ');
//     const line = raw.replace(BAND_RE, '\t').replace(/^[\t\s:]+/, '').trim();
//     if (!line) return;

//     /* KEY : VALUE pairs anywhere on the line - a value runs to the next
//        pair or the end of its own cell, never across a column break into
//        whatever the next column holds ("GST Slab: GST 5 % | Unit: Pc(s)") */
//     const pairs = [...line.matchAll(COLON_LABELS)];
//     if (pairs.length) {
//       pairs.forEach((p, i) => {
//         const end = i + 1 < pairs.length ? pairs[i + 1].index : line.length;
//         setField(keyOfLabel(p[1]), firstCellOf(line.slice(p.index + p[0].length, end)));
//       });
//       pending = null;
//       return;
//     }

//     /* labels at the start of cells, a value in the next cell or line */
//     const cells = cellsOf(line);
//     let consumed = false;
//     for (let c = 0; c < cells.length; c += 1) {
//       const hit = labelIn(cells[c]);
//       if (!hit) {
//         if (pending && c === 0) { setField(pending, cells[c]); pending = null; consumed = true; }
//         else if (band === 'supplier details' && !found.supplier && c === 0) { setField('supplier', cells[c]); consumed = true; }
//         continue;
//       }
//       consumed = true;
//       if (hit.value !== '') { setField(hit.key, hit.value); pending = null; continue; }
//       const next = cells[c + 1];
//       if (next !== undefined && next !== '' && !labelIn(next)) { setField(hit.key, next); c += 1; pending = null; } else pending = hit.key;
//     }
//     if (!consumed && pending) { setField(pending, line); pending = null; }
//   });

//   /* the barcode:
//        the page's own BARCODE line
//        the number typed in the Barcode box, for a page that prints none
//        the one number the page prints on its own (the text under its
//          barcode's bars) - by the same detection an image goes through,
//          and only a value the server then finds to be a barcode of this
//          ERP's format or one it holds (classifyRecords)
//      The BARCODE line and the typed number both, and different: the page is
//      read under neither (a number left in the box from another page would
//      take this page's item, prices and history). */
//   const problems = [];
//   const typed = closeSeparators(barcode);
//   let printed = cell(found.barcode);
//   if (printed && !barcodeShaped(printed, { loose: true })) {
//     warnings.push(`The page's BARCODE line reads "${printed.slice(0, 40)}" - not a barcode number, so it was not used`);
//     printed = '';
//   }
//   if (printed && typed && barcodeKey(printed) !== barcodeKey(typed)) {
//     problems.push({ field: 'barcode', message: `The page prints barcode ${printed} but ${typed} is typed in the Barcode box - clear the box (or correct it) and Check again` });
//   }
//   let code = printed || typed;
//   let candidate = null;
//   if (!code) {
//     const alone = detectBarcodes(lines, { textInput: true }).candidates.filter((c) => c.source === 'standalone');
//     if (alone.length === 1) {
//       code = alone[0].value;
//       candidate = { source: 'standalone', digitsOnly: false, label: '', line: first + alone[0].line - 1 };
//     } else if (alone.length > 1) {
//       problems.push({ field: 'barcode', message: `The page prints more than one value that could be its barcode (${alone.map((c) => c.value).join(', ')}) - type the right one in the Barcode box` });
//     }
//   }
//   const totals = movementTotals(movements, printedTotals);
//   if (totals.mismatches.length) {
//     warnings.push(`The movements add up to ${totals.mismatches.map((k) => `${k} ${totals.computed[k]}`).join(', ')}, but the page's totals say ${totals.mismatches.map((k) => `${k} ${printedTotals[k]}`).join(', ')}`);
//   }
//   /* the quantity the barcode was received with: the receipt that brought it
//      in - its first GRC receipt, else its first receipt of any kind. Never
//      the receipts added up: a piece sent out and returned is received twice
//      and is still one piece */
//   const grcReceipt = movements.find((m) => m.docType === 'GRC' && m.receipts > 0);
//   const firstReceipt = grcReceipt || movements.find((m) => m.receipts > 0);
//   let receivedQty = firstReceipt ? firstReceipt.receipts : 0;
//   let qtyFrom = firstReceipt ? 'details_receipt' : '';
//   if (firstReceipt && !grcReceipt) {
//     warnings.push(`No GRC receipt among the movements - the quantity (${receivedQty}) is the first receipt's (${[firstReceipt.docType, firstReceipt.docNo].filter(Boolean).join(' ') || 'the first movement'})`);
//   }
//   if (!firstReceipt) {
//     const held = stock.reduce((a, s) => a + s.qty, 0);
//     const printedIn = Math.abs(Number(printedTotals?.receipts) || 0);
//     if (!movements.length && printedIn > 0 && !(Math.abs(Number(printedTotals?.issues) || 0) > 0)) {
//       /* the rows could not be read but the TOTAL row could - and with
//          nothing issued it cannot hold a return received again */
//       receivedQty = printedIn;
//       qtyFrom = 'details_receipt';
//       warnings.push(`The movement rows could not be read - the quantity (${printedIn}) is the page's TOTAL receipts`);
//     } else if (held > 0) {
//       receivedQty = held;
//       qtyFrom = 'details_stock';
//       warnings.push(`No receipt among the movements - the quantity (${held}) is the stock the page shows`);
//     } else if (printedTotals && !movements.length) {
//       warnings.push('The movement rows could not be read, so the quantity received is not known - copy the page again (its movement table with its tabs)');
//     }
//   }
//   /* the GRC it came in on: the one the page names - one GRC number, else it
//      is not used - otherwise its GRC receipt's */
//   const grcFromMoves = grcReceipt?.docNo || '';
//   let grcNamed = cell(found.grcNo).replace(/^GRC\s*/i, '');
//   if (grcNamed && !/^[A-Za-z0-9/-]{1,20}$/.test(grcNamed)) {
//     warnings.push(`The page's GRC No reads "${grcNamed.slice(0, 40)}" - not one GRC number, so ${grcFromMoves ? `its GRC receipt's ${grcFromMoves} was used` : 'it was not used'}`);
//     grcNamed = '';
//   }
//   if (grcNamed && grcFromMoves && !sameGrc(grcNamed, grcFromMoves)) {
//     warnings.push(`The page names GRC ${grcNamed} but its GRC receipt is ${grcFromMoves} - GRC ${grcNamed} was used`);
//   }
//   const supplier = splitSupplier(found.supplier);

//   const values = normaliseRecord({
//     barcode: code,
//     itemCode: found.itemCode || found.itemName,
//     description: found.description || '',
//     qty: receivedQty ? String(receivedQty) : '',
//     uom: found.uom || '',
//     hsn: found.hsn,
//     purRate: found.purRate,
//     finalNet: found.finalNet,
//     gst: gstPercent(found.gstSlab) ?? '',
//     retailPrice: found.rsp,
//     wspPrice: found.wsp,
//     dpPrice: found.dp,
//     grcNo: grcNamed || grcFromMoves,
//   });
//   /* where each value came from - shown in the preview */
//   const sources = {
//     barcode: printed ? 'details_label' : typed ? 'typed_barcode' : candidate ? 'detected_barcode' : '',
//     itemCode: values.itemCode ? 'details_label' : '',
//     qty: values.qty ? qtyFrom : '',
//     uom: values.uom ? 'details_label' : '',
//     retailPrice: values.retailPrice ? 'details_label' : '',
//   };
//   const details = {
//     itemName: cell(found.itemName || found.itemCode),
//     group: cell(found.group),
//     subGroup: cell(found.subGroup),
//     gstSlab: cell(found.gstSlab),
//     pma: cell(found.pma),
//     designNo: cell(found.designNo),
//     supplier: cell(found.supplier),
//     supplierCode: supplier.code,
//     taxRegion: cell(found.taxRegion),
//     discount: isNumber(numberText(found.discount)) ? String(num(found.discount)) : cell(found.discount),
//     wsp: values.wspPrice,
//     dp: values.dpPrice,
//     movements,
//     stock,
//     totals,
//     payload: lines.join('\n').slice(0, 20000),
//   };
//   /* per field, for the preview - a field that could not be read never fails
//      the whole paste */
//   if (!code) problems.push({ field: 'barcode', message: 'No barcode number - type it in the Barcode box, or copy the page with its BARCODE line' });
//   if (!details.itemName) problems.push({ field: 'itemName', message: 'No Item Name was found on this page' });
//   /* what the page could not settle about its barcode holds it back on the
//      server too (classifyRecords takes `review` as problems) */
//   const review = problems.filter((p) => p.field === 'barcode');
//   return {
//     record: {
//       line: first, values, details, problems, sources,
//       ...(review.length ? { review } : {}),
//       ...(candidate ? { candidate } : {}),
//     },
//     warnings,
//   };
// }

// /* Two GRC numbers are one when they say the same number: "05165", "5165"
//    and "GRC 05165" are one GRC. */
// export function sameGrc(a, b) {
//   const x = cell(a).replace(/^GRC\s*(no\.?|number)?\s*:?\s*/i, '');
//   const y = cell(b).replace(/^GRC\s*(no\.?|number)?\s*:?\s*/i, '');
//   if (!x || !y) return false;
//   if (/^\d+$/.test(x) && /^\d+$/.test(y)) return Number(x) === Number(y);
//   return x.toLowerCase() === y.toLowerCase();
// }

// /* Pasted Details text (one barcode or several) -> { records, warnings,
//    error }. `barcode` is used for a single page that prints no number. */
// export function readDetailsPages(text, { barcode = '' } = {}) {
//   const { lines } = withoutFilters(normaliseLines(text));
//   const anchors = anchorsIn(lines);
//   if (!anchors.size) {
//     const missing = Object.values(ANCHOR_NAMES).join(', ');
//     return {
//       records: [], warnings: [],
//       error: 'No report headings were found. Copy the whole table from the Barcode Report - from the "Barcode" heading to the last row - or choose its Excel file.'
//         + ` (Found: none. Missing: ${missing}. First lines: ${lines.slice(0, 3).map((l) => `"${l.slice(0, 60)}"`).join(' | ') || '(nothing)'})`,
//     };
//   }
//   const blocks = blocksOf(lines);
//   const warnings = [];
//   const records = [];
//   let at = 1;
//   blocks.forEach((block, i) => {
//     const read = readDetailsBlock(block, { barcode: blocks.length === 1 ? barcode : '', line: at });
//     at += block.length;
//     const label = blocks.length > 1 ? `Barcode ${i + 1}: ` : '';
//     read.warnings.forEach((w) => warnings.push(label + w));
//     records.push({ ...read.record, line: i + 1 });
//   });
//   /* which parts of the page were there - said only when a page's item could
//      not be read, where it explains why */
//   const missing = ['barcode', 'itemInfo', 'priceInfo', 'supplierDetails', 'movements'].filter((k) => !anchors.has(k));
//   if (missing.length && records.some((r) => r.problems.some((p) => p.field === 'itemName'))) {
//     warnings.push(`Found: ${[...anchors].map((k) => ANCHOR_NAMES[k]).join(', ')}. Missing: ${missing.map((k) => ANCHOR_NAMES[k]).join(', ')}`);
//   }
//   return { records, warnings, error: '' };
// }

// /* The first page of readDetailsPages, as { record, warnings, error }. */
// export function readDetailsText(text, { barcode = '' } = {}) {
//   const read = readDetailsPages(text, { barcode });
//   const record = read.records[0] || null;
//   if (!record) return { record: null, warnings: read.warnings, error: read.error };
//   const noCode = record.problems.find((p) => p.field === 'barcode');
//   return { record, warnings: read.warnings, error: noCode ? 'Type the barcode number in the Barcode box - this Details page does not print one.' : '' };
// }

// /* ------------------------------------ the barcode, and nothing else ------ */

// /* the printed name of a Details label, for saying what a value is */
// const DETAIL_NAMES = {
//   barcode: 'Barcode', itemName: 'Item Name', itemCode: 'Item Code', subGroup: 'Sub Group', group: 'Group', hsn: 'HSN',
//   gstSlab: 'GST Slab', pma: 'P-M-F', purRate: 'Purchase Rate', discount: 'Discount', finalNet: 'Final Rate', rsp: 'RSP',
//   wsp: 'WSP', dp: 'DP', designNo: 'Design No', supplier: 'Supplier', taxRegion: 'Tax Region', uom: 'UOM',
//   description: 'Description', grcNo: 'GRC No',
// };
// /* what a labelled value is, when its label is not the barcode's */
// const VALUE_KINDS = {
//   hsn: 'an HSN code', grcNo: 'a GRC number', gstSlab: 'a GST slab', gst: 'a GST rate', uom: 'a unit', qty: 'a quantity',
//   purRate: 'a price', finalNet: 'a price', rsp: 'a price', wsp: 'a price', dp: 'a price', discount: 'a discount',
//   retailPrice: 'a price', offerPrice: 'a price', wspPrice: 'a price', dpPrice: 'a price',
//   itemName: 'an item', itemCode: 'an item', description: 'a description', supplier: 'a supplier', designNo: 'a design',
//   taxRegion: 'a tax region', pma: 'a P-M-F', group: 'a group', subGroup: 'a sub group',
// };
// /* a code - letters and digits, one token ("TWN0LPID") - that may be the
//    other part of a value OCR split across lines */
// const CODE_LIKE = /^(?=.*[A-Za-z])[A-Za-z0-9]{4,}$/;
// /* any label a page prints, known here or not ("ECom ID:", "Purchase
//    Invoice :", "Is Consignment:"): up to five words, no digits, a colon */
// const ANY_LABEL = /^([A-Za-z][A-Za-z .()/&'-]{0,40}?)\s*:\s*(.*)$/;
// const labelOfCell = (text) => {
//   const m = String(text ?? '').match(ANY_LABEL);
//   if (!m || cell(m[1]).split(' ').length > 5) return null;
//   return { label: cell(m[1]), value: cell(m[2]) };
// };
// /* the label pairs of one cell - "HSN: 55151130 GST Slab: GST 5 %" is two -
//    or null when the cell does not start with a label */
// function pairsIn(text) {
//   const t = cell(text);
//   if (!labelOfCell(t)) return null;
//   const cuts = [0, ...[...t.matchAll(COLON_LABELS)].map((m) => m.index).filter((i) => i > 0)];
//   return cuts.map((from, i) => labelOfCell(t.slice(from, cuts[i + 1] ?? t.length))).filter(Boolean);
// }
// const labelKey = (label) => keyOfLabel(label) || FIELD_BY_ALIAS.get(squash(label)) || '';

// /* What a value on its own is, when it is not shaped like a barcode */
// function notABarcode(text) {
//   const t = cell(text);
//   if (/^[-+]?[\d,]*\.\d+%?$/.test(t) || /^[₹$]/.test(t)) return 'an amount, not a barcode';
//   if (DATE_RE.test(t)) return 'a date, not a barcode';
//   if (/^\d{1,2}[:.]\d{2}/.test(t)) return 'a time, not a barcode';
//   if (/^[-/_.]|[-/_.]$/.test(t)) return 'a piece of a longer value, not a barcode';
//   if (/[-/]/.test(t)) return `not a barcode on its own ("${t.match(/[-/]/)[0]}" in it) - a barcode is never cut out of a longer value`;
//   return 'not shaped like a barcode';
// }

// /* THE BARCODE, AND NOTHING ELSE, of what an image (or a text) shows.

//    A screenshot of an item's Details page prints dozens of values - an ECom
//    ID, a GRC No, an HSN, prices, a quantity, the movements - and at most one
//    of them is the barcode. Only these are ever offered as one:
//      label       the value of a label that names the barcode ("Barcode :")
//      standalone  a value printed on its own, with no label - the number under
//                  a barcode's bars, a sticker's number
//      typed       the number the operator typed in the Barcode box
//    Anything under another label is that label's value, whatever it looks
//    like: "ECom ID: 9A1136-TWN0LPID" is an ECom ID, never cut down to
//    "9A1136"; "GRC No: 05165" a GRC number; "RSP: 1590" a price. And nothing
//    is taken for a barcode by its look alone - a standalone value is only
//    OFFERED; the server takes it when it is in this ERP's barcode format
//    (a Barcode Setting series, a composed value) or this ERP holds it
//    (classifyRecords). The Filters panel and the movement table are skipped.

//    `lines` - OCR's [{ cells: [{ text, confidence }] }] (confidence 0-100),
//    or a text's lines. A value OCR was less sure of than `minConfidence` is
//    never offered: OCR can misread one barcode as another that also exists.
//    `textInput` - a pasted page, which takes its barcode from its BARCODE line
//    or the Barcode box only: a standalone value is reported, not offered.

//    Returns { candidates: [{ value, source, line, label, confidence,
//    digitsOnly }], rejected: [{ value, reason, line }], itemName, grcNo -
//    what the page names, to compare with the barcode's unit - details (it is
//    an item-details page), skipped: { filters, movements } }. */
// export function detectBarcodes(lines, { typed = '', minConfidence = 0, textInput = false } = {}) {
//   const num = (v) => (v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
//   const rows = (lines || []).map((l, i) => {
//     const raw = Array.isArray(l?.cells) ? l.cells : cellsOf(typeof l === 'string' ? l : l?.text).map((text) => ({ text }));
//     return {
//       at: i + 1,
//       cells: raw.map((c) => {
//         const o = c && typeof c === 'object' ? c : { text: c };
//         return {
//           text: cell(o.text), confidence: num(o.confidence), x0: num(o.x0), x1: num(o.x1), h: num(o.h) || null,
//           words: Array.isArray(o.words) ? o.words.map((w) => ({ text: String(w?.text ?? ''), confidence: num(w?.confidence) })) : null,
//         };
//       }).filter((c) => c.text !== ''),
//     };
//   }).filter((r) => r.cells.length);
//   const lineText = (r) => r.cells.map((c) => c.text).join('\t');
//   /* where each cell stands, when OCR says (a pasted text has no geometry) */
//   const geo = !textInput && rows.some((r) => r.cells.some((c) => c.x0 !== null && c.x1 !== null && c.h));

//   /* the Filters panel (from a "Filters" line to where the Details start) and
//      the movement table's rows are not looked at */
//   const skip = new Set();
//   const skipped = { filters: 0, movements: 0 };
//   const filtersAt = rows.findIndex((r) => /^filters?\s*:?$/i.test(lineText(r)));
//   if (filtersAt >= 0) {
//     const detailsAt = rows.findIndex((r, i) => i > filtersAt && startsDetails(lineText(r)));
//     if (detailsAt > 0) for (let i = filtersAt; i < detailsAt; i += 1) { skip.add(i); skipped.filters += 1; }
//   }
//   let details = false;
//   let inMoves = false;
//   rows.forEach((r, i) => {
//     const text = lineText(r);
//     if (movementHeader(text)) { inMoves = true; details = true; skip.add(i); return; }
//     if (inMoves && (DATE_RE.test(text) || /^(grand\s*)?totals?\b/i.test(text))) { skip.add(i); skipped.movements += 1; return; }
//     inMoves = false;
//     if (!skip.has(i) && (DETAILS_START.test(text) || new RegExp(BAND_RE.source, 'i').test(text) || /^item\s*name\b/i.test(text))) details = true;
//   });

//   const candidates = [];
//   const rejected = [];
//   const found = { itemName: '', grcNo: '' };
//   const reject = (value, reason, line) => { if (rejected.length < 100) rejected.push({ value: cell(value).slice(0, 80), reason, line }); };
//   const unsure = (confidence) => confidence !== null && minConfidence && confidence < minConfidence;

//   /* a labelled value: the Barcode label's is a barcode candidate (when it
//      looks like one), any other label's is that label's - and says so */
//   const labelled = (label, value, line, confidence) => {
//     const key = labelKey(label);
//     if (key === 'itemName' && !found.itemName) found.itemName = value;
//     if (key === 'grcNo' && !found.grcNo) found.grcNo = value;
//     if (keyOfLabel(label) === 'barcode') {
//       const v = closeSeparators(value);
//       if (!barcodeShaped(v, { loose: !geo })) reject(value, `the "${label}" value is not a barcode number`, line);
//       else if (unsure(confidence)) reject(v, `OCR is not sure it read this right (${Math.round(confidence)}% sure) - if it is the barcode, type it in the Barcode box`, line);
//       else candidates.push({ value: v, source: 'label', line, label, confidence });
//       return;
//     }
//     if (/\d/.test(value)) reject(value, `the "${label}" value${VALUE_KINDS[key] ? ` - ${VALUE_KINDS[key]}` : ''}, not a barcode`, line);
//   };

//   /* 1. every cell: a label with its value in it, a label with none (its
//      value is beside it or under it), or a free cell */
//   const bare = [];            // [{ label, row, ci, cell }]
//   const coded = [];           // labels holding a code-like value: [{ label, row, cell }]
//   const free = [];            // [{ row, ci, cell }]
//   rows.forEach((r, i) => {
//     if (skip.has(i)) return;
//     r.cells.forEach((c, ci) => {
//       const pairs = pairsIn(c.text);
//       if (pairs) {
//         pairs.forEach((p, pi) => {
//           if (p.value === '') { if (pi === pairs.length - 1) bare.push({ label: p.label, row: i, ci, cell: c }); return; }
//           if (hasValue(p.value)) labelled(p.label, p.value, r.at, c.confidence);
//           /* "ECom ID: TWN0LPID" - a code whose first part may have wrapped
//              onto the line above or below it */
//           if (CODE_LIKE.test(p.value)) coded.push({ label: p.label, row: i, cell: c });
//         });
//         return;
//       }
//       const known = labelIn(c.text);
//       if (known) {
//         if (known.value === null) return;
//         const label = DETAIL_NAMES[known.key] || known.key;
//         if (known.value === '') bare.push({ label, row: i, ci, cell: c });
//         else labelled(label, known.value, r.at, c.confidence);
//         return;
//       }
//       free.push({ row: i, ci, cell: c });
//     });
//   });

//   /* 2. whose value each free cell is. A label with nothing after it takes
//      only the value it stands with:
//        the next cell on its own row - and, when OCR gives positions, only a
//          close one (the number far off under a barcode's bars is not "Is
//          Consignment:"'s value)
//        the cell under it on the next row (by position when OCR gives it; for
//          a pasted text, the next line when the label stood alone on its own)
//        for OCR, a value wrapped around it: above AND below it, in its value
//          column ("9A1136-" / "ECom ID:" / "TWN0LPID") */
//   const claimed = new Map();  // free index -> label
//   const near = (a, b, k) => a !== null && b !== null && Math.abs(a - b) <= k;
//   const claim = (fi, label) => { if (!claimed.has(fi)) claimed.set(fi, label); };
//   const indexed = free.map((f, k) => ({ f, k }));
//   bare.forEach((b) => {
//     const h = b.cell.h || 14;
//     /* same row, right after it */
//     const fi = free.findIndex((f) => f.row === b.row && f.ci === b.ci + 1);
//     if (fi >= 0 && (!geo || (free[fi].cell.x0 - b.cell.x1) <= 6 * h)) { claim(fi, b.label); return; }
//     const under = indexed.filter(({ f }) => f.row === b.row + 1);
//     if (geo) {
//       /* a code wrapped around it - one part above, the rest below, in the
//          column right of the label ("9A1136" / "ECom ID:" / "TWN0LPID") */
//       const inColumn = (f) => f.cell.x0 >= b.cell.x1 - 2 * h && f.cell.x0 - b.cell.x1 <= 8 * h;
//       const above = indexed.filter(({ f }) => f.row === b.row - 1 && inColumn(f));
//       const below = indexed.filter(({ f }) => (f.row === b.row + 1 || f.row === b.row) && inColumn(f) && CODE_LIKE.test(f.cell.text));
//       let wrapped = false;
//       above.forEach((a) => {
//         const rest = below.filter((w) => w.k !== a.k && near(w.f.cell.x0, a.f.cell.x0, 3 * h));
//         if (!rest.length) return;
//         wrapped = true;
//         claim(a.k, b.label);
//         rest.forEach((w) => claim(w.k, b.label));
//       });
//       if (wrapped) return;
//       /* the value under it */
//       const hit = under.filter(({ f }) => f.cell.x1 >= b.cell.x0 - 2 * h && f.cell.x0 <= b.cell.x1 + 2 * h);
//       if (hit.length) claim(hit.sort((a, c) => Math.abs(a.f.cell.x0 - b.cell.x0) - Math.abs(c.f.cell.x0 - b.cell.x0))[0].k, b.label);
//       return;
//     }
//     const single = (i) => i >= 0 && i < rows.length && !skip.has(i) && rows[i].cells.length === 1;
//     /* OCR text without positions (edited with Edit as text): the same wrap,
//        each part on a line of its own */
//     if (!textInput && single(b.row) && single(b.row - 1) && single(b.row + 1)) {
//       const a = indexed.find(({ f }) => f.row === b.row - 1);
//       const w = indexed.find(({ f }) => f.row === b.row + 1);
//       if (a && w && CODE_LIKE.test(w.f.cell.text)) { claim(a.k, b.label); claim(w.k, b.label); return; }
//     }
//     /* a label alone on its line: its value is the next line */
//     if (single(b.row) && under.length) claim(under.sort((a, c) => a.f.ci - c.f.ci)[0].k, b.label);
//   });
//   /* OCR puts a wrapped code's other half on the label's own line ("ECom ID:
//      TWN0LPID" under "9A1136"): a value on its own right above or below such
//      a label, within its span, is part of that label's value */
//   if (geo) {
//     coded.forEach((p) => {
//       const h = p.cell.h || 14;
//       free.forEach((f, k) => {
//         if (claimed.has(k) || Math.abs(f.row - p.row) !== 1) return;
//         if (f.cell.x0 >= p.cell.x0 && f.cell.x0 <= p.cell.x1 + 2 * h) claim(k, p.label);
//       });
//     });
//   }
//   /* OCR can lose a label's colon ("ECom ID  9A1136 TWN0LPID"): a cell of
//      words only, right beside a value on its row, is that value's label */
//   if (geo) {
//     free.forEach((f, k) => {
//       if (claimed.has(k) || f.ci === 0) return;
//       const before = rows[f.row].cells[f.ci - 1];
//       const h = before.h || 14;
//       if (/^[\p{L}][\p{L} .()/&'-]{0,40}$/u.test(before.text) && before.text.split(' ').length <= 4 && before.x1 !== null && f.cell.x0 - before.x1 <= 3 * h
//         && free.some((g) => g.row === f.row && g.ci === f.ci - 1)) claim(k, before.text);
//     });
//   }

//   /* 3. the free cells: a label's value is that label's; one left on its own
//      is a barcode candidate when every token of it looks like one */
//   free.forEach((f, k) => {
//     const line = rows[f.row].at;
//     if (claimed.has(k)) { labelled(claimed.get(k), f.cell.text, line, f.cell.confidence); return; }
//     /* its tokens, each with the confidence of its own words ("G1318 * 05178
//        * 1 * 1" is one token, and one unsure word beside it is not its) */
//     const tokens = f.cell.words && f.cell.words.length ? wordTokens(f.cell.words) : closeSeparators(f.cell.text).split(' ').filter(Boolean).map((text) => ({ text, confidence: f.cell.confidence }));
//     const shaped = tokens.filter((t) => barcodeShaped(t.text));
//     if (!shaped.length) {
//       if (tokens.length === 1 && /\d/.test(f.cell.text)) reject(f.cell.text, notABarcode(f.cell.text), line);
//       return;
//     }
//     if (shaped.length !== tokens.length) { reject(f.cell.text, 'inside a longer text - not a barcode on its own', line); return; }
//     const alone = rows[f.row].cells.length === 1;
//     shaped.forEach((t) => {
//       const digitsOnly = /^\d+$/.test(t.text);
//       if (unsure(t.confidence)) reject(t.text, `OCR is not sure it read this right (${Math.round(t.confidence)}% sure) - if it is the barcode, type it in the Barcode box`, line);
//       else if (digitsOnly && details) reject(t.text, 'a number with no label on an item-details page - if it is the barcode, type it in the Barcode box', line);
//       else if (digitsOnly && (!alone || t.text.length < 5)) reject(t.text, alone ? 'a short number, not a barcode' : 'a number among other values on its line - if it is the barcode, type it in the Barcode box', line);
//       else candidates.push({ value: t.text, source: 'standalone', line, label: '', confidence: t.confidence, digitsOnly });
//     });
//   });

//   /* the typed number first, then the page's own, then values on their own -
//      and each value once */
//   const kept = [...candidates];
//   const t = closeSeparators(typed);
//   if (t) {
//     if (barcodeShaped(t, { loose: true })) kept.unshift({ value: t, source: 'typed', line: 0, label: '', confidence: null });
//     else reject(t, 'the number typed in the Barcode box is not a barcode number', 0);
//   }
//   const order = { typed: 0, label: 1, standalone: 2 };
//   const seen = new Set();
//   const offered = kept.sort((a, b) => order[a.source] - order[b.source] || a.line - b.line)
//     .filter((c) => (seen.has(barcodeKey(c.value)) ? false : seen.add(barcodeKey(c.value))));
//   return { candidates: offered, rejected, itemName: found.itemName, grcNo: found.grcNo, details, skipped };
// }

// /* OCR's words of one cell -> its tokens as a barcode is written: words
//    joined by "*" are one composed value ("G1318" "*" "05178" -> G1318*05178),
//    each token as sure as its least sure word */
// function wordTokens(words) {
//   const out = [];
//   words.forEach((w) => {
//     const text = String(w.text ?? '').trim();
//     if (!text) return;
//     const last = out[out.length - 1];
//     if (last && (last.text.endsWith('*') || text.startsWith('*'))) {
//       last.text += text;
//       last.confidence = last.confidence === null || w.confidence === null ? (last.confidence ?? w.confidence) : Math.min(last.confidence, w.confidence);
//     } else out.push({ text, confidence: w.confidence });
//   });
//   return out;
// }

// /* the sources of a report table's row: every value is from its column */
// const COLUMN_SOURCES = { barcode: 'import_column', itemCode: 'import_column', qty: 'import_column', uom: 'import_column', retailPrice: 'import_column' };
// export const ORIGINS = ['text', 'image', 'ocr'];

// /* A report table's heading row that OCR misread ("BARCODE ITEM CODE" run
//    together): three or more cells that are the report's headings - two of
//    them its Item Code / Qty / UOM, not just prices (a Details page can print
//    "RSP | WSP | DP" over its values) - with a row of data under it. */
// const looksLikeReportTable = (lines) => lines.some((line, i) => {
//   if (movementHeader(line) || /:/.test(line)) return false;
//   const fields = cellsOf(line).map((c) => FIELD_BY_ALIAS.get(squash(c))).filter(Boolean);
//   const next = lines.slice(i + 1).find((l) => cell(l) !== '');
//   return fields.length >= 3 && fields.filter((f) => ['itemCode', 'qty', 'uom'].includes(f)).length >= 2
//     && Boolean(next) && cellsOf(next).filter((c) => c !== '').length >= 3;
// });

// /* What was pasted (or read from an image), whichever it is:
//      table    the report TABLE (a heading row with Barcode) - its rows, every
//               value from its column (import_column)
//      details  one barcode's Details page(s), pasted as TEXT - read by label
//      lookup   an IMAGE that is not a report table (a Details page, a sticker):
//               only its barcode is taken, to be looked up in this ERP - no
//               Qty, UOM, price or item is ever read from it
//      none     such an image with no barcode on it
//    `origin` - 'text' (pasted / Excel), 'image' (OCR of a screenshot) or 'ocr'
//    (OCR text the operator corrected with Edit as text): an image's rules
//    stay with its text. `lines` - OCR's lines with each cell's confidence.
//    Returns { kind, origin, records, columns, unmapped, ignored, left,
//    warnings, detection, error }. */
// export function readImport(text, { barcode = '', origin = 'text', lines = null, minConfidence = 0 } = {}) {
//   const from = ORIGINS.includes(origin) ? origin : 'text';
//   const trimmed = String(text ?? '').replace(/ /g, ' ').replace(/\r\n?/g, '\n').trim();
//   if (!trimmed) return { kind: '', origin: from, ...readTable([]), warnings: [], detection: null, error: 'Paste the Barcode Report table - or one barcode\'s Details page - first.' };
//   if (trimmed.includes('\t')) {
//     const table = readTable(splitTable(trimmed));
//     if (!/^No report headings/.test(table.error)) {
//       return {
//         kind: 'table', origin: from, ...table,
//         records: table.records.map((r) => ({ ...r, origin: from, sources: COLUMN_SOURCES })),
//         warnings: [],
//         detection: {
//           candidates: table.records.map((r) => ({ value: r.values.barcode, source: 'column', line: r.line, label: 'Barcode', confidence: null })),
//           rejected: (table.left || []).map((l) => ({ value: l.text, reason: l.reason, line: l.line })),
//           itemName: '', grcNo: '', details: false, skipped: { filters: 0, movements: 0 },
//         },
//       };
//     }
//   }
//   if (from !== 'text') {
//     const plain = normaliseLines(trimmed);
//     if (looksLikeReportTable(plain)) {
//       return {
//         kind: '', origin: from, ...readTable([]), warnings: [], detection: null,
//         error: 'The report table\'s headings could not all be read (no "Barcode" heading was found) - compare the image with View Extracted Text and correct the headings with Edit as text, or paste the report\'s text instead.',
//       };
//     }
//     const detection = detectBarcodes(from === 'image' && Array.isArray(lines) && lines.length ? lines : plain, {
//       typed: barcode, minConfidence: from === 'image' ? minConfidence : 0,
//     });
//     const records = detection.candidates.map((c, i) => ({
//       line: i + 1,
//       lookupOnly: true,
//       origin: from,
//       values: { barcode: c.value },
//       candidate: { source: c.source, confidence: c.confidence, digitsOnly: Boolean(c.digitsOnly), label: c.label || '', line: c.line },
//       crossCheck: { itemName: detection.itemName, grcNo: detection.grcNo },
//     }));
//     return {
//       kind: records.length ? 'lookup' : 'none', origin: from, records, columns: [], unmapped: [], missing: [], ignored: 0, left: [],
//       warnings: [], detection, error: '',
//     };
//   }
//   const pages = readDetailsPages(trimmed, { barcode });
//   if (pages.error) return { kind: '', origin: from, ...readTable([]), warnings: [], detection: null, error: pages.error };
//   const single = pages.records.length === 1 ? pages.records[0] : null;
//   return {
//     kind: 'details',
//     origin: from,
//     records: pages.records.map((r) => ({ ...r, origin: from })),
//     columns: [], unmapped: [], ignored: 0, left: [],
//     warnings: pages.warnings,
//     /* what the page offered as its barcode, and what it did not - shown */
//     detection: detectBarcodes(normaliseLines(trimmed), { typed: barcode, textInput: true }),
//     error: single && !single.values.barcode ? 'Type the barcode number in the Barcode box - this Details page does not print one.' : '',
//   };
// }

// /* The balance a Details record leaves in stock, and where: the summary's
//    locations with something in them, else the movements' own balance at the
//    location of their last row. */
// export function stockLeft(details) {
//   const held = (details?.stock || []).filter((s) => s.qty > 0);
//   if (held.length) return held;
//   const balance = details?.totals?.computed?.balance || 0;
//   if (balance > 0 && details?.movements?.length) {
//     const last = details.movements[details.movements.length - 1];
//     return [{ location: last.location, stockPoint: last.stockPoint, qty: balance }];
//   }
//   return [];
// }

// /* ------------------------------------------------ against this ERP ------ */

// /* A stored barcode row in the import's terms - what our Barcode Report shows
//    for it (app/api/reports/barcode-report/route.js). */
// export function unitAsRecord(unit) {
//   const u = unit || {};
//   return normaliseRecord({
//     barcode: u.barcodeNo || u.barcodeGenerated || '',
//     itemCode: u.itemCode,
//     description: u.printDescription || u.supplierDescription || '',
//     qty: u.qty ?? u.qtyNum,
//     uom: u.uom,
//     hsn: u.hsn,
//     purRate: u.purRate,
//     finalNet: u.finalNet,
//     gst: u.gst,
//     retailPrice: u.retailPrice,
//     offerPrice: u.offerPrice,
//     wspPrice: u.wspPrice,
//     dpPrice: u.dpPrice,
//     grcNo: u.grcNo,
//   });
// }

// const same = (a, b) => {
//   const x = cell(a);
//   const y = cell(b);
//   if (x === y) return true;
//   return isNumber(x) && isNumber(y) && Number(x) === Number(y);
// };

// /* What an imported row would change on the barcode this ERP already holds -
//    [{ field, label, local, incoming, updatable, kind }]: kind 'fill' (the
//    saved value is blank), 'replace' (it would overwrite a saved value) or
//    'info' (item, quantity, UOM - shown, never changed by an import). A blank
//    imported cell is "not given", never "clear it". */
// export function differences(values, unit) {
//   const local = unitAsRecord(unit);
//   return COMPARED_FIELDS
//     .filter((field) => cell(values?.[field]) !== '' && !same(values[field], local[field]))
//     .map((field) => {
//       const updatable = UPDATABLE_FIELDS.includes(field);
//       return {
//         field,
//         label: FIELD_LABELS[field],
//         local: local[field],
//         incoming: values[field],
//         updatable,
//         kind: !updatable ? 'info' : cell(local[field]) === '' ? 'fill' : 'replace',
//       };
//     });
// }

// /* ------------------------------------------ what each row becomes ------ */

// /* lib/barcodeLabel.js BARCODE_STATUS.IN_STOCK - spelled out, because that
//    module is the database model and this one runs in the browser too */
// const IN_STOCK = 'IN_STOCK';
// const HISTORY = 'HISTORY';
// const STATUS_WORDS = { SOLD: 'sold', IN_TRANSIT: 'in transit', RETURN_IN_TRANSIT: 'being returned', VOID: 'written off' };

// /* Every imported row, checked again, then against what this ERP holds:
//      new       not held - READY TO IMPORT: seeded as a unit of stock
//      same      held, nothing differs - EXISTING, NO CHANGES
//      changed   held, something differs - EXISTING, CHANGES FOUND. Each
//                difference is a blank it fills (kind 'fill'), history it adds
//                ('append'), a saved value it would REPLACE ('replace') or one
//                an import never changes ('info': item, quantity, UOM). Only
//                the ones the operator approves are written (updateFor).
//      locked    held, but sold / moved on - an import cannot change it
//      invalid   cannot be imported - the real reason
//      lookup    a barcode read from an IMAGE (lookupOnly): looked up and shown
//                with THIS ERP's values - never written (lookupRow)
//      rejected  a value an image offered that is not a barcode of this ERP

//    A number of this ERP's own Barcode Setting series is imported like any
//    other (user, 2026-09-30): pasting a barcode's report is an explicit seed
//    of a barcode that exists. The series protects Barcode GENERATION, and
//    still does: applyImport lifts the series' counter past a number it seeds
//    (lib/barcodeEngine.js raiseBarcodeFloor), so Generation never issues it
//    again - and a number held here is compared, never inserted a second time.

//    `units` - the barcode rows answering to any number (barcodeNo,
//    barcodeGenerated or oldBarcode) of this business or here now;
//    `elsewhere` - those held only by another business; `businessId`;
//    `formats` - Barcode Setting prefixes / suffixes / widths; `itemCodes` -
//    the imported item codes its Item master holds; `items` - those Items by
//    normalised code / name; `itemNames`, `locationNames`, `supplierNames`,
//    `businessNames` - names by _id, for what the preview shows. Pure: the
//    route reads those and calls this, inside the transaction when it imports. */
// export function classifyRecords(records, {
//   units = [], formats = [], itemCodes = new Set(), businessId = '', itemNames = new Map(), locationNames = new Map(),
//   supplierNames = new Map(), businessNames = new Map(), elsewhere = [], items = new Map(),
// } = {}) {
//   /* every unit behind each number - a number can have more than one - the
//      unit whose own number it is first, then whose composed value, then
//      whose old barcode (lib/inventory.js unitFor's order) */
//   const byKey = (list) => {
//     const map = new Map();
//     list.forEach((u) => {
//       [...new Set([u.barcodeNo, u.barcodeGenerated, u.oldBarcode].map((v) => barcodeKey(v)).filter(Boolean))].forEach((key) => {
//         if (!map.has(key)) map.set(key, []);
//         map.get(key).push(u);
//       });
//     });
//     return map;
//   };
//   const unitsByKey = byKey(units);
//   const elsewhereByKey = byKey(elsewhere);
//   const rank = (u, key) => { const r = [u.barcodeNo, u.barcodeGenerated, u.oldBarcode].findIndex((v) => sameBarcode(v, key)); return r < 0 ? 3 : r; };
//   const unitsFor = (key, keep = () => true, map = unitsByKey) => (map.get(key) || []).filter(keep).sort((a, b) => rank(a, key) - rank(b, key));
//   /* this business's units, and units of another business that are here now */
//   const ours = (u) => !businessId || String(u.businessId || '') === String(businessId) || String(u.currentBusinessId || '') === String(businessId);
//   const context = { formats, itemNames, locationNames };

//   const seen = new Set();
//   const rows = (records || []).map((record, index) => {
//     if (record?.lookupOnly) return lookupRow(record, index, unitsFor, context);
//     const values = normaliseRecord(record?.values || record);
//     /* a Details-page record's history, and the masters the server found for
//        it (links) - see readDetailsText and resolveRecords */
//     const details = record?.details ? normaliseDetails(record.details) : null;
//     const links = record?.links || null;
//     let key = barcodeKey(values.barcode);
//     const line = Number(record?.line) || index + 1;
//     /* rows read from an image (or its OCR text): what they show is only ever
//        compared with what this ERP holds, never written over it */
//     const fromImage = record?.origin === 'image' || record?.origin === 'ocr';
//     const warnings = [...(record?.warnings || [])];
//     const out = {
//       line, barcode: values.barcode, key, values, itemInMaster: itemCodes.has(values.itemCode),
//       ...(fromImage ? { origin: record.origin } : {}),
//       ...(record?.sources ? { sources: cleanSources(record.sources) } : {}),
//       ...(details ? { details, links, unmatched: record?.unmatched || [], warnings } : {}),
//     };
//     /* the units this row is: the number as given, else as printed (capitals) */
//     let here = key ? unitsFor(key, ours) : [];
//     if (!here.length && key && key !== key.toUpperCase() && unitsFor(key.toUpperCase(), ours).length) {
//       key = key.toUpperCase();
//       here = unitsFor(key, ours);
//     }
//     /* a value OCR read with little confidence, flagged in the browser
//        (lib/barcodeReportOcr.js), and what the reader could not settle (a
//        page printing one barcode with another typed) - a flag can only hold
//        a row back, never let one through, so it is safe to take */
//     const review = (Array.isArray(record?.review) ? record.review : []).slice(0, 5)
//       .map((r) => ({ field: String(r?.field || 'barcode').slice(0, 20), message: String(r?.message || 'Needs review').slice(0, 300) }));
//     const problems = [...checkFields(values), ...review];
//     /* this ERP prints its series in capitals: "9a2890" is refused rather
//        than stored as a second spelling of 9A2890 */
//     if (!here.length && inLocalSeries(values.barcode, formats, { ignoreCase: true }) && !inLocalSeries(values.barcode, formats)) {
//       problems.unshift({ field: 'barcode', message: `Type the barcode as it is printed - ${values.barcode.toUpperCase()} (this ERP's barcode series is in capitals)` });
//     }
//     /* a barcode the pasted page printed on its own (not labelled, not
//        typed): only one this ERP could have printed, or one it holds */
//     if (record?.candidate?.source === 'standalone' && !here.some((u) => sameBarcode(u.barcodeNo, key) || sameBarcode(u.barcodeGenerated, key))) {
//       const why = acceptProblem(values.barcode, { source: 'standalone', digitsOnly: /^\d+$/.test(values.barcode) }, formats);
//       if (why) problems.unshift({ field: 'barcode', message: `The page does not label its barcode, and "${values.barcode}" printed on its own is ${why} - type the barcode in the Barcode box` });
//     }
//     /* where the source still holds its stock only matters for a unit being
//        created; a unit already here stays where the ledger says */
//     const placement = (links?.problems || []).filter((p) => p.field === 'location');
//     problems.push(...(links?.problems || []).filter((p) => p.field !== 'location'));
//     if (!here.length) problems.push(...placement);
//     else placement.forEach((p) => warnings.push(`${p.message} - the unit already here was left where it is`));
//     if (problems.length) {
//       return { ...out, status: 'invalid', reason: problems.map((p) => p.message).join('; '), errors: problems.map((p) => ({ row: line, ...p })) };
//     }
//     if (seen.has(key)) return { ...out, status: 'invalid', reason: 'This barcode is in the import twice', errors: [{ row: line, field: 'barcode', message: 'This barcode is in the import twice' }] };
//     seen.add(key);

//     if (!here.length) {
//       /* held by another business of this ERP: never inserted a second time */
//       const other = unitsFor(key, (u) => !ours(u), elsewhereByKey);
//       if (other.length) {
//         const who = businessNames.get?.(String(other[0].businessId || '')) || 'another business';
//         const message = `This barcode is already held by ${who} (${unitSummary(other[0], locationNames)}) - it is not imported a second time; import it from that business`;
//         return { ...out, status: 'invalid', reason: message, errors: [{ row: line, field: 'barcode', message }] };
//       }
//       const series = seriesOf(values.barcode, formats);
//       return {
//         ...out, status: 'new',
//         ...(series ? { seriesNote: `${values.barcode} is in this ERP's own barcode series (Barcode Setting ${series.prefix || series.suffix}) - importing it moves Barcode Generation past ${series.number}, so this number is never issued again` } : {}),
//       };
//     }
//     /* several units at the best match: which one this row is cannot be told */
//     const best = here.filter((u) => rank(u, key) === rank(here[0], key));
//     if (best.length > 1) {
//       const message = `This barcode answers to ${best.length} units in this ERP (${best.slice(0, 3).map((u) => unitSummary(u, locationNames)).join('; ')}) - it cannot tell which one this row is`;
//       return { ...out, status: 'invalid', reason: message, errors: [{ row: line, field: 'barcode', message }] };
//     }
//     const unit = here[0];
//     const diffs = [...differences(values, unit), ...(details ? detailDifferences(details, links, unit, supplierNames) : [])]
//       .map((d) => (fromImage && d.updatable ? { ...d, updatable: false, kind: 'info', fromImage: true } : d));
//     const held = {
//       ...out, unitId: String(unit._id), diffs,
//       identity: identityOf(values, details, unit, { itemNames, items }),
//       existing: existingOf(unit, { locationNames, supplierNames }),
//       ...(rank(unit, key) === 2 ? { oldOnly: true } : {}),
//       /* the source's own snapshot, re-written when its history is taken */
//       ...(details ? { snapshot: { sourceMovements: mergeMovements(unit.sourceMovements, details.movements, links), sourceStock: stockWithLinks(details.stock, links), sourceTotals: details.totals, sourcePayload: details.payload } } : {}),
//     };
//     if (!diffs.length) return { ...held, status: 'same' };
//     /* a unit kept only for its history (HISTORY) can take more of it - it is
//        not stock, so nothing moves; one sold or moved on cannot be changed */
//     if (unit.status && unit.status !== IN_STOCK && unit.status !== HISTORY) {
//       return { ...held, status: 'locked', reason: `Already here and ${STATUS_WORDS[unit.status] || unit.status} - an import cannot change it` };
//     }
//     /* GST Parse's rule: a value that only FILLS a blank is taken; one that
//        would replace a saved value waits for the operator (fillsOnly) */
//     const updatable = diffs.some((d) => d.updatable);
//     return {
//       ...held, status: 'changed', updatable,
//       fillsOnly: updatable && diffs.filter((d) => d.updatable).every((d) => d.kind === 'fill' || d.kind === 'append'),
//       replaces: diffs.filter((d) => d.updatable && d.kind === 'replace').length,
//       ...(fromImage ? { reason: 'Read from an image - its values are shown, never written over this ERP\'s' } : {}),
//     };
//   });
//   return oneRowPerUnit(rows);
// }

// /* the value sources a row may say it has - for the preview only; a source
//    never loosens a check */
// const SOURCE_NAMES = ['import_column', 'details_label', 'details_receipt', 'details_stock', 'typed_barcode', 'detected_barcode', 'existing_barcode_lookup', 'item_master'];
// function cleanSources(sources) {
//   const out = {};
//   ['barcode', 'itemCode', 'qty', 'uom', 'retailPrice'].forEach((k) => { if (SOURCE_NAMES.includes(sources?.[k])) out[k] = sources[k]; });
//   return out;
// }

// /* The Barcode Setting series a number belongs to, as printed:
//    { prefix, suffix, number } or null. */
// export function seriesOf(barcode, formats) {
//   const value = clean(barcode);
//   for (const f of formats || []) {
//     const prefix = String(f.prefix || '');
//     const suffix = String(f.suffix || '');
//     if (!value.startsWith(prefix) || !value.endsWith(suffix) || value.length <= prefix.length + suffix.length) continue;
//     const digits = value.slice(prefix.length, value.length - suffix.length);
//     if (/^\d+$/.test(digits)) return { prefix, suffix, number: Number(digits) };
//   }
//   return null;
// }

// /* What this ERP holds under a number, for the preview's EXISTING DATA. */
// function existingOf(unit, { locationNames, supplierNames }) {
//   const u = unit || {};
//   return {
//     barcode: cell(u.barcodeNo) || cell(u.barcodeGenerated) || cell(u.oldBarcode),
//     itemCode: cell(u.itemCode),
//     description: cell(u.printDescription) || cell(u.supplierDescription),
//     qty: cell(u.qty ?? u.qtyNum),
//     uom: cell(u.uom),
//     hsn: cell(u.hsn),
//     gst: cell(u.gst),
//     purRate: cell(u.purRate),
//     finalNet: cell(u.finalNet),
//     retailPrice: cell(u.retailPrice),
//     wspPrice: cell(u.wspPrice),
//     dpPrice: cell(u.dpPrice),
//     grcNo: cell(u.grcNo),
//     supplier: u.supplierId ? (supplierNames.get?.(String(u.supplierId)) || 'a supplier') : '',
//     location: locationNames.get?.(String(u.currentLocationId || '')) || '',
//     status: STATUS_TEXT[u.status] || cell(u.status).toLowerCase(),
//   };
// }

// /* Whether the pasted row and the unit this ERP holds under its number look
//    like one piece of goods: 'same', 'different' (with the reasons - a
//    different item, GRC or kind of unit) or 'unknown'. Only ever SHOWN and used
//    to hold back default ticks; the operator decides. */
// function identityOf(values, details, unit, { itemNames, items }) {
//   const own = new Set([unit.barcodeNo, unit.barcodeGenerated, unit.oldBarcode].map((v) => normName(barcodeKey(v))).filter(Boolean));
//   const unitSide = [unit.itemCode, unit.itemName, unit.itemId ? itemNames.get?.(String(unit.itemId)) : ''].map(normName).filter((n) => n && !own.has(n));
//   const item = items.get?.(normName(values.itemCode)) || items.get?.(normName(details?.itemName)) || null;
//   const recordSide = [values.itemCode, details?.itemName, item?.name, item?.itemCode].map(normName).filter(Boolean);
//   const reasons = [];
//   let itemSame = false;
//   if (item && unit.itemId && String(item._id) === String(unit.itemId)) itemSame = true;
//   else if (unitSide.length && recordSide.length) {
//     itemSame = unitSide.some((n) => recordSide.includes(n));
//     if (!itemSame) reasons.push(`the item here is ${cell(unit.itemCode) || cell(unit.itemName)}, the pasted page's is ${cell(values.itemCode) || cell(details?.itemName)}`);
//   }
//   const grcHere = comparableGrc(unit.grcNo);
//   const grcThere = comparableGrc(values.grcNo);
//   if (grcHere && grcThere && grcHere !== grcThere) reasons.push(`GRC ${cell(unit.grcNo)} here, GRC ${cell(values.grcNo)} on the page`);
//   if (cell(unit.uom) && cell(values.uom) && uomTypeOf(unit.uom) !== uomTypeOf(values.uom)) reasons.push(`${cell(unit.uom)} here, ${cell(values.uom)} on the page`);
//   return { state: reasons.length ? 'different' : itemSame ? 'same' : 'unknown', reasons };
// }

// /* a GRC number that can be compared - digits, after an optional "GRC" - or
//    '' ("OB14", an opening-balance code, is not one) */
// const comparableGrc = (value) => {
//   const v = cell(value).replace(/^GRC\s*(no\.?|number)?\s*:?\s*/i, '');
//   return /^\d+$/.test(v) ? String(Number(v)) : '';
// };

// /* ---------------------------------------------- a barcode looked up ------ */

// const STATUS_TEXT = { IN_STOCK: 'in stock', HISTORY: 'kept as history (not in stock)', SOLD: 'sold', IN_TRANSIT: 'in transit', RETURN_IN_TRANSIT: 'being returned', VOID: 'written off' };
// const normName = (value) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
// /* characters OCR takes for one another - "15-S-KOL" read as "15-5-KOL" */
// const ocrFold = (value) => normName(value).toUpperCase().replace(/5/g, 'S').replace(/0/g, 'O').replace(/1/g, 'I').replace(/8/g, 'B').replace(/[^A-Z0-9]/g, '');

// /* "10-PLNBTM · 16 MTR · GRC 05178 · in stock at Temple Fabrics Warehouse" */
// export function unitSummary(unit, locationNames = new Map()) {
//   const u = unit || {};
//   const where = locationNames.get?.(String(u.currentLocationId || '')) || '';
//   const status = STATUS_TEXT[u.status] || String(u.status || '').toLowerCase().replace(/_/g, ' ');
//   return [
//     cell(u.itemCode) || cell(u.itemName) || 'no item',
//     [cell(u.qty ?? u.qtyNum), cell(u.uom)].filter(Boolean).join(' '),
//     cell(u.grcNo) ? `GRC ${cell(u.grcNo)}` : '',
//     status ? status + (where && u.status === IN_STOCK ? ` at ${where}` : '') : '',
//   ].filter(Boolean).join(' · ');
// }

// /* The names a unit's goods go by - its item code, its item name, its Item
//    master's name - never its own barcode number (older rows carry that as
//    their item code, which says nothing about the goods). */
// function unitNames(unit, itemNames) {
//   const own = new Set([unit.barcodeNo, unit.barcodeGenerated, unit.oldBarcode].map((v) => barcodeKey(v).toLowerCase()).filter(Boolean));
//   const names = [unit.itemCode, unit.itemName, unit.itemId ? itemNames.get?.(String(unit.itemId)) : ''].map(normName).filter((n) => n && !own.has(n));
//   return [...new Set(names)];
// }

// /* What the image says of the goods (its Item Name, its GRC No) against the
//    unit this ERP holds under that number. Only ever SHOWN - nothing read
//    from an image is written - so an OCR slip ("15-5-KOL") is allowed for,
//    and said. A GRC is compared only when both are GRC numbers. */
// function crossCheckOf(cross, unit, itemNames) {
//   const shownItem = cell(cross?.itemName).slice(0, 80);
//   const shownGrc = cell(cross?.grcNo).slice(0, 20);
//   const names = unitNames(unit, itemNames);
//   let item = 'none';
//   if (shownItem && names.length) {
//     const n = normName(shownItem);
//     item = names.includes(n) ? 'same' : names.some((x) => ocrFold(x) === ocrFold(n)) ? 'near' : 'different';
//   }
//   const a = comparableGrc(shownGrc);
//   const b = comparableGrc(unit.grcNo);
//   const grc = a && b ? (a === b ? 'same' : 'different') : 'none';
//   const outcome = item === 'different' || grc === 'different' ? 'different' : item !== 'none' || grc === 'same' ? 'matches' : 'unconfirmed';
//   return { outcome, item, grc, shownItem, shownGrc };
// }

// /* Whether a value an image (or a page, on its own) offered may be taken as
//    a barcode - '' when it may, else why not. Only values this ERP could have
//    printed: its own Barcode Setting series (at least the set number of
//    digits), its composed SUPPLIER*GRC*BILL*SERIAL value, or a value the page
//    labels as the barcode. A value this ERP HOLDS is taken too (the caller
//    finds it first); anything else - "9A1136-TWN0LPID", "G1313", "55151130" -
//    is not a barcode here, however it looks. */
// function acceptProblem(value, candidate, formats) {
//   if (!barcodeShaped(value, { loose: true })) return 'not a barcode number';
//   if (candidate.source === 'label') return '';
//   if (candidate.digitsOnly) return 'a number that is not a barcode in this ERP';
//   if (composedValue(value) || inLocalSeries(value, formats, { width: true, ignoreCase: true })) return '';
//   return 'not a barcode of this ERP - not in its Barcode Setting series or its SUPPLIER*GRC*BILL*SERIAL format, and not a barcode it holds';
// }

// /* A barcode an IMAGE showed, looked up. Every value shown is THIS ERP's own
//    (existing_barcode_lookup) - the image is never the source of an item, a
//    quantity, a UOM or a price - and nothing is ever written: an image
//    identifies a barcode, it does not import one. */
// function lookupRow(record, index, unitsFor, { formats, itemNames, locationNames }) {
//   const value = closeSeparators(record?.values?.barcode).slice(0, 60);
//   const line = Number(record?.line) || index + 1;
//   const c = record?.candidate || {};
//   const candidate = {
//     source: ['typed', 'label', 'standalone'].includes(c.source) ? c.source : 'standalone',
//     confidence: c.confidence !== null && c.confidence !== undefined && Number.isFinite(Number(c.confidence)) ? Math.round(Number(c.confidence)) : null,
//     digitsOnly: /^\d+$/.test(value),
//     label: cell(c.label).slice(0, 40),
//     page: Number.isInteger(Number(c.page)) ? Number(c.page) : 0,
//     line: Number(c.line) || 0,
//   };
//   /* "9a1167" typed or read in lower case is 9A1167 - a look-up writes
//      nothing, so it may try the printed (upper) case too */
//   let key = barcodeKey(value);
//   let all = key ? unitsFor(key) : [];
//   if (!all.length && key && key !== key.toUpperCase() && unitsFor(key.toUpperCase()).length) {
//     key = key.toUpperCase();
//     all = unitsFor(key);
//   }
//   const base = {
//     line, barcode: value, key, lookupOnly: true, candidate, values: { barcode: value },
//     sources: { barcode: candidate.source === 'typed' ? 'typed_barcode' : 'detected_barcode' },
//   };
//   /* a value printed on its own is a unit's own number or composed value -
//      never only someone's old vendor number (a design or article number can
//      be one) */
//   const here = candidate.source === 'standalone' ? all.filter((u) => sameBarcode(u.barcodeNo, key) || sameBarcode(u.barcodeGenerated, key)) : all;
//   if (!here.length && candidate.source !== 'typed') {
//     const why = acceptProblem(value, candidate, formats);
//     if (why) return { ...base, status: 'rejected', reason: why };
//   }
//   const series = inLocalSeries(value, formats, { ignoreCase: true, width: true });
//   const seriesWords = series ? ` It is in this ERP's own barcode series (Barcode Setting); importing it from its pasted page moves Barcode Generation past it.` : '';
//   if (!here.length) {
//     return {
//       ...base, status: 'lookup', lookup: { outcome: 'missing', series, units: [] },
//       reason: `${value} is not in this ERP. An image only identifies a barcode - to import it, copy its Details page (or its row of the Barcode Report) on erp.orbiteerp.com, paste the text here and Check.${seriesWords}`,
//     };
//   }
//   const views = here.slice(0, 5).map((u) => ({
//     id: String(u._id), barcodeNo: cell(u.barcodeNo), barcodeGenerated: cell(u.barcodeGenerated), itemCode: cell(u.itemCode),
//     qty: cell(u.qty ?? u.qtyNum), uom: cell(u.uom), grcNo: cell(u.grcNo), status: cell(u.status),
//     location: locationNames.get?.(String(u.currentLocationId || '')) || '', summary: unitSummary(u, locationNames),
//   }));
//   if (here.length > 1) {
//     return {
//       ...base, status: 'lookup', lookup: { outcome: 'several', series, units: views },
//       reason: `This number answers to ${here.length} units in this ERP: ${here.slice(0, 3).map((u) => unitSummary(u, locationNames)).join('; ')} - the image cannot say which one it shows`,
//     };
//   }
//   const unit = here[0];
//   const check = crossCheckOf(record?.crossCheck, unit, itemNames);
//   const summary = unitSummary(unit, locationNames);
//   const shown = [check.shownItem && `item ${check.shownItem}`, check.shownGrc && `GRC ${check.shownGrc}`].filter(Boolean).join(', ');
//   let reason;
//   if (check.outcome === 'different') {
//     reason = `In this ERP, ${value} is ${summary}. The image shows ${shown} - different goods, so it is not the piece in the image`
//       + (series ? '. Both ERPs issue this barcode series - pasting the other ERP\'s page for it shows this ERP\'s data beside it, to keep or replace' : '');
//   } else if (check.outcome === 'matches') {
//     reason = `Found in this ERP: ${summary}. The image's ${shown} matches${check.item === 'near' ? ' (allowing for a character OCR may have misread)' : ''}`;
//   } else {
//     reason = `Found in this ERP: ${summary}. The image shows no item name or GRC No to confirm it is the same piece`;
//   }
//   return {
//     ...base,
//     status: 'lookup',
//     unitId: String(unit._id),
//     values: { ...unitAsRecord(unit), barcode: value },
//     sources: { ...base.sources, itemCode: 'existing_barcode_lookup', qty: 'existing_barcode_lookup', uom: 'existing_barcode_lookup', retailPrice: 'existing_barcode_lookup' },
//     lookup: { outcome: check.outcome, series, crossCheck: check, units: views },
//     reason,
//   };
// }

// /* One look-up row per unit: a sticker prints a unit's number AND its
//    composed value, and both find the same unit. Two barcodes one IMAGE shows
//    that find different units (or one that finds none) are both kept, and
//    each says so - one image, one piece. A number the operator typed is
//    their own look-up, not something the image showed. */
// function oneRowPerUnit(rows) {
//   const byUnit = new Map();
//   const kept = rows.filter((r) => {
//     if (r.status !== 'lookup' || !r.unitId) return true;
//     const first = byUnit.get(r.unitId);
//     if (!first) { byUnit.set(r.unitId, r); return true; }
//     first.also = [...(first.also || []), r.barcode];
//     return false;
//   });
//   const pages = new Map();
//   kept.filter((r) => r.status === 'lookup' && r.candidate?.source !== 'typed').forEach((r) => {
//     const p = r.candidate?.page || 0;
//     if (!pages.has(p)) pages.set(p, []);
//     pages.get(p).push(r);
//   });
//   pages.forEach((looked) => {
//     if (looked.length < 2) return;
//     looked.forEach((r) => {
//       r.note = `The image shows more than one barcode (${looked.map((x) => x.barcode).join(', ')}) and they are not one piece in this ERP - check which one is the piece in the image`;
//     });
//   });
//   return kept;
// }

// /* What a Details-page record adds to a barcode this ERP already holds, as
//    differences: design, P-M-F, the supplier link, tax region, discount, the
//    base WSP / DP, and movement rows it does not have yet - each a blank it
//    fills, a saved value it replaces, or history it adds. */
// function detailDifferences(details, links, unit, supplierNames = new Map()) {
//   const out = [];
//   const add = (field, label, local, incoming, extra = {}) => {
//     if (cell(incoming) !== '' && !same(local, incoming)) {
//       out.push({ field, label, local: cell(local), incoming: cell(incoming), updatable: true, kind: cell(local) === '' ? 'fill' : 'replace', ...extra });
//     }
//   };
//   add('designNo', 'Design NO.', unit.designNo, details.designNo);
//   add('pma', 'PMA (P-M-F)', unit.p_m_f, details.pma);
//   if (links?.supplierId && String(unit.supplierId || '') !== String(links.supplierId)) {
//     out.push({
//       field: 'supplierId', label: 'Supplier', local: unit.supplierId ? (supplierNames.get?.(String(unit.supplierId)) || 'another supplier') : '',
//       incoming: details.supplier, value: String(links.supplierId), updatable: true, kind: unit.supplierId ? 'replace' : 'fill',
//     });
//   }
//   add('taxRegion', 'Tax Region', unit.supplierTaxRegion, details.taxRegion);
//   add('discount', 'Discount', unit.discount, details.discount);
//   add('wsp', 'WSP', unit.wsp, details.wsp);
//   add('dp', 'DP', unit.dp, details.dp);
//   const known = new Set((unit.sourceMovements || []).map((m) => m.key));
//   const fresh = (details.movements || []).filter((m) => !known.has(m.key));
//   if (fresh.length) out.push({ field: 'movements', label: 'Movement history', local: `${known.size} rows`, incoming: `${known.size + fresh.length} rows`, updatable: true, kind: 'append' });
//   return out;
// }

// /* the movements a unit already has, plus the imported ones it does not -
//    deduped on movementKey, each linked to the location / stock point found */
// function mergeMovements(existing, incoming, links) {
//   const out = [...(existing || [])];
//   const known = new Set(out.map((m) => m.key));
//   (incoming || []).forEach((m, i) => {
//     if (known.has(m.key)) return;
//     known.add(m.key);
//     out.push({ ...m, locationId: links?.movementLocations?.[i] || null, stockPointId: links?.movementStockPoints?.[i] || null });
//   });
//   return out;
// }

// const stockWithLinks = (stock, links) => (stock || []).map((s, i) => ({
//   ...s, locationId: links?.stockLocations?.[i] || null, stockPointId: links?.stockStockPoints?.[i] || null,
// }));

// /* A Details record as the server accepts it: every value re-read as text or
//    number, dates as dates, keys and totals worked out again - what the
//    browser sent is never trusted to be well-formed. */
// export function normaliseDetails(d) {
//   if (!d || typeof d !== 'object') return null;
//   const n = (v) => { const x = Number(numberText(v)); return Number.isFinite(x) ? x : 0; };
//   const seenKeys = new Set();
//   const movements = (Array.isArray(d.movements) ? d.movements : []).slice(0, 500).map((m) => {
//     const date = m?.docDate instanceof Date ? m.docDate : (m?.docDate ? new Date(m.docDate) : null);
//     const x = {
//       location: cell(m?.location), docDate: date && !Number.isNaN(date.getTime()) ? date : null,
//       docType: cell(m?.docType), docNo: cell(m?.docNo), party: cell(m?.party), particulars: cell(m?.particulars), stockPoint: cell(m?.stockPoint),
//       receipts: Math.abs(n(m?.receipts)), issues: Math.abs(n(m?.issues)), balance: n(m?.balance), qty: Math.abs(n(m?.qty)), finalPrice: n(m?.finalPrice), netAmount: Math.abs(n(m?.netAmount)),
//     };
//     x.signedQty = Math.round((x.receipts - x.issues) * 1000) / 1000;
//     x.key = movementKey(x);
//     return x;
//   }).filter((m) => (seenKeys.has(m.key) ? false : seenKeys.add(m.key)));
//   const stock = (Array.isArray(d.stock) ? d.stock : []).slice(0, 100).map((s) => ({ location: cell(s?.location), stockPoint: cell(s?.stockPoint), qty: n(s?.qty) }));
//   const printedRaw = d.totals?.printed;
//   const printed = printedRaw && typeof printedRaw === 'object'
//     ? Object.fromEntries(['receipts', 'issues', 'balance', 'netAmount'].filter((k) => printedRaw[k] !== undefined && printedRaw[k] !== null).map((k) => [k, n(printedRaw[k])]))
//     : null;
//   const money = (v) => { const t = numberText(v); return isNumber(t) ? String(Number(t)) : ''; };
//   return {
//     itemName: cell(d.itemName), group: cell(d.group), subGroup: cell(d.subGroup), gstSlab: cell(d.gstSlab),
//     pma: cell(d.pma), designNo: cell(d.designNo), supplier: cell(d.supplier), supplierCode: cell(d.supplierCode) || splitSupplier(d.supplier).code, taxRegion: cell(d.taxRegion),
//     discount: money(d.discount), wsp: money(d.wsp), dp: money(d.dp),
//     movements, stock, totals: movementTotals(movements, printed), payload: String(d.payload ?? '').slice(0, 20000),
//   };
// }

// export function countByStatus(rows) {
//   const counts = { new: 0, same: 0, changed: 0, locked: 0, invalid: 0 };
//   /* an image's look-ups, and the values it offered that were not barcodes */
//   (rows || []).forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });
//   return counts;
// }

// /* an import field -> the stored field its update writes */
// const STORED_FIELD = {
//   description: 'printDescription', hsn: 'hsn', purRate: 'purRate', finalNet: 'finalNet', gst: 'gst',
//   retailPrice: 'retailPrice', offerPrice: 'offerPrice', wspPrice: 'wspPrice', dpPrice: 'dpPrice',
//   designNo: 'designNo', pma: 'p_m_f', taxRegion: 'supplierTaxRegion', discount: 'discount', wsp: 'wsp', dp: 'dp',
// };

// /* The $set a ticked CHANGED row writes: its updatable differences only, the
//    cost price re-encoded for the label when the purchase rate moves, and -
//    for a Details record - the source's history snapshot. */
// export function updateFor(row, mapping = null, fields = null) {
//   /* `fields` - the differences the operator approved (a Set of field
//      names); null takes every updatable one */
//   const take = (d) => d.updatable && (!fields || fields.has(d.field));
//   const set = {};
//   (row?.diffs || []).filter(take).forEach((d) => {
//     if (d.field === 'supplierId') set.supplierId = d.value;
//     else if (d.field !== 'movements') set[STORED_FIELD[d.field]] = d.incoming;
//   });
//   if ('purRate' in set) set.encodedPurRate = encodeRate(set.purRate, mapping);
//   /* the source's history snapshot goes with its movement rows */
//   if (row?.snapshot && (!fields || fields.has('movements'))) Object.assign(set, row.snapshot);
//   return set;
// }

// /* One NEW row as the unit of stock it becomes - the fields Barcode
//    Generation writes for a received unit (buildDoc in
//    app/api/barcode-generation/route.js), from what the report shows.

//    Its number is the one printed on the goods: the unit's own number AND its
//    old barcode, so the sticker already on them scans (lib/inventory.js
//    barcodeFilter). No composed value - it was not received on a GRC here -
//    the same shape as the warehouse workbook's imported units
//    (scripts/seedWarehouseStockFromExcel.mjs). A quantity over 1 is one
//    barcode for all of it (batch), as there. */
// export function unitDocFor(values, { businessId, locationId, finYear = '', item = null, mapping = null, details = null, links = null }) {
//   const doc = reportUnitDoc(values, { businessId, locationId, finYear, item, mapping });
//   if (!details) return doc;
//   /* A Details record: in stock only where the source still holds it (the
//      location found for its balance), otherwise kept for its history alone -
//      never sold, scanned or counted (user, 2026-09-29: the other ERP's
//      movements are history on the barcode, not this ERP's ledger). */
//   const held = (links?.stockAt || [])[0] || null;
//   if (held) {
//     Object.assign(doc, {
//       status: IN_STOCK,
//       businessId: String(held.businessId || businessId || ''),
//       locationId: String(held.locationId),
//       currentLocationId: held.locationId,
//       currentBusinessId: held.businessId || businessId,
//       currentStockPointId: held.stockPointId || null,
//       qty: String(held.qty),
//       qtyNum: held.qty,
//     });
//   } else {
//     Object.assign(doc, {
//       status: HISTORY,
//       locationId: String(links?.originLocationId || locationId || ''),
//       currentLocationId: null,
//       currentBusinessId: null,
//     });
//   }
//   return Object.assign(doc, {
//     itemName: item?.name || details.itemName || doc.itemName,
//     p_m_f: details.pma,
//     designNo: details.designNo,
//     supplierId: links?.supplierId ? String(links.supplierId) : '',
//     supplierTaxRegion: details.taxRegion,
//     discount: details.discount,
//     wsp: details.wsp,
//     dp: details.dp,
//     sourceMovements: mergeMovements([], details.movements, links),
//     sourceStock: stockWithLinks(details.stock, links),
//     sourceTotals: details.totals,
//     sourcePayload: details.payload,
//   });
// }

// function reportUnitDoc(values, { businessId, locationId, finYear = '', item = null, mapping = null }) {
//   const v = values || {};
//   const qty = Number(v.qty);
//   const batchType = qty > 1 ? 'batch' : 'unique';
//   return {
//     grcId: '',
//     grcNo: v.grcNo || '',
//     supplierId: '',
//     barcodeNo: v.barcode,
//     oldBarcode: v.barcode,
//     barcodeGenerated: '',
//     itemCode: v.itemCode,
//     itemId: item?._id || null,
//     itemName: item?.name || v.description || v.itemCode,
//     printDescription: v.description || '',
//     supplierDescription: v.description || '',
//     qty: v.qty,
//     qtyNum: qty,
//     uom: v.uom,
//     uomType: uomTypeOf(v.uom),
//     hsn: v.hsn || '',
//     gst: v.gst || '',
//     purRate: v.purRate || '',
//     encodedPurRate: encodeRate(v.purRate || '', mapping),
//     finalNet: v.finalNet || '',
//     retailPrice: v.retailPrice || '',
//     offerPrice: v.offerPrice || '',
//     wspPrice: v.wspPrice || '',
//     dpPrice: v.dpPrice || '',
//     batchType,
//     batchUnique: batchType,
//     batchNo: batchType === 'batch' ? v.barcode : '',
//     businessId: String(businessId || ''),
//     locationId: String(locationId || ''),
//     finYear,
//     status: IN_STOCK,
//     currentLocationId: locationId,
//     currentBusinessId: businessId,
//     source: IMPORT_SOURCE,
//   };
// }

// /* Whether a barcode number is one this ERP's own counter issues - a Barcode
//    Setting period's prefix, digits, suffix. Such a number cannot come in from
//    outside: the counter would issue it again later to different goods
//    (lib/barcodeEngine.js reads what is already printed only once), and two
//    stickers with one number scan as either piece. `formats` are
//    [{ prefix, suffix, numberLenght }].
//      ignoreCase  "9a1136" is 9A1136 - for REFUSING a number, where a typed
//                  lower case must not slip past
//      width       at least the period's number of digits (lib/barcodeEngine.js
//                  formatBarcode pads to it) - for ACCEPTING a value an image
//                  printed on its own, where "9A1" or an OCR'd "1B90" is not
//                  a number of the series */
// export function inLocalSeries(barcode, formats, { ignoreCase = false, width = false } = {}) {
//   const fold = (v) => (ignoreCase ? String(v).toUpperCase() : String(v));
//   const value = fold(clean(barcode));
//   return (formats || []).some(({ prefix = '', suffix = '', numberLenght = null }) => {
//     const p = fold(prefix || '');
//     const s = fold(suffix || '');
//     if (!value.startsWith(p) || !value.endsWith(s) || value.length <= p.length + s.length) return false;
//     const digits = value.slice(p.length, value.length - s.length);
//     if (!/^\d+$/.test(digits)) return false;
//     const least = Number(numberLenght);
//     return !width || !(least > 0) || digits.length >= least;
//   });
// }












/* Barcode Report IMPORT - the other ERP's Barcode Report, read into ours.

   The same arrangement as Supplier -> GST Parse (lib/gstPasteParser.js): the
   operator opens the report on erp.orbiteerp.com themselves, searches the
   item, and copies the table - or saves its Excel export - and brings it here.
   Nothing in this file touches the network or the database. It is a pure
   function over the pasted text / sheet rows, so the browser shows what it
   read and the server re-reads the very same rows by the very same rules
   before anything is saved.

   Read by HEADING, not by column position: the headings the report prints
   ("Barcode", "Item Code", "Pur Rate", "Final Net" ...) are matched loosely,
   so a column moved, added or renamed in a small way does not shift the
   others, and a heading nobody recognises is reported, never guessed at.

   The server (app/api/reports/barcode-report/import/route.js) decides what
   each row becomes: a new unit of stock, a barcode this ERP already holds
   (unchanged, or changed - the operator ticks which changes to take), or a
   row that cannot be imported, and why. */

import { barcodeKey, parseBarcodeValue, sameBarcode } from '@/lib/barcodeValue';
import { uomTypeOf } from '@/lib/barcodeUnits';
import { encodeRate } from '@/lib/purchaseRateCode';

/* What an imported barcode is tagged with (barcodeLabel.source, and the
   GRC_IN ledger row's refModel) - so these units can always be told apart
   from stock received on a GRC here, the way WHSTK_EXCEL rows are. */
export const IMPORT_SOURCE = 'ORBITEERP_BARCODE_REPORT';
export const SOURCE_URL = 'https://erp.orbiteerp.com/admin/reports/barcode-report';
/* one import at a time is one report search, at most a few hundred rows;
   this is a guard against a runaway paste, not a business rule */
export const IMPORT_LIMIT = 2000;
const GST_MAX = 40;

/* The report's columns, as this ERP's Barcode Report shows them (fields.js)
   and as the other system labels them. `aliases` are squashed (see squash). */
export const IMPORT_FIELDS = [
  { key: 'barcode', label: 'Barcode', aliases: ['barcode', 'barcodeno', 'barcodenumber', 'barcodegenerated', 'barcodes', 'barcodeid'] },
  { key: 'itemCode', label: 'Item Code', aliases: ['itemcode', 'itemno', 'itemnumber', 'stylecode', 'styleno'] },
  { key: 'description', label: 'Description', aliases: ['description', 'itemname', 'itemdescription', 'printdescription', 'desc', 'name', 'productname'] },
  { key: 'qty', label: 'Qty', aliases: ['qty', 'quantity', 'qtymtr', 'stock'] },
  { key: 'uom', label: 'UOM', aliases: ['uom', 'unit', 'units'] },
  { key: 'hsn', label: 'HSN', aliases: ['hsn', 'hsncode', 'hsnsac', 'hsnsaccode'] },
  { key: 'purRate', label: 'Pur Rate', aliases: ['purrate', 'purchaserate', 'purchaseprice', 'prate', 'purchase', 'rate'] },
  { key: 'finalNet', label: 'Final Net', aliases: ['finalnet', 'finalrate', 'finalprice', 'netrate', 'cp', 'costprice', 'finalnetrate'] },
  { key: 'gst', label: 'GST %', aliases: ['gst%', 'gst', 'gstpercent', 'gstrate', 'tax%', 'tax'] },
  { key: 'retailPrice', label: 'Retail Price', aliases: ['retailprice', 'rsp', 'mrp', 'retail', 'sellingprice', 'rspprice'] },
  { key: 'offerPrice', label: 'Offer Price', aliases: ['offerprice', 'offer', 'rspofferprice'] },
  { key: 'wspPrice', label: 'WSP Price', aliases: ['wspprice', 'wsp', 'wholesaleprice', 'wspofferprice'] },
  { key: 'dpPrice', label: 'DP Price', aliases: ['dpprice', 'dp', 'ecomm', 'ecommprice', 'ecommofferprice'] },
  { key: 'grcNo', label: 'GRC No', aliases: ['grcno', 'grc', 'grcnumber'] },
];
const FIELD_BY_ALIAS = new Map(IMPORT_FIELDS.flatMap((f) => f.aliases.map((a) => [a, f.key])));
export const FIELD_LABELS = Object.fromEntries(IMPORT_FIELDS.map((f) => [f.key, f.label]));
const NUMBER_FIELDS = ['qty', 'purRate', 'finalNet', 'gst', 'retailPrice', 'offerPrice', 'wspPrice', 'dpPrice'];
/* without these a row is not a unit of stock */
const REQUIRED = ['barcode', 'itemCode', 'qty', 'uom'];

/* What an import may change on a barcode this ERP already holds: its prices
   and how it is described. Never its item, quantity or unit - those are
   stock, and the ledger says how much of what is where; correcting them is
   a stock adjustment, not an import. */
export const UPDATABLE_FIELDS = ['description', 'hsn', 'purRate', 'finalNet', 'gst', 'retailPrice', 'offerPrice', 'wspPrice', 'dpPrice'];
/* compared, and shown when they differ, but never written by an import */
const COMPARED_FIELDS = ['itemCode', 'qty', 'uom', ...UPDATABLE_FIELDS];

/* "Pur. Rate", "Pur Rate" and "PUR_RATE" are one heading; "GST %" keeps its % */
export const squash = (text) => String(text ?? '').toLowerCase().replace(/[^a-z0-9%]/g, '');
const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
/* the report prints an empty cell as "-" */
const cell = (value) => { const v = clean(value); return v === '-' || v === '—' ? '' : v; };
/* "1,980.00", "₹1,980", "5%" -> "1980", "5" */
const numberText = (value) => cell(value).replace(/[₹,\s]/g, '').replace(/%$/, '');
const isNumber = (text) => text !== '' && Number.isFinite(Number(text));
const decimals = (text) => (String(text).split('.')[1] || '').length;

/* ------------------------------------------- what a barcode looks like -- */

/* A value as a barcode is written: a composed value's separators closed up
   ("G1318 * 05178 * 1 * 1" -> "G1318*05178*1*1"). Nothing else is touched -
   never a character dropped, never a part cut off: "9A1136-TWN0LPID" stays
   what it is, and is never taken for "9A1136". */
export const closeSeparators = (value) => clean(value).replace(/\s*\*\s*/g, '*');

/* A composed SUPPLIER*GRC*BILL*SERIAL value (lib/barcodeValue.js) as this
   ERP makes it: a supplier's contact code (letters, then digits - G1318),
   then three numbers. parseBarcodeValue alone only counts four parts, so
   "RSP*1590*Qty*2" would pass it. */
export function composedValue(value) {
  const parts = parseBarcodeValue(closeSeparators(value));
  if (!parts) return false;
  return /^[A-Za-z]+\d+[A-Za-z0-9]*$/.test(parts.supplierCode)
    && [parts.grcNumber, parts.billSlNo, parts.serialNo].every((p) => /^\d+$/.test(p));
}

/* Whether a value is SHAPED like a barcode - one token with a digit in it
   (a composed value only when it is a whole composed value). Only decides
   what may be looked at as a barcode; whether it IS one is the Barcode
   Setting format and the lookup's decision (classifyRecords).
     loose  a value the page labels as the barcode, or a report's Barcode
            column: "-", "/", "." and "_" allowed inside it
     strict a value printed on its own, with nothing saying what it is:
            letters and digits only, 3 to 30 of them                      */
export function barcodeShaped(value, { loose = false } = {}) {
  const v = closeSeparators(value);
  if (!v || v.length > 60 || /\s/.test(v) || !/\d/.test(v)) return false;
  if (v.includes('*')) return composedValue(v);
  return loose ? /^[A-Za-z0-9](?:[A-Za-z0-9\-/._]*[A-Za-z0-9])?$/.test(v) : /^[A-Za-z0-9]{3,30}$/.test(v);
}

/* ---------------------------------------------------------------- read -- */

/* Tab-separated text as a browser or Excel puts a copied table on the
   clipboard: rows on line breaks, cells on tabs, a cell holding a tab or a
   line break wrapped in double quotes. */
export function splitTable(text) {
  const src = String(text ?? '').replace(/\r\n?/g, '\n');
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { value += '"'; i += 1; } else if (ch === '"') quoted = false; else value += ch;
    } else if (ch === '"' && value === '') quoted = true;
    else if (ch === '\t') { row.push(value); value = ''; } else if (ch === '\n') { row.push(value); rows.push(row); row = []; value = ''; } else value += ch;
  }
  if (value !== '' || row.length) { row.push(value); rows.push(row); }
  return rows;
}

/* Which report column each cell of a line is, or null when fewer than three
   cells - one of them Barcode - name a column: that line is not the header. */
function headerOf(line) {
  const fields = line.map((text) => FIELD_BY_ALIAS.get(squash(text)) || null);
  const named = fields.filter(Boolean);
  if (named.length < 3 || !named.includes('barcode')) return null;
  /* a heading twice ("Barcode" and "Barcode No") - the first one is the column */
  return fields.map((f, i) => (f && fields.indexOf(f) === i ? f : null));
}

/* A copied report table, as rows of cells -> the barcodes it holds.

   Returns
     records    [{ line, values, problems }]  one per data row, in order
     columns    [{ heading, field }]           how each heading was read
     unmapped   headings nobody recognised (their cells are ignored)
     missing    required columns the table does not have
     ignored    lines that are not barcodes: the totals row, a repeated
                header from a second page, blank lines
     left       the lines left out that were not blank, and why
                [{ line, text, reason }] - a row whose Barcode cell is not
                a barcode ("ECom ID", "Showing 1 to 1 of 1 entries"), or
                anything after the table ends (a Details view below it)
     error      why nothing could be read at all, or ''                  */
export function readTable(matrix) {
  const lines = (matrix || []).map((line) => (Array.isArray(line) ? line : []));
  const at = lines.findIndex((line) => headerOf(line));
  if (at < 0) {
    return {
      records: [], columns: [], unmapped: [], missing: REQUIRED, ignored: 0, left: [],
      error: 'No report headings were found. Copy the whole table from the Barcode Report - from the "Barcode" heading to the last row - or choose its Excel file.',
    };
  }
  const fields = nearHeadings(lines[at], headerOf(lines[at]));
  const columns = lines[at].map((heading, i) => ({ heading: clean(heading), field: fields[i] })).filter((c) => c.heading);
  const unmapped = columns.filter((c) => !c.field).map((c) => c.heading);
  const missing = REQUIRED.filter((key) => !fields.includes(key));
  if (missing.length) {
    return {
      records: [], columns, unmapped, missing, ignored: 0, left: [],
      error: `The table has no ${missing.map((key) => FIELD_LABELS[key]).join(', ')} column - copy the whole report table, every column.`,
    };
  }

  const records = [];
  const left = [];
  let ignored = 0;
  let ended = false;
  const leave = (line, text, reason) => { ignored += 1; if (left.length < 50) left.push({ line, text: String(text).slice(0, 80), reason }); };
  lines.slice(at + 1).forEach((line, i) => {
    const lineNo = at + i + 2;
    const filled = line.map((c) => cell(c)).filter(Boolean);
    const text = filled.join(' | ');
    if (!text) { ignored += 1; return; }
    /* a second page's heading row: the report goes on */
    if (headerOf(line)) { ended = false; ignored += 1; return; }
    /* the table ends where a Details view starts - its "Details" heading or
       a band standing alone on its line, or its movement table - and
       nothing below it is a row of the report, until the headings repeat */
    if (!ended && (movementHeader(line.join('\t')) || (filled.length === 1 && DETAILS_START.test(filled[0]) && !barcodeShaped(filled[0], { loose: true })))) ended = true;
    if (ended) { leave(lineNo, text, 'below the report table'); return; }
    const values = {};
    fields.forEach((field, c) => { if (field) values[field] = cell(line[c]); });
    /* the totals row: no barcode and no item, or a first cell reading "Total" */
    if ((!values.barcode && !values.itemCode) || /^(grand\s*)?total/i.test(cell(line[0]))) { ignored += 1; return; }
    /* only a barcode makes a row: text in the Barcode column ("ECom ID",
       "Showing 1 to 1 of 1 entries") is page text that fell under the
       headings, never a barcode made up from it */
    if (values.barcode && !barcodeShaped(values.barcode, { loose: true })) { leave(lineNo, text, `"${values.barcode.slice(0, 40)}" in the Barcode column is not a barcode`); return; }
    records.push({ line: lineNo, values: normaliseRecord(values) });
  });
  if (records.length > IMPORT_LIMIT) {
    return { records: [], columns, unmapped, missing, ignored, left, error: `That is ${records.length} barcodes - import at most ${IMPORT_LIMIT} at a time.` };
  }

  /* the same barcode twice: a second page copied over the first repeats
     rows exactly (kept once); two DIFFERENT rows under one barcode cannot
     both be right, so the later one is refused */
  const seen = new Map();
  const kept = [];
  records.forEach((record) => {
    const key = barcodeKey(record.values.barcode);
    const first = key ? seen.get(key) : null;
    if (first && JSON.stringify(first.values) === JSON.stringify(record.values)) { ignored += 1; return; }
    record.problems = checkRecord(record.values);
    if (first) record.problems.push(`The same barcode is on line ${first.line} with different details`);
    if (key && !first) seen.set(key, record);
    kept.push(record);
  });
  return { records: kept, columns, unmapped, missing, ignored, left, error: '' };
}

/* A REQUIRED column whose heading was read with one letter wrong - OCR of a
   screenshot reads "QTY" as "Qry" - is still found: an unplaced heading one
   edit away from exactly one of that column's names takes it. Only the
   required columns, only when nothing else claimed them, and only a single
   candidate - "DATE" can never become "RATE" this way. */
const oneEdit = (a, b) => {
  if (a === b || Math.abs(a.length - b.length) > 1 || Math.min(a.length, b.length) < 3) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i += 1; j += 1; continue; }
    edits += 1;
    if (edits > 1) return false;
    if (a.length > b.length) i += 1; else if (b.length > a.length) j += 1; else { i += 1; j += 1; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
};
function nearHeadings(line, fields) {
  const out = [...fields];
  REQUIRED.filter((key) => !out.includes(key)).forEach((key) => {
    const aliases = IMPORT_FIELDS.find((f) => f.key === key).aliases;
    const near = line.map((text, i) => (!out[i] && aliases.some((a) => oneEdit(squash(text), a)) ? i : -1)).filter((i) => i >= 0);
    if (near.length === 1) out[near[0]] = key;
  });
  return out;
}

/* A report-table heading row's fields, cell by cell, or null when the row is
   not one - for lib/barcodeReportOcr.js's check of the TOTAL row. */
export function headingFields(cells) {
  const list = (cells || []).map((c) => String(c ?? ''));
  const fields = headerOf(list);
  return fields ? nearHeadings(list, fields) : null;
}

/* Whether a row of cells is a table's heading row - the report list's
   (Barcode, Item Code, ...) or a Details page's movement table (Location,
   Doc Date, Doc No, ...). lib/barcodeReportOcr.js asks this of a screenshot's
   rows, so the headings are known in one place only. */
export function isTableHeading(cells) {
  const list = (cells || []).map((c) => String(c ?? ''));
  return Boolean(headerOf(list)) || Boolean(movementHeader(list.join('\t')));
}

/* Pasted text -> readTable. Text with no tab in it is not a copied table:
   copying the page as a whole, or a PDF, runs the cells together. */
export function readPastedText(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return { ...readTable([]), error: 'Paste the Barcode Report table first.' };
  if (!trimmed.includes('\t')) {
    return {
      ...readTable([]),
      error: 'That text has no table columns in it. Select the report table itself (from the "Barcode" heading to the last row), copy it and paste it here - or choose its Excel file.',
    };
  }
  return readTable(splitTable(trimmed));
}

/* Numbers as plain text ("1,980.00" -> "1980"), everything else trimmed. */
export function normaliseRecord(values) {
  const out = {};
  IMPORT_FIELDS.forEach(({ key }) => {
    const raw = cell(values?.[key]);
    if (NUMBER_FIELDS.includes(key)) {
      const n = numberText(raw);
      out[key] = isNumber(n) ? String(Number(n)) : raw;
    } else if (key === 'hsn') out[key] = raw.replace(/[\s.]/g, '');
    else if (key === 'uom') out[key] = raw.toUpperCase();
    else out[key] = raw;
  });
  return out;
}

/* Why one row cannot be a unit of stock, as [{ field, message }]; empty when
   it can. The server runs this again over what it is sent. */
export function checkFields(values) {
  const v = values || {};
  const problems = [];
  const bad = (field, message) => problems.push({ field, message });
  REQUIRED.forEach((key) => { if (!cell(v[key])) bad(key, `${FIELD_LABELS[key]} is missing`); });
  if (cell(v.barcode).length > 60) bad('barcode', 'Barcode is longer than 60 characters');
  /* one barcode value - never a phrase ("Details", "ITEM CODE DESCRIPTION") */
  else if (cell(v.barcode) && !barcodeShaped(v.barcode, { loose: true })) bad('barcode', `"${cell(v.barcode).slice(0, 40)}" is not a barcode number`);
  if (cell(v.itemCode).length > 60) bad('itemCode', 'Item Code is longer than 60 characters');
  if (cell(v.qty)) {
    if (!isNumber(v.qty) || Number(v.qty) <= 0) bad('qty', 'Qty must be a number greater than 0');
    else if (decimals(v.qty) > 3) bad('qty', 'Qty can have at most 3 decimals');
  }
  if (cell(v.uom).length > 20) bad('uom', 'UOM is longer than 20 characters');
  if (cell(v.hsn) && !/^\d{2,8}$/.test(v.hsn)) bad('hsn', 'HSN must be 2 to 8 digits');
  if (cell(v.gst) && (!isNumber(v.gst) || Number(v.gst) < 0 || Number(v.gst) > GST_MAX)) bad('gst', `GST % must be between 0 and ${GST_MAX}`);
  ['purRate', 'finalNet', 'retailPrice', 'offerPrice', 'wspPrice', 'dpPrice'].forEach((key) => {
    if (cell(v[key]) && (!isNumber(v[key]) || Number(v[key]) < 0)) bad(key, `${FIELD_LABELS[key]} must be a number, 0 or more`);
  });
  if (cell(v.description).length > 200) bad('description', 'Description is longer than 200 characters');
  return problems;
}

/* the same, as messages */
export const checkRecord = (values) => checkFields(values).map((p) => p.message);

/* ------------------------------------------- one barcode's Details page -- */

/* The other ERP's Barcode Report DETAILS page - one barcode, or several one
   after another - copied and pasted, or its Excel export read into the same
   lines. Two layouts are known, and both are read:

     "Item Name: 15-SRT", "Purchase Rate 550.00 | Discount 0.00"
         a label at the start of a cell, cells on tabs or " | "
     "PRICE INFO   PURCHASE RATE : 620.00   DISCOUNT : 0.00   FINAL RATE : 620.00"
         several KEY : VALUE pairs on one line after a band heading, the
         pairs apart by runs of spaces or by tabs, a value may be empty

   and the movement table in either form: Type / Supplier/Cust/Location /
   Particulars columns and 24-hour times, or a Message column, 12-hour times
   ("03:08 PM"), a blank Qty and an issue printed as -1.

   Read BY LABEL, never by position, like lib/gstPasteParser.js reads the GST
   portal. The text is normalised first - non-breaking spaces, \r\n, the
   screen's chrome (NOTE :, NO IMAGE, PRINT) - and every match is
   case-insensitive: the screen shows the report in capitals, the text copied
   from it may not be. What cannot be read is said, per field; nothing is
   guessed. `barcode` - the number typed beside a pasted page that does not
   print one. */
const DETAIL_LABELS = [
  ['barcode', ['Barcode Number', 'Barcode No', 'Barcode']],
  ['itemName', ['Item Name']],
  ['itemCode', ['Item Code']],
  ['subGroup', ['Sub Group', 'Subgroup']],
  ['group', ['Group']],
  ['hsn', ['HSN Code', 'HSN']],
  ['gstSlab', ['GST Slab', 'Tax Slab']],
  ['pma', ['PMA', 'P-M-F', 'PMF']],
  ['purRate', ['Purchase Rate', 'Pur Rate']],
  ['discount', ['Discount']],
  ['finalNet', ['Final Rate', 'Final Net']],
  ['rsp', ['RSP', 'Retail Price']],
  ['wsp', ['WSP']],
  ['dp', ['DP', 'E-COMM']],
  ['designNo', ['Design NO.', 'Design No', 'Design Number', 'Design']],
  ['supplier', ['Supplier Name', 'Supplier']],
  ['taxRegion', ['Tax Region']],
  ['uom', ['UOM']],
  /* the whole label, so "Supplier Description" is never read as "Supplier" */
  ['description', ['Supplier Description', 'Description']],
  /* only with a colon after it ("GRC No: 05165") - a GRC number is the one
     the page names, never a "GRC Date" or a Doc No in the movement table */
  ['grcNo', ['GRC Number', 'GRC No.', 'GRC No'], { colonOnly: true }],
  /* "Unit: Pc(s)" - the page's own unit, used only when the Item master has
     none (lib/barcodeReportImportService.js resolveDetails); never "Unit Price" */
  ['uom', ['Unit'], { colonOnly: true }],
  /* read to be shown in the preview, and so that their values are known to
     be theirs - an ECom ID "9A2890-7ZUOKKI9" is never cut down to a barcode */
  ['ecomId', ['E-Com ID', 'ECom ID']],
  ['consignment', ['Is Consignment']],
  ['invoiceNo', ['Purchase Invoice No', 'Purchase Invoice']],
  /* only "Note: text" - a bare NOTE heading is the page's chrome (NOISE) */
  ['note', ['Note'], { colonOnly: true }],
].flatMap(([key, labels, opts = {}]) => labels.map((label) => ({ key, label, ...opts })))
  .sort((a, b) => b.label.length - a.label.length);
const labelPattern = (label) => label.split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*');
/* a label at the start of a cell: "Item Name 15-SRT", "Item Name: 15-SRT" */
const LABEL_RES = DETAIL_LABELS.map(({ key, label, colonOnly }) => ({
  key,
  re: colonOnly
    ? new RegExp('^\\s*' + labelPattern(label) + '\\s*:\\s*(.*)$', 'i')
    : new RegExp('^\\s*' + labelPattern(label) + '(?=$|[\\s:.\\-])\\s*[:.\\-]?\\s*(.*)$', 'i'),
  colon: new RegExp('^\\s*' + labelPattern(label) + '\\s*:', 'i'),
}));
/* labels followed by a colon, anywhere on a line: "PMA : FAUX   RSP : 1080" */
const COLON_LABELS = new RegExp('(?:^|(?<=[\\s|]))(' + DETAIL_LABELS.map(({ label }) => labelPattern(label)).join('|') + ')\\s*:', 'gi');
const keyOfLabel = (text) => DETAIL_LABELS.find(({ label }) => new RegExp('^' + labelPattern(label) + '$', 'i').test(String(text).trim()))?.key;
/* A value that starts with one of these words and a colon belongs to a
   longer label the page printed - "Unit Price : 1590" is not UOM "Price :
   1590", "DP Price Code : 900" is not DP "Price Code : 900". Only these
   words: "Design NO. SS: 2024" is the design "SS: 2024". */
const LONGER_LABEL = /^(price|code|type|name|rate|date|no\.?|number|qty|quantity|group|id|value|amount)\b[^:]{0,20}:/i;
/* a value with no letter or digit (in any script) - the "*" a form prints
   beside a required filter ("Item Code *"), a "-" or ":" - is no value */
const hasValue = (text) => /[\p{L}\p{N}]/u.test(String(text ?? ''));

/* the page's bands, and lines that are its chrome rather than its data */
const BANDS = [
  ['itemInfo', 'ITEM INFO'], ['otherInfo', 'OTHER INFO'], ['priceInfo', 'PRICE INFO'], ['designInfo', 'DESIGN INFO'], ['supplierDetails', 'SUPPLIER DETAILS'],
];
const BAND_RE = /\b(item\s+info|other\s+info|price\s+info|design\s+info|supplier\s+details)\b\s*:?/gi;
/* where a Details view starts: its "Details" heading or one of its bands */
const DETAILS_START = /^(details|item\s+info|other\s+info|price\s+info|design\s+info|supplier\s+details)\b/i;
const NOISE =/^(note\s*:?|no\s+image|image|print|back|close|details|download\b.*|export\b.*|barcode\s+report|stock[\s-]*by[\s-]*location.*|stock[\s-]*summary.*|stock\s+movements?(\s+rows?)?\s*:?|movement\s+columns?\s*:?)$/i;

/* the movement table's columns */
const MOVE_COLUMNS = [
  ['location', ['location']],
  ['docDate', ['docdate', 'date']],
  ['docType', ['type', 'doctype']],
  ['docNo', ['docno', 'documentno', 'docnumber']],
  ['party', ['suppliercustlocation', 'suppliercustomerlocation', 'suppliercust', 'party']],
  ['particulars', ['particulars', 'message', 'narration', 'remarks']],
  ['stockPoint', ['stockpoint']],
  ['receipts', ['receipts', 'receipt']],
  ['issues', ['issues', 'issue']],
  ['balance', ['balance', 'balanceqty']],
  ['qty', ['qty', 'quantity']],
  ['finalPrice', ['finalprice', 'rate', 'price']],
  ['netAmount', ['netamt', 'netamount', 'amount']],
];
const MOVE_BY_HEAD = new Map(MOVE_COLUMNS.flatMap(([key, heads]) => heads.map((h) => [h, key])));
/* the same headings as they run together on a line with single spaces -
   longest first, so SUPPLIER/CUST/LOCATION is not read as LOCATION */
const MOVE_PHRASES = [
  ['party', /SUPPLIER\s*\/\s*CUST(OMER)?\s*\/\s*LOCATION/], ['finalPrice', /FINAL\s+PRICE/], ['netAmount', /NET\s+AM(OUN)?T/],
  ['docDate', /DOC\.?\s+DATE/], ['docNo', /DOC\.?\s+NO\.?/], ['stockPoint', /STOCK\s+POINT/], ['particulars', /PARTICULARS|MESSAGE|NARRATION/],
  ['location', /LOCATION/], ['docType', /\bTYPE\b/], ['receipts', /RECEIPTS?/], ['issues', /ISSUES?/], ['balance', /BALANCE/], ['qty', /\bQTY\b|QUANTITY/],
];
const MOVE_NUMBERS = ['receipts', 'issues', 'balance', 'qty', 'finalPrice', 'netAmount'];
/* which blank a row most likely has, first */
const BLANK_FIRST = ['qty', 'balance', 'finalPrice', 'netAmount', 'issues', 'receipts'];

/* "2025-09-01 19:12:28", "2026-09-02 03:08 PM", "01-09-2025 19:12" */
const DATE_RE = /(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([AaPp])\.?[Mm]\.?)?)?|(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([AaPp])\.?[Mm]\.?)?)?/;
const NUMBER_CELL = /^[-+]?(\d{1,3}(,\d{2,3})+|\d+)?(\.\d+)?$/;
const isNumberCell = (text) => NUMBER_CELL.test(String(text).trim()) && /\d/.test(text);

/* text as read: non-breaking spaces as spaces, one kind of line ending,
   trimmed lines, no empty ones, a leading "- " bullet dropped */
export function normaliseLines(text) {
  return String(text ?? '').replace(/ /g, ' ').replace(/\r\n?/g, '\n').split('\n')
    .map((l) => l.replace(/^[ \t]*[-•*][ \t]+/, '').trim())
    .filter(Boolean);
}

/* a line's cells: tabs as a browser copies a table (empty cells kept), " | ",
   or runs of two or more spaces; a line with single spaces only is one cell */
function cellsOf(line) {
  const text = String(line ?? '');
  if (text.includes('\t')) return text.split('\t').map((c) => c.trim());
  if (/\|/.test(text)) return text.split(/\s*\|\s*/).map((c) => c.trim());
  return text.split(/\s{2,}/).map((c) => c.trim());
}
/* the first non-empty cell of some text - a labelled value's own cell. A
   column break is a tab or " | ", or a run of spaces before another label
   ("GST 5 %   Unit: Pc(s)"); a double space inside a value ("KARNATAKA
   SAREE CENTRE,  MYSORE (G524)") is not one */
const firstCellOf = (text) => String(text ?? '')
  .split(/\t|\s*\|\s*|\s{2,}(?=[\p{L}][\p{L} .()/&'-]{0,40}?\s*:)/u)
  .map((c) => c.trim()).find((c) => c !== '') || '';
/* A label at the start of a cell -> { key, value }. value '' when nothing
   follows the label (its value is in the next cell or on the next line),
   null when what follows is no value at all ("Item Code *"). */
const labelIn = (text) => {
  const t = String(text ?? '');
  /* a cell that is nothing but a label ("GRC No", "Item Name") - its value
     is in the next cell or on the next line */
  const exact = keyOfLabel(t.replace(/\s*:\s*$/, ''));
  if (exact) return { key: exact, value: '' };
  for (const { key, re, colon } of LABEL_RES) {
    const m = t.match(re);
    if (!m) continue;
    /* "Unit Price : 1590" - the start of a longer label, not this one */
    if (!colon.test(t) && LONGER_LABEL.test(m[1])) return null;
    if (cell(m[1]) === '') return { key, value: '' };
    /* the "*" a form prints beside a required field is not part of its
       value: "Item Code * 9A2890" is 9A2890 */
    return { key, value: hasValue(m[1]) ? cell(m[1]).replace(/^\*+\s*/, '') : null };
  }
  return null;
};
const num = (text) => { const n = numberText(text); return n === '' || !isNumber(n) ? 0 : Number(n); };

/* "2025-09-01 19:12:28" (or "2026-09-02 03:08 PM", "01-09-2025 19:12") ->
   a Date, read as India time unless the text names a zone */
export function istDate(text) {
  const m = cell(text).match(DATE_RE);
  if (!m) return null;
  const [y, mo, d, h, mi, s, ap] = m[1] ? [m[1], m[2], m[3], m[4], m[5], m[6], m[7]] : [m[10], m[9], m[8], m[11], m[12], m[13], m[14]];
  let hour = Number(h || 0);
  if (ap) hour = (hour % 12) + (/p/i.test(ap) ? 12 : 0);
  const pad = (v) => String(v).padStart(2, '0');
  const date = new Date(`${y}-${pad(mo)}-${pad(d)}T${pad(hour)}:${pad(mi || 0)}:${pad(s || 0)}+05:30`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/* The key a re-import dedupes a movement row on. */
export function movementKey(m) {
  const date = m?.docDate instanceof Date ? m.docDate.toISOString() : cell(m?.docDate);
  return [m?.docType, m?.docNo, date, m?.location, m?.stockPoint].map((v) => cell(v).toLowerCase()).join('|');
}

/* "GST 5 %" -> 5 */
export const gstPercent = (text) => {
  const m = cell(text).match(/(\d+(?:\.\d+)?)\s*%?/);
  return m ? Number(m[1]) : null;
};

/* "KARNATAKA SAREE CENTRE, MYSORE (G524)" -> { name, code } */
export function splitSupplier(text) {
  const raw = cell(text);
  const m = raw.match(/^(.*?)\s*\(\s*([A-Za-z]{0,4}\d+[A-Za-z0-9]*)\s*\)\s*$/);
  return m ? { name: m[1].trim(), code: m[2].toUpperCase() } : { name: raw, code: '' };
}

/* A movement's document type, from its Type column - or, in the layout that
   has a Message instead, from what the message says. */
export function docTypeOf(text) {
  const t = cell(text);
  if (/delivery\s+challan|\bD\.?C\b/i.test(t)) return 'Delivery Challan';
  if (/\bGRC\b|purchase|received\s+from\s+supplier/i.test(t)) return 'GRC';
  if (/sales?\s+return|return/i.test(t)) return 'Return';
  if (/\bsale|sold|invoice|\bPOS\b/i.test(t)) return 'Sale';
  if (/transfer/i.test(t)) return 'Transfer';
  return '';
}

/* The movements' own totals, and whether they agree with the ones printed. */
export function movementTotals(movements, printed = null) {
  const sum = (key) => Math.round((movements || []).reduce((a, m) => a + (Number(m[key]) || 0), 0) * 100) / 100;
  const computed = { receipts: sum('receipts'), issues: sum('issues'), netAmount: sum('netAmount') };
  computed.balance = Math.round((computed.receipts - computed.issues) * 1000) / 1000;
  const mismatches = printed
    ? ['receipts', 'issues', 'balance', 'netAmount'].filter((k) => printed[k] !== undefined && printed[k] !== null && Math.abs(Number(printed[k])) !== Math.abs(computed[k]))
    : [];
  return { computed, printed, mismatches };
}

/* The movement table's heading line -> its columns in order, or null. */
function movementHeader(line) {
  const upper = cell(line).toUpperCase();
  if (!/DOC\.?\s*DATE/.test(upper) || !(/DOC\.?\s*NO/.test(upper) || /RECEIPT|ISSUE/.test(upper))) return null;
  /* a caption before the headings: "Stock movement rows (Location | ...)",
     "Movement columns: Location | ..." */
  const cells = cellsOf(line.replace(/^[^(]*\(/, '').replace(/\)+\s*$/, '').replace(/^[^|\t:]*:\s*/, ''));
  let keys;
  if (cells.length > 2) {
    keys = cells.map((c) => MOVE_BY_HEAD.get(squash(c)) || null);
  } else {
    /* one run of single spaces: find each heading, in the order they stand */
    const found = [];
    let rest = upper;
    MOVE_PHRASES.forEach(([key, re]) => {
      const g = new RegExp(re.source, 'g');
      let m;
      while ((m = g.exec(rest))) {
        found.push({ key, at: m.index });
        rest = rest.slice(0, m.index) + ' '.repeat(m[0].length) + rest.slice(m.index + m[0].length);
        g.lastIndex = m.index + m[0].length;
      }
    });
    keys = found.sort((a, b) => a.at - b.at).map((f) => f.key);
  }
  if (!keys.includes('docDate')) return null;
  const firstNumber = keys.findIndex((k) => MOVE_NUMBERS.includes(k));
  return {
    keys,
    text: (firstNumber < 0 ? keys : keys.slice(0, firstNumber)),
    numbers: firstNumber < 0 ? [] : keys.slice(firstNumber).filter((k) => MOVE_NUMBERS.includes(k)),
  };
}

/* Whether one reading of a movement's numbers adds up: the Qty (or, when it
   is blank, the receipt / issue) times the Final Price is the Net Amt, a Qty
   given is the receipt or the issue, and a Balance given is the running or
   the row's own balance. */
function readingOf(values, previous) {
  const R = Math.abs(values.receipts ?? 0);
  const I = Math.abs(values.issues ?? 0);
  const qtyGiven = values.qty !== null && values.qty !== undefined;
  const qty = qtyGiven ? Math.abs(values.qty) : (R || I);
  if (!(qty > 0)) return null;
  if (qtyGiven && qty !== R && qty !== I) return null;
  const hasPrice = values.finalPrice !== null && values.finalPrice !== undefined;
  const hasNet = values.netAmount !== null && values.netAmount !== undefined;
  if (hasPrice && hasNet && Math.abs(qty * values.finalPrice - Math.abs(values.netAmount)) > 0.01) return null;
  const running = Math.round((previous + R - I) * 1000) / 1000;
  const own = Math.round((R - I) * 1000) / 1000;
  if (values.balance !== null && values.balance !== undefined && values.balance !== running && values.balance !== own) return null;
  return {
    receipts: R, issues: I, qty,
    balance: values.balance ?? running,
    finalPrice: values.finalPrice ?? 0,
    netAmount: Math.abs(values.netAmount ?? 0),
  };
}

/* the numbers of a row -> its numeric columns. As many as there are
   columns: in place. Fewer - a copy that dropped blank cells - each way of
   leaving out that many columns is tried, and the row is read only if every
   reading that adds up says the same thing. */
function numbersOf(values, columns, previous) {
  if (values.length === columns.length) {
    const v = Object.fromEntries(columns.map((k, i) => [k, values[i]]));
    return readingOf(v, previous) || {
      receipts: Math.abs(v.receipts ?? 0), issues: Math.abs(v.issues ?? 0), qty: Math.abs(v.qty ?? (Math.abs(v.receipts ?? 0) || Math.abs(v.issues ?? 0))),
      balance: v.balance ?? 0, finalPrice: v.finalPrice ?? 0, netAmount: Math.abs(v.netAmount ?? 0),
    };
  }
  const missing = columns.length - values.length;
  if (missing < 1 || missing > 2) return null;
  const sets = [];
  const choose = (start, picked) => {
    if (picked.length === missing) { sets.push(picked); return; }
    for (let i = start; i < columns.length; i += 1) choose(i + 1, [...picked, columns[i]]);
  };
  choose(0, []);
  const rank = (set) => set.reduce((a, k) => a + BLANK_FIRST.indexOf(k), 0);
  const readings = sets.sort((a, b) => rank(a) - rank(b)).map((set) => {
    const present = columns.filter((k) => !set.includes(k));
    const v = Object.fromEntries(present.map((k, i) => [k, values[i]]));
    return readingOf(v, previous);
  }).filter(Boolean);
  if (!readings.length) return null;
  const same = (a, b) => ['receipts', 'issues', 'qty', 'finalPrice', 'netAmount'].every((k) => a[k] === b[k]);
  return readings.every((r) => same(r, readings[0])) ? readings[0] : null;
}

/* One movement row -> { location, docDate, docType, docNo, party,
   particulars, stockPoint, receipts, issues, balance, qty, finalPrice,
   netAmount, signedQty } or null. Numbers are taken from the RIGHT; what is
   left of them is text, split on its column breaks, or - when a copy ran the
   columns together with single spaces - by the date and the document number. */
function movementRow(line, head, previous, warn) {
  const cells = cellsOf(line);
  let textCells;
  let numberCells;
  if (cells.length > 1) {
    let i = cells.length - 1;
    const run = [];
    /* a blank cell: empty, or "-" as the report (and an image's text) prints one */
    while (i >= 0 && (isNumberCell(cells[i]) || cell(cells[i]) === '')) { run.unshift(cells[i]); i -= 1; }
    while (run.length && cell(run[0]) === '') { run.shift(); i += 1; }
    /* never more numbers than the table has numeric columns: a document
       number such as 05160 belongs to the text */
    while (run.length > head.numbers.length) { run.shift(); i += 1; }
    textCells = cells.slice(0, i + 1);
    numberCells = run;
  } else {
    const tokens = cell(line).split(' ');
    let i = tokens.length - 1;
    const run = [];
    while (i >= 0 && isNumberCell(tokens[i]) && run.length < head.numbers.length) { run.unshift(tokens[i]); i -= 1; }
    textCells = [tokens.slice(0, i + 1).join(' ')];
    numberCells = run;
  }
  const blanks = numberCells.map((c) => (cell(c) === '' ? null : num(c)));
  const numbers = numbersOf(blanks.length === head.numbers.length ? blanks : blanks.filter((v) => v !== null), head.numbers, previous);
  if (!numbers) return null;

  /* the text side */
  const m = {};
  const keys = head.text;
  if (textCells.length === keys.length) {
    keys.forEach((k, i) => { if (k) m[k] = cell(textCells[i]); });
  } else {
    const joined = textCells.join('\t');
    const date = joined.match(DATE_RE);
    if (!date) return null;
    m.location = cell(joined.slice(0, date.index));
    m.docDate = date[0];
    const after = cellsOf(joined.slice(date.index + date[0].length).replace(/^\t+/, '').trim()).filter((c) => cell(c) !== '');
    const rest = keys.slice(keys.indexOf('docDate') + 1);
    if (after.length === rest.length) rest.forEach((k, i) => { m[k] = cell(after[i]); });
    else {
      /* the columns ran together: the document number is the first word,
         the stock point (when the table has one) the last, the rest is the
         message */
      const words = after.join(' ').split(' ').filter(Boolean);
      if (rest.includes('docNo')) m.docNo = words.shift() || '';
      if (rest.includes('stockPoint') && words.length > 1) m.stockPoint = words.pop();
      m[rest.includes('particulars') ? 'particulars' : 'party'] = words.join(' ');
      warn('columns ran together - read as document no. / message / stock point');
    }
  }
  const docDate = istDate(m.docDate);
  if (!docDate) return null;
  return {
    location: cell(m.location),
    docDate,
    docType: cell(m.docType) || docTypeOf(m.particulars || m.party),
    docNo: cell(m.docNo),
    party: cell(m.party),
    particulars: cell(m.particulars),
    stockPoint: cell(m.stockPoint),
    ...numbers,
    /* receipts and issues are kept as quantities (an issue printed -1 is an
       issue of 1, as the older layout prints it); the direction is here */
    signedQty: Math.round((numbers.receipts - numbers.issues) * 1000) / 1000,
  };
}

/* The page's TOTAL row: "TOTAL  1.00  1.00  0.00" (receipts, issues,
   balance, and a net amount when there are four), or "Totals row: Receipts 1 |
   Issues 1 | Balance 0 | Net Amt 1182.50". */
function totalsOf(line) {
  const text = cell(line).replace(/^(grand\s*)?totals?(\s*row)?\s*:?/i, '');
  const labelled = {};
  text.split(/\s*\|\s*|\t|\s{2,}/).forEach((part) => {
    const m = part.trim().match(/^([A-Za-z][A-Za-z .]*?)\s*:?\s*(-?[\d,.]+)$/);
    const key = m && MOVE_BY_HEAD.get(squash(m[1]));
    if (key) labelled[key] = num(m[2]);
  });
  if (Object.keys(labelled).length) return labelled;
  const values = (text.match(/-?[\d,]*\.?\d+/g) || []).map(num);
  return Object.fromEntries(['receipts', 'issues', 'balance', 'netAmount'].slice(0, values.length).map((k, i) => [k, values[i]]));
}

/* What in the text says it is a Barcode Report Details page. */
function anchorsIn(lines) {
  const found = new Set();
  lines.forEach((line) => {
    BANDS.forEach(([key, words]) => { if (new RegExp('\\b' + words.replace(' ', '\\s+') + '\\b', 'i').test(line)) found.add(key); });
    if (/^barcode\b(?!\s*report)/i.test(line)) found.add('barcode');
    if (movementHeader(line)) found.add('movements');
  });
  return found;
}
const ANCHOR_NAMES = {
  barcode: 'BARCODE heading', itemInfo: 'ITEM INFO', otherInfo: 'OTHER INFO', priceInfo: 'PRICE INFO', designInfo: 'DESIGN INFO',
  supplierDetails: 'SUPPLIER DETAILS', movements: 'movement table (LOCATION / DOC DATE / DOC NO)',
};

/* Where a Details view's own content starts: its "Details" heading, a band,
   the Item Name, a BARCODE line with a number, or the movement table. */
const startsDetails = (line) => {
  const t = cell(line);
  return DETAILS_START.test(t) || Boolean(movementHeader(t)) || /^item\s*name\b/i.test(t)
    || (/^barcode\b(?!\s*report)/i.test(t) && hasValue(t.replace(/^barcode\s*(no\.?|number)?\s*:?/i, '')));
};

/* A copied page's Filters panel ("Filters", "Item Code *", "Business
   Location:" and its list) is the search form above the Details, never
   data: from a "Filters" line to where the Details start, nothing is read -
   but for what its Item Code box holds (`searched`, see searchedCode), the
   code the page was searched by. No "Filters" line, or no Details after it:
   nothing is dropped. */
function withoutFilters(lines) {
  const from = lines.findIndex((l) => /^filters?\s*:?$/i.test(cell(l)));
  const to = from < 0 ? -1 : lines.findIndex((l, i) => i > from && startsDetails(l));
  if (to < 0) return { lines, skipped: 0, from: -1, searched: null };
  const panel = lines.slice(from, to).map((l) => ({ cells: cellsOf(l).filter((c) => c !== '').map((text) => ({ text: cell(text) })) }));
  return { lines: [...lines.slice(0, from), ...lines.slice(to)], skipped: to - from, from, searched: searchedCode(panel) };
}

/* The Filters panel's ITEM CODE - what the page was searched by, which on
   the other ERP is the barcode ("Item Code * 9A2890"). Its value in the
   label's own cell, the next cell on its row, or - on a screenshot, where
   the input box shows it under its label - the cell under the label (by
   position; `geo`). Only a value shaped like a barcode, and never a label
   ("Item Code *  Business Location:"): a copied page, whose input boxes do
   not copy, has none. `rows` - [{ cells: [{ text, confidence, x0, x1, h }] }].
   Returns { value, confidence } or null. */
function searchedCode(rows, { geo = false } = {}) {
  /* a screenshot's input box: its border is read as "|" (or a bracket),
     alone or stuck to the value - never part of it */
  const BORDER = /^[\s|[\](){}]+|[\s|[\](){}]+$/g;
  const take = (c, text = c?.text) => {
    const v = closeSeparators(String(text ?? '').replace(/^\*+\s*/, '').replace(BORDER, ''));
    return v && barcodeShaped(v, { loose: true }) && !labelOfCell(v) ? { value: v, confidence: c?.confidence ?? null } : null;
  };
  const filled = (c) => hasValue(String(c?.text ?? '').replace(BORDER, ''));
  for (let i = 0; i < rows.length; i += 1) {
    const cells = rows[i].cells || [];
    for (let ci = 0; ci < cells.length; ci += 1) {
      const c = cells[ci];
      const m = String(c.text ?? '').match(/^item\s*code\b\s*\*?\s*:?\s*(.*)$/i);
      if (!m) continue;
      if (cell(m[1]) !== '') return take(c, m[1]);
      const h = c.h || 14;
      const next = cells.slice(ci + 1).find(filled);
      if (next && !labelOfCell(next.text) && !labelIn(next.text) && (!geo || next.x0 - c.x1 <= 6 * h)) {
        const got = take(next);
        if (got) return got;
      }
      if (geo && rows[i + 1]) {
        const under = (rows[i + 1].cells || []).filter((u) => filled(u) && u.x1 >= c.x0 - 2 * h && u.x0 <= c.x1 + 2 * h)
          .sort((a, b) => Math.abs(a.x0 - c.x0) - Math.abs(b.x0 - c.x0));
        return take(under[0]);
      }
      return null;
    }
  }
  return null;
}

/* Each barcode's lines: a new one starts at a second BARCODE line or a
   second ITEM INFO band. */
function blocksOf(lines) {
  const blocks = [];
  let current = null;
  lines.forEach((line) => {
    const isBarcode = /^barcode\b(?!\s*report)/i.test(line);
    const isItem = /\bitem\s+info\b/i.test(line);
    if (!current || (isBarcode && (current.barcode || current.item)) || (isItem && current.item)) {
      current = { lines: [], barcode: false, item: false };
      blocks.push(current);
    }
    if (isBarcode) current.barcode = true;
    if (isItem) current.item = true;
    current.lines.push(line);
  });
  return blocks.map((b) => b.lines);
}

/* ONE barcode's lines -> { record, warnings }. */
function readDetailsBlock(lines, { barcode = '', line: first = 1, detection = null, searched = null, minConfidence = 0 } = {}) {
  const found = {};
  const warnings = [];
  const movements = [];
  const stock = [];
  let head = null;
  let printedTotals = null;
  let pending = null;
  let band = '';

  const setField = (key, value) => {
    const v = cell(value);
    if (v === '' || !hasValue(v)) return;
    if (found[key] === undefined) found[key] = v;
    else if (key === 'gstSlab' && gstPercent(found[key]) !== gstPercent(v)) warnings.push(`GST Slab is printed twice, as "${found[key]}" and "${v}" - the first was used`);
  };

  lines.forEach((raw, index) => {
    const at = first + index;
    /* the movement table's heading first: a caption before it must not read as noise */
    const header = movementHeader(raw);
    if (header) { head = header; pending = null; return; }
    if (NOISE.test(raw)) return;
    if (head) {
      if (/^(grand\s*)?totals?\b/i.test(raw)) { printedTotals = totalsOf(raw); return; }
      if (DATE_RE.test(raw)) {
        const prev = movements.length ? movements[movements.length - 1].balance : 0;
        const notes = [];
        const m = movementRow(raw, head, prev, (w) => notes.push(w));
        if (!m) {
          warnings.push(`Movement on line ${at} could not be read (its numbers do not fit the ${head.numbers.length} columns) - it was left out: "${raw.slice(0, 80)}"`);
          return;
        }
        notes.forEach((w) => warnings.push(`Movement on line ${at}: ${w}`));
        m.key = movementKey(m);
        if (!movements.some((x) => x.key === m.key)) movements.push(m);
        return;
      }
      /* the stock-by-location summary: "location | stock point | qty" */
      const cells = cellsOf(raw).filter((c) => cell(c) !== '');
      if (cells.length >= 2 && cells.length <= 3 && isNumberCell(cells[cells.length - 1]) && !labelIn(cells[0]) && !isNumberCell(cells[0])) {
        stock.push({ location: cell(cells[0]), stockPoint: cells.length === 3 ? cell(cells[1]) : '', qty: num(cells[cells.length - 1]) });
        return;
      }
      if (/^location\b.*stock\s*point/i.test(raw)) return;
    }

    /* the band this line is in, and the line without its heading */
    const bands = [...raw.matchAll(BAND_RE)];
    if (bands.length) band = bands[bands.length - 1][1].toLowerCase().replace(/\s+/g, ' ');
    const line = raw.replace(BAND_RE, '\t').replace(/^[\t\s:]+/, '').trim();
    if (!line) return;

    /* KEY : VALUE pairs anywhere on the line - a value runs to the next
       pair or the end of its own cell, never across a column break into
       whatever the next column holds ("GST Slab: GST 5 % | Unit: Pc(s)") */
    const pairs = [...line.matchAll(COLON_LABELS)];
    if (pairs.length) {
      pairs.forEach((p, i) => {
        const end = i + 1 < pairs.length ? pairs[i + 1].index : line.length;
        setField(keyOfLabel(p[1]), cell(line.slice(p.index + p[0].length, end)));
      });
      pending = null;
      return;
    }

    /* labels at the start of cells, a value in the next cell or line */
    const cells = cellsOf(line);
    let consumed = false;
    for (let c = 0; c < cells.length; c += 1) {
      const hit = labelIn(cells[c]);
      if (!hit) {
        if (pending && c === 0) { setField(pending, cells[c]); pending = null; consumed = true; }
        else if (band === 'supplier details' && !found.supplier && c === 0) { setField('supplier', cells[c]); consumed = true; }
        continue;
      }
      consumed = true;
      if (hit.value !== '') { setField(hit.key, hit.value); pending = null; continue; }
      const next = cells[c + 1];
      if (next !== undefined && next !== '' && !labelIn(next)) { setField(hit.key, next); c += 1; pending = null; } else pending = hit.key;
    }
    if (!consumed && pending) { setField(pending, line); pending = null; }
  });

  /* THE BARCODE (user, 2026-09-30), in this order - and never the ECom ID,
     HSN, GRC No, an invoice, a price or a movement's number, whatever it
     looks like (those are their labels' values, see detectBarcodes):
       1. EXPLICIT: the page's BARCODE label (or the number typed for it -
          the two different: the page is read under neither, a number left
          in the box from another page would take this page's item)
       2. the one value the page prints on its own - the number under its
          barcode's bars - by the same detection an image goes through; the
          server takes it only as a barcode of this ERP's format or one it
          holds (classifyRecords)
       3. the ITEM CODE - the page's "Item Code:", or on a screenshot what
          its Filters panel was searched by: on the other ERP the Item Code
          IS the barcode when the page prints no separate one. Never an
          Item Code that is the Item Name (that is the item, not a barcode)
       none: BARCODE REQUIRED - to be typed in the preview.
     `detection` - an image's own (detectBarcodes over OCR's words, by
     position), else this block's text is looked at. */
  const problems = [];
  const notes = [];
  const typed = closeSeparators(barcode);
  let printed = cell(found.barcode);
  if (printed && !barcodeShaped(printed, { loose: true })) {
    warnings.push(`The page's BARCODE line reads "${printed.slice(0, 40)}" - not a barcode number, so it was not used`);
    printed = '';
  }
  if (printed && typed && barcodeKey(printed) !== barcodeKey(typed)) {
    problems.push({ field: 'barcode', message: `The page prints barcode ${printed} but ${typed} is typed - correct the Barcode and Check again` });
  }
  const seen = detection || detectBarcodes(lines, { textInput: true });
  const alone = seen.candidates.filter((c) => c.source === 'standalone');
  /* the Item Code as the page gives it: its own label, else its Filters box */
  const unsureOf = (c) => c && c.confidence !== null && c.confidence !== undefined && minConfidence && c.confidence < minConfidence;
  const filterCode = searched || seen.searched || null;
  if (!found.itemCode && unsureOf(filterCode)) {
    notes.push(`The Filters panel's Item Code was read as "${filterCode.value}", but OCR is not sure of it (${Math.round(filterCode.confidence)}% sure) - it was not used`);
  }
  const itemCodeRead = cell(found.itemCode) || (filterCode && !unsureOf(filterCode) ? filterCode.value : '');
  const itemCodeFrom = found.itemCode ? 'label' : itemCodeRead ? 'filters' : '';
  const isItemName = (v) => normName(v) !== '' && normName(v) === normName(found.itemName);
  let code = '';
  let from = '';
  let reason = '';
  let candidate = null;
  if (printed || typed) {
    code = printed || typed;
    from = printed ? 'label' : 'typed';
    reason = printed ? 'The page labels it as its barcode.' : 'Typed by you.';
  } else if (alone.length === 1 || (alone.length > 1 && alone.filter((c) => barcodeKey(c.value) === barcodeKey(itemCodeRead)).length === 1)) {
    const pick = alone.length === 1 ? alone[0] : alone.find((c) => barcodeKey(c.value) === barcodeKey(itemCodeRead));
    code = pick.value;
    from = 'standalone';
    reason = 'Printed on its own on the page (the number under its barcode).';
    candidate = { source: 'standalone', digitsOnly: false, label: '', line: first + pick.line - 1 };
  } else if (alone.length > 1) {
    problems.push({ field: 'barcode', message: `The page prints more than one value that could be its barcode (${alone.map((c) => c.value).join(', ')}) - type the right one as the Barcode` });
  }
  if (!code && !problems.length && itemCodeRead) {
    if (isItemName(itemCodeRead)) {
      notes.push(`The Item Code (${itemCodeRead}) is the Item Name - the item, not a barcode - so it was not used`);
    } else if (!barcodeShaped(itemCodeRead, { loose: true })) {
      notes.push(`The Item Code "${itemCodeRead.slice(0, 40)}" is not a barcode number, so it was not used`);
    } else {
      code = closeSeparators(itemCodeRead);
      from = 'item_code';
      reason = 'No separate barcode was found, so the Item Code is being used as the barcode.';
      candidate = { source: 'item_code' };
    }
  }
  /* the Item Code and the barcode taken both there, and different */
  if (code && from !== 'item_code' && itemCodeRead && !isItemName(itemCodeRead) && barcodeShaped(itemCodeRead, { loose: true })
    && barcodeKey(itemCodeRead) !== barcodeKey(code) && itemCodeFrom === 'filters') {
    notes.push(`The Filters panel was searched by ${itemCodeRead}, but the page shows ${code} - ${code} was used; correct the Barcode if that is wrong`);
  }
  if (code && itemCodeRead && barcodeKey(itemCodeRead) === barcodeKey(code) && from !== 'item_code') reason += ' It matches the Item Code.';
  const totals = movementTotals(movements, printedTotals);
  if (totals.mismatches.length) {
    warnings.push(`The movements add up to ${totals.mismatches.map((k) => `${k} ${totals.computed[k]}`).join(', ')}, but the page's totals say ${totals.mismatches.map((k) => `${k} ${printedTotals[k]}`).join(', ')}`);
  }
  /* the quantity the barcode was received with: the receipt that brought it
     in - its first GRC receipt, else its first receipt of any kind. Never
     the receipts added up: a piece sent out and returned is received twice
     and is still one piece */
  const grcReceipt = movements.find((m) => m.docType === 'GRC' && m.receipts > 0);
  const firstReceipt = grcReceipt || movements.find((m) => m.receipts > 0);
  let receivedQty = firstReceipt ? firstReceipt.receipts : 0;
  let qtyFrom = firstReceipt ? 'details_receipt' : '';
  if (firstReceipt && !grcReceipt) {
    warnings.push(`No GRC receipt among the movements - the quantity (${receivedQty}) is the first receipt's (${[firstReceipt.docType, firstReceipt.docNo].filter(Boolean).join(' ') || 'the first movement'})`);
  }
  if (!firstReceipt) {
    const held = stock.reduce((a, s) => a + s.qty, 0);
    const printedIn = Math.abs(Number(printedTotals?.receipts) || 0);
    if (!movements.length && printedIn > 0 && !(Math.abs(Number(printedTotals?.issues) || 0) > 0)) {
      /* the rows could not be read but the TOTAL row could - and with
         nothing issued it cannot hold a return received again */
      receivedQty = printedIn;
      qtyFrom = 'details_receipt';
      warnings.push(`The movement rows could not be read - the quantity (${printedIn}) is the page's TOTAL receipts`);
    } else if (held > 0) {
      receivedQty = held;
      qtyFrom = 'details_stock';
      warnings.push(`No receipt among the movements - the quantity (${held}) is the stock the page shows`);
    } else if (printedTotals && !movements.length) {
      warnings.push('The movement rows could not be read, so the quantity received is not known - copy the page again (its movement table with its tabs)');
    }
  }
  /* the GRC it came in on: the one the page names - one GRC number, else it
     is not used - otherwise its GRC receipt's */
  const grcFromMoves = grcReceipt?.docNo || '';
  let grcNamed = cell(found.grcNo).replace(/^GRC\s*/i, '');
  if (grcNamed && !/^[A-Za-z0-9/-]{1,20}$/.test(grcNamed)) {
    warnings.push(`The page's GRC No reads "${grcNamed.slice(0, 40)}" - not one GRC number, so ${grcFromMoves ? `its GRC receipt's ${grcFromMoves} was used` : 'it was not used'}`);
    grcNamed = '';
  }
  if (grcNamed && grcFromMoves && !sameGrc(grcNamed, grcFromMoves)) {
    warnings.push(`The page names GRC ${grcNamed} but its GRC receipt is ${grcFromMoves} - GRC ${grcNamed} was used`);
  }
  const supplier = splitSupplier(found.supplier);

  /* the item: the page's Item Code - unless that is the barcode itself,
     when the item is its Item Name */
  const itemCodeIsBarcode = Boolean(code && found.itemCode && barcodeKey(found.itemCode) === barcodeKey(code));
  const values = normaliseRecord({
    barcode: code,
    itemCode: itemCodeIsBarcode ? found.itemName : (found.itemCode || found.itemName),
    description: found.description || '',
    qty: receivedQty ? String(receivedQty) : '',
    uom: found.uom || '',
    hsn: found.hsn,
    purRate: found.purRate,
    finalNet: found.finalNet,
    gst: gstPercent(found.gstSlab) ?? '',
    retailPrice: found.rsp,
    wspPrice: found.wsp,
    dpPrice: found.dp,
    grcNo: grcNamed || grcFromMoves,
  });
  /* where each value came from - shown in the preview */
  const sources = {
    barcode: { label: 'details_label', typed: 'typed_barcode', standalone: 'detected_barcode', item_code: 'item_code' }[from] || '',
    itemCode: values.itemCode ? 'details_label' : '',
    qty: values.qty ? qtyFrom : '',
    uom: values.uom ? 'details_label' : '',
    retailPrice: values.retailPrice ? 'details_label' : '',
  };
  const details = {
    itemName: cell(found.itemName || (itemCodeIsBarcode ? '' : found.itemCode)),
    /* as the page gives them - shown in the preview; the whole page is kept
       too (payload) */
    pageItemCode: itemCodeRead,
    ecomId: cell(found.ecomId),
    consignment: cell(found.consignment),
    invoiceNo: cell(found.invoiceNo),
    note: cell(found.note),
    group: cell(found.group),
    subGroup: cell(found.subGroup),
    gstSlab: cell(found.gstSlab),
    pma: cell(found.pma),
    designNo: cell(found.designNo),
    supplier: cell(found.supplier),
    supplierCode: supplier.code,
    taxRegion: cell(found.taxRegion),
    discount: isNumber(numberText(found.discount)) ? String(num(found.discount)) : cell(found.discount),
    wsp: values.wspPrice,
    dp: values.dpPrice,
    movements,
    stock,
    totals,
    payload: lines.join('\n').slice(0, 20000),
  };
  /* per field, for the preview - a field that could not be read never fails
     the whole paste */
  if (!code && !problems.length) problems.push({ field: 'barcode', message: 'BARCODE REQUIRED - the page shows no Barcode and no Item Code to use as one; type the barcode' });
  if (!details.itemName) problems.push({ field: 'itemName', message: 'No Item Name was found on this page' });
  /* what the page could not settle about its barcode holds it back on the
     server too (classifyRecords takes `review` as problems) */
  const review = problems.filter((p) => p.field === 'barcode');
  return {
    record: {
      line: first, values, details, problems, sources,
      /* how the barcode was found - shown as BARCODE IDENTIFICATION */
      identify: { value: code, from, reason, itemCode: itemCodeRead, itemCodeFrom, notes },
      ...(review.length ? { review } : {}),
      ...(candidate ? { candidate } : {}),
    },
    warnings,
  };
}

/* Two GRC numbers are one when they say the same number: "05165", "5165"
   and "GRC 05165" are one GRC. */
export function sameGrc(a, b) {
  const x = cell(a).replace(/^GRC\s*(no\.?|number)?\s*:?\s*/i, '');
  const y = cell(b).replace(/^GRC\s*(no\.?|number)?\s*:?\s*/i, '');
  if (!x || !y) return false;
  if (/^\d+$/.test(x) && /^\d+$/.test(y)) return Number(x) === Number(y);
  return x.toLowerCase() === y.toLowerCase();
}

/* The Details labels a text prints ("Item Name", "HSN", "Purchase Rate",
   "RSP" ...), each once. */
function labelsIn(lines) {
  const keys = new Set();
  lines.forEach((line) => {
    [...String(line).matchAll(COLON_LABELS)].forEach((m) => { const key = keyOfLabel(m[1]); if (key) keys.add(key); });
    cellsOf(line).forEach((c) => { const hit = labelIn(c); if (hit) keys.add(hit.key); });
  });
  return keys;
}

/* Whether a text is a Barcode Report Details page at all: one of its
   headings (a band, the BARCODE line, the movement table) with a field of
   it, or three of its fields. A sticker, a bill or any other screenshot is
   not - and is never read as one. */
export function looksLikeDetails(lines) {
  const anchors = anchorsIn(lines);
  const keys = labelsIn(lines);
  return anchors.has('movements') || (anchors.size > 0 && keys.size > 0) || keys.size >= 3;
}

/* Pasted Details text (one barcode or several) -> { records, warnings,
   error, notReport }. `barcode` is used for a single page that prints no
   number. `image` - { lines, minConfidence } for a text OCR read from a
   screenshot: its barcode is found over OCR's words, by where each stands
   and how sure OCR was of it (detectBarcodes). */
export function readDetailsPages(text, { barcode = '', image = null } = {}) {
  const { lines, searched } = withoutFilters(normaliseLines(text));
  if (!looksLikeDetails(lines)) {
    return {
      records: [], warnings: [], notReport: true,
      error: 'This does not appear to be a Barcode Report - none of its headings (ITEM INFO, PRICE INFO, SUPPLIER DETAILS, the stock movements) '
        + 'or fields (Item Name, HSN, Purchase Rate, RSP ...) were found. Copy the whole Barcode Details page, or the report table from its "Barcode" heading to the last row.'
        + ` (First lines: ${lines.slice(0, 3).map((l) => `"${l.slice(0, 60)}"`).join(' | ') || '(nothing)'})`,
    };
  }
  const anchors = anchorsIn(lines);
  const blocks = blocksOf(lines);
  const one = blocks.length === 1;
  /* a screenshot's barcode, found over its words - one page per image */
  const detection = image && one ? detectBarcodes(image.lines, { minConfidence: image.minConfidence || 0 }) : null;
  const warnings = [];
  const records = [];
  let at = 1;
  blocks.forEach((block, i) => {
    const read = readDetailsBlock(block, {
      barcode: one ? barcode : '', line: at, detection, searched: one ? searched : null, minConfidence: image?.minConfidence || 0,
    });
    at += block.length;
    const label = blocks.length > 1 ? `Barcode ${i + 1}: ` : '';
    read.warnings.forEach((w) => warnings.push(label + w));
    records.push({ ...read.record, line: i + 1 });
  });
  /* which parts of the page were there - said only when a page's item could
     not be read, where it explains why */
  const missing = ['barcode', 'itemInfo', 'priceInfo', 'supplierDetails', 'movements'].filter((k) => !anchors.has(k));
  if (missing.length && records.some((r) => r.problems.some((p) => p.field === 'itemName'))) {
    warnings.push(`Found: ${[...anchors].map((k) => ANCHOR_NAMES[k]).join(', ') || 'no headings'}. Missing: ${missing.map((k) => ANCHOR_NAMES[k]).join(', ')}`);
  }
  return { records, warnings, error: '', detection };
}

/* The first page of readDetailsPages, as { record, warnings, error }. */
export function readDetailsText(text, { barcode = '' } = {}) {
  const read = readDetailsPages(text, { barcode });
  const record = read.records[0] || null;
  if (!record) return { record: null, warnings: read.warnings, error: read.error };
  const noCode = !record.values.barcode;
  return { record, warnings: read.warnings, error: noCode ? 'BARCODE REQUIRED - this Details page shows no Barcode and no Item Code to use as one; type the barcode.' : '' };
}

/* ------------------------------------ the barcode, and nothing else ------ */

/* the printed name of a Details label, for saying what a value is */
const DETAIL_NAMES = {
  barcode: 'Barcode', itemName: 'Item Name', itemCode: 'Item Code', subGroup: 'Sub Group', group: 'Group', hsn: 'HSN',
  gstSlab: 'GST Slab', pma: 'P-M-F', purRate: 'Purchase Rate', discount: 'Discount', finalNet: 'Final Rate', rsp: 'RSP',
  wsp: 'WSP', dp: 'DP', designNo: 'Design No', supplier: 'Supplier', taxRegion: 'Tax Region', uom: 'UOM',
  description: 'Description', grcNo: 'GRC No', ecomId: 'ECom ID', consignment: 'Is Consignment', invoiceNo: 'Purchase Invoice', note: 'Note',
};
/* what a labelled value is, when its label is not the barcode's */
const VALUE_KINDS = {
  hsn: 'an HSN code', grcNo: 'a GRC number', gstSlab: 'a GST slab', gst: 'a GST rate', uom: 'a unit', qty: 'a quantity',
  purRate: 'a price', finalNet: 'a price', rsp: 'a price', wsp: 'a price', dp: 'a price', discount: 'a discount',
  retailPrice: 'a price', offerPrice: 'a price', wspPrice: 'a price', dpPrice: 'a price',
  itemName: 'an item', itemCode: 'an item', description: 'a description', supplier: 'a supplier', designNo: 'a design',
  taxRegion: 'a tax region', pma: 'a P-M-F', group: 'a group', subGroup: 'a sub group',
  ecomId: 'an ECom ID', consignment: 'a consignment flag', invoiceNo: 'a purchase invoice number', note: 'a note',
};
/* a code - letters and digits, one token ("TWN0LPID") - that may be the
   other part of a value OCR split across lines */
const CODE_LIKE = /^(?=.*[A-Za-z])[A-Za-z0-9]{4,}$/;
/* any label a page prints, known here or not ("ECom ID:", "Purchase
   Invoice :", "Is Consignment:"): up to five words, no digits, a colon */
const ANY_LABEL = /^([A-Za-z][A-Za-z .()/&'-]{0,40}?)\s*:\s*(.*)$/;
const labelOfCell = (text) => {
  const m = String(text ?? '').match(ANY_LABEL);
  if (!m || cell(m[1]).split(' ').length > 5) return null;
  return { label: cell(m[1]), value: cell(m[2]) };
};
/* the label pairs of one cell - "HSN: 55151130 GST Slab: GST 5 %" is two -
   or null when the cell does not start with a label */
function pairsIn(text) {
  const t = cell(text);
  if (!labelOfCell(t)) return null;
  const cuts = [0, ...[...t.matchAll(COLON_LABELS)].map((m) => m.index).filter((i) => i > 0)];
  return cuts.map((from, i) => labelOfCell(t.slice(from, cuts[i + 1] ?? t.length))).filter(Boolean);
}
const labelKey = (label) => keyOfLabel(label) || FIELD_BY_ALIAS.get(squash(label)) || '';

/* What a value on its own is, when it is not shaped like a barcode */
function notABarcode(text) {
  const t = cell(text);
  if (/^[-+]?[\d,]*\.\d+%?$/.test(t) || /^[₹$]/.test(t)) return 'an amount, not a barcode';
  if (DATE_RE.test(t)) return 'a date, not a barcode';
  if (/^\d{1,2}[:.]\d{2}/.test(t)) return 'a time, not a barcode';
  if (/^[-/_.]|[-/_.]$/.test(t)) return 'a piece of a longer value, not a barcode';
  if (/[-/]/.test(t)) return `not a barcode on its own ("${t.match(/[-/]/)[0]}" in it) - a barcode is never cut out of a longer value`;
  return 'not shaped like a barcode';
}

/* THE BARCODE, AND NOTHING ELSE, of what an image (or a text) shows.

   A screenshot of an item's Details page prints dozens of values - an ECom
   ID, a GRC No, an HSN, prices, a quantity, the movements - and at most one
   of them is the barcode. Only these are ever offered as one:
     label       the value of a label that names the barcode ("Barcode :")
     standalone  a value printed on its own, with no label - the number under
                 a barcode's bars, a sticker's number
     typed       the number the operator typed in the Barcode box
   Anything under another label is that label's value, whatever it looks
   like: "ECom ID: 9A1136-TWN0LPID" is an ECom ID, never cut down to
   "9A1136"; "GRC No: 05165" a GRC number; "RSP: 1590" a price. And nothing
   is taken for a barcode by its look alone - a standalone value is only
   OFFERED; the server takes it when it is in this ERP's barcode format
   (a Barcode Setting series, a composed value) or this ERP holds it
   (classifyRecords). The Filters panel and the movement table are skipped.

   `lines` - OCR's [{ cells: [{ text, confidence }] }] (confidence 0-100),
   or a text's lines. A value OCR was less sure of than `minConfidence` is
   never offered: OCR can misread one barcode as another that also exists.
   `textInput` - a pasted page, which takes its barcode from its BARCODE line
   or the Barcode box only: a standalone value is reported, not offered.

   Returns { candidates: [{ value, source, line, label, confidence,
   digitsOnly }], rejected: [{ value, reason, line }], itemName, grcNo -
   what the page names, to compare with the barcode's unit - details (it is
   an item-details page), skipped: { filters, movements }, searched - the
   Filters panel's Item Code, { value, confidence } or null }. */
export function detectBarcodes(lines, { typed = '', minConfidence = 0, textInput = false } = {}) {
  const num = (v) => (v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
  const rows = (lines || []).map((l, i) => {
    const raw = Array.isArray(l?.cells) ? l.cells : cellsOf(typeof l === 'string' ? l : l?.text).map((text) => ({ text }));
    return {
      at: i + 1,
      cells: raw.map((c) => {
        const o = c && typeof c === 'object' ? c : { text: c };
        return {
          text: cell(o.text), confidence: num(o.confidence), x0: num(o.x0), x1: num(o.x1), h: num(o.h) || null,
          words: Array.isArray(o.words) ? o.words.map((w) => ({ text: String(w?.text ?? ''), confidence: num(w?.confidence) })) : null,
        };
      }).filter((c) => c.text !== ''),
    };
  }).filter((r) => r.cells.length);
  const lineText = (r) => r.cells.map((c) => c.text).join('\t');
  /* where each cell stands, when OCR says (a pasted text has no geometry) */
  const geo = !textInput && rows.some((r) => r.cells.some((c) => c.x0 !== null && c.x1 !== null && c.h));

  /* the Filters panel (from a "Filters" line to where the Details start) and
     the movement table's rows are not looked at */
  const skip = new Set();
  const skipped = { filters: 0, movements: 0 };
  /* what the Filters panel's Item Code box holds - only ever used as the
     barcode when the page shows no other (readDetailsBlock) */
  let searched = null;
  const filtersAt = rows.findIndex((r) => /^filters?\s*:?$/i.test(lineText(r)));
  if (filtersAt >= 0) {
    const detailsAt = rows.findIndex((r, i) => i > filtersAt && startsDetails(lineText(r)));
    if (detailsAt > 0) {
      for (let i = filtersAt; i < detailsAt; i += 1) { skip.add(i); skipped.filters += 1; }
      searched = searchedCode(rows.slice(filtersAt, detailsAt), { geo });
    }
  }
  let details = false;
  let inMoves = false;
  rows.forEach((r, i) => {
    const text = lineText(r);
    if (movementHeader(text)) { inMoves = true; details = true; skip.add(i); return; }
    if (inMoves && (DATE_RE.test(text) || /^(grand\s*)?totals?\b/i.test(text))) { skip.add(i); skipped.movements += 1; return; }
    inMoves = false;
    if (!skip.has(i) && (DETAILS_START.test(text) || new RegExp(BAND_RE.source, 'i').test(text) || /^item\s*name\b/i.test(text))) details = true;
  });

  const candidates = [];
  const rejected = [];
  const found = { itemName: '', grcNo: '' };
  const reject = (value, reason, line) => { if (rejected.length < 100) rejected.push({ value: cell(value).slice(0, 80), reason, line }); };
  const unsure = (confidence) => confidence !== null && minConfidence && confidence < minConfidence;

  /* a labelled value: the Barcode label's is a barcode candidate (when it
     looks like one), any other label's is that label's - and says so */
  const labelled = (label, value, line, confidence) => {
    const key = labelKey(label);
    if (key === 'itemName' && !found.itemName) found.itemName = value;
    if (key === 'grcNo' && !found.grcNo) found.grcNo = value;
    if (keyOfLabel(label) === 'barcode') {
      const v = closeSeparators(value);
      if (!barcodeShaped(v, { loose: !geo })) reject(value, `the "${label}" value is not a barcode number`, line);
      else if (unsure(confidence)) reject(v, `OCR is not sure it read this right (${Math.round(confidence)}% sure) - if it is the barcode, type it as the Barcode`, line);
      else candidates.push({ value: v, source: 'label', line, label, confidence });
      return;
    }
    if (/\d/.test(value)) reject(value, `the "${label}" value${VALUE_KINDS[key] ? ` - ${VALUE_KINDS[key]}` : ''}, not a barcode`, line);
  };

  /* 1. every cell: a label with its value in it, a label with none (its
     value is beside it or under it), or a free cell */
  const bare = [];            // [{ label, row, ci, cell }]
  const coded = [];           // labels holding a code-like value: [{ label, row, cell }]
  const free = [];            // [{ row, ci, cell }]
  rows.forEach((r, i) => {
    if (skip.has(i)) return;
    r.cells.forEach((c, ci) => {
      const pairs = pairsIn(c.text);
      if (pairs) {
        pairs.forEach((p, pi) => {
          if (p.value === '') { if (pi === pairs.length - 1) bare.push({ label: p.label, row: i, ci, cell: c }); return; }
          if (hasValue(p.value)) labelled(p.label, p.value, r.at, c.confidence);
          /* "ECom ID: TWN0LPID" - a code whose first part may have wrapped
             onto the line above or below it */
          if (CODE_LIKE.test(p.value)) coded.push({ label: p.label, row: i, cell: c });
        });
        return;
      }
      const known = labelIn(c.text);
      if (known) {
        if (known.value === null) return;
        const label = DETAIL_NAMES[known.key] || known.key;
        if (known.value === '') bare.push({ label, row: i, ci, cell: c });
        else labelled(label, known.value, r.at, c.confidence);
        return;
      }
      free.push({ row: i, ci, cell: c });
    });
  });

  /* 2. whose value each free cell is. A label with nothing after it takes
     only the value it stands with:
       the next cell on its own row - and, when OCR gives positions, only a
         close one (the number far off under a barcode's bars is not "Is
         Consignment:"'s value)
       the cell under it on the next row (by position when OCR gives it; for
         a pasted text, the next line when the label stood alone on its own)
       for OCR, a value wrapped around it: above AND below it, in its value
         column ("9A1136-" / "ECom ID:" / "TWN0LPID") */
  const claimed = new Map();  // free index -> label
  const near = (a, b, k) => a !== null && b !== null && Math.abs(a - b) <= k;
  const claim = (fi, label) => { if (!claimed.has(fi)) claimed.set(fi, label); };
  const indexed = free.map((f, k) => ({ f, k }));
  bare.forEach((b) => {
    const h = b.cell.h || 14;
    /* same row, right after it */
    const fi = free.findIndex((f) => f.row === b.row && f.ci === b.ci + 1);
    if (fi >= 0 && (!geo || (free[fi].cell.x0 - b.cell.x1) <= 6 * h)) { claim(fi, b.label); return; }
    const under = indexed.filter(({ f }) => f.row === b.row + 1);
    if (geo) {
      /* a code wrapped around it - one part above, the rest below, in the
         column right of the label ("9A1136" / "ECom ID:" / "TWN0LPID") */
      const inColumn = (f) => f.cell.x0 >= b.cell.x1 - 2 * h && f.cell.x0 - b.cell.x1 <= 8 * h;
      const above = indexed.filter(({ f }) => f.row === b.row - 1 && inColumn(f));
      const below = indexed.filter(({ f }) => (f.row === b.row + 1 || f.row === b.row) && inColumn(f) && CODE_LIKE.test(f.cell.text));
      let wrapped = false;
      above.forEach((a) => {
        const rest = below.filter((w) => w.k !== a.k && near(w.f.cell.x0, a.f.cell.x0, 3 * h));
        if (!rest.length) return;
        wrapped = true;
        claim(a.k, b.label);
        rest.forEach((w) => claim(w.k, b.label));
      });
      if (wrapped) return;
      /* the value under it */
      const hit = under.filter(({ f }) => f.cell.x1 >= b.cell.x0 - 2 * h && f.cell.x0 <= b.cell.x1 + 2 * h);
      if (hit.length) claim(hit.sort((a, c) => Math.abs(a.f.cell.x0 - b.cell.x0) - Math.abs(c.f.cell.x0 - b.cell.x0))[0].k, b.label);
      return;
    }
    const single = (i) => i >= 0 && i < rows.length && !skip.has(i) && rows[i].cells.length === 1;
    /* OCR text without positions (edited with Edit as text): the same wrap,
       each part on a line of its own */
    if (!textInput && single(b.row) && single(b.row - 1) && single(b.row + 1)) {
      const a = indexed.find(({ f }) => f.row === b.row - 1);
      const w = indexed.find(({ f }) => f.row === b.row + 1);
      if (a && w && CODE_LIKE.test(w.f.cell.text)) { claim(a.k, b.label); claim(w.k, b.label); return; }
    }
    /* a label alone on its line: its value is the next line */
    if (single(b.row) && under.length) claim(under.sort((a, c) => a.f.ci - c.f.ci)[0].k, b.label);
  });
  /* OCR puts a wrapped code's other half on the label's own line ("ECom ID:
     TWN0LPID" under "9A1136"): a value on its own right above or below such
     a label, within its span, is part of that label's value */
  if (geo) {
    coded.forEach((p) => {
      const h = p.cell.h || 14;
      free.forEach((f, k) => {
        if (claimed.has(k) || Math.abs(f.row - p.row) !== 1) return;
        if (f.cell.x0 >= p.cell.x0 && f.cell.x0 <= p.cell.x1 + 2 * h) claim(k, p.label);
      });
    });
  }
  /* OCR can lose a label's colon ("ECom ID  9A1136 TWN0LPID"): a cell of
     words only, right beside a value on its row, is that value's label */
  if (geo) {
    free.forEach((f, k) => {
      if (claimed.has(k) || f.ci === 0) return;
      const before = rows[f.row].cells[f.ci - 1];
      const h = before.h || 14;
      if (/^[\p{L}][\p{L} .()/&'-]{0,40}$/u.test(before.text) && before.text.split(' ').length <= 4 && before.x1 !== null && f.cell.x0 - before.x1 <= 3 * h
        && free.some((g) => g.row === f.row && g.ci === f.ci - 1)) claim(k, before.text);
    });
  }

  /* 3. the free cells: a label's value is that label's; one left on its own
     is a barcode candidate when every token of it looks like one */
  free.forEach((f, k) => {
    const line = rows[f.row].at;
    if (claimed.has(k)) { labelled(claimed.get(k), f.cell.text, line, f.cell.confidence); return; }
    /* its tokens, each with the confidence of its own words ("G1318 * 05178
       * 1 * 1" is one token, and one unsure word beside it is not its) */
    const tokens = f.cell.words && f.cell.words.length ? wordTokens(f.cell.words) : closeSeparators(f.cell.text).split(' ').filter(Boolean).map((text) => ({ text, confidence: f.cell.confidence }));
    const shaped = tokens.filter((t) => barcodeShaped(t.text));
    if (!shaped.length) {
      if (tokens.length === 1 && /\d/.test(f.cell.text)) reject(f.cell.text, notABarcode(f.cell.text), line);
      return;
    }
    if (shaped.length !== tokens.length) { reject(f.cell.text, 'inside a longer text - not a barcode on its own', line); return; }
    const alone = rows[f.row].cells.length === 1;
    shaped.forEach((t) => {
      const digitsOnly = /^\d+$/.test(t.text);
      if (unsure(t.confidence)) reject(t.text, `OCR is not sure it read this right (${Math.round(t.confidence)}% sure) - if it is the barcode, type it as the Barcode`, line);
      else if (digitsOnly && details) reject(t.text, 'a number with no label on an item-details page - if it is the barcode, type it as the Barcode', line);
      else if (digitsOnly && (!alone || t.text.length < 5)) reject(t.text, alone ? 'a short number, not a barcode' : 'a number among other values on its line - if it is the barcode, type it as the Barcode', line);
      else candidates.push({ value: t.text, source: 'standalone', line, label: '', confidence: t.confidence, digitsOnly });
    });
  });

  /* the typed number first, then the page's own, then values on their own -
     and each value once */
  const kept = [...candidates];
  const t = closeSeparators(typed);
  if (t) {
    if (barcodeShaped(t, { loose: true })) kept.unshift({ value: t, source: 'typed', line: 0, label: '', confidence: null });
    else reject(t, 'the number typed in the Barcode box is not a barcode number', 0);
  }
  const order = { typed: 0, label: 1, standalone: 2 };
  const seen = new Set();
  const offered = kept.sort((a, b) => order[a.source] - order[b.source] || a.line - b.line)
    .filter((c) => (seen.has(barcodeKey(c.value)) ? false : seen.add(barcodeKey(c.value))));
  return { candidates: offered, rejected, itemName: found.itemName, grcNo: found.grcNo, details, skipped, searched };
}

/* OCR's words of one cell -> its tokens as a barcode is written: words
   joined by "*" are one composed value ("G1318" "*" "05178" -> G1318*05178),
   each token as sure as its least sure word */
function wordTokens(words) {
  const out = [];
  words.forEach((w) => {
    const text = String(w.text ?? '').trim();
    if (!text) return;
    const last = out[out.length - 1];
    if (last && (last.text.endsWith('*') || text.startsWith('*'))) {
      last.text += text;
      last.confidence = last.confidence === null || w.confidence === null ? (last.confidence ?? w.confidence) : Math.min(last.confidence, w.confidence);
    } else out.push({ text, confidence: w.confidence });
  });
  return out;
}

/* the sources of a report table's row: every value is from its column */
const COLUMN_SOURCES = { barcode: 'import_column', itemCode: 'import_column', qty: 'import_column', uom: 'import_column', retailPrice: 'import_column' };
export const ORIGINS = ['text', 'image', 'ocr'];

/* A report table's heading row that OCR misread ("BARCODE ITEM CODE" run
   together): three or more cells that are the report's headings - two of
   them its Item Code / Qty / UOM, not just prices (a Details page can print
   "RSP | WSP | DP" over its values) - with a row of data under it. */
const looksLikeReportTable = (lines) => lines.some((line, i) => {
  if (movementHeader(line) || /:/.test(line)) return false;
  const fields = cellsOf(line).map((c) => FIELD_BY_ALIAS.get(squash(c))).filter(Boolean);
  const next = lines.slice(i + 1).find((l) => cell(l) !== '');
  return fields.length >= 3 && fields.filter((f) => ['itemCode', 'qty', 'uom'].includes(f)).length >= 2
    && Boolean(next) && cellsOf(next).filter((c) => c !== '').length >= 3;
});

/* What was pasted (or read from an image) - once the operator has said it
   IS a Barcode Report (components/BarcodeReportImport.jsx asks first):
     table    the report TABLE (a heading row with Barcode) - its rows, every
              value from its column (import_column)
     details  one barcode's Details page(s) - read by label, section by
              section, whether pasted or read from a screenshot; the barcode
              found as readDetailsBlock says (explicit, printed on its own,
              else the Item Code)
   Anything else is an error (`notReport` when it is no Barcode Report at
   all: "This image does not appear to be a Barcode Report").
   `origin` - 'text' (pasted / Excel), 'image' (OCR of a screenshot) or 'ocr'
   (OCR text the operator corrected with Edit as text): an image's rules
   stay with its text. `lines` - OCR's lines with each cell's confidence and
   position. Returns { kind, origin, records, columns, unmapped, ignored,
   left, warnings, detection, error, notReport }. */
export function readImport(text, { barcode = '', origin = 'text', lines = null, minConfidence = 0 } = {}) {
  const from = ORIGINS.includes(origin) ? origin : 'text';
  const trimmed = String(text ?? '').replace(/ /g, ' ').replace(/\r\n?/g, '\n').trim();
  if (!trimmed) return { kind: '', origin: from, ...readTable([]), warnings: [], detection: null, error: 'Paste the Barcode Report table - or one barcode\'s Details page - first.' };
  if (trimmed.includes('\t')) {
    const table = readTable(splitTable(trimmed));
    if (!/^No report headings/.test(table.error)) {
      return {
        kind: 'table', origin: from, ...table,
        records: table.records.map((r) => ({ ...r, origin: from, sources: COLUMN_SOURCES })),
        warnings: [],
        detection: {
          candidates: table.records.map((r) => ({ value: r.values.barcode, source: 'column', line: r.line, label: 'Barcode', confidence: null })),
          rejected: (table.left || []).map((l) => ({ value: l.text, reason: l.reason, line: l.line })),
          itemName: '', grcNo: '', details: false, skipped: { filters: 0, movements: 0 },
        },
      };
    }
  }
  const plain = normaliseLines(trimmed);
  if (from !== 'text' && looksLikeReportTable(plain)) {
    return {
      kind: '', origin: from, ...readTable([]), warnings: [], detection: null,
      error: 'The report table\'s headings could not all be read (no "Barcode" heading was found) - compare the image with View Extracted Text and correct the headings with Edit as text, or paste the report\'s text instead.',
    };
  }
  /* a Details page: pasted, or read from a screenshot - whose barcode is
     then found over OCR's words, by where each stands and how sure OCR was */
  const image = from === 'image' ? { lines: Array.isArray(lines) && lines.length ? lines : plain, minConfidence }
    : from === 'ocr' ? { lines: plain, minConfidence: 0 } : null;
  const pages = readDetailsPages(trimmed, { barcode, image });
  if (pages.error) return { kind: '', origin: from, ...readTable([]), warnings: [], detection: null, error: pages.error, notReport: Boolean(pages.notReport) };
  return {
    kind: 'details',
    origin: from,
    records: pages.records.map((r) => ({ ...r, origin: from })),
    columns: [], unmapped: [], ignored: 0, left: [],
    warnings: pages.warnings,
    /* what the page offered as its barcode */
    detection: pages.detection || detectBarcodes(plain, { typed: barcode, textInput: true }),
    error: '',
  };
}

/* The values the preview lets the operator correct before anything is saved
   (user, 2026-09-30) - `details: true` where the value lives on the page's
   details rather than on the unit's values. */
export const EDIT_FIELDS = [
  { key: 'barcode', label: 'Barcode' },
  { key: 'itemCode', label: 'Item Code' },
  { key: 'itemName', label: 'Item Name', details: true },
  { key: 'subGroup', label: 'Sub Group', details: true },
  { key: 'group', label: 'Group', details: true },
  { key: 'hsn', label: 'HSN' },
  { key: 'gstSlab', label: 'GST Slab', details: true },
  { key: 'uom', label: 'Unit / UOM' },
  { key: 'description', label: 'Supplier Description' },
  { key: 'pma', label: 'P-M-F', details: true },
  { key: 'invoiceNo', label: 'Purchase Invoice', details: true },
  { key: 'grcNo', label: 'GRC No.' },
  { key: 'purRate', label: 'Purchase Rate' },
  { key: 'discount', label: 'Discount', details: true },
  { key: 'finalNet', label: 'Final Rate' },
  { key: 'retailPrice', label: 'RSP' },
  { key: 'wspPrice', label: 'WSP' },
  { key: 'dpPrice', label: 'DP' },
  { key: 'supplier', label: 'Supplier', details: true },
  { key: 'taxRegion', label: 'Tax Region', details: true },
  { key: 'stockLocation', label: 'Location', details: true },
  { key: 'stockPoint', label: 'Stock Point', details: true },
];
const EDIT_KEYS = new Map(EDIT_FIELDS.map((f) => [f.key, f]));

/* A record with the operator's corrections - { field: value } - applied, as
   the server is then asked to check it again. A corrected barcode is theirs
   (typed): what the page left unsettled about it no longer holds the row
   back. WSP and DP are one value on the page and two on a barcode: both are
   set. The Item Code follows a corrected Item Name when it was the name. */
export function editRecord(record, edits) {
  const changes = Object.entries(edits || {}).filter(([key]) => EDIT_KEYS.has(key));
  if (!record || !changes.length) return record;
  const values = { ...(record.values || {}) };
  const details = record.details ? { ...record.details, stock: (record.details.stock || []).map((s) => ({ ...s })) } : null;
  const sources = { ...(record.sources || {}) };
  const out = { ...record };
  const edited = new Set(record.edited || []);
  changes.forEach(([key, raw]) => {
    const v = cell(raw);
    edited.add(key);
    if (key === 'barcode') {
      values.barcode = closeSeparators(v);
      sources.barcode = 'typed_barcode';
      delete out.candidate;
      if (out.review) out.review = out.review.filter((r) => r.field !== 'barcode');
      if (out.problems) out.problems = out.problems.filter((p) => p.field !== 'barcode');
      out.identify = { ...(record.identify || {}), value: values.barcode, from: 'typed', reason: 'Typed / corrected by you.', notes: [] };
    } else if (key === 'itemName') {
      if (details) {
        const was = details.itemName;
        details.itemName = v;
        if (!('itemCode' in edits) && (!values.itemCode || normName(values.itemCode) === normName(was))) values.itemCode = v;
      }
      if (out.problems && v) out.problems = out.problems.filter((p) => p.field !== 'itemName');
    } else if (key === 'gstSlab') {
      if (details) details.gstSlab = v;
      const pct = gstPercent(v);
      values.gst = pct === null ? '' : String(pct);
    } else if (key === 'wspPrice' || key === 'dpPrice') {
      values[key] = v;
      if (details) details[key === 'wspPrice' ? 'wsp' : 'dp'] = v;
    } else if (key === 'supplier') {
      if (details) { details.supplier = v; details.supplierCode = splitSupplier(v).code; }
    } else if (key === 'stockLocation' || key === 'stockPoint') {
      if (details) {
        /* no stock summary on the page: its balance, where its last movement left it */
        const last = (details.movements || [])[details.movements?.length - 1];
        if (!details.stock.length) details.stock.push({ location: cell(last?.location), stockPoint: cell(last?.stockPoint), qty: Number(details.totals?.computed?.balance) || 0 });
        details.stock[0][key === 'stockLocation' ? 'location' : 'stockPoint'] = v;
      }
    } else if (EDIT_KEYS.get(key).details) {
      if (details) details[key] = v;
    } else values[key] = v;
    if (['itemCode', 'uom', 'retailPrice'].includes(key)) sources[key] = 'edited';
  });
  return { ...out, values: normaliseRecord(values), ...(details ? { details } : {}), sources, edited: [...edited] };
}

/* The balance a Details record leaves in stock, and where: the summary's
   locations with something in them, else the movements' own balance at the
   location of their last row. */
export function stockLeft(details) {
  const held = (details?.stock || []).filter((s) => s.qty > 0);
  if (held.length) return held;
  const balance = details?.totals?.computed?.balance || 0;
  if (balance > 0 && details?.movements?.length) {
    const last = details.movements[details.movements.length - 1];
    return [{ location: last.location, stockPoint: last.stockPoint, qty: balance }];
  }
  return [];
}

/* ------------------------------------------------ against this ERP ------ */

/* A stored barcode row in the import's terms - what our Barcode Report shows
   for it (app/api/reports/barcode-report/route.js). */
export function unitAsRecord(unit) {
  const u = unit || {};
  return normaliseRecord({
    barcode: u.barcodeNo || u.barcodeGenerated || '',
    itemCode: u.itemCode,
    description: u.printDescription || u.supplierDescription || '',
    qty: u.qty ?? u.qtyNum,
    uom: u.uom,
    hsn: u.hsn,
    purRate: u.purRate,
    finalNet: u.finalNet,
    gst: u.gst,
    retailPrice: u.retailPrice,
    offerPrice: u.offerPrice,
    wspPrice: u.wspPrice,
    dpPrice: u.dpPrice,
    grcNo: u.grcNo,
  });
}

const same = (a, b) => {
  const x = cell(a);
  const y = cell(b);
  if (x === y) return true;
  return isNumber(x) && isNumber(y) && Number(x) === Number(y);
};

/* What an imported row would change on the barcode this ERP already holds -
   [{ field, label, local, incoming, updatable, kind }]: kind 'fill' (the
   saved value is blank), 'replace' (it would overwrite a saved value) or
   'info' (item, quantity, UOM - shown, never changed by an import). A blank
   imported cell is "not given", never "clear it". */
export function differences(values, unit) {
  const local = unitAsRecord(unit);
  return COMPARED_FIELDS
    .filter((field) => cell(values?.[field]) !== '' && !same(values[field], local[field]))
    .map((field) => {
      const updatable = UPDATABLE_FIELDS.includes(field);
      return {
        field,
        label: FIELD_LABELS[field],
        local: local[field],
        incoming: values[field],
        updatable,
        kind: !updatable ? 'info' : cell(local[field]) === '' ? 'fill' : 'replace',
      };
    });
}

/* ------------------------------------------ what each row becomes ------ */

/* lib/barcodeLabel.js BARCODE_STATUS.IN_STOCK - spelled out, because that
   module is the database model and this one runs in the browser too */
const IN_STOCK = 'IN_STOCK';
const HISTORY = 'HISTORY';
const STATUS_WORDS = { SOLD: 'sold', IN_TRANSIT: 'in transit', RETURN_IN_TRANSIT: 'being returned', VOID: 'written off' };

/* Every imported row, checked again, then against what this ERP holds:
     new       not held - READY TO IMPORT: seeded as a unit of stock
     same      held, nothing differs - EXISTING, NO CHANGES
     changed   held, something differs - EXISTING, CHANGES FOUND. Each
               difference is a blank it fills (kind 'fill'), history it adds
               ('append'), a saved value it would REPLACE ('replace') or one
               an import never changes ('info': item, quantity, UOM). Only
               the ones the operator approves are written (updateFor).
     locked    held, but sold / moved on - an import cannot change it
     invalid   cannot be imported - the real reason
     lookup    a barcode read from an IMAGE (lookupOnly): looked up and shown
               with THIS ERP's values - never written (lookupRow)
     rejected  a value an image offered that is not a barcode of this ERP

   A number of this ERP's own Barcode Setting series is imported like any
   other (user, 2026-09-30): pasting a barcode's report is an explicit seed
   of a barcode that exists. The series protects Barcode GENERATION, and
   still does: applyImport lifts the series' counter past a number it seeds
   (lib/barcodeEngine.js raiseBarcodeFloor), so Generation never issues it
   again - and a number held here is compared, never inserted a second time.

   `units` - the barcode rows answering to any number (barcodeNo,
   barcodeGenerated or oldBarcode) of this business or here now;
   `elsewhere` - those held only by another business; `businessId`;
   `formats` - Barcode Setting prefixes / suffixes / widths; `itemCodes` -
   the imported item codes its Item master holds; `items` - those Items by
   normalised code / name; `itemNames`, `locationNames`, `supplierNames`,
   `businessNames` - names by _id, for what the preview shows. Pure: the
   route reads those and calls this, inside the transaction when it imports. */
export function classifyRecords(records, {
  units = [], formats = [], itemCodes = new Set(), businessId = '', itemNames = new Map(), locationNames = new Map(),
  supplierNames = new Map(), businessNames = new Map(), elsewhere = [], items = new Map(),
} = {}) {
  /* every unit behind each number - a number can have more than one - the
     unit whose own number it is first, then whose composed value, then
     whose old barcode (lib/inventory.js unitFor's order) */
  const byKey = (list) => {
    const map = new Map();
    list.forEach((u) => {
      [...new Set([u.barcodeNo, u.barcodeGenerated, u.oldBarcode].map((v) => barcodeKey(v)).filter(Boolean))].forEach((key) => {
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(u);
      });
    });
    return map;
  };
  const unitsByKey = byKey(units);
  const elsewhereByKey = byKey(elsewhere);
  const rank = (u, key) => { const r = [u.barcodeNo, u.barcodeGenerated, u.oldBarcode].findIndex((v) => sameBarcode(v, key)); return r < 0 ? 3 : r; };
  const unitsFor = (key, keep = () => true, map = unitsByKey) => (map.get(key) || []).filter(keep).sort((a, b) => rank(a, key) - rank(b, key));
  /* this business's units, and units of another business that are here now */
  const ours = (u) => !businessId || String(u.businessId || '') === String(businessId) || String(u.currentBusinessId || '') === String(businessId);
  const context = { formats, itemNames, locationNames };

  const seen = new Set();
  const rows = (records || []).map((record, index) => {
    if (record?.lookupOnly) return lookupRow(record, index, unitsFor, context);
    const values = normaliseRecord(record?.values || record);
    /* a Details-page record's history, and the masters the server found for
       it (links) - see readDetailsText and resolveRecords */
    const details = record?.details ? normaliseDetails(record.details) : null;
    const links = record?.links || null;
    let key = barcodeKey(values.barcode);
    const line = Number(record?.line) || index + 1;
    /* rows read from an image (or its OCR text) - imported like any other
       once the operator has checked them against the image (the route asks
       for `compared`), and marked as such */
    const fromImage = record?.origin === 'image' || record?.origin === 'ocr';
    const warnings = [...(record?.warnings || [])];
    const out = {
      line, barcode: values.barcode, key, values, itemInMaster: itemCodes.has(values.itemCode),
      ...(fromImage ? { origin: record.origin } : {}),
      ...(record?.sources ? { sources: cleanSources(record.sources) } : {}),
      ...(details ? { details, links, unmatched: record?.unmatched || [], warnings } : {}),
    };
    /* the units this row is: the number as given, else as printed (capitals) */
    let here = key ? unitsFor(key, ours) : [];
    if (!here.length && key && key !== key.toUpperCase() && unitsFor(key.toUpperCase(), ours).length) {
      key = key.toUpperCase();
      here = unitsFor(key, ours);
    }
    /* a value OCR read with little confidence, flagged in the browser
       (lib/barcodeReportOcr.js), and what the reader could not settle (a
       page printing one barcode with another typed) - a flag can only hold
       a row back, never let one through, so it is safe to take */
    const review = (Array.isArray(record?.review) ? record.review : []).slice(0, 5)
      .map((r) => ({ field: String(r?.field || 'barcode').slice(0, 20), message: String(r?.message || 'Needs review').slice(0, 300) }));
    const problems = [...checkFields(values), ...review];
    /* this ERP prints its series in capitals: "9a2890" is refused rather
       than stored as a second spelling of 9A2890 */
    if (!here.length && inLocalSeries(values.barcode, formats, { ignoreCase: true }) && !inLocalSeries(values.barcode, formats)) {
      problems.unshift({ field: 'barcode', message: `Type the barcode as it is printed - ${values.barcode.toUpperCase()} (this ERP's barcode series is in capitals)` });
    }
    /* a barcode the pasted page printed on its own (not labelled, not
       typed): only one this ERP could have printed, or one it holds */
    if (record?.candidate?.source === 'standalone' && !here.some((u) => sameBarcode(u.barcodeNo, key) || sameBarcode(u.barcodeGenerated, key))) {
      const why = acceptProblem(values.barcode, { source: 'standalone', digitsOnly: /^\d+$/.test(values.barcode) }, formats);
      if (why) problems.unshift({ field: 'barcode', message: `The page does not label its barcode, and "${values.barcode}" printed on its own is ${why} - type the barcode` });
    }
    /* the page's Item Code taken as its barcode (it printed no other): never
       its Item Name - that is the item, which many barcodes share */
    if (record?.candidate?.source === 'item_code' && details?.itemName && normName(values.barcode) === normName(details.itemName)) {
      problems.unshift({ field: 'barcode', message: `The Item Code ${values.barcode} is the Item Name - the item, not a barcode; type the barcode` });
    }
    /* where the source still holds its stock only matters for a unit being
       created; a unit already here stays where the ledger says */
    const placement = (links?.problems || []).filter((p) => p.field === 'location');
    problems.push(...(links?.problems || []).filter((p) => p.field !== 'location'));
    if (!here.length) problems.push(...placement);
    else placement.forEach((p) => warnings.push(`${p.message} - the unit already here was left where it is`));
    if (problems.length) {
      return { ...out, status: 'invalid', reason: problems.map((p) => p.message).join('; '), errors: problems.map((p) => ({ row: line, ...p })) };
    }
    if (seen.has(key)) return { ...out, status: 'invalid', reason: 'This barcode is in the import twice', errors: [{ row: line, field: 'barcode', message: 'This barcode is in the import twice' }] };
    seen.add(key);

    if (!here.length) {
      /* held by another business of this ERP: never inserted a second time */
      const other = unitsFor(key, (u) => !ours(u), elsewhereByKey);
      if (other.length) {
        const who = businessNames.get?.(String(other[0].businessId || '')) || 'another business';
        const message = `This barcode is already held by ${who} (${unitSummary(other[0], locationNames)}) - it is not imported a second time; import it from that business`;
        return { ...out, status: 'invalid', reason: message, errors: [{ row: line, field: 'barcode', message }] };
      }
      const series = seriesOf(values.barcode, formats);
      return {
        ...out, status: 'new',
        ...(series ? { seriesNote: `${values.barcode} is in this ERP's own barcode series (Barcode Setting ${series.prefix || series.suffix}) - importing it moves Barcode Generation past ${series.number}, so this number is never issued again` } : {}),
      };
    }
    /* several units at the best match: which one this row is cannot be told */
    const best = here.filter((u) => rank(u, key) === rank(here[0], key));
    if (best.length > 1) {
      const message = `This barcode answers to ${best.length} units in this ERP (${best.slice(0, 3).map((u) => unitSummary(u, locationNames)).join('; ')}) - it cannot tell which one this row is`;
      return { ...out, status: 'invalid', reason: message, errors: [{ row: line, field: 'barcode', message }] };
    }
    const unit = here[0];
    const diffs = [...differences(values, unit), ...(details ? detailDifferences(details, links, unit, supplierNames) : [])];
    const held = {
      ...out, unitId: String(unit._id), diffs,
      identity: identityOf(values, details, unit, { itemNames, items }),
      existing: existingOf(unit, { locationNames, supplierNames }),
      ...(rank(unit, key) === 2 ? { oldOnly: true } : {}),
      /* the source's own snapshot, re-written when its history is taken */
      ...(details ? { snapshot: { sourceMovements: mergeMovements(unit.sourceMovements, details.movements, links), sourceStock: stockWithLinks(details.stock, links), sourceTotals: details.totals, sourcePayload: details.payload } } : {}),
    };
    if (!diffs.length) return { ...held, status: 'same' };
    /* a unit kept only for its history (HISTORY) can take more of it - it is
       not stock, so nothing moves; one sold or moved on cannot be changed */
    if (unit.status && unit.status !== IN_STOCK && unit.status !== HISTORY) {
      return { ...held, status: 'locked', reason: `Already here and ${STATUS_WORDS[unit.status] || unit.status} - an import cannot change it` };
    }
    /* GST Parse's rule: a value that only FILLS a blank is taken; one that
       would replace a saved value waits for the operator (fillsOnly) */
    const updatable = diffs.some((d) => d.updatable);
    return {
      ...held, status: 'changed', updatable,
      fillsOnly: updatable && diffs.filter((d) => d.updatable).every((d) => d.kind === 'fill' || d.kind === 'append'),
      replaces: diffs.filter((d) => d.updatable && d.kind === 'replace').length,
    };
  });
  return oneRowPerUnit(rows);
}

/* the value sources a row may say it has - for the preview only; a source
   never loosens a check */
const SOURCE_NAMES = ['import_column', 'details_label', 'details_receipt', 'details_stock', 'typed_barcode', 'detected_barcode', 'item_code', 'edited', 'existing_barcode_lookup', 'item_master'];
function cleanSources(sources) {
  const out = {};
  ['barcode', 'itemCode', 'qty', 'uom', 'retailPrice'].forEach((k) => { if (SOURCE_NAMES.includes(sources?.[k])) out[k] = sources[k]; });
  return out;
}

/* The Barcode Setting series a number belongs to, as printed:
   { prefix, suffix, number } or null. */
export function seriesOf(barcode, formats) {
  const value = clean(barcode);
  for (const f of formats || []) {
    const prefix = String(f.prefix || '');
    const suffix = String(f.suffix || '');
    if (!value.startsWith(prefix) || !value.endsWith(suffix) || value.length <= prefix.length + suffix.length) continue;
    const digits = value.slice(prefix.length, value.length - suffix.length);
    if (/^\d+$/.test(digits)) return { prefix, suffix, number: Number(digits) };
  }
  return null;
}

/* What this ERP holds under a number, for the preview's EXISTING DATA. */
function existingOf(unit, { locationNames, supplierNames }) {
  const u = unit || {};
  return {
    barcode: cell(u.barcodeNo) || cell(u.barcodeGenerated) || cell(u.oldBarcode),
    itemCode: cell(u.itemCode),
    description: cell(u.printDescription) || cell(u.supplierDescription),
    qty: cell(u.qty ?? u.qtyNum),
    uom: cell(u.uom),
    hsn: cell(u.hsn),
    gst: cell(u.gst),
    purRate: cell(u.purRate),
    finalNet: cell(u.finalNet),
    retailPrice: cell(u.retailPrice),
    wspPrice: cell(u.wspPrice),
    dpPrice: cell(u.dpPrice),
    grcNo: cell(u.grcNo),
    supplier: u.supplierId ? (supplierNames.get?.(String(u.supplierId)) || 'a supplier') : '',
    location: locationNames.get?.(String(u.currentLocationId || '')) || '',
    status: STATUS_TEXT[u.status] || cell(u.status).toLowerCase(),
    /* the barcode's image AS STORED - never trimmed: an image is replaced
       only while the barcode still holds exactly this (lib/barcodeImage.js
       imageWriteFor). The server adds `image`, how it is shown. */
    imageUrl: String(u.imageUrl ?? ''),
  };
}

/* Whether the pasted row and the unit this ERP holds under its number look
   like one piece of goods: 'same', 'different' (with the reasons - a
   different item, GRC or kind of unit) or 'unknown'. Only ever SHOWN and used
   to hold back default ticks; the operator decides. */
function identityOf(values, details, unit, { itemNames, items }) {
  const own = new Set([unit.barcodeNo, unit.barcodeGenerated, unit.oldBarcode].map((v) => normName(barcodeKey(v))).filter(Boolean));
  const unitSide = [unit.itemCode, unit.itemName, unit.itemId ? itemNames.get?.(String(unit.itemId)) : ''].map(normName).filter((n) => n && !own.has(n));
  const item = items.get?.(normName(values.itemCode)) || items.get?.(normName(details?.itemName)) || null;
  const recordSide = [values.itemCode, details?.itemName, item?.name, item?.itemCode].map(normName).filter(Boolean);
  const reasons = [];
  let itemSame = false;
  if (item && unit.itemId && String(item._id) === String(unit.itemId)) itemSame = true;
  else if (unitSide.length && recordSide.length) {
    itemSame = unitSide.some((n) => recordSide.includes(n));
    if (!itemSame) reasons.push(`the item here is ${cell(unit.itemCode) || cell(unit.itemName)}, the pasted page's is ${cell(values.itemCode) || cell(details?.itemName)}`);
  }
  const grcHere = comparableGrc(unit.grcNo);
  const grcThere = comparableGrc(values.grcNo);
  if (grcHere && grcThere && grcHere !== grcThere) reasons.push(`GRC ${cell(unit.grcNo)} here, GRC ${cell(values.grcNo)} on the page`);
  if (cell(unit.uom) && cell(values.uom) && uomTypeOf(unit.uom) !== uomTypeOf(values.uom)) reasons.push(`${cell(unit.uom)} here, ${cell(values.uom)} on the page`);
  return { state: reasons.length ? 'different' : itemSame ? 'same' : 'unknown', reasons };
}

/* a GRC number that can be compared - digits, after an optional "GRC" - or
   '' ("OB14", an opening-balance code, is not one) */
const comparableGrc = (value) => {
  const v = cell(value).replace(/^GRC\s*(no\.?|number)?\s*:?\s*/i, '');
  return /^\d+$/.test(v) ? String(Number(v)) : '';
};

/* ---------------------------------------------- a barcode looked up ------ */

const STATUS_TEXT = { IN_STOCK: 'in stock', HISTORY: 'kept as history (not in stock)', SOLD: 'sold', IN_TRANSIT: 'in transit', RETURN_IN_TRANSIT: 'being returned', VOID: 'written off' };
const normName = (value) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
/* characters OCR takes for one another - "15-S-KOL" read as "15-5-KOL" */
const ocrFold = (value) => normName(value).toUpperCase().replace(/5/g, 'S').replace(/0/g, 'O').replace(/1/g, 'I').replace(/8/g, 'B').replace(/[^A-Z0-9]/g, '');

/* "10-PLNBTM · 16 MTR · GRC 05178 · in stock at Temple Fabrics Warehouse" */
export function unitSummary(unit, locationNames = new Map()) {
  const u = unit || {};
  const where = locationNames.get?.(String(u.currentLocationId || '')) || '';
  const status = STATUS_TEXT[u.status] || String(u.status || '').toLowerCase().replace(/_/g, ' ');
  return [
    cell(u.itemCode) || cell(u.itemName) || 'no item',
    [cell(u.qty ?? u.qtyNum), cell(u.uom)].filter(Boolean).join(' '),
    cell(u.grcNo) ? `GRC ${cell(u.grcNo)}` : '',
    status ? status + (where && u.status === IN_STOCK ? ` at ${where}` : '') : '',
  ].filter(Boolean).join(' · ');
}

/* The names a unit's goods go by - its item code, its item name, its Item
   master's name - never its own barcode number (older rows carry that as
   their item code, which says nothing about the goods). */
function unitNames(unit, itemNames) {
  const own = new Set([unit.barcodeNo, unit.barcodeGenerated, unit.oldBarcode].map((v) => barcodeKey(v).toLowerCase()).filter(Boolean));
  const names = [unit.itemCode, unit.itemName, unit.itemId ? itemNames.get?.(String(unit.itemId)) : ''].map(normName).filter((n) => n && !own.has(n));
  return [...new Set(names)];
}

/* What the image says of the goods (its Item Name, its GRC No) against the
   unit this ERP holds under that number. Only ever SHOWN - nothing read
   from an image is written - so an OCR slip ("15-5-KOL") is allowed for,
   and said. A GRC is compared only when both are GRC numbers. */
function crossCheckOf(cross, unit, itemNames) {
  const shownItem = cell(cross?.itemName).slice(0, 80);
  const shownGrc = cell(cross?.grcNo).slice(0, 20);
  const names = unitNames(unit, itemNames);
  let item = 'none';
  if (shownItem && names.length) {
    const n = normName(shownItem);
    item = names.includes(n) ? 'same' : names.some((x) => ocrFold(x) === ocrFold(n)) ? 'near' : 'different';
  }
  const a = comparableGrc(shownGrc);
  const b = comparableGrc(unit.grcNo);
  const grc = a && b ? (a === b ? 'same' : 'different') : 'none';
  const outcome = item === 'different' || grc === 'different' ? 'different' : item !== 'none' || grc === 'same' ? 'matches' : 'unconfirmed';
  return { outcome, item, grc, shownItem, shownGrc };
}

/* Whether a value an image (or a page, on its own) offered may be taken as
   a barcode - '' when it may, else why not. Only values this ERP could have
   printed: its own Barcode Setting series (at least the set number of
   digits), its composed SUPPLIER*GRC*BILL*SERIAL value, or a value the page
   labels as the barcode. A value this ERP HOLDS is taken too (the caller
   finds it first); anything else - "9A1136-TWN0LPID", "G1313", "55151130" -
   is not a barcode here, however it looks. */
function acceptProblem(value, candidate, formats) {
  if (!barcodeShaped(value, { loose: true })) return 'not a barcode number';
  if (candidate.source === 'label') return '';
  if (candidate.digitsOnly) return 'a number that is not a barcode in this ERP';
  if (composedValue(value) || inLocalSeries(value, formats, { width: true, ignoreCase: true })) return '';
  return 'not a barcode of this ERP - not in its Barcode Setting series or its SUPPLIER*GRC*BILL*SERIAL format, and not a barcode it holds';
}

/* A barcode an IMAGE showed, looked up. Every value shown is THIS ERP's own
   (existing_barcode_lookup) - the image is never the source of an item, a
   quantity, a UOM or a price - and nothing is ever written: an image
   identifies a barcode, it does not import one. */
function lookupRow(record, index, unitsFor, { formats, itemNames, locationNames }) {
  const value = closeSeparators(record?.values?.barcode).slice(0, 60);
  const line = Number(record?.line) || index + 1;
  const c = record?.candidate || {};
  const candidate = {
    source: ['typed', 'label', 'standalone'].includes(c.source) ? c.source : 'standalone',
    confidence: c.confidence !== null && c.confidence !== undefined && Number.isFinite(Number(c.confidence)) ? Math.round(Number(c.confidence)) : null,
    digitsOnly: /^\d+$/.test(value),
    label: cell(c.label).slice(0, 40),
    page: Number.isInteger(Number(c.page)) ? Number(c.page) : 0,
    line: Number(c.line) || 0,
  };
  /* "9a1167" typed or read in lower case is 9A1167 - a look-up writes
     nothing, so it may try the printed (upper) case too */
  let key = barcodeKey(value);
  let all = key ? unitsFor(key) : [];
  if (!all.length && key && key !== key.toUpperCase() && unitsFor(key.toUpperCase()).length) {
    key = key.toUpperCase();
    all = unitsFor(key);
  }
  const base = {
    line, barcode: value, key, lookupOnly: true, candidate, values: { barcode: value },
    sources: { barcode: candidate.source === 'typed' ? 'typed_barcode' : 'detected_barcode' },
  };
  /* a value printed on its own is a unit's own number or composed value -
     never only someone's old vendor number (a design or article number can
     be one) */
  const here = candidate.source === 'standalone' ? all.filter((u) => sameBarcode(u.barcodeNo, key) || sameBarcode(u.barcodeGenerated, key)) : all;
  if (!here.length && candidate.source !== 'typed') {
    const why = acceptProblem(value, candidate, formats);
    if (why) return { ...base, status: 'rejected', reason: why };
  }
  const series = inLocalSeries(value, formats, { ignoreCase: true, width: true });
  const seriesWords = series ? ` It is in this ERP's own barcode series (Barcode Setting); importing it from its pasted page moves Barcode Generation past it.` : '';
  if (!here.length) {
    return {
      ...base, status: 'lookup', lookup: { outcome: 'missing', series, units: [] },
      reason: `${value} is not in this ERP. An image only identifies a barcode - to import it, copy its Details page (or its row of the Barcode Report) on erp.orbiteerp.com, paste the text here and Check.${seriesWords}`,
    };
  }
  const views = here.slice(0, 5).map((u) => ({
    id: String(u._id), barcodeNo: cell(u.barcodeNo), barcodeGenerated: cell(u.barcodeGenerated), itemCode: cell(u.itemCode),
    qty: cell(u.qty ?? u.qtyNum), uom: cell(u.uom), grcNo: cell(u.grcNo), status: cell(u.status),
    location: locationNames.get?.(String(u.currentLocationId || '')) || '', summary: unitSummary(u, locationNames),
  }));
  if (here.length > 1) {
    return {
      ...base, status: 'lookup', lookup: { outcome: 'several', series, units: views },
      reason: `This number answers to ${here.length} units in this ERP: ${here.slice(0, 3).map((u) => unitSummary(u, locationNames)).join('; ')} - the image cannot say which one it shows`,
    };
  }
  const unit = here[0];
  const check = crossCheckOf(record?.crossCheck, unit, itemNames);
  const summary = unitSummary(unit, locationNames);
  const shown = [check.shownItem && `item ${check.shownItem}`, check.shownGrc && `GRC ${check.shownGrc}`].filter(Boolean).join(', ');
  let reason;
  if (check.outcome === 'different') {
    reason = `In this ERP, ${value} is ${summary}. The image shows ${shown} - different goods, so it is not the piece in the image`
      + (series ? '. Both ERPs issue this barcode series - pasting the other ERP\'s page for it shows this ERP\'s data beside it, to keep or replace' : '');
  } else if (check.outcome === 'matches') {
    reason = `Found in this ERP: ${summary}. The image's ${shown} matches${check.item === 'near' ? ' (allowing for a character OCR may have misread)' : ''}`;
  } else {
    reason = `Found in this ERP: ${summary}. The image shows no item name or GRC No to confirm it is the same piece`;
  }
  return {
    ...base,
    status: 'lookup',
    unitId: String(unit._id),
    values: { ...unitAsRecord(unit), barcode: value },
    sources: { ...base.sources, itemCode: 'existing_barcode_lookup', qty: 'existing_barcode_lookup', uom: 'existing_barcode_lookup', retailPrice: 'existing_barcode_lookup' },
    lookup: { outcome: check.outcome, series, crossCheck: check, units: views },
    reason,
  };
}

/* One look-up row per unit: a sticker prints a unit's number AND its
   composed value, and both find the same unit. Two barcodes one IMAGE shows
   that find different units (or one that finds none) are both kept, and
   each says so - one image, one piece. A number the operator typed is
   their own look-up, not something the image showed. */
function oneRowPerUnit(rows) {
  const byUnit = new Map();
  const kept = rows.filter((r) => {
    if (r.status !== 'lookup' || !r.unitId) return true;
    const first = byUnit.get(r.unitId);
    if (!first) { byUnit.set(r.unitId, r); return true; }
    first.also = [...(first.also || []), r.barcode];
    return false;
  });
  const pages = new Map();
  kept.filter((r) => r.status === 'lookup' && r.candidate?.source !== 'typed').forEach((r) => {
    const p = r.candidate?.page || 0;
    if (!pages.has(p)) pages.set(p, []);
    pages.get(p).push(r);
  });
  pages.forEach((looked) => {
    if (looked.length < 2) return;
    looked.forEach((r) => {
      r.note = `The image shows more than one barcode (${looked.map((x) => x.barcode).join(', ')}) and they are not one piece in this ERP - check which one is the piece in the image`;
    });
  });
  return kept;
}

/* What a Details-page record adds to a barcode this ERP already holds, as
   differences: design, P-M-F, the supplier link, tax region, discount, the
   base WSP / DP, and movement rows it does not have yet - each a blank it
   fills, a saved value it replaces, or history it adds. */
function detailDifferences(details, links, unit, supplierNames = new Map()) {
  const out = [];
  const add = (field, label, local, incoming, extra = {}) => {
    if (cell(incoming) !== '' && !same(local, incoming)) {
      out.push({ field, label, local: cell(local), incoming: cell(incoming), updatable: true, kind: cell(local) === '' ? 'fill' : 'replace', ...extra });
    }
  };
  add('designNo', 'Design NO.', unit.designNo, details.designNo);
  add('pma', 'PMA (P-M-F)', unit.p_m_f, details.pma);
  if (links?.supplierId && String(unit.supplierId || '') !== String(links.supplierId)) {
    out.push({
      field: 'supplierId', label: 'Supplier', local: unit.supplierId ? (supplierNames.get?.(String(unit.supplierId)) || 'another supplier') : '',
      incoming: details.supplier, value: String(links.supplierId), updatable: true, kind: unit.supplierId ? 'replace' : 'fill',
    });
  }
  add('taxRegion', 'Tax Region', unit.supplierTaxRegion, details.taxRegion);
  add('discount', 'Discount', unit.discount, details.discount);
  add('wsp', 'WSP', unit.wsp, details.wsp);
  add('dp', 'DP', unit.dp, details.dp);
  const known = new Set((unit.sourceMovements || []).map((m) => m.key));
  const fresh = (details.movements || []).filter((m) => !known.has(m.key));
  if (fresh.length) out.push({ field: 'movements', label: 'Movement history', local: `${known.size} rows`, incoming: `${known.size + fresh.length} rows`, updatable: true, kind: 'append' });
  return out;
}

/* the movements a unit already has, plus the imported ones it does not -
   deduped on movementKey, each linked to the location / stock point found */
function mergeMovements(existing, incoming, links) {
  const out = [...(existing || [])];
  const known = new Set(out.map((m) => m.key));
  (incoming || []).forEach((m, i) => {
    if (known.has(m.key)) return;
    known.add(m.key);
    out.push({ ...m, locationId: links?.movementLocations?.[i] || null, stockPointId: links?.movementStockPoints?.[i] || null });
  });
  return out;
}

const stockWithLinks = (stock, links) => (stock || []).map((s, i) => ({
  ...s, locationId: links?.stockLocations?.[i] || null, stockPointId: links?.stockStockPoints?.[i] || null,
}));

/* A Details record as the server accepts it: every value re-read as text or
   number, dates as dates, keys and totals worked out again - what the
   browser sent is never trusted to be well-formed. */
export function normaliseDetails(d) {
  if (!d || typeof d !== 'object') return null;
  const n = (v) => { const x = Number(numberText(v)); return Number.isFinite(x) ? x : 0; };
  const seenKeys = new Set();
  const movements = (Array.isArray(d.movements) ? d.movements : []).slice(0, 500).map((m) => {
    const date = m?.docDate instanceof Date ? m.docDate : (m?.docDate ? new Date(m.docDate) : null);
    const x = {
      location: cell(m?.location), docDate: date && !Number.isNaN(date.getTime()) ? date : null,
      docType: cell(m?.docType), docNo: cell(m?.docNo), party: cell(m?.party), particulars: cell(m?.particulars), stockPoint: cell(m?.stockPoint),
      receipts: Math.abs(n(m?.receipts)), issues: Math.abs(n(m?.issues)), balance: n(m?.balance), qty: Math.abs(n(m?.qty)), finalPrice: n(m?.finalPrice), netAmount: Math.abs(n(m?.netAmount)),
    };
    x.signedQty = Math.round((x.receipts - x.issues) * 1000) / 1000;
    x.key = movementKey(x);
    return x;
  }).filter((m) => (seenKeys.has(m.key) ? false : seenKeys.add(m.key)));
  const stock = (Array.isArray(d.stock) ? d.stock : []).slice(0, 100).map((s) => ({ location: cell(s?.location), stockPoint: cell(s?.stockPoint), qty: n(s?.qty) }));
  const printedRaw = d.totals?.printed;
  const printed = printedRaw && typeof printedRaw === 'object'
    ? Object.fromEntries(['receipts', 'issues', 'balance', 'netAmount'].filter((k) => printedRaw[k] !== undefined && printedRaw[k] !== null).map((k) => [k, n(printedRaw[k])]))
    : null;
  const money = (v) => { const t = numberText(v); return isNumber(t) ? String(Number(t)) : ''; };
  const shown = (v) => cell(v).slice(0, 120);
  return {
    itemName: cell(d.itemName), group: cell(d.group), subGroup: cell(d.subGroup), gstSlab: cell(d.gstSlab),
    /* shown in the preview only - the page itself is kept as the payload */
    pageItemCode: shown(d.pageItemCode), ecomId: shown(d.ecomId), consignment: shown(d.consignment), invoiceNo: shown(d.invoiceNo), note: shown(d.note),
    pma: cell(d.pma), designNo: cell(d.designNo), supplier: cell(d.supplier), supplierCode: cell(d.supplierCode) || splitSupplier(d.supplier).code, taxRegion: cell(d.taxRegion),
    discount: money(d.discount), wsp: money(d.wsp), dp: money(d.dp),
    movements, stock, totals: movementTotals(movements, printed), payload: String(d.payload ?? '').slice(0, 20000),
  };
}

export function countByStatus(rows) {
  const counts = { new: 0, same: 0, changed: 0, locked: 0, invalid: 0 };
  /* an image's look-ups, and the values it offered that were not barcodes */
  (rows || []).forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });
  return counts;
}

/* an import field -> the stored field its update writes */
const STORED_FIELD = {
  description: 'printDescription', hsn: 'hsn', purRate: 'purRate', finalNet: 'finalNet', gst: 'gst',
  retailPrice: 'retailPrice', offerPrice: 'offerPrice', wspPrice: 'wspPrice', dpPrice: 'dpPrice',
  designNo: 'designNo', pma: 'p_m_f', taxRegion: 'supplierTaxRegion', discount: 'discount', wsp: 'wsp', dp: 'dp',
};

/* The $set a ticked CHANGED row writes: its updatable differences only, the
   cost price re-encoded for the label when the purchase rate moves, and -
   for a Details record - the source's history snapshot. */
export function updateFor(row, mapping = null, fields = null) {
  /* `fields` - the differences the operator approved (a Set of field
     names); null takes every updatable one */
  const take = (d) => d.updatable && (!fields || fields.has(d.field));
  const set = {};
  (row?.diffs || []).filter(take).forEach((d) => {
    if (d.field === 'supplierId') set.supplierId = d.value;
    else if (d.field !== 'movements') set[STORED_FIELD[d.field]] = d.incoming;
  });
  if ('purRate' in set) set.encodedPurRate = encodeRate(set.purRate, mapping);
  /* the source's history snapshot goes with its movement rows */
  if (row?.snapshot && (!fields || fields.has('movements'))) Object.assign(set, row.snapshot);
  return set;
}

/* One NEW row as the unit of stock it becomes - the fields Barcode
   Generation writes for a received unit (buildDoc in
   app/api/barcode-generation/route.js), from what the report shows.

   Its number is the one printed on the goods: the unit's own number AND its
   old barcode, so the sticker already on them scans (lib/inventory.js
   barcodeFilter). No composed value - it was not received on a GRC here -
   the same shape as the warehouse workbook's imported units
   (scripts/seedWarehouseStockFromExcel.mjs). A quantity over 1 is one
   barcode for all of it (batch), as there. */
export function unitDocFor(values, { businessId, locationId, finYear = '', item = null, mapping = null, details = null, links = null }) {
  const doc = reportUnitDoc(values, { businessId, locationId, finYear, item, mapping });
  if (!details) return doc;
  /* A Details record: in stock only where the source still holds it (the
     location found for its balance), otherwise kept for its history alone -
     never sold, scanned or counted (user, 2026-09-29: the other ERP's
     movements are history on the barcode, not this ERP's ledger). */
  const held = (links?.stockAt || [])[0] || null;
  if (held) {
    Object.assign(doc, {
      status: IN_STOCK,
      businessId: String(held.businessId || businessId || ''),
      locationId: String(held.locationId),
      currentLocationId: held.locationId,
      currentBusinessId: held.businessId || businessId,
      currentStockPointId: held.stockPointId || null,
      qty: String(held.qty),
      qtyNum: held.qty,
    });
  } else {
    Object.assign(doc, {
      status: HISTORY,
      locationId: String(links?.originLocationId || locationId || ''),
      currentLocationId: null,
      currentBusinessId: null,
    });
  }
  return Object.assign(doc, {
    itemName: item?.name || details.itemName || doc.itemName,
    p_m_f: details.pma,
    designNo: details.designNo,
    supplierId: links?.supplierId ? String(links.supplierId) : '',
    supplierTaxRegion: details.taxRegion,
    discount: details.discount,
    wsp: details.wsp,
    dp: details.dp,
    sourceMovements: mergeMovements([], details.movements, links),
    sourceStock: stockWithLinks(details.stock, links),
    sourceTotals: details.totals,
    sourcePayload: details.payload,
  });
}

function reportUnitDoc(values, { businessId, locationId, finYear = '', item = null, mapping = null }) {
  const v = values || {};
  const qty = Number(v.qty);
  const batchType = qty > 1 ? 'batch' : 'unique';
  return {
    grcId: '',
    grcNo: v.grcNo || '',
    supplierId: '',
    barcodeNo: v.barcode,
    oldBarcode: v.barcode,
    barcodeGenerated: '',
    itemCode: v.itemCode,
    itemId: item?._id || null,
    itemName: item?.name || v.description || v.itemCode,
    printDescription: v.description || '',
    supplierDescription: v.description || '',
    qty: v.qty,
    qtyNum: qty,
    uom: v.uom,
    uomType: uomTypeOf(v.uom),
    hsn: v.hsn || '',
    gst: v.gst || '',
    purRate: v.purRate || '',
    encodedPurRate: encodeRate(v.purRate || '', mapping),
    finalNet: v.finalNet || '',
    retailPrice: v.retailPrice || '',
    offerPrice: v.offerPrice || '',
    wspPrice: v.wspPrice || '',
    dpPrice: v.dpPrice || '',
    batchType,
    batchUnique: batchType,
    batchNo: batchType === 'batch' ? v.barcode : '',
    businessId: String(businessId || ''),
    locationId: String(locationId || ''),
    finYear,
    status: IN_STOCK,
    currentLocationId: locationId,
    currentBusinessId: businessId,
    source: IMPORT_SOURCE,
  };
}

/* Whether a barcode number is one this ERP's own counter issues - a Barcode
   Setting period's prefix, digits, suffix. Such a number cannot come in from
   outside: the counter would issue it again later to different goods
   (lib/barcodeEngine.js reads what is already printed only once), and two
   stickers with one number scan as either piece. `formats` are
   [{ prefix, suffix, numberLenght }].
     ignoreCase  "9a1136" is 9A1136 - for REFUSING a number, where a typed
                 lower case must not slip past
     width       at least the period's number of digits (lib/barcodeEngine.js
                 formatBarcode pads to it) - for ACCEPTING a value an image
                 printed on its own, where "9A1" or an OCR'd "1B90" is not
                 a number of the series */
export function inLocalSeries(barcode, formats, { ignoreCase = false, width = false } = {}) {
  const fold = (v) => (ignoreCase ? String(v).toUpperCase() : String(v));
  const value = fold(clean(barcode));
  return (formats || []).some(({ prefix = '', suffix = '', numberLenght = null }) => {
    const p = fold(prefix || '');
    const s = fold(suffix || '');
    if (!value.startsWith(p) || !value.endsWith(s) || value.length <= p.length + s.length) return false;
    const digits = value.slice(p.length, value.length - s.length);
    if (!/^\d+$/.test(digits)) return false;
    const least = Number(numberLenght);
    return !width || !(least > 0) || digits.length >= least;
  });
}
