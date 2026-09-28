'use client';
import Icon from './Icon';

/* View Stock Adjustment - the popup behind the eye on Inventory -> Stock
   Adjustment.

   The columns are not invented here: they are the ones the ADD form already
   declares for its Items card (app/admin/inventory/stock-adjustment/form.js -
   Item Code, Item Name, HSN, GST Slab, UOM, QTY, Final Rate, Before Tax,
   IGST/CGST/SGST Amount, Net Amount), so an adjustment reads back in the same
   shape it was entered in.

   Addition and Subtraction render identically. They differ in the badge and
   in what the movement did to stock - not in what the paperwork says - and
   two different layouts for one document would only invite the two to drift
   apart. */

const money = (v) => Number(v || 0).toFixed(2);
const text = (v) => {
  const s = String(v ?? '').trim();
  return s === '' ? '-' : s;
};
const day = (v) => {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  const p = (n) => String(n).padStart(2, '0');
  return p(d.getDate()) + '-' + p(d.getMonth() + 1) + '-' + d.getFullYear();
};

/* ADDITION or SUBTRACTION, whatever the record happens to spell it.

   Four spellings are on file: 'Addition' and 'Subtraction' from the POS till,
   and 'ISSUE' from the older rows it wrote before those two words settled.
   Matched loosely so an old adjustment is not left with a blank badge. */
const direction = (type) => {
  const v = String(type || '').toLowerCase();
  if (v.includes('add')) return { label: 'Addition', tone: 'pill-green' };
  if (v.includes('sub') || v.includes('issue')) return { label: 'Subtraction', tone: 'pill-red' };
  return { label: text(type), tone: 'pill-grey' };
};

/* ONE LINE'S MONEY.

   RSP IS GST-INCLUSIVE IN THIS APP. The till backs the tax out of the ticket
   price rather than adding it on top - the POS footer shows a 600 line at 5%
   as "Taxable 571.43, Tax 28.57 (inclusive)" - and a POS-raised adjustment
   stores exactly that ticket price in `netAmount`, `rate` and `rsp` alike.
   So the net is taken as given and the taxable value is derived from it;
   computing qty x rate and adding GST on top would report 630.00 against a
   line the till itself calls 600.00.

   A line that carries the form's own 'Net Amount' / 'Before Tax' keys - what
   the manual Items card writes - is believed instead of recomputed, because
   there the rate is held tax-exclusive and only the form knows that.

   The split is CGST + SGST, never IGST. A stock adjustment is an internal
   correction inside one location, so there is no second state for an
   inter-state supply to cross. The same choice is hard-coded in the add form
   and in the Goods Received Return preview. */
const lineAmounts = (item) => {
  const qty = Number(item.qty ?? item.QTY ?? 0) || 0;
  const rate = Number(item.rate ?? item.finalNet ?? item.purRate ?? item.rsp ?? item['Final Rate'] ?? 0) || 0;
  const gst = Number(item.gst ?? item['GST Slab'] ?? 0) || 0;

  const stated = Number(item.netAmount ?? item['Net Amount'] ?? 0) || 0;
  const net = stated || qty * rate;

  const statedBefore = Number(item['Before Tax'] ?? 0) || 0;
  const beforeTax = statedBefore || net / (1 + gst / 100);

  const tax = net - beforeTax;
  return { qty, rate, gst, beforeTax, igst: 0, cgst: tax / 2, sgst: tax / 2, net };
};

/* One labelled value in the header block. */
function Cell({ label, children }) {
  return (
    <div className="px-4 py-2.5">
      <div className="text-[11px] uppercase tracking-wide text-inkmuted">{label}</div>
      <div className="mt-0.5 text-[13.5px] text-ink">{children}</div>
    </div>
  );
}

function Chip({ children }) {
  return (
    <span className="rounded bg-[#eef2f7] px-2 py-0.5 text-[11.5px] font-semibold text-inkmuted">
      {children}
    </span>
  );
}

export default function StockAdjustmentView({ row, labels = {}, onClose }) {
  const items = Array.isArray(row.items) ? row.items : [];
  const kind = direction(row.type);

  const lines = items.map((item) => ({ item, amounts: lineAmounts(item) }));
  const totals = lines.reduce((sum, { amounts }) => ({
    qty: sum.qty + amounts.qty,
    beforeTax: sum.beforeTax + amounts.beforeTax,
    igst: sum.igst + amounts.igst,
    cgst: sum.cgst + amounts.cgst,
    sgst: sum.sgst + amounts.sgst,
    net: sum.net + amounts.net,
  }), { qty: 0, beforeTax: 0, igst: 0, cgst: 0, sgst: 0, net: 0 });

  return (
    <div className="rounded-lg bg-white shadow-xl">
      <div className="flex items-center border-b border-line px-5 py-3">
        <span className="card-title">View Stock Adjustment</span>
        <span className="flex-1" />
        <button
          type="button"
          className="act-btn bg-danger"
          title="Close"
          onClick={onClose}
        >
          <Icon name="x" size={12} />
        </button>
      </div>

      <div className="p-5">
        {/* THE DOCUMENT ITSELF - six facts, in the order the add form asks
            for them. */}
        <div className="grid grid-cols-1 divide-y divide-line rounded border border-line bg-[#f7f9fc] sm:grid-cols-3 sm:divide-y-0">
          <Cell label="Adjustment Code">
            <span className="font-semibold text-brand-link">{text(row.adjustmentNo)}</span>
          </Cell>
          <Cell label="Adjustment Type">
            <span className={'pill ' + kind.tone}>{kind.label}</span>
          </Cell>
          <Cell label="Adjustment Date">
            {/* adjustmentDate is what the operator entered; createdAt is when
                the record was written. The manual form fills the first and
                the till does not, so it falls back rather than showing a
                dash against every POS-raised adjustment. */}
            {day(row.adjustmentDate || row.createdAt)}
          </Cell>
          <Cell label="Adjustment Reason">{text(row.adjustmentReason)}</Cell>
          <Cell label="Financial Year">{text(row.finYear)}</Cell>
          <Cell label="Created By">{text(row.createdBy)}</Cell>
        </div>

        {row.remarks ? (
          <div className="mt-3 rounded border border-line px-4 py-2.5">
            <div className="text-[11px] uppercase tracking-wide text-inkmuted">Remarks</div>
            <div className="mt-0.5 text-[13.5px] text-ink">{text(row.remarks)}</div>
          </div>
        ) : null}

        <div className="mt-4 mb-2 flex flex-wrap items-center gap-2 border-b border-line pb-2">
          <span className="card-title">Adjusted Items List</span>
          <span className="flex-1" />
          <Chip>{lines.length} {lines.length === 1 ? 'Item' : 'Items'}</Chip>
          <Chip>Total Qty: {Number(totals.qty.toFixed(3))}</Chip>
          <Chip>{'₹'} Total Net: {money(totals.net)}</Chip>
        </div>

        <div className="overflow-x-auto">
          <table className="dt min-w-[1100px]">
            <thead>
              <tr>
                <th>#</th>
                <th>Item Code</th>
                <th>Item Name</th>
                <th>HSN</th>
                <th>GST Slab</th>
                <th>UOM</th>
                <th className="text-right">QTY</th>
                <th className="text-right">Final Rate</th>
                <th className="text-right">Before Tax</th>
                <th className="text-right">IGST</th>
                <th className="text-right">CGST</th>
                <th className="text-right">SGST</th>
                <th className="text-right">Net Amount</th>
              </tr>
            </thead>
            <tbody>
              {!lines.length && (
                <tr><td colSpan={13} className="dt-empty">No items on this adjustment.</td></tr>
              )}

              {lines.map(({ item, amounts }, index) => (
                <tr key={item.barcodeNo || item.itemId || index}>
                  <td>{index + 1}</td>
                  <td className="font-semibold text-brand-link">
                    {text(item.itemCode || item.code || item['Item Code'])}
                  </td>
                  {/* itemName on a POS line repeats the code, so the typed
                      description is preferred where there is one. */}
                  <td>{text(item.description || item.itemName || item.name || item['Item Name'])}</td>
                  <td>{text(item.hsn || item.HSN)}</td>
                  <td>{amounts.gst ? 'GST ' + amounts.gst + ' %' : '-'}</td>
                  <td>{text(item.uom || item.UOM)}</td>
                  <td className="text-right">{Number(amounts.qty.toFixed(3))}</td>
                  <td className="text-right">{money(amounts.rate)}</td>
                  <td className="text-right">{money(amounts.beforeTax)}</td>
                  <td className="text-right">{money(amounts.igst)}</td>
                  <td className="text-right">{money(amounts.cgst)}</td>
                  <td className="text-right">{money(amounts.sgst)}</td>
                  <td className="text-right font-semibold text-okgreen">{money(amounts.net)}</td>
                </tr>
              ))}

              {lines.length > 0 && (
                <tr className="font-semibold">
                  <td colSpan={6}>Total</td>
                  <td className="text-right">{Number(totals.qty.toFixed(3))}</td>
                  <td className="text-right">-</td>
                  <td className="text-right">{money(totals.beforeTax)}</td>
                  <td className="text-right">{money(totals.igst)}</td>
                  <td className="text-right">{money(totals.cgst)}</td>
                  <td className="text-right">{money(totals.sgst)}</td>
                  <td className="text-right text-okgreen">{money(totals.net)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
