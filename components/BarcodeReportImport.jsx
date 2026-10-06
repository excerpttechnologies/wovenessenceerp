// // 'use client';
// // import { useRef, useState } from 'react';
// // import * as XLSX from 'xlsx';
// // import Icon from './Icon';
// // import { useScope } from './ScopeContext';
// // import { useOptions } from './useOptions';
// // import { readImport, FIELD_LABELS, SOURCE_URL } from '@/lib/barcodeReportImport';
// // import {
// //   imageProblem, ocrImages, reviewOcrRecords, IMAGE_MAX_COUNT, OCR_MESSAGES, POOR_CONFIDENCE, BARCODE_MIN_CONFIDENCE,
// // } from '@/lib/barcodeReportOcr';

// // /* what the image picker offers - lib/barcodeReportOcr.js checks every file
// //    again, pasted or dropped, before it is read */
// // const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp';

// // /* Reports -> Barcode Report -> IMPORT: SEED this ERP with barcodes that
// //    exist in the other ERP.

// //    Built the way Supplier -> Import from GST works (SupplierImportPanel.jsx):
// //    the operator opens the other ERP's Barcode Report themselves (the square
// //    button in the dialog's header), copies the report table or one barcode's
// //    Details page - or saves its Excel export - and brings it here. Nothing is
// //    fetched from that site and no login to it is stored; the text is read in
// //    this browser (lib/barcodeReportImport.js).

// //    Then a review before anything is saved (user, 2026-09-30):
// //      READY TO IMPORT           a barcode this ERP does not hold - ticked, and
// //                                seeded on Import (a number of this ERP's own
// //                                series too: Barcode Generation moves past it)
// //      EXISTING - NO CHANGES     held here, nothing differs
// //      EXISTING - CHANGES FOUND  held here: its saved data beside the pasted
// //                                data, field by field. A blank it only FILLS is
// //                                ticked; a saved value it would REPLACE waits
// //                                for KEEP EXISTING / REPLACE (or its own tick),
// //                                and Import asks once more before replacing.
// //                                Item, quantity, UOM and masters never change.
// //      ERROR                     cannot come in - the real reason
// //    Import saves what was ticked (/api/reports/barcode-report/import, which
// //    checks every row again) and says what became of each barcode.

// //    An IMAGE that is not a report table - an item's Details page, a sticker -
// //    is only LOOKED UP: its barcode (detectBarcodes), and this ERP's own values
// //    for it; nothing is imported from it, and without a barcode the preview
// //    says NO VALID BARCODE DETECTED. Every image is read on its own.
// //    "Barcode detection" shows what was read, offered, refused and why, and
// //    where every value of a row came from.

// //    `api` is ReportView's toolbar hook - searchFor(filters) runs the report. */

// // const STATUS = {
// //   new: { label: 'READY TO IMPORT', tone: 'bg-okgreenbg text-okgreen' },
// //   changed: { label: 'EXISTING - CHANGES FOUND', tone: 'bg-[#fff4d6] text-[#8a5a00]' },
// //   same: { label: 'EXISTING - NO CHANGES', tone: 'bg-[#eef2f8] text-inkmuted' },
// //   locked: { label: 'EXISTING - SOLD / MOVED', tone: 'bg-[#eef2f8] text-inkmuted' },
// //   invalid: { label: 'ERROR', tone: 'bg-[#fdecec] text-danger' },
// // };
// // const ORDER = ['new', 'changed', 'same', 'locked', 'invalid'];
// // /* a barcode an image showed, looked up - what this ERP holds under it */
// // const LOOKUP = {
// //   matches: { label: 'Found here', tone: 'bg-okgreenbg text-okgreen' },
// //   unconfirmed: { label: 'Found here', tone: 'bg-[#eef2f8] text-inkmuted' },
// //   different: { label: 'Different goods', tone: 'bg-[#fdecec] text-danger' },
// //   several: { label: 'Several units', tone: 'bg-[#fff4d6] text-[#8a5a00]' },
// //   missing: { label: 'Not in this ERP', tone: 'bg-[#fdecec] text-danger' },
// // };
// // /* what became of each barcode (the server's `actions`) */
// // const ACTIONS = {
// //   seeded: { label: 'Seeded', tone: 'text-okgreen' },
// //   replaced: { label: 'Replaced existing barcode data', tone: 'text-[#8a5a00]' },
// //   filled: { label: 'Blank fields filled', tone: 'text-okgreen' },
// //   retained: { label: 'Existing data retained', tone: 'text-inkmuted' },
// //   skipped: { label: 'Skipped', tone: 'text-inkmuted' },
// //   error: { label: 'Error', tone: 'text-danger' },
// // };
// // /* where a value came from, in words (lib/barcodeReportImport.js) */
// // const SOURCE_WORDS = {
// //   column: 'Barcode column',
// //   label: 'printed as the barcode',
// //   standalone: 'printed on its own',
// //   typed: 'typed by you',
// //   import_column: 'report column',
// //   details_label: 'page label',
// //   details_receipt: 'first receipt of the movements',
// //   details_stock: 'stock the page shows',
// //   typed_barcode: 'typed by you',
// //   detected_barcode: 'detected on the page',
// //   existing_barcode_lookup: 'this ERP (barcode lookup)',
// //   item_master: 'Item master',
// // };
// // /* the fields EXISTING DATA and IMPORTED DATA are compared on, and the
// //    difference (diff field) each one is written through */
// // const COMPARE = [
// //   ['barcode', 'Barcode'], ['itemCode', 'Item Code'], ['description', 'Description'], ['uom', 'UOM'], ['qty', 'Quantity'],
// //   ['hsn', 'HSN'], ['gst', 'GST %'], ['purRate', 'Purchase Rate'], ['finalNet', 'Final Rate'], ['retailPrice', 'Retail Price (RSP)'],
// //   ['wspPrice', 'WSP'], ['dpPrice', 'DP'], ['supplier', 'Supplier', 'supplierId'], ['location', 'Location'], ['status', 'Stock'],
// // ];
// // /* one value on the page, two fields on the barcode: a Details page's WSP is
// //    both its WSP price and its base WSP (and DP the same) - shown as one row,
// //    taken or kept together */
// // const TWINS = { wspPrice: 'wsp', dpPrice: 'dp' };
// // const TWIN_OF = new Set(Object.values(TWINS));
// // const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
// // const txt = (v) => String(v ?? '').trim();
// // const sameText = (a, b) => txt(a) === txt(b) || (txt(a) !== '' && txt(b) !== '' && Number.isFinite(Number(a)) && Number.isFinite(Number(b)) && Number(a) === Number(b));

// // function Modal({ title, onClose, children, size = 'md', headerAction }) {
// //   const width = size === 'lg' ? 'max-w-[1120px]' : size === 'sm' ? 'max-w-[460px]' : 'max-w-[760px]';
// //   return (
// //     <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
// //       <div className={'flex max-h-[calc(100vh-2rem)] w-full flex-col rounded-lg bg-white shadow-xl ' + width}>
// //         <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-3">
// //           <span className="text-[15px] font-bold uppercase tracking-wide">{title}</span>
// //           <div className="flex items-center gap-1">
// //             {headerAction}
// //             <button type="button" onClick={onClose} className="text-2xl leading-none text-inkmuted" aria-label="Close">×</button>
// //           </div>
// //         </div>
// //         {children}
// //       </div>
// //     </div>
// //   );
// // }

// // /* the first sheet of a workbook as rows of cells - an .xlsx, an .xls (the
// //    report's own export is an HTML table saved as .xls, which SheetJS reads)
// //    or a .csv. raw:false keeps a barcode such as 000123 as the text shown. */
// // function readWorkbook(file) {
// //   return new Promise((resolve, reject) => {
// //     const reader = new FileReader();
// //     reader.onload = () => {
// //       try {
// //         const wb = XLSX.read(reader.result, { type: 'array' });
// //         const sheet = wb.Sheets[wb.SheetNames[0]];
// //         if (!sheet) throw new Error('That workbook has no sheets.');
// //         resolve(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }));
// //       } catch (e) {
// //         reject(new Error(e?.message ? 'Could not read that file: ' + e.message : 'Could not read that file.'));
// //       }
// //     };
// //     reader.onerror = () => reject(new Error('Could not read that file.'));
// //     reader.readAsArrayBuffer(file);
// //   });
// // }

// // /* a sheet's cell as a pasted cell: a line break inside it (Alt+Enter, or a
// //    <br> in the report's HTML export) is a space, and a cell that starts with
// //    a quote is quoted - so one row of the sheet stays one row */
// // const sheetCell = (value) => {
// //   const v = String(value ?? '').replace(/[\r\n\t]+/g, ' ');
// //   return v.startsWith('"') ? '"' + v.replace(/"/g, '""') + '"' : v;
// // };

// // /* what is sent for each record - never more than the server reads */
// // const recordsOf = (list) => (list || []).map(({ line, values, details, review, origin, sources, lookupOnly, candidate, crossCheck }) => ({
// //   line, values, details, review, origin, sources, lookupOnly, candidate, crossCheck,
// // }));

// // /* which differences of a CHANGED row are ticked when the preview opens:
// //    blanks it fills and history it adds (GST Parse's rule) - none when the
// //    pasted page looks like different goods, or when the number matched only
// //    the unit's old barcode (the operator decides those) */
// // const defaultPicks = (row) => {
// //   if (row.status !== 'changed' || row.identity?.state === 'different' || row.oldOnly) return new Set();
// //   return new Set((row.diffs || []).filter((d) => d.updatable && (d.kind === 'fill' || d.kind === 'append')).map((d) => d.field));
// // };

// // export default function BarcodeReportImport({ api }) {
// //   const { business, location: scopeLocation, finYear } = useScope();
// //   const { options: locations } = useOptions('companylocations');
// //   const [open, setOpen] = useState(false);
// //   const [step, setStep] = useState('paste');      // 'paste' | 'review' | 'done'
// //   const [paste, setPaste] = useState('');
// //   /* where the text in the box came from: 'text' (pasted / typed) or 'ocr' -
// //      an image's text put there by Edit as text, which keeps the image's rules */
// //   const [textOrigin, setTextOrigin] = useState('text');
// //   /* the barcode number of a pasted Details page, which does not print one -
// //      or, with an image, a barcode to look up */
// //   const [barcode, setBarcode] = useState('');
// //   const [fileName, setFileName] = useState('');
// //   const [location, setLocation] = useState('');
// //   const [busy, setBusy] = useState(false);
// //   const [error, setError] = useState('');
// //   const [read, setRead] = useState(null);         // what the browser read
// //   const [review, setReview] = useState(null);     // what the server says each row becomes
// //   const [ticked, setTicked] = useState(new Set());               // NEW rows to seed
// //   const [picks, setPicks] = useState(new Map());                 // CHANGED rows: key -> Set of fields to write
// //   const [decided, setDecided] = useState(new Map());             // key -> 'keep' | 'replace'
// //   const [open2, setOpen2] = useState(new Set());                 // rows whose detail is open
// //   const [confirming, setConfirming] = useState(false);           // "Replace existing barcode data?"
// //   /* an image import: the operator's word that they compared the barcodes
// //      with the image - OCR can be sure of a wrong character */
// //   const [compared, setCompared] = useState(false);
// //   const [result, setResult] = useState(null);
// //   /* screenshots pasted, dropped or chosen: [{ id, file, url, name, size }] */
// //   const [images, setImages] = useState([]);
// //   const [ocr, setOcr] = useState(null);           // what OCR read from them
// //   /* back from a look-up of an image: the next image REPLACES it (the "go
// //      back and upload another image" the no-barcode panel asks for) */
// //   const [replaceNext, setReplaceNext] = useState(false);
// //   /* both text and images given: which one Check reads - never both mixed */
// //   const [source, setSource] = useState('image');
// //   const [stage, setStage] = useState('');         // "Reading image..." while busy
// //   const [dragging, setDragging] = useState(false);
// //   const fileRef = useRef(null);
// //   const imageRef = useRef(null);

// //   const target = location || scopeLocation || '';

// //   function dropImages(list = images) {
// //     list.forEach((img) => URL.revokeObjectURL(img.url));
// //     setImages([]);
// //     setOcr(null);
// //   }

// //   function start() {
// //     setOpen(true); setStep('paste'); setPaste(''); setTextOrigin('text'); setBarcode(''); setFileName(''); setError('');
// //     setRead(null); setReview(null); setResult(null); setTicked(new Set()); setPicks(new Map()); setDecided(new Map());
// //     setOpen2(new Set()); setConfirming(false);
// //     setLocation(scopeLocation || '');
// //     dropImages(); setSource('image'); setStage(''); setReplaceNext(false);
// //   }

// //   /* images in: each checked (type, extension, size) before it is kept */
// //   function addImages(files) {
// //     if (busy) return;
// //     const list = [...(files || [])];
// //     if (!list.length) return;
// //     const bad = list.map(imageProblem).find(Boolean);
// //     if (bad) { setError(bad); return; }
// //     const keep = replaceNext ? [] : images;
// //     if (replaceNext) { images.forEach((img) => URL.revokeObjectURL(img.url)); setReplaceNext(false); }
// //     if (keep.length + list.length > IMAGE_MAX_COUNT) { setError(`At most ${IMAGE_MAX_COUNT} images can be read at a time.`); return; }
// //     const added = list.map((file, i) => ({
// //       id: `${Date.now()}-${i}`, file, url: URL.createObjectURL(file), name: file.name || `Pasted image ${keep.length + i + 1}`, size: file.size,
// //     }));
// //     setImages([...keep, ...added]);
// //     setOcr(null);
// //     setSource('image');
// //     setError('');
// //   }

// //   function removeImage(id) {
// //     if (busy) return;
// //     const gone = images.find((img) => img.id === id);
// //     if (gone) URL.revokeObjectURL(gone.url);
// //     setImages((current) => current.filter((img) => img.id !== id));
// //     setOcr(null);
// //     setError('');
// //   }

// //   /* Ctrl+V: a screenshot on the clipboard becomes an image here; text is
// //      pasted into the box as it always was - and a clipboard holding both
// //      (cells copied from Excel carry a picture of themselves) pastes its
// //      TEXT into the box */
// //   function onPaste(event) {
// //     const files = [...(event.clipboardData?.files || [])].filter((f) => /^image\//.test(f.type));
// //     if (!files.length) return;
// //     const text = event.clipboardData?.getData('text') || '';
// //     if (text.trim() && event.target?.tagName === 'TEXTAREA') return;
// //     event.preventDefault();
// //     addImages(files);
// //   }

// //   function onDrop(event) {
// //     event.preventDefault();
// //     setDragging(false);
// //     if (busy) return;
// //     const files = [...(event.dataTransfer?.files || [])];
// //     if (!files.length) return;
// //     if (files.some((f) => !/^image\//.test(f.type))) {
// //       setError('Only PNG, JPG or WEBP images can be dropped here - use Choose Excel file for a workbook.');
// //       return;
// //     }
// //     addImages(files);
// //   }

// //   function pickImages(event) {
// //     const files = [...(event.target.files || [])];
// //     event.target.value = '';
// //     addImages(files);
// //   }

// //   /* the extracted text into the text box, to correct and Check as text -
// //      still under an image's rules (textOrigin 'ocr'), with the image kept
// //      beside it to compare with */
// //   function editExtracted() {
// //     if (busy) return;
// //     const text = ocr?.text ?? read?.ocr?.text;
// //     if (text === undefined) return;
// //     setPaste(text);
// //     setTextOrigin('ocr');
// //     setSource('text');
// //     setStep('paste');
// //     setError('');
// //   }
// //   const close = () => { if (!busy) setOpen(false); };
// //   const locationName = () => locations.find((o) => String(o.value) === String(target))?.label || '';

// //   async function post(payload) {
// //     const r = await fetch('/api/reports/barcode-report/import', {
// //       method: 'POST',
// //       headers: { 'Content-Type': 'application/json' },
// //       body: JSON.stringify({ business, location: target, finYear, ...payload }),
// //     });
// //     const d = await r.json().catch(() => ({}));
// //     if (!r.ok) throw new Error(d.error || 'The server could not do that.');
// //     return d;
// //   }

// //   /* the choices a fresh preview opens with */
// //   function openReview(table, d) {
// //     setRead(table);
// //     setReview(d);
// //     setTicked(new Set(d.rows.filter((r) => r.status === 'new').map((r) => r.key)));
// //     setPicks(new Map(d.rows.filter((r) => r.status === 'changed').map((r) => [r.key, defaultPicks(r)])));
// //     setDecided(new Map());
// //     const rows = d.rows.filter((r) => r.status in STATUS);
// //     setOpen2(new Set(rows.length <= 3 ? rows.map((r) => r.key) : []));
// //     setCompared(false);
// //     setConfirming(false);
// //     setStep('review');
// //   }

// //   /* what was read -> the server's verdict on every row */
// //   async function check(table) {
// //     if (table.error) { setError(table.error); return; }
// //     if (!table.records.length) {
// //       const why = (table.left || []).slice(0, 3).map((l) => `line ${l.line}: ${l.reason}`).join('; ');
// //       setError('No barcode rows were found under the headings.' + (why ? ` Left out - ${why}.` : ''));
// //       return;
// //     }
// //     if (!target) { setError('Choose the Business Location the barcodes go into.'); return; }
// //     setBusy(true); setError('');
// //     try {
// //       const d = await post({ mode: 'check', records: recordsOf(table.records) });
// //       openReview(table, d);
// //     } catch (e) {
// //       setError(e.message);
// //     } finally {
// //       setBusy(false);
// //     }
// //   }

// //   /* an image with no barcode on it: straight to the preview's NO VALID
// //      BARCODE DETECTED - nothing to look up, nothing sent */
// //   function showNoBarcode(table) {
// //     setRead(table);
// //     setReview({ rows: [], counts: {}, location: locationName(), warnings: [], unmatched: [], mastersMatched: 0 });
// //     setTicked(new Set()); setPicks(new Map()); setDecided(new Map()); setOpen2(new Set());
// //     setCompared(false);
// //     setStep('review');
// //   }

// //   /* what an image (or its corrected text) gave, by kind: a report table's
// //      rows (held for review where OCR was unsure, or where they do not add up
// //      to the TOTAL row), a barcode to look up, or no barcode at all */
// //   async function checkFromImage(table, ocrRead, text = null) {
// //     if (table.kind === 'none') { showNoBarcode({ ...table, ocr: ocrRead }); return; }
// //     let records = table.records;
// //     if (table.kind === 'table' && ocrRead) records = reviewOcrRecords(records, ocrRead);
// //     else if (table.kind === 'table' && text !== null) records = reviewOcrRecords(records, { text, lines: [] });
// //     await check({ ...table, records, ocr: ocrRead || ocr });
// //   }

// //   function checkPaste() {
// //     if (!paste.trim()) { setError(OCR_MESSAGES.noText); return; }
// //     setFileName('');
// //     /* text an image gave keeps the image's rules, however it got here */
// //     const origin = textOrigin === 'ocr' || (ocr?.text && paste.trim() === ocr.text.trim()) ? 'ocr' : 'text';
// //     const table = readImport(paste, { barcode, origin });
// //     if (origin === 'ocr' && !table.error) { checkFromImage(table, null, paste); return; }
// //     check(table);
// //   }

// //   /* IMAGE -> OCR -> TEXT, each image on its own, and from there the very
// //      reader a paste goes through. OCR runs only here, when Check is pressed. */
// //   async function checkImages() {
// //     /* the stage from the first moment - the OCR engine itself takes a
// //        moment to load */
// //     setBusy(true); setError(''); setFileName(''); setStage('Reading image...');
// //     let ocrRead;
// //     try {
// //       ocrRead = await ocrImages(images.map((img) => img.file), { onStage: setStage });
// //     } catch (e) {
// //       console.error('Barcode Report image OCR failed', e);
// //       setOcr(null); setError(OCR_MESSAGES.failed); setBusy(false); setStage('');
// //       return;
// //     }
// //     setOcr(ocrRead);
// //     const stop = (message) => { setError(message); setBusy(false); setStage(''); };
// //     if (!ocrRead.words || !ocrRead.text.trim()) { stop(OCR_MESSAGES.noReadable); return; }
// //     const poor = ocrRead.confidence < POOR_CONFIDENCE ? ' ' + OCR_MESSAGES.poor : '';
// //     const pages = (ocrRead.pages || [{ name: 'image', text: ocrRead.text, lines: ocrRead.lines }]).map((page, i) => ({
// //       page, i, read: readImport(page.text, { origin: 'image', lines: page.lines, minConfidence: BARCODE_MIN_CONFIDENCE }),
// //     })).filter((p) => p.page.text.trim());
// //     const broken = pages.find((p) => p.read.error);
// //     if (broken) {
// //       const message = /headings could not/.test(broken.read.error) ? broken.read.error : OCR_MESSAGES.noTable + ' ' + broken.read.error;
// //       stop((pages.length > 1 ? `${broken.page.name}: ` : '') + message + poor);
// //       return;
// //     }
// //     const tables = pages.filter((p) => p.read.kind === 'table');
// //     if (tables.length && tables.length !== pages.length) { stop(OCR_MESSAGES.mixed); return; }
// //     setBusy(false);
// //     if (tables.length) {
// //       /* report-table screenshots: every image's rows, each checked against
// //          its own TOTAL row and OCR confidence */
// //       setStage('Validating records...');
// //       let line = 0;
// //       const records = tables.flatMap(({ page, read: r }) => reviewOcrRecords(r.records, { text: page.text, lines: page.lines })
// //         .map((rec) => ({ ...rec, line: ++line })));
// //       const first = tables[0].read;
// //       await check({
// //         ...first, records,
// //         unmapped: [...new Set(tables.flatMap((t) => t.read.unmapped))],
// //         ignored: tables.reduce((a, t) => a + t.read.ignored, 0),
// //         left: tables.flatMap((t) => t.read.left || []),
// //         detection: {
// //           ...first.detection,
// //           candidates: tables.flatMap((t) => t.read.detection?.candidates || []),
// //           rejected: tables.flatMap((t) => t.read.detection?.rejected || []),
// //         },
// //         ocr: ocrRead,
// //       });
// //       setStage('');
// //       return;
// //     }
// //     /* anything else: each image's own barcodes, looked up - with that
// //        image's own item name and GRC to compare, never another image's -
// //        and the number typed in the box as a look-up of its own */
// //     let line = 0;
// //     const records = pages.flatMap(({ read: r, i }) => r.records.map((rec) => ({ ...rec, line: ++line, candidate: { ...rec.candidate, page: i } })));
// //     const typedValue = barcode.trim();
// //     if (typedValue) records.push({ line: ++line, lookupOnly: true, origin: 'image', values: { barcode: typedValue }, candidate: { source: 'typed', page: -1, confidence: null } });
// //     const detection = {
// //       candidates: pages.flatMap(({ read: r, page }) => (r.detection?.candidates || []).map((c) => ({ ...c, image: page.name }))),
// //       rejected: pages.flatMap(({ read: r, page }) => (r.detection?.rejected || []).map((x) => ({ ...x, image: page.name }))),
// //       details: pages.some(({ read: r }) => r.detection?.details),
// //       skipped: {
// //         filters: pages.reduce((a, { read: r }) => a + (r.detection?.skipped?.filters || 0), 0),
// //         movements: pages.reduce((a, { read: r }) => a + (r.detection?.skipped?.movements || 0), 0),
// //       },
// //       /* images that showed no barcode at all */
// //       empty: pages.filter(({ read: r }) => r.kind === 'none').map(({ page }) => page.name),
// //       images: pages.length,
// //     };
// //     const table = { kind: records.length ? 'lookup' : 'none', origin: 'image', records, columns: [], unmapped: [], ignored: 0, left: [], warnings: [], detection, error: '' };
// //     setStage('Looking up the barcode...');
// //     await checkFromImage(table, ocrRead);
// //     setStage('');
// //   }

// //   const hasText = paste.trim() !== '';
// //   const useImages = images.length > 0 && (!hasText || source === 'image');
// //   function runCheck() {
// //     if (!hasText && !images.length) { setError(OCR_MESSAGES.noText); return; }
// //     if (useImages) checkImages(); else checkPaste();
// //   }

// //   async function pickFile(event) {
// //     const file = event.target.files?.[0];
// //     event.target.value = '';
// //     if (!file) return;
// //     setBusy(true); setError('');
// //     try {
// //       const matrix = await readWorkbook(file);
// //       setFileName(file.name);
// //       setBusy(false);
// //       /* the sheet's rows as the lines a paste would give - one reader for
// //          both, so a report table and an exported Details page both work */
// //       await check(readImport(matrix.map((row) => row.map(sheetCell).join('\t')).join('\n'), { barcode }));
// //     } catch (e) {
// //       setError(e.message);
// //       setBusy(false);
// //     }
// //   }

// //   const rows = review?.rows || [];
// //   const fromImage = read?.origin === 'image' || read?.origin === 'ocr';
// //   /* an image that is not a report table: looked up, never imported */
// //   const lookupMode = read?.kind === 'lookup' || read?.kind === 'none';
// //   const lookupRows = rows.filter((r) => r.status === 'lookup');
// //   /* what the IMAGE showed - a number the operator typed is their own look-up */
// //   const imageRows = lookupRows.filter((r) => r.candidate?.source !== 'typed');
// //   const noBarcode = lookupMode && !imageRows.length;
// //   const importRows = rows.filter((r) => r.status in STATUS);
// //   const changedRows = importRows.filter((r) => r.status === 'changed' && r.updatable);
// //   const pickedOf = (r) => picks.get(r.key) || new Set();
// //   const replacesOf = (r) => (r.diffs || []).filter((d) => d.updatable && d.kind === 'replace' && pickedOf(r).has(d.field));
// //   const adding = importRows.filter((r) => r.status === 'new' && ticked.has(r.key)).length;
// //   const replacing = changedRows.filter((r) => replacesOf(r).length).length;
// //   const filling = changedRows.filter((r) => pickedOf(r).size && !replacesOf(r).length).length;
// //   const needsDecision = changedRows.filter((r) => r.replaces && !decided.has(r.key) && !replacesOf(r).length);

// //   const toggleNew = (key) => setTicked((set) => { const next = new Set(set); if (next.has(key)) next.delete(key); else next.add(key); return next; });
// //   const setRowPicks = (r, fields, how) => {
// //     setPicks((map) => new Map(map).set(r.key, new Set(fields)));
// //     if (how) setDecided((map) => new Map(map).set(r.key, how));
// //   };
// //   /* KEEP EXISTING: nothing saved is overwritten - only the blanks it fills
// //      (GST Parse's rule), and not even those for different goods */
// //   const keepRow = (r) => setRowPicks(r, defaultPicks(r), 'keep');
// //   /* REPLACE: every difference an import may write (never item / qty / UOM) */
// //   const replaceRow = (r) => setRowPicks(r, (r.diffs || []).filter((d) => d.updatable).map((d) => d.field), 'replace');
// //   /* one tick, one or more fields (a value and its twin) - all taken or none */
// //   const toggleField = (r, fields) => {
// //     const list = [].concat(fields);
// //     const next = new Set(pickedOf(r));
// //     const all = list.every((f) => next.has(f));
// //     list.forEach((f) => (all ? next.delete(f) : next.add(f)));
// //     setRowPicks(r, next, 'custom');
// //   };
// //   const toggleOpen = (key) => setOpen2((set) => { const next = new Set(set); if (next.has(key)) next.delete(key); else next.add(key); return next; });

// //   function askImport() {
// //     if (replacing) { setConfirming(true); return; }
// //     runImport();
// //   }

// //   async function runImport() {
// //     if (lookupMode) return;
// //     setConfirming(false);
// //     setBusy(true); setError('');
// //     try {
// //       const d = await post({
// //         mode: 'import',
// //         records: recordsOf(read?.records),
// //         /* each difference approved, with the saved value it was approved
// //            against - the server writes it only while that value is still there */
// //         update: changedRows.filter((r) => pickedOf(r).size).map((r) => ({
// //           barcode: r.barcode,
// //           unitId: r.unitId,
// //           fields: Object.fromEntries([...pickedOf(r)].map((field) => [field, (r.diffs || []).find((x) => x.field === field)?.local ?? ''])),
// //         })),
// //         skip: importRows.filter((r) => r.status === 'new' && !ticked.has(r.key)).map((r) => r.barcode),
// //         ...(fromImage ? { compared } : {}),
// //       });
// //       setResult(d);
// //       setStep('done');
// //       /* show what came in: run the report again, or for the imported item */
// //       const codes = d.itemCodes || [];
// //       const current = String(api?.filters?.itemCode || '').trim().toLowerCase();
// //       const shows = api?.searched && current && codes.some((c) => String(c).toLowerCase().includes(current));
// //       api?.searchFor(shows || !codes.length ? {} : { itemCode: codes[0] });
// //     } catch (e) {
// //       setError(e.message);
// //     } finally {
// //       setBusy(false);
// //     }
// //   }

// //   const back = () => {
// //     setStep('paste'); setError(''); setConfirming(false);
// //     /* from an image's look-up: the next image replaces this one */
// //     if (lookupMode && useImages) setReplaceNext(true);
// //   };

// //   const sourceLink = (
// //     /* the shortcut to the source report - GST Parse's portal button */
// //     <a
// //       href={SOURCE_URL}
// //       target="_blank"
// //       rel="noopener noreferrer"
// //       title="Open the Barcode Report on erp.orbiteerp.com"
// //       aria-label="Open the Barcode Report on erp.orbiteerp.com"
// //       className="flex h-8 w-8 items-center justify-center rounded-md bg-brand leading-none text-white hover:bg-brand-hover"
// //     >
// //       <Icon name="search" size={16} />
// //     </a>
// //   );

// //   /* the image(s) read, beside the rows - at their own size (scroll
// //      sideways), so a barcode can be compared; click opens one in a tab */
// //   const imageStrip = fromImage && images.length > 0 && (
// //     <div className="mt-2 flex max-h-[260px] gap-2 overflow-auto rounded border border-line p-1" aria-label="The image read">
// //       {images.map((img) => (
// //         <a key={img.id} href={img.url} target="_blank" rel="noopener noreferrer" title="Open the image at full size" className="shrink-0">
// //           <img src={img.url} alt={img.name} className="h-auto max-w-none rounded" />
// //         </a>
// //       ))}
// //     </div>
// //   );
// //   const sourceText = read?.kind === 'details' ? 'Copied Barcode Details report' + (fileName ? ` (${fileName})` : '')
// //     : fileName ? `Barcode Report table (${fileName})`
// //       : read?.origin === 'image' ? 'Barcode Report table (screenshot)'
// //         : read?.origin === 'ocr' ? 'Barcode Report table (text read from a screenshot)' : 'Barcode Report table (copied)';

// //   return (
// //     <>
// //       <button type="button" className="btn" onClick={start}>
// //         <Icon name="upload" size={14} /> Import
// //       </button>

// //       {open && step === 'paste' && (
// //         <Modal title="Import Barcodes" onClose={close} headerAction={sourceLink}>
// //           <div
// //             className={'flex-1 overflow-y-auto p-5 ' + (dragging ? 'outline-dashed outline-2 -outline-offset-4 outline-brand' : '')}
// //             onPaste={onPaste}
// //             onDragOver={(e) => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); setDragging(true); } }}
// //             onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
// //             onDrop={onDrop}
// //           >
// //             <p className="mb-3 text-[13px] text-inkmuted">
// //               Open the Barcode Report on erp.orbiteerp.com (the button above) and copy either the whole report table - from
// //               the Barcode heading to the last row - or one barcode&apos;s Details page, and paste it below, or choose the
// //               report&apos;s Excel file. A barcode this ERP does not hold is seeded; for one it holds you see its saved data beside
// //               the pasted data and choose what to replace. You can also paste (Ctrl+V) or drop a screenshot: a screenshot of the
// //               report table is read row by row, any other image only has its barcode looked up. Nothing is saved until you
// //               check the preview and press Import.
// //             </p>
// //             <label htmlFor="barcode-import-location" className="mb-1 block text-[13px] text-ink">Import into<span className="f-req">*</span></label>
// //             <select
// //               id="barcode-import-location"
// //               value={target}
// //               disabled={busy}
// //               onChange={(e) => { setLocation(e.target.value); setError(''); }}
// //               className="f-input mb-3 w-full"
// //             >
// //               <option value="">Choose a Business Location</option>
// //               {locations.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
// //             </select>
// //             <textarea
// //               value={paste}
// //               autoFocus
// //               rows={12}
// //               readOnly={busy}
// //               placeholder="Paste the Barcode Report table, or one barcode's Details page, here - or paste a screenshot of it (Ctrl+V)..."
// //               onChange={(e) => {
// //                 const next = e.target.value;
// //                 /* text replaced as a whole is the operator's own again */
// //                 if (!next.trim() || (textOrigin === 'ocr' && paste.trim() && !next.includes(paste.trim().slice(0, 40)) && next.length > 40)) setTextOrigin('text');
// //                 setPaste(next);
// //                 setError('');
// //               }}
// //               className="w-full resize-y rounded-md border border-linestrong p-2.5 font-mono text-[12.5px] leading-[1.5]"
// //               aria-label="Barcode Report table"
// //             />
// //             {textOrigin === 'ocr' && hasText && (
// //               <p className="mt-1 text-[12px] text-[#8a5a00]">
// //                 This text was read from an image, and an image&apos;s rules stay with it: a report table is imported only once
// //                 you confirm you compared it with the image (its TOTAL row is checked again); anything else only has its
// //                 barcode looked up.
// //               </p>
// //             )}
// //             <label htmlFor="barcode-import-barcode" className="mb-1 mt-2 block text-[13px] text-ink">
// //               Barcode <span className="text-[12px] text-inkmuted">- a Details page&apos;s number when the page does not show one, or a barcode to look up with an image (not used for a report table)</span>
// //             </label>
// //             <input
// //               id="barcode-import-barcode"
// //               value={barcode}
// //               readOnly={busy}
// //               onChange={(e) => { setBarcode(e.target.value); setError(''); }}
// //               className="f-input w-full sm:w-[260px]"
// //               placeholder="e.g. 9A2890"
// //             />
// //             {images.length > 0 && (
// //               <div className="mt-3 rounded border border-line bg-[#f7f9fc] p-3" aria-label="Pasted report images">
// //                 <div className="mb-2 flex items-center justify-between text-[12.5px]">
// //                   <span className="font-semibold text-ink">
// //                     Image input detected - {plural(images.length, 'image')}
// //                     {replaceNext ? <span className="ml-2 font-normal text-[#8a5a00]">(adding an image now replaces {images.length > 1 ? 'these' : 'this one'})</span> : null}
// //                   </span>
// //                   <button type="button" className="btn" onClick={() => { dropImages(); setReplaceNext(false); setError(''); }} disabled={busy}>
// //                     <Icon name="trash" size={14} /> Remove {images.length > 1 ? 'Images' : 'Image'}
// //                   </button>
// //                 </div>
// //                 <div className="flex flex-wrap gap-2">
// //                   {images.map((img) => (
// //                     <div key={img.id} className="relative w-[220px] rounded border border-line bg-white p-1">
// //                       <img src={img.url} alt={img.name} className="h-[120px] w-full rounded object-contain" />
// //                       <div className="mt-1 truncate text-[11px] text-inkmuted" title={img.name}>{img.name} · {(img.size / 1024).toFixed(0)} KB</div>
// //                       <button type="button" onClick={() => removeImage(img.id)} disabled={busy} aria-label={`Remove ${img.name}`}
// //                         className="absolute right-1 top-1 rounded bg-white/90 px-1.5 text-[13px] leading-5 text-inkmuted shadow hover:text-danger">×</button>
// //                     </div>
// //                   ))}
// //                 </div>
// //                 {hasText && (
// //                   /* both given: which one Check reads - never silently mixed */
// //                   <div className="mt-2 flex flex-wrap items-center gap-4 text-[12.5px]">
// //                     <span className="text-[#8a5a00]">Text input detected as well - check:</span>
// //                     <label className="flex items-center gap-1"><input type="radio" name="import-source" checked={source === 'image'} disabled={busy} onChange={() => setSource('image')} /> the image{images.length > 1 ? 's' : ''}</label>
// //                     <label className="flex items-center gap-1"><input type="radio" name="import-source" checked={source === 'text'} disabled={busy} onChange={() => setSource('text')} /> the pasted text</label>
// //                   </div>
// //                 )}
// //               </div>
// //             )}
// //             <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px] text-inkmuted">
// //               <span>or</span>
// //               <button type="button" className="btn" onClick={() => imageRef.current?.click()} disabled={busy}>
// //                 <Icon name="image" size={14} /> Choose Image
// //               </button>
// //               <input ref={imageRef} type="file" accept={IMAGE_ACCEPT} multiple onChange={pickImages} className="hidden" aria-label="Barcode Report image" />
// //               <span>or</span>
// //               <button type="button" className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>
// //                 <Icon name="file" size={14} /> Choose Excel file
// //               </button>
// //               <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={pickFile} className="hidden" aria-label="Barcode Report Excel file" />
// //               {fileName && <span>{fileName}</span>}
// //             </div>
// //             {error && <div className="flash flash-err mt-3">{error}</div>}
// //             {ocr && <OcrPanel ocr={ocr} onEdit={editExtracted} busy={busy} />}
// //           </div>
// //           <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-3">
// //             <button type="button" className="btn" onClick={close} disabled={busy}>Cancel</button>
// //             <button type="button" className="btn btn-primary flex h-[38px] min-w-[160px] justify-center" onClick={runCheck} disabled={busy}>
// //               {busy ? <span className="spin" /> : <Icon name="check" size={14} />} {busy && stage ? stage : 'Check'}
// //             </button>
// //           </div>
// //         </Modal>
// //       )}

// //       {open && step === 'review' && review && lookupMode && (
// //         <Modal title="Barcode Import Preview" onClose={close} size="lg" headerAction={sourceLink}>
// //           <div className="flex-1 overflow-y-auto p-5">
// //             {lookupRows.length > 0 && (
// //               <p className="mb-2 text-[13px] text-inkmuted">
// //                 {read?.origin === 'ocr' ? 'This text was read from an image, which' : 'This image is not a Barcode Report table, so it'} only
// //                 identifies a barcode: every value below is this ERP&apos;s own, looked up by the barcode - none is read from the
// //                 image, and nothing is imported from it.
// //                 {review.location ? <> Looked up for <span className="font-semibold text-ink">{review.location}</span>&apos;s business.</> : null}
// //               </p>
// //             )}
// //             {read?.ocr && <OcrPanel ocr={read.ocr} found={imageRows.length} onEdit={editExtracted} busy={busy} />}
// //             {imageStrip}
// //             {noBarcode && <NoBarcode detection={read?.detection} origin={read?.origin} />}
// //             {!noBarcode && read?.detection?.empty?.length > 0 && (
// //               <div className="mt-2 text-[12.5px] text-[#8a5a00]">No valid barcode detected in: {read.detection.empty.join(', ')}.</div>
// //             )}
// //             {lookupRows.length > 0 && <LookupTable rows={lookupRows} />}
// //             <Detection read={read} rows={rows} />
// //             {error && <div className="flash flash-err mt-3">{error}</div>}
// //           </div>
// //           <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-3">
// //             <button type="button" className="btn" onClick={back} disabled={busy}>
// //               <Icon name="back" size={14} /> Back
// //             </button>
// //             <button type="button" className="btn btn-primary" onClick={close} disabled={busy}>Close</button>
// //           </div>
// //         </Modal>
// //       )}

// //       {open && step === 'review' && review && !lookupMode && (
// //         <Modal title="Barcode Import Preview" onClose={close} size="lg" headerAction={sourceLink}>
// //           <div className="flex-1 overflow-y-auto p-5">
// //             <div className="mb-2 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
// //               <span className="text-inkmuted">Import into: <span className="font-semibold text-ink">{review.location}</span></span>
// //               <span className="text-inkmuted">Source: <span className="font-semibold text-ink">{sourceText}</span></span>
// //             </div>
// //             <p className="mb-2 text-[12.5px] text-inkmuted">
// //               A barcode this ERP does not hold is ready to import (seeded) - in stock where the source still holds it, or kept as
// //               history when none is left. For a barcode it already holds, its existing data is shown beside the imported data:
// //               a blank the import only fills is ticked, a saved value it would replace waits for KEEP EXISTING or REPLACE. Item,
// //               quantity and UOM are never changed, and masters are never created or changed.
// //               {fromImage ? ' Rows read from an image never change a barcode already here - their values are only shown.' : ''}
// //             </p>
// //             {read?.ocr && <OcrPanel ocr={read.ocr} records={read.records.length} flagged={read.records.filter((r) => r.review?.some((x) => x.field === 'barcode')).length}
// //               totals={read.records.some((r) => r.review?.some((x) => x.field === 'qty'))} onEdit={editExtracted} busy={busy} />}
// //             {imageStrip}
// //             {fromImage && (
// //               <label className="my-2 flex items-start gap-2 rounded border border-[#e7c96b] bg-[#fff8e6] px-3 py-2 text-[12.5px] text-ink">
// //                 <input type="checkbox" checked={compared} onChange={(e) => setCompared(e.target.checked)} className="mt-0.5" aria-label="I compared the barcodes with the image" />
// //                 <span>
// //                   I have compared every barcode and quantity above with the image{read?.origin === 'ocr' ? ' it was read from' : ''}. OCR
// //                   can read a character wrongly and still be sure of it, so rows read from an image are only imported once you
// //                   confirm this - correct anything under View Extracted Text first.
// //                 </span>
// //               </label>
// //             )}
// //             <MastersNote review={review} read={read} />
// //             <div className="mb-3 flex flex-wrap items-center gap-2 text-[12.5px]">
// //               {ORDER.filter((s) => review.counts[s]).map((s) => (
// //                 <span key={s} className={'rounded px-2 py-0.5 font-semibold ' + STATUS[s].tone}>
// //                   {STATUS[s].label}: {review.counts[s]}
// //                 </span>
// //               ))}
// //               {changedRows.some((r) => r.replaces) && (
// //                 <>
// //                   <button type="button" className="btn" onClick={() => changedRows.forEach(replaceRow)} disabled={busy}>Replace all</button>
// //                   <button type="button" className="btn" onClick={() => changedRows.forEach(keepRow)} disabled={busy}>Keep all existing</button>
// //                 </>
// //               )}
// //             </div>
// //             {needsDecision.length > 0 && (
// //               <div className="mb-3 rounded border border-[#e7c96b] bg-[#fff8e6] px-3 py-2 text-[12.5px] text-ink" role="status">
// //                 <span className="font-semibold">EXISTING BARCODE FOUND</span> - {needsDecision.map((r) => r.barcode).join(', ')}{' '}
// //                 {needsDecision.length > 1 ? 'already exist' : 'already exists'} in this ERP with different saved data. Do you want to replace
// //                 the existing data with the imported data? Choose KEEP EXISTING or REPLACE on {needsDecision.length > 1 ? 'each' : 'it'} below
// //                 (left undecided, the existing data is kept).
// //               </div>
// //             )}

// //             {/* every value is text the operator pasted - rendered as text */}
// //             <table className="w-full border-collapse text-[12.5px]">
// //               <thead>
// //                 <tr className="bg-[#f7f9fc] text-left">
// //                   <th className="w-8 border border-line px-2 py-2" aria-label="Take" />
// //                   <th className="border border-line px-2 py-2">Status</th>
// //                   <th className="border border-line px-2 py-2">Barcode</th>
// //                   <th className="border border-line px-2 py-2">Item Code</th>
// //                   <th className="border border-line px-2 py-2">Description</th>
// //                   <th className="border border-line px-2 py-2 text-right">Qty</th>
// //                   <th className="border border-line px-2 py-2">UOM</th>
// //                   <th className="border border-line px-2 py-2 text-right">Retail Price</th>
// //                   <th className="border border-line px-2 py-2">Changes / reason</th>
// //                 </tr>
// //               </thead>
// //               <tbody>
// //                 {[...importRows].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || a.line - b.line).map((r) => {
// //                   const said = r.sources?.barcode && r.sources.barcode !== 'import_column' ? SOURCE_WORDS[r.sources.barcode] : '';
// //                   const isOpen = open2.has(r.key);
// //                   const hasDetail = r.status !== 'invalid' || r.details;
// //                   const willReplace = replacesOf(r).length > 0;
// //                   const sub = r.status !== 'changed' ? ''
// //                     : willReplace ? 'WILL REPLACE'
// //                       : decided.get(r.key) === 'keep' ? 'KEEP EXISTING'
// //                         : r.replaces ? 'REPLACE REQUIRED' : '';
// //                   return [
// //                     <tr key={r.line + ':' + r.key} data-status={r.status} className={r.status === 'changed' ? 'bg-[#fffbf0]' : ''}>
// //                       <td className="border border-line px-2 py-1.5 text-center">
// //                         {r.status === 'new' ? (
// //                           <input type="checkbox" checked={ticked.has(r.key)} onChange={() => toggleNew(r.key)} aria-label={'Import ' + r.barcode} />
// //                         ) : null}
// //                       </td>
// //                       <td className="border border-line px-2 py-1.5">
// //                         <span className={'whitespace-nowrap rounded px-1.5 py-0.5 text-[11.5px] font-semibold ' + STATUS[r.status].tone}>{STATUS[r.status].label}</span>
// //                         {sub ? <div className={'mt-1 text-[11px] font-semibold ' + (sub === 'REPLACE REQUIRED' ? 'text-danger' : 'text-inkmuted')}>{sub}</div> : null}
// //                       </td>
// //                       <td className="border border-line px-2 py-1.5 font-mono">
// //                         {r.barcode || '—'}
// //                         {said ? <div className="font-sans text-[11px] text-inkmuted">{said}</div> : null}
// //                       </td>
// //                       <td className="border border-line px-2 py-1.5">
// //                         {r.values.itemCode || '—'}
// //                         {r.status === 'new' && !r.itemInMaster ? <div className="text-[11px] text-inkmuted">not in Item master</div> : null}
// //                       </td>
// //                       <td className="border border-line px-2 py-1.5">{r.values.description || '—'}</td>
// //                       <td className="border border-line px-2 py-1.5 text-right">{r.values.qty || '—'}</td>
// //                       <td className="border border-line px-2 py-1.5">{r.values.uom || '—'}</td>
// //                       <td className="border border-line px-2 py-1.5 text-right">{r.values.retailPrice || '—'}</td>
// //                       <td className="border border-line px-2 py-1.5">
// //                         {r.reason ? <div className={r.status === 'invalid' ? 'text-danger' : 'text-inkmuted'}>{r.reason}</div> : null}
// //                         {r.seriesNote ? <div className="text-inkmuted">{r.seriesNote}</div> : null}
// //                         {r.status === 'changed' ? (
// //                           <div>
// //                             {plural((r.diffs || []).length, 'difference')}
// //                             {r.replaces ? ` - ${r.replaces} would replace a saved value` : ''}
// //                             {r.identity?.state === 'different' ? <span className="font-semibold text-danger"> - different goods</span> : null}
// //                           </div>
// //                         ) : null}
// //                         {r.status === 'changed' && r.updatable ? (
// //                           <div className="mt-1 flex flex-wrap gap-1">
// //                             <button type="button" className="btn h-7 px-2 text-[12px]" onClick={() => keepRow(r)} disabled={busy} aria-label={'Keep existing ' + r.barcode}>Keep existing</button>
// //                             <button type="button" className="btn h-7 px-2 text-[12px]" onClick={() => replaceRow(r)} disabled={busy} aria-label={'Replace ' + r.barcode}>Replace</button>
// //                           </div>
// //                         ) : null}
// //                         {hasDetail ? (
// //                           <button type="button" className="mt-1 text-[12px] text-brand-link underline" onClick={() => toggleOpen(r.key)} aria-expanded={isOpen}>
// //                             {isOpen ? 'Hide details' : r.status === 'changed' || r.status === 'same' || r.status === 'locked' ? 'Compare existing and imported data' : 'Show details'}
// //                           </button>
// //                         ) : null}
// //                       </td>
// //                     </tr>,
// //                     isOpen && hasDetail ? (
// //                       <tr key={r.line + ':' + r.key + ':detail'} data-detail-for={r.key}>
// //                         <td colSpan={9} className="border border-line bg-[#fbfcfe] px-3 py-3">
// //                           <RowDetail row={r} picked={pickedOf(r)} onToggle={(fields) => toggleField(r, fields)} busy={busy} editable={r.status === 'changed' && r.updatable} />
// //                         </td>
// //                       </tr>
// //                     ) : null,
// //                   ];
// //                 })}
// //               </tbody>
// //             </table>

// //             {read?.unmapped?.length > 0 && (
// //               <p className="mt-3 text-[12px] text-inkmuted">Ignored columns: {read.unmapped.join(', ')} - this ERP&apos;s Barcode Report has no such field.</p>
// //             )}
// //             {read?.ignored > 0 && (
// //               <p className="mt-1 text-[12px] text-inkmuted">{plural(read.ignored, 'line')} left out: totals, repeated headings, rows copied twice, or lines that are not barcodes (see Barcode detection).</p>
// //             )}
// //             {read?.columns?.length > 0 && (
// //               <p className="mt-1 text-[12px] text-inkmuted">
// //                 Read: {read.columns.filter((c) => c.field).map((c) => (c.heading === FIELD_LABELS[c.field] ? c.heading : `${c.heading} → ${FIELD_LABELS[c.field]}`)).join(', ')}.
// //               </p>
// //             )}
// //             <Detection read={read} rows={rows} open={read?.kind === 'details'} />
// //             {error && <div className="flash flash-err mt-3">{error}</div>}
// //           </div>
// //           <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-3">
// //             <button type="button" className="btn" onClick={back} disabled={busy}>
// //               <Icon name="back" size={14} /> Back
// //             </button>
// //             <button type="button" className="btn" onClick={close} disabled={busy}>Cancel</button>
// //             <button
// //               type="button"
// //               className="btn btn-primary flex h-[38px] min-w-[200px] justify-center"
// //               onClick={askImport}
// //               disabled={busy || (adding + replacing + filling === 0) || (fromImage && !compared)}
// //               title={fromImage && !compared ? 'Confirm you compared the barcodes with the image first' : undefined}
// //             >
// //               {busy ? <span className="spin" /> : <Icon name="check" size={14} />}
// //               {adding + replacing + filling === 0
// //                 ? ' Nothing to import'
// //                 : ' ' + [adding ? `Import ${adding}` : '', replacing ? `Replace ${replacing}` : '', filling ? `Fill ${filling}` : ''].filter(Boolean).join(', ')}
// //             </button>
// //           </div>
// //         </Modal>
// //       )}

// //       {open && step === 'review' && confirming && (
// //         <Modal title="Replace existing barcode data?" onClose={() => setConfirming(false)} size="md">
// //           <div className="flex-1 overflow-y-auto p-5 text-[13px]">
// //             {changedRows.filter((r) => replacesOf(r).length).map((r) => (
// //               <div key={r.key} className="mb-3">
// //                 <div className="font-semibold">Barcode: <span className="font-mono">{r.barcode}</span>{r.identity?.state === 'different' ? <span className="ml-2 text-danger">- different goods here ({r.existing?.itemCode})</span> : null}</div>
// //                 <div className="text-inkmuted">The following eligible fields will be replaced:</div>
// //                 <ul className="ml-5 list-disc">
// //                   {replacesOf(r).filter((d) => !(TWIN_OF.has(d.field) && replacesOf(r).some((m) => TWINS[m.field] === d.field))).map((d) => (
// //                     <li key={d.field}>{d.label}: <span className="line-through">{d.local || '—'}</span> → <span className="font-semibold">{d.incoming}</span></li>
// //                   ))}
// //                 </ul>
// //               </div>
// //             ))}
// //             <p className="font-semibold">Master data will NOT be changed.</p>
// //             <p className="text-inkmuted">Item, quantity and UOM stay as they are here; Item, Supplier, HSN, GST, UOM, group and price masters are never touched.</p>
// //           </div>
// //           <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-3">
// //             <button type="button" className="btn" onClick={() => setConfirming(false)} disabled={busy}>Cancel</button>
// //             <button type="button" className="btn btn-primary" onClick={runImport} disabled={busy}>
// //               {busy ? <span className="spin" /> : null} Confirm replace
// //             </button>
// //           </div>
// //         </Modal>
// //       )}

// //       {open && step === 'done' && result && (
// //         <Modal title="Import Successful" onClose={close} size="md">
// //           <div className="flex-1 overflow-y-auto p-5">
// //             <div className="flash flash-ok">
// //               {[result.inserted ? `${plural(result.inserted, 'barcode')} seeded` : '', result.replaced ? `${result.replaced} replaced` : '',
// //                 result.filled ? `${result.filled} filled` : ''].filter(Boolean).join(', ') || 'Nothing was changed'}.
// //             </div>
// //             <table className="mt-3 w-full border-collapse text-[12.5px]" aria-label="What became of each barcode">
// //               <thead>
// //                 <tr className="bg-[#f7f9fc] text-left">
// //                   <th className="border border-line px-2 py-1.5">Barcode</th>
// //                   <th className="border border-line px-2 py-1.5">Action</th>
// //                 </tr>
// //               </thead>
// //               <tbody>
// //                 {(result.actions || []).slice(0, 200).map((a) => (
// //                   <tr key={a.line + ':' + a.barcode}>
// //                     <td className="border border-line px-2 py-1.5 font-mono">{a.barcode || '—'}</td>
// //                     <td className={'border border-line px-2 py-1.5 ' + (ACTIONS[a.action]?.tone || '')}>
// //                       {ACTIONS[a.action]?.label || a.action}
// //                       {a.fields?.length ? `: ${a.fields.join(', ')}` : ''}
// //                       {a.reason ? <span className="text-inkmuted"> - {a.reason}</span> : null}
// //                     </td>
// //                   </tr>
// //                 ))}
// //               </tbody>
// //             </table>
// //             <ul className="mt-3 space-y-1 text-[12.5px] text-inkmuted">
// //               <li>Total {result.total} · seeded {result.inserted} · updated {result.updated} · skipped {result.skipped} · errors {result.failed}</li>
// //               <li>Masters matched: {result.mastersMatched}{result.unmatched?.length ? `, not found (kept as text): ${result.unmatched.map((u) => `${u.type} "${u.name}"`).join(', ')}` : ''}</li>
// //               {result.floors?.length > 0 && (
// //                 <li>Barcode Generation moves past the seeded numbers of this ERP&apos;s own series: {result.floors.map((f) => `${f.barcode}`).join(', ')}.</li>
// //               )}
// //             </ul>
// //             <p className="mt-3 text-[12.5px] text-inkmuted">The report below now shows them.</p>
// //           </div>
// //           <div className="flex shrink-0 justify-end border-t border-line px-5 py-3">
// //             <button type="button" className="btn btn-primary" onClick={close}>Done</button>
// //           </div>
// //         </Modal>
// //       )}
// //     </>
// //   );
// // }

// // /* One row opened: for a barcode already here, its EXISTING DATA beside the
// //    IMPORTED DATA, field by field - each difference with its own tick (fill /
// //    replace), a value that is the same shown as "No change", and item /
// //    quantity / UOM as never changed by an import. For a new barcode, what it
// //    will be seeded as. */
// // function RowDetail({ row, picked, onToggle, busy, editable }) {
// //   const d = row.details || {};
// //   const held = row.links?.stockAt?.[0];
// //   const totals = d.totals?.computed;
// //   const diffOf = (field) => (row.diffs || []).find((x) => x.field === field);
// //   const incoming = {
// //     ...row.values,
// //     supplier: d.supplier || '',
// //     location: held ? held.location || 'where the source holds it' : row.details ? 'kept as history (no stock left)' : '',
// //     status: held ? `in stock (${held.qty})` : row.details ? 'history - no stock left' : '',
// //   };
// //   const existing = row.existing || null;
// //   /* a difference and its twin (WSP price + base WSP) share a row and a tick */
// //   const withTwin = (x) => [x, TWINS[x.field] ? diffOf(TWINS[x.field]) : null].filter((y) => y && y.updatable).map((y) => y.field);
// //   const extra = (row.diffs || []).filter((x) => !COMPARE.some(([f, , via]) => (via || f) === x.field)
// //     && !(TWIN_OF.has(x.field) && COMPARE.some(([f]) => TWINS[f] === x.field)));
// //   const tick = (x) => (x.updatable && !editable ? <span className="text-inkmuted">{row.status === 'locked' ? 'sold / moved - cannot be changed' : '-'}</span> : x.updatable ? (
// //     <label className="flex items-center gap-1">
// //       <input type="checkbox" checked={withTwin(x).every((f) => picked.has(f))} onChange={() => onToggle(withTwin(x))} disabled={busy} aria-label={`${x.kind === 'fill' ? 'Fill' : x.kind === 'append' ? 'Add' : 'Replace'} ${x.label} of ${row.barcode}`} />
// //       <span className={x.kind === 'replace' ? 'font-semibold text-[#8a5a00]' : 'text-okgreen'}>{x.kind === 'fill' ? 'Fill (blank here)' : x.kind === 'append' ? 'Add' : 'Replace'}</span>
// //     </label>
// //   ) : <span className="text-inkmuted">{x.fromImage ? 'read from an image - not changed' : 'not changed by an import'}</span>);
// //   return (
// //     <div className="space-y-3 text-[12.5px]" aria-label={`Details of ${row.barcode}`}>
// //       {row.identity?.state === 'different' && (
// //         <div className="rounded border border-[#f1b0b0] bg-[#fdecec] px-3 py-2 text-danger" role="alert">
// //           <span className="font-semibold">Different goods:</span> {row.identity.reasons.join('; ')}. This number is used here for other goods -
// //           replacing would only take the imported prices and details onto this ERP&apos;s unit ({existing?.itemCode}); its item, quantity and UOM stay.
// //         </div>
// //       )}
// //       {row.oldOnly && <div className="text-[#8a5a00]">This number matched the unit&apos;s OLD barcode only - check it is the same piece before replacing anything.</div>}
// //       {existing ? (
// //         <table className="w-full border-collapse" aria-label={`Existing and imported data of ${row.barcode}`}>
// //           <thead>
// //             <tr className="bg-[#f7f9fc] text-left">
// //               <th className="border border-line px-2 py-1.5">Field</th>
// //               <th className="border border-line px-2 py-1.5">EXISTING DATA (this ERP)</th>
// //               <th className="border border-line px-2 py-1.5">IMPORTED DATA</th>
// //               <th className="border border-line px-2 py-1.5">Action</th>
// //             </tr>
// //           </thead>
// //           <tbody>
// //             {COMPARE.map(([field, label, via]) => {
// //               /* the value's own difference, or - when only its twin differs - the twin's */
// //               const x = diffOf(via || field) || (TWINS[field] ? diffOf(TWINS[field]) : null);
// //               const a = existing[field];
// //               const b = incoming[field];
// //               if (!txt(a) && !txt(b)) return null;
// //               return (
// //                 <tr key={field} className={x?.updatable ? 'bg-[#fffbf0]' : ''}>
// //                   <td className="border border-line px-2 py-1">{label}</td>
// //                   <td className="border border-line px-2 py-1">{txt(a) || '—'}</td>
// //                   <td className="border border-line px-2 py-1 font-semibold">{txt(b) || '—'}</td>
// //                   <td className="border border-line px-2 py-1">{x ? tick(x) : sameText(a, b) ? <span className="text-inkmuted">No change</span> : <span className="text-inkmuted">—</span>}</td>
// //                 </tr>
// //               );
// //             })}
// //             {extra.map((x) => (
// //               <tr key={x.field} className={x.updatable ? 'bg-[#fffbf0]' : ''}>
// //                 <td className="border border-line px-2 py-1">{x.label}</td>
// //                 <td className="border border-line px-2 py-1">{x.local || '—'}</td>
// //                 <td className="border border-line px-2 py-1 font-semibold">{x.incoming || '—'}</td>
// //                 <td className="border border-line px-2 py-1">{tick(x)}</td>
// //               </tr>
// //             ))}
// //           </tbody>
// //         </table>
// //       ) : (
// //         <div className="grid gap-3 sm:grid-cols-3">
// //           <div>
// //             <div className="font-semibold">ITEM DETAILS</div>
// //             <div>Item Code: {row.values.itemCode || '—'} <span className="text-inkmuted">({SOURCE_WORDS[row.sources?.itemCode] || 'as given'})</span></div>
// //             <div>UOM: {row.values.uom || '—'} <span className="text-inkmuted">({SOURCE_WORDS[row.sources?.uom] || 'as given'})</span></div>
// //             <div>Quantity: {row.values.qty || '—'} <span className="text-inkmuted">({SOURCE_WORDS[row.sources?.qty] || 'as given'})</span></div>
// //             <div>Retail Price: {row.values.retailPrice || '—'} · WSP {row.values.wspPrice || '—'} · DP {row.values.dpPrice || '—'}</div>
// //             <div>Purchase Rate: {row.values.purRate || '—'} · Final Rate {row.values.finalNet || '—'} · HSN {row.values.hsn || '—'} · GST {row.values.gst ? row.values.gst + '%' : '—'}</div>
// //           </div>
// //           {row.details ? (
// //             <div>
// //               <div className="font-semibold">SUPPLIER DETAILS</div>
// //               <div>Supplier: {d.supplier || '—'}</div>
// //               <div>Tax Region: {d.taxRegion || '—'}</div>
// //               {d.designNo ? <div>Design: {d.designNo}</div> : null}
// //               {d.pma ? <div>P-M-F: {d.pma}</div> : null}
// //             </div>
// //           ) : null}
// //           {row.details ? (
// //             <div>
// //               <div className="font-semibold">STOCK SUMMARY</div>
// //               <div>Location: {held?.location || (d.stock?.[0]?.location) || (d.movements?.at(-1)?.location) || '—'}{d.movements?.at(-1)?.stockPoint ? ` · ${d.movements.at(-1).stockPoint}` : ''}</div>
// //               <div>Receipts: {totals?.receipts ?? '—'} · Issues: {totals?.issues ?? '—'} · Current balance: {totals?.balance ?? '—'}</div>
// //               <div>{plural((d.movements || []).length, 'movement row')} · {held ? `in stock: ${held.qty}` : 'no stock left - kept as history'}</div>
// //             </div>
// //           ) : null}
// //         </div>
// //       )}
// //       {existing && row.details ? (
// //         <div className="text-inkmuted">
// //           Imported stock: {plural((d.movements || []).length, 'movement row')} · receipts {totals?.receipts ?? '—'} · issues {totals?.issues ?? '—'} · balance {totals?.balance ?? '—'} - the unit here stays where this ERP&apos;s stock says it is.
// //         </div>
// //       ) : null}
// //     </div>
// //   );
// // }

// // /* No barcode on the image: said once, plainly - no row is made of what it
// //    shows, and what to do instead. */
// // function NoBarcode({ detection, origin }) {
// //   const text = origin === 'ocr';
// //   return (
// //     <div className="mt-3 rounded border border-[#f1b0b0] bg-[#fdecec] px-4 py-3" role="alert" aria-label="No valid barcode detected">
// //       <div className="text-[14px] font-bold uppercase tracking-wide text-danger">{OCR_MESSAGES.noBarcodeTitle}</div>
// //       {detection?.details && (
// //         <p className="mt-1 text-[13px] text-ink">{text ? 'The text read from the image contains item details, but no valid barcode was detected.' : OCR_MESSAGES.noBarcodeDetails}</p>
// //       )}
// //       <p className="mt-1 text-[13px] text-ink">{text ? 'No valid barcode detected in the text read from the image.' : OCR_MESSAGES.noBarcode}</p>
// //       <p className="mt-1 text-[12.5px] text-inkmuted">
// //         Nothing was imported, and no row was made from the image. Go Back to upload another image (it replaces this one), or type
// //         the barcode in the Barcode box to look it up. To import this item, copy its Details page (or its row of the Barcode
// //         Report) on erp.orbiteerp.com (the button above) and paste the text here.
// //       </p>
// //     </div>
// //   );
// // }

// // /* The barcodes an image showed, as this ERP holds them - every value is
// //    this ERP's own (looked up), none is the image's. */
// // function LookupTable({ rows }) {
// //   return (
// //     <table className="mt-3 w-full border-collapse text-[12.5px]" aria-label="Barcodes looked up">
// //       <thead>
// //         <tr className="bg-[#f7f9fc] text-left">
// //           <th className="border border-line px-2 py-2">Status</th>
// //           <th className="border border-line px-2 py-2">Barcode</th>
// //           <th className="border border-line px-2 py-2">Item Code <span className="font-normal text-inkmuted">(this ERP)</span></th>
// //           <th className="border border-line px-2 py-2">Description</th>
// //           <th className="border border-line px-2 py-2 text-right">Qty</th>
// //           <th className="border border-line px-2 py-2">UOM</th>
// //           <th className="border border-line px-2 py-2 text-right">Retail Price</th>
// //           <th className="border border-line px-2 py-2">In this ERP</th>
// //         </tr>
// //       </thead>
// //       <tbody>
// //         {rows.map((r) => {
// //           const look = LOOKUP[r.lookup?.outcome] || LOOKUP.missing;
// //           return (
// //             <tr key={r.line + ':' + r.key} data-status={r.status} data-outcome={r.lookup?.outcome}>
// //               <td className="border border-line px-2 py-1.5">
// //                 <span className={'whitespace-nowrap rounded px-1.5 py-0.5 text-[11.5px] font-semibold ' + look.tone}>{look.label}</span>
// //                 {r.lookup?.outcome === 'unconfirmed' ? <div className="text-[11px] text-inkmuted">not confirmed</div> : null}
// //               </td>
// //               <td className="border border-line px-2 py-1.5 font-mono">
// //                 {r.barcode}{(r.also || []).map((b) => <div key={b}>{b}</div>)}
// //                 <div className="font-sans text-[11px] text-inkmuted">
// //                   {r.candidate?.source === 'typed' ? 'typed by you' : `read from the image (${SOURCE_WORDS[r.candidate?.source] || 'printed on its own'})`}
// //                   {r.candidate?.confidence !== null && r.candidate?.confidence !== undefined ? ` · OCR ${r.candidate.confidence}% sure` : ''}
// //                 </div>
// //               </td>
// //               <td className="border border-line px-2 py-1.5">{r.values.itemCode || '—'}</td>
// //               <td className="border border-line px-2 py-1.5">{r.values.description || '—'}</td>
// //               <td className="border border-line px-2 py-1.5 text-right">{r.values.qty || '—'}</td>
// //               <td className="border border-line px-2 py-1.5">{r.values.uom || '—'}</td>
// //               <td className="border border-line px-2 py-1.5 text-right">{r.values.retailPrice || '—'}</td>
// //               <td className="border border-line px-2 py-1.5">
// //                 <div className={['different', 'missing'].includes(r.lookup?.outcome) ? 'text-danger' : 'text-inkmuted'}>{r.reason}</div>
// //                 {r.note ? <div className="text-[#8a5a00]">{r.note}</div> : null}
// //               </td>
// //             </tr>
// //           );
// //         })}
// //       </tbody>
// //     </table>
// //   );
// // }

// // /* BARCODE DETECTION - what was read and what became of it, for every kind
// //    of input: the values offered as a barcode (and from where), the ones
// //    that are not barcodes and why, the barcode taken, its lookup, and where
// //    each value of the final row came from. Shown, never logged. */
// // function Detection({ read, rows, open = false }) {
// //   const d = read?.detection;
// //   if (!d) return null;
// //   const refused = [...(d.rejected || []), ...rows.filter((r) => r.status === 'rejected').map((r) => ({ value: r.barcode, reason: r.reason, line: r.candidate?.line }))];
// //   const taken = rows.filter((r) => r.status !== 'rejected');
// //   const src = (s) => (s ? SOURCE_WORDS[s] || s : '—');
// //   return (
// //     <details className="mt-3 rounded border border-line bg-[#f7f9fc] px-3 py-2 text-[12.5px]" aria-label="Barcode detection" open={open || undefined}>
// //       <summary className="cursor-pointer font-semibold text-ink">
// //         Barcode detection - {plural((d.candidates || []).length, 'candidate')}, {refused.length} not taken as a barcode
// //         {taken.length === 1 && taken[0].barcode ? ` - selected: ${taken[0].barcode} (${src(taken[0].sources?.barcode)})` : ''}
// //       </summary>
// //       <div className="mt-2 space-y-2">
// //         <div>
// //           <div className="font-semibold">Candidates</div>
// //           {(d.candidates || []).length ? (
// //             <ul className="ml-4 list-disc">
// //               {d.candidates.slice(0, 40).map((c, i) => (
// //                 <li key={c.value + i}>
// //                   <span className="font-mono">{c.value}</span> - {SOURCE_WORDS[c.source] || c.source}
// //                   {c.image && d.images > 1 ? `, ${c.image}` : ''}{c.line ? `, line ${c.line}` : ''}
// //                   {c.confidence !== null && c.confidence !== undefined ? `, OCR ${Math.round(c.confidence)}% sure` : ''}
// //                 </li>
// //               ))}
// //             </ul>
// //           ) : <div className="text-inkmuted">none</div>}
// //         </div>
// //         <div>
// //           <div className="font-semibold">Not taken as a barcode</div>
// //           {refused.length ? (
// //             <ul className="ml-4 list-disc">
// //               {refused.slice(0, 60).map((x, i) => (
// //                 <li key={String(x.value) + i}><span className="font-mono">{x.value}</span> - {x.reason}{x.image && d.images > 1 ? ` (${x.image})` : ''}{x.line ? ` (line ${x.line})` : ''}</li>
// //               ))}
// //             </ul>
// //           ) : <div className="text-inkmuted">none</div>}
// //           {(d.skipped?.filters || d.skipped?.movements) ? (
// //             <div className="text-inkmuted">
// //               Not looked at: {[d.skipped.filters && plural(d.skipped.filters, 'line') + ' of the Filters panel', d.skipped.movements && plural(d.skipped.movements, 'movement row')].filter(Boolean).join(', ')}.
// //             </div>
// //           ) : null}
// //         </div>
// //         <div>
// //           <div className="font-semibold">Selected barcode{taken.length === 1 ? '' : 's'} and lookup result</div>
// //           {taken.length ? (
// //             <ul className="ml-4 list-disc">
// //               {taken.slice(0, 40).map((r) => (
// //                 <li key={r.line + ':' + r.key}>
// //                   <span className="font-mono">{r.barcode}</span> ({src(r.sources?.barcode)}) - {r.reason || r.seriesNote || (STATUS[r.status]?.label ?? r.status)}
// //                   <div className="text-inkmuted">
// //                     Row: item {r.values?.itemCode || '—'} ({src(r.sources?.itemCode)}), qty {r.values?.qty || '—'} ({src(r.sources?.qty)}),
// //                     UOM {r.values?.uom || '—'} ({src(r.sources?.uom)}), retail price {r.values?.retailPrice || '—'} ({src(r.sources?.retailPrice)})
// //                   </div>
// //                 </li>
// //               ))}
// //             </ul>
// //           ) : <div className="text-inkmuted">none</div>}
// //         </div>
// //       </div>
// //     </details>
// //   );
// // }

// // /* The masters found and not found (never created), and what the reader or
// //    the server noticed - GST Parse's "Also returned" / "Ignored columns". */
// // function MastersNote({ review, read }) {
// //   const notes = [...(read?.warnings || []), ...(review.warnings || [])];
// //   if (!review.mastersMatched && !review.unmatched?.length && !notes.length) return null;
// //   return (
// //     <div className="mb-3 rounded border border-line bg-[#f7f9fc] px-3 py-2 text-[12.5px]">
// //       {review.mastersMatched > 0 && <div>Masters found: {review.mastersMatched}</div>}
// //       {review.unmatched?.length > 0 && (
// //         <div className="text-[#8a5a00]">
// //           Not found - kept as text on the barcode: {review.unmatched.map((u) => `${u.type} "${u.name}"`).join(', ')}
// //         </div>
// //       )}
// //       {notes.map((n) => <div key={n} className="text-inkmuted">{n}</div>)}
// //     </div>
// //   );
// // }

// // /* What OCR made of the screenshots: the steps done, how sure it was, and the
// //    text it read - to compare with the image, and to correct as text.
// //    `records` - a report table's rows; `found` - an image's barcodes looked up. */
// // function OcrPanel({ ocr, records = null, flagged = 0, totals = false, found = null, onEdit, busy = false }) {
// //   if (!ocr) return null;
// //   const poor = ocr.confidence < POOR_CONFIDENCE;
// //   return (
// //     <div className="mt-3 rounded border border-line bg-[#f7f9fc] px-3 py-2 text-[12.5px]" aria-label="Image reading">
// //       <div className="flex flex-wrap gap-x-4 gap-y-1">
// //         <span className="text-okgreen">✓ Image detected</span>
// //         <span className="text-okgreen">✓ OCR completed ({ocr.confidence}% sure)</span>
// //         {records !== null && <span className="text-okgreen">✓ Barcode report detected</span>}
// //         {records !== null && <span className="font-semibold text-ink">Records found: {records}</span>}
// //         {found !== null && (
// //           <span className={found ? 'font-semibold text-ink' : 'font-semibold text-danger'}>
// //             Barcode detection: {found ? `${plural(found, 'barcode')} found` : 'no valid barcode'}
// //           </span>
// //         )}
// //       </div>
// //       {flagged > 0 && <div className="mt-1 text-[#8a5a00]">{OCR_MESSAGES.review} {plural(flagged, 'barcode')} could not be read with confidence - see the rows below.</div>}
// //       {totals && <div className="mt-1 text-[#8a5a00]">The rows do not add up to the image&apos;s TOTAL row - a number was misread, or the screenshot shows only part of the report; see the rows below.</div>}
// //       {poor && <div className="mt-1 text-[#8a5a00]">{OCR_MESSAGES.poor}</div>}
// //       <details className="mt-1">
// //         <summary className="cursor-pointer text-brand-link">View Extracted Text</summary>
// //         <pre className="mt-1 max-h-[220px] overflow-auto whitespace-pre-wrap rounded border border-line bg-white p-2 font-mono text-[11.5px] leading-[1.45]">{ocr.text}</pre>
// //         <button type="button" className="btn mt-1" onClick={onEdit} disabled={busy}>
// //           <Icon name="pencil" size={14} /> Edit as text
// //         </button>
// //       </details>
// //     </div>
// //   );
// // }


















// 'use client';
// import { useRef, useState } from 'react';
// import * as XLSX from 'xlsx';
// import Icon from './Icon';
// import { useScope } from './ScopeContext';
// import { useOptions } from './useOptions';
// import { readImport, editRecord, EDIT_FIELDS, FIELD_LABELS, SOURCE_URL } from '@/lib/barcodeReportImport';
// import { imagePlan } from '@/lib/barcodeImage';
// import { BarcodeImageInput, BarcodeImageThumb, uploadBarcodeImage } from './BarcodeImagePicker';
// import {
//   imageProblem, ocrImages, reviewOcrRecords, IMAGE_MAX_COUNT, OCR_MESSAGES, POOR_CONFIDENCE, BARCODE_MIN_CONFIDENCE,
// } from '@/lib/barcodeReportOcr';

// /* what the image picker offers - lib/barcodeReportOcr.js checks every file
//    again, pasted or dropped, before it is read */
// const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp';

// /* Reports -> Barcode Report -> IMPORT: SEED this ERP with barcodes that
//    exist in the other ERP.

//    Built the way Supplier -> Import from GST works (SupplierImportPanel.jsx):
//    the operator opens the other ERP's Barcode Report themselves (the square
//    button in the dialog's header), copies the report table or one barcode's
//    Details page - or saves its Excel export, or takes a screenshot - and
//    brings it here. Nothing is fetched from that site and no login to it is
//    stored; everything is read in this browser (lib/barcodeReportImport.js).

//    The flow (user, 2026-09-30):
//      PASTE / UPLOAD     nothing is read yet
//      ASK                "Is this a Barcode Report / Barcode Details?" - only
//                         a Yes reads it (OCR for an image), and only as one
//      PARSE              the Barcode Report reader: a report TABLE row by row,
//                         a DETAILS page section by section - "could not be
//                         parsed" (and why) when it is not one
//      STRUCTURED PREVIEW a Details page as the Barcode Details screen shows
//                         it - item, price and supplier info, the movements,
//                         the stock - every value correctable, a screenshot
//                         beside it; BARCODE IDENTIFICATION says where the
//                         barcode came from (explicit, printed, the Item Code)
//      EXISTING CHECK     the server's word on each barcode: NEW (ready to
//                         seed), or EXISTING - its saved data beside the
//                         imported data, KEEP EXISTING DATA or REPLACE WITH
//                         IMPORTED DATA (confirmed first)
//      SEED               /api/reports/barcode-report/import, which checks
//                         every row again inside its transaction
//    Nothing is written before Seed / Import or Confirm Replace. Item,
//    quantity, UOM and masters are never changed.

//    `api` is ReportView's toolbar hook - searchFor(filters) runs the report. */

// /* a report TABLE row's status */
// const STATUS = {
//   new: { label: 'READY TO IMPORT', tone: 'bg-okgreenbg text-okgreen' },
//   changed: { label: 'EXISTING - CHANGES FOUND', tone: 'bg-[#fff4d6] text-[#8a5a00]' },
//   same: { label: 'EXISTING - NO CHANGES', tone: 'bg-[#eef2f8] text-inkmuted' },
//   locked: { label: 'EXISTING - SOLD / MOVED', tone: 'bg-[#eef2f8] text-inkmuted' },
//   invalid: { label: 'ERROR', tone: 'bg-[#fdecec] text-danger' },
// };
// const ORDER = ['new', 'changed', 'same', 'locked', 'invalid'];
// /* what became of each barcode (the server's `actions`) */
// const ACTIONS = {
//   seeded: { label: 'Seeded', tone: 'text-okgreen' },
//   replaced: { label: 'Replaced existing barcode data', tone: 'text-[#8a5a00]' },
//   filled: { label: 'Blank fields filled', tone: 'text-okgreen' },
//   retained: { label: 'Existing data retained', tone: 'text-inkmuted' },
//   skipped: { label: 'Skipped', tone: 'text-inkmuted' },
//   error: { label: 'Error', tone: 'text-danger' },
// };
// /* where a value came from, in words (lib/barcodeReportImport.js) */
// const SOURCE_WORDS = {
//   column: 'Barcode column',
//   label: 'printed as the barcode',
//   standalone: 'printed on its own',
//   typed: 'typed by you',
//   import_column: 'report column',
//   details_label: 'page label',
//   details_receipt: 'first receipt of the movements',
//   details_stock: 'stock the page shows',
//   typed_barcode: 'typed by you',
//   detected_barcode: 'detected on the page',
//   item_code: 'the Item Code',
//   edited: 'corrected by you',
//   existing_barcode_lookup: 'this ERP (barcode lookup)',
//   item_master: 'Item master',
// };
// /* BARCODE IDENTIFICATION's "Detected From" */
// const DETECTED_FROM = {
//   label: 'Explicit Barcode',
//   typed: 'Typed by you',
//   standalone: 'The barcode printed on the page',
//   item_code: 'Item Code',
// };
// /* what the parser reads, shown while it does */
// const PARSE_STEPS = ['Item Information', 'Price Information', 'Supplier Information', 'Stock Movements', 'Barcode'];
// const FAIL_REASONS = ['Image is unclear', 'Required fields could not be detected', 'This is not a Barcode Report', 'Barcode/Item Code could not be identified'];
// /* the fields EXISTING DATA and IMPORTED DATA are compared on, and the
//    difference (diff field) each one is written through */
// const COMPARE = [
//   ['barcode', 'Barcode'], ['itemCode', 'Item Code'], ['description', 'Description'], ['uom', 'UOM'], ['qty', 'Quantity'],
//   ['hsn', 'HSN'], ['gst', 'GST %'], ['purRate', 'Purchase Rate'], ['finalNet', 'Final Rate'], ['retailPrice', 'Retail Price (RSP)'],
//   ['wspPrice', 'WSP'], ['dpPrice', 'DP'], ['supplier', 'Supplier', 'supplierId'], ['location', 'Location'], ['status', 'Stock'],
// ];
// /* one value on the page, two fields on the barcode: a Details page's WSP is
//    both its WSP price and its base WSP (and DP the same) - shown as one row,
//    taken or kept together */
// const TWINS = { wspPrice: 'wsp', dpPrice: 'dp' };
// const TWIN_OF = new Set(Object.values(TWINS));
// /* a Details page's sections, as the Barcode Details screen lays them out -
//    [field, label, read-only] */
// const ITEM_INFO = [
//   ['itemCode', 'Item Code'], ['itemName', 'Item Name'], ['subGroup', 'Sub Group'], ['group', 'Group'], ['hsn', 'HSN'], ['gstSlab', 'GST Slab'],
//   ['uom', 'Unit / UOM'], ['ecomId', 'ECom ID', true], ['consignment', 'Is Consignment', true], ['description', 'Supplier Description'],
//   ['pma', 'P-M-F'], ['invoiceNo', 'Purchase Invoice'], ['grcNo', 'GRC No.'],
// ];
// const PRICE_INFO = [['purRate', 'Purchase Rate'], ['discount', 'Discount'], ['finalNet', 'Final Rate'], ['retailPrice', 'RSP'], ['wspPrice', 'WSP'], ['dpPrice', 'DP']];
// const SUPPLIER_INFO = [['supplier', 'Supplier'], ['taxRegion', 'Tax Region'], ['note', 'Note', true]];
// /* a field's master, for "not found - kept as text" (masters are never created) */
// const MASTER_OF = { itemName: 'Item', group: 'Group', subGroup: 'Sub Group', hsn: 'HSN', gstSlab: 'GST Slab', supplier: 'Supplier', stockLocation: 'Location', stockPoint: 'Stock Point' };
// const DETAIL_FIELDS = new Set([...EDIT_FIELDS.filter((f) => f.details).map((f) => f.key), 'ecomId', 'consignment', 'note', 'pageItemCode']);

// const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
// const txt = (v) => String(v ?? '').trim();
// const sameText = (a, b) => txt(a) === txt(b) || (txt(a) !== '' && txt(b) !== '' && Number.isFinite(Number(a)) && Number.isFinite(Number(b)) && Number(a) === Number(b));
// const money = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? '—' : Number(v).toFixed(2));
// const when = (v) => {
//   const d = v ? new Date(v) : null;
//   return d && !Number.isNaN(d.getTime())
//     ? d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
//     : '—';
// };

// /* the stock summary a Details record shows: its own summary's first row,
//    else where its last movement left its balance */
// function summaryOf(details) {
//   const s = (details?.stock || [])[0];
//   if (s) return { location: txt(s.location), stockPoint: txt(s.stockPoint), qty: s.qty };
//   const last = (details?.movements || []).at(-1);
//   return { location: txt(last?.location), stockPoint: txt(last?.stockPoint), qty: details?.totals?.computed?.balance ?? 0 };
// }
// /* one field of a record, as the preview shows it */
// function fieldOf(record, key) {
//   const d = record?.details || {};
//   if (key === 'stockLocation') return summaryOf(d).location;
//   if (key === 'stockPoint') return summaryOf(d).stockPoint;
//   if (DETAIL_FIELDS.has(key)) return txt(d[key]);
//   return txt(record?.values?.[key]);
// }

// function Modal({ title, onClose, children, size = 'md', headerAction }) {
//   const width = size === 'xl' ? 'max-w-[1280px]' : size === 'lg' ? 'max-w-[1120px]' : size === 'sm' ? 'max-w-[460px]' : 'max-w-[760px]';
//   return (
//     <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
//       <div className={'flex max-h-[calc(100vh-2rem)] w-full flex-col rounded-lg bg-white shadow-xl ' + width}>
//         <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-3">
//           <span className="text-[15px] font-bold uppercase tracking-wide">{title}</span>
//           <div className="flex items-center gap-1">
//             {headerAction}
//             <button type="button" onClick={onClose} className="text-2xl leading-none text-inkmuted" aria-label="Close">×</button>
//           </div>
//         </div>
//         {children}
//       </div>
//     </div>
//   );
// }

// /* the first sheet of a workbook as rows of cells - an .xlsx, an .xls (the
//    report's own export is an HTML table saved as .xls, which SheetJS reads)
//    or a .csv. raw:false keeps a barcode such as 000123 as the text shown. */
// function readWorkbook(file) {
//   return new Promise((resolve, reject) => {
//     const reader = new FileReader();
//     reader.onload = () => {
//       try {
//         const wb = XLSX.read(reader.result, { type: 'array' });
//         const sheet = wb.Sheets[wb.SheetNames[0]];
//         if (!sheet) throw new Error('That workbook has no sheets.');
//         resolve(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }));
//       } catch (e) {
//         reject(new Error(e?.message ? 'Could not read that file: ' + e.message : 'Could not read that file.'));
//       }
//     };
//     reader.onerror = () => reject(new Error('Could not read that file.'));
//     reader.readAsArrayBuffer(file);
//   });
// }

// /* a sheet's cell as a pasted cell: a line break inside it (Alt+Enter, or a
//    <br> in the report's HTML export) is a space, and a cell that starts with
//    a quote is quoted - so one row of the sheet stays one row */
// const sheetCell = (value) => {
//   const v = String(value ?? '').replace(/[\r\n\t]+/g, ' ');
//   return v.startsWith('"') ? '"' + v.replace(/"/g, '""') + '"' : v;
// };

// /* what is sent for each record - never more than the server reads */
// const recordsOf = (list) => (list || []).map(({ line, values, details, review, origin, sources, candidate }) => ({
//   line, values, details, review, origin, sources, candidate,
// }));

// /* which differences of a CHANGED row are ticked when the preview opens:
//    blanks it fills and history it adds (GST Parse's rule) - none when the
//    pasted page looks like different goods, or when the number matched only
//    the unit's old barcode (the operator decides those) */
// const defaultPicks = (row) => {
//   if (row.status !== 'changed' || row.identity?.state === 'different' || row.oldOnly) return new Set();
//   return new Set((row.diffs || []).filter((d) => d.updatable && (d.kind === 'fill' || d.kind === 'append')).map((d) => d.field));
// };

// export default function BarcodeReportImport({ api }) {
//   const { business, location: scopeLocation, finYear } = useScope();
//   const { options: locations } = useOptions('companylocations');
//   const [open, setOpen] = useState(false);
//   /* 'input' | 'ask' (text or a file: what is it?) | 'parsing' | 'failed' | 'review' | 'done' */
//   const [step, setStep] = useState('input');
//   const [mode, setMode] = useState('paste');      // 'paste' | 'image'
//   const [asking, setAsking] = useState('');       // what 'ask' is about: 'text' | 'file'
//   const [paste, setPaste] = useState('');
//   /* where the text in the box came from: 'text' (pasted / typed) or 'ocr' -
//      an image's text put there by Edit as text, which keeps the image's rules */
//   const [textOrigin, setTextOrigin] = useState('text');
//   const [file, setFile] = useState(null);         // an Excel file waiting for its answer
//   const [fileName, setFileName] = useState('');
//   const [location, setLocation] = useState('');
//   const [busy, setBusy] = useState(false);
//   const [error, setError] = useState('');
//   const [failure, setFailure] = useState(null);   // { message, notReport, image, poor }
//   const [read, setRead] = useState(null);         // what the browser read
//   const [review, setReview] = useState(null);     // what the server says each row becomes
//   const [ticked, setTicked] = useState(new Set());               // NEW rows to seed
//   const [picks, setPicks] = useState(new Map());                 // CHANGED rows: key -> Set of fields to write
//   const [decided, setDecided] = useState(new Map());             // key -> 'keep' | 'replace' | 'custom'
//   const [open2, setOpen2] = useState(new Set());                 // table rows whose detail is open
//   const [confirming, setConfirming] = useState(false);           // "Replace existing data?"
//   /* corrections typed in the preview: line -> { field: value } - checked
//      against this ERP again before anything is imported */
//   const [edits, setEdits] = useState(new Map());
//   /* an image import: the operator's word that they compared the values with
//      the image - OCR can be sure of a wrong character */
//   const [compared, setCompared] = useState(false);
//   const [result, setResult] = useState(null);
//   /* BARCODE IMAGES attached in the preview - the picture of a barcode, to be
//      STORED on it (never read by OCR - that is `images` below). By record line,
//      so a card keeps its picture through corrections and re-checks; saved on
//      Import against that card's barcode (lib/barcodeImage.js). line -> { file,
//      url (a local preview), name, size, decision: 'keep' | 'replace' | '',
//      uploaded: { url, name } once uploaded } */
//   const [barcodeImages, setBarcodeImages] = useState(new Map());
//   /* screenshots pasted, dropped or chosen: [{ id, file, url, name, size }] */
//   const [images, setImages] = useState([]);
//   const [ocr, setOcr] = useState(null);           // what OCR read from them
//   const [stage, setStage] = useState('');         // "Reading image..." while busy
//   const [dragging, setDragging] = useState(false);
//   const fileRef = useRef(null);
//   const imageRef = useRef(null);

//   const target = location || scopeLocation || '';

//   function dropImages(list = images) {
//     list.forEach((img) => URL.revokeObjectURL(img.url));
//     setImages([]);
//     setOcr(null);
//   }

//   /* the barcode images - attached, changed, removed, decided - none of it
//      touches the database until Import */
//   const clearBarcodeImages = () => setBarcodeImages((map) => {
//     map.forEach((img) => URL.revokeObjectURL(img.url));
//     return new Map();
//   });
//   const attachBarcodeImage = (line, file) => setBarcodeImages((map) => {
//     const next = new Map(map);
//     if (next.get(line)?.url) URL.revokeObjectURL(next.get(line).url);
//     next.set(line, { file, url: URL.createObjectURL(file), name: file.name || 'barcode-image', size: file.size, decision: '', uploaded: null });
//     return next;
//   });
//   const removeBarcodeImage = (line) => setBarcodeImages((map) => {
//     const next = new Map(map);
//     if (next.get(line)?.url) URL.revokeObjectURL(next.get(line).url);
//     next.delete(line);
//     return next;
//   });
//   const decideBarcodeImage = (line, decision) => setBarcodeImages((map) => (
//     map.has(line) ? new Map(map).set(line, { ...map.get(line), decision }) : map
//   ));

//   function start() {
//     setOpen(true); setStep('input'); setMode('paste'); setAsking(''); setPaste(''); setTextOrigin('text');
//     setFile(null); setFileName(''); setError(''); setFailure(null);
//     setRead(null); setReview(null); setResult(null); setTicked(new Set()); setPicks(new Map()); setDecided(new Map());
//     setOpen2(new Set()); setConfirming(false); setEdits(new Map()); setCompared(false);
//     setLocation(scopeLocation || '');
//     dropImages(); setStage(''); clearBarcodeImages();
//   }

//   /* images in: each checked (type, extension, size) before it is kept - and
//      NOT read: the ask comes first */
//   function addImages(files) {
//     if (busy) return;
//     const list = [...(files || [])];
//     if (!list.length) return;
//     const bad = list.map(imageProblem).find(Boolean);
//     if (bad) { setMode('image'); setError(bad); return; }
//     if (images.length + list.length > IMAGE_MAX_COUNT) { setMode('image'); setError(`At most ${IMAGE_MAX_COUNT} images can be read at a time.`); return; }
//     const added = list.map((f, i) => ({
//       id: `${Date.now()}-${i}`, file: f, url: URL.createObjectURL(f), name: f.name || `Pasted image ${images.length + i + 1}`, size: f.size,
//     }));
//     setImages([...images, ...added]);
//     setOcr(null);
//     setMode('image');
//     setError('');
//   }

//   function removeImage(id) {
//     if (busy) return;
//     const gone = images.find((img) => img.id === id);
//     if (gone) URL.revokeObjectURL(gone.url);
//     setImages((current) => current.filter((img) => img.id !== id));
//     setOcr(null);
//     setError('');
//   }

//   /* Ctrl+V: a screenshot on the clipboard becomes an image here; text is
//      pasted into the box as it always was - and a clipboard holding both
//      (cells copied from Excel carry a picture of themselves) pastes its
//      TEXT into the box */
//   function onPaste(event) {
//     const files = [...(event.clipboardData?.files || [])].filter((f) => /^image\//.test(f.type));
//     const text = event.clipboardData?.getData('text') || '';
//     if (files.length) {
//       if (text.trim() && event.target?.tagName === 'TEXTAREA') return;
//       event.preventDefault();
//       addImages(files);
//       return;
//     }
//     /* text pasted while on Upload Image: it is a paste */
//     if (mode === 'image' && text.trim() && event.target?.tagName !== 'TEXTAREA') {
//       event.preventDefault();
//       setMode('paste');
//       setPaste((current) => (current.trim() ? current : text));
//       setTextOrigin('text');
//       setError('');
//     }
//   }

//   function onDrop(event) {
//     event.preventDefault();
//     setDragging(false);
//     if (busy) return;
//     const files = [...(event.dataTransfer?.files || [])];
//     if (!files.length) return;
//     if (files.some((f) => !/^image\//.test(f.type))) {
//       setError('Only PNG, JPG or WEBP images can be dropped here - use Choose Excel file for a workbook.');
//       return;
//     }
//     addImages(files);
//   }

//   function pickImages(event) {
//     const files = [...(event.target.files || [])];
//     event.target.value = '';
//     addImages(files);
//   }

//   /* an Excel file: asked about first, read only on Yes */
//   function pickFile(event) {
//     const f = event.target.files?.[0];
//     event.target.value = '';
//     if (!f) return;
//     if (!target) { setError('Choose the Business Location the barcodes go into.'); return; }
//     setFile(f);
//     setAsking('file');
//     setError('');
//     setStep('ask');
//   }

//   /* the extracted text into the text box, to correct and parse as text -
//      still under an image's rules (textOrigin 'ocr'), with the image kept
//      beside the preview to compare with */
//   function editExtracted() {
//     if (busy) return;
//     const text = ocr?.text ?? read?.ocr?.text;
//     if (text === undefined) return;
//     setPaste(text);
//     setTextOrigin('ocr');
//     setMode('paste');
//     setStep('input');
//     setFailure(null);
//     setError('');
//   }
//   const close = () => { if (!busy) setOpen(false); };
//   const locationName = () => locations.find((o) => String(o.value) === String(target))?.label || '';

//   async function post(payload) {
//     const r = await fetch('/api/reports/barcode-report/import', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ business, location: target, finYear, ...payload }),
//     });
//     const d = await r.json().catch(() => ({}));
//     if (!r.ok) throw new Error(d.error || 'The server could not do that.');
//     return d;
//   }

//   /* PASTE -> "Continue": the ask, nothing read yet */
//   function continueText() {
//     if (!paste.trim()) { setError(OCR_MESSAGES.noText + ' Paste the Barcode Report data first.'); return; }
//     if (!target) { setError('Choose the Business Location the barcodes go into.'); return; }
//     setAsking('text');
//     setError('');
//     setStep('ask');
//   }

//   /* the answer - "Yes, Parse Barcode Report" - and only then the parser */
//   function parseConfirmed(kind) {
//     if (!target) { setError('Choose the Business Location the barcodes go into.'); return; }
//     setError('');
//     if (kind === 'image') parseImages();
//     else if (kind === 'file') parseFile();
//     else parseText();
//   }

//   /* BARCODE REPORT COULD NOT BE PARSED - and nothing saved */
//   function fail(message, extra = {}) {
//     setFailure({ message, ...extra });
//     setBusy(false);
//     setStage('');
//     setStep('failed');
//   }

//   /* the choices a fresh preview opens with */
//   function openReview(table, d) {
//     setRead(table);
//     setReview(d);
//     setTicked(new Set(d.rows.filter((r) => r.status === 'new').map((r) => r.key)));
//     setPicks(new Map(d.rows.filter((r) => r.status === 'changed').map((r) => [r.key, defaultPicks(r)])));
//     setDecided(new Map());
//     setEdits(new Map());
//     const rows = d.rows.filter((r) => r.status in STATUS);
//     setOpen2(new Set(rows.length <= 3 ? rows.map((r) => r.key) : []));
//     setConfirming(false);
//     setStep('review');
//   }

//   /* what was read -> the server's verdict on every row (reads only) */
//   async function check(table, { keepCompared = false } = {}) {
//     if (!table.records.length) {
//       const why = (table.left || []).slice(0, 3).map((l) => `line ${l.line}: ${l.reason}`).join('; ');
//       fail('No barcode rows were found under the report\'s headings.' + (why ? ` Left out - ${why}.` : ''), { image: table.origin === 'image' });
//       return;
//     }
//     setBusy(true); setStage('Checking this ERP for the barcode...'); setError('');
//     try {
//       const d = await post({ mode: 'check', records: recordsOf(table.records) });
//       openReview(table, d);
//       if (!keepCompared) setCompared(false);
//     } catch (e) {
//       /* the server said no (the location, a permission): back where it can be put right */
//       setError(e.message);
//       setStep(step === 'review' ? 'review' : 'input');
//     } finally {
//       setBusy(false);
//       setStage('');
//     }
//   }

//   function parseText() {
//     setStep('parsing'); setBusy(true); setStage('Parsing Barcode Report...'); setFileName(''); clearBarcodeImages();
//     /* text an image gave keeps the image's rules, however it got here */
//     const origin = textOrigin === 'ocr' || (ocr?.text && paste.trim() === ocr.text.trim()) ? 'ocr' : 'text';
//     const table = readImport(paste, { origin });
//     if (table.error) { fail(table.error, { notReport: table.notReport }); return; }
//     const records = origin === 'ocr' ? reviewOcrRecords(table.records, { text: paste, lines: [] }) : table.records;
//     check({ ...table, records, ocr: origin === 'ocr' ? ocr : null });
//   }

//   async function parseFile() {
//     if (!file) return;
//     setStep('parsing'); setBusy(true); setStage('Reading the file...'); clearBarcodeImages();
//     try {
//       const matrix = await readWorkbook(file);
//       setFileName(file.name);
//       setStage('Parsing Barcode Report...');
//       /* the sheet's rows as the lines a paste would give - one reader for
//          both, so a report table and an exported Details page both work */
//       const table = readImport(matrix.map((row) => row.map(sheetCell).join('\t')).join('\n'));
//       if (table.error) { fail(table.error, { notReport: table.notReport }); return; }
//       await check(table);
//     } catch (e) {
//       fail(e.message);
//     }
//   }

//   /* IMAGE -> OCR -> TEXT, each image on its own, and from there the very
//      reader a paste goes through. OCR runs only here - after the Yes. */
//   async function parseImages() {
//     if (!images.length) return;
//     setStep('parsing'); setBusy(true); setError(''); setFileName(''); setStage('Reading image...'); clearBarcodeImages();
//     let ocrRead;
//     try {
//       ocrRead = await ocrImages(images.map((img) => img.file), { onStage: setStage });
//     } catch (e) {
//       console.error('Barcode Report image OCR failed', e);
//       setOcr(null);
//       fail(OCR_MESSAGES.failed, { image: true });
//       return;
//     }
//     setOcr(ocrRead);
//     const poor = ocrRead.confidence < POOR_CONFIDENCE;
//     if (!ocrRead.words || !ocrRead.text.trim()) { fail(OCR_MESSAGES.noReadable, { image: true, poor, ocr: ocrRead }); return; }
//     setStage('Extracting Barcode Report...');
//     const pages = (ocrRead.pages || [{ name: 'image', text: ocrRead.text, lines: ocrRead.lines }]).map((page) => ({
//       page, read: readImport(page.text, { origin: 'image', lines: page.lines, minConfidence: BARCODE_MIN_CONFIDENCE }),
//     })).filter((p) => p.page.text.trim());
//     const named = (p, message) => (pages.length > 1 ? `${p.page.name}: ` : '') + message;
//     const notOne = pages.find((p) => p.read.notReport);
//     if (notOne) { fail(named(notOne, OCR_MESSAGES.notReport), { image: true, notReport: true, poor, ocr: ocrRead }); return; }
//     const broken = pages.find((p) => p.read.error);
//     if (broken) { fail(named(broken, broken.read.error), { image: true, poor, ocr: ocrRead }); return; }
//     if (new Set(pages.map((p) => p.read.kind)).size > 1) { fail(OCR_MESSAGES.mixed, { image: true, ocr: ocrRead }); return; }
//     /* each image's rows, checked against its own TOTAL row / totals and
//        OCR's confidence in its barcode - a flag only ever holds a row back */
//     setStage('Validating records...');
//     let line = 0;
//     const records = pages.flatMap(({ page, read: r }) => reviewOcrRecords(r.records, { text: page.text, lines: page.lines })
//       .map((rec) => ({ ...rec, line: ++line })));
//     const first = pages[0].read;
//     await check({
//       ...first, records,
//       unmapped: [...new Set(pages.flatMap((p) => p.read.unmapped || []))],
//       ignored: pages.reduce((a, p) => a + (p.read.ignored || 0), 0),
//       left: pages.flatMap((p) => p.read.left || []),
//       warnings: pages.flatMap((p) => (p.read.warnings || []).map((w) => named(p, w))),
//       ocr: ocrRead,
//     });
//   }

//   /* the corrections checked against this ERP again */
//   function recheck() {
//     if (!read) return;
//     const records = read.records.map((r) => editRecord(r, edits.get(r.line)));
//     check({ ...read, records }, { keepCompared: true });
//   }
//   const setEdit = (line, key, value, original, force = false) => setEdits((map) => {
//     const next = new Map(map);
//     const row = { ...(next.get(line) || {}) };
//     if (!force && txt(value) === txt(original)) delete row[key]; else row[key] = value;
//     if (Object.keys(row).length) next.set(line, row); else next.delete(line);
//     return next;
//   });
//   const dirty = [...edits.values()].some((e) => Object.keys(e).length);
//   const editCount = [...edits.values()].reduce((a, e) => a + Object.keys(e).length, 0);

//   const rows = review?.rows || [];
//   const fromImage = read?.origin === 'image' || read?.origin === 'ocr';
//   const isDetails = read?.kind === 'details';
//   const importRows = rows.filter((r) => r.status in STATUS);
//   const changedRows = importRows.filter((r) => r.status === 'changed' && r.updatable);
//   const pickedOf = (r) => picks.get(r.key) || new Set();
//   const replacesOf = (r) => (r.diffs || []).filter((d) => d.updatable && d.kind === 'replace' && pickedOf(r).has(d.field));
//   const adding = importRows.filter((r) => r.status === 'new' && ticked.has(r.key)).length;
//   const replacing = changedRows.filter((r) => replacesOf(r).length).length;
//   const filling = changedRows.filter((r) => pickedOf(r).size && !replacesOf(r).length).length;
//   const needsDecision = changedRows.filter((r) => r.replaces && !decided.has(r.key) && !replacesOf(r).length);
//   /* what Import does with each row's barcode image - on its own, whatever is
//      decided for its data (lib/barcodeImage.js imagePlan): 'none' | 'save' |
//      'replace' | 'keep' | 'blocked', or 'skipped' for a new row left unticked */
//   const imagePlanOf = (r) => {
//     const image = barcodeImages.get(r.line);
//     if (!image) return 'none';
//     if (r.status === 'new' && !ticked.has(r.key)) return 'skipped';
//     return imagePlan({ status: r.status, existing: r.existing?.imageUrl, pending: true, decision: image.decision });
//   };
//   const imageSaves = importRows.filter((r) => ['save', 'replace'].includes(imagePlanOf(r)));
//   const imageReplaces = imageSaves.filter((r) => imagePlanOf(r) === 'replace');

//   const toggleNew = (key) => setTicked((set) => { const next = new Set(set); if (next.has(key)) next.delete(key); else next.add(key); return next; });
//   const setRowPicks = (r, fields, how) => {
//     setPicks((map) => new Map(map).set(r.key, new Set(fields)));
//     if (how) setDecided((map) => new Map(map).set(r.key, how));
//   };
//   /* KEEP EXISTING DATA: nothing saved is overwritten - only the blanks it
//      fills (GST Parse's rule), and not even those for different goods */
//   const keepRow = (r) => setRowPicks(r, defaultPicks(r), 'keep');
//   /* REPLACE: every difference an import may write (never item / qty / UOM) */
//   const replaceRow = (r) => setRowPicks(r, (r.diffs || []).filter((d) => d.updatable).map((d) => d.field), 'replace');
//   /* REPLACE WITH IMPORTED DATA on a Details page: taken, then confirmed */
//   const replaceAndConfirm = (r) => { replaceRow(r); setError(''); setConfirming(true); };
//   /* one tick, one or more fields (a value and its twin) - all taken or none */
//   const toggleField = (r, fields) => {
//     const list = [].concat(fields);
//     const next = new Set(pickedOf(r));
//     const all = list.every((f) => next.has(f));
//     list.forEach((f) => (all ? next.delete(f) : next.add(f)));
//     setRowPicks(r, next, 'custom');
//   };
//   const toggleOpen = (key) => setOpen2((set) => { const next = new Set(set); if (next.has(key)) next.delete(key); else next.add(key); return next; });

//   function askImport() {
//     if (dirty) { recheck(); return; }
//     if (replacing) { setConfirming(true); return; }
//     runImport();
//   }

//   async function runImport() {
//     if (dirty) return;
//     if (fromImage && !compared) { setError('Tick "I have compared the values with the image" first.'); return; }
//     setConfirming(false);
//     setBusy(true); setError('');
//     try {
//       /* THE BARCODE IMAGES FIRST - each through the app's own upload flow
//          (compressed, POST /api/upload). One that fails stops everything:
//          nothing is imported as if it had worked, and no URL is saved. A
//          picture already uploaded (a retry) is not sent again. */
//       const imagesPayload = [];
//       for (const r of imageSaves) {
//         const image = barcodeImages.get(r.line);
//         let uploaded = image.uploaded;
//         if (!uploaded) {
//           setStage(`Uploading the barcode image of ${r.barcode}...`);
//           uploaded = await uploadBarcodeImage(image.file);
//           const done = uploaded;
//           setBarcodeImages((map) => (map.has(r.line) ? new Map(map).set(r.line, { ...map.get(r.line), uploaded: done }) : map));
//         }
//         imagesPayload.push({
//           barcode: r.barcode,
//           unitId: r.unitId || '',
//           url: uploaded.url,
//           name: image.name || uploaded.name,
//           /* the image the barcode had when it was shown - the server replaces
//              it only while it still holds exactly this */
//           seen: r.existing?.imageUrl ?? '',
//           replace: imagePlanOf(r) === 'replace',
//         });
//       }
//       setStage(imagesPayload.length ? 'Importing...' : '');
//       const d = await post({
//         mode: 'import',
//         records: recordsOf(read?.records),
//         /* each difference approved, with the saved value it was approved
//            against - the server writes it only while that value is still there */
//         update: changedRows.filter((r) => pickedOf(r).size).map((r) => ({
//           barcode: r.barcode,
//           unitId: r.unitId,
//           fields: Object.fromEntries([...pickedOf(r)].map((field) => [field, (r.diffs || []).find((x) => x.field === field)?.local ?? ''])),
//         })),
//         skip: importRows.filter((r) => r.status === 'new' && !ticked.has(r.key)).map((r) => r.barcode),
//         ...(imagesPayload.length ? { images: imagesPayload } : {}),
//         ...(fromImage ? { compared } : {}),
//       });
//       setResult(d);
//       setStep('done');
//       /* show what came in: run the report again, or for the imported item */
//       const codes = d.itemCodes || [];
//       const current = String(api?.filters?.itemCode || '').trim().toLowerCase();
//       const shows = api?.searched && current && codes.some((c) => String(c).toLowerCase().includes(current));
//       api?.searchFor(shows || !codes.length ? {} : { itemCode: codes[0] });
//     } catch (e) {
//       setError(e.message);
//     } finally {
//       setBusy(false);
//       setStage('');
//     }
//   }

//   const back = () => { setStep('input'); setError(''); setConfirming(false); setFailure(null); };
//   /* TRY AGAIN: back to the input - a screenshot that could not be read is
//      let go, so another can be given; text stays, to be corrected */
//   const tryAgain = () => {
//     if (failure?.image && textOrigin !== 'ocr') { dropImages(); setMode('image'); }
//     back();
//   };

//   const sourceLink = (
//     /* the shortcut to the source report - GST Parse's portal button */
//     <a
//       href={SOURCE_URL}
//       target="_blank"
//       rel="noopener noreferrer"
//       title="Open the Barcode Report on erp.orbiteerp.com"
//       aria-label="Open the Barcode Report on erp.orbiteerp.com"
//       className="flex h-8 w-8 items-center justify-center rounded-md bg-brand leading-none text-white hover:bg-brand-hover"
//     >
//       <Icon name="search" size={16} />
//     </a>
//   );

//   const sourceText = fileName ? `Excel file (${fileName})`
//     : read?.origin === 'image' ? `Uploaded Image${images.length ? ` (${images.map((i) => i.name).join(', ')})` : ''}`
//       : read?.origin === 'ocr' ? 'Text read from an uploaded image (corrected)'
//         : 'Paste Text';
//   /* what Import will do - its data, and apart from it the barcode images */
//   const willDo = [adding ? `Seed ${adding}` : '', replacing ? `Replace ${replacing}` : '', filling ? `Fill ${filling}` : '',
//     imageSaves.length ? `Save ${plural(imageSaves.length, 'barcode image')}` : ''].filter(Boolean);
//   const nothingToImport = willDo.length === 0;
//   const primaryLabel = nothingToImport ? 'Nothing to import'
//     : isDetails && adding && !replacing && !filling ? 'Seed / Import'
//       : isDetails && !adding && !replacing && !filling ? 'Save Barcode Image'
//         : willDo.join(', ');
//   const comparedBox = fromImage && (
//     <label className="my-2 flex items-start gap-2 rounded border border-[#e7c96b] bg-[#fff8e6] px-3 py-2 text-[12.5px] text-ink">
//       <input type="checkbox" checked={compared} onChange={(e) => { setCompared(e.target.checked); setError(''); }} className="mt-0.5" aria-label="I have compared the values with the image" />
//       <span>
//         I have compared the values above with the image{read?.origin === 'ocr' ? ' they were read from' : ''} - the barcode above all. OCR can
//         read a character wrongly and still be sure of it, so nothing read from an image is imported until you confirm this. Correct
//         any value in its box first.
//       </span>
//     </label>
//   );

//   return (
//     <>
//       <button type="button" className="btn" onClick={start}>
//         <Icon name="upload" size={14} /> Import
//       </button>

//       {open && step === 'input' && (
//         <Modal title="Import Barcodes" onClose={close} headerAction={sourceLink}>
//           <div
//             className={'flex-1 overflow-y-auto p-5 ' + (dragging ? 'outline-dashed outline-2 -outline-offset-4 outline-brand' : '')}
//             onPaste={onPaste}
//             onDragOver={(e) => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); setDragging(true); } }}
//             onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
//             onDrop={onDrop}
//           >
//             <p className="mb-3 text-[13px] text-inkmuted">
//               Open the Barcode Report on erp.orbiteerp.com (the button above), then paste a barcode&apos;s Barcode Details page or the
//               report table, or upload a screenshot of it. You are asked what it is before anything is read, and nothing is saved until
//               you check the preview and press Seed / Import.
//             </p>
//             <label htmlFor="barcode-import-location" className="mb-1 block text-[13px] text-ink">Import into<span className="f-req">*</span></label>
//             <select
//               id="barcode-import-location"
//               value={target}
//               disabled={busy}
//               onChange={(e) => { setLocation(e.target.value); setError(''); }}
//               className="f-input mb-3 w-full"
//             >
//               <option value="">Choose a Business Location</option>
//               {locations.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
//             </select>

//             <div className="mb-3 text-[12px] font-bold uppercase tracking-wide text-ink">Import / Seed</div>
//             <div className="mb-3 flex gap-2" role="tablist" aria-label="What to import from">
//               <button type="button" role="tab" aria-selected={mode === 'paste'} onClick={() => { setMode('paste'); setError(''); }}
//                 className={'btn ' + (mode === 'paste' ? 'btn-primary' : '')}>
//                 <Icon name="file" size={14} /> Paste Report
//               </button>
//               <button type="button" role="tab" aria-selected={mode === 'image'} onClick={() => { setMode('image'); setError(''); }}
//                 className={'btn ' + (mode === 'image' ? 'btn-primary' : '')}>
//                 <Icon name="image" size={14} /> Upload Image
//               </button>
//             </div>

//             {mode === 'paste' ? (
//               <>
//                 <label htmlFor="barcode-import-text" className="mb-1 block text-[13px] text-ink">Paste Barcode Report Data:</label>
//                 <textarea
//                   id="barcode-import-text"
//                   value={paste}
//                   autoFocus
//                   rows={12}
//                   readOnly={busy}
//                   placeholder="Paste one barcode's Barcode Details page, or the Barcode Report table, here..."
//                   onChange={(e) => {
//                     const next = e.target.value;
//                     /* text replaced as a whole is the operator's own again */
//                     if (!next.trim() || (textOrigin === 'ocr' && paste.trim() && !next.includes(paste.trim().slice(0, 40)) && next.length > 40)) setTextOrigin('text');
//                     setPaste(next);
//                     setError('');
//                   }}
//                   className="w-full resize-y rounded-md border border-linestrong p-2.5 font-mono text-[12.5px] leading-[1.5]"
//                   aria-label="Barcode Report data"
//                 />
//                 {textOrigin === 'ocr' && paste.trim() && (
//                   <p className="mt-1 text-[12px] text-[#8a5a00]">
//                     This text was read from an image, and an image&apos;s rules stay with it: nothing from it is imported until you
//                     confirm you compared the preview with the image.
//                   </p>
//                 )}
//                 <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px] text-inkmuted">
//                   <span>or</span>
//                   <button type="button" className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>
//                     <Icon name="file" size={14} /> Choose Excel file
//                   </button>
//                   <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={pickFile} className="hidden" aria-label="Barcode Report Excel file" />
//                   <span>(the report&apos;s own export)</span>
//                 </div>
//               </>
//             ) : (
//               <>
//                 <div className="rounded border border-dashed border-linestrong bg-[#f7f9fc] p-4 text-center text-[13px] text-inkmuted" aria-label="Upload Barcode Report image">
//                   <div className="mb-2 font-semibold text-ink">UPLOAD BARCODE REPORT IMAGE</div>
//                   Drop a screenshot here, paste it (Ctrl+V), or
//                   <button type="button" className="btn ml-2" onClick={() => imageRef.current?.click()} disabled={busy}>
//                     <Icon name="image" size={14} /> Choose Image
//                   </button>
//                   <input ref={imageRef} type="file" accept={IMAGE_ACCEPT} multiple onChange={pickImages} className="hidden" aria-label="Barcode Report image" />
//                   <div className="mt-1 text-[11.5px]">PNG, JPG or WEBP, up to 10 MB each, {IMAGE_MAX_COUNT} at a time. Read in this browser - the image is never sent anywhere.</div>
//                 </div>
//                 {images.length > 0 && (
//                   <>
//                     <div className="mt-3 text-[12px] font-bold uppercase tracking-wide text-ink">Image Preview</div>
//                     <div className="mt-1 flex flex-wrap gap-2" aria-label="Image preview">
//                       {images.map((img) => (
//                         <div key={img.id} className="relative w-[240px] rounded border border-line bg-white p-1">
//                           <img src={img.url} alt={img.name} className="h-[150px] w-full rounded object-contain" />
//                           <div className="mt-1 truncate text-[11px] text-inkmuted" title={img.name}>{img.name} · {(img.size / 1024).toFixed(0)} KB</div>
//                           <button type="button" onClick={() => removeImage(img.id)} disabled={busy} aria-label={`Remove ${img.name}`}
//                             className="absolute right-1 top-1 rounded bg-white/90 px-1.5 text-[13px] leading-5 text-inkmuted shadow hover:text-danger">×</button>
//                         </div>
//                       ))}
//                     </div>
//                     {/* THE ASK - before any OCR */}
//                     <div className="mt-3 rounded border border-[#9fb7e0] bg-[#eef4ff] px-4 py-3" role="group" aria-label="What type of image is this?">
//                       <div className="text-[13px] font-bold uppercase tracking-wide text-ink">What type of image is this?</div>
//                       <p className="mt-1 text-[13px] text-ink">Is this a Barcode Report / Barcode Details screenshot?</p>
//                       <p className="mt-1 text-[12px] text-inkmuted">It is read only once you say so - an image that is not a Barcode Report is never read as one.</p>
//                       <div className="mt-2 flex flex-wrap gap-2">
//                         <button type="button" className="btn btn-primary" onClick={() => parseConfirmed('image')} disabled={busy}>
//                           <Icon name="check" size={14} /> Yes, Parse Barcode Report
//                         </button>
//                         <button type="button" className="btn" onClick={() => { dropImages(); setError(''); }} disabled={busy}>Cancel</button>
//                       </div>
//                     </div>
//                   </>
//                 )}
//               </>
//             )}
//             {error && <div className="flash flash-err mt-3">{error}</div>}
//             {ocr && mode === 'paste' && textOrigin === 'ocr' && <OcrPanel ocr={ocr} onEdit={null} busy={busy} />}
//           </div>
//           <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-3">
//             <button type="button" className="btn" onClick={close} disabled={busy}>Cancel</button>
//             {mode === 'paste' && (
//               <button type="button" className="btn btn-primary flex h-[38px] min-w-[140px] justify-center" onClick={continueText} disabled={busy}>
//                 Continue <Icon name="chevR" size={14} />
//               </button>
//             )}
//           </div>
//         </Modal>
//       )}

//       {open && step === 'ask' && (
//         <Modal title="Import Barcodes" onClose={close} size="md">
//           <div className="flex-1 overflow-y-auto p-5" role="group" aria-label="What type of data is this?">
//             <div className="text-[15px] font-bold uppercase tracking-wide text-ink">What type of data is this?</div>
//             <p className="mt-2 text-[13.5px] text-ink">
//               {asking === 'file'
//                 ? <>Is <span className="font-semibold">{file?.name}</span> a Barcode Report / Barcode Details export?</>
//                 : 'Is this copied Barcode Report / Barcode Details data?'}
//             </p>
//             {asking === 'text' && (
//               <pre className="mt-2 max-h-[180px] overflow-auto whitespace-pre-wrap rounded border border-line bg-[#f7f9fc] p-2 font-mono text-[11.5px] leading-[1.45] text-inkmuted">
//                 {paste.split('\n').slice(0, 12).join('\n')}{paste.split('\n').length > 12 ? '\n...' : ''}
//               </pre>
//             )}
//             <p className="mt-2 text-[12.5px] text-inkmuted">
//               Only a Barcode Report - one barcode&apos;s Barcode Details, or the report table - can be imported here. It is read as one
//               only once you say so; anything else, Cancel.
//             </p>
//           </div>
//           <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-3">
//             <button type="button" className="btn" onClick={() => { setStep('input'); setFile(null); setAsking(''); }}>Cancel</button>
//             <button type="button" className="btn btn-primary" onClick={() => parseConfirmed(asking)} autoFocus>
//               <Icon name="check" size={14} /> Yes, Parse Barcode Report
//             </button>
//           </div>
//         </Modal>
//       )}

//       {open && step === 'parsing' && (
//         <Modal title="Import Barcodes" onClose={close} size="sm">
//           <div className="flex-1 p-6" role="status" aria-live="polite">
//             <div className="flex items-center gap-3 text-[14px] font-semibold text-ink">
//               <span className="spin" /> {mode === 'image' && /image|OCR/i.test(stage) ? stage : 'Parsing Barcode Report...'}
//             </div>
//             {mode === 'image' && (
//               <div className="mt-3 text-[13px] text-inkmuted">
//                 <div>Reading image...</div>
//                 <div>Extracting Barcode Report...</div>
//               </div>
//             )}
//             <div className="mt-3 text-[13px] text-ink">Reading:</div>
//             <ul className="ml-5 list-disc text-[13px] text-inkmuted">
//               {PARSE_STEPS.map((s) => <li key={s}>{s}</li>)}
//             </ul>
//             {stage && <div className="mt-3 text-[12.5px] text-inkmuted">{stage}</div>}
//           </div>
//         </Modal>
//       )}

//       {open && step === 'failed' && failure && (
//         <Modal title="Import Barcodes" onClose={close} size="md" headerAction={sourceLink}>
//           <div className="flex-1 overflow-y-auto p-5">
//             <div className="rounded border border-[#f1b0b0] bg-[#fdecec] px-4 py-3" role="alert" aria-label="Barcode Report could not be parsed">
//               <div className="text-[14px] font-bold uppercase tracking-wide text-danger">Barcode Report could not be parsed</div>
//               <p className="mt-1 text-[13px] font-semibold text-ink">{failure.message}</p>
//               {failure.poor && <p className="mt-1 text-[12.5px] text-[#8a5a00]">{OCR_MESSAGES.poor}</p>}
//             </div>
//             <div className="mt-3 text-[13px] text-ink">Possible reasons:</div>
//             <ul className="ml-5 list-disc text-[13px] text-inkmuted">
//               {FAIL_REASONS.filter((r) => failure.image || !/^Image/.test(r)).map((r) => <li key={r}>{r}</li>)}
//             </ul>
//             <p className="mt-3 text-[12.5px] text-inkmuted">Nothing was saved.</p>
//             {failure.ocr && <OcrPanel ocr={failure.ocr} onEdit={editExtracted} busy={busy} />}
//           </div>
//           <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-3">
//             <button type="button" className="btn" onClick={close}>Cancel</button>
//             <button type="button" className="btn btn-primary" onClick={tryAgain}>
//               <Icon name="refresh" size={14} /> Try Again
//             </button>
//           </div>
//         </Modal>
//       )}

//       {open && step === 'review' && review && isDetails && (
//         <Modal title="Barcode Import Preview" onClose={close} size="xl" headerAction={sourceLink}>
//           <div className="flex-1 overflow-y-auto p-5">
//             <div className="mb-2 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
//               <span className="text-inkmuted">Source: <span className="font-semibold text-ink">{sourceText}</span></span>
//               <span className="text-inkmuted">Import into: <span className="font-semibold text-ink">{review.location || locationName()}</span></span>
//             </div>
//             <p className="mb-2 text-[12.5px] text-inkmuted">
//               Every value below was read from the {fromImage ? 'image' : 'Barcode Report'} - correct any of them in its box, then press Check
//               corrections. Nothing is saved until you press {primaryLabel === 'Nothing to import' ? 'Seed / Import' : primaryLabel} (or Confirm Replace).
//               Item, quantity and UOM of a barcode already here are never changed, and no master is created or changed.
//             </p>
//             {dirty && (
//               <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded border border-[#e7c96b] bg-[#fff8e6] px-3 py-2 text-[12.5px]" role="status">
//                 <span>You corrected {plural(editCount, 'value')} - check {editCount === 1 ? 'it' : 'them'} against this ERP before importing.</span>
//                 <span className="flex gap-2">
//                   <button type="button" className="btn h-8" onClick={() => setEdits(new Map())} disabled={busy}><Icon name="undo" size={14} /> Undo corrections</button>
//                   <button type="button" className="btn btn-primary h-8" onClick={recheck} disabled={busy}>{busy ? <span className="spin" /> : <Icon name="check" size={14} />} Check corrections</button>
//                 </span>
//               </div>
//             )}
//             {read?.ocr && <OcrPanel ocr={read.ocr} onEdit={editExtracted} busy={busy} />}
//             <div className={fromImage && images.length ? 'mt-2 grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]' : 'mt-2'}>
//               {fromImage && images.length > 0 && (
//                 <div className="lg:sticky lg:top-0 lg:self-start" aria-label="Source image">
//                   <div className="mb-1 text-[12px] font-bold uppercase tracking-wide text-ink">Source Image</div>
//                   <div className="max-h-[70vh] space-y-2 overflow-auto rounded border border-line p-1">
//                     {images.map((img) => (
//                       <a key={img.id} href={img.url} target="_blank" rel="noopener noreferrer" title="Open the image at full size" className="block">
//                         <img src={img.url} alt={img.name} className="h-auto w-full rounded" />
//                       </a>
//                     ))}
//                   </div>
//                 </div>
//               )}
//               <div>
//                 {fromImage && images.length > 0 && <div className="mb-1 text-[12px] font-bold uppercase tracking-wide text-ink">Parsed Barcode Details</div>}
//                 {rows.map((r) => {
//                   const rec = read.records.find((x) => x.line === r.line) || { values: r.values, details: r.details };
//                   return (
//                     <DetailsCard
//                       key={r.line + ':' + r.key}
//                       rec={rec}
//                       row={r}
//                       edits={edits.get(r.line) || {}}
//                       onEdit={(key, value, original, force) => setEdit(r.line, key, value, original, force)}
//                       busy={busy}
//                       multi={rows.length > 1}
//                       ticked={ticked.has(r.key)}
//                       onTick={() => toggleNew(r.key)}
//                       picked={pickedOf(r)}
//                       decision={replacesOf(r).length ? 'replace' : decided.get(r.key)}
//                       onKeep={() => keepRow(r)}
//                       onReplace={() => replaceAndConfirm(r)}
//                       onToggleField={(fields) => toggleField(r, fields)}
//                       readWarnings={rows.length === 1 ? read.warnings || [] : []}
//                       barcodeImage={barcodeImages.get(r.line) || null}
//                       imagePlan={imagePlanOf(r)}
//                       onAttachImage={(f) => attachBarcodeImage(r.line, f)}
//                       onRemoveImage={() => removeBarcodeImage(r.line)}
//                       onDecideImage={(how) => decideBarcodeImage(r.line, how)}
//                     />
//                   );
//                 })}
//               </div>
//             </div>
//             {comparedBox}
//             {busy && stage && <div className="mt-2 text-[12.5px] text-inkmuted" role="status">{stage}</div>}
//             {error && <div className="flash flash-err mt-3">{error}</div>}
//           </div>
//           <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">
//             <button type="button" className="btn" onClick={back} disabled={busy}>
//               <Icon name="back" size={14} /> Back
//             </button>
//             <button type="button" className="btn" onClick={close} disabled={busy}>Cancel</button>
//             <button
//               type="button"
//               className="btn btn-primary flex h-[38px] min-w-[200px] justify-center"
//               onClick={askImport}
//               disabled={busy || (!dirty && (nothingToImport || (fromImage && !compared)))}
//               title={!dirty && fromImage && !compared ? 'Confirm you compared the values with the image first' : undefined}
//             >
//               {busy ? <span className="spin" /> : <Icon name="check" size={14} />}
//               {' '}{dirty ? 'Check corrections' : primaryLabel}
//             </button>
//           </div>
//         </Modal>
//       )}

//       {open && step === 'review' && review && !isDetails && (
//         <Modal title="Barcode Import Preview" onClose={close} size="lg" headerAction={sourceLink}>
//           <div className="flex-1 overflow-y-auto p-5">
//             <div className="mb-2 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
//               <span className="text-inkmuted">Import into: <span className="font-semibold text-ink">{review.location}</span></span>
//               <span className="text-inkmuted">Source: <span className="font-semibold text-ink">Barcode Report table - {sourceText}</span></span>
//             </div>
//             <p className="mb-2 text-[12.5px] text-inkmuted">
//               A barcode this ERP does not hold is ready to import (seeded). For a barcode it already holds, its existing data is shown
//               beside the imported data: a blank the import only fills is ticked, a saved value it would replace waits for KEEP EXISTING
//               or REPLACE. Item, quantity and UOM are never changed, and masters are never created or changed.
//             </p>
//             {read?.ocr && <OcrPanel ocr={read.ocr} records={read.records.length} flagged={read.records.filter((r) => r.review?.some((x) => x.field === 'barcode')).length}
//               totals={read.records.some((r) => r.review?.some((x) => x.field === 'qty'))} onEdit={editExtracted} busy={busy} />}
//             {fromImage && images.length > 0 && (
//               <div className="mt-2 flex max-h-[260px] gap-2 overflow-auto rounded border border-line p-1" aria-label="Source image">
//                 {images.map((img) => (
//                   <a key={img.id} href={img.url} target="_blank" rel="noopener noreferrer" title="Open the image at full size" className="shrink-0">
//                     <img src={img.url} alt={img.name} className="h-auto max-w-none rounded" />
//                   </a>
//                 ))}
//               </div>
//             )}
//             {comparedBox}
//             <MastersNote review={review} read={read} />
//             <div className="mb-3 flex flex-wrap items-center gap-2 text-[12.5px]">
//               {ORDER.filter((s) => review.counts[s]).map((s) => (
//                 <span key={s} className={'rounded px-2 py-0.5 font-semibold ' + STATUS[s].tone}>
//                   {STATUS[s].label}: {review.counts[s]}
//                 </span>
//               ))}
//               {changedRows.some((r) => r.replaces) && (
//                 <>
//                   <button type="button" className="btn" onClick={() => changedRows.forEach(replaceRow)} disabled={busy}>Replace all</button>
//                   <button type="button" className="btn" onClick={() => changedRows.forEach(keepRow)} disabled={busy}>Keep all existing</button>
//                 </>
//               )}
//             </div>
//             {needsDecision.length > 0 && (
//               <div className="mb-3 rounded border border-[#e7c96b] bg-[#fff8e6] px-3 py-2 text-[12.5px] text-ink" role="status">
//                 <span className="font-semibold">EXISTING BARCODE FOUND</span> - {needsDecision.map((r) => r.barcode).join(', ')}{' '}
//                 {needsDecision.length > 1 ? 'already exist' : 'already exists'} in this ERP with different saved data. Choose KEEP EXISTING
//                 or REPLACE on {needsDecision.length > 1 ? 'each' : 'it'} below (left undecided, the existing data is kept).
//               </div>
//             )}

//             {/* every value is text the operator pasted - rendered as text */}
//             <table className="w-full border-collapse text-[12.5px]">
//               <thead>
//                 <tr className="bg-[#f7f9fc] text-left">
//                   <th className="w-8 border border-line px-2 py-2" aria-label="Take" />
//                   <th className="border border-line px-2 py-2">Status</th>
//                   <th className="border border-line px-2 py-2">Barcode</th>
//                   <th className="border border-line px-2 py-2">Item Code</th>
//                   <th className="border border-line px-2 py-2">Description</th>
//                   <th className="border border-line px-2 py-2 text-right">Qty</th>
//                   <th className="border border-line px-2 py-2">UOM</th>
//                   <th className="border border-line px-2 py-2 text-right">Retail Price</th>
//                   <th className="border border-line px-2 py-2">Changes / reason</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {[...importRows].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || a.line - b.line).map((r) => {
//                   const isOpen = open2.has(r.key);
//                   const hasDetail = r.status !== 'invalid' || r.details;
//                   const willReplace = replacesOf(r).length > 0;
//                   const sub = r.status !== 'changed' ? ''
//                     : willReplace ? 'WILL REPLACE'
//                       : decided.get(r.key) === 'keep' ? 'KEEP EXISTING'
//                         : r.replaces ? 'REPLACE REQUIRED' : '';
//                   return [
//                     <tr key={r.line + ':' + r.key} data-status={r.status} className={r.status === 'changed' ? 'bg-[#fffbf0]' : ''}>
//                       <td className="border border-line px-2 py-1.5 text-center">
//                         {r.status === 'new' ? (
//                           <input type="checkbox" checked={ticked.has(r.key)} onChange={() => toggleNew(r.key)} aria-label={'Import ' + r.barcode} />
//                         ) : null}
//                       </td>
//                       <td className="border border-line px-2 py-1.5">
//                         <span className={'whitespace-nowrap rounded px-1.5 py-0.5 text-[11.5px] font-semibold ' + STATUS[r.status].tone}>{STATUS[r.status].label}</span>
//                         {sub ? <div className={'mt-1 text-[11px] font-semibold ' + (sub === 'REPLACE REQUIRED' ? 'text-danger' : 'text-inkmuted')}>{sub}</div> : null}
//                       </td>
//                       <td className="border border-line px-2 py-1.5 font-mono">{r.barcode || '—'}</td>
//                       <td className="border border-line px-2 py-1.5">
//                         {r.values.itemCode || '—'}
//                         {r.status === 'new' && !r.itemInMaster ? <div className="text-[11px] text-inkmuted">not in Item master</div> : null}
//                       </td>
//                       <td className="border border-line px-2 py-1.5">{r.values.description || '—'}</td>
//                       <td className="border border-line px-2 py-1.5 text-right">{r.values.qty || '—'}</td>
//                       <td className="border border-line px-2 py-1.5">{r.values.uom || '—'}</td>
//                       <td className="border border-line px-2 py-1.5 text-right">{r.values.retailPrice || '—'}</td>
//                       <td className="border border-line px-2 py-1.5">
//                         {r.reason ? <div className={r.status === 'invalid' ? 'text-danger' : 'text-inkmuted'}>{r.reason}</div> : null}
//                         {r.seriesNote ? <div className="text-inkmuted">{r.seriesNote}</div> : null}
//                         {r.status === 'changed' ? (
//                           <div>
//                             {plural((r.diffs || []).length, 'difference')}
//                             {r.replaces ? ` - ${r.replaces} would replace a saved value` : ''}
//                             {r.identity?.state === 'different' ? <span className="font-semibold text-danger"> - different goods</span> : null}
//                           </div>
//                         ) : null}
//                         {r.status === 'changed' && r.updatable ? (
//                           <div className="mt-1 flex flex-wrap gap-1">
//                             <button type="button" className="btn h-7 px-2 text-[12px]" onClick={() => keepRow(r)} disabled={busy} aria-label={'Keep existing ' + r.barcode}>Keep existing</button>
//                             <button type="button" className="btn h-7 px-2 text-[12px]" onClick={() => replaceRow(r)} disabled={busy} aria-label={'Replace ' + r.barcode}>Replace</button>
//                           </div>
//                         ) : null}
//                         {hasDetail ? (
//                           <button type="button" className="mt-1 text-[12px] text-brand-link underline" onClick={() => toggleOpen(r.key)} aria-expanded={isOpen}>
//                             {isOpen ? 'Hide details' : r.status === 'changed' || r.status === 'same' || r.status === 'locked' ? 'Compare existing and imported data' : 'Show details'}
//                           </button>
//                         ) : null}
//                       </td>
//                     </tr>,
//                     isOpen && hasDetail ? (
//                       <tr key={r.line + ':' + r.key + ':detail'} data-detail-for={r.key}>
//                         <td colSpan={9} className="border border-line bg-[#fbfcfe] px-3 py-3">
//                           <RowDetail row={r} picked={pickedOf(r)} onToggle={(fields) => toggleField(r, fields)} busy={busy} editable={r.status === 'changed' && r.updatable} />
//                           <div className="mt-3">
//                             <BarcodeImageSection row={r} image={barcodeImages.get(r.line) || null} plan={imagePlanOf(r)} busy={busy}
//                               onAttach={(f) => attachBarcodeImage(r.line, f)} onRemove={() => removeBarcodeImage(r.line)} onDecide={(how) => decideBarcodeImage(r.line, how)} />
//                           </div>
//                         </td>
//                       </tr>
//                     ) : null,
//                   ];
//                 })}
//               </tbody>
//             </table>

//             {read?.unmapped?.length > 0 && (
//               <p className="mt-3 text-[12px] text-inkmuted">Ignored columns: {read.unmapped.join(', ')} - this ERP&apos;s Barcode Report has no such field.</p>
//             )}
//             {read?.ignored > 0 && (
//               <p className="mt-1 text-[12px] text-inkmuted">{plural(read.ignored, 'line')} left out: totals, repeated headings, rows copied twice, or lines that are not barcodes.</p>
//             )}
//             {read?.columns?.length > 0 && (
//               <p className="mt-1 text-[12px] text-inkmuted">
//                 Read: {read.columns.filter((c) => c.field).map((c) => (c.heading === FIELD_LABELS[c.field] ? c.heading : `${c.heading} → ${FIELD_LABELS[c.field]}`)).join(', ')}.
//               </p>
//             )}
//             <LeftOut read={read} />
//             {busy && stage && <div className="mt-2 text-[12.5px] text-inkmuted" role="status">{stage}</div>}
//             {error && <div className="flash flash-err mt-3">{error}</div>}
//           </div>
//           <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-3">
//             <button type="button" className="btn" onClick={back} disabled={busy}>
//               <Icon name="back" size={14} /> Back
//             </button>
//             <button type="button" className="btn" onClick={close} disabled={busy}>Cancel</button>
//             <button
//               type="button"
//               className="btn btn-primary flex h-[38px] min-w-[200px] justify-center"
//               onClick={askImport}
//               disabled={busy || nothingToImport || (fromImage && !compared)}
//               title={fromImage && !compared ? 'Confirm you compared the values with the image first' : undefined}
//             >
//               {busy ? <span className="spin" /> : <Icon name="check" size={14} />}
//               {' '}{primaryLabel}
//             </button>
//           </div>
//         </Modal>
//       )}

//       {open && step === 'review' && confirming && (
//         <Modal title="Replace existing data?" onClose={() => setConfirming(false)} size="md">
//           <div className="flex-1 overflow-y-auto p-5 text-[13px]">
//             {changedRows.filter((r) => replacesOf(r).length).map((r) => (
//               <div key={r.key} className="mb-3">
//                 <div className="font-semibold">Barcode: <span className="font-mono">{r.barcode}</span>{r.identity?.state === 'different' ? <span className="ml-2 text-danger">- different goods here ({r.existing?.itemCode})</span> : null}</div>
//                 <div className="text-ink">Existing data will be replaced with the imported Barcode Report data:</div>
//                 <ul className="ml-5 list-disc">
//                   {replacesOf(r).filter((d) => !(TWIN_OF.has(d.field) && replacesOf(r).some((m) => TWINS[m.field] === d.field))).map((d) => (
//                     <li key={d.field}>{d.label}: <span className="line-through">{d.local || '—'}</span> → <span className="font-semibold">{d.incoming}</span></li>
//                   ))}
//                 </ul>
//               </div>
//             ))}
//             {adding > 0 && <p className="mb-2 text-inkmuted">{plural(adding, 'new barcode')} will be seeded as well.</p>}
//             {imageReplaces.length > 0 && (
//               <p className="mb-2 text-ink">
//                 Barcode image replaced as you chose (separately from the data): <span className="font-mono">{imageReplaces.map((r) => r.barcode).join(', ')}</span>.
//               </p>
//             )}
//             <p className="font-semibold">Master data will NOT be changed.</p>
//             <p className="text-inkmuted">Item, quantity and UOM stay as they are here; Item, Supplier, HSN, GST, UOM, group and price masters are never touched.</p>
//             {comparedBox}
//             {error && <div className="flash flash-err mt-3">{error}</div>}
//           </div>
//           <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-3">
//             <button type="button" className="btn" onClick={() => setConfirming(false)} disabled={busy}>Cancel</button>
//             <button type="button" className="btn btn-primary" onClick={runImport} disabled={busy || (fromImage && !compared)}>
//               {busy ? <span className="spin" /> : null} Confirm Replace
//             </button>
//           </div>
//         </Modal>
//       )}

//       {open && step === 'done' && result && (
//         <Modal title="Import Successful" onClose={close} size="md">
//           <div className="flex-1 overflow-y-auto p-5">
//             <div className="flash flash-ok">
//               {[result.inserted ? `${plural(result.inserted, 'barcode')} seeded` : '', result.replaced ? `${result.replaced} replaced` : '',
//                 result.filled ? `${result.filled} filled` : '', result.imagesSaved ? `${plural(result.imagesSaved, 'barcode image')} saved` : '',
//                 result.imagesReplaced ? `${plural(result.imagesReplaced, 'barcode image')} replaced` : ''].filter(Boolean).join(', ') || 'Nothing was changed'}.
//             </div>
//             <table className="mt-3 w-full border-collapse text-[12.5px]" aria-label="What became of each barcode">
//               <thead>
//                 <tr className="bg-[#f7f9fc] text-left">
//                   <th className="border border-line px-2 py-1.5">Barcode</th>
//                   <th className="border border-line px-2 py-1.5">Action</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {(result.actions || []).slice(0, 200).map((a) => (
//                   <tr key={a.line + ':' + a.barcode}>
//                     <td className="border border-line px-2 py-1.5 font-mono">{a.barcode || '—'}</td>
//                     <td className={'border border-line px-2 py-1.5 ' + (ACTIONS[a.action]?.tone || '')}>
//                       {ACTIONS[a.action]?.label || a.action}
//                       {a.fields?.length ? `: ${a.fields.join(', ')}` : ''}
//                       {a.reason ? <span className="text-inkmuted"> - {a.reason}</span> : null}
//                       {a.image ? <ImageOutcome image={a.image} barcode={a.barcode} /> : null}
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//             <ul className="mt-3 space-y-1 text-[12.5px] text-inkmuted">
//               <li>Total {result.total} · seeded {result.inserted} · updated {result.updated} · skipped {result.skipped} · errors {result.failed}</li>
//               <li>Masters matched: {result.mastersMatched}{result.unmatched?.length ? `, not found (kept as text): ${result.unmatched.map((u) => `${u.type} "${u.name}"`).join(', ')}` : ''}</li>
//               {result.floors?.length > 0 && (
//                 <li>Barcode Generation moves past the seeded numbers of this ERP&apos;s own series: {result.floors.map((f) => `${f.barcode}`).join(', ')}.</li>
//               )}
//             </ul>
//             <p className="mt-3 text-[12.5px] text-inkmuted">The report below now shows them.</p>
//           </div>
//           <div className="flex shrink-0 justify-end border-t border-line px-5 py-3">
//             <button type="button" className="btn btn-primary" onClick={close}>Done</button>
//           </div>
//         </Modal>
//       )}
//     </>
//   );
// }

// /* What became of one barcode's image on Import (the server's `image`) */
// const IMAGE_OUTCOMES = {
//   saved: { label: '✓ Barcode image saved', tone: 'text-okgreen' },
//   replaced: { label: '✓ Barcode image replaced', tone: 'text-okgreen' },
//   kept: { label: 'Existing barcode image kept', tone: 'text-inkmuted' },
//   retained: { label: 'Barcode image not changed', tone: 'text-[#8a5a00]' },
//   skipped: { label: 'Barcode image not saved', tone: 'text-inkmuted' },
//   error: { label: 'Barcode image not saved', tone: 'text-danger' },
// };
// function ImageOutcome({ image, barcode }) {
//   const o = IMAGE_OUTCOMES[image.action] || IMAGE_OUTCOMES.error;
//   return (
//     <div className="mt-1.5 flex items-start gap-2" aria-label={`Barcode image of ${barcode}`}>
//       {image.url ? <div className="w-[72px] shrink-0"><BarcodeImageThumb src={image.url} alt={`Barcode image of ${barcode}`} height={56} /></div> : null}
//       <div className="min-w-0 text-[12px]">
//         <div className={'font-semibold ' + o.tone}>{o.label}</div>
//         {image.url ? <div className="break-all text-inkmuted">Status: ✓ Saved · URL: <span className="font-mono">{image.url}</span></div> : null}
//         {image.reason ? <div className="text-inkmuted">{image.reason}</div> : null}
//       </div>
//     </div>
//   );
// }

// /* THE BARCODE IMAGE of one barcode in the preview - apart from its data:
//    choosing KEEP / REPLACE for the data never touches the image, and an image
//    never changes the data. The picture is kept here (a local preview) until
//    Import; nothing is uploaded or saved before then.
//    `plan` - lib/barcodeImage.js imagePlan for this row (or 'skipped'). */
// function BarcodeImageSection({ row, image, plan, busy, onAttach, onRemove, onDecide, titled = true }) {
//   const existing = String(row.existing?.imageUrl ?? '').trim() ? (row.existing?.image || '') : '';
//   const hasExisting = Boolean(String(row.existing?.imageUrl ?? '').trim());
//   const blocked = !['new', 'same', 'changed', 'locked'].includes(row.status);
//   const status = !image ? ''
//     : plan === 'keep' ? 'Existing image kept - the new one will not be saved'
//       : plan === 'skipped' ? 'Not saved - the barcode is not ticked to be seeded'
//         : 'Pending upload - saved when you press Import';
//   return (
//     <div aria-label={`Barcode image of ${row.barcode || 'this barcode'}`}>
//       {titled && <div className="mb-1 text-[12px] font-bold uppercase tracking-wide text-ink">Barcode Image</div>}
//       <p className="mb-2 text-[12px] text-inkmuted">
//         The picture of barcode <span className="font-mono">{row.barcode || '—'}</span> itself - kept on this barcode, never on the Item
//         master, the supplier or the group. Upload or paste the barcode image.
//       </p>
//       {blocked ? (
//         <div className="text-[12.5px] text-inkmuted">This barcode cannot be imported, so no barcode image can be saved for it.</div>
//       ) : (
//         <div className="grid gap-3 sm:grid-cols-2">
//           {hasExisting && (
//             <BarcodeImageThumb label="Existing barcode image" src={existing} alt={`Existing barcode image of ${row.barcode}`} height={150} />
//           )}
//           {image ? (
//             <div className="min-w-0">
//               <BarcodeImageThumb label={hasExisting ? 'New image' : 'Selected image'} src={image.url} alt={`New barcode image of ${row.barcode}`} height={150} />
//               <div className="mt-1 text-[12px] text-okgreen">✓ Barcode image selected <span className="text-inkmuted">({image.name})</span></div>
//               <div className="text-[12px] text-inkmuted">Status: {status}</div>
//               <div className="mt-1 flex flex-wrap gap-2">
//                 <BarcodeImageInput compact uploadLabel="Change Image" onPicked={onAttach} disabled={busy} />
//                 <button type="button" className="btn h-8" onClick={onRemove} disabled={busy}><Icon name="trash" size={14} /> Remove Image</button>
//               </div>
//             </div>
//           ) : (
//             <div className="min-w-0">
//               {!hasExisting && <div className="mb-2 text-[12.5px] text-inkmuted">No barcode image yet.</div>}
//               <BarcodeImageInput onPicked={onAttach} disabled={busy} />
//             </div>
//           )}
//         </div>
//       )}
//       {image && hasExisting && !blocked && plan !== 'skipped' && (
//         <div className="mt-2 rounded border border-[#e7c96b] bg-[#fff8e6] px-3 py-2 text-[12.5px]" role="group" aria-label="Existing barcode image found">
//           <div className="font-bold uppercase tracking-wide text-[#8a5a00]">Existing barcode image found</div>
//           <div className="text-ink">Do you want to replace the existing barcode image?</div>
//           <div className="mt-1 flex flex-wrap items-center gap-2">
//             <button type="button" className={'btn ' + (plan === 'keep' ? 'btn-primary' : '')} onClick={() => onDecide('keep')} disabled={busy}>Keep Existing</button>
//             <button type="button" className={'btn ' + (plan === 'replace' ? 'btn-primary' : '')} onClick={() => onDecide('replace')} disabled={busy}>Replace Image</button>
//             <span className="text-[12px] text-inkmuted">
//               {plan === 'replace' ? 'The existing image will be replaced by the new one on Import.' : 'Undecided - the existing image is kept.'}
//             </span>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// /* A section of the structured preview, as the Barcode Details screen heads it */
// function Section({ title, children, aside = null }) {
//   return (
//     <section className="mt-3 rounded border border-line" aria-label={title}>
//       <div className="flex items-center justify-between border-b border-line bg-[#f7f9fc] px-3 py-1.5">
//         <span className="text-[12px] font-bold uppercase tracking-wide text-ink">{title}</span>
//         {aside}
//       </div>
//       <div className="p-3">{children}</div>
//     </section>
//   );
// }

// /* One value of the page: a box to correct it in (or, read-only, as read) */
// function Field({ label, value, original, onChange, readOnly = false, busy = false, hint = '', mono = false }) {
//   const corrected = !readOnly && txt(value) !== txt(original);
//   return (
//     <label className="block min-w-0">
//       <span className="block text-[11px] font-semibold uppercase tracking-wide text-inkmuted">
//         {label}{corrected ? <span className="ml-1 normal-case text-[#8a5a00]">(corrected)</span> : null}
//       </span>
//       {readOnly ? (
//         <span className={'block min-h-[30px] break-words py-1 text-[13px] text-ink ' + (mono ? 'font-mono' : '')}>{txt(value) || '—'}</span>
//       ) : (
//         <input
//           value={value}
//           onChange={(e) => onChange(e.target.value)}
//           readOnly={busy}
//           aria-label={label}
//           className={'f-input h-[30px] w-full text-[13px] ' + (mono ? 'font-mono ' : '') + (corrected ? 'border-[#e7c96b] bg-[#fffbf0]' : '')}
//         />
//       )}
//       {hint ? <span className="block text-[11px] leading-tight text-[#8a5a00]">{hint}</span> : null}
//     </label>
//   );
// }

// /* ONE barcode's Details page, parsed - laid out as the Barcode Details
//    screen shows it, every value correctable - and what this ERP says of it:
//    NEW (ready to seed), EXISTING (its saved data beside the imported data,
//    KEEP EXISTING DATA / REPLACE WITH IMPORTED DATA), or why it cannot be
//    imported. `rec` - the record as read (and corrected); `row` - the
//    server's verdict on it. */
// function DetailsCard({
//   rec, row, edits, onEdit, busy, multi, ticked, onTick, picked, decision, onKeep, onReplace, onToggleField, readWarnings,
//   barcodeImage, imagePlan: plan, onAttachImage, onRemoveImage, onDecideImage,
// }) {
//   const d = rec.details || {};
//   const id = rec.identify || {};
//   const valueOf = (key) => (key in edits ? edits[key] : fieldOf(rec, key));
//   const unmatched = new Set((row.unmatched || []).map((u) => u.type));
//   const hintOf = (key) => {
//     if (key === 'itemCode' && row.status === 'new' && !row.itemInMaster && !(key in edits)) return 'not in the Item master - kept as text';
//     if (key === 'uom' && row.sources?.uom === 'item_master' && txt(row.values?.uom) !== txt(rec.values?.uom)) return `the Item master's UOM (${row.values.uom}) is used`;
//     const master = MASTER_OF[key];
//     return master && unmatched.has(master) && valueOf(key) && !(key in edits) ? `not in the ${master} master - kept as text` : '';
//   };
//   const field = ([key, label, readOnly]) => (
//     <Field key={key} label={label} value={valueOf(key)} original={fieldOf(rec, key)} readOnly={readOnly} busy={busy}
//       onChange={(v) => onEdit(key, v, fieldOf(rec, key))} hint={hintOf(key)} />
//   );
//   const noBarcode = !txt(rec.values?.barcode) && !('barcode' in edits);
//   const barcodeProblems = (row.errors || []).filter((e) => e.field === 'barcode').map((e) => e.message);
//   const otherProblems = (row.errors || []).filter((e) => e.field !== 'barcode').map((e) => e.message);
//   const ocrDoubt = (rec.review || []).some((r) => r.field === 'barcode' && /OCR is not sure/.test(r.message));
//   const summary = summaryOf(d);
//   const held = row.links?.stockAt?.[0];
//   const totals = d.totals?.computed;
//   const printed = d.totals?.printed;
//   const head = noBarcode ? { text: 'BARCODE REQUIRED', tone: 'bg-[#fdecec] text-danger' }
//     : row.status === 'new' ? { text: 'NEW BARCODE - READY TO IMPORT', tone: 'bg-okgreenbg text-okgreen' }
//       : ['changed', 'same', 'locked'].includes(row.status) ? { text: 'EXISTING BARCODE FOUND', tone: 'bg-[#fff4d6] text-[#8a5a00]' }
//         : { text: 'CANNOT BE IMPORTED', tone: 'bg-[#fdecec] text-danger' };
//   const edited = new Set(rec.edited || []);

//   return (
//     <article className="mb-4 rounded-md border border-linestrong p-3" data-status={row.status} aria-label={`Barcode ${row.barcode || '(none)'}`}>
//       <div className="flex flex-wrap items-center justify-between gap-2">
//         <div className="flex flex-wrap items-center gap-2">
//           <span className={'rounded px-2 py-0.5 text-[12px] font-bold ' + head.tone}>{head.text}</span>
//           <span className="font-mono text-[15px] font-semibold">{row.barcode || '—'}</span>
//           {row.origin ? <span className="text-[11.5px] text-inkmuted">read from an image</span> : null}
//         </div>
//         {multi && row.status === 'new' ? (
//           <label className="flex items-center gap-1 text-[12.5px]">
//             <input type="checkbox" checked={ticked} onChange={onTick} disabled={busy} aria-label={'Seed ' + row.barcode} /> Seed this barcode
//           </label>
//         ) : null}
//       </div>

//       <Section title="Barcode Identification">
//         <div className="grid gap-3 sm:grid-cols-3">
//           <Field label="Barcode" value={valueOf('barcode')} original={fieldOf(rec, 'barcode')} busy={busy} mono
//             onChange={(v) => onEdit('barcode', v, fieldOf(rec, 'barcode'))} hint={noBarcode ? 'Type the barcode' : ''} />
//           <div>
//             <span className="block text-[11px] font-semibold uppercase tracking-wide text-inkmuted">Detected From</span>
//             <span className="block py-1 text-[13px] font-semibold text-ink">
//               {'barcode' in edits ? 'Typed by you (Check corrections to use it)' : DETECTED_FROM[id.from] || (edited.has('barcode') ? 'Typed by you' : '—')}
//             </span>
//           </div>
//           <div>
//             <span className="block text-[11px] font-semibold uppercase tracking-wide text-inkmuted">Item Code on the page</span>
//             <span className="block py-1 font-mono text-[13px] text-ink">
//               {id.itemCode || '—'}{id.itemCode ? <span className="ml-1 font-sans text-[11.5px] text-inkmuted">({id.itemCodeFrom === 'filters' ? 'its Filters panel' : 'its Item Code'})</span> : null}
//             </span>
//           </div>
//         </div>
//         <div className="mt-2 text-[12.5px]">
//           <span className="font-semibold text-ink">Reason: </span>
//           <span className="text-inkmuted">
//             {noBarcode ? 'No separate Barcode, and no Item Code to use as one, was found - type the barcode above, then Check corrections.' : id.reason || '—'}
//           </span>
//         </div>
//         {(id.notes || []).map((n) => <div key={n} className="mt-1 text-[12.5px] text-[#8a5a00]">{n}</div>)}
//         {!noBarcode && barcodeProblems.map((m) => <div key={m} className="mt-1 text-[12.5px] text-danger">{m}</div>)}
//         {ocrDoubt && !('barcode' in edits) && (
//           <button type="button" className="btn mt-2 h-8" disabled={busy} onClick={() => onEdit('barcode', fieldOf(rec, 'barcode'), fieldOf(rec, 'barcode'), true)}>
//             <Icon name="check" size={14} /> The barcode above is correct
//           </button>
//         )}
//       </Section>

//       <Section title="Barcode Image">
//         <BarcodeImageSection row={row} image={barcodeImage} plan={plan} busy={busy} titled={false}
//           onAttach={onAttachImage} onRemove={onRemoveImage} onDecide={onDecideImage} />
//       </Section>

//       <Section title="Item Info">
//         <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{ITEM_INFO.map(field)}</div>
//       </Section>

//       <Section title="Price Info">
//         <div className="grid gap-3 sm:grid-cols-3">{PRICE_INFO.map(field)}</div>
//       </Section>

//       <Section title="Supplier Details">
//         <div className="grid gap-3 sm:grid-cols-3">{SUPPLIER_INFO.map(field)}</div>
//       </Section>

//       <Section title="Stock Movements" aside={<span className="text-[11.5px] text-inkmuted">{plural((d.movements || []).length, 'row')} - kept as the barcode&apos;s history</span>}>
//         {(d.movements || []).length ? (
//           <div className="overflow-x-auto">
//             <table className="w-full border-collapse text-[12px]" aria-label="Stock movements">
//               <thead>
//                 <tr className="bg-[#f7f9fc] text-left">
//                   {['Location', 'Doc Date', 'Doc No', 'Message', 'Stock Point', 'Receipts', 'Issues', 'Balance Qty', 'Final Price', 'Net Amt'].map((h, i) => (
//                     <th key={h} className={'border border-line px-2 py-1 ' + (i >= 5 ? 'text-right' : '')}>{h}</th>
//                   ))}
//                 </tr>
//               </thead>
//               <tbody>
//                 {d.movements.map((m, i) => (
//                   <tr key={m.key || i}>
//                     <td className="border border-line px-2 py-1">{m.location || '—'}</td>
//                     <td className="whitespace-nowrap border border-line px-2 py-1">{when(m.docDate)}</td>
//                     <td className="border border-line px-2 py-1">{m.docNo || '—'}</td>
//                     <td className="border border-line px-2 py-1">{m.particulars || m.party || m.docType || '—'}</td>
//                     <td className="border border-line px-2 py-1">{m.stockPoint || '—'}</td>
//                     <td className="border border-line px-2 py-1 text-right">{m.receipts || 0}</td>
//                     <td className="border border-line px-2 py-1 text-right">{m.issues || 0}</td>
//                     <td className="border border-line px-2 py-1 text-right">{m.balance ?? '—'}</td>
//                     <td className="border border-line px-2 py-1 text-right">{money(m.finalPrice)}</td>
//                     <td className="border border-line px-2 py-1 text-right">{money(m.netAmount)}</td>
//                   </tr>
//                 ))}
//                 {totals ? (
//                   <tr className="bg-[#f7f9fc] font-semibold">
//                     <td className="border border-line px-2 py-1" colSpan={5}>TOTAL</td>
//                     <td className="border border-line px-2 py-1 text-right">{totals.receipts}</td>
//                     <td className="border border-line px-2 py-1 text-right">{totals.issues}</td>
//                     <td className="border border-line px-2 py-1 text-right">{totals.balance}</td>
//                     <td className="border border-line px-2 py-1" />
//                     <td className="border border-line px-2 py-1 text-right">{money(totals.netAmount)}</td>
//                   </tr>
//                 ) : null}
//               </tbody>
//             </table>
//           </div>
//         ) : <div className="text-[12.5px] text-inkmuted">No movement rows were read.</div>}
//         {d.totals?.mismatches?.length > 0 && (
//           <div className="mt-1 text-[12.5px] text-[#8a5a00]">
//             The rows add up to {d.totals.mismatches.map((k) => `${k} ${totals?.[k]}`).join(', ')}, but the page&apos;s TOTAL says {d.totals.mismatches.map((k) => `${k} ${printed?.[k]}`).join(', ')}.
//           </div>
//         )}
//       </Section>

//       <Section title="Stock Summary">
//         <div className="grid gap-3 sm:grid-cols-3">
//           {field(['stockLocation', 'Location'])}
//           {field(['stockPoint', 'Stock Point'])}
//           <Field label="Qty" value={String(summary.qty ?? 0)} readOnly />
//         </div>
//         {row.status === 'new' && (
//           <div className="mt-2 text-[12.5px] text-inkmuted">
//             Will be seeded {held ? <>in stock at <span className="font-semibold text-ink">{held.location}</span> ({held.qty})</> : <>as <span className="font-semibold text-ink">history</span> - no stock left (a barcode with its receipts all issued is still imported)</>}.
//             {' '}Quantity received: {row.values?.qty || '—'} ({SOURCE_WORDS[row.sources?.qty] || 'as read'}).
//           </div>
//         )}
//       </Section>

//       {/* THIS ERP'S WORD ON IT */}
//       <div className="mt-3">
//         {row.status === 'new' && (
//           <div className="rounded border border-[#b7dfc2] bg-okgreenbg px-3 py-2 text-[13px]" role="status">
//             <div className="font-bold uppercase tracking-wide text-okgreen">New barcode</div>
//             <div className="text-ink">Ready to seed - this ERP does not hold {row.barcode}.</div>
//             {row.seriesNote ? <div className="mt-1 text-[12.5px] text-inkmuted">{row.seriesNote}</div> : null}
//           </div>
//         )}
//         {['changed', 'same', 'locked'].includes(row.status) && (
//           <div className="rounded border border-[#e7c96b] bg-[#fff8e6] px-3 py-2 text-[13px]" role="status">
//             <div className="font-bold uppercase tracking-wide text-[#8a5a00]">Existing barcode found</div>
//             <div className="text-ink">
//               {row.status === 'same' ? `${row.barcode} is already in this ERP with the same data - there is nothing to change.`
//                 : row.status === 'locked' ? row.reason
//                   : `${row.barcode} is already in this ERP. Its existing data is compared with the imported data below.`}
//             </div>
//             {row.status === 'changed' && (
//               <>
//                 <div className="mt-2 rounded border border-line bg-white p-2">
//                   <RowDetail row={row} picked={picked} onToggle={onToggleField} busy={busy} editable={row.updatable} />
//                 </div>
//                 {row.updatable && (
//                   <div className="mt-2">
//                     <div className="text-[13px] font-semibold text-ink">What do you want to do?</div>
//                     <div className="mt-1 flex flex-wrap items-center gap-2">
//                       <button type="button" className={'btn ' + (decision === 'keep' ? 'btn-primary' : '')} onClick={onKeep} disabled={busy}>KEEP EXISTING DATA</button>
//                       <button type="button" className={'btn ' + (decision === 'replace' ? 'btn-primary' : '')} onClick={onReplace} disabled={busy}>REPLACE WITH IMPORTED DATA</button>
//                       <span className="text-[12px] text-inkmuted">
//                         {decision === 'replace' ? 'The existing data will be replaced (you are asked to confirm).'
//                           : decision === 'keep' ? `The existing data is kept${picked.size ? ' - only its blank fields are filled' : ''}.`
//                             : row.replaces ? 'Undecided - the existing data is kept.' : 'Only blank fields are filled.'}
//                       </span>
//                     </div>
//                   </div>
//                 )}
//               </>
//             )}
//           </div>
//         )}
//         {row.status === 'invalid' && !noBarcode && (
//           <div className="rounded border border-[#f1b0b0] bg-[#fdecec] px-3 py-2 text-[13px]" role="alert">
//             <div className="font-bold uppercase tracking-wide text-danger">Cannot be imported</div>
//             <ul className="ml-5 list-disc text-ink">{[...barcodeProblems, ...otherProblems].map((m) => <li key={m}>{m}</li>)}</ul>
//             <div className="mt-1 text-[12px] text-inkmuted">Correct the value above and press Check corrections.</div>
//           </div>
//         )}
//         {noBarcode && otherProblems.length > 0 && (
//           <ul className="ml-5 mt-1 list-disc text-[12.5px] text-danger">{otherProblems.filter((m) => !/Barcode is missing/.test(m)).map((m) => <li key={m}>{m}</li>)}</ul>
//         )}
//       </div>

//       {((row.warnings || []).length > 0 || readWarnings.length > 0 || (row.unmatched || []).length > 0) && (
//         <details className="mt-2 text-[12px] text-inkmuted">
//           <summary className="cursor-pointer">Notes ({(row.warnings || []).length + readWarnings.length + (row.unmatched || []).length})</summary>
//           <ul className="ml-5 mt-1 list-disc">
//             {(row.unmatched || []).map((u) => <li key={u.type + u.name}>{u.type} &quot;{u.name}&quot; is not in the {u.type} master - kept as text on the barcode (masters are never created)</li>)}
//             {[...readWarnings, ...(row.warnings || [])].map((w) => <li key={w}>{w}</li>)}
//           </ul>
//         </details>
//       )}
//     </article>
//   );
// }

// /* A barcode already here: its EXISTING DATA beside the IMPORTED DATA, field
//    by field - each difference with its own tick (fill / replace), a value
//    that is the same shown as "No change", and item / quantity / UOM as never
//    changed by an import. For a new report-table row, what it will be seeded
//    as. */
// function RowDetail({ row, picked, onToggle, busy, editable }) {
//   const d = row.details || {};
//   const held = row.links?.stockAt?.[0];
//   const totals = d.totals?.computed;
//   const diffOf = (field) => (row.diffs || []).find((x) => x.field === field);
//   const incoming = {
//     ...row.values,
//     supplier: d.supplier || '',
//     location: held ? held.location || 'where the source holds it' : row.details ? 'kept as history (no stock left)' : '',
//     status: held ? `in stock (${held.qty})` : row.details ? 'history - no stock left' : '',
//   };
//   const existing = row.existing || null;
//   /* a difference and its twin (WSP price + base WSP) share a row and a tick */
//   const withTwin = (x) => [x, TWINS[x.field] ? diffOf(TWINS[x.field]) : null].filter((y) => y && y.updatable).map((y) => y.field);
//   const extra = (row.diffs || []).filter((x) => !COMPARE.some(([f, , via]) => (via || f) === x.field)
//     && !(TWIN_OF.has(x.field) && COMPARE.some(([f]) => TWINS[f] === x.field)));
//   const tick = (x) => (x.updatable && !editable ? <span className="text-inkmuted">{row.status === 'locked' ? 'sold / moved - cannot be changed' : '-'}</span> : x.updatable ? (
//     <label className="flex items-center gap-1">
//       <input type="checkbox" checked={withTwin(x).every((f) => picked.has(f))} onChange={() => onToggle(withTwin(x))} disabled={busy} aria-label={`${x.kind === 'fill' ? 'Fill' : x.kind === 'append' ? 'Add' : 'Replace'} ${x.label} of ${row.barcode}`} />
//       <span className={x.kind === 'replace' ? 'font-semibold text-[#8a5a00]' : 'text-okgreen'}>{x.kind === 'fill' ? 'Fill (blank here)' : x.kind === 'append' ? 'Add' : 'Replace'}</span>
//     </label>
//   ) : <span className="text-inkmuted">not changed by an import</span>);
//   return (
//     <div className="space-y-3 text-[12.5px]" aria-label={`Details of ${row.barcode}`}>
//       {row.identity?.state === 'different' && (
//         <div className="rounded border border-[#f1b0b0] bg-[#fdecec] px-3 py-2 text-danger" role="alert">
//           <span className="font-semibold">Different goods:</span> {row.identity.reasons.join('; ')}. This number is used here for other goods -
//           replacing would only take the imported prices and details onto this ERP&apos;s unit ({existing?.itemCode}); its item, quantity and UOM stay.
//         </div>
//       )}
//       {row.oldOnly && <div className="text-[#8a5a00]">This number matched the unit&apos;s OLD barcode only - check it is the same piece before replacing anything.</div>}
//       {existing ? (
//         <table className="w-full border-collapse" aria-label={`Existing and imported data of ${row.barcode}`}>
//           <thead>
//             <tr className="bg-[#f7f9fc] text-left">
//               <th className="border border-line px-2 py-1.5">Field</th>
//               <th className="border border-line px-2 py-1.5">EXISTING DATA (this ERP)</th>
//               <th className="border border-line px-2 py-1.5">IMPORTED DATA</th>
//               <th className="border border-line px-2 py-1.5">Action</th>
//             </tr>
//           </thead>
//           <tbody>
//             {COMPARE.map(([field, label, via]) => {
//               /* the value's own difference, or - when only its twin differs - the twin's */
//               const x = diffOf(via || field) || (TWINS[field] ? diffOf(TWINS[field]) : null);
//               const a = existing[field];
//               const b = incoming[field];
//               if (!txt(a) && !txt(b)) return null;
//               return (
//                 <tr key={field} className={x?.updatable ? 'bg-[#fffbf0]' : ''}>
//                   <td className="border border-line px-2 py-1">{label}</td>
//                   <td className="border border-line px-2 py-1">{txt(a) || '—'}</td>
//                   <td className="border border-line px-2 py-1 font-semibold">{txt(b) || '—'}</td>
//                   <td className="border border-line px-2 py-1">{x ? tick(x) : sameText(a, b) ? <span className="text-inkmuted">No change</span> : <span className="text-inkmuted">—</span>}</td>
//                 </tr>
//               );
//             })}
//             {extra.map((x) => (
//               <tr key={x.field} className={x.updatable ? 'bg-[#fffbf0]' : ''}>
//                 <td className="border border-line px-2 py-1">{x.label}</td>
//                 <td className="border border-line px-2 py-1">{x.local || '—'}</td>
//                 <td className="border border-line px-2 py-1 font-semibold">{x.incoming || '—'}</td>
//                 <td className="border border-line px-2 py-1">{tick(x)}</td>
//               </tr>
//             ))}
//           </tbody>
//         </table>
//       ) : (
//         <div className="grid gap-3 sm:grid-cols-3">
//           <div>
//             <div className="font-semibold">ITEM DETAILS</div>
//             <div>Item Code: {row.values.itemCode || '—'} <span className="text-inkmuted">({SOURCE_WORDS[row.sources?.itemCode] || 'as given'})</span></div>
//             <div>UOM: {row.values.uom || '—'} <span className="text-inkmuted">({SOURCE_WORDS[row.sources?.uom] || 'as given'})</span></div>
//             <div>Quantity: {row.values.qty || '—'} <span className="text-inkmuted">({SOURCE_WORDS[row.sources?.qty] || 'as given'})</span></div>
//             <div>Retail Price: {row.values.retailPrice || '—'} · WSP {row.values.wspPrice || '—'} · DP {row.values.dpPrice || '—'}</div>
//             <div>Purchase Rate: {row.values.purRate || '—'} · Final Rate {row.values.finalNet || '—'} · HSN {row.values.hsn || '—'} · GST {row.values.gst ? row.values.gst + '%' : '—'}</div>
//           </div>
//           {row.details ? (
//             <div>
//               <div className="font-semibold">STOCK</div>
//               <div>Receipts: {totals?.receipts ?? '—'} · Issues: {totals?.issues ?? '—'} · Balance: {totals?.balance ?? '—'}</div>
//               <div>{held ? `in stock: ${held.qty}` : 'no stock left - kept as history'}</div>
//             </div>
//           ) : null}
//         </div>
//       )}
//       {existing && row.details ? (
//         <div className="text-inkmuted">
//           Imported stock: {plural((d.movements || []).length, 'movement row')} · receipts {totals?.receipts ?? '—'} · issues {totals?.issues ?? '—'} · balance {totals?.balance ?? '—'} - the unit here stays where this ERP&apos;s stock says it is.
//         </div>
//       ) : null}
//     </div>
//   );
// }

// /* A report table's lines that were not barcode rows, and why - shown
//    folded, never a list of every field of a page. */
// function LeftOut({ read }) {
//   const left = read?.left || [];
//   if (!left.length) return null;
//   return (
//     <details className="mt-3 rounded border border-line bg-[#f7f9fc] px-3 py-2 text-[12.5px]">
//       <summary className="cursor-pointer font-semibold text-ink">{plural(left.length, 'line')} under the headings not read as a barcode row</summary>
//       <ul className="ml-4 mt-1 list-disc">
//         {left.slice(0, 50).map((l) => <li key={l.line}><span className="font-mono">{l.text}</span> - {l.reason} (line {l.line})</li>)}
//       </ul>
//     </details>
//   );
// }

// /* The masters found and not found (never created), and what the reader or
//    the server noticed - GST Parse's "Also returned" / "Ignored columns". */
// function MastersNote({ review, read }) {
//   const notes = [...(read?.warnings || []), ...(review.warnings || [])];
//   if (!review.mastersMatched && !review.unmatched?.length && !notes.length) return null;
//   return (
//     <div className="mb-3 rounded border border-line bg-[#f7f9fc] px-3 py-2 text-[12.5px]">
//       {review.mastersMatched > 0 && <div>Masters found: {review.mastersMatched}</div>}
//       {review.unmatched?.length > 0 && (
//         <div className="text-[#8a5a00]">
//           Not found - kept as text on the barcode: {review.unmatched.map((u) => `${u.type} "${u.name}"`).join(', ')}
//         </div>
//       )}
//       {notes.map((n) => <div key={n} className="text-inkmuted">{n}</div>)}
//     </div>
//   );
// }

// /* What OCR made of the screenshots: how sure it was, and the text it read -
//    to compare with the image, and to correct as text. `records` - a report
//    table's rows. */
// function OcrPanel({ ocr, records = null, flagged = 0, totals = false, onEdit, busy = false }) {
//   if (!ocr) return null;
//   const poor = ocr.confidence < POOR_CONFIDENCE;
//   return (
//     <div className="mt-3 rounded border border-line bg-[#f7f9fc] px-3 py-2 text-[12.5px]" aria-label="Image reading">
//       <div className="flex flex-wrap gap-x-4 gap-y-1">
//         <span className="text-okgreen">✓ Image read</span>
//         <span className="text-okgreen">✓ OCR completed ({ocr.confidence}% sure)</span>
//         {records !== null && <span className="font-semibold text-ink">Records found: {records}</span>}
//       </div>
//       {flagged > 0 && <div className="mt-1 text-[#8a5a00]">{OCR_MESSAGES.review} {plural(flagged, 'barcode')} could not be read with confidence - see the rows below.</div>}
//       {totals && <div className="mt-1 text-[#8a5a00]">The rows do not add up to the image&apos;s TOTAL row - a number was misread, or the screenshot shows only part of the report; see the rows below.</div>}
//       {poor && <div className="mt-1 text-[#8a5a00]">{OCR_MESSAGES.poor}</div>}
//       <details className="mt-1">
//         <summary className="cursor-pointer text-brand-link">View Extracted Text</summary>
//         <pre className="mt-1 max-h-[220px] overflow-auto whitespace-pre-wrap rounded border border-line bg-white p-2 font-mono text-[11.5px] leading-[1.45]">{ocr.text}</pre>
//         {onEdit && (
//           <button type="button" className="btn mt-1" onClick={onEdit} disabled={busy}>
//             <Icon name="pencil" size={14} /> Edit as text
//           </button>
//         )}
//       </details>
//     </div>
//   );
// }





















'use client';
import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import Icon from './Icon';
import { useScope } from './ScopeContext';
import { useOptions } from './useOptions';
import ErpSelectorModal from './ErpSelectorModal';
import { readImport, editRecord, EDIT_FIELDS, FIELD_LABELS, REQUIRED, movementTotals } from '@/lib/barcodeReportImport';
import { imagePlan } from '@/lib/barcodeImage';
import { BarcodeImageInput, BarcodeImageThumb, uploadBarcodeImage } from './BarcodeImagePicker';
import {
  imageProblem, ocrImages, reviewOcrRecords, IMAGE_MAX_COUNT, OCR_MESSAGES, POOR_CONFIDENCE, BARCODE_MIN_CONFIDENCE,
} from '@/lib/barcodeReportOcr';

/* what the image picker offers - lib/barcodeReportOcr.js checks every file
   again, pasted or dropped, before it is read */
const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp';

/* Reports -> Barcode Report -> IMPORT: SEED this ERP with barcodes that
   exist in the other ERP.

   Built the way Supplier -> Import from GST works (SupplierImportPanel.jsx):
   the operator opens the other ERP's Barcode Report themselves (the square
   button in the dialog's header), copies the report table or one barcode's
   Details page - or saves its Excel export, or takes a screenshot - and
   brings it here. Nothing is fetched from that site and no login to it is
   stored; everything is read in this browser (lib/barcodeReportImport.js).

   The flow (user, 2026-09-30):
     PASTE / UPLOAD     nothing is read yet
     ASK                "Is this a Barcode Report / Barcode Details?" - only
                        a Yes reads it (OCR for an image), and only as one
     PARSE              the Barcode Report reader: a report TABLE row by row,
                        a DETAILS page section by section - "could not be
                        parsed" (and why) when it is not one
     STRUCTURED PREVIEW a Details page as the Barcode Details screen shows
                        it - item, price and supplier info, the movements,
                        the stock - every value correctable, a screenshot
                        beside it; BARCODE IDENTIFICATION says where the
                        barcode came from (explicit, printed, the Item Code)
     EXISTING CHECK     the server's word on each barcode: NEW (ready to
                        seed), or EXISTING - its saved data beside the
                        imported data, KEEP EXISTING DATA or REPLACE WITH
                        IMPORTED DATA (confirmed first)
     SEED               /api/reports/barcode-report/import, which checks
                        every row again inside its transaction
   Nothing is written before Seed / Import or Confirm Replace. Item,
   quantity, UOM and masters are never changed.

   `api` is ReportView's toolbar hook - searchFor(filters) runs the report. */

/* a report TABLE row's status */
const STATUS = {
  new: { label: 'READY TO IMPORT', tone: 'bg-okgreenbg text-okgreen' },
  changed: { label: 'EXISTING - CHANGES FOUND', tone: 'bg-[#fff4d6] text-[#8a5a00]' },
  same: { label: 'EXISTING - NO CHANGES', tone: 'bg-[#eef2f8] text-inkmuted' },
  locked: { label: 'EXISTING - SOLD / MOVED', tone: 'bg-[#eef2f8] text-inkmuted' },
  invalid: { label: 'ERROR', tone: 'bg-[#fdecec] text-danger' },
};
const ORDER = ['new', 'changed', 'same', 'locked', 'invalid'];
/* what became of each barcode (the server's `actions`) */
const ACTIONS = {
  seeded: { label: 'Seeded', tone: 'text-okgreen' },
  replaced: { label: 'Replaced existing barcode data', tone: 'text-[#8a5a00]' },
  filled: { label: 'Blank fields filled', tone: 'text-okgreen' },
  retained: { label: 'Existing data retained', tone: 'text-inkmuted' },
  skipped: { label: 'Skipped', tone: 'text-inkmuted' },
  error: { label: 'Error', tone: 'text-danger' },
};
/* where a value came from, in words (lib/barcodeReportImport.js) */
const SOURCE_WORDS = {
  column: 'Barcode column',
  label: 'printed as the barcode',
  standalone: 'printed on its own',
  typed: 'typed by you',
  import_column: 'report column',
  details_label: 'page label',
  details_receipt: 'first receipt of the movements',
  details_stock: 'stock the page shows',
  typed_barcode: 'typed by you',
  detected_barcode: 'detected on the page',
  item_code: 'the Item Code',
  edited: 'corrected by you',
  existing_barcode_lookup: 'this ERP (barcode lookup)',
  item_master: 'Item master',
};
/* BARCODE IDENTIFICATION's "Detected From" */
const DETECTED_FROM = {
  label: 'Explicit Barcode',
  typed: 'Typed by you',
  standalone: 'The barcode printed on the page',
  item_code: 'Item Code',
};
/* what the parser reads, shown while it does */
const PARSE_STEPS = ['Item Information', 'Price Information', 'Supplier Information', 'Stock Movements', 'Barcode'];
const FAIL_REASONS = ['Image is unclear', 'Required fields could not be detected', 'This is not a Barcode Report', 'Barcode/Item Code could not be identified'];
/* the fields EXISTING DATA and IMPORTED DATA are compared on, and the
   difference (diff field) each one is written through */
const COMPARE = [
  ['barcode', 'Barcode'], ['itemCode', 'Item Code'], ['description', 'Description'], ['uom', 'UOM'], ['qty', 'Quantity'],
  ['hsn', 'HSN'], ['gst', 'GST %'], ['purRate', 'Purchase Rate'], ['finalNet', 'Final Rate'], ['retailPrice', 'Retail Price (RSP)'],
  ['wspPrice', 'WSP'], ['dpPrice', 'DP'], ['supplier', 'Supplier', 'supplierId'], ['location', 'Location'], ['status', 'Stock'],
];
/* one value on the page, two fields on the barcode: a Details page's WSP is
   both its WSP price and its base WSP (and DP the same) - shown as one row,
   taken or kept together */
const TWINS = { wspPrice: 'wsp', dpPrice: 'dp' };
const TWIN_OF = new Set(Object.values(TWINS));
/* a Details page's sections, as the Barcode Details screen lays them out -
   [field, label, read-only] */
const ITEM_INFO = [
  ['itemCode', 'Item Code'], ['itemName', 'Item Name'], ['subGroup', 'Sub Group'], ['group', 'Group'], ['hsn', 'HSN'], ['gstSlab', 'GST Slab'],
  ['uom', 'Unit / UOM'], ['ecomId', 'ECom ID', true], ['consignment', 'Is Consignment', true], ['description', 'Supplier Description'],
  ['pma', 'P-M-F'], ['invoiceNo', 'Purchase Invoice'], ['grcNo', 'GRC No.'],
];
const PRICE_INFO = [['purRate', 'Purchase Rate'], ['discount', 'Discount'], ['finalNet', 'Final Rate'], ['retailPrice', 'RSP'], ['wspPrice', 'WSP'], ['dpPrice', 'DP']];
const SUPPLIER_INFO = [['supplier', 'Supplier'], ['taxRegion', 'Tax Region'], ['note', 'Note', true]];
/* a field's master, for "not found - kept as text" (masters are never created) */
const MASTER_OF = { itemName: 'Item', group: 'Group', subGroup: 'Sub Group', hsn: 'HSN', gstSlab: 'GST Slab', supplier: 'Supplier', stockLocation: 'Location', stockPoint: 'Stock Point' };
const DETAIL_FIELDS = new Set([...EDIT_FIELDS.filter((f) => f.details).map((f) => f.key), 'ecomId', 'consignment', 'note', 'pageItemCode']);

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const txt = (v) => String(v ?? '').trim();
const sameText = (a, b) => txt(a) === txt(b) || (txt(a) !== '' && txt(b) !== '' && Number.isFinite(Number(a)) && Number.isFinite(Number(b)) && Number(a) === Number(b));
const money = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? '—' : Number(v).toFixed(2));
const when = (v) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime())
    ? d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—';
};

/* the stock summary a Details record shows: its own summary's first row,
   else where its last movement left its balance */
function summaryOf(details) {
  const s = (details?.stock || [])[0];
  if (s) return { location: txt(s.location), stockPoint: txt(s.stockPoint), qty: s.qty };
  const last = (details?.movements || []).at(-1);
  return { location: txt(last?.location), stockPoint: txt(last?.stockPoint), qty: details?.totals?.computed?.balance ?? 0 };
}
/* one field of a record, as the preview shows it */
function fieldOf(record, key) {
  const d = record?.details || {};
  if (key === 'stockLocation') return summaryOf(d).location;
  if (key === 'stockPoint') return summaryOf(d).stockPoint;
  if (DETAIL_FIELDS.has(key)) return txt(d[key]);
  return txt(record?.values?.[key]);
}

function Modal({ title, onClose, children, size = 'md', headerAction }) {
  const width = size === 'xl' ? 'max-w-[1280px]' : size === 'lg' ? 'max-w-[1120px]' : size === 'sm' ? 'max-w-[460px]' : 'max-w-[760px]';
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
      <div className={'flex max-h-[calc(100vh-2rem)] w-full flex-col rounded-lg bg-white shadow-xl ' + width}>
        <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-3">
          <span className="text-[15px] font-bold uppercase tracking-wide">{title}</span>
          <div className="flex items-center gap-1">
            {headerAction}
            <button type="button" onClick={onClose} className="text-2xl leading-none text-inkmuted" aria-label="Close">×</button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

/* the first sheet of a workbook as rows of cells - an .xlsx, an .xls (the
   report's own export is an HTML table saved as .xls, which SheetJS reads)
   or a .csv. raw:false keeps a barcode such as 000123 as the text shown. */
function readWorkbook(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const wb = XLSX.read(reader.result, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        if (!sheet) throw new Error('That workbook has no sheets.');
        resolve(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }));
      } catch (e) {
        reject(new Error(e?.message ? 'Could not read that file: ' + e.message : 'Could not read that file.'));
      }
    };
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsArrayBuffer(file);
  });
}

/* a sheet's cell as a pasted cell: a line break inside it (Alt+Enter, or a
   <br> in the report's HTML export) is a space, and a cell that starts with
   a quote is quoted - so one row of the sheet stays one row */
const sheetCell = (value) => {
  const v = String(value ?? '').replace(/[\r\n\t]+/g, ' ');
  return v.startsWith('"') ? '"' + v.replace(/"/g, '""') + '"' : v;
};

/* what is sent for each record - never more than the server reads */
const recordsOf = (list) => (list || []).map(({ line, values, details, review, origin, sources, candidate }) => ({
  line, values, details, review, origin, sources, candidate,
}));

/* which differences of a CHANGED row are ticked when the preview opens:
   blanks it fills and history it adds (GST Parse's rule) - none when the
   pasted page looks like different goods, or when the number matched only
   the unit's old barcode (the operator decides those) */
const defaultPicks = (row) => {
  if (row.status !== 'changed' || row.identity?.state === 'different' || row.oldOnly) return new Set();
  return new Set((row.diffs || []).filter((d) => d.updatable && (d.kind === 'fill' || d.kind === 'append')).map((d) => d.field));
};

export default function BarcodeReportImport({ api }) {
  const { business, location: scopeLocation, finYear } = useScope();
  const { options: locations } = useOptions('companylocations');
  const [open, setOpen] = useState(false);
  /* the search button's ERP picker (ERP V0 / ERP V1), over this dialog */
  const [pickingErp, setPickingErp] = useState(false);
  /* 'input' | 'ask' (text or a file: what is it?) | 'parsing' | 'failed' | 'review' | 'done' */
  const [step, setStep] = useState('input');
  const [mode, setMode] = useState('paste');      // 'paste' | 'image'
  const [asking, setAsking] = useState('');       // what 'ask' is about: 'text' | 'file'
  const [paste, setPaste] = useState('');
  /* where the text in the box came from: 'text' (pasted / typed) or 'ocr' -
     an image's text put there by Edit as text, which keeps the image's rules */
  const [textOrigin, setTextOrigin] = useState('text');
  const [file, setFile] = useState(null);         // an Excel file waiting for its answer
  const [fileName, setFileName] = useState('');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [failure, setFailure] = useState(null);   // { message, notReport, image, poor }
  const [read, setRead] = useState(null);         // what the browser read
  const [review, setReview] = useState(null);     // what the server says each row becomes
  const [ticked, setTicked] = useState(new Set());               // NEW rows to seed
  const [picks, setPicks] = useState(new Map());                 // CHANGED rows: key -> Set of fields to write
  const [decided, setDecided] = useState(new Map());             // key -> 'keep' | 'replace' | 'custom'
  const [open2, setOpen2] = useState(new Set());                 // table rows whose detail is open
  const [confirming, setConfirming] = useState(false);           // "Replace existing data?"
  /* corrections typed in the preview: line -> { field: value } - checked
     against this ERP again before anything is imported */
  const [edits, setEdits] = useState(new Map());
  /* stock movement edits: line -> movementIndex -> { field: value } */
  const [movementEdits, setMovementEdits] = useState(new Map());
  /* an image import: the operator's word that they compared the values with
     the image - OCR can be sure of a wrong character */
  const [compared, setCompared] = useState(false);
  const [result, setResult] = useState(null);
  /* BARCODE IMAGES attached in the preview - the picture of a barcode, to be
     STORED on it (never read by OCR - that is `images` below). By record line,
     so a card keeps its picture through corrections and re-checks; saved on
     Import against that card's barcode (lib/barcodeImage.js). line -> { file,
     url (a local preview), name, size, decision: 'keep' | 'replace' | '',
     uploaded: { url, name } once uploaded } */
  const [barcodeImages, setBarcodeImages] = useState(new Map());
  /* screenshots pasted, dropped or chosen: [{ id, file, url, name, size }] */
  const [images, setImages] = useState([]);
  const [ocr, setOcr] = useState(null);           // what OCR read from them
  const [stage, setStage] = useState('');         // "Reading image..." while busy
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);
  const imageRef = useRef(null);
  /* quantity adjustments for the current barcode in preview */
  const [qtyDecrease, setQtyDecrease] = useState(0);
  const [qtyIncrease, setQtyIncrease] = useState(0);
  /* validation modal for missing required fields */
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [missingFields, setMissingFields] = useState([]);

  const target = location || scopeLocation || '';

  function dropImages(list = images) {
    list.forEach((img) => URL.revokeObjectURL(img.url));
    setImages([]);
    setOcr(null);
  }

  /* the barcode images - attached, changed, removed, decided - none of it
     touches the database until Import */
  const clearBarcodeImages = () => setBarcodeImages((map) => {
    map.forEach((img) => URL.revokeObjectURL(img.url));
    return new Map();
  });
  const attachBarcodeImage = (line, file) => setBarcodeImages((map) => {
    const next = new Map(map);
    if (next.get(line)?.url) URL.revokeObjectURL(next.get(line).url);
    next.set(line, { file, url: URL.createObjectURL(file), name: file.name || 'barcode-image', size: file.size, decision: '', uploaded: null });
    return next;
  });
  const removeBarcodeImage = (line) => setBarcodeImages((map) => {
    const next = new Map(map);
    if (next.get(line)?.url) URL.revokeObjectURL(next.get(line).url);
    next.delete(line);
    return next;
  });
  const decideBarcodeImage = (line, decision) => setBarcodeImages((map) => (
    map.has(line) ? new Map(map).set(line, { ...map.get(line), decision }) : map
  ));

  function start() {
    setOpen(true); setPickingErp(false); setStep('input'); setMode('paste'); setAsking(''); setPaste(''); setTextOrigin('text');
    setFile(null); setFileName(''); setError(''); setFailure(null);
    setRead(null); setReview(null); setResult(null); setTicked(new Set()); setPicks(new Map()); setDecided(new Map());
    setOpen2(new Set()); setConfirming(false); setEdits(new Map()); setMovementEdits(new Map()); setCompared(false);
    setLocation(scopeLocation || '');
    dropImages(); setStage(''); clearBarcodeImages();
    setQtyDecrease(0); setQtyIncrease(0); setShowValidationModal(false); setMissingFields([]);
  }

  /* images in: each checked (type, extension, size) before it is kept - and
     NOT read: the ask comes first */
  function addImages(files) {
    if (busy) return;
    const list = [...(files || [])];
    if (!list.length) return;
    const bad = list.map(imageProblem).find(Boolean);
    if (bad) { setMode('image'); setError(bad); return; }
    if (images.length + list.length > IMAGE_MAX_COUNT) { setMode('image'); setError(`At most ${IMAGE_MAX_COUNT} images can be read at a time.`); return; }
    const added = list.map((f, i) => ({
      id: `${Date.now()}-${i}`, file: f, url: URL.createObjectURL(f), name: f.name || `Pasted image ${images.length + i + 1}`, size: f.size,
    }));
    setImages([...images, ...added]);
    setOcr(null);
    setMode('image');
    setError('');
  }

  function removeImage(id) {
    if (busy) return;
    const gone = images.find((img) => img.id === id);
    if (gone) URL.revokeObjectURL(gone.url);
    setImages((current) => current.filter((img) => img.id !== id));
    setOcr(null);
    setError('');
  }

  /* Ctrl+V: a screenshot on the clipboard becomes an image here; text is
     pasted into the box as it always was - and a clipboard holding both
     (cells copied from Excel carry a picture of themselves) pastes its
     TEXT into the box */
  function onPaste(event) {
    const files = [...(event.clipboardData?.files || [])].filter((f) => /^image\//.test(f.type));
    const text = event.clipboardData?.getData('text') || '';
    if (files.length) {
      if (text.trim() && event.target?.tagName === 'TEXTAREA') return;
      event.preventDefault();
      addImages(files);
      return;
    }
    /* text pasted while on Upload Image: it is a paste */
    if (mode === 'image' && text.trim() && event.target?.tagName !== 'TEXTAREA') {
      event.preventDefault();
      setMode('paste');
      setPaste((current) => (current.trim() ? current : text));
      setTextOrigin('text');
      setError('');
    }
  }

  function onDrop(event) {
    event.preventDefault();
    setDragging(false);
    if (busy) return;
    const files = [...(event.dataTransfer?.files || [])];
    if (!files.length) return;
    if (files.some((f) => !/^image\//.test(f.type))) {
      setError('Only PNG, JPG or WEBP images can be dropped here - use Choose Excel file for a workbook.');
      return;
    }
    addImages(files);
  }

  function pickImages(event) {
    const files = [...(event.target.files || [])];
    event.target.value = '';
    addImages(files);
  }

  /* an Excel file: asked about first, read only on Yes */
  function pickFile(event) {
    const f = event.target.files?.[0];
    event.target.value = '';
    if (!f) return;
    if (!target) { setError('Choose the Business Location the barcodes go into.'); return; }
    setFile(f);
    setAsking('file');
    setError('');
    setStep('ask');
  }

  /* the extracted text into the text box, to correct and parse as text -
     still under an image's rules (textOrigin 'ocr'), with the image kept
     beside the preview to compare with */
  function editExtracted() {
    if (busy) return;
    const text = ocr?.text ?? read?.ocr?.text;
    if (text === undefined) return;
    setPaste(text);
    setTextOrigin('ocr');
    setMode('paste');
    setStep('input');
    setFailure(null);
    setError('');
  }
  const close = () => { if (!busy) { setOpen(false); setPickingErp(false); } };
  const locationName = () => locations.find((o) => String(o.value) === String(target))?.label || '';

  async function post(payload) {
    const r = await fetch('/api/reports/barcode-report/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business, location: target, finYear, ...payload }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'The server could not do that.');
    return d;
  }

  /* PASTE -> "Continue": the ask, nothing read yet */
  function continueText() {
    if (!paste.trim()) { setError(OCR_MESSAGES.noText + ' Paste the Barcode Report data first.'); return; }
    if (!target) { setError('Choose the Business Location the barcodes go into.'); return; }
    setAsking('text');
    setError('');
    setStep('ask');
  }

  /* the answer - "Yes, Parse Barcode Report" - and only then the parser */
  function parseConfirmed(kind) {
    if (!target) { setError('Choose the Business Location the barcodes go into.'); return; }
    setError('');
    if (kind === 'image') parseImages();
    else if (kind === 'file') parseFile();
    else parseText();
  }

  /* BARCODE REPORT COULD NOT BE PARSED - and nothing saved */
  function fail(message, extra = {}) {
    setFailure({ message, ...extra });
    setBusy(false);
    setStage('');
    setStep('failed');
  }

  /* the choices a fresh preview opens with */
  function openReview(table, d) {
    setRead(table);
    setReview(d);
    setTicked(new Set(d.rows.filter((r) => r.status === 'new').map((r) => r.key)));
    setPicks(new Map(d.rows.filter((r) => r.status === 'changed').map((r) => [r.key, defaultPicks(r)])));
    setDecided(new Map());
    setEdits(new Map());
    setMovementEdits(new Map());
    const rows = d.rows.filter((r) => r.status in STATUS);
    setOpen2(new Set(rows.length <= 3 ? rows.map((r) => r.key) : []));
    setConfirming(false);
    setStep('review');
    setQtyDecrease(0);
    setQtyIncrease(0);
    setShowValidationModal(false);
    setMissingFields([]);
  }

  /* what was read -> the server's verdict on every row (reads only) */
  async function check(table, { keepCompared = false } = {}) {
    if (!table.records.length) {
      const why = (table.left || []).slice(0, 3).map((l) => `line ${l.line}: ${l.reason}`).join('; ');
      fail('No barcode rows were found under the report\'s headings.' + (why ? ` Left out - ${why}.` : ''), { image: table.origin === 'image' });
      return;
    }
    setBusy(true); setStage('Checking this ERP for the barcode...'); setError('');
    try {
      const d = await post({ mode: 'check', records: recordsOf(table.records) });
      openReview(table, d);
      if (!keepCompared) setCompared(false);
    } catch (e) {
      /* the server said no (the location, a permission): back where it can be put right */
      setError(e.message);
      setStep(step === 'review' ? 'review' : 'input');
    } finally {
      setBusy(false);
      setStage('');
    }
  }

  function parseText() {
    setStep('parsing'); setBusy(true); setStage('Parsing Barcode Report...'); setFileName(''); clearBarcodeImages();
    /* text an image gave keeps the image's rules, however it got here */
    const origin = textOrigin === 'ocr' || (ocr?.text && paste.trim() === ocr.text.trim()) ? 'ocr' : 'text';
    const table = readImport(paste, { origin });
    if (table.error) { fail(table.error, { notReport: table.notReport }); return; }
    const records = origin === 'ocr' ? reviewOcrRecords(table.records, { text: paste, lines: [] }) : table.records;
    check({ ...table, records, ocr: origin === 'ocr' ? ocr : null });
  }

  async function parseFile() {
    if (!file) return;
    setStep('parsing'); setBusy(true); setStage('Reading the file...'); clearBarcodeImages();
    try {
      const matrix = await readWorkbook(file);
      setFileName(file.name);
      setStage('Parsing Barcode Report...');
      /* the sheet's rows as the lines a paste would give - one reader for
         both, so a report table and an exported Details page both work */
      const table = readImport(matrix.map((row) => row.map(sheetCell).join('\t')).join('\n'));
      if (table.error) { fail(table.error, { notReport: table.notReport }); return; }
      await check(table);
    } catch (e) {
      fail(e.message);
    }
  }

  /* IMAGE -> OCR -> TEXT, each image on its own, and from there the very
     reader a paste goes through. OCR runs only here - after the Yes. */
  async function parseImages() {
    if (!images.length) return;
    setStep('parsing'); setBusy(true); setError(''); setFileName(''); setStage('Reading image...'); clearBarcodeImages();
    let ocrRead;
    try {
      ocrRead = await ocrImages(images.map((img) => img.file), { onStage: setStage });
    } catch (e) {
      console.error('Barcode Report image OCR failed', e);
      setOcr(null);
      fail(OCR_MESSAGES.failed, { image: true });
      return;
    }
    setOcr(ocrRead);
    const poor = ocrRead.confidence < POOR_CONFIDENCE;
    if (!ocrRead.words || !ocrRead.text.trim()) { fail(OCR_MESSAGES.noReadable, { image: true, poor, ocr: ocrRead }); return; }
    setStage('Extracting Barcode Report...');
    const pages = (ocrRead.pages || [{ name: 'image', text: ocrRead.text, lines: ocrRead.lines }]).map((page) => ({
      page, read: readImport(page.text, { origin: 'image', lines: page.lines, minConfidence: BARCODE_MIN_CONFIDENCE }),
    })).filter((p) => p.page.text.trim());
    const named = (p, message) => (pages.length > 1 ? `${p.page.name}: ` : '') + message;
    const notOne = pages.find((p) => p.read.notReport);
    if (notOne) { fail(named(notOne, OCR_MESSAGES.notReport), { image: true, notReport: true, poor, ocr: ocrRead }); return; }
    const broken = pages.find((p) => p.read.error);
    if (broken) { fail(named(broken, broken.read.error), { image: true, poor, ocr: ocrRead }); return; }
    if (new Set(pages.map((p) => p.read.kind)).size > 1) { fail(OCR_MESSAGES.mixed, { image: true, ocr: ocrRead }); return; }
    /* each image's rows, checked against its own TOTAL row / totals and
       OCR's confidence in its barcode - a flag only ever holds a row back */
    setStage('Validating records...');
    let line = 0;
    const records = pages.flatMap(({ page, read: r }) => reviewOcrRecords(r.records, { text: page.text, lines: page.lines })
      .map((rec) => ({ ...rec, line: ++line })));
    const first = pages[0].read;
    await check({
      ...first, records,
      unmapped: [...new Set(pages.flatMap((p) => p.read.unmapped || []))],
      ignored: pages.reduce((a, p) => a + (p.read.ignored || 0), 0),
      left: pages.flatMap((p) => p.read.left || []),
      warnings: pages.flatMap((p) => (p.read.warnings || []).map((w) => named(p, w))),
      ocr: ocrRead,
    });
  }

  /* the corrections checked against this ERP again */
  function recheck() {
    if (!read) return;
    const records = read.records.map((r) => {
      const withEdits = editRecord(r, edits.get(r.line));
      const movEdits = movementEdits.get(r.line);
      if (!movEdits || !withEdits?.details?.movements) return withEdits;
      const movements = withEdits.details.movements.map((m, i) => {
        const overrides = movEdits[i];
        if (!overrides) return m;
        const merged = { ...m };
        Object.entries(overrides).forEach(([field, val]) => { merged[field] = val; });
        /* recalculate balance and netAmount using existing formula */
        merged.receipts = Math.abs(Number(merged.receipts) || 0);
        merged.issues = Math.abs(Number(merged.issues) || 0);
        merged.balance = Math.round((merged.receipts - merged.issues) * 1000) / 1000;
        merged.finalPrice = Number(merged.finalPrice) || 0;
        merged.netAmount = Math.round(Math.max(merged.receipts, merged.issues) * merged.finalPrice * 100) / 100;
        merged.signedQty = Math.round((merged.receipts - merged.issues) * 1000) / 1000;
        return merged;
      });
      const totals = movementTotals(movements, withEdits.details.totals?.printed);
      return { ...withEdits, details: { ...withEdits.details, movements, totals } };
    });
    check({ ...read, records }, { keepCompared: true });
  }
  const setEdit = (line, key, value, original, force = false) => setEdits((map) => {
    const next = new Map(map);
    const row = { ...(next.get(line) || {}) };
    if (!force && txt(value) === txt(original)) delete row[key]; else row[key] = value;
    if (Object.keys(row).length) next.set(line, row); else next.delete(line);
    return next;
  });
  /* set one field of one movement row for a given record line */
  const setMovementEdit = (line, movIndex, field, value) => setMovementEdits((map) => {
    const next = new Map(map);
    const lineEdits = { ...(next.get(line) || {}) };
    lineEdits[movIndex] = { ...(lineEdits[movIndex] || {}), [field]: value };
    next.set(line, lineEdits);
    return next;
  });
  /* get effective movements for a record line (originals merged with edits) */
  const effectiveMovements = (rec) => {
    const orig = rec?.details?.movements || [];
    const movEdits = movementEdits.get(rec?.line);
    if (!movEdits) return orig;
    return orig.map((m, i) => {
      const overrides = movEdits[i];
      if (!overrides) return m;
      const merged = { ...m };
      Object.entries(overrides).forEach(([field, val]) => { merged[field] = val; });
      merged.receipts = Math.abs(Number(merged.receipts) || 0);
      merged.issues = Math.abs(Number(merged.issues) || 0);
      merged.balance = Math.round((merged.receipts - merged.issues) * 1000) / 1000;
      merged.finalPrice = Number(merged.finalPrice) || 0;
      merged.netAmount = Math.round(Math.max(merged.receipts, merged.issues) * merged.finalPrice * 100) / 100;
      merged.signedQty = Math.round((merged.receipts - merged.issues) * 1000) / 1000;
      return merged;
    });
  };
  const dirty = [...edits.values()].some((e) => Object.keys(e).length);
  const editCount = [...edits.values()].reduce((a, e) => a + Object.keys(e).length, 0);

  const rows = review?.rows || [];
  const fromImage = read?.origin === 'image' || read?.origin === 'ocr';
  const isDetails = read?.kind === 'details';
  const importRows = rows.filter((r) => r.status in STATUS);
  const changedRows = importRows.filter((r) => r.status === 'changed' && r.updatable);
  const pickedOf = (r) => picks.get(r.key) || new Set();
  const replacesOf = (r) => (r.diffs || []).filter((d) => d.updatable && d.kind === 'replace' && pickedOf(r).has(d.field));
  const adding = importRows.filter((r) => r.status === 'new' && ticked.has(r.key)).length;
  const replacing = changedRows.filter((r) => replacesOf(r).length).length;
  const filling = changedRows.filter((r) => pickedOf(r).size && !replacesOf(r).length).length;
  const needsDecision = changedRows.filter((r) => r.replaces && !decided.has(r.key) && !replacesOf(r).length);
  /* what Import does with each row's barcode image - on its own, whatever is
     decided for its data (lib/barcodeImage.js imagePlan): 'none' | 'save' |
     'replace' | 'keep' | 'blocked', or 'skipped' for a new row left unticked */
  const imagePlanOf = (r) => {
    const image = barcodeImages.get(r.line);
    if (!image) return 'none';
    if (r.status === 'new' && !ticked.has(r.key)) return 'skipped';
    return imagePlan({ status: r.status, existing: r.existing?.imageUrl, pending: true, decision: image.decision });
  };
  const imageSaves = importRows.filter((r) => ['save', 'replace'].includes(imagePlanOf(r)));
  const imageReplaces = imageSaves.filter((r) => imagePlanOf(r) === 'replace');

  const toggleNew = (key) => setTicked((set) => { const next = new Set(set); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const setRowPicks = (r, fields, how) => {
    setPicks((map) => new Map(map).set(r.key, new Set(fields)));
    if (how) setDecided((map) => new Map(map).set(r.key, how));
  };
  /* KEEP EXISTING DATA: nothing saved is overwritten - only the blanks it
     fills (GST Parse's rule), and not even those for different goods */
  const keepRow = (r) => setRowPicks(r, defaultPicks(r), 'keep');
  /* REPLACE: every difference an import may write (never item / qty / UOM) */
  const replaceRow = (r) => setRowPicks(r, (r.diffs || []).filter((d) => d.updatable).map((d) => d.field), 'replace');
  /* REPLACE WITH IMPORTED DATA on a Details page: taken, then confirmed */
  const replaceAndConfirm = (r) => { replaceRow(r); setError(''); setConfirming(true); };
  /* one tick, one or more fields (a value and its twin) - all taken or none */
  const toggleField = (r, fields) => {
    const list = [].concat(fields);
    const next = new Set(pickedOf(r));
    const all = list.every((f) => next.has(f));
    list.forEach((f) => (all ? next.delete(f) : next.add(f)));
    setRowPicks(r, next, 'custom');
  };
  const toggleOpen = (key) => setOpen2((set) => { const next = new Set(set); if (next.has(key)) next.delete(key); else next.add(key); return next; });

  function askImport() {
    if (dirty) { recheck(); return; }
    if (replacing) { setConfirming(true); return; }
    /* Validate required fields before import */
    const missing = [];
    const firstRow = review?.rows?.[0];
    if (firstRow) {
      const rec = read?.records?.find((x) => x.line === firstRow.line) || { values: firstRow.values };
      REQUIRED.forEach((key) => {
        const value = rec.values?.[key];
        if (value === null || value === undefined || String(value).trim() === '') {
          missing.push(FIELD_LABELS[key] || key);
        }
      });
    }
    if (missing.length > 0) {
      setMissingFields(missing);
      setShowValidationModal(true);
      return;
    }
    runImport();
  }

  async function runImport() {
    if (dirty) return;
    if (fromImage && !compared) { setError('Tick "I have compared the values with the image" first.'); return; }
    setConfirming(false);
    setBusy(true); setError('');
    try {
      /* THE BARCODE IMAGES FIRST - each through the app's own upload flow
         (compressed, POST /api/upload). One that fails stops everything:
         nothing is imported as if it had worked, and no URL is saved. A
         picture already uploaded (a retry) is not sent again. */
      const imagesPayload = [];
      for (const r of imageSaves) {
        const image = barcodeImages.get(r.line);
        let uploaded = image.uploaded;
        if (!uploaded) {
          setStage(`Uploading the barcode image of ${r.barcode}...`);
          uploaded = await uploadBarcodeImage(image.file);
          const done = uploaded;
          setBarcodeImages((map) => (map.has(r.line) ? new Map(map).set(r.line, { ...map.get(r.line), uploaded: done }) : map));
        }
        imagesPayload.push({
          barcode: r.barcode,
          unitId: r.unitId || '',
          url: uploaded.url,
          name: image.name || uploaded.name,
          /* the image the barcode had when it was shown - the server replaces
             it only while it still holds exactly this */
          seen: r.existing?.imageUrl ?? '',
          replace: imagePlanOf(r) === 'replace',
        });
      }
      setStage(imagesPayload.length ? 'Importing...' : '');
      /* Apply quantity adjustments and movement edits to the records */
      const adjustedRecords = recordsOf(read?.records).map((rec) => {
        let out = rec;
        /* qty adjustments */
        if (isDetails && out.values) {
          const currentQty = Number(out.values.qty) || 0;
          const finalQty = Math.max(0, currentQty - qtyDecrease + qtyIncrease);
          out = { ...out, values: { ...out.values, qty: String(finalQty) } };
        }
        /* movement edits */
        const movEdits = movementEdits.get(rec.line);
        if (movEdits && out.details?.movements) {
          const movements = out.details.movements.map((m, i) => {
            const overrides = movEdits[i];
            if (!overrides) return m;
            const merged = { ...m };
            Object.entries(overrides).forEach(([field, val]) => { merged[field] = val; });
            merged.receipts = Math.abs(Number(merged.receipts) || 0);
            merged.issues = Math.abs(Number(merged.issues) || 0);
            merged.balance = Math.round((merged.receipts - merged.issues) * 1000) / 1000;
            merged.finalPrice = Number(merged.finalPrice) || 0;
            merged.netAmount = Math.round(Math.max(merged.receipts, merged.issues) * merged.finalPrice * 100) / 100;
            merged.signedQty = Math.round((merged.receipts - merged.issues) * 1000) / 1000;
            /* update docDate if edited as string back to Date */
            if (merged.docDate && typeof merged.docDate === 'string' && merged.docDate !== '') {
              const d = new Date(merged.docDate);
              if (!Number.isNaN(d.getTime())) merged.docDate = d;
            }
            return merged;
          });
          const totals = movementTotals(movements, out.details.totals?.printed);
          out = { ...out, details: { ...out.details, movements, totals } };
        }
        return out;
      });
      const d = await post({
        mode: 'import',
        records: adjustedRecords,
        /* each difference approved, with the saved value it was approved
           against - the server writes it only while that value is still there */
        update: changedRows.filter((r) => pickedOf(r).size).map((r) => ({
          barcode: r.barcode,
          unitId: r.unitId,
          fields: Object.fromEntries([...pickedOf(r)].map((field) => [field, (r.diffs || []).find((x) => x.field === field)?.local ?? ''])),
        })),
        skip: importRows.filter((r) => r.status === 'new' && !ticked.has(r.key)).map((r) => r.barcode),
        ...(imagesPayload.length ? { images: imagesPayload } : {}),
        ...(fromImage ? { compared } : {}),
      });
      setResult(d);
      setStep('done');
      /* show what came in: run the report again, or for the imported item */
      const codes = d.itemCodes || [];
      const current = String(api?.filters?.itemCode || '').trim().toLowerCase();
      const shows = api?.searched && current && codes.some((c) => String(c).toLowerCase().includes(current));
      /* by the item - a Barcode typed before would narrow it to that one */
      api?.searchFor(shows || !codes.length ? {} : { itemCode: codes[0], barcodeNo: '' });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      setStage('');
    }
  }

  const back = () => { setStep('input'); setError(''); setConfirming(false); setFailure(null); };
  /* TRY AGAIN: back to the input - a screenshot that could not be read is
     let go, so another can be given; text stays, to be corrected */
  const tryAgain = () => {
    if (failure?.image && textOrigin !== 'ocr') { dropImages(); setMode('image'); }
    back();
  };

  const sourceLink = (
    /* the shortcut to the source report - GST Parse's portal button: it asks
       which ERP's Barcode Report to open, ERP V0 or ERP V1, each an external
       page in a new tab (components/ErpSelectorModal.jsx); this dialog stays
       open for the paste */
    <button
      type="button"
      onClick={() => setPickingErp(true)}
      aria-haspopup="dialog"
      title="Open the Barcode Report on ERP V0 or ERP V1"
      aria-label="Open the Barcode Report on ERP V0 or ERP V1"
      className="flex h-8 w-8 items-center justify-center rounded-md bg-brand leading-none text-white hover:bg-brand-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
    >
      <Icon name="search" size={16} />
    </button>
  );

  const sourceText = fileName ? `Excel file (${fileName})`
    : read?.origin === 'image' ? `Uploaded Image${images.length ? ` (${images.map((i) => i.name).join(', ')})` : ''}`
      : read?.origin === 'ocr' ? 'Text read from an uploaded image (corrected)'
        : 'Paste Text';
  /* what Import will do - its data, and apart from it the barcode images */
  const willDo = [adding ? `Seed ${adding}` : '', replacing ? `Replace ${replacing}` : '', filling ? `Fill ${filling}` : '',
    imageSaves.length ? `Save ${plural(imageSaves.length, 'barcode image')}` : ''].filter(Boolean);
  const nothingToImport = willDo.length === 0;
  const primaryLabel = nothingToImport ? 'Nothing to import'
    : isDetails && adding && !replacing && !filling ? 'Seed / Import'
      : isDetails && !adding && !replacing && !filling ? 'Save Barcode Image'
        : willDo.join(', ');
  const comparedBox = fromImage && (
    <label className="my-2 flex items-start gap-2 rounded border border-[#e7c96b] bg-[#fff8e6] px-3 py-2 text-[12.5px] text-ink">
      <input type="checkbox" checked={compared} onChange={(e) => { setCompared(e.target.checked); setError(''); }} className="mt-0.5" aria-label="I have compared the values with the image" />
      <span>
        I have compared the values above with the image{read?.origin === 'ocr' ? ' they were read from' : ''} - the barcode above all. OCR can
        read a character wrongly and still be sure of it, so nothing read from an image is imported until you confirm this. Correct
        any value in its box first.
      </span>
    </label>
  );

  return (
    <>
      <button type="button" className="btn" onClick={start}>
        <Icon name="upload" size={14} /> Import
      </button>

      {open && step === 'input' && (
        <Modal title="Import Barcodes" onClose={close} headerAction={sourceLink}>
          <div
            className={'flex-1 overflow-y-auto p-5 ' + (dragging ? 'outline-dashed outline-2 -outline-offset-4 outline-brand' : '')}
            onPaste={onPaste}
            onDragOver={(e) => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); setDragging(true); } }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
            onDrop={onDrop}
          >
            <p className="mb-3 text-[13px] text-inkmuted">
              Open the Barcode Report on ERP V0 or ERP V1 (the search button above), then paste a barcode&apos;s Barcode Details page or the
              report table, or upload a screenshot of it. You are asked what it is before anything is read, and nothing is saved until
              you check the preview and press Seed / Import.
            </p>
            <label htmlFor="barcode-import-location" className="mb-1 block text-[13px] text-ink">Import into<span className="f-req">*</span></label>
            <select
              id="barcode-import-location"
              value={target}
              disabled={busy}
              onChange={(e) => { setLocation(e.target.value); setError(''); }}
              className="f-input mb-3 w-full"
            >
              <option value="">Choose a Business Location</option>
              {locations.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            <div className="mb-3 text-[12px] font-bold uppercase tracking-wide text-ink">Import / Seed</div>
            <div className="mb-3 flex gap-2" role="tablist" aria-label="What to import from">
              <button type="button" role="tab" aria-selected={mode === 'paste'} onClick={() => { setMode('paste'); setError(''); }}
                className={'btn ' + (mode === 'paste' ? 'btn-primary' : '')}>
                <Icon name="file" size={14} /> Paste Report
              </button>
              <button type="button" role="tab" aria-selected={mode === 'image'} onClick={() => { setMode('image'); setError(''); }}
                className={'btn ' + (mode === 'image' ? 'btn-primary' : '')}>
                <Icon name="image" size={14} /> Upload Image
              </button>
            </div>

            {mode === 'paste' ? (
              <>
                <label htmlFor="barcode-import-text" className="mb-1 block text-[13px] text-ink">Paste Barcode Report Data:</label>
                <textarea
                  id="barcode-import-text"
                  value={paste}
                  autoFocus
                  rows={12}
                  readOnly={busy}
                  placeholder="Paste one barcode's Barcode Details page, or the Barcode Report table, here..."
                  onChange={(e) => {
                    const next = e.target.value;
                    /* text replaced as a whole is the operator's own again */
                    if (!next.trim() || (textOrigin === 'ocr' && paste.trim() && !next.includes(paste.trim().slice(0, 40)) && next.length > 40)) setTextOrigin('text');
                    setPaste(next);
                    setError('');
                  }}
                  className="w-full resize-y rounded-md border border-linestrong p-2.5 font-mono text-[12.5px] leading-[1.5]"
                  aria-label="Barcode Report data"
                />
                {textOrigin === 'ocr' && paste.trim() && (
                  <p className="mt-1 text-[12px] text-[#8a5a00]">
                    This text was read from an image, and an image&apos;s rules stay with it: nothing from it is imported until you
                    confirm you compared the preview with the image.
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px] text-inkmuted">
                  <span>or</span>
                  <button type="button" className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>
                    <Icon name="file" size={14} /> Choose Excel file
                  </button>
                  <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={pickFile} className="hidden" aria-label="Barcode Report Excel file" />
                  <span>(the report&apos;s own export)</span>
                </div>
              </>
            ) : (
              <>
                <div className="rounded border border-dashed border-linestrong bg-[#f7f9fc] p-4 text-center text-[13px] text-inkmuted" aria-label="Upload Barcode Report image">
                  <div className="mb-2 font-semibold text-ink">UPLOAD BARCODE REPORT IMAGE</div>
                  Drop a screenshot here, paste it (Ctrl+V), or
                  <button type="button" className="btn ml-2" onClick={() => imageRef.current?.click()} disabled={busy}>
                    <Icon name="image" size={14} /> Choose Image
                  </button>
                  <input ref={imageRef} type="file" accept={IMAGE_ACCEPT} multiple onChange={pickImages} className="hidden" aria-label="Barcode Report image" />
                  <div className="mt-1 text-[11.5px]">PNG, JPG or WEBP, up to 10 MB each, {IMAGE_MAX_COUNT} at a time. Read in this browser - the image is never sent anywhere.</div>
                </div>
                {images.length > 0 && (
                  <>
                    <div className="mt-3 text-[12px] font-bold uppercase tracking-wide text-ink">Image Preview</div>
                    <div className="mt-1 flex flex-wrap gap-2" aria-label="Image preview">
                      {images.map((img) => (
                        <div key={img.id} className="relative w-[240px] rounded border border-line bg-white p-1">
                          <img src={img.url} alt={img.name} className="h-[150px] w-full rounded object-contain" />
                          <div className="mt-1 truncate text-[11px] text-inkmuted" title={img.name}>{img.name} · {(img.size / 1024).toFixed(0)} KB</div>
                          <button type="button" onClick={() => removeImage(img.id)} disabled={busy} aria-label={`Remove ${img.name}`}
                            className="absolute right-1 top-1 rounded bg-white/90 px-1.5 text-[13px] leading-5 text-inkmuted shadow hover:text-danger">×</button>
                        </div>
                      ))}
                    </div>
                    {/* THE ASK - before any OCR */}
                    <div className="mt-3 rounded border border-[#9fb7e0] bg-[#eef4ff] px-4 py-3" role="group" aria-label="What type of image is this?">
                      <div className="text-[13px] font-bold uppercase tracking-wide text-ink">What type of image is this?</div>
                      <p className="mt-1 text-[13px] text-ink">Is this a Barcode Report / Barcode Details screenshot?</p>
                      <p className="mt-1 text-[12px] text-inkmuted">It is read only once you say so - an image that is not a Barcode Report is never read as one.</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button type="button" className="btn btn-primary" onClick={() => parseConfirmed('image')} disabled={busy}>
                          <Icon name="check" size={14} /> Yes, Parse Barcode Report
                        </button>
                        <button type="button" className="btn" onClick={() => { dropImages(); setError(''); }} disabled={busy}>Cancel</button>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
            {error && <div className="flash flash-err mt-3">{error}</div>}
            {ocr && mode === 'paste' && textOrigin === 'ocr' && <OcrPanel ocr={ocr} onEdit={null} busy={busy} />}
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-3">
            <button type="button" className="btn" onClick={close} disabled={busy}>Cancel</button>
            {mode === 'paste' && (
              <button type="button" className="btn btn-primary flex h-[38px] min-w-[140px] justify-center" onClick={continueText} disabled={busy}>
                Continue <Icon name="chevR" size={14} />
              </button>
            )}
          </div>
        </Modal>
      )}

      {open && step === 'ask' && (
        <Modal title="Import Barcodes" onClose={close} size="md">
          <div className="flex-1 overflow-y-auto p-5" role="group" aria-label="What type of data is this?">
            <div className="text-[15px] font-bold uppercase tracking-wide text-ink">What type of data is this?</div>
            <p className="mt-2 text-[13.5px] text-ink">
              {asking === 'file'
                ? <>Is <span className="font-semibold">{file?.name}</span> a Barcode Report / Barcode Details export?</>
                : 'Is this copied Barcode Report / Barcode Details data?'}
            </p>
            {asking === 'text' && (
              <pre className="mt-2 max-h-[180px] overflow-auto whitespace-pre-wrap rounded border border-line bg-[#f7f9fc] p-2 font-mono text-[11.5px] leading-[1.45] text-inkmuted">
                {paste.split('\n').slice(0, 12).join('\n')}{paste.split('\n').length > 12 ? '\n...' : ''}
              </pre>
            )}
            <p className="mt-2 text-[12.5px] text-inkmuted">
              Only a Barcode Report - one barcode&apos;s Barcode Details, or the report table - can be imported here. It is read as one
              only once you say so; anything else, Cancel.
            </p>
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-3">
            <button type="button" className="btn" onClick={() => { setStep('input'); setFile(null); setAsking(''); }}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={() => parseConfirmed(asking)} autoFocus>
              <Icon name="check" size={14} /> Yes, Parse Barcode Report
            </button>
          </div>
        </Modal>
      )}

      {open && step === 'parsing' && (
        <Modal title="Import Barcodes" onClose={close} size="sm">
          <div className="flex-1 p-6" role="status" aria-live="polite">
            <div className="flex items-center gap-3 text-[14px] font-semibold text-ink">
              <span className="spin" /> {mode === 'image' && /image|OCR/i.test(stage) ? stage : 'Parsing Barcode Report...'}
            </div>
            {mode === 'image' && (
              <div className="mt-3 text-[13px] text-inkmuted">
                <div>Reading image...</div>
                <div>Extracting Barcode Report...</div>
              </div>
            )}
            <div className="mt-3 text-[13px] text-ink">Reading:</div>
            <ul className="ml-5 list-disc text-[13px] text-inkmuted">
              {PARSE_STEPS.map((s) => <li key={s}>{s}</li>)}
            </ul>
            {stage && <div className="mt-3 text-[12.5px] text-inkmuted">{stage}</div>}
          </div>
        </Modal>
      )}

      {open && step === 'failed' && failure && (
        <Modal title="Import Barcodes" onClose={close} size="md" headerAction={sourceLink}>
          <div className="flex-1 overflow-y-auto p-5">
            <div className="rounded border border-[#f1b0b0] bg-[#fdecec] px-4 py-3" role="alert" aria-label="Barcode Report could not be parsed">
              <div className="text-[14px] font-bold uppercase tracking-wide text-danger">Barcode Report could not be parsed</div>
              <p className="mt-1 text-[13px] font-semibold text-ink">{failure.message}</p>
              {failure.poor && <p className="mt-1 text-[12.5px] text-[#8a5a00]">{OCR_MESSAGES.poor}</p>}
            </div>
            <div className="mt-3 text-[13px] text-ink">Possible reasons:</div>
            <ul className="ml-5 list-disc text-[13px] text-inkmuted">
              {FAIL_REASONS.filter((r) => failure.image || !/^Image/.test(r)).map((r) => <li key={r}>{r}</li>)}
            </ul>
            <p className="mt-3 text-[12.5px] text-inkmuted">Nothing was saved.</p>
            {failure.ocr && <OcrPanel ocr={failure.ocr} onEdit={editExtracted} busy={busy} />}
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-3">
            <button type="button" className="btn" onClick={close}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={tryAgain}>
              <Icon name="refresh" size={14} /> Try Again
            </button>
          </div>
        </Modal>
      )}

      {open && step === 'review' && review && isDetails && (
        <Modal title="Barcode Import Preview" onClose={close} size="xl" headerAction={sourceLink}>
          <div className="flex-1 overflow-y-auto p-5">
            <div className="mb-2 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
              <span className="text-inkmuted">Source: <span className="font-semibold text-ink">{sourceText}</span></span>
              <span className="text-inkmuted">Import into: <span className="font-semibold text-ink">{review.location || locationName()}</span></span>
            </div>
            <p className="mb-2 text-[12.5px] text-inkmuted">
              Every value below was read from the {fromImage ? 'image' : 'Barcode Report'} - correct any of them in its box, then press Check
              corrections. Nothing is saved until you press {primaryLabel === 'Nothing to import' ? 'Seed / Import' : primaryLabel} (or Confirm Replace).
              Item, quantity and UOM of a barcode already here are never changed, and no master is created or changed.
            </p>
            {dirty && (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded border border-[#e7c96b] bg-[#fff8e6] px-3 py-2 text-[12.5px]" role="status">
                <span>You corrected {plural(editCount, 'value')} - check {editCount === 1 ? 'it' : 'them'} against this ERP before importing.</span>
                <span className="flex gap-2">
                  <button type="button" className="btn h-8" onClick={() => setEdits(new Map())} disabled={busy}><Icon name="undo" size={14} /> Undo corrections</button>
                  <button type="button" className="btn btn-primary h-8" onClick={recheck} disabled={busy}>{busy ? <span className="spin" /> : <Icon name="check" size={14} />} Check corrections</button>
                </span>
              </div>
            )}
            {read?.ocr && <OcrPanel ocr={read.ocr} onEdit={editExtracted} busy={busy} />}
            <div className={fromImage && images.length ? 'mt-2 grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]' : 'mt-2'}>
              {fromImage && images.length > 0 && (
                <div className="lg:sticky lg:top-0 lg:self-start" aria-label="Source image">
                  <div className="mb-1 text-[12px] font-bold uppercase tracking-wide text-ink">Source Image</div>
                  <div className="max-h-[70vh] space-y-2 overflow-auto rounded border border-line p-1">
                    {images.map((img) => (
                      <a key={img.id} href={img.url} target="_blank" rel="noopener noreferrer" title="Open the image at full size" className="block">
                        <img src={img.url} alt={img.name} className="h-auto w-full rounded" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              <div>
                {fromImage && images.length > 0 && <div className="mb-1 text-[12px] font-bold uppercase tracking-wide text-ink">Parsed Barcode Details</div>}
                {rows.map((r) => {
                  const rec = read.records.find((x) => x.line === r.line) || { values: r.values, details: r.details };
                  return (
                    <DetailsCard
                      key={r.line + ':' + r.key}
                      rec={rec}
                      row={r}
                      edits={edits.get(r.line) || {}}
                      onEdit={(key, value, original, force) => setEdit(r.line, key, value, original, force)}
                      busy={busy}
                      multi={rows.length > 1}
                      ticked={ticked.has(r.key)}
                      onTick={() => toggleNew(r.key)}
                      picked={pickedOf(r)}
                      decision={replacesOf(r).length ? 'replace' : decided.get(r.key)}
                      onKeep={() => keepRow(r)}
                      onReplace={() => replaceAndConfirm(r)}
                      onToggleField={(fields) => toggleField(r, fields)}
                      readWarnings={rows.length === 1 ? read.warnings || [] : []}
                      barcodeImage={barcodeImages.get(r.line) || null}
                      imagePlan={imagePlanOf(r)}
                      onAttachImage={(f) => attachBarcodeImage(r.line, f)}
                      onRemoveImage={() => removeBarcodeImage(r.line)}
                      onDecideImage={(how) => decideBarcodeImage(r.line, how)}
                      qtyDecrease={qtyDecrease}
                      qtyIncrease={qtyIncrease}
                      onQtyDecreaseChange={setQtyDecrease}
                      onQtyIncreaseChange={setQtyIncrease}
                      movementEdits={movementEdits.get(r.line) || {}}
                      effectiveMovements={effectiveMovements(rec)}
                      onMovementEdit={(movIndex, field, value) => setMovementEdit(r.line, movIndex, field, value)}
                    />
                  );
                })}
              </div>
            </div>
            {comparedBox}
            {busy && stage && <div className="mt-2 text-[12.5px] text-inkmuted" role="status">{stage}</div>}
            {error && <div className="flash flash-err mt-3">{error}</div>}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">
            <button type="button" className="btn" onClick={back} disabled={busy}>
              <Icon name="back" size={14} /> Back
            </button>
            <button type="button" className="btn" onClick={close} disabled={busy}>Cancel</button>
            <button
              type="button"
              className="btn btn-primary flex h-[38px] min-w-[200px] justify-center"
              onClick={askImport}
              disabled={busy || (!dirty && (nothingToImport || (fromImage && !compared)))}
              title={!dirty && fromImage && !compared ? 'Confirm you compared the values with the image first' : undefined}
            >
              {busy ? <span className="spin" /> : <Icon name="check" size={14} />}
              {' '}{dirty ? 'Check corrections' : primaryLabel}
            </button>
          </div>
        </Modal>
      )}

      {open && step === 'review' && review && !isDetails && (
        <Modal title="Barcode Import Preview" onClose={close} size="lg" headerAction={sourceLink}>
          <div className="flex-1 overflow-y-auto p-5">
            <div className="mb-2 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
              <span className="text-inkmuted">Import into: <span className="font-semibold text-ink">{review.location}</span></span>
              <span className="text-inkmuted">Source: <span className="font-semibold text-ink">Barcode Report table - {sourceText}</span></span>
            </div>
            <p className="mb-2 text-[12.5px] text-inkmuted">
              A barcode this ERP does not hold is ready to import (seeded). For a barcode it already holds, its existing data is shown
              beside the imported data: a blank the import only fills is ticked, a saved value it would replace waits for KEEP EXISTING
              or REPLACE. Item, quantity and UOM are never changed, and masters are never created or changed.
            </p>
            {read?.ocr && <OcrPanel ocr={read.ocr} records={read.records.length} flagged={read.records.filter((r) => r.review?.some((x) => x.field === 'barcode')).length}
              totals={read.records.some((r) => r.review?.some((x) => x.field === 'qty'))} onEdit={editExtracted} busy={busy} />}
            {fromImage && images.length > 0 && (
              <div className="mt-2 flex max-h-[260px] gap-2 overflow-auto rounded border border-line p-1" aria-label="Source image">
                {images.map((img) => (
                  <a key={img.id} href={img.url} target="_blank" rel="noopener noreferrer" title="Open the image at full size" className="shrink-0">
                    <img src={img.url} alt={img.name} className="h-auto max-w-none rounded" />
                  </a>
                ))}
              </div>
            )}
            {comparedBox}
            <MastersNote review={review} read={read} />
            <div className="mb-3 flex flex-wrap items-center gap-2 text-[12.5px]">
              {ORDER.filter((s) => review.counts[s]).map((s) => (
                <span key={s} className={'rounded px-2 py-0.5 font-semibold ' + STATUS[s].tone}>
                  {STATUS[s].label}: {review.counts[s]}
                </span>
              ))}
              {changedRows.some((r) => r.replaces) && (
                <>
                  <button type="button" className="btn" onClick={() => changedRows.forEach(replaceRow)} disabled={busy}>Replace all</button>
                  <button type="button" className="btn" onClick={() => changedRows.forEach(keepRow)} disabled={busy}>Keep all existing</button>
                </>
              )}
            </div>
            {needsDecision.length > 0 && (
              <div className="mb-3 rounded border border-[#e7c96b] bg-[#fff8e6] px-3 py-2 text-[12.5px] text-ink" role="status">
                <span className="font-semibold">EXISTING BARCODE FOUND</span> - {needsDecision.map((r) => r.barcode).join(', ')}{' '}
                {needsDecision.length > 1 ? 'already exist' : 'already exists'} in this ERP with different saved data. Choose KEEP EXISTING
                or REPLACE on {needsDecision.length > 1 ? 'each' : 'it'} below (left undecided, the existing data is kept).
              </div>
            )}

            {/* every value is text the operator pasted - rendered as text */}
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="bg-[#f7f9fc] text-left">
                  <th className="w-8 border border-line px-2 py-2" aria-label="Take" />
                  <th className="border border-line px-2 py-2">Status</th>
                  <th className="border border-line px-2 py-2">Barcode</th>
                  <th className="border border-line px-2 py-2">Item Code</th>
                  <th className="border border-line px-2 py-2">Description</th>
                  <th className="border border-line px-2 py-2 text-right">Qty</th>
                  <th className="border border-line px-2 py-2">UOM</th>
                  <th className="border border-line px-2 py-2 text-right">Retail Price</th>
                  <th className="border border-line px-2 py-2">Changes / reason</th>
                </tr>
              </thead>
              <tbody>
                {[...importRows].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || a.line - b.line).map((r) => {
                  const isOpen = open2.has(r.key);
                  const hasDetail = r.status !== 'invalid' || r.details;
                  const willReplace = replacesOf(r).length > 0;
                  const sub = r.status !== 'changed' ? ''
                    : willReplace ? 'WILL REPLACE'
                      : decided.get(r.key) === 'keep' ? 'KEEP EXISTING'
                        : r.replaces ? 'REPLACE REQUIRED' : '';
                  return [
                    <tr key={r.line + ':' + r.key} data-status={r.status} className={r.status === 'changed' ? 'bg-[#fffbf0]' : ''}>
                      <td className="border border-line px-2 py-1.5 text-center">
                        {r.status === 'new' ? (
                          <input type="checkbox" checked={ticked.has(r.key)} onChange={() => toggleNew(r.key)} aria-label={'Import ' + r.barcode} />
                        ) : null}
                      </td>
                      <td className="border border-line px-2 py-1.5">
                        <span className={'whitespace-nowrap rounded px-1.5 py-0.5 text-[11.5px] font-semibold ' + STATUS[r.status].tone}>{STATUS[r.status].label}</span>
                        {sub ? <div className={'mt-1 text-[11px] font-semibold ' + (sub === 'REPLACE REQUIRED' ? 'text-danger' : 'text-inkmuted')}>{sub}</div> : null}
                      </td>
                      <td className="border border-line px-2 py-1.5 font-mono">{r.barcode || '—'}</td>
                      <td className="border border-line px-2 py-1.5">
                        {r.values.itemCode || '—'}
                        {r.status === 'new' && !r.itemInMaster ? <div className="text-[11px] text-inkmuted">not in Item master</div> : null}
                      </td>
                      <td className="border border-line px-2 py-1.5">{r.values.description || '—'}</td>
                      <td className="border border-line px-2 py-1.5 text-right">{r.values.qty || '—'}</td>
                      <td className="border border-line px-2 py-1.5">{r.values.uom || '—'}</td>
                      <td className="border border-line px-2 py-1.5 text-right">{r.values.retailPrice || '—'}</td>
                      <td className="border border-line px-2 py-1.5">
                        {r.reason ? <div className={r.status === 'invalid' ? 'text-danger' : 'text-inkmuted'}>{r.reason}</div> : null}
                        {r.seriesNote ? <div className="text-inkmuted">{r.seriesNote}</div> : null}
                        {r.status === 'changed' ? (
                          <div>
                            {plural((r.diffs || []).length, 'difference')}
                            {r.replaces ? ` - ${r.replaces} would replace a saved value` : ''}
                            {r.identity?.state === 'different' ? <span className="font-semibold text-danger"> - different goods</span> : null}
                          </div>
                        ) : null}
                        {r.status === 'changed' && r.updatable ? (
                          <div className="mt-1 flex flex-wrap gap-1">
                            <button type="button" className="btn h-7 px-2 text-[12px]" onClick={() => keepRow(r)} disabled={busy} aria-label={'Keep existing ' + r.barcode}>Keep existing</button>
                            <button type="button" className="btn h-7 px-2 text-[12px]" onClick={() => replaceRow(r)} disabled={busy} aria-label={'Replace ' + r.barcode}>Replace</button>
                          </div>
                        ) : null}
                        {hasDetail ? (
                          <button type="button" className="mt-1 text-[12px] text-brand-link underline" onClick={() => toggleOpen(r.key)} aria-expanded={isOpen}>
                            {isOpen ? 'Hide details' : r.status === 'changed' || r.status === 'same' || r.status === 'locked' ? 'Compare existing and imported data' : 'Show details'}
                          </button>
                        ) : null}
                      </td>
                    </tr>,
                    isOpen && hasDetail ? (
                      <tr key={r.line + ':' + r.key + ':detail'} data-detail-for={r.key}>
                        <td colSpan={9} className="border border-line bg-[#fbfcfe] px-3 py-3">
                          <RowDetail row={r} picked={pickedOf(r)} onToggle={(fields) => toggleField(r, fields)} busy={busy} editable={r.status === 'changed' && r.updatable} />
                          <div className="mt-3">
                            <BarcodeImageSection row={r} image={barcodeImages.get(r.line) || null} plan={imagePlanOf(r)} busy={busy}
                              onAttach={(f) => attachBarcodeImage(r.line, f)} onRemove={() => removeBarcodeImage(r.line)} onDecide={(how) => decideBarcodeImage(r.line, how)} />
                          </div>
                        </td>
                      </tr>
                    ) : null,
                  ];
                })}
              </tbody>
            </table>

            {read?.unmapped?.length > 0 && (
              <p className="mt-3 text-[12px] text-inkmuted">Ignored columns: {read.unmapped.join(', ')} - this ERP&apos;s Barcode Report has no such field.</p>
            )}
            {read?.ignored > 0 && (
              <p className="mt-1 text-[12px] text-inkmuted">{plural(read.ignored, 'line')} left out: totals, repeated headings, rows copied twice, or lines that are not barcodes.</p>
            )}
            {read?.columns?.length > 0 && (
              <p className="mt-1 text-[12px] text-inkmuted">
                Read: {read.columns.filter((c) => c.field).map((c) => (c.heading === FIELD_LABELS[c.field] ? c.heading : `${c.heading} → ${FIELD_LABELS[c.field]}`)).join(', ')}.
              </p>
            )}
            <LeftOut read={read} />
            {busy && stage && <div className="mt-2 text-[12.5px] text-inkmuted" role="status">{stage}</div>}
            {error && <div className="flash flash-err mt-3">{error}</div>}
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-3">
            <button type="button" className="btn" onClick={back} disabled={busy}>
              <Icon name="back" size={14} /> Back
            </button>
            <button type="button" className="btn" onClick={close} disabled={busy}>Cancel</button>
            <button
              type="button"
              className="btn btn-primary flex h-[38px] min-w-[200px] justify-center"
              onClick={askImport}
              disabled={busy || nothingToImport || (fromImage && !compared)}
              title={fromImage && !compared ? 'Confirm you compared the values with the image first' : undefined}
            >
              {busy ? <span className="spin" /> : <Icon name="check" size={14} />}
              {' '}{primaryLabel}
            </button>
          </div>
        </Modal>
      )}

      {open && step === 'review' && confirming && (
        <Modal title="Replace existing data?" onClose={() => setConfirming(false)} size="md">
          <div className="flex-1 overflow-y-auto p-5 text-[13px]">
            {changedRows.filter((r) => replacesOf(r).length).map((r) => (
              <div key={r.key} className="mb-3">
                <div className="font-semibold">Barcode: <span className="font-mono">{r.barcode}</span>{r.identity?.state === 'different' ? <span className="ml-2 text-danger">- different goods here ({r.existing?.itemCode})</span> : null}</div>
                <div className="text-ink">Existing data will be replaced with the imported Barcode Report data:</div>
                <ul className="ml-5 list-disc">
                  {replacesOf(r).filter((d) => !(TWIN_OF.has(d.field) && replacesOf(r).some((m) => TWINS[m.field] === d.field))).map((d) => (
                    <li key={d.field}>{d.label}: <span className="line-through">{d.local || '—'}</span> → <span className="font-semibold">{d.incoming}</span></li>
                  ))}
                </ul>
              </div>
            ))}
            {adding > 0 && <p className="mb-2 text-inkmuted">{plural(adding, 'new barcode')} will be seeded as well.</p>}
            {imageReplaces.length > 0 && (
              <p className="mb-2 text-ink">
                Barcode image replaced as you chose (separately from the data): <span className="font-mono">{imageReplaces.map((r) => r.barcode).join(', ')}</span>.
              </p>
            )}
            <p className="font-semibold">Master data will NOT be changed.</p>
            <p className="text-inkmuted">Item, quantity and UOM stay as they are here; Item, Supplier, HSN, GST, UOM, group and price masters are never touched.</p>
            {comparedBox}
            {error && <div className="flash flash-err mt-3">{error}</div>}
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-3">
            <button type="button" className="btn" onClick={() => setConfirming(false)} disabled={busy}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={runImport} disabled={busy || (fromImage && !compared)}>
              {busy ? <span className="spin" /> : null} Confirm Replace
            </button>
          </div>
        </Modal>
      )}

      {open && step === 'review' && showValidationModal && (
        <Modal title="Missing Required Fields" onClose={() => setShowValidationModal(false)} size="md">
          <div className="flex-1 overflow-y-auto p-5 text-[13px]">
            <div className="mb-3 text-ink">
              The following required fields are empty and must be filled before importing:
            </div>
            <ul className="ml-5 list-disc text-ink">
              {missingFields.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
            <div className="mt-3 text-inkmuted">
              Please fill in the missing fields and try again.
            </div>
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-3">
            <button type="button" className="btn btn-primary" onClick={() => setShowValidationModal(false)} disabled={busy}>
              Back to Edit
            </button>
          </div>
        </Modal>
      )}

      {open && step === 'done' && result && (
        <Modal title="Import Successful" onClose={close} size="md">
          <div className="flex-1 overflow-y-auto p-5">
            <div className="flash flash-ok">
              {[result.inserted ? `${plural(result.inserted, 'barcode')} seeded` : '', result.replaced ? `${result.replaced} replaced` : '',
                result.filled ? `${result.filled} filled` : '', result.imagesSaved ? `${plural(result.imagesSaved, 'barcode image')} saved` : '',
                result.imagesReplaced ? `${plural(result.imagesReplaced, 'barcode image')} replaced` : ''].filter(Boolean).join(', ') || 'Nothing was changed'}.
            </div>
            <table className="mt-3 w-full border-collapse text-[12.5px]" aria-label="What became of each barcode">
              <thead>
                <tr className="bg-[#f7f9fc] text-left">
                  <th className="border border-line px-2 py-1.5">Barcode</th>
                  <th className="border border-line px-2 py-1.5">Action</th>
                </tr>
              </thead>
              <tbody>
                {(result.actions || []).slice(0, 200).map((a) => (
                  <tr key={a.line + ':' + a.barcode}>
                    <td className="border border-line px-2 py-1.5 font-mono">{a.barcode || '—'}</td>
                    <td className={'border border-line px-2 py-1.5 ' + (ACTIONS[a.action]?.tone || '')}>
                      {ACTIONS[a.action]?.label || a.action}
                      {a.fields?.length ? `: ${a.fields.join(', ')}` : ''}
                      {a.reason ? <span className="text-inkmuted"> - {a.reason}</span> : null}
                      {a.image ? <ImageOutcome image={a.image} barcode={a.barcode} /> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="mt-3 space-y-1 text-[12.5px] text-inkmuted">
              <li>Total {result.total} · seeded {result.inserted} · updated {result.updated} · skipped {result.skipped} · errors {result.failed}</li>
              <li>Masters matched: {result.mastersMatched}{result.unmatched?.length ? `, not found (kept as text): ${result.unmatched.map((u) => `${u.type} "${u.name}"`).join(', ')}` : ''}</li>
              {result.floors?.length > 0 && (
                <li>Barcode Generation moves past the seeded numbers of this ERP&apos;s own series: {result.floors.map((f) => `${f.barcode}`).join(', ')}.</li>
              )}
            </ul>
            <p className="mt-3 text-[12.5px] text-inkmuted">The report below now shows them.</p>
          </div>
          <div className="flex shrink-0 justify-end border-t border-line px-5 py-3">
            <button type="button" className="btn btn-primary" onClick={close}>Done</button>
          </div>
        </Modal>
      )}

      <ErpSelectorModal open={open && pickingErp} onClose={() => setPickingErp(false)} />
    </>
  );
}

/* What became of one barcode's image on Import (the server's `image`) */
const IMAGE_OUTCOMES = {
  saved: { label: '✓ Barcode image saved', tone: 'text-okgreen' },
  replaced: { label: '✓ Barcode image replaced', tone: 'text-okgreen' },
  kept: { label: 'Existing barcode image kept', tone: 'text-inkmuted' },
  retained: { label: 'Barcode image not changed', tone: 'text-[#8a5a00]' },
  skipped: { label: 'Barcode image not saved', tone: 'text-inkmuted' },
  error: { label: 'Barcode image not saved', tone: 'text-danger' },
};
function ImageOutcome({ image, barcode }) {
  const o = IMAGE_OUTCOMES[image.action] || IMAGE_OUTCOMES.error;
  return (
    <div className="mt-1.5 flex items-start gap-2" aria-label={`Barcode image of ${barcode}`}>
      {image.url ? <div className="w-[72px] shrink-0"><BarcodeImageThumb src={image.url} alt={`Barcode image of ${barcode}`} height={56} /></div> : null}
      <div className="min-w-0 text-[12px]">
        <div className={'font-semibold ' + o.tone}>{o.label}</div>
        {image.url ? <div className="break-all text-inkmuted">Status: ✓ Saved · URL: <span className="font-mono normal-case">{image.url}</span></div> : null}
        {image.reason ? <div className="text-inkmuted">{image.reason}</div> : null}
      </div>
    </div>
  );
}

/* THE BARCODE IMAGE of one barcode in the preview - apart from its data:
   choosing KEEP / REPLACE for the data never touches the image, and an image
   never changes the data. The picture is kept here (a local preview) until
   Import; nothing is uploaded or saved before then.
   `plan` - lib/barcodeImage.js imagePlan for this row (or 'skipped'). */
function BarcodeImageSection({ row, image, plan, busy, onAttach, onRemove, onDecide, titled = true }) {
  const existing = String(row.existing?.imageUrl ?? '').trim() ? (row.existing?.image || '') : '';
  const hasExisting = Boolean(String(row.existing?.imageUrl ?? '').trim());
  const blocked = !['new', 'same', 'changed', 'locked'].includes(row.status);
  const status = !image ? ''
    : plan === 'keep' ? 'Existing image kept - the new one will not be saved'
      : plan === 'skipped' ? 'Not saved - the barcode is not ticked to be seeded'
        : 'Pending upload - saved when you press Import';
  return (
    <div aria-label={`Barcode image of ${row.barcode || 'this barcode'}`}>
      {titled && <div className="mb-1 text-[12px] font-bold uppercase tracking-wide text-ink">Barcode Image</div>}
      <p className="mb-2 text-[12px] text-inkmuted">
        The picture of barcode <span className="font-mono">{row.barcode || '—'}</span> itself - kept on this barcode, never on the Item
        master, the supplier or the group. Upload or paste the barcode image.
      </p>
      {blocked ? (
        <div className="text-[12.5px] text-inkmuted">This barcode cannot be imported, so no barcode image can be saved for it.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {hasExisting && (
            <BarcodeImageThumb label="Existing barcode image" src={existing} alt={`Existing barcode image of ${row.barcode}`} height={150} />
          )}
          {image ? (
            <div className="min-w-0">
              <BarcodeImageThumb label={hasExisting ? 'New image' : 'Selected image'} src={image.url} alt={`New barcode image of ${row.barcode}`} height={150} />
              <div className="mt-1 text-[12px] text-okgreen">✓ Barcode image selected <span className="text-inkmuted">({image.name})</span></div>
              <div className="text-[12px] text-inkmuted">Status: {status}</div>
              <div className="mt-1 flex flex-wrap gap-2">
                <BarcodeImageInput compact uploadLabel="Change Image" onPicked={onAttach} disabled={busy} />
                <button type="button" className="btn h-8" onClick={onRemove} disabled={busy}><Icon name="trash" size={14} /> Remove Image</button>
              </div>
            </div>
          ) : (
            <div className="min-w-0">
              {!hasExisting && <div className="mb-2 text-[12.5px] text-inkmuted">No barcode image yet.</div>}
              <BarcodeImageInput onPicked={onAttach} disabled={busy} />
            </div>
          )}
        </div>
      )}
      {image && hasExisting && !blocked && plan !== 'skipped' && (
        <div className="mt-2 rounded border border-[#e7c96b] bg-[#fff8e6] px-3 py-2 text-[12.5px]" role="group" aria-label="Existing barcode image found">
          <div className="font-bold uppercase tracking-wide text-[#8a5a00]">Existing barcode image found</div>
          <div className="text-ink">Do you want to replace the existing barcode image?</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <button type="button" className={'btn ' + (plan === 'keep' ? 'btn-primary' : '')} onClick={() => onDecide('keep')} disabled={busy}>Keep Existing</button>
            <button type="button" className={'btn ' + (plan === 'replace' ? 'btn-primary' : '')} onClick={() => onDecide('replace')} disabled={busy}>Replace Image</button>
            <span className="text-[12px] text-inkmuted">
              {plan === 'replace' ? 'The existing image will be replaced by the new one on Import.' : 'Undecided - the existing image is kept.'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* A section of the structured preview, as the Barcode Details screen heads it */
function Section({ title, children, aside = null }) {
  return (
    <section className="mt-3 rounded border border-line" aria-label={title}>
      <div className="flex items-center justify-between border-b border-line bg-[#f7f9fc] px-3 py-1.5">
        <span className="text-[12px] font-bold uppercase tracking-wide text-ink">{title}</span>
        {aside}
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

/* One value of the page: a box to correct it in (or, read-only, as read) */
function Field({ label, value, original, onChange, readOnly = false, busy = false, hint = '', mono = false }) {
  const corrected = !readOnly && txt(value) !== txt(original);
  return (
    <label className="block min-w-0">
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-inkmuted">
        {label}{corrected ? <span className="ml-1 normal-case text-[#8a5a00]">(corrected)</span> : null}
      </span>
      {readOnly ? (
        <span className={'block min-h-[30px] break-words py-1 text-[13px] text-ink ' + (mono ? 'font-mono' : '')}>{txt(value) || '—'}</span>
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          readOnly={busy}
          aria-label={label}
          className={'f-input h-[30px] w-full text-[13px] ' + (mono ? 'font-mono ' : '') + (corrected ? 'border-[#e7c96b] bg-[#fffbf0]' : '')}
        />
      )}
      {hint ? <span className="block text-[11px] leading-tight text-[#8a5a00]">{hint}</span> : null}
    </label>
  );
}

/* ONE barcode's Details page, parsed - laid out as the Barcode Details
   screen shows it, every value correctable - and what this ERP says of it:
   NEW (ready to seed), EXISTING (its saved data beside the imported data,
   KEEP EXISTING DATA / REPLACE WITH IMPORTED DATA), or why it cannot be
   imported. `rec` - the record as read (and corrected); `row` - the
   server's verdict on it. */
function DetailsCard({
  rec, row, edits, onEdit, busy, multi, ticked, onTick, picked, decision, onKeep, onReplace, onToggleField, readWarnings,
  barcodeImage, imagePlan: plan, onAttachImage, onRemoveImage, onDecideImage,
  qtyDecrease, qtyIncrease, onQtyDecreaseChange, onQtyIncreaseChange,
  movementEdits: mEdits, effectiveMovements: effMovements, onMovementEdit,
}) {
  const d = rec.details || {};
  const id = rec.identify || {};
  const valueOf = (key) => (key in edits ? edits[key] : fieldOf(rec, key));
  const unmatched = new Set((row.unmatched || []).map((u) => u.type));
  const hintOf = (key) => {
    if (key === 'itemCode' && row.status === 'new' && !row.itemInMaster && !(key in edits)) return 'not in the Item master - kept as text';
    if (key === 'uom' && row.sources?.uom === 'item_master' && txt(row.values?.uom) !== txt(rec.values?.uom)) return `the Item master's UOM (${row.values.uom}) is used`;
    const master = MASTER_OF[key];
    return master && unmatched.has(master) && valueOf(key) && !(key in edits) ? `not in the ${master} master - kept as text` : '';
  };
  const field = ([key, label, readOnly]) => (
    <Field key={key} label={label} value={valueOf(key)} original={fieldOf(rec, key)} readOnly={readOnly} busy={busy}
      onChange={(v) => onEdit(key, v, fieldOf(rec, key))} hint={hintOf(key)} />
  );
  const noBarcode = !txt(rec.values?.barcode) && !('barcode' in edits);
  const barcodeProblems = (row.errors || []).filter((e) => e.field === 'barcode').map((e) => e.message);
  const otherProblems = (row.errors || []).filter((e) => e.field !== 'barcode').map((e) => e.message);
  const ocrDoubt = (rec.review || []).some((r) => r.field === 'barcode' && /OCR is not sure/.test(r.message));
  /* use effective (possibly edited) movements for live totals & summary */
  const liveMovements = effMovements || d.movements || [];
  const liveTotals = movementTotals(liveMovements, d.totals?.printed).computed;
  /* build a live details object for summaryOf */
  const liveD = { ...d, movements: liveMovements, totals: { ...d.totals, computed: liveTotals } };
  const summary = summaryOf(liveD);
  const held = row.links?.stockAt?.[0];
  const totals = liveTotals;
  const printed = d.totals?.printed;
  const head = noBarcode ? { text: 'BARCODE REQUIRED', tone: 'bg-[#fdecec] text-danger' }
    : row.status === 'new' ? { text: 'NEW BARCODE - READY TO IMPORT', tone: 'bg-okgreenbg text-okgreen' }
      : ['changed', 'same', 'locked'].includes(row.status) ? { text: 'EXISTING BARCODE FOUND', tone: 'bg-[#fff4d6] text-[#8a5a00]' }
        : { text: 'CANNOT BE IMPORTED', tone: 'bg-[#fdecec] text-danger' };
  const edited = new Set(rec.edited || []);

  return (
    <article className="mb-4 rounded-md border border-linestrong p-3" data-status={row.status} aria-label={`Barcode ${row.barcode || '(none)'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={'rounded px-2 py-0.5 text-[12px] font-bold ' + head.tone}>{head.text}</span>
          <span className="font-mono text-[15px] font-semibold">{row.barcode || '—'}</span>
          {row.origin ? <span className="text-[11.5px] text-inkmuted">read from an image</span> : null}
        </div>
        {multi && row.status === 'new' ? (
          <label className="flex items-center gap-1 text-[12.5px]">
            <input type="checkbox" checked={ticked} onChange={onTick} disabled={busy} aria-label={'Seed ' + row.barcode} /> Seed this barcode
          </label>
        ) : null}
      </div>

      <Section title="Barcode Identification">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Barcode" value={valueOf('barcode')} original={fieldOf(rec, 'barcode')} busy={busy} mono
            onChange={(v) => onEdit('barcode', v, fieldOf(rec, 'barcode'))} hint={noBarcode ? 'Type the barcode' : ''} />
          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-inkmuted">Detected From</span>
            <span className="block py-1 text-[13px] font-semibold text-ink">
              {'barcode' in edits ? 'Typed by you (Check corrections to use it)' : DETECTED_FROM[id.from] || (edited.has('barcode') ? 'Typed by you' : '—')}
            </span>
          </div>
          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-inkmuted">Item Code on the page</span>
            <span className="block py-1 font-mono text-[13px] text-ink">
              {id.itemCode || '—'}{id.itemCode ? <span className="ml-1 font-sans text-[11.5px] text-inkmuted">({id.itemCodeFrom === 'filters' ? 'its Filters panel' : 'its Item Code'})</span> : null}
            </span>
          </div>
        </div>
        <div className="mt-2 text-[12.5px]">
          <span className="font-semibold text-ink">Reason: </span>
          <span className="text-inkmuted">
            {noBarcode ? 'No separate Barcode, and no Item Code to use as one, was found - type the barcode above, then Check corrections.' : id.reason || '—'}
          </span>
        </div>
        {(id.notes || []).map((n) => <div key={n} className="mt-1 text-[12.5px] text-[#8a5a00]">{n}</div>)}
        {!noBarcode && barcodeProblems.map((m) => <div key={m} className="mt-1 text-[12.5px] text-danger">{m}</div>)}
        {ocrDoubt && !('barcode' in edits) && (
          <button type="button" className="btn mt-2 h-8" disabled={busy} onClick={() => onEdit('barcode', fieldOf(rec, 'barcode'), fieldOf(rec, 'barcode'), true)}>
            <Icon name="check" size={14} /> The barcode above is correct
          </button>
        )}
      </Section>

      <Section title="Barcode Image">
        <BarcodeImageSection row={row} image={barcodeImage} plan={plan} busy={busy} titled={false}
          onAttach={onAttachImage} onRemove={onRemoveImage} onDecide={onDecideImage} />
      </Section>

      <Section title="Item Info">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{ITEM_INFO.map(field)}</div>
      </Section>

      <Section title="Price Info">
        <div className="grid gap-3 sm:grid-cols-3">{PRICE_INFO.map(field)}</div>
      </Section>

      <Section title="Supplier Details">
        <div className="grid gap-3 sm:grid-cols-3">{SUPPLIER_INFO.map(field)}</div>
      </Section>

      <Section title="Stock Movements" aside={<span className="text-[11.5px] text-inkmuted">{plural(liveMovements.length, 'row')} - kept as the barcode&apos;s history</span>}>
        {liveMovements.length ? (
          <div className="overflow-x-auto">
            <style>{`
              .mov-cell-input {
                width: 100%; min-width: 70px; padding: 1px 4px; font-size: 12px;
                border: 1px solid transparent; border-radius: 3px;
                background: transparent; outline: none;
              }
              .mov-cell-input:focus {
                border-color: #6b7aff; background: #fff; box-shadow: 0 0 0 2px rgba(107,122,255,0.15);
              }
              .mov-cell-input.num { text-align: right; }
              .mov-cell-input[type="datetime-local"] { min-width: 160px; font-size: 11px; }
            `}</style>
            <table className="w-full border-collapse text-[12px]" aria-label="Stock movements">
              <thead>
                <tr className="bg-[#f7f9fc] text-left">
                  {['Location', 'Doc Date', 'Doc No', 'Message', 'Stock Point', 'Receipts', 'Issues', 'Balance Qty', 'Final Price', 'Net Amt'].map((h, i) => (
                    <th key={h} className={'border border-line px-2 py-1 ' + (i >= 5 ? 'text-right' : '')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {liveMovements.map((m, i) => {
                  /* docDate: for the datetime-local input we need YYYY-MM-DDTHH:MM format */
                  const rawDate = m.docDate ? new Date(m.docDate) : null;
                  const dtLocalVal = rawDate && !Number.isNaN(rawDate.getTime())
                    ? rawDate.toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace(' ', 'T').slice(0, 16)
                    : '';
                  const overrides = mEdits?.[i] || {};
                  const dtInputVal = overrides.docDate !== undefined ? overrides.docDate : dtLocalVal;
                  return (
                    <tr key={m.key || i}>
                      <td className="border border-line px-1 py-0.5">
                        <input
                          className="mov-cell-input"
                          type="text"
                          defaultValue={m.location || ''}
                          onBlur={(e) => onMovementEdit(i, 'location', e.target.value)}
                          aria-label={`Row ${i + 1} Location`}
                          disabled={busy}
                        />
                      </td>
                      <td className="border border-line px-1 py-0.5 whitespace-nowrap">
                        <input
                          className="mov-cell-input"
                          type="datetime-local"
                          value={dtInputVal}
                          onChange={(e) => onMovementEdit(i, 'docDate', e.target.value)}
                          aria-label={`Row ${i + 1} Doc Date`}
                          disabled={busy}
                        />
                      </td>
                      <td className="border border-line px-1 py-0.5">
                        <input
                          className="mov-cell-input"
                          type="text"
                          defaultValue={m.docNo || ''}
                          onBlur={(e) => onMovementEdit(i, 'docNo', e.target.value)}
                          aria-label={`Row ${i + 1} Doc No`}
                          disabled={busy}
                        />
                      </td>
                      <td className="border border-line px-1 py-0.5">
                        <input
                          className="mov-cell-input"
                          type="text"
                          defaultValue={m.particulars || m.party || m.docType || ''}
                          onBlur={(e) => onMovementEdit(i, 'particulars', e.target.value)}
                          aria-label={`Row ${i + 1} Message`}
                          disabled={busy}
                        />
                      </td>
                      <td className="border border-line px-1 py-0.5">
                        <input
                          className="mov-cell-input"
                          type="text"
                          defaultValue={m.stockPoint || ''}
                          onBlur={(e) => onMovementEdit(i, 'stockPoint', e.target.value)}
                          aria-label={`Row ${i + 1} Stock Point`}
                          disabled={busy}
                        />
                      </td>
                      <td className="border border-line px-1 py-0.5">
                        <input
                          className="mov-cell-input num"
                          type="number"
                          min="0"
                          step="1"
                          value={m.receipts ?? 0}
                          onChange={(e) => onMovementEdit(i, 'receipts', Math.abs(Number(e.target.value) || 0))}
                          aria-label={`Row ${i + 1} Receipts`}
                          disabled={busy}
                        />
                      </td>
                      <td className="border border-line px-1 py-0.5">
                        <input
                          className="mov-cell-input num"
                          type="number"
                          min="0"
                          step="1"
                          value={m.issues ?? 0}
                          onChange={(e) => onMovementEdit(i, 'issues', Math.abs(Number(e.target.value) || 0))}
                          aria-label={`Row ${i + 1} Issues`}
                          disabled={busy}
                        />
                      </td>
                      <td className="border border-line px-1 py-0.5 text-right text-inkmuted" aria-label={`Row ${i + 1} Balance Qty`}>
                        {m.balance ?? '—'}
                      </td>
                      <td className="border border-line px-1 py-0.5">
                        <input
                          className="mov-cell-input num"
                          type="number"
                          min="0"
                          step="0.01"
                          value={m.finalPrice ?? 0}
                          onChange={(e) => onMovementEdit(i, 'finalPrice', Number(e.target.value) || 0)}
                          aria-label={`Row ${i + 1} Final Price`}
                          disabled={busy}
                        />
                      </td>
                      <td className="border border-line px-1 py-0.5 text-right text-inkmuted" aria-label={`Row ${i + 1} Net Amt`}>
                        {money(m.netAmount)}
                      </td>
                    </tr>
                  );
                })}
                {totals ? (
                  <tr className="bg-[#f7f9fc] font-semibold">
                    <td className="border border-line px-2 py-1" colSpan={5}>TOTAL</td>
                    <td className="border border-line px-2 py-1 text-right">{totals.receipts}</td>
                    <td className="border border-line px-2 py-1 text-right">{totals.issues}</td>
                    <td className="border border-line px-2 py-1 text-right">{totals.balance}</td>
                    <td className="border border-line px-2 py-1" />
                    <td className="border border-line px-2 py-1 text-right">{money(totals.netAmount)}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : <div className="text-[12.5px] text-inkmuted">No movement rows were read.</div>}
      </Section>

      <Section title="Stock Summary">
        <div className="grid gap-3 sm:grid-cols-3">
          {field(['stockLocation', 'Location'])}
          {field(['stockPoint', 'Stock Point'])}
          <Field label="Current Qty" value={String(summary.qty ?? 0)} readOnly />
        </div>
        {/* Quantity adjustment controls */}
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-inkmuted">Decrease Qty</label>
            <input
              type="number"
              min="0"
              step="1"
              value={qtyDecrease}
              onChange={(e) => {
                const val = Math.max(0, Number(e.target.value) || 0);
                const maxDecrease = Math.floor(summary.qty ?? 0);
                if (val > maxDecrease) {
                  onQtyDecreaseChange(maxDecrease);
                } else {
                  onQtyDecreaseChange(val);
                }
              }}
              disabled={busy}
              className="f-input h-[30px] w-full text-[13px]"
              aria-label="Decrease quantity"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-inkmuted">Increase Qty</label>
            <input
              type="number"
              min="0"
              step="1"
              value={qtyIncrease}
              onChange={(e) => onQtyIncreaseChange(Math.max(0, Number(e.target.value) || 0))}
              disabled={busy}
              className="f-input h-[30px] w-full text-[13px]"
              aria-label="Increase quantity"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-inkmuted">Final Qty</label>
            <div className="flex h-[30px] items-center rounded-md border border-linestrong bg-[#f7f9fc] px-2.5 text-[13px] font-semibold text-ink">
              {String(Math.max(0, (summary.qty ?? 0) - qtyDecrease + qtyIncrease))}
            </div>
          </div>
        </div>
        {row.status === 'new' && (
          <div className="mt-2 text-[12.5px] text-inkmuted">
            Will be seeded {held ? <>in stock at <span className="font-semibold text-ink">{held.location}</span> ({held.qty})</> : <>as <span className="font-semibold text-ink">history</span> - no stock left (a barcode with its receipts all issued is still imported)</>}.
            {' '}Quantity received: {row.values?.qty || '—'} ({SOURCE_WORDS[row.sources?.qty] || 'as read'}).
          </div>
        )}
      </Section>

      {/* THIS ERP'S WORD ON IT */}
      <div className="mt-3">
        {row.status === 'new' && (
          <div className="rounded border border-[#b7dfc2] bg-okgreenbg px-3 py-2 text-[13px]" role="status">
            <div className="font-bold uppercase tracking-wide text-okgreen">New barcode</div>
            <div className="text-ink">Ready to seed - this ERP does not hold {row.barcode}.</div>
            {row.seriesNote ? <div className="mt-1 text-[12.5px] text-inkmuted">{row.seriesNote}</div> : null}
          </div>
        )}
        {['changed', 'same', 'locked'].includes(row.status) && (
          <div className="rounded border border-[#e7c96b] bg-[#fff8e6] px-3 py-2 text-[13px]" role="status">
            <div className="font-bold uppercase tracking-wide text-[#8a5a00]">Existing barcode found</div>
            <div className="text-ink">
              {row.status === 'same' ? `${row.barcode} is already in this ERP with the same data - there is nothing to change.`
                : row.status === 'locked' ? row.reason
                  : `${row.barcode} is already in this ERP. Its existing data is compared with the imported data below.`}
            </div>
            {row.status === 'changed' && (
              <>
                <div className="mt-2 rounded border border-line bg-white p-2">
                  <RowDetail row={row} picked={picked} onToggle={onToggleField} busy={busy} editable={row.updatable} />
                </div>
                {row.updatable && (
                  <div className="mt-2">
                    <div className="text-[13px] font-semibold text-ink">What do you want to do?</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <button type="button" className={'btn ' + (decision === 'keep' ? 'btn-primary' : '')} onClick={onKeep} disabled={busy}>KEEP EXISTING DATA</button>
                      <button type="button" className={'btn ' + (decision === 'replace' ? 'btn-primary' : '')} onClick={onReplace} disabled={busy}>REPLACE WITH IMPORTED DATA</button>
                      <span className="text-[12px] text-inkmuted">
                        {decision === 'replace' ? 'The existing data will be replaced (you are asked to confirm).'
                          : decision === 'keep' ? `The existing data is kept${picked.size ? ' - only its blank fields are filled' : ''}.`
                            : row.replaces ? 'Undecided - the existing data is kept.' : 'Only blank fields are filled.'}
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
        {row.status === 'invalid' && !noBarcode && (
          <div className="rounded border border-[#f1b0b0] bg-[#fdecec] px-3 py-2 text-[13px]" role="alert">
            <div className="font-bold uppercase tracking-wide text-danger">Cannot be imported</div>
            <ul className="ml-5 list-disc text-ink">{[...barcodeProblems, ...otherProblems].map((m) => <li key={m}>{m}</li>)}</ul>
            <div className="mt-1 text-[12px] text-inkmuted">Correct the value above and press Check corrections.</div>
          </div>
        )}
        {noBarcode && otherProblems.length > 0 && (
          <ul className="ml-5 mt-1 list-disc text-[12.5px] text-danger">{otherProblems.filter((m) => !/Barcode is missing/.test(m)).map((m) => <li key={m}>{m}</li>)}</ul>
        )}
      </div>

      {((row.warnings || []).length > 0 || readWarnings.length > 0 || (row.unmatched || []).length > 0) && (
        <details className="mt-2 text-[12px] text-inkmuted">
          <summary className="cursor-pointer">Notes ({(row.warnings || []).length + readWarnings.length + (row.unmatched || []).length})</summary>
          <ul className="ml-5 mt-1 list-disc">
            {(row.unmatched || []).map((u) => <li key={u.type + u.name}>{u.type} &quot;{u.name}&quot; is not in the {u.type} master - kept as text on the barcode (masters are never created)</li>)}
            {[...readWarnings, ...(row.warnings || [])].map((w) => <li key={w}>{w}</li>)}
          </ul>
        </details>
      )}
    </article>
  );
}

/* A barcode already here: its EXISTING DATA beside the IMPORTED DATA, field
   by field - each difference with its own tick (fill / replace), a value
   that is the same shown as "No change", and item / quantity / UOM as never
   changed by an import. For a new report-table row, what it will be seeded
   as. */
function RowDetail({ row, picked, onToggle, busy, editable }) {
  const d = row.details || {};
  const held = row.links?.stockAt?.[0];
  const totals = d.totals?.computed;
  const diffOf = (field) => (row.diffs || []).find((x) => x.field === field);
  const incoming = {
    ...row.values,
    supplier: d.supplier || '',
    location: held ? held.location || 'where the source holds it' : row.details ? 'kept as history (no stock left)' : '',
    status: held ? `in stock (${held.qty})` : row.details ? 'history - no stock left' : '',
  };
  const existing = row.existing || null;
  /* a difference and its twin (WSP price + base WSP) share a row and a tick */
  const withTwin = (x) => [x, TWINS[x.field] ? diffOf(TWINS[x.field]) : null].filter((y) => y && y.updatable).map((y) => y.field);
  const extra = (row.diffs || []).filter((x) => !COMPARE.some(([f, , via]) => (via || f) === x.field)
    && !(TWIN_OF.has(x.field) && COMPARE.some(([f]) => TWINS[f] === x.field)));
  const tick = (x) => (x.updatable && !editable ? <span className="text-inkmuted">{row.status === 'locked' ? 'sold / moved - cannot be changed' : '-'}</span> : x.updatable ? (
    <label className="flex items-center gap-1">
      <input type="checkbox" checked={withTwin(x).every((f) => picked.has(f))} onChange={() => onToggle(withTwin(x))} disabled={busy} aria-label={`${x.kind === 'fill' ? 'Fill' : x.kind === 'append' ? 'Add' : 'Replace'} ${x.label} of ${row.barcode}`} />
      <span className={x.kind === 'replace' ? 'font-semibold text-[#8a5a00]' : 'text-okgreen'}>{x.kind === 'fill' ? 'Fill (blank here)' : x.kind === 'append' ? 'Add' : 'Replace'}</span>
    </label>
  ) : <span className="text-inkmuted">not changed by an import</span>);
  return (
    <div className="space-y-3 text-[12.5px]" aria-label={`Details of ${row.barcode}`}>
      {row.identity?.state === 'different' && (
        <div className="rounded border border-[#f1b0b0] bg-[#fdecec] px-3 py-2 text-danger" role="alert">
          <span className="font-semibold">Different goods:</span> {row.identity.reasons.join('; ')}. This number is used here for other goods -
          replacing would only take the imported prices and details onto this ERP&apos;s unit ({existing?.itemCode}); its item, quantity and UOM stay.
        </div>
      )}
      {row.oldOnly && <div className="text-[#8a5a00]">This number matched the unit&apos;s OLD barcode only - check it is the same piece before replacing anything.</div>}
      {existing ? (
        <table className="w-full border-collapse" aria-label={`Existing and imported data of ${row.barcode}`}>
          <thead>
            <tr className="bg-[#f7f9fc] text-left">
              <th className="border border-line px-2 py-1.5">Field</th>
              <th className="border border-line px-2 py-1.5">EXISTING DATA (this ERP)</th>
              <th className="border border-line px-2 py-1.5">IMPORTED DATA</th>
              <th className="border border-line px-2 py-1.5">Action</th>
            </tr>
          </thead>
          <tbody>
            {COMPARE.map(([field, label, via]) => {
              /* the value's own difference, or - when only its twin differs - the twin's */
              const x = diffOf(via || field) || (TWINS[field] ? diffOf(TWINS[field]) : null);
              const a = existing[field];
              const b = incoming[field];
              if (!txt(a) && !txt(b)) return null;
              return (
                <tr key={field} className={x?.updatable ? 'bg-[#fffbf0]' : ''}>
                  <td className="border border-line px-2 py-1">{label}</td>
                  <td className="border border-line px-2 py-1">{txt(a) || '—'}</td>
                  <td className="border border-line px-2 py-1 font-semibold">{txt(b) || '—'}</td>
                  <td className="border border-line px-2 py-1">{x ? tick(x) : sameText(a, b) ? <span className="text-inkmuted">No change</span> : <span className="text-inkmuted">—</span>}</td>
                </tr>
              );
            })}
            {extra.map((x) => (
              <tr key={x.field} className={x.updatable ? 'bg-[#fffbf0]' : ''}>
                <td className="border border-line px-2 py-1">{x.label}</td>
                <td className="border border-line px-2 py-1">{x.local || '—'}</td>
                <td className="border border-line px-2 py-1 font-semibold">{x.incoming || '—'}</td>
                <td className="border border-line px-2 py-1">{tick(x)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <div className="font-semibold">ITEM DETAILS</div>
            <div>Item Code: {row.values.itemCode || '—'} <span className="text-inkmuted">({SOURCE_WORDS[row.sources?.itemCode] || 'as given'})</span></div>
            <div>UOM: {row.values.uom || '—'} <span className="text-inkmuted">({SOURCE_WORDS[row.sources?.uom] || 'as given'})</span></div>
            <div>Quantity: {row.values.qty || '—'} <span className="text-inkmuted">({SOURCE_WORDS[row.sources?.qty] || 'as given'})</span></div>
            <div>Retail Price: {row.values.retailPrice || '—'} · WSP {row.values.wspPrice || '—'} · DP {row.values.dpPrice || '—'}</div>
            <div>Purchase Rate: {row.values.purRate || '—'} · Final Rate {row.values.finalNet || '—'} · HSN {row.values.hsn || '—'} · GST {row.values.gst ? row.values.gst + '%' : '—'}</div>
          </div>
          {row.details ? (
            <div>
              <div className="font-semibold">STOCK</div>
              <div>Receipts: {totals?.receipts ?? '—'} · Issues: {totals?.issues ?? '—'} · Balance: {totals?.balance ?? '—'}</div>
              <div>{held ? `in stock: ${held.qty}` : 'no stock left - kept as history'}</div>
            </div>
          ) : null}
        </div>
      )}
      {existing && row.details ? (
        <div className="text-inkmuted">
          Imported stock: {plural((d.movements || []).length, 'movement row')} · receipts {totals?.receipts ?? '—'} · issues {totals?.issues ?? '—'} · balance {totals?.balance ?? '—'} - the unit here stays where this ERP&apos;s stock says it is.
        </div>
      ) : null}
    </div>
  );
}

/* A report table's lines that were not barcode rows, and why - shown
   folded, never a list of every field of a page. */
function LeftOut({ read }) {
  const left = read?.left || [];
  if (!left.length) return null;
  return (
    <details className="mt-3 rounded border border-line bg-[#f7f9fc] px-3 py-2 text-[12.5px]">
      <summary className="cursor-pointer font-semibold text-ink">{plural(left.length, 'line')} under the headings not read as a barcode row</summary>
      <ul className="ml-4 mt-1 list-disc">
        {left.slice(0, 50).map((l) => <li key={l.line}><span className="font-mono">{l.text}</span> - {l.reason} (line {l.line})</li>)}
      </ul>
    </details>
  );
}

/* The masters found and not found (never created), and what the reader or
   the server noticed - GST Parse's "Also returned" / "Ignored columns". */
function MastersNote({ review, read }) {
  const notes = [...(read?.warnings || []), ...(review.warnings || [])];
  if (!review.mastersMatched && !review.unmatched?.length && !notes.length) return null;
  return (
    <div className="mb-3 rounded border border-line bg-[#f7f9fc] px-3 py-2 text-[12.5px]">
      {review.mastersMatched > 0 && <div>Masters found: {review.mastersMatched}</div>}
      {review.unmatched?.length > 0 && (
        <div className="text-[#8a5a00]">
          Not found - kept as text on the barcode: {review.unmatched.map((u) => `${u.type} "${u.name}"`).join(', ')}
        </div>
      )}
      {notes.map((n) => <div key={n} className="text-inkmuted">{n}</div>)}
    </div>
  );
}

/* What OCR made of the screenshots: how sure it was, and the text it read -
   to compare with the image, and to correct as text. `records` - a report
   table's rows. */
function OcrPanel({ ocr, records = null, flagged = 0, totals = false, onEdit, busy = false }) {
  if (!ocr) return null;
  const poor = ocr.confidence < POOR_CONFIDENCE;
  return (
    <div className="mt-3 rounded border border-line bg-[#f7f9fc] px-3 py-2 text-[12.5px]" aria-label="Image reading">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <span className="text-okgreen">✓ Image read</span>
        <span className="text-okgreen">✓ OCR completed ({ocr.confidence}% sure)</span>
        {records !== null && <span className="font-semibold text-ink">Records found: {records}</span>}
      </div>
      {flagged > 0 && <div className="mt-1 text-[#8a5a00]">{OCR_MESSAGES.review} {plural(flagged, 'barcode')} could not be read with confidence - see the rows below.</div>}
      {totals && <div className="mt-1 text-[#8a5a00]">The rows do not add up to the image&apos;s TOTAL row - a number was misread, or the screenshot shows only part of the report; see the rows below.</div>}
      {poor && <div className="mt-1 text-[#8a5a00]">{OCR_MESSAGES.poor}</div>}
      <details className="mt-1">
        <summary className="cursor-pointer text-brand-link">View Extracted Text</summary>
        <pre className="mt-1 max-h-[220px] overflow-auto whitespace-pre-wrap rounded border border-line bg-white p-2 font-mono text-[11.5px] leading-[1.45]">{ocr.text}</pre>
        {onEdit && (
          <button type="button" className="btn mt-1" onClick={onEdit} disabled={busy}>
            <Icon name="pencil" size={14} /> Edit as text
          </button>
        )}
      </details>
    </div>
  );
}
