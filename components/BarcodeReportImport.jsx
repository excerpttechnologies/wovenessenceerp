'use client';
import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import Icon from './Icon';
import { useScope } from './ScopeContext';
import { useOptions } from './useOptions';
import { readImport, FIELD_LABELS, SOURCE_URL } from '@/lib/barcodeReportImport';
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
   Details page - or saves its Excel export - and brings it here. Nothing is
   fetched from that site and no login to it is stored; the text is read in
   this browser (lib/barcodeReportImport.js).

   Then a review before anything is saved (user, 2026-09-30):
     READY TO IMPORT           a barcode this ERP does not hold - ticked, and
                               seeded on Import (a number of this ERP's own
                               series too: Barcode Generation moves past it)
     EXISTING - NO CHANGES     held here, nothing differs
     EXISTING - CHANGES FOUND  held here: its saved data beside the pasted
                               data, field by field. A blank it only FILLS is
                               ticked; a saved value it would REPLACE waits
                               for KEEP EXISTING / REPLACE (or its own tick),
                               and Import asks once more before replacing.
                               Item, quantity, UOM and masters never change.
     ERROR                     cannot come in - the real reason
   Import saves what was ticked (/api/reports/barcode-report/import, which
   checks every row again) and says what became of each barcode.

   An IMAGE that is not a report table - an item's Details page, a sticker -
   is only LOOKED UP: its barcode (detectBarcodes), and this ERP's own values
   for it; nothing is imported from it, and without a barcode the preview
   says NO VALID BARCODE DETECTED. Every image is read on its own.
   "Barcode detection" shows what was read, offered, refused and why, and
   where every value of a row came from.

   `api` is ReportView's toolbar hook - searchFor(filters) runs the report. */

const STATUS = {
  new: { label: 'READY TO IMPORT', tone: 'bg-okgreenbg text-okgreen' },
  changed: { label: 'EXISTING - CHANGES FOUND', tone: 'bg-[#fff4d6] text-[#8a5a00]' },
  same: { label: 'EXISTING - NO CHANGES', tone: 'bg-[#eef2f8] text-inkmuted' },
  locked: { label: 'EXISTING - SOLD / MOVED', tone: 'bg-[#eef2f8] text-inkmuted' },
  invalid: { label: 'ERROR', tone: 'bg-[#fdecec] text-danger' },
};
const ORDER = ['new', 'changed', 'same', 'locked', 'invalid'];
/* a barcode an image showed, looked up - what this ERP holds under it */
const LOOKUP = {
  matches: { label: 'Found here', tone: 'bg-okgreenbg text-okgreen' },
  unconfirmed: { label: 'Found here', tone: 'bg-[#eef2f8] text-inkmuted' },
  different: { label: 'Different goods', tone: 'bg-[#fdecec] text-danger' },
  several: { label: 'Several units', tone: 'bg-[#fff4d6] text-[#8a5a00]' },
  missing: { label: 'Not in this ERP', tone: 'bg-[#fdecec] text-danger' },
};
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
  existing_barcode_lookup: 'this ERP (barcode lookup)',
  item_master: 'Item master',
};
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
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const txt = (v) => String(v ?? '').trim();
const sameText = (a, b) => txt(a) === txt(b) || (txt(a) !== '' && txt(b) !== '' && Number.isFinite(Number(a)) && Number.isFinite(Number(b)) && Number(a) === Number(b));

function Modal({ title, onClose, children, size = 'md', headerAction }) {
  const width = size === 'lg' ? 'max-w-[1120px]' : size === 'sm' ? 'max-w-[460px]' : 'max-w-[760px]';
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
const recordsOf = (list) => (list || []).map(({ line, values, details, review, origin, sources, lookupOnly, candidate, crossCheck }) => ({
  line, values, details, review, origin, sources, lookupOnly, candidate, crossCheck,
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
  const [step, setStep] = useState('paste');      // 'paste' | 'review' | 'done'
  const [paste, setPaste] = useState('');
  /* where the text in the box came from: 'text' (pasted / typed) or 'ocr' -
     an image's text put there by Edit as text, which keeps the image's rules */
  const [textOrigin, setTextOrigin] = useState('text');
  /* the barcode number of a pasted Details page, which does not print one -
     or, with an image, a barcode to look up */
  const [barcode, setBarcode] = useState('');
  const [fileName, setFileName] = useState('');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [read, setRead] = useState(null);         // what the browser read
  const [review, setReview] = useState(null);     // what the server says each row becomes
  const [ticked, setTicked] = useState(new Set());               // NEW rows to seed
  const [picks, setPicks] = useState(new Map());                 // CHANGED rows: key -> Set of fields to write
  const [decided, setDecided] = useState(new Map());             // key -> 'keep' | 'replace'
  const [open2, setOpen2] = useState(new Set());                 // rows whose detail is open
  const [confirming, setConfirming] = useState(false);           // "Replace existing barcode data?"
  /* an image import: the operator's word that they compared the barcodes
     with the image - OCR can be sure of a wrong character */
  const [compared, setCompared] = useState(false);
  const [result, setResult] = useState(null);
  /* screenshots pasted, dropped or chosen: [{ id, file, url, name, size }] */
  const [images, setImages] = useState([]);
  const [ocr, setOcr] = useState(null);           // what OCR read from them
  /* back from a look-up of an image: the next image REPLACES it (the "go
     back and upload another image" the no-barcode panel asks for) */
  const [replaceNext, setReplaceNext] = useState(false);
  /* both text and images given: which one Check reads - never both mixed */
  const [source, setSource] = useState('image');
  const [stage, setStage] = useState('');         // "Reading image..." while busy
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);
  const imageRef = useRef(null);

  const target = location || scopeLocation || '';

  function dropImages(list = images) {
    list.forEach((img) => URL.revokeObjectURL(img.url));
    setImages([]);
    setOcr(null);
  }

  function start() {
    setOpen(true); setStep('paste'); setPaste(''); setTextOrigin('text'); setBarcode(''); setFileName(''); setError('');
    setRead(null); setReview(null); setResult(null); setTicked(new Set()); setPicks(new Map()); setDecided(new Map());
    setOpen2(new Set()); setConfirming(false);
    setLocation(scopeLocation || '');
    dropImages(); setSource('image'); setStage(''); setReplaceNext(false);
  }

  /* images in: each checked (type, extension, size) before it is kept */
  function addImages(files) {
    if (busy) return;
    const list = [...(files || [])];
    if (!list.length) return;
    const bad = list.map(imageProblem).find(Boolean);
    if (bad) { setError(bad); return; }
    const keep = replaceNext ? [] : images;
    if (replaceNext) { images.forEach((img) => URL.revokeObjectURL(img.url)); setReplaceNext(false); }
    if (keep.length + list.length > IMAGE_MAX_COUNT) { setError(`At most ${IMAGE_MAX_COUNT} images can be read at a time.`); return; }
    const added = list.map((file, i) => ({
      id: `${Date.now()}-${i}`, file, url: URL.createObjectURL(file), name: file.name || `Pasted image ${keep.length + i + 1}`, size: file.size,
    }));
    setImages([...keep, ...added]);
    setOcr(null);
    setSource('image');
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
    if (!files.length) return;
    const text = event.clipboardData?.getData('text') || '';
    if (text.trim() && event.target?.tagName === 'TEXTAREA') return;
    event.preventDefault();
    addImages(files);
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

  /* the extracted text into the text box, to correct and Check as text -
     still under an image's rules (textOrigin 'ocr'), with the image kept
     beside it to compare with */
  function editExtracted() {
    if (busy) return;
    const text = ocr?.text ?? read?.ocr?.text;
    if (text === undefined) return;
    setPaste(text);
    setTextOrigin('ocr');
    setSource('text');
    setStep('paste');
    setError('');
  }
  const close = () => { if (!busy) setOpen(false); };
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

  /* the choices a fresh preview opens with */
  function openReview(table, d) {
    setRead(table);
    setReview(d);
    setTicked(new Set(d.rows.filter((r) => r.status === 'new').map((r) => r.key)));
    setPicks(new Map(d.rows.filter((r) => r.status === 'changed').map((r) => [r.key, defaultPicks(r)])));
    setDecided(new Map());
    const rows = d.rows.filter((r) => r.status in STATUS);
    setOpen2(new Set(rows.length <= 3 ? rows.map((r) => r.key) : []));
    setCompared(false);
    setConfirming(false);
    setStep('review');
  }

  /* what was read -> the server's verdict on every row */
  async function check(table) {
    if (table.error) { setError(table.error); return; }
    if (!table.records.length) {
      const why = (table.left || []).slice(0, 3).map((l) => `line ${l.line}: ${l.reason}`).join('; ');
      setError('No barcode rows were found under the headings.' + (why ? ` Left out - ${why}.` : ''));
      return;
    }
    if (!target) { setError('Choose the Business Location the barcodes go into.'); return; }
    setBusy(true); setError('');
    try {
      const d = await post({ mode: 'check', records: recordsOf(table.records) });
      openReview(table, d);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  /* an image with no barcode on it: straight to the preview's NO VALID
     BARCODE DETECTED - nothing to look up, nothing sent */
  function showNoBarcode(table) {
    setRead(table);
    setReview({ rows: [], counts: {}, location: locationName(), warnings: [], unmatched: [], mastersMatched: 0 });
    setTicked(new Set()); setPicks(new Map()); setDecided(new Map()); setOpen2(new Set());
    setCompared(false);
    setStep('review');
  }

  /* what an image (or its corrected text) gave, by kind: a report table's
     rows (held for review where OCR was unsure, or where they do not add up
     to the TOTAL row), a barcode to look up, or no barcode at all */
  async function checkFromImage(table, ocrRead, text = null) {
    if (table.kind === 'none') { showNoBarcode({ ...table, ocr: ocrRead }); return; }
    let records = table.records;
    if (table.kind === 'table' && ocrRead) records = reviewOcrRecords(records, ocrRead);
    else if (table.kind === 'table' && text !== null) records = reviewOcrRecords(records, { text, lines: [] });
    await check({ ...table, records, ocr: ocrRead || ocr });
  }

  function checkPaste() {
    if (!paste.trim()) { setError(OCR_MESSAGES.noText); return; }
    setFileName('');
    /* text an image gave keeps the image's rules, however it got here */
    const origin = textOrigin === 'ocr' || (ocr?.text && paste.trim() === ocr.text.trim()) ? 'ocr' : 'text';
    const table = readImport(paste, { barcode, origin });
    if (origin === 'ocr' && !table.error) { checkFromImage(table, null, paste); return; }
    check(table);
  }

  /* IMAGE -> OCR -> TEXT, each image on its own, and from there the very
     reader a paste goes through. OCR runs only here, when Check is pressed. */
  async function checkImages() {
    /* the stage from the first moment - the OCR engine itself takes a
       moment to load */
    setBusy(true); setError(''); setFileName(''); setStage('Reading image...');
    let ocrRead;
    try {
      ocrRead = await ocrImages(images.map((img) => img.file), { onStage: setStage });
    } catch (e) {
      console.error('Barcode Report image OCR failed', e);
      setOcr(null); setError(OCR_MESSAGES.failed); setBusy(false); setStage('');
      return;
    }
    setOcr(ocrRead);
    const stop = (message) => { setError(message); setBusy(false); setStage(''); };
    if (!ocrRead.words || !ocrRead.text.trim()) { stop(OCR_MESSAGES.noReadable); return; }
    const poor = ocrRead.confidence < POOR_CONFIDENCE ? ' ' + OCR_MESSAGES.poor : '';
    const pages = (ocrRead.pages || [{ name: 'image', text: ocrRead.text, lines: ocrRead.lines }]).map((page, i) => ({
      page, i, read: readImport(page.text, { origin: 'image', lines: page.lines, minConfidence: BARCODE_MIN_CONFIDENCE }),
    })).filter((p) => p.page.text.trim());
    const broken = pages.find((p) => p.read.error);
    if (broken) {
      const message = /headings could not/.test(broken.read.error) ? broken.read.error : OCR_MESSAGES.noTable + ' ' + broken.read.error;
      stop((pages.length > 1 ? `${broken.page.name}: ` : '') + message + poor);
      return;
    }
    const tables = pages.filter((p) => p.read.kind === 'table');
    if (tables.length && tables.length !== pages.length) { stop(OCR_MESSAGES.mixed); return; }
    setBusy(false);
    if (tables.length) {
      /* report-table screenshots: every image's rows, each checked against
         its own TOTAL row and OCR confidence */
      setStage('Validating records...');
      let line = 0;
      const records = tables.flatMap(({ page, read: r }) => reviewOcrRecords(r.records, { text: page.text, lines: page.lines })
        .map((rec) => ({ ...rec, line: ++line })));
      const first = tables[0].read;
      await check({
        ...first, records,
        unmapped: [...new Set(tables.flatMap((t) => t.read.unmapped))],
        ignored: tables.reduce((a, t) => a + t.read.ignored, 0),
        left: tables.flatMap((t) => t.read.left || []),
        detection: {
          ...first.detection,
          candidates: tables.flatMap((t) => t.read.detection?.candidates || []),
          rejected: tables.flatMap((t) => t.read.detection?.rejected || []),
        },
        ocr: ocrRead,
      });
      setStage('');
      return;
    }
    /* anything else: each image's own barcodes, looked up - with that
       image's own item name and GRC to compare, never another image's -
       and the number typed in the box as a look-up of its own */
    let line = 0;
    const records = pages.flatMap(({ read: r, i }) => r.records.map((rec) => ({ ...rec, line: ++line, candidate: { ...rec.candidate, page: i } })));
    const typedValue = barcode.trim();
    if (typedValue) records.push({ line: ++line, lookupOnly: true, origin: 'image', values: { barcode: typedValue }, candidate: { source: 'typed', page: -1, confidence: null } });
    const detection = {
      candidates: pages.flatMap(({ read: r, page }) => (r.detection?.candidates || []).map((c) => ({ ...c, image: page.name }))),
      rejected: pages.flatMap(({ read: r, page }) => (r.detection?.rejected || []).map((x) => ({ ...x, image: page.name }))),
      details: pages.some(({ read: r }) => r.detection?.details),
      skipped: {
        filters: pages.reduce((a, { read: r }) => a + (r.detection?.skipped?.filters || 0), 0),
        movements: pages.reduce((a, { read: r }) => a + (r.detection?.skipped?.movements || 0), 0),
      },
      /* images that showed no barcode at all */
      empty: pages.filter(({ read: r }) => r.kind === 'none').map(({ page }) => page.name),
      images: pages.length,
    };
    const table = { kind: records.length ? 'lookup' : 'none', origin: 'image', records, columns: [], unmapped: [], ignored: 0, left: [], warnings: [], detection, error: '' };
    setStage('Looking up the barcode...');
    await checkFromImage(table, ocrRead);
    setStage('');
  }

  const hasText = paste.trim() !== '';
  const useImages = images.length > 0 && (!hasText || source === 'image');
  function runCheck() {
    if (!hasText && !images.length) { setError(OCR_MESSAGES.noText); return; }
    if (useImages) checkImages(); else checkPaste();
  }

  async function pickFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true); setError('');
    try {
      const matrix = await readWorkbook(file);
      setFileName(file.name);
      setBusy(false);
      /* the sheet's rows as the lines a paste would give - one reader for
         both, so a report table and an exported Details page both work */
      await check(readImport(matrix.map((row) => row.map(sheetCell).join('\t')).join('\n'), { barcode }));
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  const rows = review?.rows || [];
  const fromImage = read?.origin === 'image' || read?.origin === 'ocr';
  /* an image that is not a report table: looked up, never imported */
  const lookupMode = read?.kind === 'lookup' || read?.kind === 'none';
  const lookupRows = rows.filter((r) => r.status === 'lookup');
  /* what the IMAGE showed - a number the operator typed is their own look-up */
  const imageRows = lookupRows.filter((r) => r.candidate?.source !== 'typed');
  const noBarcode = lookupMode && !imageRows.length;
  const importRows = rows.filter((r) => r.status in STATUS);
  const changedRows = importRows.filter((r) => r.status === 'changed' && r.updatable);
  const pickedOf = (r) => picks.get(r.key) || new Set();
  const replacesOf = (r) => (r.diffs || []).filter((d) => d.updatable && d.kind === 'replace' && pickedOf(r).has(d.field));
  const adding = importRows.filter((r) => r.status === 'new' && ticked.has(r.key)).length;
  const replacing = changedRows.filter((r) => replacesOf(r).length).length;
  const filling = changedRows.filter((r) => pickedOf(r).size && !replacesOf(r).length).length;
  const needsDecision = changedRows.filter((r) => r.replaces && !decided.has(r.key) && !replacesOf(r).length);

  const toggleNew = (key) => setTicked((set) => { const next = new Set(set); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const setRowPicks = (r, fields, how) => {
    setPicks((map) => new Map(map).set(r.key, new Set(fields)));
    if (how) setDecided((map) => new Map(map).set(r.key, how));
  };
  /* KEEP EXISTING: nothing saved is overwritten - only the blanks it fills
     (GST Parse's rule), and not even those for different goods */
  const keepRow = (r) => setRowPicks(r, defaultPicks(r), 'keep');
  /* REPLACE: every difference an import may write (never item / qty / UOM) */
  const replaceRow = (r) => setRowPicks(r, (r.diffs || []).filter((d) => d.updatable).map((d) => d.field), 'replace');
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
    if (replacing) { setConfirming(true); return; }
    runImport();
  }

  async function runImport() {
    if (lookupMode) return;
    setConfirming(false);
    setBusy(true); setError('');
    try {
      const d = await post({
        mode: 'import',
        records: recordsOf(read?.records),
        /* each difference approved, with the saved value it was approved
           against - the server writes it only while that value is still there */
        update: changedRows.filter((r) => pickedOf(r).size).map((r) => ({
          barcode: r.barcode,
          unitId: r.unitId,
          fields: Object.fromEntries([...pickedOf(r)].map((field) => [field, (r.diffs || []).find((x) => x.field === field)?.local ?? ''])),
        })),
        skip: importRows.filter((r) => r.status === 'new' && !ticked.has(r.key)).map((r) => r.barcode),
        ...(fromImage ? { compared } : {}),
      });
      setResult(d);
      setStep('done');
      /* show what came in: run the report again, or for the imported item */
      const codes = d.itemCodes || [];
      const current = String(api?.filters?.itemCode || '').trim().toLowerCase();
      const shows = api?.searched && current && codes.some((c) => String(c).toLowerCase().includes(current));
      api?.searchFor(shows || !codes.length ? {} : { itemCode: codes[0] });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const back = () => {
    setStep('paste'); setError(''); setConfirming(false);
    /* from an image's look-up: the next image replaces this one */
    if (lookupMode && useImages) setReplaceNext(true);
  };

  const sourceLink = (
    /* the shortcut to the source report - GST Parse's portal button */
    <a
      href={SOURCE_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="Open the Barcode Report on erp.orbiteerp.com"
      aria-label="Open the Barcode Report on erp.orbiteerp.com"
      className="flex h-8 w-8 items-center justify-center rounded-md bg-brand leading-none text-white hover:bg-brand-hover"
    >
      <Icon name="search" size={16} />
    </a>
  );

  /* the image(s) read, beside the rows - at their own size (scroll
     sideways), so a barcode can be compared; click opens one in a tab */
  const imageStrip = fromImage && images.length > 0 && (
    <div className="mt-2 flex max-h-[260px] gap-2 overflow-auto rounded border border-line p-1" aria-label="The image read">
      {images.map((img) => (
        <a key={img.id} href={img.url} target="_blank" rel="noopener noreferrer" title="Open the image at full size" className="shrink-0">
          <img src={img.url} alt={img.name} className="h-auto max-w-none rounded" />
        </a>
      ))}
    </div>
  );
  const sourceText = read?.kind === 'details' ? 'Copied Barcode Details report' + (fileName ? ` (${fileName})` : '')
    : fileName ? `Barcode Report table (${fileName})`
      : read?.origin === 'image' ? 'Barcode Report table (screenshot)'
        : read?.origin === 'ocr' ? 'Barcode Report table (text read from a screenshot)' : 'Barcode Report table (copied)';

  return (
    <>
      <button type="button" className="btn" onClick={start}>
        <Icon name="upload" size={14} /> Import
      </button>

      {open && step === 'paste' && (
        <Modal title="Import Barcodes" onClose={close} headerAction={sourceLink}>
          <div
            className={'flex-1 overflow-y-auto p-5 ' + (dragging ? 'outline-dashed outline-2 -outline-offset-4 outline-brand' : '')}
            onPaste={onPaste}
            onDragOver={(e) => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); setDragging(true); } }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
            onDrop={onDrop}
          >
            <p className="mb-3 text-[13px] text-inkmuted">
              Open the Barcode Report on erp.orbiteerp.com (the button above) and copy either the whole report table - from
              the Barcode heading to the last row - or one barcode&apos;s Details page, and paste it below, or choose the
              report&apos;s Excel file. A barcode this ERP does not hold is seeded; for one it holds you see its saved data beside
              the pasted data and choose what to replace. You can also paste (Ctrl+V) or drop a screenshot: a screenshot of the
              report table is read row by row, any other image only has its barcode looked up. Nothing is saved until you
              check the preview and press Import.
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
            <textarea
              value={paste}
              autoFocus
              rows={12}
              readOnly={busy}
              placeholder="Paste the Barcode Report table, or one barcode's Details page, here - or paste a screenshot of it (Ctrl+V)..."
              onChange={(e) => {
                const next = e.target.value;
                /* text replaced as a whole is the operator's own again */
                if (!next.trim() || (textOrigin === 'ocr' && paste.trim() && !next.includes(paste.trim().slice(0, 40)) && next.length > 40)) setTextOrigin('text');
                setPaste(next);
                setError('');
              }}
              className="w-full resize-y rounded-md border border-linestrong p-2.5 font-mono text-[12.5px] leading-[1.5]"
              aria-label="Barcode Report table"
            />
            {textOrigin === 'ocr' && hasText && (
              <p className="mt-1 text-[12px] text-[#8a5a00]">
                This text was read from an image, and an image&apos;s rules stay with it: a report table is imported only once
                you confirm you compared it with the image (its TOTAL row is checked again); anything else only has its
                barcode looked up.
              </p>
            )}
            <label htmlFor="barcode-import-barcode" className="mb-1 mt-2 block text-[13px] text-ink">
              Barcode <span className="text-[12px] text-inkmuted">- a Details page&apos;s number when the page does not show one, or a barcode to look up with an image (not used for a report table)</span>
            </label>
            <input
              id="barcode-import-barcode"
              value={barcode}
              readOnly={busy}
              onChange={(e) => { setBarcode(e.target.value); setError(''); }}
              className="f-input w-full sm:w-[260px]"
              placeholder="e.g. 9A2890"
            />
            {images.length > 0 && (
              <div className="mt-3 rounded border border-line bg-[#f7f9fc] p-3" aria-label="Pasted report images">
                <div className="mb-2 flex items-center justify-between text-[12.5px]">
                  <span className="font-semibold text-ink">
                    Image input detected - {plural(images.length, 'image')}
                    {replaceNext ? <span className="ml-2 font-normal text-[#8a5a00]">(adding an image now replaces {images.length > 1 ? 'these' : 'this one'})</span> : null}
                  </span>
                  <button type="button" className="btn" onClick={() => { dropImages(); setReplaceNext(false); setError(''); }} disabled={busy}>
                    <Icon name="trash" size={14} /> Remove {images.length > 1 ? 'Images' : 'Image'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {images.map((img) => (
                    <div key={img.id} className="relative w-[220px] rounded border border-line bg-white p-1">
                      <img src={img.url} alt={img.name} className="h-[120px] w-full rounded object-contain" />
                      <div className="mt-1 truncate text-[11px] text-inkmuted" title={img.name}>{img.name} · {(img.size / 1024).toFixed(0)} KB</div>
                      <button type="button" onClick={() => removeImage(img.id)} disabled={busy} aria-label={`Remove ${img.name}`}
                        className="absolute right-1 top-1 rounded bg-white/90 px-1.5 text-[13px] leading-5 text-inkmuted shadow hover:text-danger">×</button>
                    </div>
                  ))}
                </div>
                {hasText && (
                  /* both given: which one Check reads - never silently mixed */
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-[12.5px]">
                    <span className="text-[#8a5a00]">Text input detected as well - check:</span>
                    <label className="flex items-center gap-1"><input type="radio" name="import-source" checked={source === 'image'} disabled={busy} onChange={() => setSource('image')} /> the image{images.length > 1 ? 's' : ''}</label>
                    <label className="flex items-center gap-1"><input type="radio" name="import-source" checked={source === 'text'} disabled={busy} onChange={() => setSource('text')} /> the pasted text</label>
                  </div>
                )}
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px] text-inkmuted">
              <span>or</span>
              <button type="button" className="btn" onClick={() => imageRef.current?.click()} disabled={busy}>
                <Icon name="image" size={14} /> Choose Image
              </button>
              <input ref={imageRef} type="file" accept={IMAGE_ACCEPT} multiple onChange={pickImages} className="hidden" aria-label="Barcode Report image" />
              <span>or</span>
              <button type="button" className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>
                <Icon name="file" size={14} /> Choose Excel file
              </button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={pickFile} className="hidden" aria-label="Barcode Report Excel file" />
              {fileName && <span>{fileName}</span>}
            </div>
            {error && <div className="flash flash-err mt-3">{error}</div>}
            {ocr && <OcrPanel ocr={ocr} onEdit={editExtracted} busy={busy} />}
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-3">
            <button type="button" className="btn" onClick={close} disabled={busy}>Cancel</button>
            <button type="button" className="btn btn-primary flex h-[38px] min-w-[160px] justify-center" onClick={runCheck} disabled={busy}>
              {busy ? <span className="spin" /> : <Icon name="check" size={14} />} {busy && stage ? stage : 'Check'}
            </button>
          </div>
        </Modal>
      )}

      {open && step === 'review' && review && lookupMode && (
        <Modal title="Barcode Import Preview" onClose={close} size="lg" headerAction={sourceLink}>
          <div className="flex-1 overflow-y-auto p-5">
            {lookupRows.length > 0 && (
              <p className="mb-2 text-[13px] text-inkmuted">
                {read?.origin === 'ocr' ? 'This text was read from an image, which' : 'This image is not a Barcode Report table, so it'} only
                identifies a barcode: every value below is this ERP&apos;s own, looked up by the barcode - none is read from the
                image, and nothing is imported from it.
                {review.location ? <> Looked up for <span className="font-semibold text-ink">{review.location}</span>&apos;s business.</> : null}
              </p>
            )}
            {read?.ocr && <OcrPanel ocr={read.ocr} found={imageRows.length} onEdit={editExtracted} busy={busy} />}
            {imageStrip}
            {noBarcode && <NoBarcode detection={read?.detection} origin={read?.origin} />}
            {!noBarcode && read?.detection?.empty?.length > 0 && (
              <div className="mt-2 text-[12.5px] text-[#8a5a00]">No valid barcode detected in: {read.detection.empty.join(', ')}.</div>
            )}
            {lookupRows.length > 0 && <LookupTable rows={lookupRows} />}
            <Detection read={read} rows={rows} />
            {error && <div className="flash flash-err mt-3">{error}</div>}
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-3">
            <button type="button" className="btn" onClick={back} disabled={busy}>
              <Icon name="back" size={14} /> Back
            </button>
            <button type="button" className="btn btn-primary" onClick={close} disabled={busy}>Close</button>
          </div>
        </Modal>
      )}

      {open && step === 'review' && review && !lookupMode && (
        <Modal title="Barcode Import Preview" onClose={close} size="lg" headerAction={sourceLink}>
          <div className="flex-1 overflow-y-auto p-5">
            <div className="mb-2 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
              <span className="text-inkmuted">Import into: <span className="font-semibold text-ink">{review.location}</span></span>
              <span className="text-inkmuted">Source: <span className="font-semibold text-ink">{sourceText}</span></span>
            </div>
            <p className="mb-2 text-[12.5px] text-inkmuted">
              A barcode this ERP does not hold is ready to import (seeded) - in stock where the source still holds it, or kept as
              history when none is left. For a barcode it already holds, its existing data is shown beside the imported data:
              a blank the import only fills is ticked, a saved value it would replace waits for KEEP EXISTING or REPLACE. Item,
              quantity and UOM are never changed, and masters are never created or changed.
              {fromImage ? ' Rows read from an image never change a barcode already here - their values are only shown.' : ''}
            </p>
            {read?.ocr && <OcrPanel ocr={read.ocr} records={read.records.length} flagged={read.records.filter((r) => r.review?.some((x) => x.field === 'barcode')).length}
              totals={read.records.some((r) => r.review?.some((x) => x.field === 'qty'))} onEdit={editExtracted} busy={busy} />}
            {imageStrip}
            {fromImage && (
              <label className="my-2 flex items-start gap-2 rounded border border-[#e7c96b] bg-[#fff8e6] px-3 py-2 text-[12.5px] text-ink">
                <input type="checkbox" checked={compared} onChange={(e) => setCompared(e.target.checked)} className="mt-0.5" aria-label="I compared the barcodes with the image" />
                <span>
                  I have compared every barcode and quantity above with the image{read?.origin === 'ocr' ? ' it was read from' : ''}. OCR
                  can read a character wrongly and still be sure of it, so rows read from an image are only imported once you
                  confirm this - correct anything under View Extracted Text first.
                </span>
              </label>
            )}
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
                {needsDecision.length > 1 ? 'already exist' : 'already exists'} in this ERP with different saved data. Do you want to replace
                the existing data with the imported data? Choose KEEP EXISTING or REPLACE on {needsDecision.length > 1 ? 'each' : 'it'} below
                (left undecided, the existing data is kept).
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
                  const said = r.sources?.barcode && r.sources.barcode !== 'import_column' ? SOURCE_WORDS[r.sources.barcode] : '';
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
                      <td className="border border-line px-2 py-1.5 font-mono">
                        {r.barcode || '—'}
                        {said ? <div className="font-sans text-[11px] text-inkmuted">{said}</div> : null}
                      </td>
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
              <p className="mt-1 text-[12px] text-inkmuted">{plural(read.ignored, 'line')} left out: totals, repeated headings, rows copied twice, or lines that are not barcodes (see Barcode detection).</p>
            )}
            {read?.columns?.length > 0 && (
              <p className="mt-1 text-[12px] text-inkmuted">
                Read: {read.columns.filter((c) => c.field).map((c) => (c.heading === FIELD_LABELS[c.field] ? c.heading : `${c.heading} → ${FIELD_LABELS[c.field]}`)).join(', ')}.
              </p>
            )}
            <Detection read={read} rows={rows} open={read?.kind === 'details'} />
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
              disabled={busy || (adding + replacing + filling === 0) || (fromImage && !compared)}
              title={fromImage && !compared ? 'Confirm you compared the barcodes with the image first' : undefined}
            >
              {busy ? <span className="spin" /> : <Icon name="check" size={14} />}
              {adding + replacing + filling === 0
                ? ' Nothing to import'
                : ' ' + [adding ? `Import ${adding}` : '', replacing ? `Replace ${replacing}` : '', filling ? `Fill ${filling}` : ''].filter(Boolean).join(', ')}
            </button>
          </div>
        </Modal>
      )}

      {open && step === 'review' && confirming && (
        <Modal title="Replace existing barcode data?" onClose={() => setConfirming(false)} size="md">
          <div className="flex-1 overflow-y-auto p-5 text-[13px]">
            {changedRows.filter((r) => replacesOf(r).length).map((r) => (
              <div key={r.key} className="mb-3">
                <div className="font-semibold">Barcode: <span className="font-mono">{r.barcode}</span>{r.identity?.state === 'different' ? <span className="ml-2 text-danger">- different goods here ({r.existing?.itemCode})</span> : null}</div>
                <div className="text-inkmuted">The following eligible fields will be replaced:</div>
                <ul className="ml-5 list-disc">
                  {replacesOf(r).filter((d) => !(TWIN_OF.has(d.field) && replacesOf(r).some((m) => TWINS[m.field] === d.field))).map((d) => (
                    <li key={d.field}>{d.label}: <span className="line-through">{d.local || '—'}</span> → <span className="font-semibold">{d.incoming}</span></li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="font-semibold">Master data will NOT be changed.</p>
            <p className="text-inkmuted">Item, quantity and UOM stay as they are here; Item, Supplier, HSN, GST, UOM, group and price masters are never touched.</p>
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-3">
            <button type="button" className="btn" onClick={() => setConfirming(false)} disabled={busy}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={runImport} disabled={busy}>
              {busy ? <span className="spin" /> : null} Confirm replace
            </button>
          </div>
        </Modal>
      )}

      {open && step === 'done' && result && (
        <Modal title="Import Successful" onClose={close} size="md">
          <div className="flex-1 overflow-y-auto p-5">
            <div className="flash flash-ok">
              {[result.inserted ? `${plural(result.inserted, 'barcode')} seeded` : '', result.replaced ? `${result.replaced} replaced` : '',
                result.filled ? `${result.filled} filled` : ''].filter(Boolean).join(', ') || 'Nothing was changed'}.
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
    </>
  );
}

/* One row opened: for a barcode already here, its EXISTING DATA beside the
   IMPORTED DATA, field by field - each difference with its own tick (fill /
   replace), a value that is the same shown as "No change", and item /
   quantity / UOM as never changed by an import. For a new barcode, what it
   will be seeded as. */
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
  ) : <span className="text-inkmuted">{x.fromImage ? 'read from an image - not changed' : 'not changed by an import'}</span>);
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
              <div className="font-semibold">SUPPLIER DETAILS</div>
              <div>Supplier: {d.supplier || '—'}</div>
              <div>Tax Region: {d.taxRegion || '—'}</div>
              {d.designNo ? <div>Design: {d.designNo}</div> : null}
              {d.pma ? <div>P-M-F: {d.pma}</div> : null}
            </div>
          ) : null}
          {row.details ? (
            <div>
              <div className="font-semibold">STOCK SUMMARY</div>
              <div>Location: {held?.location || (d.stock?.[0]?.location) || (d.movements?.at(-1)?.location) || '—'}{d.movements?.at(-1)?.stockPoint ? ` · ${d.movements.at(-1).stockPoint}` : ''}</div>
              <div>Receipts: {totals?.receipts ?? '—'} · Issues: {totals?.issues ?? '—'} · Current balance: {totals?.balance ?? '—'}</div>
              <div>{plural((d.movements || []).length, 'movement row')} · {held ? `in stock: ${held.qty}` : 'no stock left - kept as history'}</div>
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

/* No barcode on the image: said once, plainly - no row is made of what it
   shows, and what to do instead. */
function NoBarcode({ detection, origin }) {
  const text = origin === 'ocr';
  return (
    <div className="mt-3 rounded border border-[#f1b0b0] bg-[#fdecec] px-4 py-3" role="alert" aria-label="No valid barcode detected">
      <div className="text-[14px] font-bold uppercase tracking-wide text-danger">{OCR_MESSAGES.noBarcodeTitle}</div>
      {detection?.details && (
        <p className="mt-1 text-[13px] text-ink">{text ? 'The text read from the image contains item details, but no valid barcode was detected.' : OCR_MESSAGES.noBarcodeDetails}</p>
      )}
      <p className="mt-1 text-[13px] text-ink">{text ? 'No valid barcode detected in the text read from the image.' : OCR_MESSAGES.noBarcode}</p>
      <p className="mt-1 text-[12.5px] text-inkmuted">
        Nothing was imported, and no row was made from the image. Go Back to upload another image (it replaces this one), or type
        the barcode in the Barcode box to look it up. To import this item, copy its Details page (or its row of the Barcode
        Report) on erp.orbiteerp.com (the button above) and paste the text here.
      </p>
    </div>
  );
}

/* The barcodes an image showed, as this ERP holds them - every value is
   this ERP's own (looked up), none is the image's. */
function LookupTable({ rows }) {
  return (
    <table className="mt-3 w-full border-collapse text-[12.5px]" aria-label="Barcodes looked up">
      <thead>
        <tr className="bg-[#f7f9fc] text-left">
          <th className="border border-line px-2 py-2">Status</th>
          <th className="border border-line px-2 py-2">Barcode</th>
          <th className="border border-line px-2 py-2">Item Code <span className="font-normal text-inkmuted">(this ERP)</span></th>
          <th className="border border-line px-2 py-2">Description</th>
          <th className="border border-line px-2 py-2 text-right">Qty</th>
          <th className="border border-line px-2 py-2">UOM</th>
          <th className="border border-line px-2 py-2 text-right">Retail Price</th>
          <th className="border border-line px-2 py-2">In this ERP</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const look = LOOKUP[r.lookup?.outcome] || LOOKUP.missing;
          return (
            <tr key={r.line + ':' + r.key} data-status={r.status} data-outcome={r.lookup?.outcome}>
              <td className="border border-line px-2 py-1.5">
                <span className={'whitespace-nowrap rounded px-1.5 py-0.5 text-[11.5px] font-semibold ' + look.tone}>{look.label}</span>
                {r.lookup?.outcome === 'unconfirmed' ? <div className="text-[11px] text-inkmuted">not confirmed</div> : null}
              </td>
              <td className="border border-line px-2 py-1.5 font-mono">
                {r.barcode}{(r.also || []).map((b) => <div key={b}>{b}</div>)}
                <div className="font-sans text-[11px] text-inkmuted">
                  {r.candidate?.source === 'typed' ? 'typed by you' : `read from the image (${SOURCE_WORDS[r.candidate?.source] || 'printed on its own'})`}
                  {r.candidate?.confidence !== null && r.candidate?.confidence !== undefined ? ` · OCR ${r.candidate.confidence}% sure` : ''}
                </div>
              </td>
              <td className="border border-line px-2 py-1.5">{r.values.itemCode || '—'}</td>
              <td className="border border-line px-2 py-1.5">{r.values.description || '—'}</td>
              <td className="border border-line px-2 py-1.5 text-right">{r.values.qty || '—'}</td>
              <td className="border border-line px-2 py-1.5">{r.values.uom || '—'}</td>
              <td className="border border-line px-2 py-1.5 text-right">{r.values.retailPrice || '—'}</td>
              <td className="border border-line px-2 py-1.5">
                <div className={['different', 'missing'].includes(r.lookup?.outcome) ? 'text-danger' : 'text-inkmuted'}>{r.reason}</div>
                {r.note ? <div className="text-[#8a5a00]">{r.note}</div> : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* BARCODE DETECTION - what was read and what became of it, for every kind
   of input: the values offered as a barcode (and from where), the ones
   that are not barcodes and why, the barcode taken, its lookup, and where
   each value of the final row came from. Shown, never logged. */
function Detection({ read, rows, open = false }) {
  const d = read?.detection;
  if (!d) return null;
  const refused = [...(d.rejected || []), ...rows.filter((r) => r.status === 'rejected').map((r) => ({ value: r.barcode, reason: r.reason, line: r.candidate?.line }))];
  const taken = rows.filter((r) => r.status !== 'rejected');
  const src = (s) => (s ? SOURCE_WORDS[s] || s : '—');
  return (
    <details className="mt-3 rounded border border-line bg-[#f7f9fc] px-3 py-2 text-[12.5px]" aria-label="Barcode detection" open={open || undefined}>
      <summary className="cursor-pointer font-semibold text-ink">
        Barcode detection - {plural((d.candidates || []).length, 'candidate')}, {refused.length} not taken as a barcode
        {taken.length === 1 && taken[0].barcode ? ` - selected: ${taken[0].barcode} (${src(taken[0].sources?.barcode)})` : ''}
      </summary>
      <div className="mt-2 space-y-2">
        <div>
          <div className="font-semibold">Candidates</div>
          {(d.candidates || []).length ? (
            <ul className="ml-4 list-disc">
              {d.candidates.slice(0, 40).map((c, i) => (
                <li key={c.value + i}>
                  <span className="font-mono">{c.value}</span> - {SOURCE_WORDS[c.source] || c.source}
                  {c.image && d.images > 1 ? `, ${c.image}` : ''}{c.line ? `, line ${c.line}` : ''}
                  {c.confidence !== null && c.confidence !== undefined ? `, OCR ${Math.round(c.confidence)}% sure` : ''}
                </li>
              ))}
            </ul>
          ) : <div className="text-inkmuted">none</div>}
        </div>
        <div>
          <div className="font-semibold">Not taken as a barcode</div>
          {refused.length ? (
            <ul className="ml-4 list-disc">
              {refused.slice(0, 60).map((x, i) => (
                <li key={String(x.value) + i}><span className="font-mono">{x.value}</span> - {x.reason}{x.image && d.images > 1 ? ` (${x.image})` : ''}{x.line ? ` (line ${x.line})` : ''}</li>
              ))}
            </ul>
          ) : <div className="text-inkmuted">none</div>}
          {(d.skipped?.filters || d.skipped?.movements) ? (
            <div className="text-inkmuted">
              Not looked at: {[d.skipped.filters && plural(d.skipped.filters, 'line') + ' of the Filters panel', d.skipped.movements && plural(d.skipped.movements, 'movement row')].filter(Boolean).join(', ')}.
            </div>
          ) : null}
        </div>
        <div>
          <div className="font-semibold">Selected barcode{taken.length === 1 ? '' : 's'} and lookup result</div>
          {taken.length ? (
            <ul className="ml-4 list-disc">
              {taken.slice(0, 40).map((r) => (
                <li key={r.line + ':' + r.key}>
                  <span className="font-mono">{r.barcode}</span> ({src(r.sources?.barcode)}) - {r.reason || r.seriesNote || (STATUS[r.status]?.label ?? r.status)}
                  <div className="text-inkmuted">
                    Row: item {r.values?.itemCode || '—'} ({src(r.sources?.itemCode)}), qty {r.values?.qty || '—'} ({src(r.sources?.qty)}),
                    UOM {r.values?.uom || '—'} ({src(r.sources?.uom)}), retail price {r.values?.retailPrice || '—'} ({src(r.sources?.retailPrice)})
                  </div>
                </li>
              ))}
            </ul>
          ) : <div className="text-inkmuted">none</div>}
        </div>
      </div>
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

/* What OCR made of the screenshots: the steps done, how sure it was, and the
   text it read - to compare with the image, and to correct as text.
   `records` - a report table's rows; `found` - an image's barcodes looked up. */
function OcrPanel({ ocr, records = null, flagged = 0, totals = false, found = null, onEdit, busy = false }) {
  if (!ocr) return null;
  const poor = ocr.confidence < POOR_CONFIDENCE;
  return (
    <div className="mt-3 rounded border border-line bg-[#f7f9fc] px-3 py-2 text-[12.5px]" aria-label="Image reading">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <span className="text-okgreen">✓ Image detected</span>
        <span className="text-okgreen">✓ OCR completed ({ocr.confidence}% sure)</span>
        {records !== null && <span className="text-okgreen">✓ Barcode report detected</span>}
        {records !== null && <span className="font-semibold text-ink">Records found: {records}</span>}
        {found !== null && (
          <span className={found ? 'font-semibold text-ink' : 'font-semibold text-danger'}>
            Barcode detection: {found ? `${plural(found, 'barcode')} found` : 'no valid barcode'}
          </span>
        )}
      </div>
      {flagged > 0 && <div className="mt-1 text-[#8a5a00]">{OCR_MESSAGES.review} {plural(flagged, 'barcode')} could not be read with confidence - see the rows below.</div>}
      {totals && <div className="mt-1 text-[#8a5a00]">The rows do not add up to the image&apos;s TOTAL row - a number was misread, or the screenshot shows only part of the report; see the rows below.</div>}
      {poor && <div className="mt-1 text-[#8a5a00]">{OCR_MESSAGES.poor}</div>}
      <details className="mt-1">
        <summary className="cursor-pointer text-brand-link">View Extracted Text</summary>
        <pre className="mt-1 max-h-[220px] overflow-auto whitespace-pre-wrap rounded border border-line bg-white p-2 font-mono text-[11.5px] leading-[1.45]">{ocr.text}</pre>
        <button type="button" className="btn mt-1" onClick={onEdit} disabled={busy}>
          <Icon name="pencil" size={14} /> Edit as text
        </button>
      </details>
    </div>
  );
}
