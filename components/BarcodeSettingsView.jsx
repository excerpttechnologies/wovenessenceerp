'use client';
import { useCallback, useEffect, useState } from 'react';
import Icon from './Icon';
import Toolbar from './Toolbar';
import { useScope } from './ScopeContext';
import { fmt, toCsv, toXlsHtml, download, printTable } from '@/lib/format';
import {
  TYPE_OPTS, SUBTYPE_OPTS, PERIOD_FIELDS, NOTE,
  buildPeriods, sampleBarcode, canCopy, COPY_KEYS,
} from '@/app/admin/setting/barcodesetting/fields';

/* ==========================================================================
   Barcode Settings.

   Matches the deployed screen rather than the generic master pattern:

     - the list holds ONE ROW PER PERIOD (12 monthly, 4 quarterly, 1 yearly)
     - ADD opens a full-screen overlay where Barcode Type and Sub Type are
       chosen once and every period of the financial year is filled in below,
       with Copy / Clear to avoid retyping
     - the row edit icon opens a dialog for that single period, with Type and
       Sub Type shown readonly
     - Sample Barcode is derived everywhere, never typed

   ========================================================================== */

const ENDPOINT = '/api/barcode-setting';

const COLUMNS = [
  { k: 'type', t: 'Type' },
  { k: 'subType', t: 'Sub Type' },
  { k: 'prefix', t: 'Prefix' },
  { k: 'suffix', t: 'Suffix' },
  { k: 'startNumber', t: 'Start Number' },
  { k: 'sampleBarcode', t: 'Sample Barcode' },
  { k: 'effectiveDate', t: 'Effective Date', f: 'date' },
  { k: 'expiryDate', t: 'Expiry Date', f: 'date' },
  { k: 'finYear', t: 'Financial Year' },
];

/* One period's inputs. Used by both the add overlay and the edit dialog, so
   the two can never drift apart. */
function PeriodBlock({ legend, period, errors, onChange }) {
  const set = (k, v) => {
    const next = { ...period, [k]: v };
    /* Sample Barcode follows prefix / suffix / start / length automatically */
    next.sampleBarcode = sampleBarcode(next);
    onChange(next);
  };

  return (
    <fieldset className="mb-4 rounded-md border border-line px-4 pb-4 pt-1">
      <legend className="px-2 text-[13.5px] font-semibold text-ink">{legend}</legend>

      <div className="form-grid-4">
        {PERIOD_FIELDS.map((f) => {
          const err = errors?.[f.k];
          const val = period[f.k] ?? '';
          return (
            <div key={f.k}>
              <label className="f-label">
                {f.label}
                {f.req && <span className="f-req">*</span>}
              </label>

              <input
                type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}
                className={'f-input ' + (f.readOnly ? 'bg-[#eff2f7] text-inkmuted' : '')}
                value={val}
                readOnly={f.readOnly}
                /* Sample Barcode is computed - keep it out of the tab order
                   so Enter-to-next-field still walks the form naturally */
                tabIndex={f.readOnly ? -1 : undefined}
                onChange={(e) => {
                  if (f.readOnly) return;
                  const raw = e.target.value;
                  set(f.k, f.type === 'number' ? (raw === '' ? '' : Number(raw)) : raw);
                }}
              />

              {err && <div className="f-err">{err}</div>}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

/* ---------------------------------------------------------------- ADD ---- */

function AddOverlay({ finYear, onClose, onSaved }) {
  const scope = useScope();
  const [type, setType] = useState('Periodic');
  const [subType, setSubType] = useState('Monthly');
  const [periods, setPeriods] = useState(() => buildPeriods('Monthly', finYear));
  const [errors, setErrors] = useState({});
  const [flash, setFlash] = useState(null);
  const [saving, setSaving] = useState(false);

  /* changing the sub type rebuilds the blocks and their date ranges */
  useEffect(() => {
    setPeriods(buildPeriods(subType, finYear));
    setErrors({});
  }, [subType, finYear]);

  const setPeriod = (i, next) =>
    setPeriods((rows) => rows.map((r, ri) => (ri === i ? next : r)));

  /* Copy the first period's settings into every other period. */
  const copyDown = () => {
    setPeriods((rows) => {
      if (!rows.length) return rows;
      const first = rows[0];
      return rows.map((r, i) => {
        if (i === 0) return r;
        const next = { ...r };
        COPY_KEYS.forEach((k) => { next[k] = first[k]; });
        next.sampleBarcode = sampleBarcode(next);
        return next;
      });
    });
  };

  const clearAll = () => {
    setPeriods((rows) => rows.map((r) => {
      const next = { ...r };
      COPY_KEYS.forEach((k) => { next[k] = ''; });
      return next;
    }));
    setErrors({});
  };

  async function submit() {
    setSaving(true);
    setFlash(null);
    try {
      const r = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type, subType, periods,
          business: scope.business, location: scope.location, finYear: scope.finYear,
        }),
      });
      const d = await r.json();

      if (r.status === 422) {
        setErrors(d.errors || {});
        setFlash({ type: 'err', msg: 'Please correct the highlighted fields.' });
        return;
      }
      if (!r.ok) { setFlash({ type: 'err', msg: d.error || 'Save failed' }); return; }

      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-white">
      <div className="flex items-center border-b border-line px-5 py-3">
        <span className="text-[17px] font-bold text-ink">Add Barcode Settings</span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e0342c] text-white"
          title="Close"
        >
          <Icon name="x" size={14} />
        </button>
      </div>

      <div className="px-5 py-4">
        {flash && <div className={'flash ' + (flash.type === 'err' ? 'flash-err' : 'flash-ok')}>{flash.msg}</div>}

        <div className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
          <div>
            <label className="f-label">Barcode Type<span className="f-req">*</span></label>
            <select className="f-input" value={type} onChange={(e) => setType(e.target.value)}>
              {TYPE_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
          <div>
            <label className="f-label">Barcode Sub Type<span className="f-req">*</span></label>
            <select className="f-input" value={subType} onChange={(e) => setSubType(e.target.value)}>
              {SUBTYPE_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-4 text-[13px] text-danger">
          <div className="font-semibold">Copy &amp; Clear buttons helps you avoid repetitive data entry.</div>
          <ol className="mt-1 list-decimal pl-5">
            {NOTE.map((n, i) => <li key={i}>{n}</li>)}
          </ol>
        </div>

        {canCopy(subType) && (
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn" onClick={copyDown}>
              <Icon name="grid" size={13} /> Copy
            </button>
            <button type="button" className="btn" onClick={clearAll}>
              <Icon name="trash" size={13} /> Clear
            </button>
          </div>
        )}

        <div className="mt-4">
          {periods.map((p, i) => (
            <PeriodBlock
              key={p.periodIndex}
              legend={String(subType).toUpperCase() + ' ' + (i + 1)}
              period={p}
              errors={errors[String(p.periodIndex)]}
              onChange={(next) => setPeriod(i, next)}
            />
          ))}
        </div>

        <button
          type="button"
          className="btn btn-primary mx-auto flex h-[38px] w-full max-w-[450px] justify-center"
          onClick={submit}
          disabled={saving}
        >
          {saving ? <span className="spin" /> : <Icon name="save" size={14} />} Submit
        </button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- EDIT ---- */

function EditDialog({ row, onClose, onSaved }) {
  const [period, setPeriod] = useState(() => ({
    prefix: row.prefix || '',
    suffix: row.suffix || '',
    startNumber: row.startNumber ?? '',
    numberLenght: row.numberLenght ?? '',
    sampleBarcode: row.sampleBarcode || '',
    effectiveDate: row.effectiveDate ? String(row.effectiveDate).slice(0, 10) : '',
    expiryDate: row.expiryDate ? String(row.expiryDate).slice(0, 10) : '',
  }));
  const [errors, setErrors] = useState({});
  const [flash, setFlash] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setFlash(null);
    try {
      const r = await fetch(ENDPOINT + '/' + row._id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: period }),
      });
      const d = await r.json();

      if (r.status === 422) {
        setErrors(d.errors || {});
        setFlash({ type: 'err', msg: 'Please correct the highlighted fields.' });
        return;
      }
      if (!r.ok) { setFlash({ type: 'err', msg: d.error || 'Save failed' }); return; }

      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/45 p-4 pt-14"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-[1120px] rounded-lg bg-white shadow-pop"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="relative flex items-center border-b border-line px-4 py-3">
          <span className="text-[15px] font-bold">Edit Barcode Settings</span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-[#e0342c] text-white"
          >
            <Icon name="x" size={13} />
          </button>
        </div>

        <div className="px-4 py-4">
          {flash && <div className={'flash ' + (flash.type === 'err' ? 'flash-err' : 'flash-ok')}>{flash.msg}</div>}

          {/* fixed once created - shown for context, not editable */}
          <div className="mb-3 grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
            <div>
              <label className="f-label">Barcode Type</label>
              <input className="f-input bg-[#eff2f7] text-inkmuted" value={row.type || ''} readOnly />
            </div>
            <div>
              <label className="f-label">Barcode Sub Type</label>
              <input className="f-input bg-[#eff2f7] text-inkmuted" value={row.subType || ''} readOnly />
            </div>
          </div>

          <PeriodBlock
            legend={(row.subType || '') + ' - ' + (row.periodIndex || 1)}
            period={period}
            errors={errors}
            onChange={setPeriod}
          />

          <button
            type="button"
            className="btn btn-primary mx-auto flex h-[38px] w-full max-w-[450px] justify-center"
            onClick={submit}
            disabled={saving}
          >
            {saving ? <span className="spin" /> : <Icon name="save" size={14} />} Submit
          </button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- LIST ---- */

export default function BarcodeSettingsView() {
  const { business, finYear } = useScope();
  const [state, setState] = useState({ rows: [], page: 1, pages: 1, total: 0 });
  const [search, setSearch] = useState('');
  const [hidden, setHidden] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);

  /* HIDING ONLY - the route checks every request for itself. can() answers
     true whenever it does not positively know otherwise, so an ungoverned
     role keeps this screen exactly as it was. This view is not built on
     ListView, so its controls have to be wired by hand. */
  const perms = useScope();
  const SCREEN = '/admin/setting/barcodesetting';
  const mayCreate = perms.can ? perms.can(SCREEN, 'create') : true;
  const mayUpdate = perms.can ? perms.can(SCREEN, 'update') : true;
  const mayDelete = perms.can ? perms.can(SCREEN, 'delete') : true;

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({
      page: String(page), search, business: business || '', finYear: finYear || '',
    });
    try {
      const r = await fetch(ENDPOINT + '?' + qs);
      const d = await r.json();
      setState({
        rows: d.rows || [], page: d.page || 1, pages: d.pages || 1, total: d.total || 0,
      });
    } finally {
      setLoading(false);
    }
  }, [page, search, business, finYear]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, business, finYear]);

  const visible = COLUMNS.filter((c) => !hidden.includes(c.t));
  const cell = (row, col) => (col.f ? fmt(col.f, row[col.k]) : (row[col.k] ?? ''));
  const exportRows = () => state.rows.map((r) => visible.map((c) => cell(r, c)));
  const exportHeaders = () => visible.map((c) => c.t);

  async function remove(id) {
    if (!window.confirm('Delete this record?')) return;
    const r = await fetch(ENDPOINT + '/' + id, { method: 'DELETE' });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      window.alert(d.error || 'Could not delete this record.');
      return;
    }
    load();
  }

  return (
    <>
      {adding && (
        <AddOverlay
          finYear={finYear}
          onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); setPage(1); load(); }}
        />
      )}

      {editing && (
        <EditDialog
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

      <div className="card">
        <div className="card-head">
          <span className="card-title">Barcode Settings</span>
          <span className="flex-1" />
          <button type="button" className="btn btn-ghost" onClick={load}>
            <Icon name="refresh" size={14} /> Refresh
          </button>
        </div>

        <div className="card-body">
          <Toolbar
            columns={COLUMNS}
            hidden={hidden}
            onToggleColumn={(t) =>
              setHidden((h) => (h.includes(t) ? h.filter((x) => x !== t) : [...h, t]))
            }
            search={search}
            onSearch={setSearch}
            onAdd={() => setAdding(true)}
            addDisabled={!mayCreate}
            addDisabledReason="You do not have Create permission for this screen."
            onExportCsv={() =>
              download('barcodesetting.csv', toCsv(exportHeaders(), exportRows()), 'text/csv')
            }
            onExportExcel={() =>
              download(
                'barcodesetting.xls',
                toXlsHtml('Barcode Settings', exportHeaders(), exportRows()),
                'application/vnd.ms-excel'
              )
            }
            onExportPdf={() => printTable('Barcode Settings', exportHeaders(), exportRows())}
          />

          <div className="mt-3 overflow-x-auto">
            <table className="dt">
              <thead>
                <tr>
                  {visible.map((c, i) => <th key={c.t + i}>{c.t}</th>)}
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={visible.length + 1} className="dt-empty"><span className="spin" /></td>
                  </tr>
                )}
                {!loading && state.rows.length === 0 && (
                  <tr>
                    <td colSpan={visible.length + 1} className="dt-empty">No Data..</td>
                  </tr>
                )}
                {!loading && state.rows.map((row) => (
                  <tr key={row._id}>
                    {visible.map((c, i) => <td key={c.t + i}>{cell(row, c)}</td>)}
                    <td>
                      <span className="inline-flex items-center gap-1.5">
                        {mayUpdate && (
                          <button
                            className="act-btn bg-warnyellow"
                            title="Edit"
                            onClick={() => setEditing(row)}
                          >
                            <Icon name="pencil" size={12} />
                          </button>
                        )}
                        {mayDelete && (
                          <button
                            className="act-btn bg-danger"
                            title="Delete"
                            onClick={() => remove(row._id)}
                          >
                            <Icon name="trash" size={12} />
                          </button>
                        )}
                        {!mayUpdate && !mayDelete && (
                          <span className="text-[11px] text-inkmuted">View only</span>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center pt-3 text-[13px] text-cell">
            <span>Page <b className="text-brand-link">{state.page}</b> of {state.pages}</span>
            <span className="flex-1" />
            <span className="flex gap-2">
              <button className="btn" disabled={state.page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </button>
              <button className="btn" disabled={state.page >= state.pages} onClick={() => setPage((p) => p + 1)}>
                Next
              </button>
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
