'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from './Icon';
import { uomTypeOf } from '@/lib/barcodeUnits';

/* Printable Inter Company Delivery Challan.

   WHY THIS EXISTS. The list's print icon used to call window.print() on the
   LIST page. globals.css hides `body *` at print time and shows only
   `.print-doc`, and the list has no such element - so every challan printed
   as a blank sheet. The challan needs a page of its own that renders the
   document inside `.print-doc`, which is how the Sales Invoice print works
   (components/IcTaxInvoiceView.jsx).

   Columns follow the printed challan: Sl No, Barcode, Qty, UOM, HSN,
   Item Name / Description. Money is deliberately left off - a delivery
   challan moves goods, it is not the tax invoice.

   THE FOOT TOTALS PER KIND OF UNIT, not overall: "Total Qty (Pc(s)) : 45"
   and "Total Qty (Mtr.) : 5" on their own lines. A single figure added metres
   to pieces, which is not a quantity of anything - 45 sarees and 5 metres of
   cloth is not "50".

   Grouped by uomTypeOf() rather than by the unit text, because the same
   challan really does carry "Pc(s)" and "PC" on different lines - the unit is
   free text on the item master. Totalling the raw strings printed pieces
   twice, as two totals of 1 rather than one total of 2. uomTypeOf() is the
   project's single definition of "is this pieces or metres" (lib/barcodeUnits.js,
   pure so the browser can use it), and it is what the barcode engine and the
   label printer already decide by.

   Everything is read from endpoints that already exist; nothing new on the
   server. */

const qty = (v) => Number(v || 0).toFixed(2);

/* Pieces and metres, each totalled once.

   uomTypeOf() answers 'PC' or 'MTR' for whatever free text the item carries,
   so "Pc(s)", "PC" and "Pcs" all land on the same line. It has no third
   answer - anything it does not recognise as a length reads as pieces, which
   is the same assumption the barcode engine makes when it plans labels. */
const UOM_LABEL = { PC: 'Pc(s)', MTR: 'Mtr.' };

function footTotals(lines) {
  const out = {};
  lines.forEach((l) => {
    const key = UOM_LABEL[uomTypeOf(l.uom)] || 'Pc(s)';
    out[key] = Math.round(((out[key] || 0) + (Number(l.qty) || 0) + Number.EPSILON) * 100) / 100;
  });
  return out;
}
const day = (v) => (v ? new Date(v).toLocaleDateString('en-GB') : '-');

async function getJson(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Could not load');
  return r.json();
}

/* one location or stock point name, via the options feed the forms already use */
async function labelOf(ref, business, id) {
  if (!id) return '';
  try {
    const d = await getJson('/api/options?ref=' + ref + '&business=' + (business || ''));
    return (d.options || []).find((o) => String(o.value) === String(id))?.label || '';
  } catch {
    return '';
  }
}

export default function IcChallanPrintView({ id }) {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const { doc } = await getJson('/api/ic-delivery-challan/' + id);
        if (!doc) throw new Error('Challan not found.');

        const [from, to, fromLoc, toLoc, stockPoint] = await Promise.all([
          doc.businessId ? getJson('/api/business/' + doc.businessId).then((d) => d.doc) : null,
          doc.toBusinessId ? getJson('/api/business/' + doc.toBusinessId).then((d) => d.doc) : null,
          labelOf('companylocations', doc.businessId, doc.locationId),
          labelOf('companylocations', doc.toBusinessId, doc.toLocationId),
          labelOf('stockpoint', doc.businessId, doc.stockPointId),
        ]);

        if (!off) setData({ doc, from, to, fromLoc, toLoc, stockPoint });
      } catch (e) {
        if (!off) setError(e.message);
      }
    })();
    return () => { off = true; };
  }, [id]);

  if (error) return <div className="card"><div className="card-body text-danger">{error}</div></div>;
  if (!data) return <div className="card"><div className="card-body"><span className="spin" /></div></div>;

  const { doc, from, to, fromLoc, toLoc, stockPoint } = data;
  const items = Array.isArray(doc.items) ? doc.items : [];
  const perUom = footTotals(items);

  const addr = (b) => [b?.addressLine1, b?.addressLine2, b?.city].filter(Boolean).join(', ');
  const place = (b) => [b?.state, b?.zipCode].filter(Boolean).join(' - ');

  return (
    <>
      <div className="no-print mb-3 flex items-center">
        <span className="text-[15px] font-bold text-brand-link">Print Delivery Challan</span>
        <span className="flex-1" />
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          <Icon name="printer" size={14} /> Print
        </button>
        <button
          type="button"
          className="btn ml-2"
          onClick={() => router.push('/admin/transaction/intercompanysell/deliverychallan')}
        >
          <Icon name="back" size={14} /> Back
        </button>
      </div>

      <div className="print-doc mx-auto max-w-[980px] bg-white text-[13px]">
        <div className="mb-1 text-center text-[15px] font-bold">Delivery Challan</div>

        <div className="border border-black">
          {/* ------------------------------------------------ letterhead */}
          <div className="border-b border-black px-4 py-3 text-center">
            <div className="text-[22px] font-bold">{from?.businessPrintName || from?.name || ''}</div>
            {fromLoc && <div>({fromLoc})</div>}
            {addr(from) && <div>{addr(from)}</div>}
            <div>
              {place(from)}
              {from?.mobile ? ', Tel: ' + from.mobile : ''}
            </div>
            {from?.gstin && <div className="font-bold">GSTIN: {from.gstin}</div>}
          </div>

          {/* ---------------------------------------- consignee + doc block */}
          <div className="grid grid-cols-2 border-b border-black">
            <div className="border-r border-black px-3 py-2">
              <div className="font-bold">Consignee</div>
              <div className="font-bold">{to?.businessPrintName || to?.name || ''}</div>
              {toLoc && <div>({toLoc})</div>}
              {addr(to) && <div>{addr(to)}</div>}
              {place(to) && <div>{place(to)}</div>}
              {(doc.customerGstn || to?.gstin) && (
                <div>GSTIN: {doc.customerGstn || to?.gstin}</div>
              )}
            </div>
            <div className="px-3 py-2">
              <table className="w-full">
                <tbody>
                  <tr><td className="w-[40%] font-bold">DC No</td><td>{doc.dcNo || '-'}</td></tr>
                  <tr><td className="font-bold">DC Date</td><td>{day(doc.dcDate)}</td></tr>
                  <tr><td className="font-bold">Stock Point</td><td>{stockPoint || '-'}</td></tr>
                  <tr><td className="font-bold">Financial Year</td><td>{doc.finYear || '-'}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ---------------------------------------------------- lines */}
          <table className="prn-tbl">
            <thead>
              <tr>
                <th className="w-[60px]">Sl No.</th>
                <th>Barcode</th>
                <th className="w-[80px]">Qty</th>
                <th className="w-[70px]">UOM</th>
                <th className="w-[100px]">HSN</th>
                <th>Item Name / Description</th>
              </tr>
            </thead>
            <tbody>
              {!items.length && (
                <tr><td colSpan={6} className="text-center">No items on this challan.</td></tr>
              )}
              {items.map((l, i) => (
                <tr key={i}>
                  <td className="text-center">{i + 1}</td>
                  <td>{l.barcodeNo || '-'}</td>
                  <td className="text-right">{qty(l.qty)}</td>
                  <td className="text-center">{l.uom || '-'}</td>
                  <td className="text-center">{l.hsn || '-'}</td>
                  <td>{l.itemName || '-'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {/* One plain full-width row across the foot, read from the left -
                  the totals are a statement about the consignment, not a
                  value belonging under the Qty column. */}
              <tr>
                <td colSpan={6} className="text-left font-bold">
                  {Object.entries(perUom).map(([u, q]) => (
                    <div key={u}>Total Qty ({u}) : {q}</div>
                  ))}
                  {!items.length && <div>Total Qty : 0</div>}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* -------------------------------------------------- signatures */}
          <div className="flex justify-end  px-3 pb-10 pt-10">
            {/* <div>Receiver&apos;s Signature</div> */}
            <div className="text-right">
              For {from?.businessPrintName || from?.name || ''}
              {/* <div className="pt-8">Authorised Signatory</div> */}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
