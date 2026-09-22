'use client';
import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { useScope } from '@/components/ScopeContext';

/* Inter Company Sell -> Receive Delivery Challan.

   The INBOX of whichever branch is selected in the top bar: challans another
   branch raised and addressed HERE, each with one button to accept it.

   Not a ListView. This screen creates nothing - there is no ADD - and its row
   action is "Receive", which ListView has no hook for. Bending a component
   every other list depends on, for one screen, is the worse trade; this calls
   /api/ic-receive-delivery-challan directly instead.

   Changing Business or Location in the top bar changes whose inbox this is.

   There is no "To Receive" tab and no Receive button. Receipt is automatic:
   /api/ic-delivery-challan lands the goods at the destination in the same
   request that ships them, so a challan that has been sent is already here.
   The queue that used to sit in front of this screen only held goods that had
   already left the sender, belonging to nobody until somebody clicked.

   Two tabs:

     Received  everything sent here - each line can be PART-returned from
               here, for the damaged quantity only
     Returns   what has come back on challans THIS branch sent, so the sender
               sees damaged goods without a screen of their own

   Receiving DOES move stock - it creates barcodeLabel rows under this branch,
   which is what lets it sell the goods. See lib/icReceive.js. */

const money = (v) => Number(v || 0).toFixed(2);
const day = (v) => (v ? new Date(v).toLocaleDateString('en-GB') : '-');

export default function ReceiveDeliveryChallanPage() {
  const scope = useScope();

  const [rows, setRows] = useState([]);
  const [labels, setLabels] = useState({});
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState(null);
  /* the challan whose lines are open in the popup */
  const [detailRow, setDetailRow] = useState(null);
  const [busy, setBusy] = useState('');
  const [tab, setTab] = useState('received');
  /* returnQty is keyed challanId|barcodeNo so two challans carrying the same
     barcode cannot share a box */
  const [returnQty, setReturnQty] = useState({});

  const label = (id) => labels[String(id)] || '-';

  const load = useCallback(async () => {
    if (!scope.business) { setRows([]); return; }
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        business: scope.business,
        location: scope.location || '',
        finYear: scope.finYear || '',
        view: tab === 'returns' ? 'returns' : 'incoming',
        received: tab === 'received' ? 'yes' : 'no',
        perPage: '100',
      });
      const r = await fetch('/api/ic-receive-delivery-challan?' + qs, { cache: 'no-store' });
      const d = await r.json();
      setRows(Array.isArray(d.rows) ? d.rows : []);
      setLabels(d.labels || {});
    } catch {
      setRows([]);
      setFlash({ type: 'err', msg: 'Could not load incoming challans.' });
    } finally {
      setLoading(false);
    }
  }, [scope.business, scope.location, scope.finYear, tab]);

  useEffect(() => { load(); }, [load]);

  /* A confirmation is about the action just taken, so it should not sit on
     screen afterwards - it read as if every tab had just returned something.
     Errors stay until the next action, since they need acting on. */
  useEffect(() => {
    if (!flash || flash.type !== 'ok') return undefined;
    const timer = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(timer);
  }, [flash]);

  const qtyKey = (row, line) => row._id + '|' + (line.barcodeNo || '');

  /* On the Returns tab this branch can be at EITHER end of the challan, so
     the Business column shows the OTHER party and says which way the goods
     are travelling. */
  const weSent = (row) => String(row.businessId) === String(scope.business);
  const other = (row) => (weSent(row)
    ? { businessId: row.toBusinessId, locationId: row.toLocationId, way: 'coming back to us' }
    : { businessId: row.businessId, locationId: row.locationId, way: 'we returned' });
  const leftToReturn = (line) => (Number(line.qty) || 0) - (Number(line.returnedQty) || 0);

  /* Send back only the lines with a quantity typed against them. */
  async function sendReturn(row) {
    const lines = (row.items || [])
      .map((line) => ({ barcodeNo: line.barcodeNo, qty: Number(returnQty[qtyKey(row, line)]) || 0 }))
      .filter((l) => l.qty > 0);

    if (!lines.length) {
      setFlash({ type: 'err', msg: 'Enter how many to return against a line first.' });
      return;
    }

    setBusy(row._id);
    setFlash(null);
    try {
      const r = await fetch('/api/ic-receive-delivery-challan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row._id, business: scope.business, action: 'return', lines }),
      });
      const d = await r.json();
      if (!r.ok) {
        setFlash({ type: 'err', msg: d.error || 'Could not record the return.' });
        return;
      }
      const total = lines.reduce((a, l) => a + l.qty, 0);
      setFlash({ type: 'ok', msg: 'Returned ' + total + ' from challan ' + (row.dcNo || '') + '.' });
      setReturnQty({});
      load();
    } catch {
      setFlash({ type: 'err', msg: 'Could not record the return.' });
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center border-b border-line pb-2">
        <span className="card-title">Receive Delivery Challans</span>
        <span className="flex-1" />
        <button type="button" className="btn" onClick={load}>
          <Icon name="refresh" size={14} /> Refresh
        </button>
      </div>

      {flash && (
        <div
          className={'mb-3 rounded border px-3 py-2 text-[13px] '
            + (flash.type === 'ok'
              ? 'border-green-300 bg-green-50 text-green-800'
              : 'border-danger bg-[#fdf1f1] text-danger')}
        >
          {flash.msg}
        </div>
      )}

      <div className="mb-3 flex gap-2">
        {[['received', 'Received'], ['returns', 'Returns']].map(([key, text]) => (
          <button
            key={key}
            type="button"
            className={'btn h-8 px-3 text-[12px] ' + (tab === key ? 'btn-primary' : '')}
            onClick={() => { setTab(key); setDetailRow(null); setFlash(null); }}
          >
            {text}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="dt">
          <thead>
            <tr>
              <th>#</th>
              <th>{tab === 'returns' ? 'Business' : 'From Business'}</th>
              <th>DC No</th>
              <th>DC Date</th>
              <th>{tab === 'returns' ? 'Location' : 'From Location'}</th>
              <th className="whitespace-nowrap text-center">Total Qty</th>
              <th className="whitespace-nowrap text-center">Total Value</th>
              <th className="whitespace-nowrap">
                {tab === 'returns' ? 'Returned' : 'Received On'}
              </th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="dt-empty">Loading...</td></tr>}

            {!loading && !scope.business && (
              <tr><td colSpan={9} className="dt-empty">
                Select a Business in the top bar to see what is addressed to it.
              </td></tr>
            )}

            {!loading && scope.business && !rows.length && (
              <tr><td colSpan={9} className="dt-empty">
                {tab === 'returns'
                  ? 'No returns involving this branch.'
                  : 'Nothing received yet.'}
              </td></tr>
            )}

            {!loading && rows.map((row, i) => (
              <tr key={row._id}>
                  <td className="text-center">{i + 1}</td>
                  <td>
                    {label(tab === 'returns' ? other(row).businessId : row.businessId)}
                    {tab === 'returns' && (
                      <div className={'text-[11px] ' + (weSent(row) ? 'text-danger' : 'text-inkmuted')}>
                        {other(row).way}
                      </div>
                    )}
                  </td>
                  <td>{row.dcNo || '-'}</td>
                  <td>{day(row.dcDate)}</td>
                  <td>{label(tab === 'returns' ? other(row).locationId : row.locationId)}</td>
                  <td className="whitespace-nowrap px-3 text-center">{money(row.totalQty)}</td>
                  <td className="whitespace-nowrap px-3 text-center">{money(row.netValue)}</td>
                  <td className="whitespace-nowrap">
                    {tab === 'returns' ? (
                      <span className="font-semibold text-danger">
                        {(row.returns || []).reduce(
                          (a, ev) => a + (ev.lines || []).reduce((n, l) => n + (Number(l.qty) || 0), 0), 0
                        )}
                      </span>
                    ) : day(row.receivedAt)}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="act-btn bg-[#2b7fd4]"
                      title="View"
                      onClick={() => setDetailRow(row)}
                    >
                      <Icon name="eye" size={12} />
                    </button>
                  </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Challan detail.

          Was an inline expanding row; a popup keeps the list compact and gives
          the lines the full width, which matters once the Return Qty column is
          on them. The Return controls live INSIDE here, so returning is done
          from the same place the lines are read. */}
      {detailRow && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
          onMouseDown={() => setDetailRow(null)}
        >
          <div
            className="my-6 w-full max-w-6xl rounded-lg bg-white shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-line px-5 py-3">
              <span className="card-title">Challan {detailRow.dcNo || ''}</span>
              <span className="text-[12px] text-inkmuted">
                {day(detailRow.dcDate)} &middot;{' '}
                {label(tab === 'returns' ? other(detailRow).businessId : detailRow.businessId)}
              </span>
              <span className="flex-1" />
              <button type="button" className="btn" onClick={() => setDetailRow(null)}>Close</button>
            </div>

            <div className="overflow-x-auto p-5">
        <table className="dt">
          <thead>
            <tr>
              <th>Sl No.</th>
              <th>Barcode</th>
              <th>Qty</th>
              <th>UOM</th>
              <th>HSN</th>
              <th>Item Name / Description</th>
              <th>RSP Price</th>
              <th className="text-center">Returned</th>
              {tab === 'received' && <th className="text-center">Return Qty</th>}
            </tr>
          </thead>
          <tbody>
            {!(detailRow.items || []).length && (
              <tr><td colSpan={9} className="dt-empty">No items on this challan.</td></tr>
            )}
            {(detailRow.items || []).map((line, n) => {
              const left = leftToReturn(line);
              return (
                <tr key={n}>
                  <td className="text-center">{n + 1}</td>
                  <td>{line.barcodeNo || '-'}</td>
                  <td className="text-center">{money(line.qty)}</td>
                  <td>{line.uom || '-'}</td>
                  <td>{line.hsn || '-'}</td>
                  <td>{line.itemName || '-'}</td>
                  <td className="text-center">{money(line.unitRate)}</td>
                  <td className="text-center">
                    {Number(line.returnedQty)
                      ? <span className="font-semibold text-danger">{money(line.returnedQty)}</span>
                      : '-'}
                  </td>

                  {/* Only what is left is returnable, so a line
                      cannot be returned twice over. A fully
                      returned line has no box at all. */}
                  {tab === 'received' && (
                    <td className="text-center">
                      {left > 0 ? (
                        <input
                          type="number"
                          min="0"
                          max={left}
                          placeholder={'max ' + left}
                          className="f-input h-8 w-24 text-center"
                          value={returnQty[qtyKey(detailRow, line)] ?? ''}
                          onWheel={(e) => e.currentTarget.blur()}
                          onChange={(e) => {
                            const v = e.target.value;
                            const capped = v === '' ? '' : Math.min(left, Math.max(0, Number(v)));
                            setReturnQty((cur) => ({ ...cur, [qtyKey(detailRow, line)]: capped }));
                          }}
                        />
                      ) : <span className="text-inkmuted">all returned</span>}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {tab === 'received' && (detailRow.items || []).some((l) => leftToReturn(l) > 0) && (
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              className="btn btn-primary h-8 px-3 text-[12px]"
              disabled={busy === detailRow._id}
              onClick={() => sendReturn(detailRow)}
            >
              {busy === detailRow._id
                ? <span className="spin" />
                : <Icon name="undo" size={12} />} Return Damaged
            </button>
            <span className="text-[12px] text-inkmuted">
              Enter the damaged quantity against each line - the rest stays here.
            </span>
          </div>
        )}

        {/* what has already gone back, newest first */}
        {!!(detailRow.returns || []).length && (
          <div className="mt-3 border-t border-line pt-2">
            <div className="mb-1 text-[12px] font-semibold">Returns</div>
            {[...(detailRow.returns || [])].reverse().map((ev, k) => (
              <div key={k} className="text-[12px] text-inkmuted">
                {day(ev.at)}{ev.by ? ' - ' + ev.by : ''}:{' '}
                {(ev.lines || []).map((l) => l.barcodeNo + ' x ' + l.qty).join(', ')}
              </div>
            ))}
          </div>
        )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
