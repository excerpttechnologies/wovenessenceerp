'use client';
import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { useScope } from '@/components/ScopeContext';

/* Inter Company Sell > Consignment - the RETURNS of inter company challans,
   on a page of their own (user, 01-10-2026; this list used to be the
   Returns tab inside Receive Delivery Challan).

   Every challan with a return that the branch in the top bar is PART OF,
   whichever end it stands at: ones it sent that are coming back, and ones
   it received and returned from. The Business column names the OTHER party
   and says which way the goods are travelling.

   Since the two-step return (01-10-2026) this page is ALSO where the
   SENDER acts: the receiver's return requests wait in the Pending section
   on top, and Approve here is what actually moves the stock back - Reject
   closes the request and moves nothing. The receiver raises requests on
   Receive Delivery Challan, inside a received challan's popup.

   Same endpoint as that screen (view=returns), so this page answers to the
   same permission. */

const money = (v) => Number(v || 0).toFixed(2);
const day = (v) => (v ? new Date(v).toLocaleDateString('en-GB') : '-');

export default function IcConsignmentPage() {
  const scope = useScope();
  const [rows, setRows] = useState([]);
  const [labels, setLabels] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  /* the challan whose return lines are open in the popup */
  const [detailRow, setDetailRow] = useState(null);
  const [flash, setFlash] = useState(null);
  const [busy, setBusy] = useState('');

  const label = (id) => labels[String(id)] || '-';

  const load = useCallback(async () => {
    if (!scope.business) { setRows([]); return; }
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({
        business: scope.business,
        finYear: scope.finYear || '',
        view: 'returns',
        received: 'no',
        perPage: '100',
      });
      const r = await fetch('/api/ic-receive-delivery-challan?' + qs, { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Could not load the returns.'); setRows([]); return; }
      setRows(Array.isArray(d.rows) ? d.rows : []);
      setLabels(d.labels || {});
    } catch {
      setError('Could not reach the server.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [scope.business, scope.finYear]);

  useEffect(() => { load(); }, [load]);

  /* which end of the challan this branch stands at decides who the OTHER
     party is and which way the goods travel */
  const weSent = (row) => String(row.businessId) === String(scope.business);
  const other = (row) => (weSent(row)
    ? { businessId: row.toBusinessId, locationId: row.toLocationId, way: 'coming back to us' }
    : { businessId: row.businessId, locationId: row.locationId, way: 'we returned' });

  const returnedOf = (row) => (row.returns || []).reduce(
    (a, ev) => a + (ev.lines || []).reduce((n, l) => n + (Number(l.qty) || 0), 0), 0
  );

  /* every OPEN request across the loaded challans, one row each - the
     sender's work to do, the receiver's asks in flight */
  const pendingRequests = rows.flatMap((row) =>
    (row.returnRequests || [])
      .filter((r) => r.status === 'pending')
      .map((req) => ({ row, req })));

  async function act(row, req, action) {
    const key = row._id + '|' + req.rid;
    setBusy(key);
    setFlash(null);
    try {
      const r = await fetch('/api/ic-receive-delivery-challan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row._id, business: scope.business, action, rid: req.rid }),
      });
      const d = await r.json();
      if (!r.ok) { setFlash({ type: 'err', msg: d.error || 'Could not do that.' }); return; }
      setFlash({
        type: 'ok',
        msg: action === 'approve-return'
          ? 'Request approved - the goods are back in this branch\'s stock (challan ' + (row.dcNo || '') + ').'
          : 'Request rejected - nothing moved (challan ' + (row.dcNo || '') + ').',
      });
      load();
    } catch {
      setFlash({ type: 'err', msg: 'Could not reach the server.' });
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center border-b border-line pb-2">
        <span className="card-title">Consignment Returns</span>
        <span className="flex-1" />
        <button type="button" className="btn" onClick={load}>
          <Icon name="refresh" size={14} /> Refresh
        </button>
      </div>

      {error && <div className="mb-3 flash flash-err">{error}</div>}
      {flash && (
        <div className={'mb-3 flash ' + (flash.type === 'err' ? 'flash-err' : 'flash-ok')}>{flash.msg}</div>
      )}

      {/* ------------------------------------- PENDING RETURN REQUESTS --
          the handshake's open asks. The SENDER sees Approve / Reject;
          the branch that asked sees where its request stands. */}
      <div className="mb-2 flex items-center border-b border-line pb-2">
        <span className="card-title">Pending Return Requests</span>
        {pendingRequests.length > 0 && (
          <span className="ml-2 rounded bg-[#fff3cd] px-2 py-0.5 text-[11.5px] font-semibold text-warnyellow">
            {pendingRequests.length} awaiting approval
          </span>
        )}
      </div>
      <div className="mb-5 overflow-x-auto">
        <table className="dt">
          <thead>
            <tr>
              <th style={{ width: 36 }}>#</th>
              <th>Business</th>
              <th style={{ width: 150 }}>DC No</th>
              <th style={{ width: 110 }}>Requested On</th>
              <th style={{ width: 140 }}>Requested By</th>
              <th>Items</th>
              <th className="!text-right" style={{ width: 70 }}>Qty</th>
              <th style={{ width: 170 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="dt-empty">Loading...</td></tr>}
            {!loading && !pendingRequests.length && (
              <tr><td colSpan={8} className="dt-empty">No return requests waiting.</td></tr>
            )}
            {!loading && pendingRequests.map(({ row, req }, i) => (
              <tr key={row._id + '|' + req.rid} className="bg-[#fff8e6]">
                <td className="text-center">{i + 1}</td>
                <td>
                  {label(other(row).businessId)}
                  <div className={'text-[11px] ' + (weSent(row) ? 'text-danger' : 'text-inkmuted')}>
                    {weSent(row) ? 'they want to send back' : 'our request'}
                  </div>
                </td>
                <td>{row.dcNo || '-'}</td>
                <td>{day(req.at)}</td>
                <td>{req.by || '-'}</td>
                <td className="text-[12px]">
                  {(req.lines || []).map((l) => l.barcodeNo + ' x ' + l.qty).join(', ')}
                </td>
                <td className="!text-right font-semibold">
                  {(req.lines || []).reduce((a, l) => a + (Number(l.qty) || 0), 0)}
                </td>
                <td>
                  {weSent(row) ? (
                    <span className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        className="btn btn-primary h-7 px-2.5 text-[12px] disabled:opacity-50"
                        disabled={busy === row._id + '|' + req.rid}
                        onClick={() => act(row, req, 'approve-return')}
                      >
                        <Icon name="check" size={12} /> Approve
                      </button>
                      <button
                        type="button"
                        className="btn h-7 border-danger bg-danger px-2.5 text-[12px] text-white hover:border-[#9f1d17] hover:bg-[#9f1d17] disabled:opacity-50"
                        disabled={busy === row._id + '|' + req.rid}
                        onClick={() => act(row, req, 'reject-return')}
                      >
                        <Icon name="x" size={12} /> Reject
                      </button>
                    </span>
                  ) : (
                    <span className="text-[12px] font-semibold text-warnyellow">Awaiting sender approval</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-2 flex items-center border-b border-line pb-2">
        <span className="card-title">Returns</span>
      </div>
      <div className="overflow-x-auto">
        <table className="dt">
          <thead>
            <tr>
              <th style={{ width: 36 }}>#</th>
              <th>Business</th>
              <th style={{ width: 150 }}>DC No</th>
              <th style={{ width: 100 }}>DC Date</th>
              <th>Location</th>
              <th className="!text-right" style={{ width: 90 }}>Total Qty</th>
              <th className="!text-right" style={{ width: 100 }}>Total Value</th>
              <th className="!text-right" style={{ width: 90 }}>Returned</th>
              <th style={{ width: 70 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="dt-empty">Loading...</td></tr>}
            {!loading && !scope.business && (
              <tr><td colSpan={9} className="dt-empty">Select a Business in the top bar.</td></tr>
            )}
            {!loading && scope.business && !rows.length && (
              <tr><td colSpan={9} className="dt-empty">No returns involving this branch.</td></tr>
            )}
            {!loading && rows.map((row, i) => (
              <tr key={row._id}>
                <td className="text-center">{i + 1}</td>
                <td>
                  {label(other(row).businessId)}
                  <div className={'text-[11px] ' + (weSent(row) ? 'text-danger' : 'text-inkmuted')}>
                    {other(row).way}
                  </div>
                </td>
                <td>{row.dcNo || '-'}</td>
                <td>{day(row.dcDate)}</td>
                <td>{label(other(row).locationId)}</td>
                <td className="!text-right">{money(row.totalQty)}</td>
                <td className="!text-right">{money(row.netValue)}</td>
                <td className="!text-right">
                  {(() => {
                    /* a challan can sit in this list on the strength of its
                       REQUESTS alone - a bare 0 there read as if a return
                       happened and brought nothing back. Say what actually
                       stands instead. */
                    const returned = returnedOf(row);
                    const reqs = row.returnRequests || [];
                    const pending = reqs.filter((r) => r.status === 'pending').length;
                    const rejected = reqs.filter((r) => r.status === 'rejected').length;
                    if (!returned && pending) return <span className="whitespace-nowrap text-[12px] font-semibold text-warnyellow">Awaiting approval</span>;
                    if (!returned && rejected) return <span className="text-[12px] font-semibold text-danger">Rejected</span>;
                    return (
                      <>
                        <span className="font-semibold text-danger">{returned}</span>
                        {rejected > 0 && (
                          <div className="whitespace-nowrap text-[11px] text-danger">{rejected} request(s) rejected</div>
                        )}
                      </>
                    );
                  })()}
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

      {/* the challan's lines and its return history - read only */}
      {detailRow && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
          onMouseDown={() => setDetailRow(null)}
        >
          <div
            className="my-6 w-full max-w-5xl rounded-lg bg-white shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-line px-5 py-3">
              <span className="card-title">Challan {detailRow.dcNo || ''}</span>
              <span className="text-[12px] text-inkmuted">
                {day(detailRow.dcDate)} &middot; {label(other(detailRow).businessId)}
                {' - '}{other(detailRow).way}
              </span>
              <span className="flex-1" />
              <button type="button" className="btn" onClick={() => setDetailRow(null)}>Close</button>
            </div>

            <div className="overflow-x-auto p-5">
              <table className="dt">
                <thead>
                  <tr>
                    <th style={{ width: 50 }}>Sl No.</th>
                    <th>Barcode</th>
                    <th className="!text-right" style={{ width: 70 }}>Qty</th>
                    <th style={{ width: 70 }}>UOM</th>
                    <th style={{ width: 100 }}>HSN</th>
                    <th>Item Name / Description</th>
                    <th className="!text-right" style={{ width: 90 }}>RSP Price</th>
                    <th className="!text-right" style={{ width: 90 }}>Returned</th>
                  </tr>
                </thead>
                <tbody>
                  {!(detailRow.items || []).length && (
                    <tr><td colSpan={8} className="dt-empty">No items on this challan.</td></tr>
                  )}
                  {(detailRow.items || []).map((line, n) => (
                    <tr key={n}>
                      <td className="text-center">{n + 1}</td>
                      <td>{line.barcodeNo || '-'}</td>
                      <td className="!text-right">{money(line.qty)}</td>
                      <td>{line.uom || '-'}</td>
                      <td>{line.hsn || '-'}</td>
                      <td>{line.itemName || '-'}</td>
                      <td className="!text-right">{money(line.unitRate)}</td>
                      <td className="!text-right">
                        {Number(line.returnedQty)
                          ? <span className="font-semibold text-danger">{money(line.returnedQty)}</span>
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* what went back, newest first */}
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
