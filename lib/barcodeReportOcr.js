/* Barcode Report -> Import from a SCREENSHOT.

   The only thing an image adds to the import is this: IMAGE -> OCR -> TEXT.
   The text it produces goes through the very same reader as a paste
   (readImport in lib/barcodeReportImport.js, origin 'image'), then the same
   Check and preview - so an image is never read by other rules than text.
   What an image may bring in is narrower than text, though:
     a REPORT TABLE   its rows, every value from its column - after the
                      operator confirms they compared them with the image
     anything else    (an item's Details page, a sticker) ONLY its barcode,
                      found by detectBarcodes and looked up in this ERP: the
                      values shown are this ERP's, nothing is imported, and
                      with no barcode on it the preview says NO VALID
                      BARCODE DETECTED - never a row made up of the
                      screenshot's ECom ID, GRC No, HSN, prices or Qty.

   OCR runs IN THE BROWSER (tesseract.js, WebAssembly): the screenshot never
   leaves the machine. Its engine and English language data are fetched from
   the jsDelivr CDN the first time and cached by the browser.

   A screenshot of a table has no tabs in it, so the columns are rebuilt from
   where each word stands: words whose middles line up vertically are one row,
   and a gap wider than about the height of the text between two words is a
   column break - relative to the text's own size, never fixed coordinates.

   Nothing is ever "corrected": a barcode OCR was not sure of is flagged for
   review (review), and the server refuses a flagged row until it is fixed.
   And because OCR can be sure of a WRONG character - on a real screenshot it
   read 9A2313 as SA2313 with 98% confidence in the "S" - no image import is
   ever taken on OCR's word: the preview shows the image beside the rows and
   Import waits for the operator to confirm they compared them. */

import { isTableHeading, headingFields } from '@/lib/barcodeReportImport';

export const IMAGE_TYPES ={ 'image/png': ['png'], 'image/jpeg': ['jpg', 'jpeg'], 'image/webp': ['webp'] };
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const IMAGE_MAX_COUNT = 5;
/* a barcode read with less confidence than this is flagged, not imported */
export const BARCODE_MIN_CONFIDENCE = 85;
/* below this for the whole image, the screenshot is called unclear */
export const POOR_CONFIDENCE = 65;

export const OCR_MESSAGES = {
  noText: 'No report text detected.',
  noReadable: 'No readable report text was detected in this image.',
  noTable: 'No supported barcode report table was detected.',
  review: 'Some rows require review before import.',
  mixed: 'A screenshot of the report table and another kind of image cannot be checked together - check the report-table screenshots on their own, and the other images (a Details page, a sticker) on their own.',
  poor: 'Some text could not be read clearly. Please upload a higher-resolution screenshot or paste the report text.',
  failed: 'Could not process this image. Please try a clearer screenshot.',
  noBarcodeTitle: 'NO VALID BARCODE DETECTED',
  noBarcode: 'No valid barcode detected in this image.',
  noBarcodeDetails: 'The uploaded image contains item details, but no valid barcode was detected.',
};

/* Why a file cannot be read as a report image, or '' when it can: its type,
   its extension (the two must agree) and its size. Nothing else is opened. */
export function imageProblem(file) {
  if (!file) return 'No image was given.';
  const type = String(file.type || '').toLowerCase();
  const name = String(file.name || '');
  const ext = (name.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
  if (!IMAGE_TYPES[type]) return `"${name || 'That file'}" is not a PNG, JPG or WEBP image.`;
  /* a pasted screenshot comes as "image.png" or with no name at all */
  if (ext && !IMAGE_TYPES[type].includes(ext)) return `"${name}" is named .${ext} but is a ${type.split('/')[1].toUpperCase()} - rename it or save it again.`;
  if (!(file.size > 0)) return `"${name || 'That image'}" is empty.`;
  if (file.size > IMAGE_MAX_BYTES) return `"${name || 'That image'}" is ${(file.size / 1048576).toFixed(1)} MB - images up to ${IMAGE_MAX_BYTES / 1048576} MB can be read.`;
  return '';
}

const median = (values) => {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : 0;
};

/* OCR's words -> the lines of text a paste of the same table would give:
   rows by vertical position, cells by the gaps between words. Returns
   { text, lines: [{ text, cells: [{ text, confidence, x0, x1, h, words }] }] }
   - a cell's confidence is its least sure word's; x0 / x1 where it stands
   and h the height of its text, so a label can be paired with the value
   beside or under it (lib/barcodeReportImport.js detectBarcodes); words
   each word with its own confidence, so a barcode is judged on its own
   characters, not on a neighbour's. */
export function textFromWords(words) {
  const list = (words || [])
    .filter((w) => w && String(w.text ?? '').trim() !== '' && w.bbox)
    .map((w) => ({
      text: String(w.text).trim(),
      /* the least certain CHARACTER when tesseract gives them: its score for
         a whole word falls for anything unlike a dictionary word
         ("G1319*05197*1*2" scored 62% with every character 95-99%) */
      confidence: Array.isArray(w.symbols) && w.symbols.length
        ? Math.min(...w.symbols.map((s) => Number(s.confidence) || 0))
        : Number(w.confidence) || 0,
      x0: w.bbox.x0, x1: w.bbox.x1, y0: w.bbox.y0, y1: w.bbox.y1,
      yc: (w.bbox.y0 + w.bbox.y1) / 2,
      h: Math.max(1, w.bbox.y1 - w.bbox.y0),
    }));
  if (!list.length) return { text: '', lines: [] };
  const height = median(list.map((w) => w.h)) || 10;

  /* rows: a word belongs to the row whose middle is within ~half a text
     height of its own */
  const rows = [];
  [...list].sort((a, b) => a.yc - b.yc || a.x0 - b.x0).forEach((w) => {
    const row = rows[rows.length - 1];
    if (row && Math.abs(w.yc - row.yc) <= height * 0.6) {
      row.words.push(w);
      row.yc = row.words.reduce((a, x) => a + x.yc, 0) / row.words.length;
    } else rows.push({ yc: w.yc, words: [w] });
  });

  /* cells: words close together, a column break at a wide gap */
  const cellRows = rows.map((row) => {
    const sorted = row.words.sort((a, b) => a.x0 - b.x0);
    const cells = [];
    sorted.forEach((w, i) => {
      const gap = i ? w.x0 - sorted[i - 1].x1 : Infinity;
      /* an ordinary space is about a third of the text height; a column
         break is the width of a text height or more */
      if (!cells.length || gap > height * 0.9) {
        cells.push({ text: w.text, confidence: w.confidence, x0: w.x0, x1: w.x1, h: w.h, words: [{ text: w.text, confidence: w.confidence }] });
      } else {
        const c = cells[cells.length - 1];
        c.text += ' ' + w.text;
        c.confidence = Math.min(c.confidence, w.confidence);
        c.x1 = w.x1;
        c.h = Math.max(c.h, w.h);
        c.words.push({ text: w.text, confidence: w.confidence });
      }
    });
    return cells;
  });

  /* Under a table's heading row, each value goes to the column whose heading
     starts left of it - so an EMPTY cell (no words at all) stays an empty
     column instead of shifting every value after it one place left. */
  let heading = null;
  const lines = cellRows.map((cells) => {
    if (isTableHeading(cells.map((c) => c.text))) {
      heading = cells;
      return { text: cells.map((c) => c.text).join('\t'), cells };
    }
    if (!heading) return { text: cells.map((c) => c.text).join('\t'), cells };
    const placed = heading.map(() => []);
    cells.forEach((c) => {
      const middle = (c.x0 + c.x1) / 2;
      let col = 0;
      heading.forEach((h, j) => { if (h.x0 - height <= middle) col = j; });
      placed[col].push(c.text);
    });
    return { text: placed.map((parts) => parts.join(' ')).join('\t'), cells };
  });
  return {
    text: lines.map((l) => l.text).join('\n'),
    lines: lines.map((l) => ({
      text: l.text,
      cells: l.cells.map(({ text, confidence, x0, x1, h, words }) => ({ text, confidence, x0, x1, h, words })),
    })),
  };
}

/* The words of a tesseract page, whichever form it gave them in. */
export function wordsOfPage(page) {
  if (Array.isArray(page?.words) && page.words.length) return page.words;
  return (page?.blocks || []).flatMap((b) => (b.paragraphs || []).flatMap((p) => (p.lines || []).flatMap((l) => l.words || [])));
}

/* Each record whose barcode OCR was not sure of gets a review note - the
   value itself is left exactly as read. `lines` from textFromWords. */
export function flagUncertainBarcodes(records, lines, minConfidence = BARCODE_MIN_CONFIDENCE) {
  const cells = (lines || []).flatMap((l) => l.cells || []);
  /* a Details page prints "BARCODE : 9A2313" - the number is one word of a
     longer cell, so words are looked at too */
  return (records || []).map((record) => {
    const code = String(record?.values?.barcode ?? '').trim();
    if (!code) return record;
    const hits = cells.filter((c) => c.text === code || c.text.split(/\s+/).includes(code) || c.text.endsWith(' ' + code) || c.text.endsWith(':' + code));
    if (!hits.length) return record;
    const sure = Math.max(...hits.map((c) => c.confidence));
    if (sure >= minConfidence) return record;
    return {
      ...record,
      review: [...(record.review || []), {
        field: 'barcode',
        message: `OCR is not sure it read the barcode "${code}" right (${Math.round(sure)}% sure) - compare it with the image, correct it under View Extracted Text and Check again`,
      }],
    };
  });
}

/* THE SAFETY NET FOR NUMBERS. A decimal point OCR drops turns 2.00 into 200
   with full confidence, so confidence alone cannot catch it. The report
   prints a TOTAL row (Qty, and Final Net summed as rate x qty): when the rows
   read do not add up to it, something was misread - or the screenshot shows
   only part of the report - and every row is held for review. Returns the
   reason, or ''. */
export function totalsProblem(text, records) {
  const rows = String(text || '').split('\n').map((l) => l.split('\t'));
  const at = rows.findIndex((cells) => headingFields(cells));
  if (at < 0) return '';
  const fields = headingFields(rows[at]);
  const total = rows.slice(at + 1).find((cells) => /^(grand\s*)?totals?\b/i.test(String(cells[0] || '').trim()));
  if (!total) return '';
  const read = (value) => { const t = String(value ?? '').replace(/[,\s₹]/g, ''); return t !== '' && Number.isFinite(Number(t)) ? Number(t) : null; };
  const wrong = [];
  const printedQty = fields.includes('qty') ? read(total[fields.indexOf('qty')]) : null;
  if (printedQty !== null) {
    const sum = Math.round((records || []).reduce((a, r) => a + (Number(r.values?.qty) || 0), 0) * 1000) / 1000;
    if (Math.abs(sum - printedQty) > 0.001) wrong.push(`the quantities add up to ${sum}, the TOTAL row says ${printedQty}`);
  }
  const printedNet = fields.includes('finalNet') ? read(total[fields.indexOf('finalNet')]) : null;
  if (printedNet !== null) {
    const sum = Math.round((records || []).reduce((a, r) => a + (Number(r.values?.finalNet) || 0) * (Number(r.values?.qty) || 0), 0) * 100) / 100;
    if (Math.abs(sum - printedNet) > 0.01) wrong.push(`Final Net x Qty adds up to ${sum}, the TOTAL row says ${printedNet}`);
  }
  return wrong.length
    ? `The rows read from the image do not add up to its TOTAL row (${wrong.join('; ')}) - a number was misread, or the screenshot shows only part of the report. Compare with the image, correct it under View Extracted Text and Check again`
    : '';
}

/* Everything that holds an image's rows back for review: a barcode OCR was
   unsure of, rows that do not add up to the TOTAL row, a Details page whose
   movements do not add up to its totals. Values are never changed. */
export function reviewOcrRecords(records, read) {
  const flagged = flagUncertainBarcodes(records, read?.lines);
  const totals = totalsProblem(read?.text, flagged);
  return flagged.map((record) => {
    const extra = [];
    if (totals) extra.push({ field: 'qty', message: totals });
    if (record.details?.totals?.mismatches?.length) {
      extra.push({ field: 'movements', message: 'The movements read from the image do not add up to the page\'s totals - a number was misread. Compare with the image and correct it as text' });
    }
    return extra.length ? { ...record, review: [...(record.review || []), ...extra] } : record;
  });
}

/* How sure OCR was, over every word it read. */
export function confidenceOf(lines) {
  const cells = (lines || []).flatMap((l) => l.cells || []);
  return cells.length ? Math.round(cells.reduce((a, c) => a + c.confidence, 0) / cells.length) : 0;
}

/* How much a screenshot is scaled up before it is read: tesseract reads text
   best at about 30-40 px high, a desktop screenshot's is 11-14 px. Measured
   on a real Barcode Report screenshot (2262 px wide): 3x read every number
   and heading right; 2x lost decimal points; 4x misread UOM and quantities. */
export const ocrScale = (width) => (width <= 2700 ? 3 : width <= 4000 ? 2 : 1);

/* what tesseract is told: one block of text, the spaces between words kept,
   and the resolution the scaled image really has */
export const ocrParameters = (scale) => ({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1', user_defined_dpi: String(96 * scale) });

/* Grey pixels (one byte each) scaled up by `scale` - bicubic (Catmull-Rom),
   done here rather than by the browser's canvas: a canvas's smoothing blurs
   a decimal point away (2.00 was read as 200 in Chrome), and this gives the
   same pixels in every browser and in the tests. Separable: rows, then
   columns. */
export function upscaleGray(src, width, height, scale) {
  const W = Math.round(width * scale);
  const H = Math.round(height * scale);
  const weight = (t) => {
    const x = Math.abs(t);
    if (x < 1) return 1.5 * x * x * x - 2.5 * x * x + 1;
    if (x < 2) return -0.5 * x * x * x + 2.5 * x * x - 4 * x + 2;
    return 0;
  };
  /* for each output position along one axis: the 4 source positions and weights */
  const taps = (outSize, inSize) => Array.from({ length: outSize }, (_, o) => {
    const at = (o + 0.5) / scale - 0.5;
    const base = Math.floor(at);
    const idx = [];
    const w = [];
    for (let k = -1; k <= 2; k += 1) {
      idx.push(Math.min(inSize - 1, Math.max(0, base + k)));
      w.push(weight(at - (base + k)));
    }
    const sum = w.reduce((a, b) => a + b, 0);
    return { idx, w: w.map((v) => v / sum) };
  });
  const tx = taps(W, width);
  const ty = taps(H, height);
  const mid = new Float32Array(W * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < W; x += 1) {
      const { idx, w } = tx[x];
      mid[y * W + x] = src[row + idx[0]] * w[0] + src[row + idx[1]] * w[1] + src[row + idx[2]] * w[2] + src[row + idx[3]] * w[3];
    }
  }
  const out = new Uint8ClampedArray(W * H);
  for (let y = 0; y < H; y += 1) {
    const { idx, w } = ty[y];
    const r0 = idx[0] * W; const r1 = idx[1] * W; const r2 = idx[2] * W; const r3 = idx[3] * W;
    for (let x = 0; x < W; x += 1) {
      out[y * W + x] = mid[r0 + x] * w[0] + mid[r1 + x] * w[1] + mid[r2 + x] * w[2] + mid[r3 + x] * w[3];
    }
  }
  return { data: out, width: W, height: H };
}

/* ---------------------------------------------------------- browser ---- */

/* A screenshot prepared for OCR: turned grey, then scaled up (ocrScale) by
   upscaleGray. Browser only. */
async function prepared(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(ocrScale(bitmap.width), Math.floor(8000 / Math.max(bitmap.width, bitmap.height)) || 1);
  const source = document.createElement('canvas');
  source.width = bitmap.width;
  source.height = bitmap.height;
  const sctx = source.getContext('2d', { willReadFrequently: true });
  sctx.drawImage(bitmap, 0, 0);
  const px = sctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
  const grey = new Uint8ClampedArray(bitmap.width * bitmap.height);
  for (let i = 0, j = 0; j < grey.length; i += 4, j += 1) grey[j] = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
  bitmap.close?.();
  const big = upscaleGray(grey, source.width, source.height, scale);
  const canvas = document.createElement('canvas');
  canvas.width = big.width;
  canvas.height = big.height;
  const ctx = canvas.getContext('2d');
  const out = ctx.createImageData(big.width, big.height);
  for (let i = 0, j = 0; j < big.data.length; i += 4, j += 1) {
    out.data[i] = big.data[j]; out.data[i + 1] = big.data[j]; out.data[i + 2] = big.data[j]; out.data[i + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  return { canvas, scale };
}

/* The screenshots -> their text, in order, as a paste would give it. Browser
   only; `onStage(label)` is told what is happening. Returns { text, lines,
   confidence, words, images: [{ name, confidence, words }], pages: [{ name,
   text, lines, confidence, words }] } - each image also on its own (pages):
   every image is read by itself, so one image's labels, item name or table
   headings never apply to another's (components/BarcodeReportImport.jsx). */
export async function ocrImages(files, { onStage = () => {} } = {}) {
  const { createWorker } = await import('tesseract.js');
  onStage('Reading image...');
  const worker = await createWorker('eng', 1);
  try {
    const all = [];
    const images = [];
    const pages = [];
    for (const [i, file] of files.entries()) {
      onStage(files.length > 1 ? `Reading image ${i + 1} of ${files.length}...` : 'Reading image...');
      const { canvas, scale } = await prepared(file);
      await worker.setParameters(ocrParameters(scale));
      const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
      const read = textFromWords(wordsOfPage(data));
      all.push(...read.lines);
      const name = file.name || `image ${i + 1}`;
      const words = read.lines.reduce((a, l) => a + l.cells.length, 0);
      images.push({ name, confidence: confidenceOf(read.lines), words });
      pages.push({ name, text: read.text, lines: read.lines, confidence: confidenceOf(read.lines), words });
    }
    onStage('Detecting barcodes...');
    return {
      text: all.map((l) => l.text).join('\n'),
      lines: all,
      confidence: confidenceOf(all),
      words: all.reduce((a, l) => a + l.cells.length, 0),
      images,
      pages,
    };
  } finally {
    await worker.terminate();
  }
}
