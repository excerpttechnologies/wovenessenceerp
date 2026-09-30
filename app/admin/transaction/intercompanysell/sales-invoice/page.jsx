'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import { useScope } from '@/components/ScopeContext';

/* Inter Company Sell > Sales Invoice - CONSIGNMENT BILLING, from the
   SENDER's side.

   The sender ships on an IC Delivery Challan, the receiver approves the
   goods in and sells them at its POS. This screen is where the sender then
   invoices - for exactly the units the receiver has sold:

     Not Billed   every unit from this branch's challans that the receiver
                  has SOLD and nobody has invoiced yet. Tick the units,
                  press Save Billed, and one invoice is raised per receiver.
     Billed       the lines of the invoices already raised.

   The data comes from /api/ic-item-invoice, which reads the receiver-side
   barcode rows (they carry the challan they came on) and stamps the billed
   ones - so a unit can never be invoiced twice, and a unit the receiver
   has not sold never appears here at all.

   NOT the older hidden salesinvoice screen: that one bills whole challans
   whether sold or not. This bills sold items only, which is the flow the
   client asked for (30-09-2026). */

const money = (v) => String(Math.trunc(Number(v || 0)));
const qtyText = (v) => String(Math.round((Number(v) || 0) * 100) / 100);
const when = (v) => (v ? new Date(v).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-');
const day = (v) => (v ? new Date(v).toLocaleDateString('en-GB') : '-');

export default function IcItemSalesInvoicePage() {
  const scope = useScope();
  const [tab, setTab] = useState('notbilled');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState(null);
  const [picked, setPicked] = useState([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!scope.business) { setRows([]); return; }
    setLoading(true);
    setPicked([]);
    try {
      const qs = new URLSearchParams({
        business: scope.business,
        finYear: scope.finYear || '',
        view: tab,
      });
      const r = await fetch('/api/ic-item-invoice?' + qs, { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) {
        setRows([]);
        setFlash({ type: 'err', msg: d.error || 'Could not load.' });
        return;
      }
      setRows(Array.isArray(d.rows) ? d.rows : []);
    } catch {
      setRows([]);
      setFlash({ type: 'err', msg: 'Could not reach the server.' });
    } finally {
      setLoading(false);
    }
  }, [scope.business, scope.finYear, tab]);

  useEffect(() => { load(); }, [load]);

  /* a confirmation should not sit on screen forever; errors stay */
  useEffect(() => {
    if (!flash || flash.type !== 'ok') return undefined;
    const t = setTimeout(() => setFlash(null), 6000);
    return () => clearTimeout(t);
  }, [flash]);

  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const allTicked = rows.length > 0 && picked.length === rows.length;
  const toggleAll = () => setPicked(allTicked ? [] : rows.map((r) => r.barcodeId));

  const pickedRows = useMemo(() => rows.filter((r) => picked.includes(r.barcodeId)), [rows, picked]);
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

      <div className="mb-3 flex gap-2">
        {[['notbilled', 'Not Billed'], ['billed', 'Billed']].map(([key, text]) => (
          <button
            key={key}
            type="button"
            className={'btn h-8 px-3 text-[12px] ' + (tab === key ? 'btn-primary' : '')}
            onClick={() => { setTab(key); setFlash(null); }}
          >
            {text}
          </button>
        ))}
        <span className="ml-2 self-center text-[12px] text-inkmuted">
          {tab === 'notbilled'
            ? 'Items your receivers have sold that are not invoiced yet. Tick and Save Billed - one invoice per receiver.'
            : 'Items already invoiced.'}
        </span>
      </div>

      <div className="overflow-x-auto">
        {tab === 'notbilled' ? (
          <table className="dt">
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <input
                    type="checkbox"
                    aria-label="Select every item"
                    checked={allTicked}
                    disabled={!rows.length}
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
              {!loading && scope.business && !rows.length && (
                <tr><td colSpan={10} className="dt-empty">Nothing sold by your receivers is waiting to be billed.</td></tr>
              )}
              {!loading && rows.map((r) => (
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
        ) : (
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
              {!loading && !rows.length && (
                <tr><td colSpan={9} className="dt-empty">Nothing billed yet.</td></tr>
              )}
              {!loading && rows.map((r, i) => (
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
        )}
      </div>

      {tab === 'notbilled' && (
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3">
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
      )}
    </div>
  );
}
