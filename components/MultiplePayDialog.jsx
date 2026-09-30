'use client';
import { useState } from 'react';
import Icon from '@/components/Icon';

/* The MULTIPLE PAYMENT dialog.

   Lifted out of components/PosTill.jsx so the till and the POS Payments screen
   share ONE definition - the edit screen has to show the same methods, the same
   totals panel and the same arithmetic as the screen that took the money, and
   two copies would drift the first time either changed.

   Opens blank for a new bill, or seeded from `initialPayments` when editing
   one that has already been paid. */

/* The methods every bill offers. A split across two UPI apps is two
   UPI/Card rows - the + on that row adds another one - rather than a wallet
   picked by name (user, 30-09-2026: no PayTM / PhonePe / GPay menu). */
const UPI_METHOD = 'UPI/Card';
const MULTI_PAYMENT_METHODS = ['Cash', UPI_METHOD, 'Bank Deposit'];

/* whole rupees, as on the till and the POS list */
const money = (value) => String(Math.trunc(Number(value || 0)));

const sameMethod = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

/* Wallets belong directly beneath UPI, not at the bottom of the list - they
   are a kind of UPI, and a GPay row sitting under Bank Deposit reads as though
   it settles like one. */
function insertUnderUpi(rows, extras) {
  if (!extras.length) return rows;
  const upiAt = rows.findIndex((p) => sameMethod(p.method, UPI_METHOD));
  if (upiAt === -1) return [...rows, ...extras];
  let at = upiAt + 1;
  while (at < rows.length && rows[at].custom) at += 1;
  return [...rows.slice(0, at), ...extras, ...rows.slice(at)];
}

export default function MultiplePayDialog({
  totalItems, totalPayable, onClose, onSubmit,
  initialPayments = [], initialSellNote = '', initialStaffNote = '',
  title = 'Multiple Payment', submitLabel = 'Submit', saving = false,
}) {
  const [payments, setPayments] = useState(() => {
    const same = sameMethod;

    /* Each stored payment row fills AT MOST ONE row here, by position - a
       bill split across two UPI/Card rows must come back as two rows, not
       one. `used` marks the stored rows the base list has consumed. */
    const used = new Set();
    const base = MULTI_PAYMENT_METHODS.map((method) => {
      const at = initialPayments.findIndex((p, i) => !used.has(i) && same(p.method, method));
      if (at > -1) used.add(at);
      const existing = at > -1 ? initialPayments[at] : null;
      return { method, amount: existing ? String(existing.amount ?? '') : '', note: existing?.note || '', custom: false };
    });

    /* Everything left over keeps its own row: a second UPI/Card split, or an
       older bill paid under a name this list no longer carries ("PayTM").
       Dropping them would wipe that money on the next save, because only
       rows with an amount are kept. */
    const extras = initialPayments
      .filter((p, i) => !used.has(i))
      .map((p) => ({ method: p.method || '', amount: String(p.amount ?? ''), note: p.note || '', custom: true }));

    return insertUnderUpi(base, extras);
  });
  /* the radio's choice, BY ROW - two rows can share the UPI/Card name */
  const [selectedIndex, setSelectedIndex] = useState(
    () => initialPayments.findIndex((p) => Number(p.amount || 0) > 0)
  );
  const [sellNote, setSellNote] = useState(initialSellNote);
  const [staffNote, setStaffNote] = useState(initialStaffNote);
  const totalPaying = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const changeReturn = Math.max(0, totalPaying - totalPayable);
  const balance = Math.max(0, totalPayable - totalPaying);

  /* The + on the UPI/Card row: one more UPI/Card row, right under it - for a
     bill split across two UPI payments. Removable, like any added row. */
  function addUpiRow() {
    setPayments((current) => insertUnderUpi(current, [{ method: UPI_METHOD, amount: '', note: '', custom: true }]));
  }

  function removeMethod(index) {
    setPayments((current) => current.filter((_, i) => i !== index));
  }

  function updatePayment(index, key, value) {
    setPayments((current) => current.map((payment, i) => i === index ? { ...payment, [key]: value } : payment));
  }

  /* Picking a method moves the whole payable onto that row and clears the
     others, so choosing PayTM after Cash swaps the amount across rather than
     leaving the bill paid twice. Nothing is pre-selected: the cashier chooses,
     and until they do every row reads 0.

     Split payments still work - type into a second row after choosing, and
     Total Paying / Balance add up as before. */
  function chooseMethod(index) {
    setSelectedIndex(index);
    setPayments((current) => current.map((payment, i) => (
      i === index
        ? { ...payment, amount: String(totalPayable) }
        : { ...payment, amount: '' }
    )));
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-5xl rounded-lg bg-white p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line pb-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" aria-label="Close payment" className="flex h-8 w-8 items-center justify-center rounded-full bg-danger text-white" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div className="grid gap-4 pt-3 md:grid-cols-[1fr_220px]">
          <div>
            <div className="mb-3 text-[12px] text-danger">Enter payment amounts across one or more methods. The totals update automatically.</div>
            <div className="grid grid-cols-[1fr_1fr_1.5fr_auto] border-b border-line px-2 py-2 text-[12px] font-semibold text-inkmuted"><span>Method *</span><span>Amount</span><span>Payment note</span></div>
            {payments.map((payment, index) => (
              <div className="grid grid-cols-[1fr_1fr_1.5fr_auto] items-center gap-2 border-b border-line px-2 py-2" key={index}>
                <label className={'flex cursor-pointer items-center text-[13px] ' + (selectedIndex === index ? 'font-bold text-brand' : 'font-semibold text-ink')}>
                  <input type="radio" name="pos-pay-method" className="sr-only" checked={selectedIndex === index} onChange={() => chooseMethod(index)} />
                  {payment.method}
                </label>

                <input className="f-input" type="number" min="0" step="0.01" placeholder="Enter amount" value={payment.amount} onChange={(event) => updatePayment(index, 'amount', event.target.value)} onWheel={(e) => e.currentTarget.blur()} />
                <input className="f-input" placeholder="Payment note" value={payment.note} onChange={(event) => updatePayment(index, 'note', event.target.value)} />

                {/* row action: + on the base UPI/Card row adds another
                    UPI/Card row, X drops an added one. Every other row keeps
                    an empty cell so the inputs stay aligned down the column. */}
                <span className="relative flex w-6 justify-center">
                  {sameMethod(payment.method, UPI_METHOD) && !payment.custom && (
                    <button type="button" aria-label="Add another UPI/Card row" title="Add another UPI/Card row" className="inline-flex h-6 w-6 items-center justify-center rounded border border-line bg-pillgrey text-ink hover:bg-linestrong" onClick={addUpiRow}>
                      <Icon name="plus" size={12} />
                    </button>
                  )}
                  {payment.custom && (
                    <button type="button" aria-label="Remove method" title="Remove" className="act-btn bg-danger" onClick={() => removeMethod(index)}>
                      <Icon name="x" size={12} />
                    </button>
                  )}
                </span>
              </div>
            ))}
            <div className="mt-3 grid gap-2 md:grid-cols-2"><label className="field-label">Sell note<input className="f-input" value={sellNote} onChange={(event) => setSellNote(event.target.value)} /></label><label className="field-label">Staff note<input className="f-input" value={staffNote} onChange={(event) => setStaffNote(event.target.value)} /></label></div>
            <button type="button" className="btn btn-primary mx-auto mt-4 flex min-w-52 justify-center" disabled={saving} onClick={() => onSubmit({ payments, sellNote, staffNote })}>{saving ? 'Saving...' : submitLabel}</button>
          </div>
          <div className="rounded-lg bg-[#ffc400] p-4 text-ink shadow-inner"><div className="border-b border-black/15 pb-3"><div className="text-[12px] font-semibold">Total Items:</div><div className="text-xl font-bold">{totalItems}</div></div><div className="border-b border-black/15 py-3"><div className="text-[12px] font-semibold">Total Payable:</div><div className="text-xl font-bold">{money(totalPayable)}</div></div><div className="border-b border-black/15 py-3"><div className="text-[12px] font-semibold">Total Paying:</div><div className="text-xl font-bold">{money(totalPaying)}</div></div><div className="border-b border-black/15 py-3"><div className="text-[12px] font-semibold">Cash Return:</div><div className="text-xl font-bold text-danger">{money(changeReturn)}</div></div><div className="pt-3"><div className="text-[12px] font-semibold">Balance:</div><div className="text-xl font-bold">{money(balance)}</div></div></div>
        </div>
      </div>
    </div>
  );
}

/* Billing block, laid out to match the Basic Information tab of
   /admin/contact/customer/add so the two forms ask for the same things in the
   same order. Keys are the customer schema's own, not POS-local names. */
const BILLING_ROWS = [
  ['billingAddressLine1', 'Address Line 1'],
  ['billingAddressLine2', 'Address Line 2'],
  ['billingState', 'State'],
  ['billingCountry', 'Country'],
  ['billingDistrict', 'District'],
  ['billingTaluk', 'Taluk'],
  ['billingAlternateContactNumber', 'Alternate Contact'],
  ['billingLandline', 'Landline'],
  ['billingFax', 'Fax'],
  ['billingEmail', 'Email'],
  ['billingEmail2', 'Email 2'],
  ['billingWebsiteUrl', 'Website URL'],
];
