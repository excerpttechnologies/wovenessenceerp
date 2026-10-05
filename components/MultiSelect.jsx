'use client';
import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';

/* react-select look-alike, written by hand (no library).
   mode="single" renders one value; mode="multi" renders removable chips. */
export default function MultiSelect({
  options = [], value, onChange, mode = 'multi',
  placeholder = 'Select...', disabled = false, loading = false, error = '', emptyText = '', onSearch,
  maxOptions = 200,
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const box = useRef(null);

  useEffect(() => {
    function away(e) { if (box.current && !box.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  const selected = mode === 'multi'
    ? (Array.isArray(value) ? value : []).map((v) => options.find((o) => o.value === v) || { value: v, label: v })
    /* fall back to the raw value the way the multi branch above already
       does - otherwise a value that is not in the currently fetched option
       page renders blank. The PIN code lookup fills City with a name the
       /api/cities page may not contain yet. */
    : options.find((o) => o.value === value) || (value ? { value, label: String(value) } : null);

  const shown = options.filter((o) => {
    if (o.addCustomer) return true;
    if (term && !String(o.label).toLowerCase().includes(term.toLowerCase())) return false;
    if (mode === 'multi') return !(value || []).includes(o.value);
    return true;
  });

  function pick(opt) {
    if (mode === 'multi') { onChange([...(value || []), opt.value]); setTerm(''); onSearch?.(''); }
    else { onChange(opt.value); setOpen(false); setTerm(''); onSearch?.(''); }
  }
  function drop(v) { onChange((value || []).filter((x) => x !== v)); }

  return (
    <div className="relative" ref={box}>
      <div
        className={'ms-control ' + (disabled ? 'bg-[#f2f4f8]' : '')}
        onClick={() => !disabled && setOpen(true)}
      >
        {mode === 'multi' && selected.map((s) => (
          <span key={s.value} className="ms-chip">
            {s.label}
            <button type="button" onClick={(e) => { e.stopPropagation(); drop(s.value); }}>
              <Icon name="x" size={11} />
            </button>
          </span>
        ))}

        {mode === 'single' && selected && !open && (
          <span className="px-1 text-[13.5px] text-ink">{selected.label}</span>
        )}

        <input
          className="ms-input"
          value={term}
          disabled={disabled}
          placeholder={(mode === 'multi' ? selected.length : selected) ? '' : placeholder}
          onChange={(e) => { setTerm(e.target.value); onSearch?.(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />

        {(mode === 'single' ? selected : selected.length > 0) && !disabled && (
          <button
            type="button"
            className="text-[#9aa6ba]"
            onClick={(e) => { e.stopPropagation(); onChange(mode === 'multi' ? [] : ''); setTerm(''); onSearch?.(''); }}
          >
            <Icon name="x" size={13} />
          </button>
        )}
        <span className="border-l border-line px-1 text-[#9aa6ba]"><Icon name="chevD" size={14} /></span>
      </div>

      {open && !disabled && (
        <div className="ms-menu">
          {loading && <div className="px-2.5 py-2.5 text-[13px] text-inkmuted">Loading...</div>}
          {/* A failed request said "No options", which reads as "there are
              none" - the operator then goes looking for missing master data
              instead of retrying. The three states are now distinct. */}
          {!loading && error && (
            <div className="px-2.5 py-2.5 text-[13px] text-danger">{error}</div>
          )}
          {!loading && !error && shown.length === 0 && (
            <div className="px-2.5 py-2.5 text-[13px] text-inkmuted">{emptyText || 'No options'}</div>
          )}
          {shown.slice(0, maxOptions).map((o) => (
            <div key={o.value} className={'ms-opt ' + (o.addCustomer ? 'flex items-center gap-2 text-brand' : '')} onClick={() => pick(o)}>
              {o.addCustomer && <Icon name="plus" size={14} />}
              <span>{o.label}</span>
              {o.sub && <span className="block text-[11.5px] text-inkmuted">{o.sub}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
