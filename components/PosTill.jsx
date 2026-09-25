'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/Icon';
import Field from '@/components/Field';
import MultiSelect from '@/components/MultiSelect';
import ProductImage from '@/components/ProductImage';
import { useScanner, useBarcodeLookup, useScanSound } from '@/components/useScanner';
import { useOptions } from '@/components/useOptions';
import MultiplePayDialog from '@/components/MultiplePayDialog';

const PAYMENT_MODES = ['Cash', 'Credit', 'Export', 'COD'];
const MULTI_PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Deposit'];
const CUSTOMER_DEFAULTS = {
  typeId: '', businessType: 'Un-Registered', gstNo: '', businessName: '', shortName: '',
  prefix: 'Mr.', firstName: '', middleName: '', lastName: '', dob: '', gender: 'Male',
  billingAddressLine1: '', billingAddressLine2: '',
  /* the counter is in Bangalore, so that is the city nearly every walk-in customer gets.
     Stored exactly as /api/cities returns it - the picker's value IS the city name,
     and the list also holds 'Bangalore Urban' and 'Bangalore Rural', so the spelling has
     to match the plain one or the box would open blank. State and Country stay empty,
     exactly as they do when the city is picked by hand: only the Zip box fills those. */
  billingCity: 'Bangalore', billingState: '',
  billingCountry: '', billingDistrict: '', billingTaluk: '', billingZipCode: '',
  billingMobile: '', billingAlternateContactNumber: '', billingLandline: '', billingFax: '',
  billingEmail: '', billingEmail2: '', billingWebsiteUrl: '',
  additionalDetails: '',
};
/* A title that states the customer's gender fills the Gender box for the
   operator. Only the three that actually carry one are mapped: Dr., Prof.,
   CA, Sr., Fr. and M/s. say nothing about gender (M/s. is a firm), so
   choosing one of those leaves whatever the operator has already picked. */
const GENDER_FOR_PREFIX = { 'Mr.': 'Male', 'Mrs.': 'Female', 'Ms.': 'Female' };

/* The counter sells to walk-in shoppers far more often than to another
   branch, so the Type box opens on Retail rather than on whichever type
   happens to have been created first. Matched on the label because the ids
   are per business; falls back to the old behaviour when no type is named
   Retail. */
const retailFirst = (types) => (
  (types.find((t) => /^\s*retail\s*$/i.test(String(t.label || ''))) || types[0] || {}).value || ''
);

const money = (value) => Number(value || 0).toFixed(2);
const customerLabel = (customer) => {
  const name = [customer.businessName, customer.firstName, customer.middleName, customer.lastName]
    .filter(Boolean).join(' ').trim();
  return [name || 'Unnamed Customer', customer.billingMobile].filter(Boolean).join(' - ');
};

/* The read-only CustomerInfoPanel that used to live here has been replaced by
   components/CustomerProfilePanel.jsx, which shows the same master fields on
   its Details tab and adds the purchase and return history the counter
   actually asks for. */

/* Till calculator - the keypad popover the deployed POS has in its top bar.

   Deliberately NOT eval(). The display is operator-typed text, and eval would
   execute whatever ends up in it; this walks the tokens instead, so the worst a
   malformed entry can do is show "Error". Two passes give * and / precedence
   over + and -, which a plain left-to-right fold would get wrong (2+3*4=14,
   not 20). */
function calcEvaluate(expr) {
  const tokens = String(expr).match(/(\d+\.?\d*|[+\-*/])/g);
  if (!tokens || !tokens.length) return '';

  const pass1 = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (t === '*' || t === '/') {
      const left = Number(pass1.pop());
      const right = Number(tokens[i + 1]);
      i += 1;
      pass1.push(t === '*' ? left * right : right === 0 ? NaN : left / right);
    } else {
      pass1.push(t);
    }
  }

  let acc = Number(pass1[0]);
  for (let i = 1; i < pass1.length; i += 2) {
    const n = Number(pass1[i + 1]);
    acc = pass1[i] === '+' ? acc + n : acc - n;
  }
  if (!Number.isFinite(acc)) return 'Error';
  return String(Math.round(acc * 1e6) / 1e6);
}

const CALC_KEYS = [
  ['C', '%', 'back', '/'],
  ['7', '8', '9', '*'],
  ['4', '5', '6', '-'],
  ['1', '2', '3', '+'],
  ['0', '.', '='],
];

function Calculator({ onClose }) {
  const [expr, setExpr] = useState('');

  function press(key) {
    if (key === 'C') { setExpr(''); return; }
    if (key === 'back') { setExpr((e) => e.slice(0, -1)); return; }
    if (key === '=') { setExpr((e) => calcEvaluate(e)); return; }
    /* % reads as "of a hundred" on a till - 12% becomes 0.12 - rather than as
       a remainder operator, which is what a cashier reaching for it means. */
    if (key === '%') { setExpr((e) => (e ? String(Number(calcEvaluate(e)) / 100) : e)); return; }
    setExpr((e) => e + key);
  }

  const keyClass = (key) => {
    if (key === 'C') return 'bg-danger text-white';
    if (key === '=') return 'col-span-2 bg-okgreen text-white';
    if (['/', '*', '-', '+', '%', 'back'].includes(key)) return 'bg-[#6b7280] text-white';
    return 'bg-pillgrey text-ink';
  };

  return (
    <div className="absolute right-0 top-full z-[70] mt-1 w-64 rounded-lg border border-line bg-white p-3 shadow-pop" onClick={(e) => e.stopPropagation()}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[13px] font-semibold">Calculator</span>
        <button type="button" aria-label="Close" onClick={onClose}><Icon name="x" size={14} /></button>
      </div>
      <input
        className="f-input mb-2 text-right text-[15px]"
        value={expr}
        onChange={(e) => setExpr(e.target.value.replace(/[^0-9.+\-*/]/g, ''))}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); press('='); } }}
      />
      <div className="grid grid-cols-4 gap-1.5">
        {CALC_KEYS.flat().map((key) => (
          <button
            key={key}
            type="button"
            className={'h-9 rounded text-[14px] font-semibold ' + keyClass(key)}
            onClick={() => press(key)}
          >
            {key === 'back' ? '⌫' : key}
          </button>
        ))}
      </div>
    </div>
  );
}

/* The rest of the billing block, in the order the Customers page shows it.
   City, Zip and Mobile are rendered separately above because they are not
   plain text boxes - City is the searchable picker and Zip auto-fills the
   address fields. */
/* State, Country, District, Taluk and Fax are deliberately NOT here: the
   counter does not type them, so the boxes only lengthened the dialog. Nor is
   Landline, for the same reason.

   They are hidden, not removed. Each one stays in CUSTOMER_DEFAULTS and is
   still submitted, and the Zip Code box still fills state / country /
   district / taluk from the pincode exactly as before - it just does it out
   of sight now. The full Customer master screen still shows all of them, so
   nothing is lost from a record created here. */
const BILLING_ROWS = [
  ['billingAddressLine1', 'Address Line 1'],
  ['billingAddressLine2', 'Address Line 2'],
  ['billingAlternateContactNumber', 'Alternate Contact'],
  ['billingEmail', 'Email'],
  ['billingEmail2', 'Email 2'],
  ['billingWebsiteUrl', 'Website URL'],
];

function CustomerForm({ values, setValues, typeOptions, onClose, onSave, saving }) {
  const set = (key, value) => setValues((current) => ({ ...current, [key]: value }));
  const text = (key, label, required) => (
    <label className="f-label" key={key}>{label}
      <input className="f-input" value={values[key] || ''} required={required}
        onChange={(e) => set(key, e.target.value)} />
    </label>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <form className="my-4 w-full max-w-4xl rounded bg-white p-4 shadow-xl" onSubmit={onSave}>
        <div className="mb-3 flex items-center justify-between border-b border-line pb-2">
          <h2 className="text-[15px] font-semibold">Add Customer</h2>
          <button type="button" aria-label="Close" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>

        <div className="grid grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-4">
          <label className="f-label">Type *<select className="f-input" value={values.typeId} onChange={(e) => set('typeId', e.target.value)} required>
            <option value="">Select...</option>{typeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select></label>
          <label className="f-label">Business Type *<select className="f-input" value={values.businessType} onChange={(e) => set('businessType', e.target.value)} required>
            <option>Registered</option><option>Un-Registered</option>
          </select></label>
          {text('gstNo', 'GST NO (ex: 22AAAAA0000A1Z5)')}
          {text('businessName', 'Business Name')}
          {/* Short Name is hidden, not removed - it stays in CUSTOMER_DEFAULTS
              and is still submitted, and the full Customer master screen still
              shows it. Same call as State / Country / District / Taluk / Fax
              below: the counter does not type it. */}
          <label className="f-label">Prefix<select className="f-input" value={values.prefix} onChange={(e) => {
            const next = e.target.value;
            /* one setValues, not set() twice: two calls in the same handler
               would each start from the same snapshot and the second would
               drop the first. */
            setValues((current) => ({
              ...current,
              prefix: next,
              gender: GENDER_FOR_PREFIX[next] || current.gender,
            }));
          }}>
            {/* <option>Mr.</option><option>Mrs.</option><option>Ms.</option><option>Dr.</option> */}
          
            <option>Mr.</option>
    <option>Mrs.</option>
    <option>Ms.</option>
    <option>Dr.</option>
    <option>Prof.</option>
    <option>CA</option>
    <option>Sr.</option>
    <option>Fr.</option>
    <option>M/s.</option>
          </select></label>
          {text('firstName', 'First Name *', true)}
          {text('middleName', 'Middle Name')}
          {text('lastName', 'Last Name')}
          <label className="f-label">DOB<input className="f-input" type="date" value={values.dob || ''} onChange={(e) => set('dob', e.target.value)} /></label>
          <label className="f-label">Gender<select className="f-input" value={values.gender || ''} onChange={(e) => set('gender', e.target.value)}>
            <option value="">--Select Gender--</option><option>Male</option><option>Female</option><option>Other</option>
          </select></label>
        </div>

        <div className="form-section-title mt-4 border-t border-line pt-3">Billing Details</div>
        <div className="grid grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-4">
          {/* City and Zip keep their own field types: City is the searchable
              picker, and Zip auto-fills city / state / country / district /
              taluk, which is why it is not just another text box. */}
          <div><Field f={{ k: 'billingCity', label: 'City', type: 'city' }} value={values.billingCity} onChange={set} /></div>
          <div><Field f={{ k: 'billingZipCode', label: 'Zip Code', type: 'zip', fill: { city: 'billingCity', state: 'billingState', country: 'billingCountry', district: 'billingDistrict', taluk: 'billingTaluk' } }} value={values.billingZipCode} onChange={set} /></div>
          {text('billingMobile', 'Mobile *', true)}
          {BILLING_ROWS.map(([key, label]) => text(key, label))}
        </div>

        {/* Same free-text notes field as the full Customer form, where it sits
            below Shipping Details. This dialog has no shipping block, so it
            goes at the end. */}
        <div className="form-section-title mt-4 border-t border-line pt-3">Additional Details</div>
        <label className="f-label block">
          <textarea className="f-input f-textarea" value={values.additionalDetails || ''}
            placeholder="Any additional details about this customer"
            onChange={(e) => set('additionalDetails', e.target.value)} />
        </label>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={saving}><Icon name="save" size={14} /> {saving ? 'Saving...' : 'Add Customer'}</button>
        </div>
      </form>
    </div>
  );
}

export default function PosTill() {
  const router = useRouter();
  const sp = useSearchParams();
  const initialBusiness = sp.get('business') || '';
  const initialLocation = sp.get('location') || '';
  const finYear = sp.get('finYear') || '2026-2027';
  const [business, setBusiness] = useState(initialBusiness);
  const [businesses, setBusinesses] = useState([]);
  const [now, setNow] = useState(null);
  const [saleDate, setSaleDate] = useState('');
  const [locations, setLocations] = useState([]);
  const [location, setLocation] = useState(initialLocation);
  const [counters, setCounters] = useState([]);
  const [counter, setCounter] = useState('');
  /* Staff Management -> Sales Persons, via /api/options?ref=salesperson.
     This was `useState([])` with no setter ever called, so both the header
     picker and the per-line Sales Person column were permanently empty. */
  const { options: salesPeople } = useOptions('salesperson');

  const [salesPerson, setSalesPerson] = useState('');
  const [payMode, setPayMode] = useState('Cash');
  const [customerOptions, setCustomerOptions] = useState([{ value: 'walkin', label: 'Walk-in Customer' }]);
  const [customer, setCustomer] = useState('walkin');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerTypes, setCustomerTypes] = useState([]);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [customerForm, setCustomerForm] = useState(CUSTOMER_DEFAULTS);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [items, setItems] = useState([]);
  const [itemSuggestions, setItemSuggestions] = useState([]);

  /* Line Wise Discount - the two footer boxes. Each applies ACROSS every line
     on the bill rather than storing a bill-level figure, which is what the
     "line wise" wording means: typing 10 here is the same as typing 10 into
     the Disc % column of every row.

     They are two ways of saying one thing, so setting either clears the other
     - leaving both filled would leave the operator no way to tell which one
     the lines actually took. */
  /* Shipping is entered through the "Add Shipping Charge" dialog and adds
     straight onto the net amount. Held as a committed value plus a draft so
     closing the dialog cancels rather than half-applies. */
  const [shipping, setShipping] = useState(0);
  const [shippingDraft, setShippingDraft] = useState('');
  const [showShipping, setShowShipping] = useState(false);
  const [lineDiscPct, setLineDiscPct] = useState('');
  const [lineDiscAmt, setLineDiscAmt] = useState('');

  function applyLineDiscountPct(value) {
    setLineDiscPct(value);
    setLineDiscAmt('');
    const pct = Math.max(0, Math.min(100, Number(value || 0) || 0));
    setItems((rows) => rows.map((row) => ({ ...row, discountPct: pct })));
  }

  /* An absolute amount is stored as the percentage that produces it, because
     every total on this screen is derived from discountPct (see `rows`). A
     line with no value to discount takes 0 rather than dividing by zero. */
  function applyLineDiscountAmt(value) {
    setLineDiscAmt(value);
    setLineDiscPct('');
    const amount = Math.max(0, Number(value || 0) || 0);
    setItems((rows) => rows.map((row) => {
      const gross = Number(row.rsp || 0) * Number(row.qty || 0);
      return { ...row, discountPct: gross > 0 ? Math.min(100, (amount / gross) * 100) : 0 };
    }));
  }
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [showMultiplePay, setShowMultiplePay] = useState(false);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [cashier, setCashier] = useState('');


  /* Held bills. Parked server-side (models/PosHold.js) rather than in
     localStorage so a hold survives a refresh or a crashed browser and can be
     picked up at another till on the same counter. */
  /* Exchange mode. Ticking it reveals the Invoice No box.

     ONLY THE FIRST line added afterwards is the return - that is the piece the
     customer is handing back against the invoice, so it is flagged isReturn,
     prints red and counts against the bill. Everything scanned after it is the
     replacement and behaves like a normal sale, so the net is
     "new goods minus returned goods" - the difference the customer actually
     pays. */
  const [showCalc, setShowCalc] = useState(false);
  const [isExchange, setIsExchange] = useState(false);
  /* The sale being exchanged against is CHOSEN, not typed: the operator scans
     the piece and picks which of its past sales it came from. */
  const [exchangePick, setExchangePick] = useState(null);   // { code, rows }
  const [exchangeBusy, setExchangeBusy] = useState(false);
  const scanRef = useRef(null);
  /* 'qty' | 'scan' | null - where the cursor should go once the row just
     added has been rendered. Cleared as soon as it has been honoured. */
  const [focusAfterAdd, setFocusAfterAdd] = useState(null);
  const [exchangeInvoiceId, setExchangeInvoiceId] = useState('');
  const [holds, setHolds] = useState([]);
  const [showHolds, setShowHolds] = useState(false);
  const [holding, setHolding] = useState(false);

  /* Scanner plumbing. intent SELL makes the server apply the till's rules -
     in stock, at THIS location, not already sold. */
  const beep = useScanSound();
  /* Runs after the new row is on screen - see setFocusAfterAdd above. Rows are
     newest-first, so the one just added is index 0. */
  useEffect(() => {
    if (!focusAfterAdd) return;
    if (focusAfterAdd === 'qty') document.querySelector('[data-qty-row="0"]')?.focus();
    else scanRef.current?.focus();
    setFocusAfterAdd(null);
  }, [focusAfterAdd, items]);

  /* Ticking Exchange puts the cursor in the scan box - the next thing the
     operator does is scan what is coming back. */
  useEffect(() => { if (isExchange) scanRef.current?.focus(); }, [isExchange]);

  /* A returned piece is SOLD, not in stock, so it cannot be scanned with the
     till's SELL rules - that is what produced "already sold". The return leg
     uses POS_RETURN, which requires the unit to be sold AND to have been sold
     on this very invoice. */
  const { lookup: lookupReturn } = useBarcodeLookup({
    business, location, intent: 'POS_RETURN', invoiceId: exchangeInvoiceId,
  });

  const { lookup: lookupBarcode, busy: scanBusy } = useBarcodeLookup({
    business, location, intent: 'SELL',
  });

  useEffect(() => {
    const current = new Date();
    setNow(current);
    setSaleDate(current.toISOString().slice(0, 10));
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  /* Things that do not depend on the chosen business. */
  useEffect(() => {
    const json = (url) => fetch(url).then((r) => r.json());
    json('/api/auth/me').then((d) => setCashier(d.user ? `${d.user.name} (Cashier)` : '')).catch(() => {});
    json('/api/options?ref=business').then((d) => {
      const options = d.options || [];
      setBusinesses(options);
      if (!business) setBusiness(options.find((option) => option.isDefault)?.value || options[0]?.value || '');
    }).catch(() => {});
  }, []);

  /* Everything scoped to the chosen business.

     Held until `business` is actually set. It used to fire on the first render
     too, when business is still '' - and /api/options applies no business
     filter for an empty value, so that call came back with EVERY location in
     the database. Whichever of the two responses landed last won, which is why
     the picker showed all locations until the page was reloaded.

     `off` discards a response whose business is no longer the selected one, so
     a slow reply for the previous branch cannot overwrite the current list. */
  useEffect(() => {
    if (!business) { setLocations([]); setCustomerTypes([]); return undefined; }

    let off = false;
    const json = (url) => fetch(url, { cache: 'no-store' }).then((r) => r.json());

    json(`/api/options?ref=companylocations&business=${business}`).then((d) => {
      if (off) return;
      const options = d.options || [];
      setLocations(options);
      if (!location && options[0]) setLocation(options[0].value);
    }).catch(() => {});

    json(`/api/options?ref=contact-type-customer&business=${business}`)
      .then((d) => { if (!off) setCustomerTypes(d.options || []); })
      .catch(() => {});

    return () => { off = true; };
  }, [business]);

  function changeBusiness(value) {
    setBusiness(value);
    setLocation('');
    setCustomer('walkin');
    setSelectedCustomer(null);
    setCustomerSearch('');
    setCustomerOptions([{ value: 'walkin', label: 'Walk-in Customer' }]);
  }

  useEffect(() => {
    fetch(`/api/pos-counter?perPage=200&business=${business}&location=${location}`).then((r) => r.json()).then((d) => setCounters((d.rows || [])
      /* the master offers Active / Inactive; retiring a counter should take
         it off the till, not just out of the master list */
      .filter((r) => String(r.status || 'Active').toLowerCase() !== 'inactive')
      .map((r) => ({ value: String(r._id), label: r.counterName })))).catch(() => {});
  }, [business, location]);

  useEffect(() => {
    if (!customerSearch.trim()) {
      if (customer && customer !== 'walkin') return undefined;
      setCustomerOptions([{ value: 'walkin', label: 'Walk-in Customer' }]);
      return undefined;
    }
    const timer = setTimeout(() => fetch(`/api/customer?perPage=30&business=${business}&search=${encodeURIComponent(customerSearch)}`).then((r) => r.json()).then((d) => {
      const rows = d.rows || [];
      setCustomerOptions(rows.length
        ? rows.map((r) => ({ value: String(r._id), label: customerLabel(r), customer: r }))
        : [{ value: 'add-customer', label: 'Add Customer', addCustomer: true }]);
    }).catch(() => {}), 250);
    return () => clearTimeout(timer);
  }, [business, customerSearch, customer]);

  useEffect(() => {
    const query = code.trim();
    if (!query || !business || !location) { setItemSuggestions([]); return undefined; }
    const timer = setTimeout(() => fetch(`/api/inventory-barcode-list?perPage=10&business=${business}&location=${location}&search=${encodeURIComponent(query)}`)
      .then((r) => r.json()).then((d) => setItemSuggestions(d.rows || [])).catch(() => setItemSuggestions([])), 250);
    return () => clearTimeout(timer);
  }, [business, location, code]);

  function updateItem(index, key, value) {
    setItems((rows) => rows.map((row, i) => i === index ? { ...row, [key]: value } : row));
  }

  /* ==================================================== scanning ========

     A scan now goes to /api/barcode/scan with intent SELL, so the SERVER
     decides whether the unit may be sold: it refuses one that is already
     sold, one that is in transit on a transfer, and one held at another
     location, and says which. The till previously searched the barcode LIST
     and took the first row, which reported none of that - a barcode already
     billed at the next counter came back looking perfectly sellable.

     Falls back to the item master only when the code is not a barcode at
     all, which is how a loose item or a search by name still reaches the
     bill.
     ==================================================================== */
  const scannedCodes = useMemo(
    () => items.map((row) => row.barcodeNo).filter(Boolean),
    [items]
  );

  const addScanned = useCallback(async (raw) => {
    const query = String(raw || '').trim();
    if (!query) return;

    /* An exchange line has to be traceable to the sale it is coming back
       from, so the invoice number is collected before anything is scanned. */


    if (!business || !location) {
      setMsg('Choose the business and location before scanning.');
      beep('err');
      return;
    }

    /* The FIRST line of an exchange is the piece coming back, so it is looked
       up as a return (sold, on this invoice). Everything after it is the
       replacement and goes through the normal SELL rules. */
    const isReturnLeg = isExchange && !items.some((r) => r.isReturn);

    /* Exchange: the piece decides the invoice, not the other way round. Its
       past sales are listed and the operator picks one; the actual return scan
       runs from that choice in takeExchangePick(). */
    if (isReturnLeg) {
      setExchangeBusy(true);
      try {
        const qs = new URLSearchParams({ code: query, business, location: location || '' });
        const r = await fetch('/api/sell-pos/recent?' + qs, { cache: 'no-store' });
        const d = await r.json();
        const rows = d.rows || [];
        if (!rows.length) {
          setMsg(`No past sale found for "${query}".`);
          beep('err');
          return;
        }
        setExchangePick({ code: query, rows });
        setCode('');
      } catch {
        setMsg('Could not look up past sales for that item.');
        beep('err');
      } finally {
        setExchangeBusy(false);
      }
      return;
    }

    const res = await lookupBarcode(query, scannedCodes);

    if (res.ok) {
      addBarcodeUnit(res.unit);
      return;
    }

    /* A code the barcode engine does not recognise may still be an item
       code or a product name - fall through to the item master. Anything
       else is a real refusal and must be shown, not swallowed. */
    if (res.code !== 'BARCODE_NOT_FOUND') {
      setMsg(res.error);
      
      beep('err');
      return;
    }

    try {
      const response = await fetch(`/api/item?perPage=10&business=${business}&search=${encodeURIComponent(query)}`);
      const data = await response.json();
      const hit = (data.rows || [])[0];
      if (!hit) { setMsg(`No item or barcode found for "${query}"`); beep('err'); return; }

      const detail = await fetch(`/api/item/${hit._id}/detail`).then((r) => r.json()).catch(() => ({}));
      const item = detail.item || {};
      const product = {
        itemId: hit._id, barcodeNo: '', barcode: '',
        code: item.itemCode || hit.itemCode || hit.name,
        itemCode: item.itemCode || hit.itemCode || '',
        name: item.name || hit.name,
        description: item.description || hit.description || item.name || hit.name,
        hsn: item.hsnCode || '', gst: Number(item.slabs?.[0]?.igst || 0), qty: 1,
        rsp: Number(item.rsp ?? hit.rsp ?? 0), discountPct: 0, image: hit.image || '',
        uom: item.uom || '', salesPerson: salesPerson || '',
      };
      setItems((rows) => [{ ...product, isReturn: isExchange && !rows.some((r) => r.isReturn) }, ...rows]);
      setSelectedProduct(product);
      setCode(''); setMsg('');
      beep('ok');
    } catch {
      setMsg('Item lookup failed');
      beep('err');
    }
  }, [business, location, lookupBarcode, scannedCodes, salesPerson, beep, isExchange, items]);

  /* The physical scanner: listens on the window, so it works with focus
     anywhere on the till - which is the requirement that the operator should
     not have to click into the search box first. */
  useScanner(addScanned, { enabled: Boolean(business && location) });

  /* Kept as the name the search box and the suggestion list already call. */
  function scan() { return addScanned(code); }

  /* The operator has chosen which sale the piece is coming back from. The scan
     runs now, against THAT invoice, so the engine still refuses a piece that
     was not sold on it. The line inherits the sales person off the chosen sale
     - a return belongs to whoever made it, not to whoever is at the till. */
  async function takeExchangePick(row) {
    setExchangeBusy(true);
    try {
      setExchangeInvoiceId(row._id);
      const res = await lookupReturn(row.barcodeNo || exchangePick?.code || '', []);
      if (!res.ok) { setMsg(res.error); beep('err'); return; }
      addBarcodeUnit(res.unit, row.salesPerson ? { salesPerson: row.salesPerson } : {});
      setExchangePick(null);
      beep('ok');
    } finally {
      setExchangeBusy(false);
    }
  }

  /* Adds a unit the server has just validated. Newest first, so the piece just
     scanned is the top row and the operator does not have to look down a long
     bill to confirm it landed.

     Exchange is unaffected: isReturn is decided from what is already on the
     bill, not from position, so the first piece scanned is still the return
     however the rows are ordered - it just sits at the BOTTOM once other
     lines are added on top of it. */
  /* `overrides` lets the exchange leg carry values belonging to the ORIGINAL
     sale rather than to current till state - the sales person being the one
     that matters. */
  function addBarcodeUnit(unit, overrides = {}) {
    const product = {
      itemId: unit._id,
      barcodeNo: unit.barcodeNo,
      barcode: unit.barcodeNo,
      code: unit.itemCode || unit.itemName,
      itemCode: unit.itemCode || '',
      name: unit.itemName || unit.description || unit.itemCode,
      itemName: unit.itemName || unit.description || unit.itemCode,
      description: unit.description || unit.itemName || '',
      hsn: unit.hsn || '',
      gst: Number(unit.gst || 0),
      uom: unit.uom || '',
      uomType: unit.uomType || '',
      batchType: unit.batchType || '',
      /* Always starts at 1 - the customer is usually buying one of what was
         scanned, and a batch barcode holding 16 metres should not bill all 16
         because it was passed over the scanner.

         The unit's full quantity is still carried, as `closing` below: it is
         the ceiling the stepper enforces, so 1 to 16 is reachable but 17 is
         not. */
      qty: 1,
      /* This barcode's own stock quantity, straight off the barcodeLabel row
         the server just validated - what prints as "Closing: n" and caps the
         QTY stepper. Kept separate from `qty` above, which is the quantity
         being SOLD and is edited by the operator. */
      closing: Number(unit.qty) || 0,
      rsp: Number(unit.offerPrice || unit.rsp || 0),
      discountPct: 0,
      image: unit.image || '',
      grcNo: unit.grcNo || '',
      salesPerson: salesPerson || '',
      ...overrides,
    };
    setItems((rows) => [{ ...product, isReturn: isExchange && !rows.some((r) => r.isReturn) }, ...rows]);
    setSelectedProduct(product);
    setItemSuggestions([]);
    setCode('');
    setMsg('');

    /* Where the cursor goes next depends on what was scanned.

       BATCH  - one barcode stands for a whole lot, so the quantity is still
                unknown: the cursor lands in that row's Qty box, which clears
                itself ready to type.
       UNIQUE - one barcode is one piece, quantity already known: the cursor
                goes straight back to the scan box for the next item.

       Requested through state rather than moved here directly. The row does
       not exist in the DOM until React has committed this update, and a
       requestAnimationFrame can fire before that commit - which is why the
       first attempt silently did nothing. The effect below runs after the
       commit, when the input is really there. */
    setFocusAfterAdd(
      String(unit.batchType || '').trim().toLowerCase() === 'batch' ? 'qty' : 'scan'
    );
    beep('ok');
  }

  /* The suggestion list hands over a row from the barcode list, which is a
     display shape rather than a validated unit - so it goes back through the
     same scan path instead of being trusted. */
  function addBarcodeItem(barcodeHit) {
    return addScanned(barcodeHit.barcodeNo || barcodeHit.itemCode);
  }

  const loadHolds = useCallback(async () => {
    if (!business || !location) { setHolds([]); return; }
    try {
      const qs = new URLSearchParams({ business, location, finYear });
      const r = await fetch('/api/pos-hold?' + qs, { cache: 'no-store' });
      const d = await r.json();
      setHolds(d.rows || []);
    } catch { /* the badge is not worth an error banner */ }
  }, [business, location, finYear]);

  useEffect(() => { loadHolds(); }, [loadHolds]);

  /* Park the current bill and clear the screen for the next customer. */
  async function holdBill() {
    if (!items.length) { setMsg('Add an item before holding the bill.'); beep('err'); return; }
    setHolding(true);
    try {
      const record = selectedCustomer || customerOptions.find((o) => o.value === customer)?.customer;
      const r = await fetch('/api/pos-hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business, location, finYear,
          data: {
            date: saleDate,
            customerId: customer === 'walkin' ? null : customer,
            customerName: customerOptions.find((o) => o.value === customer)?.label || '',
            customerContact: record?.billingMobile || '',
            customerSnapshot: customer === 'walkin' ? null : record || null,
            counterId: counter || null,
            billingType: payMode,
            exempted: 'NO',
            salesPerson,
            items,
            shipping: Number(shipping || 0),
            totalAmount: netAmount,
            totalQty: qty,
          },
        }),
      });
      const d = await r.json();
      if (!r.ok) { setMsg(d.error || 'Could not hold this bill'); beep('err'); return; }

      clearTill();
      await loadHolds();
      setMsg('Bill held at ' + d.holdNo + '. Resume it from Held.');
      beep('ok');
    } catch {
      setMsg('Could not hold this bill');
      beep('err');
    } finally {
      setHolding(false);
    }
  }

  /* Everything the Hold and Clear Screen paths both have to reset. Kept in one
     place so a new till field cannot be added to one and forgotten in the
     other - which is how a "cleared" screen keeps the last customer. */
  function clearTill() {
    setItems([]);
    setSelectedProduct(null);
    setCustomer('walkin');
    setSelectedCustomer(null);
    setCounter('');
    setPayMode('Cash');
    setSalesPerson('');
    setShipping(0);
    setShippingDraft('');
    setLineDiscPct('');
    setLineDiscAmt('');
  }

  /* Pull a parked bill back onto the screen. The hold is deleted as it is
     resumed, so the same one cannot be opened at two counters and billed
     twice. */
  async function resumeHold(id) {
    try {
      const r = await fetch('/api/pos-hold/' + id, { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok || !d.doc) { setMsg('That held bill is no longer available'); beep('err'); return; }

      const h = d.doc;
      setItems(Array.isArray(h.items) ? h.items : []);
      setCustomer(h.customerId ? String(h.customerId) : 'walkin');
      setSelectedCustomer(h.customerSnapshot || null);
      setCounter(h.counterId ? String(h.counterId) : '');
      setPayMode(h.billingType || 'Cash');
      setSalesPerson(h.salesPerson || '');
      setShipping(Number(h.shipping || 0));
      if (h.date) setSaleDate(String(h.date).slice(0, 10));

      await fetch('/api/pos-hold/' + id, { method: 'DELETE' });
      setShowHolds(false);
      await loadHolds();
      setMsg('');
      beep('ok');
    } catch {
      setMsg('Could not resume that bill');
      beep('err');
    }
  }

  async function discardHold(id) {
    if (!window.confirm('Discard this held bill?')) return;
    await fetch('/api/pos-hold/' + id, { method: 'DELETE' }).catch(() => {});
    await loadHolds();
  }

  async function saveCustomer(event) {
    event.preventDefault();
    if (!customerForm.typeId) { setMsg('Create a customer type in Customer Type master first.'); return; }
    setSavingCustomer(true);
    try {
      const response = await fetch('/api/customer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ business, quick: true, data: customerForm }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.errors ? Object.values(data.errors).join(', ') : data.error || 'Unable to save customer');
      const savedCustomer = { ...customerForm, contactId: data.customer?.contactId || '', _id: data.id };
      const option = { value: data.id, label: customerLabel(savedCustomer), customer: savedCustomer };
      setCustomerOptions((rows) => [option, ...rows.filter((row) => row.value !== 'walkin' && row.value !== data.id)]); setCustomer(data.id); setSelectedCustomer(savedCustomer); setCustomerSearch(''); setShowCustomerForm(false); setCustomerForm({ ...CUSTOMER_DEFAULTS, typeId: customerForm.typeId }); setMsg('');
    } catch (error) { setMsg(error.message); } finally { setSavingCustomer(false); }
  }

  /* Opens a blank Add Customer form. Reached two ways: the "add" row the
     dropdown offers when a searched phone number matches nobody, and the +
     button next to the picker - the deployed till has both. Any digits already
     typed into the search box are carried into Mobile so they are not retyped. */
  function openCustomerForm() {
    setCustomer('walkin');
    setCustomerForm((current) => ({
      ...CUSTOMER_DEFAULTS,
      typeId: retailFirst(customerTypes) || current.typeId || '',
      billingMobile: customerSearch.trim(),
    }));
    setShowCustomerForm(true);
  }

  function selectCustomer(value) {
    const option = customerOptions.find((row) => row.value === value);
    if (option?.addCustomer) { openCustomerForm(); return; }
    if (!value) {
      setCustomer('walkin');
      setSelectedCustomer(null);
      setCustomerSearch('');
      return;
    }
    setCustomer(value);
    setSelectedCustomer(option?.customer || null);
    setCustomerSearch('');
  }

  /* A line added in exchange mode is stock coming back, so its money and its
     quantity both carry a minus. The row keeps a POSITIVE qty on screen - the
     cashier counts pieces, not signed pieces - and the sign is applied here,
     once, where every total is derived. */
  const rows = items.map((row) => {
    const sign = row.isReturn ? -1 : 1;
    const gross = Number(row.rsp || 0) * Number(row.qty || 0);
    return {
      ...row,
      discountAmount: sign * gross * Number(row.discountPct || 0) / 100,
      lineTotal: sign * gross * (1 - Number(row.discountPct || 0) / 100),
    };
  });
  const qty = rows.reduce((sum, row) => sum + (row.isReturn ? -1 : 1) * Number(row.qty || 0), 0);
  
  // sagar


  // const billValue = rows.reduce((sum, row) => sum + row.lineTotal, 0);
  // const tax = exempted ? 0 : rows.reduce((sum, row) => sum + row.lineTotal * Number(row.gst || 0) / 100, 0);
  // /* Net amount = goods + tax + shipping. Every place that used to add
  //    `billValue + tax` now reads this, so the footer, the Total Payable bar,
  //    the payment dialog and the figure POSTed to the server cannot drift
  //    apart once a shipping charge is on the bill. */
  // const netAmount = billValue + tax + Number(shipping || 0);


















///////new code without tax add on top of bill value
  const billValue = rows.reduce((sum, row) => sum + row.lineTotal, 0);
  /* RSP is GST-inclusive, as on the deployed till: the customer pays the
     ticket price and the tax is backed OUT of it for the record, never added
     on top. 295 at 5% bills 295, of which 14.05 is tax and 280.95 taxable. */
  const tax = rows.reduce((sum, row) => {
    const rate = Number(row.gst || 0);
    return sum + (row.lineTotal - row.lineTotal / (1 + rate / 100));
  }, 0);
  const taxableAmount = billValue - tax;
  /* Net amount = goods + shipping. Tax is inside `billValue` already. */
  const netAmount = billValue + Number(shipping || 0);




  const timeStr = now ? now.toTimeString().slice(0, 5) : '';

  async function submitPayment(paymentData) {
    if (!items.length || netAmount <= 0) { setMsg('Add an item before submitting payment.'); return; }
    try {
      const paid = paymentData.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const customerRecord = selectedCustomer || customerOptions.find((option) => option.value === customer)?.customer;
      const response = await fetch('/api/sell-pos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ business, location, finYear, data: { date: saleDate, finYear, customerId: customer === 'walkin' ? null : customer, customerContact: customerRecord?.billingMobile || '', customerSnapshot: customer === 'walkin' ? null : customerRecord || null, counterId: counter || null, billingType: payMode, exempted: 'NO', items, payments: paymentData.payments, sellNote: paymentData.sellNote, staffNote: paymentData.staffNote, shipping: Number(shipping || 0), totalAmount: netAmount, paid } }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save POS invoice');
      setShowMultiplePay(false);
      router.push('/admin/transaction/sell/pos');
    } catch (error) { setMsg(error.message); }
  }

  return (
    <div className="pos-till fixed inset-0 z-50 flex flex-col overflow-auto bg-white">
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13.5px]"><span className="text-inkmuted">Business:</span><select className="f-input w-64" value={business} onChange={(e) => changeBusiness(e.target.value)}><option value="">Select business</option>{businesses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><span className="text-inkmuted">Location:</span><select className="f-input w-64" value={location} onChange={(e) => setLocation(e.target.value)} disabled={!business}><option value="">Select location</option>{locations.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><span className="flex items-center gap-1.5 text-cell"><Icon name="refresh" size={15} /> {timeStr}</span><span className="flex-1" />{selectedProduct && <div className="flex items-center gap-3 border-l border-line pl-3"><span className="max-w-40 truncate text-[12px] font-semibold">{selectedProduct.barcode || selectedProduct.code}</span><ProductImage src={selectedProduct.image} alt={selectedProduct.name} size={72} onOpen={() => setPreviewImage({ src: selectedProduct.image, alt: selectedProduct.name })} /></div>}<div className="relative"><button type="button" aria-label="Calculator" title="Calculator" className={'flex h-8 w-9 items-center justify-center rounded ' + (showCalc ? 'bg-[#dbe6f7] text-brand' : 'bg-brand text-white')} onClick={() => setShowCalc((v) => !v)}><Icon name="calculator" size={15} /></button>{showCalc && <Calculator onClose={() => setShowCalc(false)} />}</div>{/* The four buttons that sat after the Calculator - refresh, register,
          ledger and a chevron - are gone. They carried no onClick at all, so
          every one of them was a dead control: it looked pressable and did
          nothing. The Calculator above is the only one of the five that was
          ever wired, and it stays. */}</div>
      <div className="grid grid-cols-1 gap-2 px-4 md:grid-cols-5"><input className="f-input" type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} /><MultiSelect mode="single" options={salesPeople} value={salesPerson} placeholder="Sales Person" onChange={setSalesPerson} /><div className="flex items-center gap-2 md:col-span-2"><div className="min-w-0 flex-1"><MultiSelect mode="single" options={customerOptions} value={customer} placeholder="Walk-in Customer / phone number" onSearch={setCustomerSearch} onChange={selectCustomer} /></div></div><input className="f-input" value={cashier} readOnly /></div>
      <div className="mt-2 grid grid-cols-1 items-center gap-2 px-4 md:grid-cols-6"><select className="f-input" value={payMode} onChange={(e) => setPayMode(e.target.value)}>{PAYMENT_MODES.map((mode) => <option key={mode}>{mode}</option>)}</select><div className="relative md:col-span-2"><input ref={scanRef} data-scan-target="" className="f-input" placeholder="Scan barcode, or type a product name / SKU" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (['Enter', 'F9', 'Tab'].includes(e.key)) { e.preventDefault(); scan(); } }} />{scanBusy && <span className="absolute right-2 top-2 text-[11px] text-inkmuted">checking...</span>}{itemSuggestions.length > 0 && <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-auto rounded border border-line bg-white shadow-lg">{itemSuggestions.map((item) => <button type="button" key={item._id} className="flex w-full items-center gap-2 border-b border-line px-3 py-2 text-left text-[12px] hover:bg-[#f4f7fb]" onClick={() => addBarcodeItem(item)}><ProductImage src={item.productImageUrl} alt={item.itemId || item.itemCode} size={44} /><span className="min-w-0 flex-1"><b className="block truncate">{item.itemId || item.description || item.itemCode}</b><span className="text-inkmuted">{item.barcodeNo} · RSP {money(item.rsp)}</span></span></button>)}</div>}</div><select className="f-input" value={counter} onChange={(e) => setCounter(e.target.value)}><option value="">Select Cash Counter</option>{counters.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><div className="flex items-center gap-3 whitespace-nowrap md:col-span-2"><button type="button" className="btn bg-danger px-2 py-1 text-white" title="Process a customer return against a previous bill" onClick={() => router.push(`/admin/transaction/sell/pos-return/add?business=${business}&location=${location}&finYear=${finYear}`)}><Icon name="undo" size={13} /> Return / Refund</button><label className="flex items-center gap-1" title="Take goods back against a previous bill"><input type="checkbox" checked={isExchange} onChange={(e) => { setIsExchange(e.target.checked); setExchangePick(null); setExchangeInvoiceId(''); }} /> Exchange</label></div></div>
      {/* The customer summary strip that used to sit here - name, contact id,
          phone, Bills / Spent / Last, and an expandable purchase history - has
          been taken out at the counter's request. Picking a customer now only
          fills the picker above.

          CustomerProfilePanel itself is untouched and still used elsewhere;
          removing the render also stops the /api/customer/<id>/history call it
          made on every customer change, which is why the row used to sit on
          "Loading history..." for a moment. */}
      {previewImage && <div className={'fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-6' + (previewImage.hover ? ' pointer-events-none' : '')} onClick={() => setPreviewImage(null)}><div className="relative max-h-[70vh] max-w-2xl rounded bg-white p-2 shadow-2xl" onClick={(e) => e.stopPropagation()}>{!previewImage.hover && <button type="button" aria-label="Close image preview" className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white" onClick={() => setPreviewImage(null)}><Icon name="x" size={16} /></button>}<img src={previewImage.src} alt={previewImage.alt} className="max-h-[65vh] max-w-[60vw] object-contain" /></div></div>}
      {msg && <div className="mx-4 mt-2 flash flash-err">{msg}</div>}
      <div className="mt-3 flex-1 overflow-x-auto px-4"><table className="dt"><thead><tr>{['#', 'Barcode No', 'Stock Issue', 'Item Code', 'Print Description', 'HSN', 'GST%', 'Qty', 'RSP Price', 'Disc %', 'Disc Amt', 'Line Total', 'Sales Person', 'Image', ''].map((heading) => <th key={heading} className={'!whitespace-normal !leading-tight' + (heading === '#' ? ' !w-9 !px-1.5 !text-left' : '')}>{heading}</th>)}</tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan="15" className="dt-empty">No Items Added</td></tr> : rows.map((row, index) => <tr key={`${row.itemId}-${index}`} className="cursor-pointer !bg-[#FFF3CD]" onClick={() => setSelectedProduct(row)}><td className={'!w-9 !px-1.5 !text-left'}>{index + 1}</td><td className={row.isReturn ? '!text-danger font-semibold' : undefined}>{row.barcode || '-'}</td><td><input type="checkbox" checked={!!row.stockIssue} onClick={(e) => e.stopPropagation()} onChange={(e) => updateItem(index, 'stockIssue', e.target.checked)} /></td><td>{row.code}</td><td>{row.description || row.name}</td><td>{row.hsn}</td><td>{money(row.gst)}</td><td>{(() => { const closing = row.closing; const known = closing !== undefined && closing !== null; const over = known && Number(row.qty || 0) > Number(closing); return (<div className="flex flex-col items-center gap-0.5" onClick={(e) => e.stopPropagation()}><div className="flex items-center justify-center gap-1"><button type="button" aria-label="Decrease quantity" className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded border border-line bg-pillgrey text-[15px] font-bold leading-none text-ink hover:bg-linestrong disabled:opacity-40" disabled={Number(row.qty || 0) <= 1} onClick={() => updateItem(index, 'qty', Math.max(1, Number(row.qty || 1) - 1))}>-</button><input data-qty-row={index} className={'f-input w-14 text-center' + (over ? ' border-danger text-danger' : '')} type="number" min="1" max={known ? closing : undefined} value={row.qty} onWheel={(e) => e.currentTarget.blur()} onFocus={() => updateItem(index, 'qty', '')} /* min="1" only limits the spinner - a negative can still be typed or pasted, and it flips the whole bill: -222 x 600 billed -133,200.00. Anything below 1 becomes 1. '' is kept so the box can be cleared and retyped, which is what onFocus above relies on. */ onChange={(e) => { const v = e.target.value; updateItem(index, 'qty', v === '' ? '' : (Number(v) < 1 ? 1 : v)); }} /><button type="button" aria-label="Increase quantity" className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded border border-line bg-pillgrey text-[15px] font-bold leading-none text-ink hover:bg-linestrong disabled:opacity-40" disabled={known && Number(row.qty || 0) >= Number(closing)} onClick={() => updateItem(index, 'qty', Number(row.qty || 0) + 1)}>+</button></div>{known && <span className={'text-[11px] ' + (over ? 'font-semibold text-danger' : 'text-inkmuted')}>{over ? 'Only ' + closing + ' in stock' : 'Closing: ' + closing}</span>}</div>); })()}</td><td><input className="f-input w-24" type="number" min="0" value={row.rsp} onWheel={(e) => e.currentTarget.blur()} onChange={(e) => updateItem(index, 'rsp', e.target.value)} /></td><td><input className="f-input w-20" type="number" min="0" max="100" value={row.discountPct} onWheel={(e) => e.currentTarget.blur()} /* a discount over 100% turns the line NEGATIVE - the bill then pays the customer. Clamped here as well as with max= because max only stops the spinner, not typing or pasting. */ onChange={(e) => { const v = e.target.value; updateItem(index, 'discountPct', v === '' ? '' : Math.min(100, Math.max(0, Number(v)))); }} /></td><td>{money(row.discountAmount)}</td><td className={row.isReturn ? '!text-danger font-semibold' : undefined}>{money(row.lineTotal)}</td><td><select className="f-input min-w-35" value={row.salesPerson || ''} onChange={(e) => updateItem(index, 'salesPerson', e.target.value)}><option value="">Select...</option>{salesPeople.map((person) => <option key={person.value} value={person.value}>{person.label}</option>)}</select></td><td onMouseEnter={() => row.image && setPreviewImage({ src: row.image, alt: row.name, hover: true })} onMouseLeave={() => setPreviewImage((p) => (p && p.hover ? null : p))}><ProductImage src={row.image} alt={row.name} size={56} onOpen={() => { setSelectedProduct(row); setPreviewImage({ src: row.image, alt: row.name, hover: false }); }} /></td><td><button type="button" className="act-btn bg-danger" onClick={(e) => { e.stopPropagation(); setItems((current) => current.filter((_, itemIndex) => itemIndex !== index)); if (selectedProduct?.itemId === row.itemId) setSelectedProduct(null); }}><Icon name="x" size={12} /></button></td></tr>)}</tbody></table></div>
      
      <div className="border-t border-line px-4 pt-2"><div className="grid grid-cols-2 gap-2 text-[13px] md:grid-cols-6"><div><div className="text-cell">Qty</div><div>{qty}</div></div><div><div className="text-cell">Bill Value</div><div>{money(rows.reduce((sum, row) => sum + (row.isReturn ? -1 : 1) * Number(row.rsp || 0) * Number(row.qty || 0), 0))}</div></div><div><div className="text-cell">Total Discount</div><div>{money(rows.reduce((sum, row) => sum + row.discountAmount, 0))}</div></div><div><div className="text-cell">Sub Total</div><div>{money(billValue)}</div></div>
      
      
      {/* sagar */}
      {/* <div><div className="text-cell">Tax</div><div>{money(tax)}</div></div> */}
      
      {/* new code without tax add on top of bill value */}
      <div><div className="text-cell">Taxable Amt</div><div>{money(taxableAmount)}</div><div className="text-[11px] text-danger">Tax: {money(tax)} (inclusive)</div></div>
      
      <div><div className="text-cell">Net Amount</div><div className="font-bold text-danger">{money(netAmount)}</div></div></div><div className="mt-2 grid grid-cols-2 gap-2 text-[13px] md:grid-cols-6"><div><div className="text-cell">Line Wise Discount %</div><input className="f-input" type="number" min="0" max="100" step="0.01" value={lineDiscPct} onWheel={(e) => e.currentTarget.blur()} onChange={(e) => applyLineDiscountPct(e.target.value)} /></div><div><div className="text-cell">Line Wise Discount Amt</div><input className="f-input" type="number" min="0" step="0.01" value={lineDiscAmt} onWheel={(e) => e.currentTarget.blur()} onChange={(e) => applyLineDiscountAmt(e.target.value)} /></div><div className="flex items-center gap-2"><span className="text-cell">Shipping</span><button type="button" className="font-semibold text-brand underline" onClick={() => { setShippingDraft(String(shipping || 0)); setShowShipping(true); }}>( + ) {money(shipping)}</button></div></div></div>
      <div className="mt-2 flex flex-wrap items-center gap-3 bg-[#eef1f7] px-4 py-3"><button type="button" className="btn bg-[#17a2b8] text-white disabled:opacity-50" disabled={holding} onClick={holdBill}><Icon name="register" size={14} /> {holding ? 'Holding...' : 'Hold'}</button><button type="button" className="btn bg-[#6b7280] text-white disabled:opacity-50" disabled={!holds.length} onClick={() => setShowHolds(true)}><Icon name="register" size={14} /> Held ({holds.length})</button><button type="button" className="btn bg-[#2563a9] text-white" onClick={() => setShowMultiplePay(true)}><Icon name="register" size={14} /> Multiple Pay</button><span className="text-[15px] font-bold">Total Payable: <span className="text-okgreen">{money(netAmount)}</span></span><button type="button" className="btn bg-[#f2a19b] text-white" onClick={clearTill}><Icon name="x" size={14} /> Clear Screen</button><span className="flex-1" /><button type="button" className="btn btn-primary" onClick={() => router.push('/admin/transaction/sell/pos')}>Recent Transactions</button></div>
      {showMultiplePay && <MultiplePayDialog totalItems={qty} totalPayable={netAmount} onClose={() => setShowMultiplePay(false)} onSubmit={submitPayment} />}

      {/* Add Shipping Charge. Save commits the draft onto the bill; closing or
          clicking the backdrop leaves the previous charge untouched. */}
      {/* Which past sale is this piece coming back from? Opened by scanning in
          exchange mode; picking a row runs the return scan against that sale. */}
      {exchangePick && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/40 p-4 pt-20" onClick={() => setExchangePick(null)}>
          <div className="w-full max-w-3xl rounded-lg bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-[15px] font-semibold">Recent sales of {exchangePick.code}</h2>
              <button type="button" aria-label="Close" className="flex h-7 w-7 items-center justify-center rounded-full bg-danger text-white" onClick={() => setExchangePick(null)}><Icon name="x" size={14} /></button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-4">
              <table className="dt">
                <thead><tr>{['', 'Invoice No', 'Date', 'Customer', 'Item', 'Qty', 'Amount'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {exchangePick.rows.map((row) => (
                    <tr key={row._id}>
                      <td>
                        <button type="button" className="btn btn-primary px-2 py-1 disabled:opacity-50" disabled={exchangeBusy} onClick={() => takeExchangePick(row)}>
                          {exchangeBusy ? 'Working...' : 'Select'}
                        </button>
                      </td>
                      <td className="font-semibold">{row.invoiceNo || '-'}</td>
                      <td>{row.date ? new Date(row.date).toLocaleDateString('en-GB') : '-'}</td>
                      <td>{row.customerName}</td>
                      <td>{row.itemName || row.itemCode || '-'}</td>
                      <td>{row.qty}</td>
                      <td>{money(row.netAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showHolds && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/40 p-4 pt-20" onClick={() => setShowHolds(false)}>
          <div className="w-full max-w-3xl rounded-lg bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-[15px] font-semibold">Held Bills</h2>
              <button type="button" aria-label="Close" className="flex h-7 w-7 items-center justify-center rounded-full bg-danger text-white" onClick={() => setShowHolds(false)}><Icon name="x" size={14} /></button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-4">
              <table className="dt">
                <thead><tr>{['Held At', 'Customer', 'Items', 'Amount', 'Held By', ''].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {holds.length === 0
                    ? <tr><td colSpan="6" className="dt-empty">No held bills</td></tr>
                    : holds.map((h) => (
                      <tr key={h._id}>
                        <td>{h.holdNo}</td>
                        <td>{h.customerName || 'Walk-in Customer'}</td>
                        <td>{h.totalQty}</td>
                        <td>{money(h.totalAmount)}</td>
                        <td>{h.createdBy}</td>
                        <td>
                          <button type="button" className="btn btn-primary px-2 py-1" onClick={() => resumeHold(h._id)}>Resume</button>
                          <button type="button" className="act-btn ml-2 bg-danger" title="Discard" onClick={() => discardHold(h._id)}><Icon name="x" size={12} /></button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showShipping && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/40 p-4 pt-24" onClick={() => setShowShipping(false)}>
          <div className="w-full max-w-2xl rounded-lg bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-[15px] font-semibold">Add Shipping Charge</h2>
              <button type="button" aria-label="Close" className="flex h-7 w-7 items-center justify-center rounded-full bg-danger text-white" onClick={() => setShowShipping(false)}><Icon name="x" size={14} /></button>
            </div>
            <div className="flex items-center gap-2 p-4">
              <input
                className="f-input flex-1"
                type="number"
                min="0"
                step="0.01"
                autoFocus
                value={shippingDraft}
                onWheel={(e) => e.currentTarget.blur()}
                onChange={(e) => setShippingDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setShipping(Math.max(0, Number(shippingDraft || 0) || 0)); setShowShipping(false); } }}
              />
              <button type="button" className="btn btn-primary" onClick={() => { setShipping(Math.max(0, Number(shippingDraft || 0) || 0)); setShowShipping(false); }}>Save</button>
            </div>
          </div>
        </div>
      )}
      {showCustomerForm && <CustomerForm values={customerForm} setValues={setCustomerForm} typeOptions={customerTypes} onClose={() => setShowCustomerForm(false)} onSave={saveCustomer} saving={savingCustomer} />}
    </div>
  );
}
