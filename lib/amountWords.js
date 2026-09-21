/* Amount in words, Indian scale.

   Lifted out of components/PurchaseInvoicePrintView.jsx unchanged, so that the
   Purchase Invoice and the Goods Return Note spell a figure the same way. It
   was already written once there; the alternative to moving it was a second
   copy that could drift, which is the thing to avoid with a number that is
   read off a document and signed for.

   CRORE / LAKH / THOUSAND, not million / billion - the documents these print
   on are Indian tax documents. */

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight',
  'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy',
  'Eighty', 'Ninety'];

const two = (n) => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : ''));

const three = (n) => {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? ONES[h] + ' Hundred' : '', r ? (h ? 'and ' : '') + two(r) : '']
    .filter(Boolean).join(' ');
};

export function words(value) {
  let n = Math.floor(Math.abs(num(value)));
  if (!n) return 'Zero';
  const parts = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push(two(crore) + ' Crore');
  if (lakh) parts.push(two(lakh) + ' Lakh');
  if (thousand) parts.push(two(thousand) + ' Thousand');
  if (n) parts.push(three(n));
  return parts.join(' ');
}

export function amountInWords(value) {
  const whole = Math.floor(num(value));
  const paise = Math.round((num(value) - whole) * 100);
  const main = words(whole) + ' Rupees';
  return paise ? main + ' and ' + words(paise) + ' Paise only.' : main + ' only.';
}
