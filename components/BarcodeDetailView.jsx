// // 'use client';
// // import { useEffect, useState } from 'react';
// // import Icon from './Icon';
// // import { useScope } from './ScopeContext';

// // /* Barcode Report, opened for ONE barcode.

// //    The Master Stock Report links every barcode number here, so this is the
// //    "what happened to this piece" screen: the item it is, what it cost and
// //    sells for, where it came from, and every movement it has been part of.

// //    The list form of the Barcode Report - many barcodes for one item code -
// //    stays where it was; this renders instead only when ?barcodeNo= is present.
// //    See app/admin/reports/barcode-report/page.jsx. */

// // const money = (v) => (v === null || v === undefined || v === '' ? '-' : Number(v).toFixed(2));
// // const text = (v) => (v === null || v === undefined || String(v).trim() === '' ? '-' : String(v));
// // const when = (v) => (v ? new Date(v).toLocaleString('en-GB') : '-');

// // /* One labelled value. The label sits above its value so a long branch name
// //    does not push the column out of shape. */
// // function Cell({ label, value, wide = false }) {
// //   return (
// //     <div className={'px-4 py-3 ' + (wide ? 'sm:col-span-2' : '')}>
// //       <div className="text-[11px] uppercase tracking-wide text-inkmuted">{label}</div>
// //       <div className="mt-0.5 text-[13.5px] text-ink">{value}</div>
// //     </div>
// //   );
// // }

// // /* A band of the card: its name down the left, its values to the right. */
// // function Band({ title, children, last = false }) {
// //   return (
// //     <div className={'grid grid-cols-1 sm:grid-cols-[160px_1fr] ' + (last ? '' : 'border-b border-line')}>
// //       <div className="bg-[#f4f7fb] px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-inkmuted">
// //         {title}
// //       </div>
// //       <div className="grid grid-cols-1 divide-y divide-line sm:grid-cols-3 sm:divide-y-0">
// //         {children}
// //       </div>
// //     </div>
// //   );
// // }

// // export default function BarcodeDetailView({ barcodeNo, onBack }) {
// //   const { business } = useScope();
// //   const [data, setData] = useState(null);
// //   const [error, setError] = useState('');
// //   const [loading, setLoading] = useState(true);

// //   useEffect(() => {
// //     if (!barcodeNo) return undefined;

// //     let off = false;
// //     setLoading(true);
// //     setError('');

// //     const qs = new URLSearchParams({ barcodeNo, business: business || '' });
// //     fetch('/api/reports/barcode-detail?' + qs, { cache: 'no-store' })
// //       .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
// //       .then(({ ok, d }) => {
// //         if (off) return;
// //         if (!ok) { setError(d.error || 'Could not load that barcode.'); setData(null); return; }
// //         setData(d);
// //       })
// //       .catch(() => { if (!off) setError('Could not reach the server.'); })
// //       .finally(() => { if (!off) setLoading(false); });

// //     /* the guard the suggestion box needed too: a slow answer for a barcode
// //        the operator has already navigated away from must not paint over the
// //        one they are looking at now */
// //     return () => { off = true; };
// //   }, [barcodeNo, business]);

// //   if (loading) return <div className="card"><div className="card-body">Loading barcode {barcodeNo}...</div></div>;
// //   if (error) {
// //     return (
// //       <div className="card">
// //         <div className="card-body">
// //           <div className="flash flash-err">{error}</div>
// //           <button type="button" className="btn mt-3" onClick={onBack}>
// //             <Icon name="back" size={14} /> Back to Barcode Report
// //           </button>
// //         </div>
// //       </div>
// //     );
// //   }

// //   const d = data?.detail || {};
// //   const rows = data?.movements || [];

// //   return (
// //     <>
// //       <div className="card">
// //         <div className="card-head flex items-center justify-between">
// //           <span className="card-title"><Icon name="barcode" size={15} /> Details</span>
// //           <button type="button" className="btn" onClick={onBack}>
// //             <Icon name="back" size={14} /> Back
// //           </button>
// //         </div>

// //         <div className="card-body">
// //           <div className="flex flex-col gap-4 lg:flex-row">
// //             <div className="min-w-0 flex-1 overflow-hidden rounded border border-line">
// //               <Band title="Item Info">
// //                 <Cell label="Item Name" value={text(d.itemName)} />
// //                 <Cell label="Item Code" value={text(d.itemCode)} />
// //                 <Cell label="Barcode Number" value={text(d.barcodeNo)} />
// //                 <Cell label="Description" value={text(d.description)} />
// //                 <Cell label="HSN" value={text(d.hsn)} />
// //                 <Cell label="GST %" value={text(d.gst)} />
// //                 <Cell label="UOM" value={text(d.uom)} />
// //                 <Cell label="Status" value={text(d.status)} />
// //                 <Cell label="Quantity" value={text(d.quantity)} />
// //               </Band>

// //               <Band title="Price Info">
// //                 <Cell label="Purchase Rate" value={money(d.purchaseRate)} />
// //                 <Cell label="RSP" value={money(d.rsp)} />
// //                 <Cell label="Offer Price" value={money(d.offerPrice)} />
// //                 <Cell label="WSP" value={money(d.wsp)} />
// //               </Band>

// //               <Band title="Supplier Details" last>
// //                 <Cell label="Supplier" value={text(d.supplierName)} />
// //                 <Cell label="Current Location" value={text(d.currentLocation)} />
// //                 <Cell label="Origin Location" value={text(d.originLocation)} />
// //                 <Cell label="GRC Number" value={text(d.grcNo)} />
// //                 <Cell label="GRC Date" value={when(d.grcDate)} />
// //                 <Cell label="Serial Number" value={text(d.serialNo)} />
// //                 <Cell label="Batch Number" value={text(d.batchNo)} />
// //                 <Cell label="Transfer Number" value={text(d.transferNo)} />
// //                 <Cell label="Billing Number" value={text(d.billingNo)} />
// //               </Band>
// //             </div>

// //             {/* the photo, if the label carries one - a fixed box either way, so
// //                 a barcode without an image does not shift the card */}
// //             <div className="flex h-[190px] w-full shrink-0 items-center justify-center rounded border border-line text-[12px] text-inkmuted lg:w-[220px]">
// //               {d.imageUrl
// //                 ? <img src={d.imageUrl} alt={text(d.itemName)} className="max-h-full max-w-full object-contain" />
// //                 : 'No image'}
// //             </div>
// //           </div>
// //         </div>
// //       </div>

// //       <div className="card mt-4">
// //         <div className="card-body">
// //           <div className="overflow-x-auto">
// //             <table className="dt">
// //               <thead>
// //                 <tr>
// //                   {['Location', 'Doc Date', 'Doc No', 'Message', 'Stock Point',
// //                     'Receipts', 'Issues', 'Balance Qty', 'Final Price', 'Net Amount']
// //                     .map((h) => <th key={h}>{h}</th>)}
// //                 </tr>
// //               </thead>
// //               <tbody>
// //                 {rows.length === 0
// //                   ? <tr><td colSpan="10" className="dt-empty">No movements recorded for this barcode.</td></tr>
// //                   : rows.map((m) => (
// //                     <tr key={m._id}>
// //                       <td>{text(m.location)}</td>
// //                       <td>{when(m.docDate)}</td>
// //                       <td>{text(m.docNo)}</td>
// //                       <td>{text(m.message)}</td>
// //                       <td>{text(m.stockPoint)}</td>
// //                       <td>{m.receipts ?? '-'}</td>
// //                       <td>{m.issues ?? '-'}</td>
// //                       <td>{m.balanceQty}</td>
// //                       <td>{money(m.finalPrice)}</td>
// //                       <td>{money(m.netAmount)}</td>
// //                     </tr>
// //                   ))}
// //               </tbody>
// //             </table>
// //           </div>

// //           {rows.length > 0 && (
// //             <div className="mt-2 flex flex-wrap gap-6 rounded bg-[#495464] px-4 py-2 text-[12.5px] text-white">
// //               <span>Location: {text(d.currentLocation)}</span>
// //               <span>Stock Point: {text(rows[rows.length - 1].stockPoint)}</span>
// //               <span>Qty: {rows[rows.length - 1].balanceQty}</span>
// //             </div>
// //           )}
// //         </div>
// //       </div>
// //     </>
// //   );
// // }




















// 'use client';
// import { useEffect, useState } from 'react';
// import Icon from './Icon';
// import { useScope } from './ScopeContext';

// /* Barcode Report, opened for ONE barcode.

//    The Master Stock Report links every barcode number here, so this is the
//    "what happened to this piece" screen: the item it is, what it cost and
//    sells for, where it came from, and every movement it has been part of.

//    The list form of the Barcode Report - many barcodes for one item code -
//    stays where it was; this renders instead only when ?barcodeNo= is present.
//    See app/admin/reports/barcode-report/page.jsx. */

// const money = (v) => (v === null || v === undefined || v === '' ? '-' : Number(v).toFixed(2));
// const text = (v) => (v === null || v === undefined || String(v).trim() === '' ? '-' : String(v));
// const when = (v) => (v ? new Date(v).toLocaleString('en-GB') : '-');

// /* One labelled value. The label sits above its value so a long branch name
//    does not push the column out of shape. */
// function Cell({ label, value, wide = false }) {
//   return (
//     <div className={'px-4 py-3 ' + (wide ? 'sm:col-span-2' : '')}>
//       <div className="text-[11px] uppercase tracking-wide text-inkmuted">{label}</div>
//       <div className="mt-0.5 text-[13.5px] text-ink">{value}</div>
//     </div>
//   );
// }

// /* A band of the card: its name down the left, its values to the right. */
// function Band({ title, children, last = false }) {
//   return (
//     <div className={'grid grid-cols-1 sm:grid-cols-[160px_1fr] ' + (last ? '' : 'border-b border-line')}>
//       <div className="bg-[#f4f7fb] px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-inkmuted">
//         {title}
//       </div>
//       <div className="grid grid-cols-1 divide-y divide-line sm:grid-cols-3 sm:divide-y-0">
//         {children}
//       </div>
//     </div>
//   );
// }

// export default function BarcodeDetailView({ barcodeNo, onBack }) {
//   const { business } = useScope();
//   const [data, setData] = useState(null);
//   const [error, setError] = useState('');
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     if (!barcodeNo) return undefined;

//     let off = false;
//     setLoading(true);
//     setError('');

//     const qs = new URLSearchParams({ barcodeNo, business: business || '' });
//     fetch('/api/reports/barcode-detail?' + qs, { cache: 'no-store' })
//       .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
//       .then(({ ok, d }) => {
//         if (off) return;
//         if (!ok) { setError(d.error || 'Could not load that barcode.'); setData(null); return; }
//         setData(d);
//       })
//       .catch(() => { if (!off) setError('Could not reach the server.'); })
//       .finally(() => { if (!off) setLoading(false); });

//     /* the guard the suggestion box needed too: a slow answer for a barcode
//        the operator has already navigated away from must not paint over the
//        one they are looking at now */
//     return () => { off = true; };
//   }, [barcodeNo, business]);

//   if (loading) return <div className="card"><div className="card-body">Loading barcode {barcodeNo}...</div></div>;
//   if (error) {
//     return (
//       <div className="card">
//         <div className="card-body">
//           <div className="flash flash-err">{error}</div>
//           <button type="button" className="btn mt-3" onClick={onBack}>
//             <Icon name="back" size={14} /> Back to Barcode Report
//           </button>
//         </div>
//       </div>
//     );
//   }

//   const d = data?.detail || {};
//   const rows = data?.movements || [];
//   const history = data?.history || null;

//   return (
//     <>
//       <div className="card">
//         <div className="card-head flex items-center justify-between">
//           <span className="card-title"><Icon name="barcode" size={15} /> Details</span>
//           <button type="button" className="btn" onClick={onBack}>
//             <Icon name="back" size={14} /> Back
//           </button>
//         </div>

//         <div className="card-body">
//           <div className="flex flex-col gap-4 lg:flex-row">
//             <div className="min-w-0 flex-1 overflow-hidden rounded border border-line">
//               <Band title="Item Info">
//                 <Cell label="Item Name" value={text(d.itemName)} />
//                 <Cell label="Item Code" value={text(d.itemCode)} />
//                 <Cell label="Barcode Number" value={text(d.barcodeNo)} />
//                 <Cell label="Description" value={text(d.description)} />
//                 <Cell label="Sub Group" value={text(d.subGroup)} />
//                 <Cell label="Group" value={text(d.group)} />
//                 <Cell label="HSN" value={text(d.hsn)} />
//                 <Cell label="GST Slab" value={text(d.gstSlab)} />
//                 <Cell label="GST %" value={text(d.gst)} />
//                 <Cell label="UOM" value={text(d.uom)} />
//                 <Cell label="Status" value={text(d.status)} />
//                 <Cell label="Quantity" value={text(d.quantity)} />
//               </Band>

//               <Band title="Other Info">
//                 <Cell label="PMA" value={text(d.pma)} />
//               </Band>

//               <Band title="Price Info">
//                 <Cell label="Purchase Rate" value={money(d.purchaseRate)} />
//                 <Cell label="Discount" value={money(d.discount)} />
//                 <Cell label="Final Rate" value={money(d.finalRate)} />
//                 <Cell label="RSP" value={money(d.rsp)} />
//                 <Cell label="Offer Price" value={money(d.offerPrice)} />
//                 <Cell label="WSP" value={money(d.wsp)} />
//                 <Cell label="DP" value={money(d.dp)} />
//               </Band>

//               <Band title="Design Info">
//                 <Cell label="Design NO." value={text(d.designNo)} />
//               </Band>

//               <Band title="Supplier Details" last>
//                 <Cell label="Supplier" value={text(d.supplierName)} />
//                 <Cell label="Tax Region" value={text(d.taxRegion)} />
//                 <Cell label="Current Location" value={text(d.currentLocation)} />
//                 <Cell label="Origin Location" value={text(d.originLocation)} />
//                 <Cell label="GRC Number" value={text(d.grcNo)} />
//                 <Cell label="GRC Date" value={when(d.grcDate)} />
//                 <Cell label="Serial Number" value={text(d.serialNo)} />
//                 <Cell label="Batch Number" value={text(d.batchNo)} />
//                 <Cell label="Transfer Number" value={text(d.transferNo)} />
//                 <Cell label="Billing Number" value={text(d.billingNo)} />
//               </Band>
//             </div>

//             {/* the photo, if the label carries one - a fixed box either way, so
//                 a barcode without an image does not shift the card */}
//             <div className="flex h-[190px] w-full shrink-0 items-center justify-center rounded border border-line text-[12px] text-inkmuted lg:w-[220px]">
//               {d.imageUrl
//                 ? <img src={d.imageUrl} alt={text(d.itemName)} className="max-h-full max-w-full object-contain" />
//                 : 'No image'}
//             </div>
//           </div>
//         </div>
//       </div>

//       <div className="card mt-4">
//         <div className="card-body">
//           <div className="overflow-x-auto">
//             <table className="dt">
//               <thead>
//                 <tr>
//                   {['Location', 'Doc Date', 'Doc No', 'Message', 'Stock Point',
//                     'Receipts', 'Issues', 'Balance Qty', 'Final Price', 'Net Amount']
//                     .map((h) => <th key={h}>{h}</th>)}
//                 </tr>
//               </thead>
//               <tbody>
//                 {rows.length === 0
//                   ? <tr><td colSpan="10" className="dt-empty">No movements recorded for this barcode.</td></tr>
//                   : rows.map((m) => (
//                     <tr key={m._id}>
//                       <td>{text(m.location)}</td>
//                       <td>{when(m.docDate)}</td>
//                       <td>{text(m.docNo)}</td>
//                       <td>{text(m.message)}</td>
//                       <td>{text(m.stockPoint)}</td>
//                       <td>{m.receipts ?? '-'}</td>
//                       <td>{m.issues ?? '-'}</td>
//                       <td>{m.balanceQty}</td>
//                       <td>{money(m.finalPrice)}</td>
//                       <td>{money(m.netAmount)}</td>
//                     </tr>
//                   ))}
//               </tbody>
//             </table>
//           </div>

//           {rows.length > 0 && (
//             <div className="mt-2 flex flex-wrap gap-6 rounded bg-[#495464] px-4 py-2 text-[12.5px] text-white">
//               <span>Location: {text(d.currentLocation)}</span>
//               <span>Stock Point: {text(rows[rows.length - 1].stockPoint)}</span>
//               <span>Qty: {rows[rows.length - 1].balanceQty}</span>
//             </div>
//           )}
//         </div>
//       </div>

//       {history && <SourceHistory history={history} />}
//     </>
//   );
// }

// /* A unit imported from the other ERP's Barcode Report (Barcode Report ->
//    Import): that ERP's own movement list, its totals and its stock by
//    location, as its Details page showed them. History only - this ERP's
//    ledger is the table above. */
// function SourceHistory({ history }) {
//   const moves = history.movements || [];
//   const totals = history.totals || {};
//   const shown = totals.printed && Object.keys(totals.printed).length ? totals.printed : totals.computed || {};
//   return (
//     <div className="card mt-4">
//       <div className="card-head">
//         <span className="card-title"><Icon name="file" size={15} /> Movements on erp.orbiteerp.com</span>
//       </div>
//       <div className="card-body">
//         <div className="overflow-x-auto">
//           <table className="dt">
//             <thead>
//               <tr>
//                 {['Location', 'Doc Date', 'Type', 'Doc No', 'Supplier/Cust/Location', 'Particulars', 'Stock Point',
//                   'Receipts', 'Issues', 'Balance', 'Qty', 'Final Price', 'Net Amt'].map((h) => <th key={h}>{h}</th>)}
//               </tr>
//             </thead>
//             <tbody>
//               {moves.length === 0
//                 ? <tr><td colSpan="13" className="dt-empty">No movements were imported for this barcode.</td></tr>
//                 : moves.map((m) => (
//                   <tr key={m.key}>
//                     <td>{text(m.location)}</td>
//                     <td>{when(m.docDate)}</td>
//                     <td>{text(m.docType)}</td>
//                     <td>{text(m.docNo)}</td>
//                     <td>{text(m.party)}</td>
//                     <td>{text(m.particulars)}</td>
//                     <td>{text(m.stockPoint)}</td>
//                     <td>{m.receipts}</td>
//                     <td>{m.issues}</td>
//                     <td>{m.balance}</td>
//                     <td>{m.qty}</td>
//                     <td>{money(m.finalPrice)}</td>
//                     <td>{money(m.netAmount)}</td>
//                   </tr>
//                 ))}
//             </tbody>
//             {moves.length > 0 && (
//               <tfoot>
//                 <tr className="font-semibold">
//                   <td colSpan="7">Total</td>
//                   <td>{text(shown.receipts)}</td>
//                   <td>{text(shown.issues)}</td>
//                   <td>{text(shown.balance)}</td>
//                   <td />
//                   <td />
//                   <td>{money(shown.netAmount)}</td>
//                 </tr>
//               </tfoot>
//             )}
//           </table>
//         </div>
//         {totals.mismatches?.length > 0 && (
//           <div className="flash flash-err mt-2">
//             The rows add up to {totals.mismatches.map((k) => `${k} ${totals.computed[k]}`).join(', ')} - the page&apos;s totals said otherwise.
//           </div>
//         )}
//         {(history.stock || []).length > 0 && (
//           <table className="dt mt-4">
//             <thead><tr><th>Location</th><th>Stock Point</th><th>Stock</th></tr></thead>
//             <tbody>
//               {history.stock.map((s) => (
//                 <tr key={s.location + '|' + s.stockPoint}>
//                   <td>{text(s.location)}</td><td>{text(s.stockPoint)}</td><td>{money(s.qty)}</td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         )}
//       </div>
//     </div>
//   );
// }














'use client';
import { useEffect, useState } from 'react';
import Icon from './Icon';
import { useScope } from './ScopeContext';
import { BarcodeImageInput, BarcodeImageThumb, uploadBarcodeImage } from './BarcodeImagePicker';

/* Barcode Report, opened for ONE barcode.

   The Master Stock Report links every barcode number here, so this is the
   "what happened to this piece" screen: the item it is, what it cost and
   sells for, where it came from, and every movement it has been part of.

   The list form of the Barcode Report - many barcodes for one item code -
   stays where it was; this renders instead only when ?barcodeNo= is present.
   See app/admin/reports/barcode-report/page.jsx. */

const money = (v) => (v === null || v === undefined || v === '' ? '-' : Number(v).toFixed(2));
const text = (v) => (v === null || v === undefined || String(v).trim() === '' ? '-' : String(v));
const when = (v) => (v ? new Date(v).toLocaleString('en-GB') : '-');

/* Calculate age in days from a date to today. Returns formatted string like
   "0 DAYS", "1 DAY", "365 DAYS", or "-" if the date is invalid. Normalizes
   dates to start of day to avoid timezone/hour issues affecting the count. */
function calculateAgeInDays(dateValue) {
  if (!dateValue) return '-';
  try {
    const grcDate = new Date(dateValue);
    if (isNaN(grcDate.getTime())) return '-';
    
    // Normalize both dates to start of day (midnight) to compare calendar dates only
    const startOfGrcDay = new Date(grcDate.getFullYear(), grcDate.getMonth(), grcDate.getDate());
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    // Calculate difference in milliseconds and convert to days
    const diffMs = startOfToday - startOfGrcDay;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    // Handle negative days (future dates) - show as 0
    const days = Math.max(0, diffDays);
    
    return days === 1 ? '1 DAY' : `${days} DAYS`;
  } catch (err) {
    return '-';
  }
}

/* One labelled value. The label sits above its value so a long branch name
   does not push the column out of shape. */
function Cell({ label, value, wide = false, editing = false, type = 'text', onChange, bold = false }) {
  return (
    <div className={'px-4 py-3 ' + (wide ? 'sm:col-span-2' : '')}>
      <div className="text-[11px] uppercase tracking-wide text-inkmuted">{label}</div>
      {editing ? (
        <input
          aria-label={label}
          type={type}
          min={type === 'number' ? '0' : undefined}
          step={type === 'number' ? 'any' : undefined}
          className="f-input mt-1 !h-[30px] max-w-[180px]"
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <div className={'mt-0.5 text-[13.5px] text-ink' + (bold ? ' font-semibold' : '')}>{value}</div>
      )}
    </div>
  );
}

/* A band of the card: its name down the left, its values to the right. */
function Band({ title, children, last = false }) {
  return (
    <div className={'grid grid-cols-1 sm:grid-cols-[160px_1fr] ' + (last ? '' : 'border-b border-line')}>
      <div className="bg-[#f4f7fb] px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-inkmuted">
        {title}
      </div>
      <div className="grid grid-cols-1 divide-y divide-line sm:grid-cols-3 sm:divide-y-0">
        {children}
      </div>
    </div>
  );
}

export default function BarcodeDetailView({ barcodeNo, onBack, onSearch }) {
  const { business } = useScope();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(barcodeNo);
  const [editing, setEditing] = useState(false);
  const [editQuantity, setEditQuantity] = useState('');
  const [editRsp, setEditRsp] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    setSearchTerm(barcodeNo);
    setEditing(false);
    setSaveError('');
    setSaveSuccess('');
  }, [barcodeNo]);

  useEffect(() => {
    if (!barcodeNo) return undefined;

    let off = false;
    setLoading(true);
    setError('');

    const qs = new URLSearchParams({ barcodeNo, business: business || '' });
    fetch('/api/reports/barcode-detail?' + qs, { cache: 'no-store' })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (off) return;
        if (!ok) { setError(d.error || 'Could not load that barcode.'); setData(null); return; }
        setData(d);
        setEditQuantity(String(d.detail?.quantity ?? ''));
        setEditRsp(String(d.detail?.rsp ?? ''));
      })
      .catch(() => { if (!off) setError('Could not reach the server.'); })
      .finally(() => { if (!off) setLoading(false); });

    /* the guard the suggestion box needed too: a slow answer for a barcode
       the operator has already navigated away from must not paint over the
       one they are looking at now */
    return () => { off = true; };
  }, [barcodeNo, business, reloadCount]);

  if (loading) return <div className="card"><div className="card-body">Loading barcode {barcodeNo}...</div></div>;
  if (error) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="flash flash-err">{error}</div>
          <button type="button" className="btn mt-3" onClick={onBack}>
            <Icon name="back" size={14} /> Back to Barcode Report
          </button>
        </div>
      </div>
    );
  }

  const d = data?.detail || {};
  const rows = data?.movements || [];
  const history = data?.history || null;
  const lastMovement = rows[rows.length - 1];
  const totalReceipts = rows.reduce((total, row) => total + Number(row.receipts || 0), 0);
  const totalIssues = rows.reduce((total, row) => total + Number(row.issues || 0), 0);

  function startEditing() {
    setEditQuantity(String(d.quantity ?? ''));
    setEditRsp(String(d.rsp ?? ''));
    setSaveError('');
    setSaveSuccess('');
    setEditing(true);
  }

  async function saveDetails() {
    setSaving(true);
    setSaveError('');
    setSaveSuccess('');
    try {
      const response = await fetch('/api/reports/barcode-detail', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId: d.unitId,
          business: business || '',
          quantity: editQuantity,
          rsp: editRsp,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not save barcode details.');
      setData((current) => (current ? {
        ...current,
        detail: { ...current.detail, quantity: result.quantity, rsp: result.rsp },
      } : current));
      setEditing(false);
      setSaveSuccess('Quantity and RSP saved.');
      setReloadCount((count) => count + 1);
    } catch (saveErr) {
      setSaveError(saveErr.message || 'Could not save barcode details.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="card">
        <div className="card-head flex flex-wrap items-center justify-between gap-2">
          <span className="card-title"><Icon name="barcode" size={15} /> Details</span>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <form
              className="flex items-center gap-1.5"
              onSubmit={(event) => {
                event.preventDefault();
                const value = searchTerm.trim();
                if (value) onSearch?.(value);
              }}
            >
              <input
                aria-label="Barcode number"
                className="f-input !h-[30px] !w-[132px] text-[11px]"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
              <button type="submit" className="btn !h-[30px] !px-2.5">
                <Icon name="search" size={13} /> Search
              </button>
            </form>
            {editing ? (
              <>
                <button type="button" className="btn btn-primary !h-[30px] !px-2.5" onClick={saveDetails} disabled={saving}>
                  {saving ? <span className="spin" /> : <Icon name="save" size={13} />} Save
                </button>
                <button type="button" className="btn !h-[30px] !px-2.5" onClick={() => { setEditing(false); setSaveError(''); }} disabled={saving}>
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" className="btn !h-[30px] !px-2.5" onClick={startEditing}>
                <Icon name="pencil" size={13} /> Edit
              </button>
            )}
            <button type="button" className="btn !h-[30px] !px-2.5" onClick={onBack}>
              <Icon name="back" size={13} /> Back
            </button>
          </div>
        </div>

        <div className="card-body">
          {saveError && <div className="flash flash-err" role="alert">{saveError}</div>}
          {saveSuccess && <div className="flash flash-ok" role="status">{saveSuccess}</div>}
          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="min-w-0 flex-1 overflow-hidden rounded border border-line">
              <Band title="Item Info">
                <Cell label="Item Name" value={text(d.itemName)} />
                <Cell label="Item Code" value={text(d.itemCode)} />
                <Cell label="Barcode Number" value={text(d.barcodeNo)} />
                <Cell label="Description" value={text(d.description)} />
                <Cell label="Sub Group" value={text(d.subGroup)} />
                <Cell label="Group" value={text(d.group)} />
                <Cell label="HSN" value={text(d.hsn)} />
                <Cell label="GST Slab" value={text(d.gstSlab)} />
                <Cell label="GST %" value={text(d.gst)} />
                <Cell label="UOM" value={text(d.uom)} />
                <Cell label="Status" value={text(d.status)} />
                <Cell
                  label="Quantity"
                  value={editing ? editQuantity : text(d.quantity)}
                  editing={editing}
                  type="number"
                  onChange={setEditQuantity}
                />
              </Band>

              <Band title="Other Info">
                <Cell label="PMA" value={text(d.pma)} />
              </Band>

              <Band title="Price Info">
                <Cell label="Purchase Rate" value={money(d.purchaseRate)} />
                <Cell label="Discount" value={money(d.discount)} />
                <Cell label="Final Rate" value={money(d.finalRate)} />
                <Cell
                  label="RSP"
                  value={editing ? editRsp : money(d.rsp)}
                  editing={editing}
                  type="number"
                  onChange={setEditRsp}
                />
                <Cell label="Offer Price" value={money(d.offerPrice)} />
                <Cell label="WSP" value={money(d.wsp)} />
                <Cell label="DP" value={money(d.dp)} />
              </Band>

              <Band title="Design Info">
                <Cell label="Design NO." value={text(d.designNo)} />
              </Band>

              <Band title="Supplier Details" last>
                <Cell label="Supplier" value={text(d.supplierName)} />
                <Cell label="Tax Region" value={text(d.taxRegion)} />
                <Cell label="Current Location" value={text(d.currentLocation)} />
                <Cell label="Origin Location" value={text(d.originLocation)} />
                <Cell label="GRC Number" value={text(d.grcNo)} bold />
                <Cell label="GRC Date" value={when(d.grcDate)} bold />
                <Cell label="Age" value={calculateAgeInDays(d.grcDate)} bold />
                <Cell label="Serial Number" value={text(d.serialNo)} />
                <Cell label="Batch Number" value={text(d.batchNo)} />
                <Cell label="Transfer Number" value={text(d.transferNo)} />
                <Cell label="Billing Number" value={text(d.billingNo)} />
              </Band>
            </div>

            {/* THE BARCODE IMAGE - this barcode's own picture, kept on it; the
                item's (Item Master) is apart from it, below */}
            <div className="w-full shrink-0 lg:w-[260px]">
              <BarcodeImagePanel
                detail={d}
                business={business}
                onSaved={(image) => setData((cur) => (cur ? { ...cur, detail: { ...cur.detail, ...image } } : cur))}
              />
              {d.itemImageUrl && (
                <div className="mt-3">
                  <BarcodeImageThumb
                    label="Item image (Item Master)"
                    src={d.itemImageUrl}
                    alt={`Item image of ${text(d.itemName)}`}
                    height={120}
                    emptyText="No item image."
                    onClick={() => { setModalImageSrc(d.itemImageUrl); setModalImageAlt(`Item image of ${text(d.itemName)}`); setImageModalOpen(true); }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card mt-4">
        <div className="card-body">
          <div className="overflow-x-auto">
            <table className="dt">
              <thead>
                <tr>
                  {['Location', 'Doc Date', 'Doc No', 'Message', 'Stock Point',
                    'Receipts', 'Issues', 'Balance Qty', 'Final Price', 'Net Amount']
                    .map((h) => <th key={h} className="!bg-[#edf4f1] !text-[#536275]">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0
                  ? <tr><td colSpan="10" className="dt-empty">No movements recorded for this barcode.</td></tr>
                  : rows.map((m) => (
                    <tr key={m._id}>
                      <td>{text(m.location)}</td>
                      <td>{when(m.docDate)}</td>
                      <td>{text(m.docNo)}</td>
                      <td>{text(m.message)}</td>
                      <td>{text(m.stockPoint)}</td>
                      <td>{m.receipts ?? '-'}</td>
                      <td>{m.issues ?? '-'}</td>
                      <td>{m.balanceQty}</td>
                      <td>{money(m.finalPrice)}</td>
                      <td>{money(m.netAmount)}</td>
                    </tr>
                  ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="bg-[#eef1f6] font-bold">
                    <td colSpan={5} className="text-right">TOTAL</td>
                    <td>{text(totalReceipts)}</td>
                    <td>{text(totalIssues)}</td>
                    <td>{text(lastMovement.balanceQty)}</td>
                    <td />
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {rows.length > 0 && (
            <table className="dt mt-2">
              <thead>
                <tr>
                  <th className="!bg-[#747e86] !text-white">Location</th>
                  <th className="!bg-[#747e86] !text-white">Stock Point</th>
                  <th className="!bg-[#747e86] !text-white">Qty</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{text(d.currentLocation)}</td>
                  <td>{text(lastMovement.stockPoint)}</td>
                  <td>{text(lastMovement.balanceQty)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      {history && <SourceHistory history={history} />}
    </>
  );
}

/* BARCODE IMAGE - the picture of this barcode, kept on it
   (barcodeLabel.imageUrl; lib/barcodeImage.js). Shown from the URL it is
   saved under - never a local file - and never as a broken image. A new
   picture (upload, paste or drag & drop) waits as "Pending upload" until
   Save; over a saved one it asks Keep Existing / Replace Image first; Remove
   asks too. Only then is anything uploaded (POST /api/upload) and saved
   (/api/barcode-image), and only while the barcode still holds the image this
   screen showed. `onSaved({ barcodeImageUrl, barcodeImageStored })`. */
function BarcodeImagePanel({ detail, business, onSaved }) {
  const saved = String(detail.barcodeImageStored || '').trim() !== '';
  const [pending, setPending] = useState(null);     // { file, url, name }
  const [picking, setPicking] = useState(false);    // the input open (Upload / Replace)
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');         // '✓ Saved' after a save
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [modalImageSrc, setModalImageSrc] = useState('');
  const [modalImageAlt, setModalImageAlt] = useState('');

  /* a different barcode opened: nothing of the last one's picture stays */
  useEffect(() => {
    setPending((p) => { if (p) URL.revokeObjectURL(p.url); return null; });
    setPicking(false); setConfirmRemove(false); setError(''); setStatus('');
    setImageModalOpen(false);
    setModalImageSrc('');
    setModalImageAlt('');
  }, [detail.unitId]);

  /* Escape key closes the image modal */
  useEffect(() => {
    if (!imageModalOpen) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setImageModalOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [imageModalOpen]);

  const pick = (file) => {
    setPending((p) => { if (p) URL.revokeObjectURL(p.url); return { file, url: URL.createObjectURL(file), name: file.name || 'barcode-image' }; });
    setPicking(false); setError(''); setStatus('');
  };
  const discard = () => { setPending((p) => { if (p) URL.revokeObjectURL(p.url); return null; }); setError(''); };

  async function send(method, payload) {
    const r = await fetch('/api/barcode-image', {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unitId: detail.unitId, business: business || '', seen: detail.barcodeImageStored ?? '', ...payload }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'The server could not do that.');
    return d;
  }

  async function save() {
    if (!pending) return;
    setBusy(true); setError(''); setStatus('');
    try {
      const up = await uploadBarcodeImage(pending.file);
      const d = await send('POST', { url: up.url, name: pending.name });
      onSaved({ barcodeImageUrl: d.barcodeImageUrl, barcodeImageStored: d.barcodeImageStored });
      discard();
      setStatus('✓ Saved');
    } catch (e) {
      setError(e.message || '⚠ Barcode image upload failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true); setError(''); setStatus('');
    try {
      const d = await send('DELETE', {});
      onSaved({ barcodeImageUrl: d.barcodeImageUrl, barcodeImageStored: d.barcodeImageStored });
      setConfirmRemove(false);
      setStatus('Barcode image removed.');
    } catch (e) {
      setError(e.message);
      setConfirmRemove(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overflow-hidden rounded border border-line" aria-label="Barcode image">
      <div className="bg-[#f4f7fb] px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-inkmuted">Barcode Image</div>
      <div className="space-y-2 p-3">
        {pending && saved ? (
          <>
            <div className="text-[12px] font-bold uppercase tracking-wide text-[#8a5a00]">Existing barcode image found</div>
            <div className="grid grid-cols-2 gap-2">
              <BarcodeImageThumb label="Existing image" src={detail.barcodeImageUrl} alt={`Existing barcode image of ${detail.barcodeNo}`} height={110} onClick={() => { setModalImageSrc(detail.barcodeImageUrl); setModalImageAlt(`Existing barcode image of ${detail.barcodeNo}`); setImageModalOpen(true); }} />
              <BarcodeImageThumb label="New image" src={pending.url} alt={`New barcode image of ${detail.barcodeNo}`} height={110} />
            </div>
            <div className="text-[12.5px] text-ink">Do you want to replace the existing barcode image?</div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn" onClick={discard} disabled={busy}>Keep Existing</button>
              <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
                {busy ? <span className="spin" /> : null} Replace Image
              </button>
            </div>
          </>
        ) : pending ? (
          <>
            <BarcodeImageThumb label="Selected image" src={pending.url} alt={`New barcode image of ${detail.barcodeNo}`} height={170} />
            <div className="text-[12px] text-inkmuted">Status: Pending upload</div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
                {busy ? <span className="spin" /> : <Icon name="check" size={14} />} Save Image
              </button>
              <button type="button" className="btn" onClick={discard} disabled={busy}>Cancel</button>
            </div>
          </>
        ) : (
          <>
            <BarcodeImageThumb
              src={detail.barcodeImageUrl}
              alt={`Barcode image of ${detail.barcodeNo}`}
              height={170}
              onClick={detail.barcodeImageUrl ? () => { setModalImageSrc(detail.barcodeImageUrl); setModalImageAlt(`Barcode image of ${detail.barcodeNo}`); setImageModalOpen(true); } : null}
            />
            {saved ? (
              <>
                {status && <div className="text-[12px] font-semibold text-okgreen" role="status">Status: {status}</div>}
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn" onClick={() => { setPicking(true); setError(''); }} disabled={busy}>
                    <Icon name="upload" size={14} /> Replace Image
                  </button>
                  <button type="button" className="btn" onClick={() => setConfirmRemove(true)} disabled={busy}>
                    <Icon name="trash" size={14} /> Remove Image
                  </button>
                </div>
              </>
            ) : (
              <>
                {status && <div className="text-[12px] text-inkmuted" role="status">{status}</div>}
                {!picking && (
                  <button type="button" className="btn" onClick={() => { setPicking(true); setError(''); }} disabled={busy}>
                    <Icon name="upload" size={14} /> Upload Barcode Image
                  </button>
                )}
              </>
            )}
            {picking && (
              <>
                <BarcodeImageInput onPicked={pick} disabled={busy} />
                <button type="button" className="btn h-8" onClick={() => setPicking(false)} disabled={busy}>Cancel</button>
              </>
            )}
          </>
        )}
        {error && <div className="flash flash-err text-[12.5px]" role="alert">{error}</div>}
      </div>

      {confirmRemove && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-label="Remove barcode image?">
          <div className="w-full max-w-[440px] rounded-lg bg-white shadow-xl">
            <div className="border-b border-line px-5 py-3 text-[15px] font-bold uppercase tracking-wide">Remove barcode image?</div>
            <div className="space-y-2 p-5 text-[13px]">
              <p>This will remove the barcode image associated with this barcode (<span className="font-mono">{detail.barcodeNo}</span>).</p>
              <div className="w-[160px]"><BarcodeImageThumb src={detail.barcodeImageUrl} alt={`Barcode image of ${detail.barcodeNo}`} height={100} onClick={() => { setModalImageSrc(detail.barcodeImageUrl); setModalImageAlt(`Barcode image of ${detail.barcodeNo}`); setImageModalOpen(true); }} /></div>
            </div>
            <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
              <button type="button" className="btn" onClick={() => setConfirmRemove(false)} disabled={busy}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={remove} disabled={busy}>
                {busy ? <span className="spin" /> : <Icon name="trash" size={14} />} Remove Image
              </button>
            </div>
          </div>
        </div>
      )}

      {imageModalOpen && modalImageSrc && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-label="Expanded image"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setImageModalOpen(false); }}
        >
          <div className="relative flex max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] items-center justify-center">
            <button
              type="button"
              onClick={() => setImageModalOpen(false)}
              aria-label="Close"
              className="absolute -top-8 right-0 rounded bg-white/10 px-2 py-1 text-2xl leading-none text-white hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              ×
            </button>
            <img
              src={modalImageSrc}
              alt={modalImageAlt}
              className="max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* A unit imported from the other ERP's Barcode Report (Barcode Report ->
   Import): that ERP's own movement list, its totals and its stock by
   location, as its Details page showed them. History only - this ERP's
   ledger is the table above. */
function SourceHistory({ history }) {
  const moves = history.movements || [];
  const totals = history.totals || {};
  const shown = totals.printed && Object.keys(totals.printed).length ? totals.printed : totals.computed || {};
  return (
    <div className="card mt-4">
      <div className="card-head">
        <span className="card-title"><Icon name="file" size={15} /> Movements on erp.orbiteerp.com</span>
      </div>
      <div className="card-body">
        <div className="overflow-x-auto">
          <table className="dt">
            <thead>
              <tr>
                {['Location', 'Doc Date', 'Type', 'Doc No', 'Supplier/Cust/Location', 'Particulars', 'Stock Point',
                  'Receipts', 'Issues', 'Balance', 'Qty', 'Final Price', 'Net Amt'].map((h) => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {moves.length === 0
                ? <tr><td colSpan="13" className="dt-empty">No movements were imported for this barcode.</td></tr>
                : moves.map((m) => (
                  <tr key={m.key}>
                    <td>{text(m.location)}</td>
                    <td>{when(m.docDate)}</td>
                    <td>{text(m.docType)}</td>
                    <td>{text(m.docNo)}</td>
                    <td>{text(m.party)}</td>
                    <td>{text(m.particulars)}</td>
                    <td>{text(m.stockPoint)}</td>
                    <td>{m.receipts}</td>
                    <td>{m.issues}</td>
                    <td>{m.balance}</td>
                    <td>{m.qty}</td>
                    <td>{money(m.finalPrice)}</td>
                    <td>{money(m.netAmount)}</td>
                  </tr>
                ))}
            </tbody>
            {moves.length > 0 && (
              <tfoot>
                <tr className="font-semibold">
                  <td colSpan="7">Total</td>
                  <td>{text(shown.receipts)}</td>
                  <td>{text(shown.issues)}</td>
                  <td>{text(shown.balance)}</td>
                  <td />
                  <td />
                  <td>{money(shown.netAmount)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {totals.mismatches?.length > 0 && (
          <div className="flash flash-err mt-2">
            The rows add up to {totals.mismatches.map((k) => `${k} ${totals.computed[k]}`).join(', ')} - the page&apos;s totals said otherwise.
          </div>
        )}
        {(history.stock || []).length > 0 && (
          <table className="dt mt-4">
            <thead><tr><th>Location</th><th>Stock Point</th><th>Stock</th></tr></thead>
            <tbody>
              {history.stock.map((s) => (
                <tr key={s.location + '|' + s.stockPoint}>
                  <td>{text(s.location)}</td><td>{text(s.stockPoint)}</td><td>{money(s.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
