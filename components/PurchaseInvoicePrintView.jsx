'use client';
import { useEffect, useState } from 'react';
import Icon from './Icon';
import { amountInWords } from '@/lib/amountWords';

/* ==========================================================================
   Print Purchase Invoice - the full-screen overlay the printer icon opens.

   An overlay rather than its own route, matching the deployed screen: the
   list stays underneath and closing returns you to the same page and scroll
   position.

   Everything outside .print-doc is dropped at print time by the rules in
   globals.css, so the header bar and the Print button never reach paper.
   ========================================================================== */

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const money = (v) => num(v).toFixed(2);
/* Indian grouping, as the printed figures use (1,37,806.00) */
const inr = (v) => num(v).toLocaleString('en-IN', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

const d = (v) => {
  if (!v) return '';
  const x = new Date(v);
  if (Number.isNaN(x.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return p(x.getDate()) + '-' + p(x.getMonth() + 1) + '-' + x.getFullYear();
};

/* --------------------------------------------------------- HSN summary -- */
/* One row per HSN. Percentages are derived from the stored amounts - the
   line keeps igstAmount but not the rate it came from, and
   amount / beforeTax is exact for every slab. */
function hsnSummary(items) {
  const map = new Map();
  for (const r of items) {
    const key = r.hsn || '-';
    const cur = map.get(key) || {
      hsn: key, taxable: 0, igst: 0, cgst: 0, sgst: 0,
    };
    cur.taxable += num(r.beforeTax);
    cur.igst += num(r.igstAmount);
    cur.cgst += num(r.cgstAmount);
    cur.sgst += num(r.sgstAmount);
    map.set(key, cur);
  }
  const pct = (amt, base) => (base ? Math.round((amt / base) * 10000) / 100 : 0);
  const rows = [...map.values()].map((r) => ({
    ...r,
    igstPct: pct(r.igst, r.taxable),
    cgstPct: pct(r.cgst, r.taxable),
    sgstPct: pct(r.sgst, r.taxable),
  }));
  const total = rows.reduce((a, r) => ({
    taxable: a.taxable + r.taxable,
    igst: a.igst + r.igst,
    cgst: a.cgst + r.cgst,
    sgst: a.sgst + r.sgst,
  }), { taxable: 0, igst: 0, cgst: 0, sgst: 0 });
  return { rows, total };
}

function Money({ label, value, strong }) {
  return (
    <div className={'flex items-start justify-end gap-3 py-[1px] ' + (strong ? 'font-bold' : '')}>
      <span className="text-right">{label}</span>
      <span className="min-w-[92px] text-right">{value}</span>
    </div>
  );
}

export default function PurchaseInvoicePrintView({ id, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    fetch('/api/purchase-invoice/' + id + '/print')
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Could not load');
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    const key = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [onClose]);

  const b = data?.business;
  const s = data?.supplier;
  const invoice = data?.invoice;
  const totals = data?.totals;
  const items = data?.items || [];
  const hsn = hsnSummary(items);

  const headDiscount = totals ? totals.taxableValue * (totals.discountPercent / 100) : 0;
  const subTotal = totals ? totals.taxableValue - headDiscount - totals.roundOffDiscount : 0;

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-white">
      <div className="no-print flex items-center border-b border-line px-5 py-3">
        <span className="text-[15px] font-semibold">Print Purchase Invoice</span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e0342c] text-white"
        >
          <Icon name="x" size={14} />
        </button>
      </div>

      <div className="px-5 py-4 pb-24">
        {error && <div className="flash flash-err">{error}</div>}
        {!data && !error && <div className="py-10 text-center"><span className="spin" /></div>}

        {data && (
          <div className="print-doc mx-auto max-w-[860px] text-[13px]">
            <div className="mb-2 text-center text-[13px] font-bold">PURCHASE INVOICE</div>

            <div className="border border-black">
              {/* ---------------------------------------------- letterhead */}
              <div className="border-b border-black px-4 py-3 text-center">
                <div className="text-[24px] font-bold">
                  {b?.locationName || b?.printName || b?.name || ''}
                </div>
                {b?.addressLine1 && <div>{b.addressLine1}</div>}
                {b?.addressLine2 && <div>{b.addressLine2}</div>}
                <div>
                  {[b?.city, b?.state].filter(Boolean).join(', ')}
                  {b?.zipCode ? ' - ' + b.zipCode : ''}
                </div>
                {b?.mobile && <div>Tel: {b.mobile}</div>}
                {b?.gstin && <div className="font-bold">GSTIN: {b.gstin}</div>}
              </div>

              {/* ----------------------------------------- supplier + meta */}
              <div className="grid grid-cols-1 gap-4 border-b border-black px-4 py-3 md:grid-cols-2">
                <div>
                  <div className="text-[19px] font-bold">{s?.name || ''}</div>
                  {s?.addressLine1 && <div>{s.addressLine1}</div>}
                  {s?.addressLine2 && <div>{s.addressLine2}</div>}
                  <div>{[s?.city, s?.state].filter(Boolean).join(', ')}</div>
                  {s?.zipCode && <div>PIN - {s.zipCode}</div>}
                  {s?.mobile && <div>Tel: {s.mobile}</div>}
                  {s?.gstin && <div className="font-bold">GSTIN: {s.gstin}</div>}
                </div>
                <div className="md:pl-6">
                  <div><b>Invoice No.:</b> <b>{invoice.purchaseInvoiceNo}</b></div>
                  <div><b>Date:</b> <b>{d(invoice.purchaseDate) || '-'}</b></div>
                  <div><b>GRC No:</b> <b>{invoice.grcNumber}</b></div>
                  <div><b>Sup. Inv No:</b> <b>{invoice.vendorDocNo}</b></div>
                  <div><b>Sup. Inv Date:</b> <b>{d(invoice.vendorDocDate) || '-'}</b></div>
                </div>
              </div>

              {/* --------------------------------------------------- lines */}
              <div className="px-4 py-3">
                <table className="prn-tbl">
                  <thead>
                    <tr>
                      <th style={{ width: 52 }}>Sl No.</th>
                      <th style={{ width: 90 }}>Item Code</th>
                      <th>Item Name</th>
                      <th style={{ width: 84 }}>Bill Sl No.</th>
                      <th style={{ width: 92 }}>HSN</th>
                      <th style={{ width: 52 }}>Qty</th>
                      <th style={{ width: 74 }}>Rate</th>
                      <th style={{ width: 84 }}>Discount</th>
                      <th style={{ width: 86 }}>Final Rate</th>
                      <th style={{ width: 96 }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 && (
                      <tr>
                        <td colSpan={10} className="py-6 text-center text-inkmuted">
                          This invoice has no line items.
                        </td>
                      </tr>
                    )}
                    {items.map((r, i) => (
                      <tr key={i}>
                        <td className="text-center">{i + 1}</td>
                        <td className="text-center">{r.itemCode ?? ''}</td>
                        <td className="text-center">{r.itemName ?? ''}</td>
                        <td className="text-center">{r.billSlNo ?? i + 1}</td>
                        <td className="text-center">{r.hsn ?? ''}</td>
                        <td className="text-center">{num(r.qty)}</td>
                        <td className="text-right">{money(r.purchaseRate)}</td>
                        <td className="text-right">{money(r.discount)}</td>
                        <td className="text-right">{money(r.finalRate)}</td>
                        <td className="text-right">{money(r.beforeTax)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* ------------------------------ qty + HSN summary | money */}
                <div className="mt-3 grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div>
                    <div className="mb-2 text-center font-bold">
                      Total Qty: {num(totals.totalQuantity)}
                    </div>
                    <table className="prn-tbl">
                      <thead>
                        <tr>
                          <th>HSN</th>
                          <th>Taxable<br />Amount</th>
                          <th>IGST<br />%</th>
                          <th>Amt</th>
                          <th>CGST<br />%</th>
                          <th>Amt</th>
                          <th>SGST<br />%</th>
                          <th>Amt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hsn.rows.map((r) => (
                          <tr key={r.hsn}>
                            <td className="text-center">{r.hsn}</td>
                            <td className="text-right">{money(r.taxable)}</td>
                            <td className="text-center">{r.igst ? r.igstPct : ''}</td>
                            <td className="text-right">{r.igst ? money(r.igst) : ''}</td>
                            <td className="text-center">{r.cgst ? r.cgstPct : ''}</td>
                            <td className="text-right">{r.cgst ? money(r.cgst) : ''}</td>
                            <td className="text-center">{r.sgst ? r.sgstPct : ''}</td>
                            <td className="text-right">{r.sgst ? money(r.sgst) : ''}</td>
                          </tr>
                        ))}
                        <tr className="font-bold">
                          <td className="text-center">Total</td>
                          <td className="text-right">{money(hsn.total.taxable)}</td>
                          <td />
                          <td className="text-right">{hsn.total.igst ? money(hsn.total.igst) : ''}</td>
                          <td />
                          <td className="text-right">{hsn.total.cgst ? money(hsn.total.cgst) : ''}</td>
                          <td />
                          <td className="text-right">{hsn.total.sgst ? money(hsn.total.sgst) : ''}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="pt-1">
                    <Money label="Gross Total :" value={inr(totals.taxableValue)} />
                    <Money label="Discount :" value={inr(headDiscount)} />
                    <div className="h-3" />
                    <Money label="Sub Total :" value={inr(subTotal)} />
                    {totals.igstTotal > 0 && <Money label="IGST :" value={inr(totals.igstTotal)} />}
                    {totals.cgstTotal > 0 && <Money label="CGST :" value={inr(totals.cgstTotal)} />}
                    {totals.sgstTotal > 0 && <Money label="SGST :" value={inr(totals.sgstTotal)} />}
                    <Money
                      label="Freight charges BEFORE GST :"
                      value={'+' + inr(totals.freightBeforeGst)}
                    />
                    <Money label="Round Off :" value={inr(totals.roundOff)} />
                    <Money
                      label="Net Purchase Amount :"
                      value={inr(totals.netPurchaseAmt)}
                      strong
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ------------------------------------------- words + footer */}
            <div className="mt-2 flex items-start gap-4">
              <div className="flex-1">
                <b>Amt In Words:</b> {amountInWords(totals.netPurchaseAmt)}
              </div>
              <div className="whitespace-nowrap">
                For {b?.printName || b?.name || ''}
              </div>
            </div>
          </div>
        )}
      </div>

      {data && (
        <button
          type="button"
          onClick={() => window.print()}
          className="no-print fixed bottom-5 left-5 flex items-center gap-2 rounded bg-brand px-4 py-2 text-[13px] text-white shadow-pop hover:bg-brand-hover"
        >
          <Icon name="printer" size={14} /> Print
        </button>
      )}
    </div>
  );
}
