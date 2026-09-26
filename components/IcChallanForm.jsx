// 'use client';
// import { useCallback, useEffect, useMemo, useState } from 'react';
// import { useRouter } from 'next/navigation';
// import Icon from './Icon';
// import Field from './Field';
// import MultiSelect from './MultiSelect';
// import { useScope } from './ScopeContext';
// import {
//   FIELDS as DC_FIELDS, GRID_COLS, INFO, BLANK_ROW,
//   computeTotals, num, money,
// } from '@/app/admin/transaction/intercompanysell/deliverychallan/fields';

// /* ==========================================================================
//    Inter company line-entry document - add / edit.

//    Shared by Delivery Challan and Auto Purchase Return: same header shape,
//    same scan-to-add grid, same totals block. The caller passes its own field
//    list through `cfg.fields`; omit it and the Delivery Challan spec is used,
//    so the challan pages need no change.

//    Three things this screen does that the generic TransactionFormView can't:

//      - the Location Name list depends on the Business chosen ON THIS FORM,
//        not on the business in the top bar. A plain `ref` field always scopes
//        to the top-bar business, so those two selectors are wired by hand.
//      - picking a Business copies its GSTIN and address into the two readonly
//        "Customer" boxes, the way the deployed screen does.
//      - every line figure (Final Rate, Before Tax, the three GST columns, Net
//        Amount) recalculates as you type, and the totals block follows.

//    The maths lives in deliverychallan/fields.js, which the API imports too,
//    so what you watch while typing is what gets stored.

//    NOTE: this file replaces the Phase 1 version. The only behavioural change
//    is that the header now renders `cfg.fields` in order rather than a
//    hardcoded arrangement - which also fixes the awkward conditional shuffle
//    the first version used to slot DC No in on the edit screen.
//    ========================================================================== */

// export default function IcChallanForm({ cfg, id }) {
//   const router = useRouter();
//   const scope = useScope();
//   const isEdit = Boolean(id);

//   const FIELDS = cfg.fields || DC_FIELDS;
//   const docNoKey = cfg.docNoKey || 'dcNo';
//   const docNoLabel = cfg.docNoLabel || 'DC No';

//   /* every header field except the two the form drives itself */
//   const rest = FIELDS.filter((f) => f.k !== 'toBusinessId' && f.k !== 'toLocationId');

//   const [data, setData] = useState(() => {
//     const d = {};
//     FIELDS.forEach((f) => {
//       d[f.k] = f.def === 'today'
//         ? new Date().toISOString().slice(0, 10)
//         : (f.def !== undefined ? f.def : '');
//     });
//     return d;
//   });

//   const [docNo, setDocNo] = useState('');
//   const [rows, setRows] = useState([]);
//   const [headDiscountPct, setHeadDiscountPct] = useState(0);
//   const [headRoffDiscount, setHeadRoffDiscount] = useState(0);

//   const [businesses, setBusinesses] = useState([]);
//   const [locations, setLocations] = useState([]);

//   const [scan, setScan] = useState('');
//   const [errors, setErrors] = useState({});
//   const [flash, setFlash] = useState(null);
//   const [saving, setSaving] = useState(false);

//   const set = (k, v) => {
//     setData((d) => ({ ...d, [k]: v }));
//     setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));
//   };

//   /* ------------------------------------------------- destination business */
//   useEffect(() => {
//     fetch('/api/options?ref=business')
//       .then((r) => r.json())
//       .then((d) => setBusinesses(d.options || []))
//       .catch(() => setBusinesses([]));
//   }, []);

//   /* locations of whichever business is picked on THIS form */
//   useEffect(() => {
//     if (!data.toBusinessId) { setLocations([]); return; }
//     fetch('/api/options?ref=companylocations&business=' + data.toBusinessId)
//       .then((r) => r.json())
//       .then((d) => setLocations(d.options || []))
//       .catch(() => setLocations([]));
//   }, [data.toBusinessId]);

//   /* GSTIN and address follow the chosen business */
//   const pickBusiness = async (v) => {
//     setData((d) => ({ ...d, toBusinessId: v, toLocationId: '' }));
//     setErrors((e) => ({ ...e, toBusinessId: undefined }));
//     if (!v) return;
//     try {
//       const r = await fetch('/api/business/' + v);
//       const { doc } = await r.json();
//       if (!doc) return;
//       setData((d) => ({
//         ...d,
//         customerGstn: doc.gstin || '',
//         customerAddress: [doc.addressLine1, doc.addressLine2, doc.city]
//           .filter(Boolean).join(', '),
//       }));
//     } catch { /* leave the two boxes as they are */ }
//   };

//   /* ------------------------------------------------------- load on edit -- */
//   useEffect(() => {
//     if (!id) return;
//     fetch(cfg.endpoint + '/' + id)
//       .then((r) => r.json())
//       .then((d) => {
//         if (!d.doc) return;
//         setData((prev) => {
//           const next = { ...prev };
//           Object.keys(next).forEach((k) => {
//             const v = d.doc[k];
//             if (v === null || v === undefined) return;
//             const t = FIELDS.find((f) => f.k === k)?.type;
//             next[k] = t === 'ref' ? String(v) : (t === 'date' ? String(v).slice(0, 10) : v);
//           });
//           return next;
//         });
//         setDocNo(d.doc[docNoKey] || '');
//         setRows(d.doc.items || []);
//         setHeadDiscountPct(d.doc.discountPercent ?? 0);
//         setHeadRoffDiscount(d.doc.roundOffDiscountAmt ?? 0);
//       });
//   }, [id, cfg.endpoint, docNoKey]);

//   /* ------------------------------------------------------------- rows ---- */
//   const setCell = (i, k, v) =>
//     setRows((prev) => prev.map((r, ri) => (ri === i ? { ...r, [k]: v } : r)));

//   const dropRow = (i) => setRows((prev) => prev.filter((_, ri) => ri !== i));

//   /* Scan / type an item code, Enter to add. Resolves against the Item master,
//      then joins HSN -> tax slab -> UOM -> RSP through /api/item/<id>/detail so
//      the line lands with its GST rates already filled. */
//   const addScanned = useCallback(async (code) => {
//     const term = String(code || '').trim();
//     if (!term) return;
//     setFlash(null);

//     try {
//       const r = await fetch(
//         '/api/item?perPage=1&search=' + encodeURIComponent(term)
//         + '&business=' + (scope.business || '')
//       );
//       const d = await r.json();
//       const hit = (d.rows || [])[0];
//       if (!hit) { setFlash({ type: 'err', msg: 'No item found for "' + term + '"' }); return; }

//       let detail = null;
//       try {
//         const dr = await fetch('/api/item/' + hit._id + '/detail');
//         detail = (await dr.json()).item;
//       } catch { /* fall back to the bare item below */ }

//       const slab = detail?.slabs?.[0] || null;

//       setRows((prev) => [...prev, {
//         ...BLANK_ROW,
//         itemId: String(hit._id),
//         itemCode: detail?.itemCode || hit.itemCode || term,
//         itemName: detail?.name || hit.name || '',
//         hsn: detail?.hsnCode || '',
//         uom: detail?.uom || '',
//         slabName: slab ? slab.name : '',
//         igstPct: slab ? slab.igst : 0,
//         cgstPct: slab ? slab.cgst : 0,
//         sgstPct: slab ? slab.sgst : 0,
//         /* pricing setup for an inter-company move has no Contact behind it,
//            so the item's RSP stands in - see the note in fields.js */
//         unitRate: detail?.rsp ?? hit.rsp ?? '',
//         availableQty: detail?.availableQty ?? null,
//         qty: 1,
//       }]);
//       setScan('');
//     } catch {
//       setFlash({ type: 'err', msg: 'Item lookup failed' });
//     }
//   }, [scope.business]);

//   /* ------------------------------------------------------------ totals --- */
//   const totals = useMemo(
//     () => computeTotals(rows, {
//       discountPercent: headDiscountPct,
//       roundOffDiscountAmt: headRoffDiscount,
//     }),
//     [rows, headDiscountPct, headRoffDiscount]
//   );

//   /* ------------------------------------------------------------- save ---- */
//   async function submit() {
//     setSaving(true);
//     setFlash(null);
//     try {
//       const lines = rows.map((r, i) => {
//         const c = totals.calc[i];
//         return {
//           itemId: r.itemId, itemCode: r.itemCode, itemName: r.itemName,
//           hsn: r.hsn, slabName: r.slabName, uom: r.uom,
//           qty: num(r.qty), availableQty: r.availableQty ?? null,
//           unitRate: num(r.unitRate),
//           discountPct: num(r.discountPct), discount: c.discount,
//           roffDiscount: num(r.roffDiscount),
//           finalRate: c.finalRate, beforeTax: c.beforeTax,
//           igstPct: num(r.igstPct), cgstPct: num(r.cgstPct), sgstPct: num(r.sgstPct),
//           igstAmount: c.igst, cgstAmount: c.cgst, sgstAmount: c.sgst,
//           netAmount: c.netAmount,
//         };
//       });

//       const payload = {
//         data: {
//           ...data,
//           items: lines,
//           taxableValue: totals.taxableValue,
//           discountPercent: num(headDiscountPct),
//           roundOffDiscountAmt: num(headRoffDiscount),
//           igstTotal: totals.igstTotal,
//           cgstTotal: totals.cgstTotal,
//           sgstTotal: totals.sgstTotal,
//           roundOff: totals.roundOff,
//           totalQty: totals.totalQty,
//           netValue: totals.netValue,
//         },
//         business: scope.business, location: scope.location, finYear: scope.finYear,
//       };

//       const r = await fetch(cfg.endpoint + (id ? '/' + id : ''), {
//         method: id ? 'PUT' : 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(payload),
//       });
//       const d = await r.json();

//       if (r.status === 422) {
//         setErrors(d.errors || {});
//         setFlash({ type: 'err', msg: 'Please correct the highlighted fields.' });
//         return;
//       }
//       if (!r.ok) { setFlash({ type: 'err', msg: d.error || 'Save failed' }); return; }

//       router.push(cfg.basePath + cfg.slugPath);
//     } finally {
//       setSaving(false);
//     }
//   }

//   /* the four numeric cells the user types into */
//   const NUMERIC = ['qty', 'unitRate', 'discountPct', 'roffDiscount'];

//   return (
//     <div className="card">
//       <div className="card-head">
//         <span className="card-title">{cfg.addTitle}</span>
//       </div>

//       <div className="card-body">
//         {flash && <div className={'flash ' + (flash.type === 'err' ? 'flash-err' : 'flash-ok')}>{flash.msg}</div>}

//         {/* ---------------------------------------------------- header --- */}
//         <div className="form-grid-4">
//           <div>
//             <label className="f-label">Business<span className="f-req">*</span></label>
//             <select
//               className="f-input"
//               value={data.toBusinessId || ''}
//               onChange={(e) => pickBusiness(e.target.value)}
//             >
//               <option value="">--Select--</option>
//               {businesses.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
//             </select>
//             {errors.toBusinessId && <div className="f-err">{errors.toBusinessId}</div>}
//           </div>

//           <div>
//             <label className="f-label">Location Name<span className="f-req">*</span></label>
//             <select
//               className="f-input"
//               value={data.toLocationId || ''}
//               onChange={(e) => set('toLocationId', e.target.value)}
//               disabled={!data.toBusinessId}
//             >
//               <option value="">--Select--</option>
//               {locations.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
//             </select>
//             {errors.toLocationId && <div className="f-err">{errors.toLocationId}</div>}
//           </div>

//           {/* issued by the server on save, so it only exists on the edit screen */}
//           {isEdit && (
//             <div>
//               <label className="f-label">{docNoLabel}<span className="f-req">*</span></label>
//               <input className="f-input bg-[#eff2f7] text-inkmuted" value={docNo} readOnly />
//             </div>
//           )}

//           {rest.map((f) => (
//             <Field key={f.k} f={f} value={data[f.k]} error={errors[f.k]} onChange={set} />
//           ))}
//         </div>

//         {/* ------------------------------------------------------ info --- */}
//         {cfg.showInfo !== false && (
//           <div className="info-box mt-4">
//             <div className="mb-1.5 flex items-center gap-1.5 font-bold underline">
//               <Icon name="eye" size={14} /> Info
//             </div>
//             <ol className="list-decimal pl-5">
//               {(cfg.info || INFO).map((t, i) => <li key={i} dangerouslySetInnerHTML={{ __html: t }} />)}
//             </ol>
//           </div>
//         )}

//         {/* ------------------------------------------------------ scan --- */}
//         <div className="kbd-hint">
//           <Icon name="eye" size={13} /> Shortcut: Press <span className="kbd">Enter</span> /
//           <span className="kbd">F9</span> / <span className="kbd">Tab</span>
//           to add item &amp; and <b>box must be in focus</b>.
//         </div>
//         <div className="mb-3 flex max-w-[760px]">
//           <input
//             className="f-input rounded-r-none"
//             placeholder="Enter item code"
//             value={scan}
//             onChange={(e) => setScan(e.target.value)}
//             onKeyDown={(e) => {
//               if (['Enter', 'F9', 'Tab'].includes(e.key)) { e.preventDefault(); addScanned(scan); }
//             }}
//           />
//           <button type="button" className="btn btn-dark rounded-l-none" onClick={() => addScanned(scan)}>
//             <Icon name="search" size={14} />
//           </button>
//         </div>

//         {/* ------------------------------------------------------ grid --- */}
//         <div className="overflow-x-auto">
//           <table className="dt">
//             <thead>
//               <tr>{COLS.map((c) => <th key={c}>{c}</th>)}</tr>
//             </thead>
//             <tbody>
//               {rows.length === 0 && (
//                 <tr><td colSpan={COLS.length} className="dt-empty">
//                     {cfg.emptyGrid || 'No Items Added'}
//                   </td></tr>
//               )}
//               {rows.map((r, i) => {
//                 const c = totals.calc[i];
//                 const over = r.availableQty !== null
//                   && r.availableQty !== undefined
//                   && num(r.qty) > num(r.availableQty);
//                 return (
//                   <tr key={i}>
//                     <td className="text-center">{i + 1}</td>
//                     <td>{r.itemCode}</td>
//                     <td>{r.itemName}</td>
//                     <td>{r.hsn}</td>
//                     <td>{r.slabName}</td>
//                     <td>{r.uom}</td>
//                     <td>
//                       <input
//                         type="number"
//                         className={'f-input h-8 w-[86px] ' + (over ? 'border-danger' : '')}
//                         value={r.qty ?? ''}
//                         onChange={(e) => setCell(i, 'qty', e.target.value)}
//                       />
//                       {/* the deployed screen prints the stock ceiling here;
//                           shown only when something supplied one */}
//                       {r.availableQty !== null && r.availableQty !== undefined && (
//                         <div className={'pt-0.5 text-[11px] ' + (over ? 'text-danger' : 'text-inkmuted')}>
//                           (Max: {r.availableQty})
//                         </div>
//                       )}
//                     </td>
//                     {['unitRate', 'discountPct', 'roffDiscount'].map((k) => (
//                       <td key={k}>
//                         <input
//                           type="number"
//                           className="f-input h-8 w-[86px]"
//                           value={r[k] ?? ''}
//                           onChange={(e) => setCell(i, k, e.target.value)}
//                         />
//                       </td>
//                     ))}
//                     <td className="text-right">{money(c.finalRate)}</td>
//                     <td className="text-right">{money(c.beforeTax)}</td>
//                     <td className="text-right">{money(c.igst)}</td>
//                     <td className="text-right">{money(c.cgst)}</td>
//                     <td className="text-right">{money(c.sgst)}</td>
//                     <td className="text-right font-bold">{money(c.netAmount)}</td>
//                     <td>
//                       <button type="button" className="act-btn bg-danger" onClick={() => dropRow(i)}>
//                         <Icon name="trash" size={12} />
//                       </button>
//                     </td>
//                   </tr>
//                 );
//               })}
//             </tbody>
//           </table>
//         </div>

//         {/* ---------------------------------------------------- totals --- */}
//         <div className="mt-5">
//           <table className="w-full border-collapse text-[13.5px]">
//             <tbody>
//               <tr className="border-b border-line">
//                 <td className="w-[38%] py-2 pr-3 text-right text-cell">Taxable Value</td>
//                 <td className="w-[22%]" />
//                 <td className="w-[18%] px-2" />
//                 <td className="w-[4%] text-center text-[#c07b2a]">+</td>
//                 <td className="py-2 pr-3 text-right">{money(totals.taxableValue)}</td>
//               </tr>
//               <tr className="border-b border-line">
//                 <td className="py-2 pr-3 text-right text-cell">Discount(%)</td>
//                 <td />
//                 <td className="px-2">
//                   <input
//                     type="number" className="f-input h-8 text-center"
//                     value={headDiscountPct}
//                     onChange={(e) => setHeadDiscountPct(e.target.value)}
//                   />
//                 </td>
//                 <td className="text-center text-[#c07b2a]">&minus;</td>
//                 <td className="py-2 pr-3 text-right">{money(totals.headDiscount)}</td>
//               </tr>
//               <tr className="border-b border-line">
//                 <td className="py-2 pr-3 text-right text-cell">RoundOff Discount(Amt)</td>
//                 <td />
//                 <td className="px-2">
//                   <input
//                     type="number" className="f-input h-8 text-center"
//                     value={headRoffDiscount}
//                     onChange={(e) => setHeadRoffDiscount(e.target.value)}
//                   />
//                 </td>
//                 <td className="text-center text-[#c07b2a]">&minus;</td>
//                 <td className="py-2 pr-3 text-right" />
//               </tr>

//               {(totals.cgstTotal > 0 || totals.sgstTotal > 0) && (
//                 <tr className="border-b border-line">
//                   <td className="py-2 pr-3 text-right text-cell" />
//                   <td />
//                   <td />
//                   <td className="text-center text-[#c07b2a]">+</td>
//                   <td className="py-2 pr-3 text-right">
//                     <span className="mr-4 text-cell">
//                       CGST + SGST ({totals.cgstPct} + {totals.sgstPct}) %
//                     </span>
//                     {money(totals.cgstTotal + totals.sgstTotal)}
//                   </td>
//                 </tr>
//               )}
//               {totals.igstTotal > 0 && (
//                 <tr className="border-b border-line">
//                   <td className="py-2 pr-3 text-right text-cell" />
//                   <td /><td />
//                   <td className="text-center text-[#c07b2a]">+</td>
//                   <td className="py-2 pr-3 text-right">
//                     <span className="mr-4 text-cell">IGST ({totals.igstPct}) %</span>
//                     {money(totals.igstTotal)}
//                   </td>
//                 </tr>
//               )}

//               <tr className="border-b border-line">
//                 <td className="py-2 pr-3 text-right text-cell">Round Off</td>
//                 <td /><td /><td />
//                 <td className="py-2 pr-3 text-right">{money(totals.roundOff)}</td>
//               </tr>
//               <tr className="font-bold">
//                 <td className="py-2 pr-3 text-right">Net Value</td>
//                 <td /><td /><td />
//                 <td className="py-2 pr-3 text-right">{money(totals.netValue)}</td>
//               </tr>
//             </tbody>
//           </table>
//         </div>

//         <button
//           type="button"
//           className="btn btn-primary mx-auto mt-4 flex h-[38px] w-full max-w-[430px] justify-center"
//           onClick={submit}
//           disabled={saving}
//         >
//           {saving ? <span className="spin" /> : <Icon name="save" size={14} />} Submit
//         </button>
//       </div>
//     </div>
//   );
// }













'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from './Icon';
import Field from './Field';
import MultiSelect from './MultiSelect';
import { useScope } from './ScopeContext';
import { useOptions } from './useOptions';
import ProductImage from './ProductImage';
import {
  FIELDS as DC_FIELDS, GRID_COLS, INFO, BLANK_ROW,
  computeTotals, num, money,
} from '@/app/admin/transaction/intercompanysell/deliverychallan/fields';

/* ==========================================================================
   Inter company line-entry document - add / edit.

   Shared by Delivery Challan and Auto Purchase Return: same header shape,
   same scan-to-add grid, same totals block. The caller passes its own field
   list through `cfg.fields`; omit it and the Delivery Challan spec is used,
   so the challan pages need no change.

   Three things this screen does that the generic TransactionFormView can't:

     - the Location Name list depends on the Business chosen ON THIS FORM,
       not on the business in the top bar. A plain `ref` field always scopes
       to the top-bar business, so those two selectors are wired by hand.
     - picking a Business copies its GSTIN and address into the two readonly
       "Customer" boxes, the way the deployed screen does.
     - every line figure (Final Rate, Before Tax, the three GST columns, Net
       Amount) recalculates as you type, and the totals block follows.

   The maths lives in deliverychallan/fields.js, which the API imports too,
   so what you watch while typing is what gets stored.

   NOTE: this file replaces the Phase 1 version. The only behavioural change
   is that the header now renders `cfg.fields` in order rather than a
   hardcoded arrangement - which also fixes the awkward conditional shuffle
   the first version used to slot DC No in on the edit screen.
   ========================================================================== */

export default function IcChallanForm({ cfg, id }) {
  const router = useRouter();
  const scope = useScope();
  const isEdit = Boolean(id);

  const FIELDS = cfg.fields || DC_FIELDS;
  /* a screen may supply its own column list; `compactGrid` also switches the
     row renderer, since the two must agree on cell count */
  const COLS = cfg.gridCols || GRID_COLS;
  const compact = Boolean(cfg.compactGrid);
  const docNoKey = cfg.docNoKey || 'dcNo';
  const docNoLabel = cfg.docNoLabel || 'DC No';

  /* every header field except the two the form drives itself, and any the
     spec marks `hidden` - those stay in FIELDS so the API keeps accepting
     them, they are simply not asked for on screen. */
  const rest = FIELDS.filter(
    (f) => f.k !== 'toBusinessId' && f.k !== 'toLocationId' && !f.hidden
  );

  const [data, setData] = useState(() => {
    const d = {};
    FIELDS.forEach((f) => {
      d[f.k] = f.def === 'today'
        ? new Date().toISOString().slice(0, 10)
        : (f.def !== undefined ? f.def : '');
    });
    return d;
  });

  const [docNo, setDocNo] = useState('');
  const [rows, setRows] = useState([]);
  const [headDiscountPct, setHeadDiscountPct] = useState(0);
  const [headRoffDiscount, setHeadRoffDiscount] = useState(0);

  const [businesses, setBusinesses] = useState([]);
  const [locations, setLocations] = useState([]);

  const [scan, setScan] = useState('');
  /* type-ahead over the codes this branch actually holds - fed by
     /api/ic-delivery-challan/item-codes, which reads the same barcodeLabel
     collection Inventory > Barcode Item lists. */
  /* Mirrors `rows` so addScanned can inspect the current lines without
     either reading stale closure state or doing it inside a setRows updater.
     Updaters must be pure - calling setFlash from inside one throws
     "Cannot update a component while rendering a different component", and
     StrictMode runs the updater twice so the error arrives in pairs. */
  const rowsRef = useRef([]);
  /* the enlarged product photo, same behaviour as the POS till */
  const [previewImage, setPreviewImage] = useState(null);

  const [codeHints, setCodeHints] = useState([]);
  const [showHints, setShowHints] = useState(false);
  const [errors, setErrors] = useState({});
  const [flash, setFlash] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => {
    setData((d) => ({ ...d, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));
  };

  /* ------------------------------------------------- destination business

     Every OTHER branch. Nothing mediates the transfer and nothing approves
     it, so there is no pinned location and no route to explain.
     /api/ic-destinations supplies the list. */
  useEffect(() => {
    if (!scope.business) { setBusinesses([]); return undefined; }
    let off = false;
    fetch('/api/ic-destinations?business=' + scope.business, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (off) return;
        setBusinesses(d.options || []);
        /* One destination and nothing to choose - pick it, so the operator is
           not asked a question with a single answer. */
        if ((d.options || []).length === 1) {
          setData((cur) => (cur.toBusinessId ? cur : { ...cur, toBusinessId: d.options[0].value }));
        }
      })
      .catch(() => { if (!off) setBusinesses([]); });
    return () => { off = true; };
  }, [scope.business]);

  /* locations of whichever business is picked on THIS form.

     The first one is selected automatically, so picking a Business fills
     Location Name too - most branches have exactly one, and being made to
     choose from a list of one is a question with a single answer. It stays a
     normal dropdown, so a branch with several can still be changed.

     Only when the field is EMPTY: an operator who has already chosen a
     location must not have it overwritten by a late response. */
  useEffect(() => {
    if (!data.toBusinessId) { setLocations([]); return undefined; }

    let off = false;
    fetch('/api/options?ref=companylocations&business=' + data.toBusinessId)
      .then((r) => r.json())
      .then((d) => {
        if (off) return;
        const options = d.options || [];
        setLocations(options);
        if (options.length) {
          setData((cur) => (cur.toLocationId ? cur : { ...cur, toLocationId: options[0].value }));
        }
      })
      .catch(() => { if (!off) setLocations([]); });
    return () => { off = true; };
  }, [data.toBusinessId]);

  /* STOCK POINT follows the top bar.

     useOptions already asks /api/options?ref=stockpoint with the business and
     location from the top bar, and that ref is locationScoped - so the list it
     returns is precisely the stock points of the branch the operator is
     standing in. Nearly always that is one, and being made to pick from a list
     of one is a question with a single answer.

     Two cases are handled:
       nothing chosen yet          -> take the first
       chosen, but not in the list -> replace it. This is the one that matters
                                      when the top bar is switched mid-form:
                                      the old branch's stock point would
                                      otherwise stay selected and the challan
                                      would be raised against a point that
                                      belongs to another location.

     A choice that IS valid for the current scope is never touched, so an
     operator who picked the second of several keeps it.

     Only ever applies to a form that declares the field - this component is
     reused by the auto purchase return with its own spec, which has no stock
     point and must not be given one. */
  const stockPointOptions = useOptions(
    'stockpoint',
    '',
    FIELDS.some((f) => f.k === 'stockPointId')
  );

  useEffect(() => {
    const options = stockPointOptions.options || [];
    if (!options.length) return;
    setData((cur) => {
      const chosen = String(cur.stockPointId || '');
      if (chosen && options.some((o) => String(o.value) === chosen)) return cur;
      return { ...cur, stockPointId: options[0].value };
    });
  }, [stockPointOptions.options]);

  /* GSTIN and address follow the chosen business */
  const pickBusiness = async (v) => {
    setData((d) => ({ ...d, toBusinessId: v, toLocationId: '' }));
    setErrors((e) => ({ ...e, toBusinessId: undefined }));
    if (!v) return;
    try {
      const r = await fetch('/api/business/' + v);
      const { doc } = await r.json();
      if (!doc) return;
      setData((d) => ({
        ...d,
        customerGstn: doc.gstin || '',
        customerAddress: [doc.addressLine1, doc.addressLine2, doc.city]
          .filter(Boolean).join(', '),
      }));
    } catch { /* leave the two boxes as they are */ }
  };

  /* ------------------------------------------------------- load on edit -- */
  useEffect(() => {
    if (!id) return;
    fetch(cfg.endpoint + '/' + id)
      .then((r) => r.json())
      .then((d) => {
        if (!d.doc) return;
        setData((prev) => {
          const next = { ...prev };
          Object.keys(next).forEach((k) => {
            const v = d.doc[k];
            if (v === null || v === undefined) return;
            const t = FIELDS.find((f) => f.k === k)?.type;
            next[k] = t === 'ref' ? String(v) : (t === 'date' ? String(v).slice(0, 10) : v);
          });
          return next;
        });
        setDocNo(d.doc[docNoKey] || '');
        setRows(d.doc.items || []);
        setHeadDiscountPct(d.doc.discountPercent ?? 0);
        setHeadRoffDiscount(d.doc.roundOffDiscountAmt ?? 0);
      });
  }, [id, cfg.endpoint, docNoKey]);

  /* ------------------------------------------------------------- rows ---- */
  const setCell = (i, k, v) =>
    setRows((prev) => prev.map((r, ri) => (ri === i ? { ...r, [k]: v } : r)));

  const dropRow = (i) => setRows((prev) => prev.filter((_, ri) => ri !== i));

  /* Scan / type an item code, Enter to add.

     One call to the challan's own item-lookup, which does everything the
     Info box promises: rejects a code with no GRC barcode row, joins
     HSN -> tax slab -> UOM, decides IGST vs CGST+SGST from the two GSTINs'
     state codes, and returns the stock ceiling that prints as "(Max: n)". */
  const addScanned = useCallback(async (code) => {
    const term = String(code || '').trim();
    if (!term) return;
    setFlash(null);

    const qs = new URLSearchParams({
      code: term,
      business: scope.business || '',
      location: scope.location || '',
      finYear: scope.finYear || '',
      toBusiness: data.toBusinessId || '',
      stockPoint: data.stockPointId || '',
    });

    try {
      /* no-store: this is a stock read, and a cached answer would put the
         previous barcode's figures on the new line */
      const r = await fetch(
        (cfg.lookupEndpoint || '/api/ic-delivery-challan/item-lookup') + '?' + qs,
        { cache: 'no-store' }
      );
      const d = await r.json();

      /* the lookup states WHY a code was refused - surface it rather than a
         generic "not found" */
      if (!r.ok) { setFlash({ type: 'err', msg: d.error || 'Item lookup failed' }); return; }

      const it = d.item;
      const key = (v) => String(v || '').trim().toLowerCase();

      /* EVERY scan opens its own row.

         No merging and no duplicate check: the operator enters one barcode,
         sees one line, enters the next, sees the next line. The same barcode
         entered twice is two lines, because the branch holds many units under
         one printed barcode and each line is a separate entry the operator
         can set a quantity on or delete. */
      setRows((prev) => [...prev, {
        ...BLANK_ROW, ...it,
        availableQty: it.maxQty ?? null,
        qty: 1,
      }]);
      setScan('');
    } catch {
      setFlash({ type: 'err', msg: 'Item lookup failed' });
    }
  }, [scope.business, scope.location, scope.finYear, data.toBusinessId, data.stockPointId, cfg.lookupEndpoint]);

  /* Item-code suggestions.

     Debounced because it fires per keystroke, and guarded with `off` because
     a slow early response must not overwrite a later one - the same stale
     -response race the Location selector hit.

     Scoped to the branch in the top bar: a code held by another branch is not
     stock this challan can ship, and offering it only to have the lookup
     refuse it is worse than not offering it at all. */
  useEffect(() => {
    const term = scan.trim();
    if (!term) { setCodeHints([]); return undefined; }

    let off = false;
    const timer = setTimeout(() => {
      const qs = new URLSearchParams({
        search: term,
        business: scope.business || '',
        location: scope.location || '',
      });
      fetch((cfg.codesEndpoint || '/api/ic-delivery-challan/item-codes') + '?' + qs,
        { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => { if (!off) setCodeHints(Array.isArray(d.rows) ? d.rows : []); })
        .catch(() => { if (!off) setCodeHints([]); });
    }, 250);

    return () => { off = true; clearTimeout(timer); };
  }, [scan, scope.business, scope.location, cfg.codesEndpoint]);

  useEffect(() => { rowsRef.current = rows; }, [rows]);

  /* ------------------------------------------------------------ totals --- */
  const totals = useMemo(
    () => computeTotals(rows, {
      discountPercent: headDiscountPct,
      roundOffDiscountAmt: headRoffDiscount,
    }),
    [rows, headDiscountPct, headRoffDiscount]
  );

  /* ------------------------------------------------------------- save ---- */
  async function submit() {
    setSaving(true);
    setFlash(null);
    try {
      const lines = rows.map((r, i) => {
        const c = totals.calc[i];
        return {
          /* which physical unit is being shipped - the line is meaningless
             without it now that entry is by barcode */
          barcodeNo: r.barcodeNo || '',
          image: r.image || '',
          itemId: r.itemId, itemCode: r.itemCode, itemName: r.itemName,
          hsn: r.hsn, slabName: r.slabName, uom: r.uom,
          qty: num(r.qty), availableQty: r.availableQty ?? null,
          unitRate: num(r.unitRate),
          discountPct: num(r.discountPct), discount: c.discount,
          roffDiscount: num(r.roffDiscount),
          finalRate: c.finalRate, beforeTax: c.beforeTax,
          igstPct: num(r.igstPct), cgstPct: num(r.cgstPct), sgstPct: num(r.sgstPct),
          igstAmount: c.igst, cgstAmount: c.cgst, sgstAmount: c.sgst,
          netAmount: c.netAmount,
        };
      });

      const payload = {
        data: {
          ...data,
          items: lines,
          taxableValue: totals.taxableValue,
          discountPercent: num(headDiscountPct),
          roundOffDiscountAmt: num(headRoffDiscount),
          igstTotal: totals.igstTotal,
          cgstTotal: totals.cgstTotal,
          sgstTotal: totals.sgstTotal,
          roundOff: totals.roundOff,
          totalQty: totals.totalQty,
          netValue: totals.netValue,
        },
        business: scope.business, location: scope.location, finYear: scope.finYear,
      };

      const r = await fetch(cfg.endpoint + (id ? '/' + id : ''), {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();

      if (r.status === 422) {
        setErrors(d.errors || {});
        setFlash({ type: 'err', msg: 'Please correct the highlighted fields.' });
        return;
      }
      if (!r.ok) { setFlash({ type: 'err', msg: d.error || 'Save failed' }); return; }

      /* A screen can send the operator straight to the saved document's
         print preview instead of the list - the Delivery Challan does, so
         Submit ends on the page they print from. The id comes back from a
         create; an edit already has it. */
      const savedId = d.id || id;
      router.push(cfg.afterSaveHref && savedId
        ? cfg.afterSaveHref(savedId)
        : cfg.basePath + cfg.slugPath);
    } finally {
      setSaving(false);
    }
  }

  /* the four numeric cells the user types into */
  const NUMERIC = ['qty', 'unitRate', 'discountPct', 'roffDiscount'];

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">{cfg.addTitle}</span>
      </div>

      <div className="card-body">
        {flash && <div className={'flash ' + (flash.type === 'err' ? 'flash-err' : 'flash-ok')}>{flash.msg}</div>}

        {/* ---------------------------------------------------- header --- */}
        <div className="form-grid-4">
          <div>
            <label className="f-label">Business<span className="f-req">*</span></label>
            <select
              className="f-input"
              value={data.toBusinessId || ''}
              onChange={(e) => pickBusiness(e.target.value)}
            >
              <option value="">--Select--</option>
              {businesses.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {errors.toBusinessId && <div className="f-err">{errors.toBusinessId}</div>}
            {/* Says why the list is short, rather than leaving the operator to
                wonder where the other branches went. */}
          </div>

          <div>
            <label className="f-label">Location Name<span className="f-req">*</span></label>
            <select
              className="f-input"
              value={data.toLocationId || ''}
              onChange={(e) => set('toLocationId', e.target.value)}
              disabled={!data.toBusinessId}
            >
              <option value="">--Select--</option>
              {locations.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {errors.toLocationId && <div className="f-err">{errors.toLocationId}</div>}
          </div>

          {/* issued by the server on save, so it only exists on the edit screen */}
          {isEdit && (
            <div>
              <label className="f-label">{docNoLabel}<span className="f-req">*</span></label>
              <input className="f-input bg-[#eff2f7] text-inkmuted" value={docNo} readOnly />
            </div>
          )}

          {rest.map((f) => (
            <Field key={f.k} f={f} value={data[f.k]} error={errors[f.k]} onChange={set} />
          ))}
        </div>

        {/* ------------------------------------------------------ info --- */}
        {cfg.showInfo !== false && (
          <div className="info-box mt-4">
            <div className="mb-1.5 flex items-center gap-1.5 font-bold underline">
              <Icon name="eye" size={14} /> Info
            </div>
            <ol className="list-decimal pl-5">
              {(cfg.info || INFO).map((t, i) => <li key={i} dangerouslySetInnerHTML={{ __html: t }} />)}
            </ol>
          </div>
        )}

        {/* ------------------------------------------------------ scan --- */}
        <div className="kbd-hint">
          {/* <Icon name="eye" size={13} /> Shortcut: Press <span className="kbd">Enter</span> /
          <span className="kbd">F9</span> / <span className="kbd">Tab</span>
          to add item &amp; and <b>box must be in focus</b>. */}
        </div>
        <div className="relative mb-3 max-w-[760px]">
          <div className="flex">
            <input
              className="f-input rounded-r-none"
              placeholder="Enter barcode number"
              value={scan}
              autoComplete="off"
              onChange={(e) => { setScan(e.target.value); setShowHints(true); }}
              onFocus={() => setShowHints(true)}
              onBlur={() => setTimeout(() => setShowHints(false), 150)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setShowHints(false); return; }
                if (['Enter', 'F9', 'Tab'].includes(e.key)) {
                  e.preventDefault();
                  setShowHints(false);
                  addScanned(scan);
                }
              }}
            />
            <button type="button" className="btn btn-dark rounded-l-none" onClick={() => addScanned(scan)}>
              <Icon name="search" size={14} />
            </button>
          </div>

          {/* onMouseDown, not onClick: a click blurs the input first, and the
              blur handler would unmount this list before the click landed. */}
          {showHints && !!codeHints.length && (
            <ul className="absolute left-0 right-0 top-full z-20 mt-0.5 max-h-64 overflow-y-auto rounded border border-line bg-white shadow-lg">
              {codeHints.map((h) => (
                <li key={h.barcodeNo + '|' + h.itemCode}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-[#f7f9fc]"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setShowHints(false);
                      addScanned(h.barcodeNo);
                    }}
                  >
                    <span className="font-semibold">{h.barcodeNo}</span>
                    <span className="shrink-0 text-inkmuted">{h.itemCode}</span>
                    <span className="min-w-0 flex-1 truncate text-inkmuted">{h.printDescription}</span>
                    <span className="shrink-0 text-inkmuted">Qty: {h.qty}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ------------------------------------------------------ grid --- */}
        <div className="overflow-x-auto">
          <table className="dt">
            <thead>
              <tr>{COLS.map((c) => <th key={c}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={COLS.length} className="dt-empty">
                    {cfg.emptyGrid || 'No Items Added'}
                  </td></tr>
              )}
              {rows.map((r, i) => {
                const c = totals.calc[i];
                const over = r.availableQty !== null
                  && r.availableQty !== undefined
                  && num(r.qty) > num(r.availableQty);
                return (
                  <tr key={i}>
                {/* Compact layout - Sl No, Barcode, Qty, UOM, HSN, Item Name.
                    The money columns are not shown; the line still carries
                    unitRate and the tax percentages, so the totals block below
                    reacts to a quantity change exactly as before. */}
                {compact ? (
                  <>
                    <td className="text-center">{i + 1}</td>
                    <td>{r.barcodeNo || ''}</td>
                    {/* Always editable. Locking it by uomType / batchType /
                        qtyNum was tried and every variant mis-classified real
                        labels - a PC label can still cover several units, and
                        the label's own qtyNum is not the branch's stock. The
                        stock ceiling below the box is the guard instead. */}
                    <td>
                      <input
                        type="number"
                        min="0"
                        className={'f-input h-8 w-[86px] ' + (over ? 'border-danger' : '')}
                        value={r.qty ?? ''}
                        onWheel={(e) => e.currentTarget.blur()}
                        onChange={(e) => {
                          /* a negative quantity on a challan is meaningless -
                             it would flip the line's sign all the way through
                             to the invoice's net value */
                          const v = e.target.value;
                          setCell(i, 'qty', v === '' ? '' : Math.max(0, Number(v)));
                        }}
                      />
                      {/* the deployed screen prints the stock ceiling here;
                          shown only when something supplied one */}
                      {r.availableQty !== null && r.availableQty !== undefined && (
                        <div className={'pt-0.5 text-[11px] ' + (over ? 'text-danger' : 'text-inkmuted')}>
                          (Max: {r.availableQty})
                        </div>
                      )}
                    </td>
                    <td>{r.uom}</td>
                    <td>{r.hsn}</td>
                    <td>{r.itemName}</td>
                    {/* The rate the line is priced at - the item's RSP, taken
                        from the barcode row when the Item master has none.
                        Read-only: the price comes from the master data, not
                        from whoever is raising the challan. It still drives
                        the totals, so quantity remains the thing that moves
                        Net Value on this screen. */}
                    <td className="text-center">{money(r.unitRate)}</td>
                    {/* the same thumbnail component the POS till uses - a fixed
                        box whether the photo loads, fails or is missing, so a
                        bad image cannot knock the row out of line */}
                    {/* Hover opens the same centred popup a click opens.

                        `hover: true` marks how it was opened. A hover popup is
                        click-through and closes itself when the pointer leaves
                        the cell; a clicked one behaves as before. Leaving only
                        closes a HOVER popup, so moving the mouse away does not
                        dismiss one the operator deliberately clicked open. */}
                    <td
                      onMouseEnter={() => r.image && setPreviewImage({
                        src: r.image, alt: r.itemName, hover: true,
                      })}
                      onMouseLeave={() => setPreviewImage((p) => (p && p.hover ? null : p))}
                    >
                      <ProductImage
                        src={r.image}
                        alt={r.itemName}
                        size={48}
                        onOpen={r.image
                          ? () => setPreviewImage({ src: r.image, alt: r.itemName, hover: false })
                          : undefined}
                      />
                    </td>
                    <td>
                      <button type="button" className="act-btn bg-danger" onClick={() => dropRow(i)}>
                        <Icon name="trash" size={12} />
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                      <td className="text-center">{i + 1}</td>
                      <td>{r.barcodeNo || ''}</td>
                      <td>{r.itemName}</td>
                      <td>{r.hsn}</td>
                      <td>{r.slabName}</td>
                      <td>{r.uom}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          className={'f-input h-8 w-[86px] ' + (over ? 'border-danger' : '')}
                          value={r.qty ?? ''}
                          onWheel={(e) => e.currentTarget.blur()}
                          onChange={(e) => {
                            /* a negative quantity on a challan is meaningless -
                               it would flip the line's sign all the way through
                               to the invoice's net value */
                            const v = e.target.value;
                            setCell(i, 'qty', v === '' ? '' : Math.max(0, Number(v)));
                          }}
                        />
                        {/* the deployed screen prints the stock ceiling here;
                            shown only when something supplied one */}
                        {r.availableQty !== null && r.availableQty !== undefined && (
                          <div className={'pt-0.5 text-[11px] ' + (over ? 'text-danger' : 'text-inkmuted')}>
                            (Max: {r.availableQty})
                          </div>
                        )}
                      </td>
                      {['unitRate', 'discountPct', 'roffDiscount'].map((k) => (
                        <td key={k}>
                          <input
                            type="number"
                            className="f-input h-8 w-[86px]"
                            value={r[k] ?? ''}
                            onWheel={(e) => e.currentTarget.blur()}
                            onChange={(e) => setCell(i, k, e.target.value)}
                          />
                        </td>
                      ))}
                      <td className="text-right">{money(c.finalRate)}</td>
                      <td className="text-right">{money(c.beforeTax)}</td>
                      <td className="text-right">{money(c.igst)}</td>
                      <td className="text-right">{money(c.cgst)}</td>
                      <td className="text-right">{money(c.sgst)}</td>
                      <td className="text-right font-bold">{money(c.netAmount)}</td>
                      <td>
                        <button type="button" className="act-btn bg-danger" onClick={() => dropRow(i)}>
                          <Icon name="trash" size={12} />
                        </button>
                      </td>
                  </>
                )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ------------------------------------------------- totals --- */}
        {/* Hidden on the Delivery Challan (cfg.showTotals === false).
            The figures are still COMPUTED and still saved - the document
            needs its taxable value, tax and net value, and the Sales
            Invoice reads them back. Only the panel is gone. */}
        {cfg.showTotals !== false && (
          <div className="mt-5">
            <table className="w-full border-collapse text-[13.5px]">
              <tbody>
                <tr className="border-b border-line">
                  <td className="w-[38%] py-2 pr-3 text-right text-cell">Taxable Value</td>
                  <td className="w-[22%]" />
                  <td className="w-[18%] px-2" />
                  <td className="w-[4%] text-center text-[#c07b2a]">+</td>
                  <td className="py-2 pr-3 text-right">{money(totals.taxableValue)}</td>
                </tr>
                <tr className="border-b border-line">
                  <td className="py-2 pr-3 text-right text-cell">Discount(%)</td>
                  <td />
                  <td className="px-2">
                    <input
                      type="number" className="f-input h-8 text-center"
                      value={headDiscountPct}
                      onWheel={(e) => e.currentTarget.blur()}
                      onChange={(e) => setHeadDiscountPct(e.target.value)}
                    />
                  </td>
                  <td className="text-center text-[#c07b2a]">&minus;</td>
                  <td className="py-2 pr-3 text-right">{money(totals.headDiscount)}</td>
                </tr>
                <tr className="border-b border-line">
                  <td className="py-2 pr-3 text-right text-cell">RoundOff Discount(Amt)</td>
                  <td />
                  <td className="px-2">
                    <input
                      type="number" className="f-input h-8 text-center"
                      value={headRoffDiscount}
                      onWheel={(e) => e.currentTarget.blur()}
                      onChange={(e) => setHeadRoffDiscount(e.target.value)}
                    />
                  </td>
                  <td className="text-center text-[#c07b2a]">&minus;</td>
                  <td className="py-2 pr-3 text-right" />
                </tr>

                {(totals.cgstTotal > 0 || totals.sgstTotal > 0) && (
                  <tr className="border-b border-line">
                    <td className="py-2 pr-3 text-right text-cell" />
                    <td />
                    <td />
                    <td className="text-center text-[#c07b2a]">+</td>
                    <td className="py-2 pr-3 text-right">
                      <span className="mr-4 text-cell">
                        CGST + SGST ({totals.cgstPct} + {totals.sgstPct}) %
                      </span>
                      {money(totals.cgstTotal + totals.sgstTotal)}
                    </td>
                  </tr>
                )}
                {totals.igstTotal > 0 && (
                  <tr className="border-b border-line">
                    <td className="py-2 pr-3 text-right text-cell" />
                    <td /><td />
                    <td className="text-center text-[#c07b2a]">+</td>
                    <td className="py-2 pr-3 text-right">
                      <span className="mr-4 text-cell">IGST ({totals.igstPct}) %</span>
                      {money(totals.igstTotal)}
                    </td>
                  </tr>
                )}

                <tr className="border-b border-line">
                  <td className="py-2 pr-3 text-right text-cell">Round Off</td>
                  <td /><td /><td />
                  <td className="py-2 pr-3 text-right">{money(totals.roundOff)}</td>
                </tr>
                <tr className="font-bold">
                  <td className="py-2 pr-3 text-right">Net Value</td>
                  <td /><td /><td />
                  <td className="py-2 pr-3 text-right">{money(totals.netValue)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <button
          type="button"
          className="btn btn-primary mx-auto mt-4 flex h-[38px] w-full max-w-[430px] justify-center"
          onClick={submit}
          disabled={saving}
        >
          {saving ? <span className="spin" /> : <Icon name="save" size={14} />} Submit
        </button>
      </div>

      {/* enlarged product photo - matches the POS till's preview */}
      {previewImage && (
        <div
          /* pointer-events-none while hovering: a full-screen overlay under the
             cursor would fire mouseleave on the cell that opened it, and the
             popup would flicker on and off. */
          className={'fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-6'
            + (previewImage.hover ? ' pointer-events-none' : '')}
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-h-[70vh] max-w-2xl rounded bg-white p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {!previewImage.hover && (
              <button
                type="button"
                aria-label="Close image preview"
                className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white"
                onClick={() => setPreviewImage(null)}
              >
                <Icon name="x" size={16} />
              </button>
            )}
            <img
              src={previewImage.src}
              alt={previewImage.alt}
              className="max-h-[65vh] max-w-[60vw] object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}