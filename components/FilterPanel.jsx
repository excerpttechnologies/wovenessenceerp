'use client';
import { useState } from 'react';
import Icon from './Icon';
import MultiSelect from './MultiSelect';
import { useOptions } from './useOptions';

function RefFilter({ f, value, onChange }) {
  const { options, loading } = useOptions(f.ref);
  return (
    <MultiSelect
      mode="single" options={options} loading={loading}
      value={value || ''} placeholder={f.placeholder || 'Select...'} onChange={onChange}
    />
  );
}

/* A filter spec may carry `def` - the value its box OPENS with, applied to
   the very first load as well, so a screen can start on today's data
   (def: 'today'). Shared with ListView, which seeds its applied filters from
   the same specs; without that the boxes would show today while the list
   ignored it until Search was pressed. */
export function filterDefaults(filters) {
  const out = {};
  (filters || []).forEach((f) => {
    if (f.def === undefined) return;
    if (f.def === 'today') {
      const d = new Date();
      const p = (n) => String(n).padStart(2, '0');
      out[f.k] = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    } else {
      out[f.k] = f.def;
    }
  });
  return out;
}

/* The Filter card that sits ABOVE the list card on every transaction page.
   Values are held locally and only applied when Search is pressed, which is
   how the original behaves. */
export default function FilterPanel({ filters, onSearch }) {
  const [draft, setDraft] = useState(() => filterDefaults(filters));
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title"><Icon name="filter" size={15} /> Filter</span>
      </div>
      <div className="card-body">
        <div className="grid grid-cols-1 items-end gap-x-[22px] gap-y-3.5 md:grid-cols-2 xl:grid-cols-4">
          {filters.map((f) => (
            <div key={f.k}>
              <label className="f-label">{f.label}</label>
              {f.type === 'ref'
                ? <RefFilter f={f} value={draft[f.k]} onChange={(v) => set(f.k, v)} />
                : (
                  <input
                    type={f.type === 'date' ? 'date' : 'text'}
                    className="f-input"
                    placeholder={f.type === 'date' ? 'dd-mm-yyyy' : ''}
                    value={draft[f.k] || ''}
                    onChange={(e) => set(f.k, e.target.value)}
                  />
                )}
            </div>
          ))}
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary h-9 flex-1 justify-center" onClick={() => onSearch(draft)}>
              Search
            </button>
            {/* back to the screen's defaults - empties the boxes AND
                re-runs the list, so a filtered list cannot sit behind
                empty-looking boxes */}
            <button
              type="button"
              className="btn h-9 justify-center"
              onClick={() => { const d = filterDefaults(filters); setDraft(d); onSearch(d); }}
            >
              <Icon name="refresh" size={14} /> Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
