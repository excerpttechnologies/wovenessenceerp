// 'use client';
// /* TEMPORARY QA HARNESS - delete after verifying the Excel import fix.
//    Renders the REAL GRC Barcode Generation page against an in-memory database
//    kept in sessionStorage (so it survives a browser refresh). Nothing reaches
//    MongoDB. Uses the REAL Export Excel file (captured from the download), edits
//    it with SheetJS, imports it, Submits, and checks the grid after the reload
//    and after a refresh. */
// import { useEffect, useState } from 'react';
// import * as XLSX from 'xlsx';
// import { ScopeProvider } from '@/components/ScopeContext';
// import GrcBarcodeGenerationPage from '@/app/admin/transaction/purchase/grc/[id]/barcode-generation/page';

// const DB_KEY = 'qa-grc-db';
// const OUT_KEY = 'qa-out';
// const PHASE_KEY = 'qa-phase';

// const doc = (id, bc, retail, offer, extra = {}) => ({
//   _id: id, grcId: 'grc-qa', barcodeGenerated: bc, barcodeNo: bc, itemCode: '15-SA-PURE', itemName: '15-SA-PURE',
//   printDescription: 'PURE SILK SAREE', supplierDescription: 'PURE SILK SAREE', qty: '1', uom: 'PC', hsn: '5007', gst: '5',
//   purRate: '10000', finalNet: '10000', encodedPurRate: 'A0000', retailPrice: retail, offerPrice: offer, wspPrice: '11500',
//   dpPrice: '13000', p_m_f: '', billSlNo: '1', batchUnique: 'unique', status: 'IN_STOCK', ...extra,
// });
// const SEED = () => ({
//   grc: { _id: 'grc-qa', grcNumber: '05167', supplierCode: 'G1', supplierName: 'QA SUPPLIER', supplierMarkup: {} },
//   rows: [
//     doc('d1', '9A0001', '18000', '16200.00'),
//     doc('d2', '9A0002', '18000', '18000'),
//     doc('d3', '9A0003', '18000', '18000'),
//     doc('d4', 'pr0377su', '15480', '13897.79', { purRate: '8400', finalNet: '8400', encodedPurRate: 'HD00', wspPrice: '9660', dpPrice: '10920' }),
//   ],
// });
// const loadDb = () => JSON.parse(sessionStorage.getItem(DB_KEY) || 'null') || SEED();
// const saveDb = (db) => sessionStorage.setItem(DB_KEY, JSON.stringify(db));

// /* the same field whitelist buildDocs (app/api/barcode-generation/route.js) writes */
// const toDoc = (r, i) => ({
//   _id: 'saved-' + i + '-' + Date.now(), grcId: 'grc-qa', barcodeGenerated: r.barcodeGenerated || r.barcodeNo, barcodeNo: r.barcodeGenerated || r.barcodeNo,
//   itemCode: r.itemCode || '', itemName: r.itemName || '', printDescription: r.printDescription || '', supplierDescription: r.supplierDescription || '',
//   qty: String(r.qty ?? ''), uom: r.uom || '', hsn: r.hsn || '', gst: r.gst || '', p_m_f: r.p_m_f || '', billSlNo: r.billSlNo || '',
//   purRate: r.purRate || r.purchaseRate || '', finalNet: r.finalNet || r.finalPrice || '', encodedPurRate: r.encodedPurRate || r.encodedPurchaseRate || '',
//   retailPrice: r.retailPrice || '', offerPrice: r.offerPrice || '', wspPrice: r.wspPrice || '', dpPrice: r.dpPrice || '',
//   batchUnique: 'unique', status: 'IN_STOCK',
// });

// if (typeof window !== 'undefined' && !window.__qaStubbed) {
//   window.__qaStubbed = true;
//   const reply = (data, status = 200) => Promise.resolve(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }));
//   const realFetch = window.fetch.bind(window);
//   window.__qaCalls = [];
//   window.fetch = async (input, init = {}) => {
//     const raw = String(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
//     const url = raw.startsWith(window.location.origin) ? raw.slice(window.location.origin.length) : raw;
//     if (!url.startsWith('/api/')) return realFetch(input, init);   // Next's own requests go to the dev server
//     const method = (init.method || 'GET').toUpperCase();
//     window.__qaCalls.push(method + ' ' + url.split('?')[0]);
//     if (url.startsWith('/api/auth/me')) return reply({ user: { name: 'qa' } });
//     if (url.includes('ref=business')) return reply({ options: [{ value: 'b1', label: 'QA', isDefault: true }] });
//     if (url.includes('ref=companylocations')) return reply({ options: [{ value: 'l1', label: 'QA LOC' }] });
//     if (url.startsWith('/api/purchase-rate-code')) return reply({ doc: { isActive: true, digitMappings: { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E', 6: 'F', 7: 'G', 8: 'H', 9: 'I' } } });
//     if (url.startsWith('/api/grc/')) return reply(loadDb());
//     if (url.startsWith('/api/barcode-generation/reserve')) return reply({ rows: [] });
//     if (url.startsWith('/api/barcode-generation') && method === 'POST') {
//       const body = JSON.parse(init.body || '{}');
//       const db = loadDb();
//       db.rows = body.rows.map(toDoc);
//       saveDb(db);
//       window.__qaLastPost = body;
//       return reply({ ok: true, count: db.rows.length });
//     }
//     return reply({ rows: [], options: [], items: [], data: [], doc: null });
//   };
//   // capture the real Export Excel download instead of saving it to disk
//   const realCreate = URL.createObjectURL.bind(URL);
//   URL.createObjectURL = (blob) => { window.__qaExport = blob; return realCreate(blob); };
//   const realClick = HTMLAnchorElement.prototype.click;
//   HTMLAnchorElement.prototype.click = function click() { if (this.hasAttribute('download')) return undefined; return realClick.call(this); };
// }

// const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// async function waitFor(fn, ms = 15000) {
//   const t0 = Date.now();
//   while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await sleep(60); }
//   return null;
// }
// const buttons = () => [...document.querySelectorAll('button')];
// const banner = (label) => document.querySelector(`[aria-label="${label}"]`)?.parentElement?.querySelector('span')?.textContent?.trim() || '';

// async function rspColumn() {
//   buttons().find((b) => b.textContent.trim() === 'ITEM WITH BARCODE')?.click();
//   const table = await waitFor(() => [...document.querySelectorAll('table')].find((t) => t.textContent.includes('E-COMM')), 5000);
//   if (!table) return null;
//   return [...table.querySelectorAll('tbody tr')].map((tr) => tr.querySelectorAll('td')[10]?.textContent.trim());
// }

// async function exportWorkbook() {
//   window.__qaExport = null;
//   buttons().find((b) => b.textContent.includes('Export Excel'))?.click();
//   const blob = await waitFor(() => window.__qaExport, 5000);
//   if (!blob) throw new Error('Export Excel produced no file');
//   return XLSX.read(await blob.arrayBuffer(), { type: 'array' });
// }

// function setCell(wb, barcode, header, value) {
//   const ws = wb.Sheets['Barcode Items'];
//   const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
//   const c = aoa[0].indexOf(header);
//   const r = aoa.findIndex((row) => String(row[aoa[0].indexOf('Barcode No')]) === barcode);
//   ws[XLSX.utils.encode_cell({ r, c })] = typeof value === 'number' ? { t: 'n', v: value } : { t: 's', v: value };
// }

// async function upload(wb) {
//   document.querySelector('[aria-label="Dismiss import message"]')?.click();
//   await waitFor(() => !banner('Dismiss import message'), 3000);
//   const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
//   const file = new File([buf], 'barcode-items-template.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
//   const input = document.querySelector('input[type="file"]');
//   const dt = new DataTransfer();
//   dt.items.add(file);
//   input.files = dt.files;
//   input.dispatchEvent(new Event('change', { bubbles: true }));
//   return (await waitFor(() => banner('Dismiss import message'))) || 'NO MESSAGE';
// }

// async function submit() {
//   const before = window.__qaCalls.length;
//   buttons().find((b) => b.textContent.trim() === 'Submit' && b.className.includes('bg-green-600'))?.click();
//   (await waitFor(() => buttons().find((b) => b.textContent.trim() === 'Submit' && b.className.includes('bg-blue-600'))))?.click();
//   // the save, then the page's own re-read of the GRC
//   await waitFor(() => window.__qaCalls.slice(before).includes('POST /api/barcode-generation') &&
//     window.__qaCalls.slice(before).filter((c) => c.startsWith('GET /api/grc/')).length > 0, 10000);
//   await sleep(800);
//   return { error: banner('Dismiss save error'), calls: window.__qaCalls.slice(before).filter((c) => !c.includes('options') && !c.includes('auth')) };
// }

// async function phaseOne(setStatus) {
//   const out = {};
//   await waitFor(() => document.querySelector('input[type="file"]'), 20000);
//   await sleep(1500);
//   out.before = await rspColumn();

//   setStatus('export');
//   const exported = await exportWorkbook();
//   out.exportSheets = exported.SheetNames;
//   out.snapshotHidden = exported.Workbook?.Sheets?.[1]?.Hidden ?? null;
//   const pristine = XLSX.write(exported, { type: 'array', bookType: 'xlsx' });
//   const fresh = () => XLSX.read(pristine, { type: 'array' });

//   setStatus('invalid');
//   const bad = fresh();
//   setCell(bad, '9A0001', 'Retail Price', 'abc');
//   out.invalidImport = await upload(bad);
//   out.afterInvalid = await rspColumn();

//   setStatus('import');
//   const edited = fresh();
//   setCell(edited, '9A0001', 'Retail Price', 19000);   // the reported case: Retail Price column
//   setCell(edited, '9A0002', 'RSP', 20000);            // RSP column
//   setCell(edited, '9A0003', 'Retail Price', '21,000'); // typed with a separator
//   out.import = await upload(edited);
//   out.beforeSubmit = await rspColumn();

//   setStatus('submit');
//   out.submit = await submit();
//   out.postedRetail = (window.__qaLastPost?.rows || []).map((r) => [r.barcodeNo, r.retailPrice, r.offerPrice]);
//   out.dbAfterSave = loadDb().rows.map((r) => [r.barcodeNo, r.retailPrice, r.offerPrice, r.purRate]);
//   out.gridAfterReload = await rspColumn();

//   setStatus('reimport');
//   out.reimport = await upload(edited);                 // the same edited sheet again
//   out.gridAfterReimport = await rspColumn();
//   return out;
// }

// export default function QaImportTest() {
//   const [status, setStatus] = useState('start');
//   const [result, setResult] = useState('');
//   useEffect(() => {
//     (async () => {
//       if (sessionStorage.getItem(PHASE_KEY) !== 'refresh') {
//         sessionStorage.removeItem(DB_KEY);
//         const out = await phaseOne(setStatus);
//         sessionStorage.setItem(OUT_KEY, JSON.stringify(out));
//         sessionStorage.setItem(PHASE_KEY, 'refresh');
//         setStatus('refreshing');
//         window.location.reload();                        // the browser refresh
//         return;
//       }
//       setStatus('after refresh');
//       await waitFor(() => document.querySelector('input[type="file"]'), 20000);
//       await sleep(1200);
//       const out = JSON.parse(sessionStorage.getItem(OUT_KEY) || '{}');
//       out.gridAfterRefresh = await rspColumn();
//       out.dbAfterRefresh = loadDb().rows.map((r) => [r.barcodeNo, r.retailPrice]);
//       [DB_KEY, OUT_KEY, PHASE_KEY].forEach((k) => sessionStorage.removeItem(k));
//       setResult(JSON.stringify(out));
//       setStatus('done');
//     })().catch((e) => setResult(JSON.stringify({ fatal: String(e?.stack || e) })));
//   }, []);
//   return (
//     <ScopeProvider>
//       <pre id="qa-status">{status}</pre>
//       <pre id="qa-result" style={{ display: 'none' }}>{result}</pre>
//       <GrcBarcodeGenerationPage />
//     </ScopeProvider>
//   );
// }


















'use client';
/* TEMPORARY QA HARNESS - delete after verifying the Excel import fix.
   Renders the REAL GRC Barcode Generation page against an in-memory database
   kept in sessionStorage (so it survives a browser refresh). Nothing reaches
   MongoDB. Uses the REAL Export Excel file (captured from the download), edits
   it with SheetJS, imports it, Submits, and checks the grid after the reload
   and after a refresh. */
import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { ScopeProvider } from '@/components/ScopeContext';
import GrcBarcodeGenerationPage from '@/app/admin/transaction/purchase/grc/[id]/barcode-generation/page';
import { GRID_INPUT_FIELDS } from '@/lib/barcodeRowSync';
import { saveBatchTypeOf } from '@/lib/barcodeUnits';

const DB_KEY = 'qa-grc-db';
const OUT_KEY = 'qa-out';
const PHASE_KEY = 'qa-phase';

const doc = (id, bc, retail, offer, extra = {}) => ({
  _id: id, grcId: 'grc-qa', barcodeGenerated: bc, barcodeNo: bc, itemCode: '15-SA-PURE', itemName: '15-SA-PURE',
  printDescription: 'PURE SILK SAREE', supplierDescription: 'PURE SILK SAREE', qty: '1', uom: 'PC', hsn: '5007', gst: '5',
  purRate: '10000', finalNet: '10000', encodedPurRate: 'A0000', retailPrice: retail, offerPrice: offer, wspPrice: '11500',
  dpPrice: '13000', p_m_f: '', billSlNo: '1', batchUnique: 'unique', status: 'IN_STOCK', ...extra,
});
const SEED = () => ({
  grc: { _id: 'grc-qa', grcNumber: '05167', supplierCode: 'G1', supplierName: 'QA SUPPLIER', supplierMarkup: {} },
  rows: [
    doc('d1', '9A0001', '18000', '16200.00'),
    doc('d2', '9A0002', '18000', '18000'),
    doc('d3', '9A0003', '18000', '18000'),
    doc('d4', 'pr0377su', '15480', '13897.79', { purRate: '8400', finalNet: '8400', encodedPurRate: 'HD00', wspPrice: '9660', dpPrice: '10920' }),
  ],
});
const loadDb = () => JSON.parse(sessionStorage.getItem(DB_KEY) || 'null') || SEED();
const saveDb = (db) => sessionStorage.setItem(DB_KEY, JSON.stringify(db));

/* the same field whitelist buildDocs (app/api/barcode-generation/route.js) writes */
const toDoc = (r, i) => ({
  _id: 'saved-' + i + '-' + Date.now(), grcId: 'grc-qa', barcodeGenerated: r.barcodeGenerated || r.barcodeNo, barcodeNo: r.barcodeGenerated || r.barcodeNo,
  itemCode: r.itemCode || '', itemName: r.itemName || '', printDescription: r.printDescription || '', supplierDescription: r.supplierDescription || '',
  qty: String(r.qty ?? ''), uom: r.uom || '', hsn: r.hsn || '', gst: r.gst || '', p_m_f: r.p_m_f || '', billSlNo: r.billSlNo || '',
  purRate: r.purRate || r.purchaseRate || '', finalNet: r.finalNet || r.finalPrice || '', encodedPurRate: r.encodedPurRate || r.encodedPurchaseRate || '',
  retailPrice: r.retailPrice || '', offerPrice: r.offerPrice || '', wspPrice: r.wspPrice || '', dpPrice: r.dpPrice || '',
  sm: r.sm || '', noOfCuts: String(r.noOfCuts ?? '').trim(),
  ...Object.fromEntries(GRID_INPUT_FIELDS.map((key) => [key, String(r[key] ?? '').trim()])),
  batchUnique: saveBatchTypeOf(r), status: 'IN_STOCK',
});

if (typeof window !== 'undefined' && !window.__qaStubbed) {
  window.__qaStubbed = true;
  const reply = (data, status = 200) => Promise.resolve(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }));
  const realFetch = window.fetch.bind(window);
  window.__qaCalls = [];
  window.fetch = async (input, init = {}) => {
    const raw = String(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const url = raw.startsWith(window.location.origin) ? raw.slice(window.location.origin.length) : raw;
    if (!url.startsWith('/api/')) return realFetch(input, init);   // Next's own requests go to the dev server
    const method = (init.method || 'GET').toUpperCase();
    window.__qaCalls.push(method + ' ' + url.split('?')[0]);
    if (url.startsWith('/api/auth/me')) return reply({ user: { name: 'qa' } });
    if (url.includes('ref=business')) return reply({ options: [{ value: 'b1', label: 'QA', isDefault: true }] });
    if (url.includes('ref=companylocations')) return reply({ options: [{ value: 'l1', label: 'QA LOC' }] });
    if (url.startsWith('/api/purchase-rate-code')) return reply({ doc: { isActive: true, digitMappings: { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E', 6: 'F', 7: 'G', 8: 'H', 9: 'I' } } });
    if (url.startsWith('/api/grc/')) return reply(loadDb());
    if (url.startsWith('/api/barcode-generation/reserve')) return reply({ rows: [] });
    if (url.startsWith('/api/barcode-generation') && method === 'POST') {
      const body = JSON.parse(init.body || '{}');
      const db = loadDb();
      db.rows = body.rows.map(toDoc);
      saveDb(db);
      window.__qaLastPost = body;
      return reply({ ok: true, count: db.rows.length });
    }
    return reply({ rows: [], options: [], items: [], data: [], doc: null });
  };
  // capture the real Export Excel download instead of saving it to disk
  const realCreate = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (blob) => { window.__qaExport = blob; return realCreate(blob); };
  const realClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function click() { if (this.hasAttribute('download')) return undefined; return realClick.call(this); };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, ms = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await sleep(60); }
  return null;
}
const buttons = () => [...document.querySelectorAll('button')];
const banner = (label) => document.querySelector(`[aria-label="${label}"]`)?.parentElement?.querySelector('span')?.textContent?.trim() || '';

async function rspColumn() {
  buttons().find((b) => b.textContent.trim() === 'ITEM WITH BARCODE')?.click();
  const table = await waitFor(() => [...document.querySelectorAll('table')].find((t) => t.textContent.includes('E-COMM')), 5000);
  if (!table) return null;
  return [...table.querySelectorAll('tbody tr')].map((tr) => tr.querySelectorAll('td')[10]?.textContent.trim());
}

async function exportWorkbook() {
  window.__qaExport = null;
  buttons().find((b) => b.textContent.includes('Export Excel'))?.click();
  const blob = await waitFor(() => window.__qaExport, 5000);
  if (!blob) throw new Error('Export Excel produced no file');
  return XLSX.read(await blob.arrayBuffer(), { type: 'array' });
}

function setCell(wb, barcode, header, value) {
  const ws = wb.Sheets['Barcode Items'];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const c = aoa[0].indexOf(header);
  const r = aoa.findIndex((row) => String(row[aoa[0].indexOf('Barcode No')]) === barcode);
  ws[XLSX.utils.encode_cell({ r, c })] = typeof value === 'number' ? { t: 'n', v: value } : { t: 's', v: value };
}

async function upload(wb) {
  document.querySelector('[aria-label="Dismiss import message"]')?.click();
  await waitFor(() => !banner('Dismiss import message'), 3000);
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const file = new File([buf], 'barcode-items-template.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const input = document.querySelector('input[type="file"]');
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return (await waitFor(() => banner('Dismiss import message'))) || 'NO MESSAGE';
}

async function submit() {
  const before = window.__qaCalls.length;
  buttons().find((b) => b.textContent.trim() === 'Submit' && b.className.includes('bg-green-600'))?.click();
  (await waitFor(() => buttons().find((b) => b.textContent.trim() === 'Submit' && b.className.includes('bg-blue-600'))))?.click();
  // the save, then the page's own re-read of the GRC
  await waitFor(() => window.__qaCalls.slice(before).includes('POST /api/barcode-generation') &&
    window.__qaCalls.slice(before).filter((c) => c.startsWith('GET /api/grc/')).length > 0, 10000);
  await sleep(800);
  return { error: banner('Dismiss save error'), calls: window.__qaCalls.slice(before).filter((c) => !c.includes('options') && !c.includes('auth')) };
}

async function phaseOne(setStatus) {
  const out = {};
  await waitFor(() => document.querySelector('input[type="file"]'), 20000);
  await sleep(1500);
  out.before = await rspColumn();

  setStatus('export');
  const exported = await exportWorkbook();
  out.exportSheets = exported.SheetNames;
  out.snapshotHidden = exported.Workbook?.Sheets?.[1]?.Hidden ?? null;
  const pristine = XLSX.write(exported, { type: 'array', bookType: 'xlsx' });
  const fresh = () => XLSX.read(pristine, { type: 'array' });

  setStatus('invalid');
  const bad = fresh();
  setCell(bad, '9A0001', 'Retail Price', 'abc');
  out.invalidImport = await upload(bad);
  out.afterInvalid = await rspColumn();

  setStatus('import');
  const edited = fresh();
  setCell(edited, '9A0001', 'Retail Price', 19000);   // the reported case: Retail Price column
  setCell(edited, '9A0002', 'RSP', 20000);            // RSP column
  setCell(edited, '9A0003', 'Retail Price', '21,000'); // typed with a separator
  out.import = await upload(edited);
  out.beforeSubmit = await rspColumn();

  setStatus('submit');
  out.submit = await submit();
  out.postedRetail = (window.__qaLastPost?.rows || []).map((r) => [r.barcodeNo, r.retailPrice, r.offerPrice]);
  out.dbAfterSave = loadDb().rows.map((r) => [r.barcodeNo, r.retailPrice, r.offerPrice, r.purRate]);
  out.gridAfterReload = await rspColumn();

  setStatus('reimport');
  out.reimport = await upload(edited);                 // the same edited sheet again
  out.gridAfterReimport = await rspColumn();
  return out;
}

export default function QaImportTest() {
  const [status, setStatus] = useState('start');
  const [result, setResult] = useState('');
  useEffect(() => {
    (async () => {
      if (sessionStorage.getItem(PHASE_KEY) !== 'refresh') {
        sessionStorage.removeItem(DB_KEY);
        const out = await phaseOne(setStatus);
        sessionStorage.setItem(OUT_KEY, JSON.stringify(out));
        sessionStorage.setItem(PHASE_KEY, 'refresh');
        setStatus('refreshing');
        window.location.reload();                        // the browser refresh
        return;
      }
      setStatus('after refresh');
      await waitFor(() => document.querySelector('input[type="file"]'), 20000);
      await sleep(1200);
      const out = JSON.parse(sessionStorage.getItem(OUT_KEY) || '{}');
      out.gridAfterRefresh = await rspColumn();
      out.dbAfterRefresh = loadDb().rows.map((r) => [r.barcodeNo, r.retailPrice]);
      [DB_KEY, OUT_KEY, PHASE_KEY].forEach((k) => sessionStorage.removeItem(k));
      setResult(JSON.stringify(out));
      setStatus('done');
    })().catch((e) => setResult(JSON.stringify({ fatal: String(e?.stack || e) })));
  }, []);
  return (
    <ScopeProvider>
      <pre id="qa-status">{status}</pre>
      <pre id="qa-result" style={{ display: 'none' }}>{result}</pre>
      <GrcBarcodeGenerationPage />
    </ScopeProvider>
  );
}


