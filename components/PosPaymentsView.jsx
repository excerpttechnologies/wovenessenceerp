'use client';
import { useCallback, useEffect, useState } from 'react';
import MultiplePayDialog from '@/components/MultiplePayDialog';

/* POS Payments - the payments of one POS invoice, with Edit Payment.

   Shared by the stand-alone page (/admin/transaction/sell/pos/payment/<id>)
   and the popup the POS list opens from its View Payments button, so the two
   cannot show different things.

   `onBack`  the Back / Close button: router.back() on the page, closing the
             popup on the list.
   `onSaved` called after an edited split is saved, so the list behind the
             popup can refresh its Paid / Sell Due figures. */

/* whole rupees on this screen - the paise are dropped, not rounded, the
   same rule the POS list uses */
const money = (value) => String(Math.trunc(Number(value || 0)));

export default function PosPaymentsView({ id, onBack, backLabel = 'Back', onSaved }) {
  const [doc, setDoc] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => (
    fetch('/api/sell-pos/' + id, { cache: 'no-store' })
      .then((r) => r.json()).then((d) => setDoc(d.doc || null))
  ), [id]);
  useEffect(() => { setDoc(null); load(); }, [load]);

  /* Sends the edited split back. Only the rows carrying money are kept, so
     clearing a method removes it rather than storing a zero row. */
  async function savePayments({ payments, sellNote, staffNote }) {
    setSaving(true);
    try {
      const kept = payments.filter((p) => Number(p.amount || 0) > 0)
        .map((p) => ({ method: p.method, amount: Number(p.amount), note: p.note || '' }));
      const r = await fetch('/api/sell-pos/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { payments: kept, sellNote, staffNote } }),
      });
      if (!r.ok) return;
      setEditing(false);
      await load();
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  if (!doc) return <div className="p-6">Loading payments...</div>;
  const payments = (doc.payments || []).filter((p) => Number(p.amount || 0) > 0);
  const displayedPayments = payments.length ? payments : (doc.paid > 0 ? [{ amount: doc.paid, method: doc.billingType || 'Cash', note: '' }] : []);

  /* Cash Return - what went back to the customer: paid over the bill, as
     on the printed invoice. It belongs to the bill, not to one method, so it
     is shown against the row it was handed back from - the Cash row when
     there is one, else the first row - and the other rows read 0. */
  const changeReturn = Math.max(0, Number(doc.paid || 0) - Number(doc.totalAmount || 0));
  const cashRow = displayedPayments.findIndex((p) => String(p.method || '').trim().toLowerCase() === 'cash');
  const changeRow = cashRow === -1 ? 0 : cashRow;
  return (
    <div className="bg-[#e8edf6] p-4 md:p-6">
      <div className="mb-5 flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">POS Payments</h1>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-primary" onClick={() => setEditing(true)}>Edit Payment</button>
          {onBack && <button type="button" className="btn" onClick={onBack}>{backLabel}</button>}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3"><section className="card p-4"><h2 className="border-b border-line pb-3 font-semibold">Invoice Info</h2><div className="space-y-1 pt-3 text-[13px]"><div><b>Business:</b> {doc.businessName || '-'}</div><div><b>Location:</b> {doc.locationName || '-'}</div><div><b>Invoice:</b> {doc.invoiceNo || '-'}</div><div><b>Billing Type:</b> {doc.billingType || '-'}</div><div><b>Counter:</b> {doc.counterName || '-'}</div></div></section><section className="card p-4"><h2 className="border-b border-line pb-3 font-semibold">Payment Info</h2><div className="space-y-1 pt-3 text-[13px]"><div><b>Net Amount:</b> {money(doc.totalAmount)}</div><div><b>Paid:</b> {money(doc.paid)}</div><div><b>Cash Return:</b> {money(changeReturn)}</div><div className="text-danger"><b>Due:</b> {money(doc.sellDue)}</div><div><b>Status:</b> {doc.paymentStatus || '-'}</div></div></section><section className="card p-4"><h2 className="border-b border-line pb-3 font-semibold">Customer Info</h2><div className="space-y-1 pt-3 text-[13px]"><div><b>Name:</b> {doc.customerName || 'Walk-in Customer'}</div><div><b>Contact:</b> {doc.customerContact || '-'}</div><div><b>Email:</b> {doc.customerEmail || '-'}</div><div><b>Address:</b> {doc.customerAddress || '-'}</div></div></section></div>
      <div className="card mt-5 overflow-x-auto p-0"><table className="dt"><thead><tr>{['Sl No', 'Date', 'Reference', 'Amount', 'Cash Return', 'Payment Method', 'Payment Note', 'File'].map((x) => <th key={x}>{x}</th>)}</tr></thead><tbody>{displayedPayments.length ? displayedPayments.map((p, i) => <tr key={i}><td>{i + 1}</td><td>{doc.date ? new Date(doc.date).toLocaleDateString('en-GB') : '-'}</td><td>{doc.invoiceNo || '-'}</td><td>{money(p.amount)}</td><td>{money(i === changeRow ? changeReturn : 0)}</td><td>{p.method || '-'}</td><td>{p.note || '-'}</td><td>-</td></tr>) : <tr><td colSpan="8" className="dt-empty">No payments recorded.</td></tr>}</tbody></table></div>

      {editing && (
        <MultiplePayDialog
          totalItems={(doc.items || []).length}
          totalPayable={Number(doc.totalAmount || 0)}
          initialPayments={displayedPayments}
          initialSellNote={doc.sellNote || ''}
          initialStaffNote={doc.staffNote || ''}
          title="Edit Payment"
          submitLabel="Save Payment"
          saving={saving}
          onClose={() => setEditing(false)}
          onSubmit={savePayments}
        />
      )}
    </div>
  );
}
