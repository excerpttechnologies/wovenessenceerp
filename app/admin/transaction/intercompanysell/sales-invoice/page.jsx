'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import { useScope } from '@/components/ScopeContext';

/* Inter Company Sell > Sales Invoice - CONSIGNMENT BILLING, from the
   SENDER's side.

   The sender ships on an IC Delivery Challan, the receiver approves the
   goods in and sells them at its POS. This screen is where the sender then
   invoices - for exactly the units the receiver has sold.

   ONE PAGE, TWO SECTIONS (user, 30-09-2026 - no tabs): the work to do sits
   on top, the record of it below, the same shape as Receive Delivery
   Challan.

     Not Billed   every unit from this branch's challans that the receiver
                  has SOLD and nobody has invoiced yet. Tick the units,
                  press Save Billed - one invoice per receiver.
     Billed       the lines of the invoices already raised.

   The data comes from /api/ic-item-invoice, which reads the receiver-side
   barcode rows (they carry the challan they came on) and stamps the billed
   ones - so a unit can never be invoiced twice, and a unit the receiver
   has not sold never appears here at all.

   NOT the older hidden salesinvoice screen: that one bills whole challans
   whether sold or not. This bills sold items only. */

const money = (v) => String(Math.trunc(Number(v || 0)));
const qtyText = (v) => String(Math.round((Number(v) || 0) * 100) / 100);
const when = (v) => (v ? new Date(v).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-');
const day = (v) => (v ? new Date(v).toLocaleDateString('en-GB') : '-');

export default function IcItemSalesInvoicePage() {
  const scope = useScope();
  const [pending, setPending] = useState([]);     // sold, not invoiced
  const [billed, setBilled] = useState([]);       // invoice lines
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState(null);
  const [picked, setPicked] = useState([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!scope.business) { setPending([]); setBilled([]); return; }
    setLoading(true);
    setPicked([]);
    const ask = (view) => {
      const qs = new URLSearchParams({
        business: scope.business,
        finYear: scope.finYear || '',
        view,
      });
      return fetch('/api/ic-item-invoice?' + qs, { cache: 'no-store' }).then((r) => r.json());
    };
    try {
      /* both halves of the story in one go - the endpoint answers one view
         per request, so it is asked twice */
      const [nb, b] = await Promise.all([ask('notbilled'), ask('billed')]);
      if (nb.error || b.error) {
        setFlash({ type: 'err', msg: nb.error || b.error });
        setPending([]);
        setBilled([]);
        return;
      }
      setPending(Array.isArray(nb.rows) ? nb.rows : []);
      setBilled(Array.isArray(b.rows) ? b.rows : []);
    } catch {
      setPending([]);
      setBilled([]);
      setFlash({ type: 'err', msg: 'Could not reach the server.' });
    } finally {
      setLoading(false);
    }
  }, [scope.business, scope.finYear]);

  useEffect(() => { load(); }, [load]);

  /* a confirmation should not sit on screen forever; errors stay */
  useEffect(() => {
    if (!flash || flash.type !== 'ok') return undefined;
    const t = setTimeout(() => setFlash(null), 6000);
    return () => clearTimeout(t);
  }, [flash]);

  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const allTicked = pending.length > 0 && picked.length === pending.length;
  const toggleAll = () => setPicked(allTicked ? [] : pending.map((r) => r.barcodeId));

  const pickedRows = useMemo(() => pending.filter((r) => picked.includes(r.barcodeId)), [pending, picked]);
  const pickedValue = pickedRows.reduce((a, r) => a + Number(r.netAmount || 0), 0);
  /* one invoice per receiver - say up front how many will be raised */
  const pickedReceivers = new Set(pickedRows.map((r) => r.toBusinessId || r.toBusinessName)).size;

  async function saveBilled() {
    if (!picked.length || saving) return;
    setSaving(true);
    setFlash(null);
    try {
      const r = await fetch('/api/ic-item-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business: scope.business,
          location: scope.location,
          finYear: scope.finYear,
          data: { barcodeIds: picked },
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setFlash({ type: 'err', msg: d.error || 'Could not save.' });
        load();
        return;
      }
      setFlash({
        type: 'ok',
        msg: (d.invoices || []).map((inv) =>
          'Invoice ' + inv.invoiceNo + ' raised on ' + inv.toBusinessName
          + ' for ' + inv.count + ' item(s), ' + money(inv.netValue) + '.').join(' '),
      });
      load();
    } catch {
      setFlash({ type: 'err', msg: 'Could not reach the server.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center border-b border-line pb-2">
        <span className="card-title">Inter Company Sales Invoices</span>
        <span className="flex-1" />
        <button type="button" className="btn" onClick={load}>
          <Icon name="refresh" size={14} /> Refresh
        </button>
      </div>

      {flash && (
        <div className={'mb-3 flash ' + (flash.type === 'err' ? 'flash-err' : 'flash-ok')}>{flash.msg}</div>
      )}

      {/* -------------------------------------------------- NOT BILLED -- */}
      <div className="mb-2 flex items-center border-b border-line pb-2">
        <span className="card-title">Not Billed</span>
        {pending.length > 0 && (
          <span className="ml-2 rounded bg-[#fff3cd] px-2 py-0.5 text-[11.5px] font-semibold text-warnyellow">
            {pending.length} sold item(s) waiting to be billed
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="dt">
          <thead>
            <tr>
              <th style={{ width: 40 }}>
                <input
                  type="checkbox"
                  aria-label="Select every item"
                  checked={allTicked}
                  disabled={!pending.length}
                  onChange={toggleAll}
                />
              </th>
              <th style={{ width: 170 }}>Receiver</th>
              <th style={{ width: 150 }}>DC No</th>
              <th style={{ width: 110 }}>Barcode</th>
              <th>Item</th>
              <th className="!text-right" style={{ width: 60 }}>Qty</th>
              <th className="!text-right" style={{ width: 80 }}>Rate</th>
              <th className="!text-right" style={{ width: 90 }}>Amount</th>
              <th style={{ width: 170 }}>Sold On</th>
              <th style={{ width: 110 }}>POS Invoice</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={10} className="dt-empty">Loading...</td></tr>}
            {!loading && !scope.business && (
              <tr><td colSpan={10} className="dt-empty">Select a Business in the top bar.</td></tr>
            )}
            {!loading && scope.business && !pending.length && (
              <tr><td colSpan={10} className="dt-empty">Nothing sold by your receivers is waiting to be billed.</td></tr>
            )}
            {!loading && pending.map((r) => (
              <tr
                key={r.barcodeId}
                className={picked.includes(r.barcodeId) ? 'bg-[#f0f7ff]' : 'cursor-pointer'}
                onClick={() => toggle(r.barcodeId)}
              >
                <td onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label={'Bill ' + (r.barcodeNo || r.itemName)}
                    checked={picked.includes(r.barcodeId)}
                    onChange={() => toggle(r.barcodeId)}
                  />
                </td>
                <td className="font-semibold">{r.toBusinessName || '-'}</td>
                <td>{r.dcNo || '-'}</td>
                <td className="font-mono text-[12px]">{r.barcodeNo || '-'}</td>
                <td>{r.itemName || r.itemCode || '-'}</td>
                <td className="!text-right">{qtyText(r.qty)}</td>
                <td className="!text-right">{money(r.unitRate)}</td>
                <td className="!text-right">{money(r.netAmount)}</td>
                <td className="whitespace-nowrap">{when(r.soldAt)}</td>
                <td>{r.posInvoiceNo || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-5 mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!picked.length || saving}
          onClick={saveBilled}
        >
          {saving ? <span className="spin" /> : <Icon name="save" size={14} />} Save Billed
        </button>
        <span className="text-[13px] text-inkmuted">
          {picked.length
            ? picked.length + ' item(s) ticked, ' + money(pickedValue)
              + (pickedReceivers > 1 ? ' - ' + pickedReceivers + ' invoices will be raised, one per receiver.' : '.')
            : 'Tick the sold items to bill.'}
        </span>
      </div>

      {/* ------------------------------------------------------ BILLED -- */}
      <div className="mb-2 flex items-center border-b border-line pb-2">
        <span className="card-title">Billed</span>
      </div>

      <div className="overflow-x-auto">
        <table className="dt">
          <thead>
            <tr>
              <th style={{ width: 130 }}>Invoice No</th>
              <th style={{ width: 95 }}>Date</th>
              <th style={{ width: 170 }}>Receiver</th>
              <th style={{ width: 150 }}>DC No</th>
              <th style={{ width: 110 }}>Barcode</th>
              <th>Item</th>
              <th className="!text-right" style={{ width: 60 }}>Qty</th>
              <th className="!text-right" style={{ width: 90 }}>Amount</th>
              <th style={{ width: 110 }}>POS Invoice</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="dt-empty">Loading...</td></tr>}
            {!loading && !billed.length && (
              <tr><td colSpan={9} className="dt-empty">Nothing billed yet.</td></tr>
            )}
            {!loading && billed.map((r, i) => (
              <tr key={r.invoiceId + '-' + i}>
                <td className="font-semibold">{r.invoiceNo || '-'}</td>
                <td>{day(r.invoiceDate)}</td>
                <td>{r.toBusinessName || '-'}</td>
                <td>{r.dcNo || '-'}</td>
                <td className="font-mono text-[12px]">{r.barcodeNo || '-'}</td>
                <td>{r.itemName || '-'}</td>
                <td className="!text-right">{qtyText(r.qty)}</td>
                <td className="!text-right">{money(r.netAmount)}</td>
                <td>{r.posInvoiceNo || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
