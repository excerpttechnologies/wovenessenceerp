'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from './Icon';
import Field from './Field';
import ModalForm from './ModalForm';
import MultiSelect from './MultiSelect';
import { useScope } from './ScopeContext';
import { refreshOptions, useOptions } from './useOptions';

/* ==========================================================================
   Generic add / edit form.

   The page passes its own cfg (fields, endpoint, base path). No registry.

   Fixes carried in from the audit:
     - the redirect after save was hardcoded to '/admin/setting/' + slug, so
       saving an Inventory Item landed on "Page not registered". It now uses
       cfg.basePath + cfg.slugPath.
     - create is POST <endpoint>, update is PUT <endpoint>/<id>.

   ========================================================================== */

function defaults(cfg) {
  const d = {};
  (cfg.fields || []).forEach((f) => {
    d[f.k] = f.def !== undefined
      ? f.def
      : (f.type === 'multicity' || f.type === 'multiref' ? [] : '');
  });
  if (cfg.rowsTable) d[cfg.rowsTable.key] = [];
  return d;
}

/* Repeatable row table - HSN tax slabs */
function RowsTable({ spec, rows, onChange, locked }) {
  const refCol = spec.cols.find((c) => c.type === 'ref');
  const { options, loading, error } = useOptions(refCol ? refCol.ref : null);

  const add = () => onChange([...rows, Object.fromEntries(spec.cols.map((c) => [c.k, '']))]);
  const setCell = (i, k, v) => onChange(rows.map((r, ri) => (ri === i ? { ...r, [k]: v } : r)));
  const drop = (i) => onChange(rows.filter((_, ri) => ri !== i));

  /* A SAVED REFERENCE THE OPTION LIST DOES NOT CONTAIN.

     The row holds an id - a tax's ObjectId - and the list is fetched for the
     business currently selected in the top bar. When the two do not meet (the
     tax was deleted, or it belongs to another business), MultiSelect falls
     back to showing the raw id, which reads as a corrupted record rather than
     as what it is. Saying so keeps the operator from picking another tax "to
     fix it" and overwriting a reference that was right all along.

     Only once the list has actually arrived: while it is loading, or if the
     request failed, nothing is known about the value yet. */
  const unresolved = (value) => Boolean(value)
    && !loading && !error && options.length > 0
    && !options.some((o) => String(o.value) === String(value));

  /* WHY THERE ARE NO ROWS.

     "No rows" alone reads as a page that failed to load its data, which is
     exactly how an HSN saved without tax slabs was being read. On edit the
     table is locked - slabs can only be added while a record is being created
     - so an empty one is not something the operator can act on here, and the
     table says that rather than leaving them looking for the missing rows. */
  const emptyText = locked
    ? 'No ' + spec.title.toLowerCase() + ' were recorded when this record was created. They can only be'
      + ' added while creating a record, so there is nothing to edit here.'
    : 'No rows yet - use Add Row below.';

  return (
    <div className="form-section">
      <div className="form-section-title">{spec.title}</div>
      {spec.info && (
        <div className="info-box">
          <div className="flex items-center gap-1.5 font-bold"><Icon name="eye" size={14} /> Info</div>
          <ol className="list-decimal pl-5">
            {spec.info.map((t, i) => <li key={i} dangerouslySetInnerHTML={{ __html: t }} />)}
          </ol>
        </div>
      )}
      <table className="dt">
        <thead>
          <tr>
            {spec.cols.map((c) => (
              <th key={c.k}>{c.label}{c.req && <span className="f-req">*</span>}</th>
            ))}
            <th style={{ width: 60 }} />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={spec.cols.length + 1} className="dt-empty">{emptyText}</td></tr>}
          {rows.map((r, i) => (
            <tr key={i}>
              {spec.cols.map((c) => (
                <td key={c.k}>
                  {c.type === 'ref' ? (
                    <>
                      {/* The saved id is handed straight to the control and
                          matched against the option list by value, so the tax
                          stored on the row is the one shown as selected - the
                          label is never what is compared or stored. */}
                      <MultiSelect
                        mode="single"
                        options={options}
                        loading={loading}
                        error={error ? 'Unable to load options' : ''}
                        value={r[c.k] || ''}
                        placeholder="Select..."
                        emptyText="No options available"
                        onChange={(v) => setCell(i, c.k, v)}
                      />
                      {unresolved(r[c.k]) && (
                        <div className="f-err">
                          The saved {c.label} is not in this list - it was deleted, or it belongs to
                          another business than the one selected. Leave it as it is to keep the
                          stored value.
                        </div>
                      )}
                    </>
                  ) : (
                    <input
                      type={c.type === 'number' ? 'number' : 'text'}
                      className="f-input"
                      value={r[c.k] ?? ''}
                      onChange={(e) => setCell(i, c.k, c.type === 'number' ? Number(e.target.value) : e.target.value)}
                    />
                  )}
                </td>
              ))}
              <td>
                {!locked && (
                  <button type="button" className="act-btn bg-danger" onClick={() => drop(i)}>
                    <Icon name="trash" size={12} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!locked && (
        <button type="button" className="btn mt-3" onClick={add}><Icon name="plus" size={13} /> Add Row</button>
      )}
    </div>
  );
}

export default function FormView({ cfg, id, slug }) {
  const router = useRouter();
  const scope = useScope();
  const [data, setData] = useState(() => defaults(cfg));
  const [errors, setErrors] = useState({});
  const [flash, setFlash] = useState(null);
  const [saving, setSaving] = useState(false);
  const [quickAddField, setQuickAddField] = useState(null);
  const { options: uomOptions } = useOptions('uom');
  const uniqueBarcodeTouched = useRef(false);
  const uomDefaultApplied = useRef(false);
  const isEdit = Boolean(id);
  const quickAdd = quickAddField ? cfg.quickAdds?.[quickAddField] : null;

  const slugPath = cfg.slugPath || slug;
  const listUrl = (cfg.basePath || '/admin/setting/') + slugPath;

  /* Same rule as ListView and TabbedFormView: editing needs update, a new
     record needs create. The route refuses either way - this only stops the
     operator filling in a form to be told no at the end. */
  const maySave = scope.can ? scope.can(listUrl, id ? 'update' : 'create') : true;
  const noSaveReason = id
    ? 'You do not have Update permission for this screen.'
    : 'You do not have Create permission for this screen.';

  useEffect(() => {
    if (!id) return;
    fetch(cfg.endpoint + '/' + id)
      .then((r) => r.json())
      .then((d) => {
        if (!d.doc) return;
        setData((prev) => {
          const next = { ...prev };
          Object.keys(next).forEach((k) => {
            const v = d.doc[k];
            if (v === null || v === undefined) return;
            next[k] = cfg.fields?.find((f) => f.k === k)?.type === 'ref' ? String(v) : v;
          });
          if (cfg.rowsTable) next[cfg.rowsTable.key] = d.doc[cfg.rowsTable.key] || [];
          return next;
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, slugPath]);

  const set = (k, v) => {
    if (k === 'uniqueBarcode') uniqueBarcodeTouched.current = true;
    if (k === 'uomId' && !isEdit && !uomDefaultApplied.current && !uniqueBarcodeTouched.current) {
      const selected = uomOptions.find((option) => String(option.value) === String(v));
      const uomName = String(selected?.label || '').toLowerCase();
      if (/\b(piece|pcs?|pc)\b/.test(uomName)) {
        setData((d) => ({ ...d, [k]: v, uniqueBarcode: 'Yes' }));
        uomDefaultApplied.current = true;
        return;
      }
      if (/\b(metre|meter|mtr|meters|metres)\b/.test(uomName)) {
        setData((d) => ({ ...d, [k]: v, uniqueBarcode: 'No' }));
        uomDefaultApplied.current = true;
        return;
      }
    }
    setData((d) => ({ ...d, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));
  };

  async function submit() {
    setSaving(true);
    setFlash(null);
    try {
      const payload = {
        data,
        business: scope.business,
        location: scope.location,
        finYear: scope.finYear,
      };

      const r = await fetch(cfg.endpoint + (id ? '/' + id : ''), {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const d = await r.json();
      if (r.status === 422) {
        setErrors(d.errors || {});
        setFlash({ type: 'err', msg: 'Please correct the highlighted fields.' });
        return;
      }
      if (!r.ok) { setFlash({ type: 'err', msg: d.error || 'Save failed' }); return; }

      router.push(listUrl);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {quickAdd && (
        <ModalForm
          cfg={quickAdd}
          slug={quickAdd.slug || quickAddField}
          onClose={() => setQuickAddField(null)}
          onSaved={(result) => {
            setQuickAddField(null);
            set(quickAddField, result.id);
            refreshOptions(quickAdd.ref || quickAdd.slug || quickAddField);
          }}
        />
      )}
      <div className="card">
      <div className="card-head">
        <span className="card-title">
          {cfg.addTitle || (isEdit ? 'Edit ' : 'Add ') + cfg.title}
        </span>
      </div>

      <div className="card-body">
        {flash && <div className={'flash ' + (flash.type === 'err' ? 'flash-err' : 'flash-ok')}>{flash.msg}</div>}

        {cfg.note && (
          <div className="note-box">
            {cfg.note.map((n, i) => <div key={i}>{n}</div>)}
          </div>
        )}

        <div className="form-grid">
          {(cfg.fields || []).map((f) => {
            const add = cfg.quickAdds?.[f.k];
            return (
              <div key={f.k} className={add ? 'flex items-end gap-1.5' : ''}>
                <div className={add ? 'min-w-0 flex-1' : ''}>
                  <Field f={f} value={data[f.k]} error={errors[f.k]} onChange={set} />
                </div>
                {add && (
                  <button
                    type="button"
                    title={add.label || 'Add'}
                    aria-label={add.label || 'Add'}
                    className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand text-white hover:opacity-90"
                    onClick={() => setQuickAddField(f.k)}
                  >
                    <Icon name="plus" size={15} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {cfg.rowsTable && (
          <RowsTable
            spec={cfg.rowsTable}
            rows={data[cfg.rowsTable.key] || []}
            onChange={(rows) => set(cfg.rowsTable.key, rows)}
          />
        )}

        {cfg.extraFormButton && (
          <div className="mt-3">
            <button type="button" className="btn bg-[#eceff4] text-inkmuted" disabled>
              {cfg.extraFormButton}
            </button>
          </div>
        )}

        <button
          type="button"
          className="btn btn-primary btn-submit disabled:cursor-not-allowed disabled:opacity-50"
          onClick={submit}
          disabled={saving || !maySave}
          title={!maySave ? noSaveReason : undefined}
        >
          {saving ? <span className="spin" /> : <Icon name="save" size={14} />} Submit
        </button>
        {!maySave && <span className="ml-2 text-[12px] text-danger">{noSaveReason}</span>}
      </div>
      </div>
    </>
  );
}
