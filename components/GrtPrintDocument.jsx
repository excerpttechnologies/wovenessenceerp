'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { amountInWords } from '@/lib/amountWords';

/* ==========================================================================
   GOODS RETURN NOTE - the printable document.

   A DEDICATED PRINT REPRESENTATION. The list's preview keeps the ERP screen
   it always had; this renders beside it, hidden on screen and revealed by
   @media print (.grt-print in globals.css). So the operator's screen is
   unchanged and the paper is a document.

   IT READS, IT DOES NOT COMPUTE ANYTHING NEW. Every figure comes off the GRT
   record the list already fetched - the same object the screen preview
   binds to - and the only arithmetic here is the same per-line multiply the
   preview has always done. Nothing is fetched, nothing is written, no
   business rule lives here.

   WHAT IS DELIBERATELY ABSENT: Discount, Freight and Round Off. models/Grt.js
   carries qty, itemCount, taxable, gst and netAmount and nothing else
   financial, so there is no honest value to print for them. A money document
   that invents a line is worse than one that omits it.

   IGST is 0 and the tax is split CGST/SGST in halves. That is not an
   assumption made here - it is what the GRT screen has always shown, and it
   reconciles: on GRT TFJ/26/0130 the three lines sum to 5685.00, which is the
   record's own `taxable`, and 5% of it is 284.25, which is its own `gst`.
   ========================================================================== */

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const money = (v) => num(v).toFixed(2);
/* Split a tax total into its CGST and SGST halves so that the two PRINTED
   figures add back to the printed total. Halving and rounding each half
   independently does not: 284.25 / 2 is 142.125, which rounds to 142.13
   twice and prints a pair summing to 284.26 against a stated total of
   284.25 - a penny that a person checking the document by hand will find.
   The remainder is carried into the second half instead. This is a display
   rule only; no stored figure is touched. */
const halves = (total) => {
  const t = num(num(total).toFixed(2));
  const first = Math.round(t * 50) / 100;
  return [first, num((t - first).toFixed(2))];
};
/* the ERP's date convention, as components/GrcPrintView.jsx and
   PurchaseInvoicePrintView.jsx both spell it */
const d = (v) => {
  if (!v) return '';
  const x = new Date(v);
  return Number.isNaN(x.getTime()) ? ''
    : String(x.getDate()).padStart(2, '0') + '-'
      + String(x.getMonth() + 1).padStart(2, '0') + '-' + x.getFullYear();
};
const dash = (v) => {
  const t = String(v ?? '').trim();
  return t || '-';
};

/* One label/value pair. Kept tiny so the sections below read as a form. */
function F({ label, value }) {
  return (
    <div className="grt-f">
      <span className="grt-f-l">{label}</span>
      <span className="grt-f-v">{value}</span>
    </div>
  );
}

export default function GrtPrintDocument({ row, business, labels = {} }) {
  /* ---- ITS OWN PRINT SURFACE, AT BODY LEVEL ----------------------------
     The document is rendered through a portal into a div that is a direct
     child of <body>, and globals.css then display:none's everything else at
     that level - the same arrangement the barcode label run uses
     (#barcode-print-root / body.printing-labels).

     It has to be, and the reason is geometry. The preview modal lives inside
     the admin shell: <main class="px-5"> inside <div class="ml-sidebar">,
     where ml-sidebar is a real 280px margin. The generic print rule hides the
     shell with `visibility: hidden`, which paints nothing but KEEPS every box
     in the flow - so a sheet laid out in there is sized and positioned
     against roughly 109mm of a 194mm page, not against the page. A 194mm
     document in a 109mm box hangs ~37mm off the right edge (taking Net Retail
     Price and Qty with it) and starts below the whole invisible list.
     Neither is fixable by nudging widths; the shell has to leave the box
     tree. At body level the sheet resolves against the page itself.
     ---------------------------------------------------------------------- */
  const [host, setHost] = useState(null);
  useEffect(() => {
    const el = document.createElement('div');
    el.id = 'grt-print-root';
    document.body.appendChild(el);
    document.body.classList.add('printing-grt');
    setHost(el);
    /* Removed on unmount - i.e. when the preview closes. Leaving the class
       welded to <body> would blank every LATER print in the session, which is
       the failure the label run documents. */
    return () => {
      document.body.classList.remove('printing-grt');
      el.remove();
    };
  }, []);

  if (!row) return null;
  const b = business || {};
  const lbl = (v) => dash(labels[String(v)] || v);

  const items = Array.isArray(row.items) ? row.items : [];

  /* ---- the lines, and the tax gathered per HSN in the same pass ---------
     The per-line figures are exactly the preview's: finalNet falls back to
     purRate, taxable is rate x qty, and the slab splits in two. */
  const hsnMap = new Map();
  let totalQty = 0;
  let totalTaxable = 0;
  const lines = items.map((item, i) => {
    const qty = num(item.qty);
    const rate = num(item.finalNet || item.purRate);
    const taxable = rate * qty;
    const pct = num(item.gst);
    const tax = taxable * (pct / 100);
    totalQty += qty;
    totalTaxable += taxable;

    const key = dash(item.hsn) + '|' + pct;
    /* the row's WHOLE tax is accumulated; it is split into halves once, below,
       so the split is rounded in exactly one place */
    const cur = hsnMap.get(key) || { hsn: dash(item.hsn), pct, taxable: 0, igst: 0, tax: 0 };
    cur.taxable += taxable;
    cur.tax += tax;
    hsnMap.set(key, cur);

    return {
      sl: i + 1,
      /* the unit's OWN sticker number. barcodeGenerated is the composed
         reference ("G513 * 05182 * 1 * 2") and is a different thing. */
      barcode: dash(item.barcodeNo),
      itemCode: dash(item.itemCode),
      itemName: dash(item.supplierDescription || item.itemName || item.printDescription),
      hsn: dash(item.hsn),
      purRate: money(item.purRate),
      finalRate: money(item.finalNet || item.purRate),
      retail: money(item.retailPrice || item.offerPrice),
      qty: qty.toFixed(2),
    };
  });
  /* Each HSN row's halves are rounded ONCE, with the remainder carried, by the
     same helper the money block uses. Halving and rounding each side alone
     made the two panels of this band disagree: the Tax Summary printed
     CGST 142.13 / SGST 142.13 while the Return Value beside it printed
     142.13 / 142.12, for one and the same return. */
  const hsnRows = [...hsnMap.values()].map((r) => {
    const [cgst, sgst] = halves(r.tax);
    return { ...r, cgst, sgst };
  });
  const hsnTotal = hsnRows.reduce((a, r) => ({
    taxable: a.taxable + r.taxable,
    igst: a.igst + r.igst,
    tax: a.tax + r.tax,
  }), { taxable: 0, igst: 0, tax: 0 });

  /* The header's own stored totals are preferred where they exist - they are
     what the rest of the ERP reads - and the summed lines stand in only when
     the header carries nothing. */
  const subTotal = row.taxable !== undefined && row.taxable !== null ? num(row.taxable) : totalTaxable;
  const gstTotal = row.gst !== undefined && row.gst !== null ? num(row.gst) : hsnTotal.tax;
  const netAmount = row.netAmount !== undefined && row.netAmount !== null
    ? num(row.netAmount) : subTotal + gstTotal;

  const gstHalves = halves(gstTotal);

  const supplierName = dash(labels[String(row.supplierId)] || row.supplierName
    || (items[0] && items[0].supplierName));
  /* the vendor code as the ERP writes it: "NAME (G1319)" from the options
     list, so the code is taken from the label rather than invented */
  const codeMatch = String(supplierName).match(/[([]([^)\]]+)[)\]]\s*$/);
  const supplierCode = codeMatch ? codeMatch[1] : '-';
  const companyName = b.businessPrintName || b.printName || b.name || '';
  const cityLine = [b.city, b.state].filter(Boolean).join(', ')
    + (b.zipCode ? ' - ' + b.zipCode : '');

  const doc = (
    <div className="grt-print">
      <div className="grt-sheet">
        {/* ------------------------------------------------- letterhead --- */}
        <div className="grt-band grt-head">
          {companyName && <div className="grt-co">{companyName}</div>}
          {b.addressLine1 && <div>{b.addressLine1}</div>}
          {b.addressLine2 && <div>{b.addressLine2}</div>}
          {cityLine.trim() && cityLine.trim() !== '-' && <div>{cityLine}</div>}
          <div className="grt-contact">
            {b.mobile && <span>Tel: {b.mobile}</span>}
            {b.email && <span>Email: {b.email}</span>}
            {b.gstin && <span className="font-bold">GSTIN: {b.gstin}</span>}
          </div>
        </div>
        <div className="grt-band grt-title">Goods Return Note</div>

        {/* ------------------------------------------ supplier details --- */}
        {/* two columns: a vendor's registered name is long and is the one
            value here allowed to take a second line, so it gets a whole
            column rather than being squeezed into a third of the sheet */}
        <div className="grt-band">
          <div className="grt-sec">Supplier Details</div>
          <div className="grt-grid grt-g2">
            <F label="Supplier Name" value={supplierName} />
            <F label="Supplier Code" value={supplierCode} />
            <F label="Supplier GST No." value={dash(row.vendorGstNo)} />
            <F label="Supplier Document No." value={dash(row.vendorDocNo)} />
            <F label="Supplier Document Date" value={dash(d(row.vendorDocDate))} />
          </div>
        </div>

        {/* ------------------------------------------ document details --- */}
        {/* eleven short fields in THREE columns rather than eleven stacked
            lines: the same information in four rows instead of eleven, which
            is most of what buys the one-page fit */}
        <div className="grt-band">
          <div className="grt-sec">Document Details</div>
          <div className="grt-grid grt-g3">
            <F label="GRT No." value={dash(row.grtNo)} />
            <F label="GRT Date" value={dash(d(row.grtDate))} />
            <F label="GRC No." value={dash(row.grcNumber)} />
            <F label="Purchase Group" value={lbl(row.purchaseGroupId)} />
            <F label="Purchase Term" value={lbl(row.purchaseTermId)} />
            <F label="Total Qty" value={num(row.qty ?? totalQty).toFixed(2)} />
            <F label="Old Stock" value={dash(row.oldStock)} />
            <F label="Occasion" value={dash(row.occasion)} />
            <F label="No. of Items" value={String(row.itemCount ?? items.length)} />
            <F label="Agent" value={lbl(row.agentId)} />
            <F label="Logistics" value={lbl(row.logisticId)} />
          </div>
        </div>

        {/* ------------------------------------------------ the items ----- */}
        <table className="prn-tbl grt-tbl">
          <colgroup>
            {/* real millimetres, summing to exactly the 194mm printable
                width of A4 portrait at 8mm margins - see globals.css */}
            <col className="c-sl" /><col className="c-bc" /><col className="c-ic" />
            <col className="c-nm" /><col className="c-hsn" /><col className="c-amt" />
            <col className="c-amt" /><col className="c-net" /><col className="c-qty" />
          </colgroup>
          <thead>
            <tr>
              <th>Sl No.</th><th>Barcode</th><th>Item Code</th>
              <th className="c-name">Item Name</th><th>HSN</th>
              <th>Pur Rate</th><th>Final Rate</th><th>Net Retail Price</th><th>Qty</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr><td colSpan={9} className="grt-none">No items on this return.</td></tr>
            )}
            {lines.map((r) => (
              <tr key={r.sl}>
                <td className="grt-c">{r.sl}</td>
                <td>{r.barcode}</td>
                <td>{r.itemCode}</td>
                <td className="c-name">{r.itemName}</td>
                <td>{r.hsn}</td>
                <td className="grt-n">{r.purRate}</td>
                <td className="grt-n">{r.finalRate}</td>
                <td className="grt-n">{r.retail}</td>
                <td className="grt-n">{r.qty}</td>
              </tr>
            ))}
            {/* TOTAL sits in tbody on purpose: a tfoot is a table-footer-group
                in paged media and would reprint at the bottom of every sheet.
                This belongs once, under the last line. */}
            <tr className="grt-total">
              <td colSpan={8}>Total Qty</td>
              <td className="grt-n">{num(row.qty ?? totalQty).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        {/* ------------------------------- tax summary | money totals ----- */}
        <div className="grt-band grt-two grt-keep">
          <div className="grt-col">
            <div className="grt-sec">Tax Summary</div>
            <table className="prn-tbl grt-tax">
              {/* this table is table-layout:fixed too, so without stated
                  widths its eight columns would divide the half-band equally
                  and clip "5685.00" - see the budget in globals.css */}
              <colgroup>
                <col className="x-hsn" /><col className="x-tax" />
                <col className="x-pct" /><col className="x-amt" />
                <col className="x-pct" /><col className="x-amt" />
                <col className="x-pct" /><col className="x-amt" />
              </colgroup>
              <thead>
                <tr>
                  <th>HSN</th><th>Taxable</th>
                  <th>IGST %</th><th>IGST</th>
                  <th>CGST %</th><th>CGST</th>
                  <th>SGST %</th><th>SGST</th>
                </tr>
              </thead>
              <tbody>
                {hsnRows.map((r) => (
                  <tr key={r.hsn + r.pct}>
                    <td>{r.hsn}</td>
                    <td className="grt-n">{money(r.taxable)}</td>
                    <td className="grt-n">0.00</td>
                    <td className="grt-n">{money(r.igst)}</td>
                    <td className="grt-n">{money(r.pct / 2)}</td>
                    <td className="grt-n">{money(r.cgst)}</td>
                    <td className="grt-n">{money(r.pct / 2)}</td>
                    <td className="grt-n">{money(r.sgst)}</td>
                  </tr>
                ))}
                <tr className="grt-total">
                  <td>Total</td>
                  <td className="grt-n">{money(hsnTotal.taxable)}</td>
                  <td className="grt-n">-</td>
                  <td className="grt-n">{money(hsnTotal.igst)}</td>
                  <td className="grt-n">-</td>
                  <td className="grt-n">{money(gstHalves[0])}</td>
                  <td className="grt-n">-</td>
                  <td className="grt-n">{money(gstHalves[1])}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="grt-col grt-col-r">
            <div className="grt-sec">Return Value</div>
            {/* only the figures models/Grt.js actually stores */}
            <div className="grt-money">
              <F label="Before GST" value={money(subTotal)} />
              <F label="IGST" value={money(hsnTotal.igst)} />
              <F label="CGST" value={money(gstHalves[0])} />
              <F label="SGST" value={money(gstHalves[1])} />
              <F label="Total GST" value={money(gstTotal)} />
              <div className="grt-f grt-net">
                <span className="grt-f-l">Net Amount</span>
                <span className="grt-f-v">{money(netAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ------------------------------------------ words + signatures --- */}
        <div className="grt-band grt-words grt-keep">
          <b>Amount in Words:</b> {amountInWords(netAmount)}
        </div>
        <div className="grt-band grt-sign grt-keep">
          <div><span>Prepared By</span></div>
          <div><span>Checked By</span></div>
          <div>
            {companyName && <div className="grt-for">For {companyName}</div>}
            <span>Authorised Signatory</span>
          </div>
        </div>
      </div>

      {/* The page geometry is mounted WITH this document rather than written
          into globals.css, and that is deliberate: an @page rule in the
          global sheet applies to every print in the application, and the
          barcode label run computes its own @page from the stock it is
          printing (lib/barcodeLabelGeometry.js, labelPageRule). Living here,
          it exists only while a Goods Return Note is on screen. */}
      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 8mm; }
        }
      `}</style>
    </div>
  );

  /* Nothing renders until the host div exists. It is created in an effect, so
     the server renders nothing and the client's first pass renders nothing -
     which is also what keeps this free of hydration mismatch. */
  return host ? createPortal(doc, host) : null;
}
