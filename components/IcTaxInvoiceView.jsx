'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from './Icon';
import {
  qtyByUom, hsnSummary, invoiceTotals, money,
} from '@/app/admin/transaction/intercompanysell/salesinvoice/fields';
import { amountInWords } from '@/lib/amountWords';

/* ==========================================================================
   Printable Tax Invoice (e-invoice layout).

   Everything outside the document is hidden at print time by the `print-doc`
   / `no-print` rules already in globals.css, so the browser's own print
   dialog handles pagination - same approach as the GRC print view.

   The IRN / Ack No / Ack Date / QR block renders only when those fields are
   populated. Nothing here calls the IRP: a real integration writes them onto
   the invoice, and until then the document prints as a plain tax invoice
   rather than showing empty e-invoice labels.
   ========================================================================== */

const d = (v) => {
  if (!v) return '';
  const x = new Date(v);
  if (Number.isNaN(x.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return p(x.getDate()) + '/' + p(x.getMonth() + 1) + '/' + x.getFullYear();
};

const dt = (v) => {
  if (!v) return '';
  const x = new Date(v);
  if (Number.isNaN(x.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return d(v) + ' ' + p(x.getHours()) + ':' + p(x.getMinutes()) + ':' + p(x.getSeconds());
};

/* Indian grouping, as the printed figures use (1,37,806.00) */
const inr = (v) => Number(money(v)).toLocaleString('en-IN', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

/* `endpoint` lets the consignment Sales Invoice print through this same
   layout - it defaults to the older IC invoice's route, so the existing
   screens change nothing. `backHref` is where Back returns to. */
export default function IcTaxInvoiceView({
  id,
  endpoint = '',
  backHref = '/admin/transaction/intercompanysell/salesinvoice',
  /* true prints the same document under the e-Invoice heading - the IRN /
     Ack / QR block renders whenever those fields are populated, in either
     mode */
  einvoice = false,
}) {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(endpoint || '/api/ic-sales-invoice/' + id + '/print')
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || 'Could not load');
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id, endpoint]);

  if (error) return <div className="card"><div className="card-body text-danger">{error}</div></div>;
  if (!data) return <div className="card"><div className="card-body"><span className="spin" /></div></div>;

  const { seller, buyer, invoice, items } = data;
  const totals = invoiceTotals(items);
  const perUom = qtyByUom(items);
  const hsn = hsnSummary(items);
  const intra = totals.cgstTotal > 0 || totals.sgstTotal > 0;

  const sellerAddr = [seller?.addressLine1, seller?.addressLine2, seller?.city]
    .filter(Boolean).join(', ');
  const buyerAddr = [buyer?.addressLine1, buyer?.addressLine2, buyer?.city]
    .filter(Boolean).join(', ');

  return (
    <>
      <div className="no-print mb-3 flex items-center">
        <span className="text-[15px] font-bold text-brand-link">{einvoice ? 'Print E-Invoice' : 'Print Tax Invoice'}</span>
        <span className="flex-1" />
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          <Icon name="printer" size={14} /> Print
        </button>
        <button
          type="button"
          className="btn ml-2"
          onClick={() => router.push(backHref)}
        >
          <Icon name="back" size={14} /> Back
        </button>
      </div>

      <div className="print-doc mx-auto max-w-[980px] bg-white text-[13px]">
        <div className="mb-1 text-center text-[15px] font-bold">{einvoice ? 'e-Invoice' : 'Tax Invoice'}</div>

        <div className="border border-black">
          {/* ------------------------------------------------ letterhead */}
          <div className="relative border-b border-black px-4 py-3 text-center">
            <div className="text-[22px] font-bold">{seller?.printName || seller?.name || ''}</div>
            {seller?.locationName && <div>({seller.locationName})</div>}
            {sellerAddr && <div>{sellerAddr}</div>}
            <div>
              {[seller?.state, seller?.zipCode].filter(Boolean).join(' - ')}
              {seller?.mobile ? ', Tel: ' + seller.mobile : ''}
            </div>
            {seller?.gstin && <div className="font-bold">GSTIN: {seller.gstin}</div>}

            {/* the signed QR payload, when an IRP integration has written one */}
            {invoice.qrCode && (
              <img
                src={invoice.qrCode}
                alt="e-invoice QR"
                className="absolute right-3 top-3 h-[110px] w-[110px]"
              />
            )}
          </div>

          {/* ------------------------------------------ buyer + doc block */}
          <div className="grid grid-cols-1 border-b border-black md:grid-cols-2">
            <div className="border-black px-3 py-2 md:border-r">
              <div className="font-bold">{buyer?.name || ''}</div>
              {buyerAddr && <div>{buyerAddr}</div>}
              <div>
                {buyer?.zipCode ? 'PIN - ' + buyer.zipCode : ''}
                {buyer?.mobile ? ', Tel: ' + buyer.mobile : ''}
                {buyer?.gstin ? ', GSTIN: ' + buyer.gstin : ''}
              </div>
            </div>
            <div className="px-3 py-2 text-right">
              <div><b>Inv. No. {invoice.invoiceNo || ''}</b></div>
              <div><b>Inv. Date : {d(invoice.invoiceDate)}</b></div>
              {invoice.ackNo && <div><b>Ack. No. : {invoice.ackNo}</b></div>}
              {invoice.ackDate && <div><b>Ack. Date : {dt(invoice.ackDate)}</b></div>}
              {invoice.irn && (
                <div className="break-all"><b>Irn : {invoice.irn}</b></div>
              )}
            </div>
          </div>

          {/* ----------------------------------------------------- items */}
          <table className="prn-tbl">
            <thead>
              <tr>
                <th style={{ width: 50 }}>Sl No.</th>
                <th style={{ width: 90 }}>HSN</th>
                <th>Item Name</th>
                <th style={{ width: 60 }}>Qty</th>
                <th style={{ width: 70 }}>UoM</th>
                <th style={{ width: 80 }}>Rate</th>
                <th style={{ width: 110 }}>Taxable Amt.</th>
                <th style={{ width: 60 }}>Tax %</th>
                <th style={{ width: 90 }}>{intra ? 'Cgst.' : 'Igst.'}</th>
                {intra && <th style={{ width: 90 }}>Sgst.</th>}
                <th style={{ width: 110 }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={intra ? 11 : 10} className="py-6 text-center text-inkmuted">
                    This invoice has no line items.
                  </td>
                </tr>
              )}
              {items.map((r, i) => (
                <tr key={i}>
                  <td className="text-center">{i + 1}.</td>
                  <td className="text-center">{r.hsn}</td>
                  <td className="text-center">{r.itemName}</td>
                  <td className="text-center">{r.qty}</td>
                  <td className="text-center">{r.uom}</td>
                  <td className="text-right">{inr(r.finalRate)}</td>
                  <td className="text-right">{inr(r.beforeTax)}</td>
                  <td className="text-center">
                    {intra
                      ? (Number(r.cgstPct || 0) + Number(r.sgstPct || 0)) + ' %'
                      : (Number(r.igstPct || 0) + ' %')}
                  </td>
                  <td className="text-right">{inr(intra ? r.cgstAmount : r.igstAmount)}</td>
                  {intra && <td className="text-right">{inr(r.sgstAmount)}</td>}
                  <td className="text-right">{inr(r.netAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ---------------------------------------- qty totals + money */}
          <div className="grid grid-cols-1 border-t border-black md:grid-cols-2">
            <div className="px-4 py-3">
              {Object.entries(perUom).map(([u, q]) => (
                <div key={u}><b>Total Qty ({u}) : {q}</b></div>
              ))}
            </div>
            <div className="px-4 py-3">
              <Row label="Gross Total :" value={inr(totals.taxableValue)} />
              <Row label="Discount :" value={'-' + inr(0)} />
              <Row label="Sub Total :" value={inr(totals.taxableValue)} rule />
              {intra ? (
                <>
                  <Row label="CGST :" value={inr(totals.cgstTotal)} />
                  <Row label="SGST :" value={inr(totals.sgstTotal)} rule />
                </>
              ) : (
                <Row label="IGST :" value={inr(totals.igstTotal)} rule />
              )}
              <Row
                label=""
                value={inr(totals.taxableValue + totals.cgstTotal + totals.sgstTotal + totals.igstTotal)}
              />
              <Row label="Round Off :" value={inr(totals.roundOff)} />
              <Row label="Net Amount :" value={inr(totals.netValue)} strong />
            </div>
          </div>
        </div>

        {/* ------------------------------------------------ HSN summary */}
        <table className="prn-tbl mt-3">
          <thead>
            <tr>
              <th rowSpan={2}>HSN</th>
              <th rowSpan={2}>UoM</th>
              <th rowSpan={2} className="text-right">Qty.</th>
              <th rowSpan={2} className="text-right">Taxable Value</th>
              {intra ? (
                <>
                  <th colSpan={2}>CGST</th>
                  <th colSpan={2}>SGST</th>
                </>
              ) : (
                <th colSpan={2}>IGST</th>
              )}
              <th rowSpan={2} className="text-right">Net Amt</th>
            </tr>
            <tr>
              <th className="text-right">Rate</th>
              <th className="text-right">Amount</th>
              {intra && <th className="text-right">Rate</th>}
              {intra && <th className="text-right">Amount</th>}
            </tr>
          </thead>
          <tbody>
            {hsn.rows.map((r, i) => (
              <tr key={i}>
                <td>{r.hsn}</td>
                <td>{r.uom}</td>
                <td className="text-right">{r.qty}</td>
                <td className="text-right">{inr(r.taxableValue)}</td>
                {intra ? (
                  <>
                    <td className="text-right">{r.cgstRate}</td>
                    <td className="text-right">{inr(r.cgstAmount)}</td>
                    <td className="text-right">{r.sgstRate}</td>
                    <td className="text-right">{inr(r.sgstAmount)}</td>
                  </>
                ) : (
                  <>
                    <td className="text-right">{r.igstRate}</td>
                    <td className="text-right">{inr(r.igstAmount)}</td>
                  </>
                )}
                <td className="text-right">{inr(r.netAmount)}</td>
              </tr>
            ))}
            <tr className="font-bold">
              <td colSpan={2}>Total :</td>
              <td className="text-right">{hsn.total.qty}</td>
              <td className="text-right">{inr(hsn.total.taxableValue)}</td>
              {intra ? (
                <>
                  <td />
                  <td className="text-right">{inr(hsn.total.cgstAmount)}</td>
                  <td />
                  <td className="text-right">{inr(hsn.total.sgstAmount)}</td>
                </>
              ) : (
                <>
                  <td />
                  <td className="text-right">{inr(hsn.total.igstAmount)}</td>
                </>
              )}
              <td className="text-right">{inr(hsn.total.netAmount)}</td>
            </tr>
          </tbody>
        </table>

        {/* the figure spelled out, as the signed copy reads it */}
        <div className="mt-2 text-[13px]">
          <b>Amt In words :</b> {amountInWords(totals.netValue)}
        </div>
      </div>
    </>
  );
}

function Row({ label, value, rule, strong }) {
  return (
    <div className={'flex items-center ' + (strong ? 'font-bold' : '')}>
      <span className="flex-1">{label}</span>
      <span className={'min-w-[130px] text-right ' + (rule ? 'border-b border-black' : '')}>
        {value}
      </span>
    </div>
  );
}
