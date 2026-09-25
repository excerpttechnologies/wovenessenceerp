'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import BarcodeSvg from '@/components/BarcodeSvg';

const money = (value) => Number(value || 0).toFixed(2);

/* What a stored line is actually worth. `netAmount` is written on save; the
   older `lineTotal` is only ever a till-side derived field, so it is a
   fallback rather than the source. Last resort recomputes from rsp x qty. */
const lineNet = (item) => {
  const stored = Number(item.netAmount ?? item.lineTotal ?? NaN);
  if (Number.isFinite(stored)) return stored;
  const gross = Number(item.rsp || 0) * Number(item.qty || 0);
  return gross * (1 - Number(item.discountPct || 0) / 100);
};

/* RSP is GST-inclusive, matching the till - tax is backed out of the line,
   never added to it. */
const lineTax = (item) => {
  const rate = Number(item.gst || 0);
  return lineNet(item) - lineNet(item) / (1 + rate / 100);
};

const lineDiscount = (item) =>
  Math.max(0, Number(item.rsp || 0) * Number(item.qty || 0) - lineNet(item));
export default function PrintPosPage() {
  const { id } = useParams();
  const [doc, setDoc] = useState(null);
  useEffect(() => { fetch('/api/sell-pos/' + id).then((r) => r.json()).then((d) => setDoc(d.doc || null)); }, [id]);
  if (!doc) return <div className="p-6">Loading invoice...</div>;
  const taxable = (doc.items || []).reduce((sum, item) => sum + lineNet(item) - lineTax(item), 0);
  return <main className="print-doc mx-auto max-w-3xl bg-white p-6 text-[13px] text-black print:p-0"><div className="mb-4 flex items-start justify-between"><div><h1 className="text-xl font-bold">{doc.locationName || doc.businessName || 'POS'}</h1><div>{doc.businessName || '-'}</div><div>{doc.locationName || '-'}</div><div>POS TAX INVOICE</div></div><div className="text-right">{/* Wider bars AND a wider box, because either alone does nothing.

              BarcodeSvg keeps the aspect ratio, so the drawn size is whichever
              of the two limits binds first. A short invoice number like "0039"
              is only 57 modules: at the default module width of 1.2 it is
              68x55 naturally, so in a 190x52 box the HEIGHT bound and it drew
              just 65px wide - the letterboxing that made it look thin. Widening
              the box alone would have changed nothing.

              Module width 2.5 makes that same number 143px naturally, so it now
              draws ~166px. A long number such as "TFJ/26/0142" is 145 modules
              and was already hitting the old 190px ceiling and being scaled
              down; the wider box lets it draw ~280px instead. */}<BarcodeSvg value={doc.invoiceNo || ''} height={40} width={2.5} displayValue className="block h-[64px] w-[280px]" /><div className="text-[10px]">Scan to find this sale</div><button className="btn no-print mt-2" onClick={() => window.print()}>Print Invoice</button></div></div><div className="mb-4 grid grid-cols-2 gap-1 border-y border-black py-2"><div><b>Invoice No:</b> {doc.invoiceNo || '-'}</div><div><b>Date:</b> {doc.date ? new Date(doc.date).toLocaleDateString('en-GB') : '-'}</div><div><b>Customer:</b> {doc.customerName || 'Walk-in Customer'}</div><div><b>Contact:</b> {doc.customerContact || '-'}</div><div><b>Address:</b> {doc.customerAddress || '-'}</div><div><b>Billing Type:</b> {doc.billingType || '-'}</div></div><table className="w-full border-collapse border border-black"><thead><tr className="bg-[#168552] text-white">{['Barcode No','Item Code','Item Name','HSN','GST (%)','Qty','RSP Price','Discount','Tax','Amount'].map((x) => <th className="border border-black p-2 text-left" key={x}>{x}</th>)}</tr></thead><tbody>{(doc.items || []).map((item, i) => <tr key={i}><td className="border border-black p-2">{item.barcodeNo || item.barcode || '-'}</td><td className="border border-black p-2">{item.code || item.itemCode || '-'}</td><td className="border border-black p-2">{item.description || item.name || '-'}</td><td className="border border-black p-2">{item.hsn || '-'}</td><td className="border border-black p-2">{money(item.gst)}</td><td className="border border-black p-2">{item.qty || 0}</td><td className="border border-black p-2">{money(item.rsp)}</td><td className="border border-black p-2">{money(lineDiscount(item))}</td><td className="border border-black p-2">{money(lineTax(item))}</td><td className="border border-black p-2">{money(lineNet(item))}</td></tr>)}</tbody><tfoot><tr><td colSpan="9" className="border border-black p-2 text-right">Taxable Amount</td><td className="border border-black p-2">{money(taxable)}</td></tr><tr><td colSpan="9" className="border border-black p-2 text-right font-bold">Total Payable</td><td className="border border-black p-2 font-bold">{money(doc.totalAmount)}</td></tr><tr><td colSpan="9" className="border border-black p-2 text-right">Total Paid</td><td className="border border-black p-2">{money(doc.paid)}</td></tr><tr><td colSpan="9" className="border border-black p-2 text-right">Total Remaining</td><td className="border border-black p-2">{money(doc.sellDue)}</td></tr></tfoot></table><div className="mt-4 border-t border-black pt-3">Payment method: {(doc.payments || []).filter((p) => Number(p.amount || 0) > 0).map((p) => `${p.method} ${money(p.amount)}`).join(', ') || '-'}</div><div className="mt-4">Terms & Conditions: Goods once sold cannot be taken back or exchanged.</div><div className="mt-4 text-center font-bold">Thank you. Visit Again</div></main>;
}
