'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import MultiSelect from './MultiSelect';
import { useScope } from './ScopeContext';
import { useOptions } from './useOptions';
import { fmt, toCsv, toXlsHtml, download, printTable } from '@/lib/format';

/* ==========================================================================
   Generic report screen.

   Every report is a filter card over one or more read-only tables, so they
   share this component and differ only by their spec in
   app/admin/reports/<slug>/fields.js - the same arrangement ListView has for
   lists and LedgerTransactionView has for the derived ledger.

   Not built on ListView on purpose: a report has no ADD button, no row
   actions, required filters that gate the query, several tables on one
   screen, tabs, a totals row, a grand total, and stat tiles. ListView
   expresses none of those.

   Filter values are held locally and applied only when Search is pressed,
   which is how every other filter card in this project behaves.

   Four optional shapes a spec can ask for:

     tabs             two or more views over the same filters. The active tab
                      is sent to the API as `tab`, and each tab carries its
                      own tiles and sections (POS Report: Bill-wise / Item-wise).
     dynamicSections  the API decides how many tables come back and names each
                      one - used where rows are grouped by something that is
                      only known at read time, like Sales Person grouping by
                      location.
     grandTotal       a separate totals table under the last table, for reports
                      that total across their groups.
     searchOnly       stay empty until Search is pressed.
   ========================================================================== */

/* Date defaults, so a report opens on a sensible window rather than empty.
   The deployed screens open on "last month -> today". */
function defaultValue(f) {
  if (f.def === 'today') return new Date().toISOString().slice(0, 10);
  if (f.def === '-1month') {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  }
  return f.def !== undefined ? f.def : '';
}

const blankFilters = (spec) =>
  (spec.filters || []).reduce((a, f) => ({ ...a, [f.k]: defaultValue(f) }), {});

/* Which filter fields start on screen: required ones (Search enforces them
   anyway, so hiding them would just make the error message a surprise) plus
   any that open with a real default value (e.g. a date range pre-filled to
   "last month -> today"). Everything else stays tucked behind "Add Filter"
   until picked, which is what keeps a 20+ filter report like Master Stock
   Report from opening as a wall of empty boxes. */
const initialVisible = (spec) => {
  const blanks = blankFilters(spec);
  return new Set(
    (spec.filters || [])
      .filter((f) => f.req || (Array.isArray(blanks[f.k]) ? blanks[f.k].length : blanks[f.k]))
      .map((f) => f.k)
  );
};

const isNumeric = (col) => col.f === 'amount' || col.f === 'count' || col.num;

/* Written as literal class strings: Tailwind scans source text, so a class
   built at runtime (`xl:grid-cols-${n}`) would never be generated. */
const TILE_COLS = {
  3: 'xl:grid-cols-3',
  4: 'xl:grid-cols-4',
  5: 'xl:grid-cols-5',
  6: 'xl:grid-cols-6',
};

const cellOf = (row, col) => {
  const raw = col.value ? col.value(row) : row[col.k];
  return col.f ? fmt(col.f, raw) : (raw ?? '');
};

/* A ref filter needs its own option list, so it is its own component -
   useOptions is a hook and cannot run inside a map. */
function RefFilter({ f, value, onChange }) {
  const { options, loading } = useOptions(f.ref);
  return (
    <MultiSelect
      mode={f.multi ? 'multi' : 'single'}
      options={options}
      loading={loading}
      value={f.multi ? (value || []) : (value || '')}
      placeholder={f.all || 'Select...'}
      onChange={onChange}
    />
  );
}

function Filter({ f, value, onChange }) {
  if (f.type === 'ref') return <RefFilter f={f} value={value} onChange={onChange} />;

  if (f.type === 'select') {
    return (
      <select className="f-input" value={value || ''} onChange={(e) => onChange(e.target.value)}>
        {/* the "all" option is what clears the filter, so a required select
            must not offer it - otherwise it reads as a second copy of its
            own default */}
        {!f.req && <option value="">{f.all || 'Select...'}</option>}
        {(f.opts || []).map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    );
  }

  return (
    <input
      type={f.type === 'date' ? 'date' : 'text'}
      className="f-input"
      placeholder={f.placeholder || ''}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/* The "+ Add Filter" control: a button that opens a plain list of every
   filter not currently on screen, clicking one adds it. Closes on an outside
   click the same way MultiSelect's own menu does. */
function AddFilterMenu({ filters, visible, onAdd }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    function away(e) { if (box.current && !box.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  const hidden = filters.filter((f) => !visible.has(f.k));
  if (!hidden.length) return null;

  return (
    <div className="relative" ref={box}>
      <button type="button" className="btn" onClick={() => setOpen((o) => !o)}>
        <Icon name="plus" size={14} /> Add Filter
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-[45] max-h-72 w-64 overflow-auto rounded-md border border-linestrong bg-white shadow-pop">
          {hidden.map((f) => (
            <div
              key={f.k}
              className="ms-opt"
              onClick={() => { onAdd(f.k); setOpen(false); }}
            >
              {f.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* A thumbnail that pops up a larger preview, centred on screen, on hover. The
   table body scrolls with `overflow-x-auto` (Section, below), and the Image
   column sits at its right edge - an absolutely positioned popup would be
   clipped by that scroll container the moment it crossed its edge. Fixed
   positioning with a dimmed backdrop escapes that clipping and keeps the
   preview in the same, predictable spot regardless of which row or how far
   the table is scrolled. */
const PREVIEW = 320;
function HoverImage({ src, alt }) {
  const [hover, setHover] = useState(false);

  if (!src) return <span className="text-cell">—</span>;

  return (
    <>
      <img
        src={src}
        alt={alt || ''}
        className="h-10 w-10 cursor-zoom-in rounded border border-line object-cover"
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      />
      {hover && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <img
            src={src}
            alt={alt || ''}
            style={{ width: PREVIEW, height: PREVIEW }}
            className="rounded-lg border border-line bg-white object-cover shadow-xl"
          />
        </div>
      )}
    </>
  );
}

/* One result table. `columns[].total` marks a column the totals row sums; the
   server sends its own totals so the figure covers the whole result set
   rather than just the visible page. */
function Section({ section, data, tone }) {
  const columns = section.columns || [];
  const rows = data?.rows || [];
  const totals = data?.totals || {};

  return (
    <div className="card">
      {section.title && (
        <div
          className={
            'card-head '
            + (tone === 'green' ? 'bg-okgreen text-white' : '')
          }
        >
          <span className="card-title">
            {tone === 'green' && <Icon name="chart" size={15} />}
            {section.title}
          </span>
          {data?.count !== undefined && tone !== 'green' && (
            <span className="pill pill-blue">{data.count} records</span>
          )}
        </div>
      )}
      <div className="card-body">
        <div className="overflow-x-auto">
          <table className="dt">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.t} className={isNumeric(c) ? 'text-right' : ''}>{c.t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="dt-empty">No data found</td>
                </tr>
              )}
              {rows.map((row, i) => (
                <tr key={row._id || i}>
                  {columns.map((c) => (
                    <td key={c.t} className={isNumeric(c) ? 'text-right' : ''}>
                      {c.f === 'image' ? <HoverImage src={row[c.k]} /> : cellOf(row, c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {section.totalsRow && (
              <tfoot>
                <tr className="font-bold">
                  {columns.map((c, i) => (
                    <td key={c.t} className={isNumeric(c) ? 'text-right' : ''}>
                      {i === 0 ? 'Total' : (c.total ? fmt('amount', totals[c.k] ?? 0) : '')}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

/* The standalone totals table some reports print under their groups, so the
   figure covers every group rather than the one table above it. */
function GrandTotal({ columns, totals }) {
  return (
    <div className="card">
      <div className="card-body">
        <table className="dt">
          <thead>
            <tr>
              <th />
              {columns.map((c) => (
                <th key={c.t} className={isNumeric(c) ? 'text-right' : ''}>{c.t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="font-bold">
              <td>Total</td>
              {columns.map((c) => (
                <td key={c.t} className={isNumeric(c) ? 'text-right' : ''}>
                  {fmt(c.f || 'amount', (totals || {})[c.k] ?? 0)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ReportView({ spec }) {
  const { business, location, finYear } = useScope();

  const [draft, setDraft] = useState(() => blankFilters(spec));
  const [applied, setApplied] = useState(() => blankFilters(spec));
  /* which filter fields are on screen right now - see initialVisible() */
  const [visible, setVisible] = useState(() => initialVisible(spec));
  const [tab, setTab] = useState(spec.tabs?.[0]?.k || '');
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  /* a searchOnly report shows nothing until its required filter is filled in,
     matching the deployed screen's empty initial state */
  const [searched, setSearched] = useState(!spec.searchOnly);

  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const required = (spec.filters || []).filter((f) => f.req);

  function addFilter(k) { setVisible((v) => new Set(v).add(k)); }
  /* removing a filter also blanks its value - otherwise a value typed before
     it was hidden would still apply on the next Search with no field on
     screen to explain why */
  function removeFilter(k) {
    setVisible((v) => { const n = new Set(v); n.delete(k); return n; });
    set(k, Array.isArray(draft[k]) ? [] : '');
  }

  /* tabs carry their own tiles and columns; a report without tabs uses the
     spec's own */
  const activeTab = spec.tabs?.find((t) => t.k === tab) || null;
  const sections = activeTab?.sections || spec.sections || [];
  const tiles = activeTab?.tiles || spec.tiles || [];

  const load = useCallback(async () => {
    if (!business) { setData(null); return; }
    if (!searched) return;

    setLoading(true);
    setError('');

    const qs = new URLSearchParams({
      page: String(page),
      perPage: String(spec.perPage || 15),
      business: business || '',
      location: location || '',
      finYear: finYear || '',
    });
    if (tab) qs.set('tab', tab);
    Object.entries(applied).forEach(([k, v]) => {
      if (Array.isArray(v)) { if (v.length) qs.set(k, v.join(',')); }
      else if (v) qs.set(k, v);
    });

    try {
      const r = await fetch('/api/reports/' + spec.slug + '?' + qs);
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Could not run that report.'); setData(null); return; }
      setData(d);
    } catch {
      setError('Could not reach the server.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [spec.slug, spec.perPage, page, applied, tab, business, location, finYear, searched]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [applied, tab, business, location, finYear]);

  function search() {
    const missing = required.find((f) => {
      const v = draft[f.k];
      return Array.isArray(v) ? !v.length : !String(v || '').trim();
    });
    if (missing) { setError(missing.label + ' is required.'); return; }
    setError('');
    setApplied(draft);
    setSearched(true);
  }

  function reset() {
    const blank = blankFilters(spec);
    setDraft(blank);
    setApplied(blank);
    setVisible(initialVisible(spec));
    setError('');
    setSearched(!spec.searchOnly);
    if (spec.searchOnly) setData(null);
  }

  /* Exports carry the page on screen, the same limitation every other list in
     this project has. Multi-table reports export the first table. */
  const exportCols = sections[0]?.columns || [];
  const exportHeaders = () => exportCols.map((c) => c.t);
  const exportRows = () =>
    ((data?.sections?.[0]?.rows) || []).map((r) => exportCols.map((c) => cellOf(r, c)));

  /* dynamicSections: the API decides how many tables and names each one, so
     the columns come from the single spec section and the title from the
     response */
  const rendered = spec.dynamicSections
    ? (data?.sections || []).map((s, i) => ({
      key: s.title || i,
      section: { ...(sections[0] || {}), title: s.title },
      data: s,
    }))
    : sections.map((section, i) => ({
      key: section.key || i,
      section,
      data: data?.sections?.[i],
    }));

  /* the tab strip, rendered either above the filter card or below it -
     Supplier / Customer Outstanding put theirs at the top because each tab is
     a different question with its own filters */
  const tabStrip = spec.tabs ? (
    <div className="mb-3 flex gap-1 border-b border-line">
      {spec.tabs.map((t) => (
        <button
          key={t.k}
          type="button"
          onClick={() => setTab(t.k)}
          className={
            'rounded-t-md px-4 py-2 text-[13.5px] '
            + (tab === t.k
              ? 'bg-brand font-bold text-white'
              : 'text-brand-link hover:bg-[#f5f8fd]')
          }
        >
          {t.label}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <>
      {/* ------------------------------------------------------ heading --- */}
      {spec.subtitle && (
        <div className="mb-3">
          <h2 className="flex items-center gap-2 text-[17px] font-bold text-ink">
            <Icon name="chart" size={18} /> {spec.title}
          </h2>
          <p className="text-[13px] text-inkmuted">{spec.subtitle}</p>
        </div>
      )}

      {spec.tabsPosition === 'top' && tabStrip}

      {/* ------------------------------------------------------- filters --- */}
      <div className="card">
        <div className="card-head">
          <span className="card-title">
            <Icon name="filter" size={15} />
            {spec.filterTitle || (spec.subtitle ? 'Report Filters' : 'Filters')}
          </span>
        </div>
        <div className="card-body">
          {error && <div className="flash flash-err">{error}</div>}
          {!business && <div className="flash flash-err">Select a business in the top bar.</div>}

          <div className="flex flex-wrap items-end gap-x-[18px] gap-y-3.5">
            {(spec.filters || []).filter((f) => visible.has(f.k)).map((f) => (
              <div key={f.k} className="w-full sm:w-[228px]">
                <div className="mb-[5px] flex items-center justify-between">
                  <label className="block text-[13px] text-ink">
                    {f.label}{f.req && <span className="f-req">*</span>}
                  </label>
                  {!f.req && (
                    <button
                      type="button"
                      className="text-[#9aa6ba] hover:text-danger"
                      title={'Remove ' + f.label}
                      onClick={() => removeFilter(f.k)}
                    >
                      <Icon name="x" size={12} />
                    </button>
                  )}
                </div>
                <Filter f={f} value={draft[f.k]} onChange={(v) => set(f.k, v)} />
              </div>
            ))}
            <AddFilterMenu filters={spec.filters || []} visible={visible} onAdd={addFilter} />
          </div>

          <div className="mt-4 flex items-center gap-2">
            {spec.hint && <span className="text-[12.5px] text-inkmuted">{spec.hint}</span>}
            <span className="flex-1" />
            <button type="button" className="btn" onClick={reset}>
              <Icon name="refresh" size={14} /> Reset
            </button>
            <button type="button" className="btn btn-primary" onClick={search} disabled={loading}>
              {loading ? <span className="spin" /> : <Icon name="search" size={14} />} Search
            </button>
          </div>
        </div>
      </div>

      {!searched ? (
        <div className="card">
          <div className="card-body dt-empty">Use the filter above to search.</div>
        </div>
      ) : (
        <>
          {/* ---------------------------------------------------- tabs --- */}
          {spec.tabsPosition !== 'top' && tabStrip}

          {/* A report may report on its own limits. The stock reports use
              this to say, when a window reaches back before the movement
              ledger existed, that the earlier period was never recorded -
              so an empty month reads as missing data rather than as a month
              with no trade. Stating the gap is the alternative to filling
              it with numbers nobody captured. */}
          {data?.coverage?.note && (
            <div className="card">
              <div className="card-body">
                <div className="flash flash-err">{data.coverage.note}</div>
              </div>
            </div>
          )}

          {/* --------------------------------------------------- tiles --- */}
          {tiles.length > 0 && (
            <div
              className={
                'mb-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 '
                + (TILE_COLS[tiles.length] || 'xl:grid-cols-5')
              }
            >
              {tiles.map((t) => (
                <div key={t.k} className="flex overflow-hidden rounded-lg border border-line bg-white">
                  <span className={'flex w-16 items-center justify-center text-white/90 ' + (t.cls || 'bg-brand')}>
                    <Icon name={t.icon || 'chart'} size={24} />
                  </span>
                  <span className="px-3 py-3">
                    <small className="block text-[11.5px] uppercase tracking-wide text-[#5d6b83]">
                      {t.label}
                    </small>
                    <b className="text-[20px]">
                      {loading
                        ? <span className="spin" />
                        : fmt(t.f || 'amount', data?.tiles?.[t.k] ?? 0)}
                    </b>
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* ------------------------------------------------- exports --- */}
          <div className="mb-3 flex flex-wrap items-center gap-2.5">
            {data?.total !== undefined && (
              <span className="text-[13.5px] font-semibold">
                {spec.countLabel || 'Total Records'} {data.total}
              </span>
            )}
            <span className="flex-1" />
            <button
              type="button" className="btn"
              onClick={() => download(spec.slug + '.csv', toCsv(exportHeaders(), exportRows()), 'text/csv')}
            >
              <Icon name="file" size={14} /> Export CSV
            </button>
            <button
              type="button" className="btn"
              onClick={() => download(
                spec.slug + '.xls',
                toXlsHtml(spec.title, exportHeaders(), exportRows()),
                'application/vnd.ms-excel'
              )}
            >
              <Icon name="file" size={14} /> Export to Excel
            </button>
            <button
              type="button" className="btn"
              onClick={() => printTable(spec.title, exportHeaders(), exportRows())}
            >
              <Icon name="printer" size={14} /> Print
            </button>
          </div>

          {loading && (
            <div className="card"><div className="card-body dt-empty"><span className="spin" /></div></div>
          )}

          {!loading && rendered.length === 0 && (
            <div className="card"><div className="card-body dt-empty">No data found</div></div>
          )}

          {!loading && rendered.map(({ key, section, data: sectionData }) => (
            <Section
              key={key}
              section={section}
              data={sectionData}
              tone={spec.dynamicSections ? 'green' : undefined}
            />
          ))}

          {!loading && spec.grandTotal && data && (
            <GrandTotal columns={spec.grandTotal} totals={data.grandTotal} />
          )}

          {!loading && spec.paginated !== false && data && (
            <div className="flex items-center pb-4 text-[13px] text-cell">
              <span>
                Page <b className="text-brand-link">{data.page || 1}</b> of {data.pages || 1}
              </span>
              <span className="flex-1" />
              <span className="flex gap-2">
                <button
                  className="btn"
                  disabled={(data.page || 1) <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </button>
                <button
                  className="btn"
                  disabled={(data.page || 1) >= (data.pages || 1)}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </span>
            </div>
          )}
        </>
      )}
    </>
  );
}
