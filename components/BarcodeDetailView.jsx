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
//                 <Cell label="HSN" value={text(d.hsn)} />
//                 <Cell label="GST %" value={text(d.gst)} />
//                 <Cell label="UOM" value={text(d.uom)} />
//                 <Cell label="Status" value={text(d.status)} />
//                 <Cell label="Quantity" value={text(d.quantity)} />
//               </Band>

//               <Band title="Price Info">
//                 <Cell label="Purchase Rate" value={money(d.purchaseRate)} />
//                 <Cell label="RSP" value={money(d.rsp)} />
//                 <Cell label="Offer Price" value={money(d.offerPrice)} />
//                 <Cell label="WSP" value={money(d.wsp)} />
//               </Band>

//               <Band title="Supplier Details" last>
//                 <Cell label="Supplier" value={text(d.supplierName)} />
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
//     </>
//   );
// }




















'use client';
import { useEffect, useState } from 'react';
import Icon from './Icon';
import { useScope } from './ScopeContext';

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

/* One labelled value. The label sits above its value so a long branch name
   does not push the column out of shape. */
function Cell({ label, value, wide = false }) {
  return (
    <div className={'px-4 py-3 ' + (wide ? 'sm:col-span-2' : '')}>
      <div className="text-[11px] uppercase tracking-wide text-inkmuted">{label}</div>
      <div className="mt-0.5 text-[13.5px] text-ink">{value}</div>
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

export default function BarcodeDetailView({ barcodeNo, onBack }) {
  const { business } = useScope();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

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
      })
      .catch(() => { if (!off) setError('Could not reach the server.'); })
      .finally(() => { if (!off) setLoading(false); });

    /* the guard the suggestion box needed too: a slow answer for a barcode
       the operator has already navigated away from must not paint over the
       one they are looking at now */
    return () => { off = true; };
  }, [barcodeNo, business]);

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

  return (
    <>
      <div className="card">
        <div className="card-head flex items-center justify-between">
          <span className="card-title"><Icon name="barcode" size={15} /> Details</span>
          <button type="button" className="btn" onClick={onBack}>
            <Icon name="back" size={14} /> Back
          </button>
        </div>

        <div className="card-body">
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
                <Cell label="Quantity" value={text(d.quantity)} />
              </Band>

              <Band title="Other Info">
                <Cell label="PMA" value={text(d.pma)} />
              </Band>

              <Band title="Price Info">
                <Cell label="Purchase Rate" value={money(d.purchaseRate)} />
                <Cell label="Discount" value={money(d.discount)} />
                <Cell label="Final Rate" value={money(d.finalRate)} />
                <Cell label="RSP" value={money(d.rsp)} />
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
                <Cell label="GRC Number" value={text(d.grcNo)} />
                <Cell label="GRC Date" value={when(d.grcDate)} />
                <Cell label="Serial Number" value={text(d.serialNo)} />
                <Cell label="Batch Number" value={text(d.batchNo)} />
                <Cell label="Transfer Number" value={text(d.transferNo)} />
                <Cell label="Billing Number" value={text(d.billingNo)} />
              </Band>
            </div>

            {/* the photo, if the label carries one - a fixed box either way, so
                a barcode without an image does not shift the card */}
            <div className="flex h-[190px] w-full shrink-0 items-center justify-center rounded border border-line text-[12px] text-inkmuted lg:w-[220px]">
              {d.imageUrl
                ? <img src={d.imageUrl} alt={text(d.itemName)} className="max-h-full max-w-full object-contain" />
                : 'No image'}
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
                    .map((h) => <th key={h}>{h}</th>)}
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
            </table>
          </div>

          {rows.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-6 rounded bg-[#495464] px-4 py-2 text-[12.5px] text-white">
              <span>Location: {text(d.currentLocation)}</span>
              <span>Stock Point: {text(rows[rows.length - 1].stockPoint)}</span>
              <span>Qty: {rows[rows.length - 1].balanceQty}</span>
            </div>
          )}
        </div>
      </div>

      {history && <SourceHistory history={history} />}
    </>
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
