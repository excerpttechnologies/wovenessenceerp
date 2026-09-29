'use client';
import { useMemo, useState } from 'react';
import ListView from '@/components/ListView';
import Icon from '@/components/Icon';
import PosInvoiceView from '@/components/PosInvoiceView';
import PosPaymentsView from '@/components/PosPaymentsView';

/* Pos - list. Columns declared here, not fetched from a registry. */

/* WHEN THE BILL WAS RUNG UP - the day and the clock, from two fields.

   They mean different things and only one of them carries a time:

     date       the business date the till's date picker holds. Stored at
                midnight, ALWAYS - so asking for it as a datetime prints
                00:00:00 against every bill on the screen.
     createdAt  written by the timestamps option on models/PosInvoice.js when
                the invoice is saved. This is the real moment of the sale.

   So the day comes from `date`, which is also what the Start Date / End Date
   filter matches - taking the day from createdAt instead would put a row in
   the column that a search for its own date would not find - and the clock
   comes from createdAt.

   The time is shown ONLY when the two fall on the same day. A bill dated
   yesterday but rung up this morning would otherwise be stamped with a time
   belonging to a different day, which is worse than showing no time at all.

   Read with the local getters, exactly as fmt('date') in lib/format.js does,
   so the day this prints is the same day the column printed before. */
const pad = (n) => String(n).padStart(2, '0');
const sameDay = (a, b) => a.getFullYear() === b.getFullYear()
  && a.getMonth() === b.getMonth()
  && a.getDate() === b.getDate();

const billedAt = (row) => {
  if (!row.date) return '';
  const day = new Date(row.date);
  if (Number.isNaN(day.getTime())) return String(row.date);

  const text = pad(day.getDate()) + '-' + pad(day.getMonth() + 1) + '-' + day.getFullYear();

  const at = row.createdAt ? new Date(row.createdAt) : null;
  if (!at || Number.isNaN(at.getTime()) || !sameDay(day, at)) return text;

  /* to the SECOND. Two bills rung up in the same minute are ordinary at a
     counter, and without seconds the list gives no way to tell which came
     first - the rows are sorted on it, so the order looked arbitrary.

     On a 12-HOUR clock. Note the two cases a naive `hours % 12` gets wrong,
     both of which are trading hours: midday is 12 PM, not 0 PM, and midnight
     is 12 AM. `|| 12` turns the zero back into twelve for both. */
  const hours24 = at.getHours();
  const suffix = hours24 < 12 ? 'AM' : 'PM';
  const hours12 = hours24 % 12 || 12;

  return text + ' ' + pad(hours12) + ':' + pad(at.getMinutes()) + ':' + pad(at.getSeconds()) + ' ' + suffix;
};

/* WHAT THE BILL WAS ACTUALLY PAID WITH.

   Read from the payments array, NOT from billingType. billingType is the
   dropdown at the top of the till and stays on whatever it was left at -
   invoice 0045 is stored as Cash while its only payment is 600 on UPI/Card,
   so trusting it would print the wrong method on the screen.

   Multiple Pay writes a row for EVERY method it offers, including the ones
   left empty, so only rows carrying an amount count. Repeats are collapsed:
   a bill split across two cash entries is still cash, and a genuine split
   reads "CASH + UPI/CARD".

   Falls back to billingType for a bill with no payment rows at all - older
   invoices predate the Multiple Pay dialog - and to nothing when there is
   neither, rather than inventing a method. */
const payModes = (row) => {
  const used = (row.payments || [])
    .filter((p) => Number(p.amount || 0) > 0)
    .map((p) => String(p.method || '').trim())
    .filter(Boolean);
  const unique = [...new Set(used)];
  return unique.length ? unique.join(' + ') : String(row.billingType || '').trim();
};

/* HOW MUCH OF IT HAS BEEN COLLECTED.

   paymentStatus is written by the till and holds two words on file - 'Paid'
   and 'Part Paid'. Only a fully settled bill gets the tick: a tick against a
   bill still owing 597.80 would read as settled at a glance, which is the one
   thing this line exists to prevent. Part Paid says so in amber instead, with
   no mark.

   An unrecognised status is shown as it stands, uncoloured, rather than being
   forced into one of the two - a status this screen has not seen before is
   not something to guess at. */
const PAID_LOOK = {
  paid: { tick: true, className: 'text-okgreen' },
  'part paid': { tick: false, className: 'text-warnyellow' },
};

const CONFIG = {
  title: "Pos",
  basePath: '/admin/',
  slugPath: "transaction/sell/pos",
  endpoint: '/api/sell-pos',
  scope: ["business","location","finYear"],
  addHref: "/admin/pos/add",
  /* the till opens in its own browser tab, so the list stays open here */
  addNewTab: true,
  actionPosition: "left",
  /* three different destinations - view, payments, print - shown side by
     side rather than behind one Action menu. */
  actionVariant: "buttons",
  actionMenu: [
    /* View opens in a popup over the list - see the page component below.
       The stand-alone /pos/view/<id> page still works for direct links. */
    { label: "View", icon: "eye" },
    /* also a popup; /pos/payment/<id> still works for direct links */
    { label: "View Payments", icon: "ledger" },
    { label: "Print Invoice", icon: "printer", to: (row) => `/admin/transaction/sell/pos/print/${row._id}` },
  ],
  /* THE BOXES ABOVE THE LIST. Filled from the endpoint's `summary`, so they
     cover every invoice the filter matches rather than the page on screen -
     and because they follow the filter, setting Start and End Date to one day
     turns them into that day's takings.

     Five, in the order a counter reads them: how many bills, what they came
     to, how much of it is in hand, what is still owed, and how many pieces
     went out. Collected and Outstanding are kept apart rather than shown as
     one net figure, because a day can be busy and still leave money on the
     counter - which is exactly what the two numbers together say. */
  summaryCards: [
    { k: 'count', label: 'Total Invoices' },
    { k: 'totalAmount', label: 'Total Amount', f: 'wholeAmount' },
    { k: 'paid', label: 'Collected', f: 'wholeAmount', breakdown: 'paidBy' },
    // { k: 'sellDue', label: 'Outstanding', f: 'wholeAmount' },
    { k: 'totalQty', label: 'Qty Sold', f: 'qty', breakdown: 'qtyBy' },
  ],
  filters: [
    { k: "invoiceNo", label: "Invoice No", type: "text" },
    { k: "startDate", label: "Start Date", type: "date" },
    { k: "endDate", label: "End Date", type: "date" },
  ],
  columns: [
    /* Business and Location are not listed: this screen is already scoped by
       the company and location pickers in the top bar, so every row repeated
       the same two values and cost the columns that vary their width. The
       fields are still returned by the API and still exported. */
    /* no `f`: `value` has already produced the finished text, and fmt()
       passes an unformatted value straight through. The exports pick up the
       same string, so a downloaded sheet carries the time too. */
    { k: "date", t: "Date", value: billedAt },
    { k: "invoiceNo", t: "Invoice No" },
    { k: "counterName", t: "Counter" },
    { k: "customerName", t: "Customer Name" },
    { k: "customerContact", t: "Customer Contact" },
    // { k: "exempted", t: "Exempted", f: "yesno" },
    // { k: "billingType", t: "Billing Type" },
    // { k: "paymentStatus", t: "Payment Status" },
    /* The amount, and under it how it was paid. `f` is kept so the CSV and
       Excel exports still write a plain "260" - exportRows formats from
       the field and never calls render. */
    {
      k: "totalAmount",
      t: " Amount",
      f: "wholeAmount",
      render: (r) => {
        const mode = payModes(r);
        const status = String(r.paymentStatus || '').trim();
        const look = PAID_LOOK[status.toLowerCase()] || { tick: false, className: 'text-inkmuted' };
        return (
          <span className="inline-flex flex-col gap-0.5 leading-tight">
            <span className="font-semibold text-okgreen">
              {'₹' + Math.trunc(Number(r.totalAmount || 0))}
            </span>
            {status && (
              <span className={'inline-flex items-center gap-1 text-[11px] font-semibold ' + look.className}>
                {look.tick && <Icon name="checkCircle" size={12} />}
                {status}
              </span>
            )}
            {mode && <span className="text-[11px] text-inkmuted">{mode}</span>}
          </span>
        );
      },
    },
    { k: "paid", t: "Paid", f: "wholeAmount" },
     { k: "sellDue", t: "Sell Due", f: "wholeAmount" },
  ],
};

export default function TransactionSellPosListPage() {
  /* the invoice open in a popup, and which one: 'view' or 'payments' */
  const [popup, setPopup] = useState(null);   // { id, kind }
  /* bumped after a payment is edited, so Paid / Sell Due and the cards
     refresh without losing the filters */
  const [reloadKey, setReloadKey] = useState(0);

  /* Memoised so the list keeps one cfg object - a new one on every render
     would look like a changed screen to ListView. setPopup is stable. */
  const cfg = useMemo(() => ({
    ...CONFIG,
    actionMenu: CONFIG.actionMenu.map((m) => {
      if (m.label === 'View') return { ...m, onClick: (row) => setPopup({ id: row._id, kind: 'view' }) };
      if (m.label === 'View Payments') return { ...m, onClick: (row) => setPopup({ id: row._id, kind: 'payments' }) };
      return m;
    }),
  }), []);

  const close = () => setPopup(null);

  return (
    <>
      <ListView cfg={cfg} reloadKey={reloadKey} />
      {popup && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
          onMouseDown={close}
        >
          <div
            className="my-6 w-full max-w-6xl overflow-hidden rounded-lg bg-white shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {popup.kind === 'payments' ? (
              <PosPaymentsView
                id={popup.id}
                onBack={close}
                backLabel="Close"
                onSaved={() => setReloadKey((k) => k + 1)}
              />
            ) : (
              <PosInvoiceView id={popup.id} onBack={close} backLabel="Close" />
            )}
          </div>
        </div>
      )}
    </>
  );
}
