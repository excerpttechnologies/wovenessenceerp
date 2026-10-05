// // 'use client';
// // import { useCallback, useEffect, useRef, useState } from 'react';
// // import Icon from './Icon';
// // import MultiSelect from './MultiSelect';
// // import { useScope } from './ScopeContext';
// // import { useOptions } from './useOptions';
// // import { fmt, toCsv, toXlsHtml, download, printTable } from '@/lib/format';

// // /* ==========================================================================
// //    Generic report screen.

// //    Every report is a filter card over one or more read-only tables, so they
// //    share this component and differ only by their spec in
// //    app/admin/reports/<slug>/fields.js - the same arrangement ListView has for
// //    lists and LedgerTransactionView has for the derived ledger.

// //    Not built on ListView on purpose: a report has no ADD button, no row
// //    actions, required filters that gate the query, several tables on one
// //    screen, tabs, a totals row, a grand total, and stat tiles. ListView
// //    expresses none of those.

// //    Filter values are held locally and applied only when Search is pressed,
// //    which is how every other filter card in this project behaves.

// //    Four optional shapes a spec can ask for:

// //      tabs             two or more views over the same filters. The active tab
// //                       is sent to the API as `tab`, and each tab carries its
// //                       own tiles and sections (POS Report: Bill-wise / Item-wise).
// //      dynamicSections  the API decides how many tables come back and names each
// //                       one - used where rows are grouped by something that is
// //                       only known at read time, like Sales Person grouping by
// //                       location.
// //      grandTotal       a separate totals table under the last table, for reports
// //                       that total across their groups.
// //      searchOnly       stay empty until Search is pressed.
// //    ========================================================================== */

// // /* Date defaults, so a report opens on a sensible window rather than empty.
// //    The deployed screens open on "last month -> today". */
// // function defaultValue(f) {
// //   if (f.def === 'today') return new Date().toISOString().slice(0, 10);
// //   if (f.def === '-1month') {
// //     const d = new Date();
// //     d.setMonth(d.getMonth() - 1);
// //     return d.toISOString().slice(0, 10);
// //   }
// //   return f.def !== undefined ? f.def : '';
// // }

// // const blankFilters = (spec) =>
// //   (spec.filters || []).reduce((a, f) => ({ ...a, [f.k]: defaultValue(f) }), {});

// // /* Which filter fields start on screen: required ones (Search enforces them
// //    anyway, so hiding them would just make the error message a surprise) plus
// //    any that open with a real default value (e.g. a date range pre-filled to
// //    "last month -> today"). Everything else stays tucked behind "Add Filter"
// //    until picked, which is what keeps a 20+ filter report like Master Stock
// //    Report from opening as a wall of empty boxes. */
// // const initialVisible = (spec) => {
// //   const blanks = blankFilters(spec);
// //   return new Set(
// //     (spec.filters || [])
// //       .filter((f) => f.req || (Array.isArray(blanks[f.k]) ? blanks[f.k].length : blanks[f.k]))
// //       .map((f) => f.k)
// //   );
// // };

// // const isNumeric = (col) => col.f === 'amount' || col.f === 'count' || col.num;

// // /* Written as literal class strings: Tailwind scans source text, so a class
// //    built at runtime (`xl:grid-cols-${n}`) would never be generated. */
// // const TILE_COLS = {
// //   3: 'xl:grid-cols-3',
// //   4: 'xl:grid-cols-4',
// //   5: 'xl:grid-cols-5',
// //   6: 'xl:grid-cols-6',
// // };

// // const cellOf = (row, col) => {
// //   const raw = col.value ? col.value(row) : row[col.k];
// //   return col.f ? fmt(col.f, raw) : (raw ?? '');
// // };

// // /* A ref filter needs its own option list, so it is its own component -
// //    useOptions is a hook and cannot run inside a map. */
// // function RefFilter({ f, value, onChange }) {
// //   const { options, loading } = useOptions(f.ref);
// //   return (
// //     <MultiSelect
// //       mode={f.multi ? 'multi' : 'single'}
// //       options={options}
// //       loading={loading}
// //       value={f.multi ? (value || []) : (value || '')}
// //       placeholder={f.all || 'Select...'}
// //       onChange={onChange}
// //     />
// //   );
// // }

// // /* Several typed values, each kept as a chip.

// //    Used where a picker is no use because the list would be enormous - barcode
// //    numbers, of which there is one per piece of stock. Enter or a comma commits
// //    what has been typed; Backspace on an empty box takes the last one back off.

// //    The value is an ARRAY, which ReportView already sends comma-joined, so the
// //    route reads it the same way it reads a multi-select. */
// // function TagsFilter({ f, value, onChange, business }) {
// //   const [term, setTerm] = useState('');
// //   const [hits, setHits] = useState([]);
// //   const [open, setOpen] = useState(false);
// //   const chips = Array.isArray(value) ? value : (value ? [value] : []);

// //   /* Suggestions, when the filter names an endpoint to ask.

// //      Debounced, and the answer is discarded if the term has moved on - the
// //      same guard the till's item box needed, and for the same reason: a slow
// //      reply must not repopulate a list the operator has already typed past. */
// //   useEffect(() => {
// //     if (!f.suggest) return undefined;
// //     const q = term.trim();
// //     if (!q) { setHits([]); return undefined; }

// //     let off = false;
// //     const timer = setTimeout(() => {
// //       const qs = new URLSearchParams({ q, business: business || '' });
// //       fetch(f.suggest + '?' + qs, { cache: 'no-store' })
// //         .then((r) => r.json())
// //         .then((d) => { if (!off) { setHits(d.options || []); setOpen(true); } })
// //         .catch(() => { if (!off) setHits([]); });
// //     }, 250);

// //     return () => { off = true; clearTimeout(timer); };
// //   }, [f.suggest, term, business]);

// //   const commit = (raw) => {
// //     const parts = String(raw).split(',').map((v) => v.trim()).filter(Boolean);
// //     if (!parts.length) return;
// //     const next = [...chips];
// //     parts.forEach((p) => { if (!next.some((c) => c.toLowerCase() === p.toLowerCase())) next.push(p); });
// //     onChange(next);
// //     setTerm('');
// //   };

// //   /* offered but not yet chosen - a barcode already on the list is not
// //      suggested again */
// //   const choices = hits.filter((h) => !chips.some((c) => c.toLowerCase() === String(h.value).toLowerCase()));

// //   return (
// //     <div className="relative">
// //     <div className="f-input flex flex-wrap items-center gap-1 !h-auto min-h-[34px] py-1">
// //       {chips.map((c) => (
// //         <span key={c} className="inline-flex items-center gap-1 rounded bg-pillgrey px-1.5 py-0.5 text-[12px]">
// //           {c}
// //           <button
// //             type="button"
// //             aria-label={'Remove ' + c}
// //             className="text-inkmuted hover:text-danger"
// //             onClick={() => onChange(chips.filter((x) => x !== c))}
// //           >
// //             <Icon name="x" size={10} />
// //           </button>
// //         </span>
// //       ))}
// //       <input
// //         className="min-w-[90px] flex-1 border-0 bg-transparent p-0 text-[13px] outline-none"
// //         placeholder={chips.length ? '' : (f.placeholder || '')}
// //         value={term}
// //         onChange={(e) => {
// //           const v = e.target.value;
// //           if (v.includes(',')) commit(v);
// //           else setTerm(v);
// //         }}
// //         onKeyDown={(e) => {
// //           if (e.key === 'Enter') { e.preventDefault(); commit(term); }
// //           if (e.key === 'Backspace' && !term && chips.length) onChange(chips.slice(0, -1));
// //         }}
// //         /* committed on blur too, so a value left in the box is not silently
// //            dropped when the operator goes straight for Search */
// //         /* Committed on blur, IMMEDIATELY.

// //            This used to wait 150ms, which lost the last value typed: clicking
// //            Search blurs the box, the search ran on the filters as they were,
// //            and only afterwards did the delayed commit add the chip - so the
// //            screen showed two barcodes and the results answered one.

// //            The delay was there so a click on a suggestion would register
// //            before the box committed, but the suggestion buttons already
// //            preventDefault on mousedown, which stops the blur firing at all.
// //            So nothing needs the wait. */
// //         onBlur={() => { commit(term); setOpen(false); }}
// //         onFocus={() => { if (choices.length) setOpen(true); }}
// //       />
// //     </div>

// //     {open && choices.length > 0 && (
// //       <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-auto rounded border border-line bg-white shadow-lg">
// //         {choices.map((h) => (
// //           <button
// //             key={h.value}
// //             type="button"
// //             className="block w-full border-b border-line px-2 py-1.5 text-left text-[12.5px] last:border-b-0 hover:bg-[#f4f7fb]"
// //             onMouseDown={(e) => e.preventDefault()}
// //             onClick={() => { commit(h.value); setOpen(false); }}
// //           >
// //             {h.label || h.value}
// //           </button>
// //         ))}
// //       </div>
// //     )}
// //     </div>
// //   );
// // }

// // function Filter({ f, value, onChange, business }) {
// //   if (f.type === 'tags') return <TagsFilter f={f} value={value} onChange={onChange} business={business} />;
// //   if (f.type === 'ref') return <RefFilter f={f} value={value} onChange={onChange} />;

// //   if (f.type === 'select') {
// //     return (
// //       <select className="f-input" value={value || ''} onChange={(e) => onChange(e.target.value)}>
// //         {/* the "all" option is what clears the filter, so a required select
// //             must not offer it - otherwise it reads as a second copy of its
// //             own default */}
// //         {!f.req && <option value="">{f.all || 'Select...'}</option>}
// //         {(f.opts || []).map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
// //       </select>
// //     );
// //   }

// //   return (
// //     <input
// //       type={f.type === 'date' ? 'date' : 'text'}
// //       className="f-input"
// //       placeholder={f.placeholder || ''}
// //       value={value || ''}
// //       onChange={(e) => onChange(e.target.value)}
// //     />
// //   );
// // }

// // /* The "+ Add Filter" control: a button that opens a plain list of every
// //    filter not currently on screen, clicking one adds it. Closes on an outside
// //    click the same way MultiSelect's own menu does. */
// // function AddFilterMenu({ filters, visible, onAdd }) {
// //   const [open, setOpen] = useState(false);
// //   const box = useRef(null);

// //   useEffect(() => {
// //     function away(e) { if (box.current && !box.current.contains(e.target)) setOpen(false); }
// //     document.addEventListener('mousedown', away);
// //     return () => document.removeEventListener('mousedown', away);
// //   }, []);

// //   const hidden = filters.filter((f) => !visible.has(f.k));
// //   if (!hidden.length) return null;

// //   return (
// //     <div className="relative" ref={box}>
// //       <button type="button" className="btn" onClick={() => setOpen((o) => !o)}>
// //         <Icon name="plus" size={14} /> Add Filter
// //       </button>
// //       {open && (
// //         <div className="absolute left-0 top-[calc(100%+4px)] z-[45] max-h-72 w-64 overflow-auto rounded-md border border-linestrong bg-white shadow-pop">
// //           {hidden.map((f) => (
// //             <div
// //               key={f.k}
// //               className="ms-opt"
// //               onClick={() => { onAdd(f.k); setOpen(false); }}
// //             >
// //               {f.label}
// //             </div>
// //           ))}
// //         </div>
// //       )}
// //     </div>
// //   );
// // }

// // /* A thumbnail that pops up a larger preview, centred on screen, on hover. The
// //    table body scrolls with `overflow-x-auto` (Section, below), and the Image
// //    column sits at its right edge - an absolutely positioned popup would be
// //    clipped by that scroll container the moment it crossed its edge. Fixed
// //    positioning with a dimmed backdrop escapes that clipping and keeps the
// //    preview in the same, predictable spot regardless of which row or how far
// //    the table is scrolled. */
// // const PREVIEW = 320;
// // function HoverImage({ src, alt }) {
// //   const [hover, setHover] = useState(false);

// //   if (!src) return <span className="text-cell">—</span>;

// //   return (
// //     <>
// //       <img
// //         src={src}
// //         alt={alt || ''}
// //         className="h-10 w-10 cursor-zoom-in rounded border border-line object-cover"
// //         onError={(e) => { e.currentTarget.style.display = 'none'; }}
// //         onMouseEnter={() => setHover(true)}
// //         onMouseLeave={() => setHover(false)}
// //       />
// //       {hover && (
// //         <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/40">
// //           <img
// //             src={src}
// //             alt={alt || ''}
// //             style={{ width: PREVIEW, height: PREVIEW }}
// //             className="rounded-lg border border-line bg-white object-cover shadow-xl"
// //           />
// //         </div>
// //       )}
// //     </>
// //   );
// // }

// // /* One result table. `columns[].total` marks a column the totals row sums; the
// //    server sends its own totals so the figure covers the whole result set
// //    rather than just the visible page. */
// // function Section({ section, data, tone }) {
// //   const columns = section.columns || [];
// //   const rows = data?.rows || [];
// //   const totals = data?.totals || {};

// //   return (
// //     <div className="card">
// //       {section.title && (
// //         <div
// //           className={
// //             'card-head '
// //             + (tone === 'green' ? 'bg-okgreen text-white' : '')
// //           }
// //         >
// //           <span className="card-title">
// //             {tone === 'green' && <Icon name="chart" size={15} />}
// //             {section.title}
// //           </span>
// //           {data?.count !== undefined && tone !== 'green' && (
// //             <span className="pill pill-blue">{data.count} records</span>
// //           )}
// //         </div>
// //       )}
// //       <div className="card-body">
// //         <div className="overflow-x-auto">
// //           <table className="dt">
// //             <thead>
// //               <tr>
// //                 {columns.map((c) => (
// //                   <th key={c.t} className={isNumeric(c) ? 'text-right' : ''}>{c.t}</th>
// //                 ))}
// //               </tr>
// //             </thead>
// //             <tbody>
// //               {rows.length === 0 && (
// //                 <tr>
// //                   <td colSpan={columns.length} className="dt-empty">No data found</td>
// //                 </tr>
// //               )}
// //               {rows.map((row, i) => (
// //                 <tr key={row._id || i}>
// //                   {columns.map((c) => (
// //                     <td key={c.t} className={isNumeric(c) ? 'text-right' : ''}>
// //                       {c.f === 'image'
// //                         ? <HoverImage src={row[c.k]} />
// //                         : c.link
// //                           /* a column that names a destination renders as a
// //                              link - used by Master Stock Report to open one
// //                              barcode's own report. Blank cells stay plain, so
// //                              a row with nothing to point at has nothing to
// //                              click. */
// //                           ? (cellOf(row, c)
// //                             ? <a className="text-brand underline hover:opacity-80" href={c.link(row)}>{cellOf(row, c)}</a>
// //                             : '')
// //                           : cellOf(row, c)}
// //                     </td>
// //                   ))}
// //                 </tr>
// //               ))}
// //             </tbody>
// //             {section.totalsRow && (
// //               <tfoot>
// //                 <tr className="font-bold">
// //                   {columns.map((c, i) => (
// //                     <td key={c.t} className={isNumeric(c) ? 'text-right' : ''}>
// //                       {i === 0 ? 'Total' : (c.total ? fmt('amount', totals[c.k] ?? 0) : '')}
// //                     </td>
// //                   ))}
// //                 </tr>
// //               </tfoot>
// //             )}
// //           </table>
// //         </div>
// //       </div>
// //     </div>
// //   );
// // }

// // /* The standalone totals table some reports print under their groups, so the
// //    figure covers every group rather than the one table above it. */
// // function GrandTotal({ columns, totals }) {
// //   return (
// //     <div className="card">
// //       <div className="card-body">
// //         <table className="dt">
// //           <thead>
// //             <tr>
// //               <th />
// //               {columns.map((c) => (
// //                 <th key={c.t} className={isNumeric(c) ? 'text-right' : ''}>{c.t}</th>
// //               ))}
// //             </tr>
// //           </thead>
// //           <tbody>
// //             <tr className="font-bold">
// //               <td>Total</td>
// //               {columns.map((c) => (
// //                 <td key={c.t} className={isNumeric(c) ? 'text-right' : ''}>
// //                   {fmt(c.f || 'amount', (totals || {})[c.k] ?? 0)}
// //                 </td>
// //               ))}
// //             </tr>
// //           </tbody>
// //         </table>
// //       </div>
// //     </div>
// //   );
// // }

// // export default function ReportView({ spec }) {
// //   const { business, location, finYear } = useScope();

// //   const [draft, setDraft] = useState(() => blankFilters(spec));
// //   const [applied, setApplied] = useState(() => blankFilters(spec));
// //   /* which filter fields are on screen right now - see initialVisible() */
// //   const [visible, setVisible] = useState(() => initialVisible(spec));
// //   const [tab, setTab] = useState(spec.tabs?.[0]?.k || '');
// //   const [data, setData] = useState(null);
// //   const [page, setPage] = useState(1);
// //   const [loading, setLoading] = useState(false);
// //   const [error, setError] = useState('');
// //   /* a searchOnly report shows nothing until its required filter is filled in,
// //      matching the deployed screen's empty initial state */
// //   const [searched, setSearched] = useState(!spec.searchOnly);

// //   const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

// //   const required = (spec.filters || []).filter((f) => f.req);

// //   function addFilter(k) { setVisible((v) => new Set(v).add(k)); }
// //   /* removing a filter also blanks its value - otherwise a value typed before
// //      it was hidden would still apply on the next Search with no field on
// //      screen to explain why */
// //   function removeFilter(k) {
// //     setVisible((v) => { const n = new Set(v); n.delete(k); return n; });
// //     set(k, Array.isArray(draft[k]) ? [] : '');
// //   }

// //   /* tabs carry their own tiles and columns; a report without tabs uses the
// //      spec's own */
// //   const activeTab = spec.tabs?.find((t) => t.k === tab) || null;
// //   const sections = activeTab?.sections || spec.sections || [];
// //   const tiles = activeTab?.tiles || spec.tiles || [];

// //   const load = useCallback(async () => {
// //     if (!business) { setData(null); return; }
// //     if (!searched) return;

// //     setLoading(true);
// //     setError('');

// //     const qs = new URLSearchParams({
// //       page: String(page),
// //       perPage: String(spec.perPage || 15),
// //       business: business || '',
// //       location: location || '',
// //       finYear: finYear || '',
// //     });
// //     if (tab) qs.set('tab', tab);
// //     Object.entries(applied).forEach(([k, v]) => {
// //       if (Array.isArray(v)) { if (v.length) qs.set(k, v.join(',')); }
// //       else if (v) qs.set(k, v);
// //     });

// //     try {
// //       const r = await fetch('/api/reports/' + spec.slug + '?' + qs);
// //       const d = await r.json();
// //       if (!r.ok) { setError(d.error || 'Could not run that report.'); setData(null); return; }
// //       setData(d);
// //     } catch {
// //       setError('Could not reach the server.');
// //       setData(null);
// //     } finally {
// //       setLoading(false);
// //     }
// //   }, [spec.slug, spec.perPage, page, applied, tab, business, location, finYear, searched]);

// //   useEffect(() => { load(); }, [load]);
// //   useEffect(() => { setPage(1); }, [applied, tab, business, location, finYear]);

// //   function search() {
// //     const missing = required.find((f) => {
// //       const v = draft[f.k];
// //       return Array.isArray(v) ? !v.length : !String(v || '').trim();
// //     });
// //     if (missing) { setError(missing.label + ' is required.'); return; }
// //     setError('');
// //     setApplied(draft);
// //     setSearched(true);
// //   }

// //   function reset() {
// //     const blank = blankFilters(spec);
// //     setDraft(blank);
// //     setApplied(blank);
// //     setVisible(initialVisible(spec));
// //     setError('');
// //     setSearched(!spec.searchOnly);
// //     if (spec.searchOnly) setData(null);
// //   }

// //   /* Exports carry the page on screen, the same limitation every other list in
// //      this project has. Multi-table reports export the first table. */
// //   const exportCols = sections[0]?.columns || [];
// //   const exportHeaders = () => exportCols.map((c) => c.t);
// //   const exportRows = () =>
// //     ((data?.sections?.[0]?.rows) || []).map((r) => exportCols.map((c) => cellOf(r, c)));

// //   /* dynamicSections: the API decides how many tables and names each one, so
// //      the columns come from the single spec section and the title from the
// //      response */
// //   const rendered = spec.dynamicSections
// //     ? (data?.sections || []).map((s, i) => ({
// //       key: s.title || i,
// //       section: { ...(sections[0] || {}), title: s.title },
// //       data: s,
// //     }))
// //     : sections.map((section, i) => ({
// //       key: section.key || i,
// //       section,
// //       data: data?.sections?.[i],
// //     }));

// //   /* the tab strip, rendered either above the filter card or below it -
// //      Supplier / Customer Outstanding put theirs at the top because each tab is
// //      a different question with its own filters */
// //   const tabStrip = spec.tabs ? (
// //     <div className="mb-3 flex gap-1 border-b border-line">
// //       {spec.tabs.map((t) => (
// //         <button
// //           key={t.k}
// //           type="button"
// //           onClick={() => setTab(t.k)}
// //           className={
// //             'rounded-t-md px-4 py-2 text-[13.5px] '
// //             + (tab === t.k
// //               ? 'bg-brand font-bold text-white'
// //               : 'text-brand-link hover:bg-[#f5f8fd]')
// //           }
// //         >
// //           {t.label}
// //         </button>
// //       ))}
// //     </div>
// //   ) : null;

// //   return (
// //     <>
// //       {/* ------------------------------------------------------ heading --- */}
// //       {spec.subtitle && (
// //         <div className="mb-3">
// //           <h2 className="flex items-center gap-2 text-[17px] font-bold text-ink">
// //             <Icon name="chart" size={18} /> {spec.title}
// //           </h2>
// //           <p className="text-[13px] text-inkmuted">{spec.subtitle}</p>
// //         </div>
// //       )}

// //       {spec.tabsPosition === 'top' && tabStrip}

// //       {/* ------------------------------------------------------- filters --- */}
// //       <div className="card">
// //         <div className="card-head">
// //           <span className="card-title">
// //             <Icon name="filter" size={15} />
// //             {spec.filterTitle || (spec.subtitle ? 'Report Filters' : 'Filters')}
// //           </span>
// //         </div>
// //         <div className="card-body">
// //           {error && <div className="flash flash-err">{error}</div>}
// //           {!business && <div className="flash flash-err">Select a business in the top bar.</div>}

// //           {spec.filterLayout === 'rows' ? (
// //             /* EVERY FILTER ON SCREEN, name on the left and its input on the
// //                right. A report opts into this with filterLayout: 'rows' when its
// //                filters are the point of the screen; the default stays the
// //                "pick what you need" panel, which is what keeps the other
// //                reports from opening as a wall of empty boxes.

// //                No Add Filter button and no per-filter remove: nothing is hidden,
// //                so there is nothing to add back or take away. */
// //             <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 md:grid-cols-2 xl:grid-cols-4">
// //               {(spec.filters || []).map((f) => (
// //                 <div key={f.k} className="flex items-center gap-3">
// //                   <label className="w-[104px] shrink-0 text-[12.5px] leading-tight text-ink">
// //                     {f.label}{f.req && <span className="f-req">*</span>}
// //                   </label>
// //                   <div className="min-w-0 flex-1">
// //                     <Filter f={f} value={draft[f.k]} onChange={(v) => set(f.k, v)} business={business} />
// //                   </div>
// //                 </div>
// //               ))}
// //             </div>
// //           ) : (
// //             <div className="flex flex-wrap items-end gap-x-[18px] gap-y-3.5">
// //               {(spec.filters || []).filter((f) => visible.has(f.k)).map((f) => (
// //                 <div key={f.k} className="w-full sm:w-[228px]">
// //                   <div className="mb-[5px] flex items-center justify-between">
// //                     <label className="block text-[13px] text-ink">
// //                       {f.label}{f.req && <span className="f-req">*</span>}
// //                     </label>
// //                     {!f.req && (
// //                       <button
// //                         type="button"
// //                         className="text-[#9aa6ba] hover:text-danger"
// //                         title={'Remove ' + f.label}
// //                         onClick={() => removeFilter(f.k)}
// //                       >
// //                         <Icon name="x" size={12} />
// //                       </button>
// //                     )}
// //                   </div>
// //                   <Filter f={f} value={draft[f.k]} onChange={(v) => set(f.k, v)} business={business} />
// //                 </div>
// //               ))}
// //               <AddFilterMenu filters={spec.filters || []} visible={visible} onAdd={addFilter} />
// //             </div>
// //           )}

// //           <div className="mt-4 flex items-center gap-2">
// //             {spec.hint && <span className="text-[12.5px] text-inkmuted">{spec.hint}</span>}
// //             <span className="flex-1" />
// //             <button type="button" className="btn" onClick={reset}>
// //               <Icon name="refresh" size={14} /> Reset
// //             </button>
// //             <button type="button" className="btn btn-primary" onClick={search} disabled={loading}>
// //               {loading ? <span className="spin" /> : <Icon name="search" size={14} />} Search
// //             </button>
// //           </div>
// //         </div>
// //       </div>

// //       {!searched ? (
// //         <div className="card">
// //           <div className="card-body dt-empty">Use the filter above to search.</div>
// //         </div>
// //       ) : (
// //         <>
// //           {/* ---------------------------------------------------- tabs --- */}
// //           {spec.tabsPosition !== 'top' && tabStrip}

// //           {/* A report may report on its own limits. The stock reports use
// //               this to say, when a window reaches back before the movement
// //               ledger existed, that the earlier period was never recorded -
// //               so an empty month reads as missing data rather than as a month
// //               with no trade. Stating the gap is the alternative to filling
// //               it with numbers nobody captured. */}
// //           {data?.coverage?.note && (
// //             <div className="card">
// //               <div className="card-body">
// //                 <div className="flash flash-err">{data.coverage.note}</div>
// //               </div>
// //             </div>
// //           )}

// //           {/* --------------------------------------------------- tiles --- */}
// //           {tiles.length > 0 && (
// //             <div
// //               className={
// //                 'mb-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 '
// //                 + (TILE_COLS[tiles.length] || 'xl:grid-cols-5')
// //               }
// //             >
// //               {tiles.map((t) => (
// //                 <div key={t.k} className="flex overflow-hidden rounded-lg border border-line bg-white">
// //                   <span className={'flex w-16 items-center justify-center text-white/90 ' + (t.cls || 'bg-brand')}>
// //                     <Icon name={t.icon || 'chart'} size={24} />
// //                   </span>
// //                   <span className="px-3 py-3">
// //                     <small className="block text-[11.5px] uppercase tracking-wide text-[#5d6b83]">
// //                       {t.label}
// //                     </small>
// //                     <b className="text-[20px]">
// //                       {loading
// //                         ? <span className="spin" />
// //                         : fmt(t.f || 'amount', data?.tiles?.[t.k] ?? 0)}
// //                     </b>
// //                   </span>
// //                 </div>
// //               ))}
// //             </div>
// //           )}

// //           {/* ------------------------------------------------- exports --- */}
// //           <div className="mb-3 flex flex-wrap items-center gap-2.5">
// //             {data?.total !== undefined && (
// //               <span className="text-[13.5px] font-semibold">
// //                 {spec.countLabel || 'Total Records'} {data.total}
// //               </span>
// //             )}
// //             <span className="flex-1" />
// //             <button
// //               type="button" className="btn"
// //               onClick={() => download(spec.slug + '.csv', toCsv(exportHeaders(), exportRows()), 'text/csv')}
// //             >
// //               <Icon name="file" size={14} /> Export CSV
// //             </button>
// //             <button
// //               type="button" className="btn"
// //               onClick={() => download(
// //                 spec.slug + '.xls',
// //                 toXlsHtml(spec.title, exportHeaders(), exportRows()),
// //                 'application/vnd.ms-excel'
// //               )}
// //             >
// //               <Icon name="file" size={14} /> Export to Excel
// //             </button>
// //             <button
// //               type="button" className="btn"
// //               onClick={() => printTable(spec.title, exportHeaders(), exportRows())}
// //             >
// //               <Icon name="printer" size={14} /> Print
// //             </button>
// //           </div>

// //           {loading && (
// //             <div className="card"><div className="card-body dt-empty"><span className="spin" /></div></div>
// //           )}

// //           {!loading && rendered.length === 0 && (
// //             <div className="card"><div className="card-body dt-empty">No data found</div></div>
// //           )}

// //           {!loading && rendered.map(({ key, section, data: sectionData }) => (
// //             <Section
// //               key={key}
// //               section={section}
// //               data={sectionData}
// //               tone={spec.dynamicSections ? 'green' : undefined}
// //             />
// //           ))}

// //           {!loading && spec.grandTotal && data && (
// //             <GrandTotal columns={spec.grandTotal} totals={data.grandTotal} />
// //           )}

// //           {!loading && spec.paginated !== false && data && (
// //             <div className="flex items-center pb-4 text-[13px] text-cell">
// //               <span>
// //                 Page <b className="text-brand-link">{data.page || 1}</b> of {data.pages || 1}
// //               </span>
// //               <span className="flex-1" />
// //               <span className="flex gap-2">
// //                 <button
// //                   className="btn"
// //                   disabled={(data.page || 1) <= 1}
// //                   onClick={() => setPage((p) => p - 1)}
// //                 >
// //                   Previous
// //                 </button>
// //                 <button
// //                   className="btn"
// //                   disabled={(data.page || 1) >= (data.pages || 1)}
// //                   onClick={() => setPage((p) => p + 1)}
// //                 >
// //                   Next
// //                 </button>
// //               </span>
// //             </div>
// //           )}
// //         </>
// //       )}
// //     </>
// //   );
// // }


















// 'use client';
// import { useCallback, useEffect, useRef, useState } from 'react';
// import Icon from './Icon';
// import MultiSelect from './MultiSelect';
// import { useScope } from './ScopeContext';
// import { useOptions } from './useOptions';
// import { fmt, toCsv, toXlsHtml, download, printTable } from '@/lib/format';

// /* ==========================================================================
//    Generic report screen.

//    Every report is a filter card over one or more read-only tables, so they
//    share this component and differ only by their spec in
//    app/admin/reports/<slug>/fields.js - the same arrangement ListView has for
//    lists and LedgerTransactionView has for the derived ledger.

//    Not built on ListView on purpose: a report has no ADD button, no row
//    actions, required filters that gate the query, several tables on one
//    screen, tabs, a totals row, a grand total, and stat tiles. ListView
//    expresses none of those.

//    Filter values are held locally and applied only when Search is pressed,
//    which is how every other filter card in this project behaves.

//    Four optional shapes a spec can ask for:

//      tabs             two or more views over the same filters. The active tab
//                       is sent to the API as `tab`, and each tab carries its
//                       own tiles and sections (POS Report: Bill-wise / Item-wise).
//      dynamicSections  the API decides how many tables come back and names each
//                       one - used where rows are grouped by something that is
//                       only known at read time, like Sales Person grouping by
//                       location.
//      grandTotal       a separate totals table under the last table, for reports
//                       that total across their groups.
//      searchOnly       stay empty until Search is pressed.
//    ========================================================================== */

// /* Date defaults, so a report opens on a sensible window rather than empty.
//    The deployed screens open on "last month -> today". */
// function defaultValue(f) {
//   if (f.def === 'today') return new Date().toISOString().slice(0, 10);
//   if (f.def === '-1month') {
//     const d = new Date();
//     d.setMonth(d.getMonth() - 1);
//     return d.toISOString().slice(0, 10);
//   }
//   return f.def !== undefined ? f.def : '';
// }

// const blankFilters = (spec) =>
//   (spec.filters || []).reduce((a, f) => ({ ...a, [f.k]: defaultValue(f) }), {});

// /* Which filter fields start on screen: required ones (Search enforces them
//    anyway, so hiding them would just make the error message a surprise) plus
//    any that open with a real default value (e.g. a date range pre-filled to
//    "last month -> today"). Everything else stays tucked behind "Add Filter"
//    until picked, which is what keeps a 20+ filter report like Master Stock
//    Report from opening as a wall of empty boxes. */
// const initialVisible = (spec) => {
//   const blanks = blankFilters(spec);
//   return new Set(
//     (spec.filters || [])
//       .filter((f) => f.req || (Array.isArray(blanks[f.k]) ? blanks[f.k].length : blanks[f.k]))
//       .map((f) => f.k)
//   );
// };

// const isNumeric = (col) => col.f === 'amount' || col.f === 'count' || col.num;

// /* Written as literal class strings: Tailwind scans source text, so a class
//    built at runtime (`xl:grid-cols-${n}`) would never be generated. */
// const TILE_COLS = {
//   3: 'xl:grid-cols-3',
//   4: 'xl:grid-cols-4',
//   5: 'xl:grid-cols-5',
//   6: 'xl:grid-cols-6',
// };

// const cellOf = (row, col) => {
//   const raw = col.value ? col.value(row) : row[col.k];
//   return col.f ? fmt(col.f, raw) : (raw ?? '');
// };

// /* A ref filter needs its own option list, so it is its own component -
//    useOptions is a hook and cannot run inside a map. */
// function RefFilter({ f, value, onChange }) {
//   const { options, loading } = useOptions(f.ref);
//   return (
//     <MultiSelect
//       mode={f.multi ? 'multi' : 'single'}
//       options={options}
//       loading={loading}
//       value={f.multi ? (value || []) : (value || '')}
//       placeholder={f.all || 'Select...'}
//       onChange={onChange}
//     />
//   );
// }

// /* Several typed values, each kept as a chip.

//    Used where a picker is no use because the list would be enormous - barcode
//    numbers, of which there is one per piece of stock. Enter or a comma commits
//    what has been typed; Backspace on an empty box takes the last one back off.

//    The value is an ARRAY, which ReportView already sends comma-joined, so the
//    route reads it the same way it reads a multi-select. */
// function TagsFilter({ f, value, onChange, business }) {
//   const [term, setTerm] = useState('');
//   const [hits, setHits] = useState([]);
//   const [open, setOpen] = useState(false);
//   const chips = Array.isArray(value) ? value : (value ? [value] : []);

//   /* Suggestions, when the filter names an endpoint to ask.

//      Debounced, and the answer is discarded if the term has moved on - the
//      same guard the till's item box needed, and for the same reason: a slow
//      reply must not repopulate a list the operator has already typed past. */
//   useEffect(() => {
//     if (!f.suggest) return undefined;
//     const q = term.trim();
//     if (!q) { setHits([]); return undefined; }

//     let off = false;
//     const timer = setTimeout(() => {
//       const qs = new URLSearchParams({ q, business: business || '' });
//       fetch(f.suggest + '?' + qs, { cache: 'no-store' })
//         .then((r) => r.json())
//         .then((d) => { if (!off) { setHits(d.options || []); setOpen(true); } })
//         .catch(() => { if (!off) setHits([]); });
//     }, 250);

//     return () => { off = true; clearTimeout(timer); };
//   }, [f.suggest, term, business]);

//   const commit = (raw) => {
//     const parts = String(raw).split(',').map((v) => v.trim()).filter(Boolean);
//     if (!parts.length) return;
//     const next = [...chips];
//     parts.forEach((p) => { if (!next.some((c) => c.toLowerCase() === p.toLowerCase())) next.push(p); });
//     onChange(next);
//     setTerm('');
//   };

//   /* offered but not yet chosen - a barcode already on the list is not
//      suggested again */
//   const choices = hits.filter((h) => !chips.some((c) => c.toLowerCase() === String(h.value).toLowerCase()));

//   return (
//     <div className="relative">
//     <div className="f-input flex flex-wrap items-center gap-1 !h-auto min-h-[34px] py-1">
//       {chips.map((c) => (
//         <span key={c} className="inline-flex items-center gap-1 rounded bg-pillgrey px-1.5 py-0.5 text-[12px]">
//           {c}
//           <button
//             type="button"
//             aria-label={'Remove ' + c}
//             className="text-inkmuted hover:text-danger"
//             onClick={() => onChange(chips.filter((x) => x !== c))}
//           >
//             <Icon name="x" size={10} />
//           </button>
//         </span>
//       ))}
//       <input
//         className="min-w-[90px] flex-1 border-0 bg-transparent p-0 text-[13px] outline-none"
//         placeholder={chips.length ? '' : (f.placeholder || '')}
//         value={term}
//         onChange={(e) => {
//           const v = e.target.value;
//           if (v.includes(',')) commit(v);
//           else setTerm(v);
//         }}
//         onKeyDown={(e) => {
//           if (e.key === 'Enter') { e.preventDefault(); commit(term); }
//           if (e.key === 'Backspace' && !term && chips.length) onChange(chips.slice(0, -1));
//         }}
//         /* committed on blur too, so a value left in the box is not silently
//            dropped when the operator goes straight for Search */
//         /* Committed on blur, IMMEDIATELY.

//            This used to wait 150ms, which lost the last value typed: clicking
//            Search blurs the box, the search ran on the filters as they were,
//            and only afterwards did the delayed commit add the chip - so the
//            screen showed two barcodes and the results answered one.

//            The delay was there so a click on a suggestion would register
//            before the box committed, but the suggestion buttons already
//            preventDefault on mousedown, which stops the blur firing at all.
//            So nothing needs the wait. */
//         onBlur={() => { commit(term); setOpen(false); }}
//         onFocus={() => { if (choices.length) setOpen(true); }}
//       />
//     </div>

//     {open && choices.length > 0 && (
//       <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-auto rounded border border-line bg-white shadow-lg">
//         {choices.map((h) => (
//           <button
//             key={h.value}
//             type="button"
//             className="block w-full border-b border-line px-2 py-1.5 text-left text-[12.5px] last:border-b-0 hover:bg-[#f4f7fb]"
//             onMouseDown={(e) => e.preventDefault()}
//             onClick={() => { commit(h.value); setOpen(false); }}
//           >
//             {h.label || h.value}
//           </button>
//         ))}
//       </div>
//     )}
//     </div>
//   );
// }

// function Filter({ f, value, onChange, business }) {
//   if (f.type === 'tags') return <TagsFilter f={f} value={value} onChange={onChange} business={business} />;
//   if (f.type === 'ref') return <RefFilter f={f} value={value} onChange={onChange} />;

//   if (f.type === 'select') {
//     return (
//       <select className="f-input" value={value || ''} onChange={(e) => onChange(e.target.value)}>
//         {/* the "all" option is what clears the filter, so a required select
//             must not offer it - otherwise it reads as a second copy of its
//             own default */}
//         {!f.req && <option value="">{f.all || 'Select...'}</option>}
//         {(f.opts || []).map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
//       </select>
//     );
//   }

//   return (
//     <input
//       type={f.type === 'date' ? 'date' : 'text'}
//       className="f-input"
//       placeholder={f.placeholder || ''}
//       value={value || ''}
//       onChange={(e) => onChange(e.target.value)}
//     />
//   );
// }

// /* The "+ Add Filter" control: a button that opens a plain list of every
//    filter not currently on screen, clicking one adds it. Closes on an outside
//    click the same way MultiSelect's own menu does. */
// function AddFilterMenu({ filters, visible, onAdd }) {
//   const [open, setOpen] = useState(false);
//   const box = useRef(null);

//   useEffect(() => {
//     function away(e) { if (box.current && !box.current.contains(e.target)) setOpen(false); }
//     document.addEventListener('mousedown', away);
//     return () => document.removeEventListener('mousedown', away);
//   }, []);

//   const hidden = filters.filter((f) => !visible.has(f.k));
//   if (!hidden.length) return null;

//   return (
//     <div className="relative" ref={box}>
//       <button type="button" className="btn" onClick={() => setOpen((o) => !o)}>
//         <Icon name="plus" size={14} /> Add Filter
//       </button>
//       {open && (
//         <div className="absolute left-0 top-[calc(100%+4px)] z-[45] max-h-72 w-64 overflow-auto rounded-md border border-linestrong bg-white shadow-pop">
//           {hidden.map((f) => (
//             <div
//               key={f.k}
//               className="ms-opt"
//               onClick={() => { onAdd(f.k); setOpen(false); }}
//             >
//               {f.label}
//             </div>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// }

// /* A thumbnail that pops up a larger preview, centred on screen, on hover. The
//    table body scrolls with `overflow-x-auto` (Section, below), and the Image
//    column sits at its right edge - an absolutely positioned popup would be
//    clipped by that scroll container the moment it crossed its edge. Fixed
//    positioning with a dimmed backdrop escapes that clipping and keeps the
//    preview in the same, predictable spot regardless of which row or how far
//    the table is scrolled. */
// const PREVIEW = 320;
// function HoverImage({ src, alt }) {
//   const [hover, setHover] = useState(false);

//   if (!src) return <span className="text-cell">—</span>;

//   return (
//     <>
//       <img
//         src={src}
//         alt={alt || ''}
//         className="h-10 w-10 cursor-zoom-in rounded border border-line object-cover"
//         onError={(e) => { e.currentTarget.style.display = 'none'; }}
//         onMouseEnter={() => setHover(true)}
//         onMouseLeave={() => setHover(false)}
//       />
//       {hover && (
//         <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/40">
//           <img
//             src={src}
//             alt={alt || ''}
//             style={{ width: PREVIEW, height: PREVIEW }}
//             className="rounded-lg border border-line bg-white object-cover shadow-xl"
//           />
//         </div>
//       )}
//     </>
//   );
// }

// /* One result table. `columns[].total` marks a column the totals row sums; the
//    server sends its own totals so the figure covers the whole result set
//    rather than just the visible page. */
// function Section({ section, data, tone }) {
//   const columns = section.columns || [];
//   const rows = data?.rows || [];
//   const totals = data?.totals || {};

//   return (
//     <div className="card">
//       {section.title && (
//         <div
//           className={
//             'card-head '
//             + (tone === 'green' ? 'bg-okgreen text-white' : '')
//           }
//         >
//           <span className="card-title">
//             {tone === 'green' && <Icon name="chart" size={15} />}
//             {section.title}
//           </span>
//           {data?.count !== undefined && tone !== 'green' && (
//             <span className="pill pill-blue">{data.count} records</span>
//           )}
//         </div>
//       )}
//       <div className="card-body">
//         <div className="overflow-x-auto">
//           <table className="dt">
//             <thead>
//               <tr>
//                 {columns.map((c) => (
//                   <th key={c.t} className={isNumeric(c) ? 'text-right' : ''}>{c.t}</th>
//                 ))}
//               </tr>
//             </thead>
//             <tbody>
//               {rows.length === 0 && (
//                 <tr>
//                   <td colSpan={columns.length} className="dt-empty">No data found</td>
//                 </tr>
//               )}
//               {rows.map((row, i) => (
//                 <tr key={row._id || i}>
//                   {columns.map((c) => (
//                     <td key={c.t} className={isNumeric(c) ? 'text-right' : ''}>
//                       {c.f === 'image'
//                         ? <HoverImage src={row[c.k]} />
//                         : c.link
//                           /* a column that names a destination renders as a
//                              link - used by Master Stock Report to open one
//                              barcode's own report. Blank cells stay plain, so
//                              a row with nothing to point at has nothing to
//                              click. */
//                           ? (cellOf(row, c)
//                             ? <a className="text-brand underline hover:opacity-80" href={c.link(row)}>{cellOf(row, c)}</a>
//                             : '')
//                           : cellOf(row, c)}
//                     </td>
//                   ))}
//                 </tr>
//               ))}
//             </tbody>
//             {section.totalsRow && (
//               <tfoot>
//                 <tr className="font-bold">
//                   {columns.map((c, i) => (
//                     <td key={c.t} className={isNumeric(c) ? 'text-right' : ''}>
//                       {i === 0 ? 'Total' : (c.total ? fmt('amount', totals[c.k] ?? 0) : '')}
//                     </td>
//                   ))}
//                 </tr>
//               </tfoot>
//             )}
//           </table>
//         </div>
//       </div>
//     </div>
//   );
// }

// /* The standalone totals table some reports print under their groups, so the
//    figure covers every group rather than the one table above it. */
// function GrandTotal({ columns, totals }) {
//   return (
//     <div className="card">
//       <div className="card-body">
//         <table className="dt">
//           <thead>
//             <tr>
//               <th />
//               {columns.map((c) => (
//                 <th key={c.t} className={isNumeric(c) ? 'text-right' : ''}>{c.t}</th>
//               ))}
//             </tr>
//           </thead>
//           <tbody>
//             <tr className="font-bold">
//               <td>Total</td>
//               {columns.map((c) => (
//                 <td key={c.t} className={isNumeric(c) ? 'text-right' : ''}>
//                   {fmt(c.f || 'amount', (totals || {})[c.k] ?? 0)}
//                 </td>
//               ))}
//             </tr>
//           </tbody>
//         </table>
//       </div>
//     </div>
//   );
// }

// /* `toolbar` - optional, (api) => a node shown beside Reset / Search, for a
//    report with an action of its own (Barcode Report's Import). api.searchFor
//    runs the report with some filters set - {} runs it again as it stands -
//    so an action that changed the data can show the result. */
// export default function ReportView({ spec, toolbar = null }) {
//   const { business, location, finYear } = useScope();

//   const [draft, setDraft] = useState(() => blankFilters(spec));
//   const [applied, setApplied] = useState(() => blankFilters(spec));
//   /* which filter fields are on screen right now - see initialVisible() */
//   const [visible, setVisible] = useState(() => initialVisible(spec));
//   const [tab, setTab] = useState(spec.tabs?.[0]?.k || '');
//   const [data, setData] = useState(null);
//   const [page, setPage] = useState(1);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState('');
//   /* a searchOnly report shows nothing until its required filter is filled in,
//      matching the deployed screen's empty initial state */
//   const [searched, setSearched] = useState(!spec.searchOnly);

//   const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

//   const required = (spec.filters || []).filter((f) => f.req);

//   function addFilter(k) { setVisible((v) => new Set(v).add(k)); }
//   /* removing a filter also blanks its value - otherwise a value typed before
//      it was hidden would still apply on the next Search with no field on
//      screen to explain why */
//   function removeFilter(k) {
//     setVisible((v) => { const n = new Set(v); n.delete(k); return n; });
//     set(k, Array.isArray(draft[k]) ? [] : '');
//   }

//   /* tabs carry their own tiles and columns; a report without tabs uses the
//      spec's own */
//   const activeTab = spec.tabs?.find((t) => t.k === tab) || null;
//   const sections = activeTab?.sections || spec.sections || [];
//   const tiles = activeTab?.tiles || spec.tiles || [];

//   const load = useCallback(async () => {
//     if (!business) { setData(null); return; }
//     if (!searched) return;

//     setLoading(true);
//     setError('');

//     const qs = new URLSearchParams({
//       page: String(page),
//       perPage: String(spec.perPage || 15),
//       business: business || '',
//       location: location || '',
//       finYear: finYear || '',
//     });
//     if (tab) qs.set('tab', tab);
//     Object.entries(applied).forEach(([k, v]) => {
//       if (Array.isArray(v)) { if (v.length) qs.set(k, v.join(',')); }
//       else if (v) qs.set(k, v);
//     });

//     try {
//       const r = await fetch('/api/reports/' + spec.slug + '?' + qs);
//       const d = await r.json();
//       if (!r.ok) { setError(d.error || 'Could not run that report.'); setData(null); return; }
//       setData(d);
//     } catch {
//       setError('Could not reach the server.');
//       setData(null);
//     } finally {
//       setLoading(false);
//     }
//   }, [spec.slug, spec.perPage, page, applied, tab, business, location, finYear, searched]);

//   useEffect(() => { load(); }, [load]);
//   useEffect(() => { setPage(1); }, [applied, tab, business, location, finYear]);

//   function search() {
//     const missing = required.find((f) => {
//       const v = draft[f.k];
//       return Array.isArray(v) ? !v.length : !String(v || '').trim();
//     });
//     if (missing) { setError(missing.label + ' is required.'); return; }
//     setError('');
//     setApplied(draft);
//     setSearched(true);
//   }

//   function searchFor(values = {}) {
//     const next = { ...draft, ...values };
//     setVisible((v) => { const n = new Set(v); Object.keys(values).forEach((k) => n.add(k)); return n; });
//     setDraft(next);
//     setError('');
//     /* a new object every time, so the report runs even when nothing changed */
//     setApplied({ ...next });
//     setSearched(true);
//   }

//   function reset() {
//     const blank = blankFilters(spec);
//     setDraft(blank);
//     setApplied(blank);
//     setVisible(initialVisible(spec));
//     setError('');
//     setSearched(!spec.searchOnly);
//     if (spec.searchOnly) setData(null);
//   }

//   /* Exports carry the page on screen, the same limitation every other list in
//      this project has. Multi-table reports export the first table. */
//   const exportCols = sections[0]?.columns || [];
//   const exportHeaders = () => exportCols.map((c) => c.t);
//   const exportRows = () =>
//     ((data?.sections?.[0]?.rows) || []).map((r) => exportCols.map((c) => cellOf(r, c)));

//   /* dynamicSections: the API decides how many tables and names each one, so
//      the columns come from the single spec section and the title from the
//      response */
//   const rendered = spec.dynamicSections
//     ? (data?.sections || []).map((s, i) => ({
//       key: s.title || i,
//       section: { ...(sections[0] || {}), title: s.title },
//       data: s,
//     }))
//     : sections.map((section, i) => ({
//       key: section.key || i,
//       section,
//       data: data?.sections?.[i],
//     }));

//   /* the tab strip, rendered either above the filter card or below it -
//      Supplier / Customer Outstanding put theirs at the top because each tab is
//      a different question with its own filters */
//   const tabStrip = spec.tabs ? (
//     <div className="mb-3 flex gap-1 border-b border-line">
//       {spec.tabs.map((t) => (
//         <button
//           key={t.k}
//           type="button"
//           onClick={() => setTab(t.k)}
//           className={
//             'rounded-t-md px-4 py-2 text-[13.5px] '
//             + (tab === t.k
//               ? 'bg-brand font-bold text-white'
//               : 'text-brand-link hover:bg-[#f5f8fd]')
//           }
//         >
//           {t.label}
//         </button>
//       ))}
//     </div>
//   ) : null;

//   return (
//     <>
//       {/* ------------------------------------------------------ heading --- */}
//       {spec.subtitle && (
//         <div className="mb-3">
//           <h2 className="flex items-center gap-2 text-[17px] font-bold text-ink">
//             <Icon name="chart" size={18} /> {spec.title}
//           </h2>
//           <p className="text-[13px] text-inkmuted">{spec.subtitle}</p>
//         </div>
//       )}

//       {spec.tabsPosition === 'top' && tabStrip}

//       {/* ------------------------------------------------------- filters --- */}
//       <div className="card">
//         <div className="card-head">
//           <span className="card-title">
//             <Icon name="filter" size={15} />
//             {spec.filterTitle || (spec.subtitle ? 'Report Filters' : 'Filters')}
//           </span>
//         </div>
//         <div className="card-body">
//           {error && <div className="flash flash-err">{error}</div>}
//           {!business && <div className="flash flash-err">Select a business in the top bar.</div>}

//           {spec.filterLayout === 'rows' ? (
//             /* EVERY FILTER ON SCREEN, name on the left and its input on the
//                right. A report opts into this with filterLayout: 'rows' when its
//                filters are the point of the screen; the default stays the
//                "pick what you need" panel, which is what keeps the other
//                reports from opening as a wall of empty boxes.

//                No Add Filter button and no per-filter remove: nothing is hidden,
//                so there is nothing to add back or take away. */
//             <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 md:grid-cols-2 xl:grid-cols-4">
//               {(spec.filters || []).map((f) => (
//                 <div key={f.k} className="flex items-center gap-3">
//                   <label className="w-[104px] shrink-0 text-[12.5px] leading-tight text-ink">
//                     {f.label}{f.req && <span className="f-req">*</span>}
//                   </label>
//                   <div className="min-w-0 flex-1">
//                     <Filter f={f} value={draft[f.k]} onChange={(v) => set(f.k, v)} business={business} />
//                   </div>
//                 </div>
//               ))}
//             </div>
//           ) : (
//             <div className="flex flex-wrap items-end gap-x-[18px] gap-y-3.5">
//               {(spec.filters || []).filter((f) => visible.has(f.k)).map((f) => (
//                 <div key={f.k} className="w-full sm:w-[228px]">
//                   <div className="mb-[5px] flex items-center justify-between">
//                     <label className="block text-[13px] text-ink">
//                       {f.label}{f.req && <span className="f-req">*</span>}
//                     </label>
//                     {!f.req && (
//                       <button
//                         type="button"
//                         className="text-[#9aa6ba] hover:text-danger"
//                         title={'Remove ' + f.label}
//                         onClick={() => removeFilter(f.k)}
//                       >
//                         <Icon name="x" size={12} />
//                       </button>
//                     )}
//                   </div>
//                   <Filter f={f} value={draft[f.k]} onChange={(v) => set(f.k, v)} business={business} />
//                 </div>
//               ))}
//               <AddFilterMenu filters={spec.filters || []} visible={visible} onAdd={addFilter} />
//             </div>
//           )}

//           <div className="mt-4 flex items-center gap-2">
//             {spec.hint && <span className="text-[12.5px] text-inkmuted">{spec.hint}</span>}
//             <span className="flex-1" />
//             {toolbar ? toolbar({ searchFor, filters: applied, searched }) : null}
//             <button type="button" className="btn" onClick={reset}>
//               <Icon name="refresh" size={14} /> Reset
//             </button>
//             <button type="button" className="btn btn-primary" onClick={search} disabled={loading}>
//               {loading ? <span className="spin" /> : <Icon name="search" size={14} />} Search
//             </button>
//           </div>
//         </div>
//       </div>

//       {!searched ? (
//         <div className="card">
//           <div className="card-body dt-empty">Use the filter above to search.</div>
//         </div>
//       ) : (
//         <>
//           {/* ---------------------------------------------------- tabs --- */}
//           {spec.tabsPosition !== 'top' && tabStrip}

//           {/* A report may report on its own limits. The stock reports use
//               this to say, when a window reaches back before the movement
//               ledger existed, that the earlier period was never recorded -
//               so an empty month reads as missing data rather than as a month
//               with no trade. Stating the gap is the alternative to filling
//               it with numbers nobody captured. */}
//           {data?.coverage?.note && (
//             <div className="card">
//               <div className="card-body">
//                 <div className="flash flash-err">{data.coverage.note}</div>
//               </div>
//             </div>
//           )}

//           {/* --------------------------------------------------- tiles --- */}
//           {tiles.length > 0 && (
//             <div
//               className={
//                 'mb-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 '
//                 + (TILE_COLS[tiles.length] || 'xl:grid-cols-5')
//               }
//             >
//               {tiles.map((t) => (
//                 <div key={t.k} className="flex overflow-hidden rounded-lg border border-line bg-white">
//                   <span className={'flex w-16 items-center justify-center text-white/90 ' + (t.cls || 'bg-brand')}>
//                     <Icon name={t.icon || 'chart'} size={24} />
//                   </span>
//                   <span className="px-3 py-3">
//                     <small className="block text-[11.5px] uppercase tracking-wide text-[#5d6b83]">
//                       {t.label}
//                     </small>
//                     <b className="text-[20px]">
//                       {loading
//                         ? <span className="spin" />
//                         : fmt(t.f || 'amount', data?.tiles?.[t.k] ?? 0)}
//                     </b>
//                   </span>
//                 </div>
//               ))}
//             </div>
//           )}

//           {/* ------------------------------------------------- exports --- */}
//           <div className="mb-3 flex flex-wrap items-center gap-2.5">
//             {data?.total !== undefined && (
//               <span className="text-[13.5px] font-semibold">
//                 {spec.countLabel || 'Total Records'} {data.total}
//               </span>
//             )}
//             <span className="flex-1" />
//             <button
//               type="button" className="btn"
//               onClick={() => download(spec.slug + '.csv', toCsv(exportHeaders(), exportRows()), 'text/csv')}
//             >
//               <Icon name="file" size={14} /> Export CSV
//             </button>
//             <button
//               type="button" className="btn"
//               onClick={() => download(
//                 spec.slug + '.xls',
//                 toXlsHtml(spec.title, exportHeaders(), exportRows()),
//                 'application/vnd.ms-excel'
//               )}
//             >
//               <Icon name="file" size={14} /> Export to Excel
//             </button>
//             <button
//               type="button" className="btn"
//               onClick={() => printTable(spec.title, exportHeaders(), exportRows())}
//             >
//               <Icon name="printer" size={14} /> Print
//             </button>
//           </div>

//           {loading && (
//             <div className="card"><div className="card-body dt-empty"><span className="spin" /></div></div>
//           )}

//           {!loading && rendered.length === 0 && (
//             <div className="card"><div className="card-body dt-empty">No data found</div></div>
//           )}

//           {!loading && rendered.map(({ key, section, data: sectionData }) => (
//             <Section
//               key={key}
//               section={section}
//               data={sectionData}
//               tone={spec.dynamicSections ? 'green' : undefined}
//             />
//           ))}

//           {!loading && spec.grandTotal && data && (
//             <GrandTotal columns={spec.grandTotal} totals={data.grandTotal} />
//           )}

//           {!loading && spec.paginated !== false && data && (
//             <div className="flex items-center pb-4 text-[13px] text-cell">
//               <span>
//                 Page <b className="text-brand-link">{data.page || 1}</b> of {data.pages || 1}
//               </span>
//               <span className="flex-1" />
//               <span className="flex gap-2">
//                 <button
//                   className="btn"
//                   disabled={(data.page || 1) <= 1}
//                   onClick={() => setPage((p) => p - 1)}
//                 >
//                   Previous
//                 </button>
//                 <button
//                   className="btn"
//                   disabled={(data.page || 1) >= (data.pages || 1)}
//                   onClick={() => setPage((p) => p + 1)}
//                 >
//                   Next
//                 </button>
//               </span>
//             </div>
//           )}
//         </>
//       )}
//     </>
//   );
// }




























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

   Five optional shapes a spec can ask for:

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
     exportAll        Export CSV / Excel / Print carry the WHOLE result, not
                      the page on screen: the same search asked again with
                      export=1, which the report's API answers with every row
                      (Barcode Report - a barcode series runs to thousands).

   An API may also answer `note`, a line said beside the record count (what
   the search was taken as).

   And one on a filter:

     oneOf: true      one of several searches, any of which is enough (Barcode
                      Report: Barcode OR Item Code). Shown from the start and
                      marked * like a required filter; Search asks for at
                      least one of them.
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
      .filter((f) => f.req || f.oneOf || (Array.isArray(blanks[f.k]) ? blanks[f.k].length : blanks[f.k]))
      .map((f) => f.k)
  );
};

const isNumeric = (col) => col.f === 'amount' || col.f === 'count' || col.num;

function paginationItems(totalPages, currentPage) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  if (currentPage <= 3) return [1, 2, 3, 'right-ellipsis', totalPages];
  if (currentPage >= totalPages - 2) {
    return [1, 'left-ellipsis', totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, 'left-ellipsis', currentPage - 1, currentPage, currentPage + 1, 'right-ellipsis', totalPages];
}

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
function RefFilter({ f, value, onChange, depValue }) {
  /* dependsOn: the list is NARROWED BY ANOTHER FILTER's value - the Master
     Stock Report's supplier picker offers only the chosen city's vendors -
     and the control stays disabled until that value exists, its placeholder
     saying which box to fill first. */
  const waiting = Boolean(f.dependsOn) && !String(depValue || '').trim();
  const params = f.dependsOn && !waiting
    ? { [f.dependsParam || f.dependsOn]: String(depValue).trim() }
    : null;
  const { options, loading } = useOptions(f.ref, '', !waiting, params);
  return (
    <MultiSelect
      mode={f.multi ? 'multi' : 'single'}
      options={waiting ? [] : options}
      loading={loading}
      disabled={waiting}
      value={f.multi ? (value || []) : (value || '')}
      placeholder={waiting ? (f.waitPlaceholder || 'Select...') : (f.all || 'Select...')}
      maxOptions={f.showAllOptions ? Infinity : undefined}
      onChange={onChange}
    />
  );
}

/* Several typed values, each kept as a chip.

   Used where a picker is no use because the list would be enormous - barcode
   numbers, of which there is one per piece of stock. Enter or a comma commits
   what has been typed; Backspace on an empty box takes the last one back off.

   The value is an ARRAY, which ReportView already sends comma-joined, so the
   route reads it the same way it reads a multi-select. */
function TagsFilter({ f, value, onChange, business }) {
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState([]);
  const [open, setOpen] = useState(false);
  const chips = Array.isArray(value) ? value : (value ? [value] : []);

  /* Suggestions, when the filter names an endpoint to ask.

     Debounced, and the answer is discarded if the term has moved on - the
     same guard the till's item box needed, and for the same reason: a slow
     reply must not repopulate a list the operator has already typed past. */
  useEffect(() => {
    if (!f.suggest) return undefined;
    const q = term.trim();
    if (!q) { setHits([]); return undefined; }

    let off = false;
    const timer = setTimeout(() => {
      const qs = new URLSearchParams({ q, business: business || '' });
      fetch(f.suggest + '?' + qs, { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => { if (!off) { setHits(d.options || []); setOpen(true); } })
        .catch(() => { if (!off) setHits([]); });
    }, 250);

    return () => { off = true; clearTimeout(timer); };
  }, [f.suggest, term, business]);

  const commit = (raw) => {
    const parts = String(raw).split(',').map((v) => v.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = [...chips];
    parts.forEach((p) => { if (!next.some((c) => c.toLowerCase() === p.toLowerCase())) next.push(p); });
    onChange(next);
    setTerm('');
  };

  /* offered but not yet chosen - a barcode already on the list is not
     suggested again */
  const choices = hits.filter((h) => !chips.some((c) => c.toLowerCase() === String(h.value).toLowerCase()));

  return (
    <div className="relative">
    <div className="f-input flex flex-wrap items-center gap-1 !h-auto min-h-[34px] py-1">
      {chips.map((c) => (
        <span key={c} className="inline-flex items-center gap-1 rounded bg-pillgrey px-1.5 py-0.5 text-[12px]">
          {c}
          <button
            type="button"
            aria-label={'Remove ' + c}
            className="text-inkmuted hover:text-danger"
            onClick={() => onChange(chips.filter((x) => x !== c))}
          >
            <Icon name="x" size={10} />
          </button>
        </span>
      ))}
      <input
        className="min-w-[90px] flex-1 border-0 bg-transparent p-0 text-[13px] outline-none"
        placeholder={chips.length ? '' : (f.placeholder || '')}
        value={term}
        onChange={(e) => {
          const v = e.target.value;
          if (v.includes(',')) commit(v);
          else setTerm(v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(term); }
          if (e.key === 'Backspace' && !term && chips.length) onChange(chips.slice(0, -1));
        }}
        /* committed on blur too, so a value left in the box is not silently
           dropped when the operator goes straight for Search */
        /* Committed on blur, IMMEDIATELY.

           This used to wait 150ms, which lost the last value typed: clicking
           Search blurs the box, the search ran on the filters as they were,
           and only afterwards did the delayed commit add the chip - so the
           screen showed two barcodes and the results answered one.

           The delay was there so a click on a suggestion would register
           before the box committed, but the suggestion buttons already
           preventDefault on mousedown, which stops the blur firing at all.
           So nothing needs the wait. */
        onBlur={() => { commit(term); setOpen(false); }}
        onFocus={() => { if (choices.length) setOpen(true); }}
      />
    </div>

    {open && choices.length > 0 && (
      <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-auto rounded border border-line bg-white shadow-lg">
        {choices.map((h) => (
          <button
            key={h.value}
            type="button"
            className="block w-full border-b border-line px-2 py-1.5 text-left text-[12.5px] last:border-b-0 hover:bg-[#f4f7fb]"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { commit(h.value); setOpen(false); }}
          >
            {h.label || h.value}
          </button>
        ))}
      </div>
    )}
    </div>
  );
}

/* A city, typed with suggestions - the box another filter can depend on.
   Suggestions come from f.suggest (the Master Stock Report asks
   /api/reports/supplier-cities: only cities its suppliers are in), else the
   all-India list at /api/cities. Debounced, and a reply for a term already
   typed past is dropped. The free text itself is the value; picking a
   suggestion just completes the spelling. The suggestion buttons
   preventDefault on mousedown so the click lands before blur closes the
   list - the TagsFilter pattern. */
function CityFilter({ f, value, onChange, business }) {
  const [open, setOpen] = useState(false);
  const term = String(value || '').trim();
  const [cities, setCities] = useState([]);
  useEffect(() => {
    let off = false;
    const timer = setTimeout(() => {
      const qs = new URLSearchParams({ q: term, business: business || '' });
      fetch((f.suggest || '/api/cities') + '?' + qs, { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => { if (!off) setCities(d.options || []); })
        .catch(() => { if (!off) setCities([]); });
    }, 200);
    return () => { off = true; clearTimeout(timer); };
  }, [f.suggest, term, business]);
  const picks = cities.filter((c) => String(c.value).toLowerCase() !== term.toLowerCase());
  return (
    <div className="relative">
      <input
        className="f-input"
        placeholder={f.placeholder || 'Type city'}
        value={value || ''}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      />
      {open && picks.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-auto rounded border border-line bg-white shadow-lg">
          {picks.map((c) => (
            <button
              key={c.value}
              type="button"
              className="block w-full border-b border-line px-2 py-1.5 text-left text-[12.5px] last:border-b-0 hover:bg-[#f4f7fb]"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(c.value); setOpen(false); }}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Filter({ f, value, onChange, business, depValue }) {
  if (f.type === 'tags') return <TagsFilter f={f} value={value} onChange={onChange} business={business} />;
  if (f.type === 'city') return <CityFilter f={f} value={value} onChange={onChange} business={business} />;
  if (f.type === 'ref') return <RefFilter f={f} value={value} onChange={onChange} depValue={depValue} />;

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
function SupplierDetailsModal({ row, business, onClose }) {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({
      business: business || '',
      supplierId: row.supplierId || '',
      supplierCode: row.supplierCode || '',
      page: String(page),
      perPage: '15',
    });
    fetch('/api/reports/master-stock-report/supplier-details?' + params, { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not load supplier details.');
        if (!cancelled) setData(result);
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError.message || 'Could not load supplier details.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [business, row.supplierId, row.supplierCode, page]);

  const supplier = data?.supplier || {};
  const transactions = data?.transactions || [];
  const detail = (label, value) => (
    <div className="min-w-0 border-b border-line px-3 py-2">
      <div className="text-[9px] uppercase text-[#71809a]">{label}</div>
      <div className="mt-1 break-words text-[11px] font-semibold text-[#33445f]">{value || '-'}</div>
    </div>
  );
  const docDate = (value) => value ? new Date(value).toLocaleDateString('en-GB') : '-';

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-3"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="supplier-details-title"
        className="w-full max-w-[1140px] overflow-hidden rounded-md border-t-[3px] border-brand bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
          <div>
            <div className="text-[9px] font-bold uppercase text-brand">Supplier Details</div>
            <h2 id="supplier-details-title" className="mt-1 text-[17px] font-bold text-ink">
              {supplier.legalName || row.supplierName || 'Supplier'}
            </h2>
            <div className="mt-1 text-[10px] uppercase text-[#71809a]">
              Supplier No. <b className="text-[#33445f]">{supplier.supplierNo || row.supplierCode || '-'}</b>
            </div>
          </div>
          <button type="button" className="btn shrink-0" onClick={onClose}>
            <Icon name="x" size={13} /> Close
          </button>
        </div>
        <div className="space-y-2.5 bg-[#f4f7fb] p-3">
          <div className="overflow-hidden rounded border border-line bg-white">
            <h3 className="border-b border-line px-3 py-2 text-[10px] font-bold uppercase text-[#33445f]">
              Supplier Information
            </h3>
            {loading ? (
              <div className="p-4 text-center"><span className="spin" /></div>
            ) : error ? (
              <div className="p-3"><div className="flash flash-err" role="alert">{error}</div></div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3">
                {detail('Legal Name', supplier.legalName)}
                {detail('Contact Person', supplier.contactPerson)}
                {detail('GST Status', supplier.gstStatus)}
                {detail('Mobile', supplier.mobile)}
              </div>
            )}
          </div>
          {!loading && !error && (
            <>
              <div className="overflow-x-auto rounded border border-line bg-white">
                <table className="dt">
                  <thead>
                    <tr>{['Location', 'GRC No.', 'GRC Date', 'Stock Point'].map((label) => <th key={label}>{label}</th>)}</tr>
                  </thead>
                  <tbody>
                    {!transactions.length ? (
                      <tr><td colSpan={4} className="dt-empty">No receipt records found for this supplier.</td></tr>
                    ) : transactions.map((transaction, index) => (
                      <tr key={`${transaction.docNo}-${index}`}>
                        <td>{transaction.location || '-'}</td>
                        <td>{transaction.docNo || '-'}</td>
                        <td>{docDate(transaction.docDate)}</td>
                        <td>{transaction.stockPoint || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.pages > 1 && (
                <div className="flex items-center justify-between text-[11px] text-inkmuted">
                  <span>Page {data.page} of {data.pages} · {data.total} receipts</span>
                  <div className="flex gap-2">
                    <button type="button" className="btn" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button>
                    <button type="button" className="btn" disabled={page >= data.pages} onClick={() => setPage((current) => current + 1)}>Next</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function ItemDetailsModal({ row, business, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({
      business: business || '',
      itemId: row.itemId || '',
      itemCode: row.itemCode || '',
      itemName: row.itemName || '',
    });
    fetch('/api/reports/master-stock-report/item-details?' + params, { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not load item details.');
        if (!cancelled) setData(result);
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError.message || 'Could not load item details.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [business, row.itemId, row.itemCode, row.itemName]);

  const item = data?.item || {};
  const detail = (label, value) => (
    <div className="min-w-0 border-b border-line px-3 py-2">
      <div className="text-[9px] uppercase text-[#71809a]">{label}</div>
      <div className="mt-1 break-words text-[11px] font-semibold text-[#33445f]">{value || '-'}</div>
    </div>
  );
  const date = (value) => value ? new Date(value).toLocaleDateString('en-GB') : '-';
  const headings = ['Location', 'GRC No.', 'GRC Date', 'Stock Point', 'Delivery No.', 'Delivery Date', 'LR No.', 'Transporter'];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-3"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-details-title"
        className="w-full max-w-[1140px] overflow-hidden rounded-md border-t-[3px] border-brand bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
          <div>
            <div className="text-[9px] font-bold uppercase text-brand">Item Details</div>
            <h2 id="item-details-title" className="mt-1 text-[17px] font-bold text-ink">
              {row.itemName || 'Item'}
            </h2>
          </div>
          <button type="button" className="btn shrink-0" onClick={onClose}>
            <Icon name="x" size={13} /> Close
          </button>
        </div>
        <div className="space-y-2.5 bg-[#f4f7fb] p-3">
          <div className="overflow-hidden rounded border border-line bg-white">
            <h3 className="border-b border-line px-3 py-2 text-[10px] font-bold uppercase text-[#33445f]">
              Item Information
            </h3>
            {loading ? (
              <div className="p-4 text-center"><span className="spin" /></div>
            ) : error ? (
              <div className="p-3"><div className="flash flash-err" role="alert">{error}</div></div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3">
                {detail('Item Name', item.name)}
                {detail('Group', item.group)}
                {detail('UOM', item.uom)}
                {detail('HSN Code', item.hsnCode)}
                {detail('HSN Description', item.hsnDescription)}
                {detail('Item Type', item.itemType)}
                {detail('Unique Barcode', item.uniqueBarcode)}
              </div>
            )}
          </div>
          {!loading && !error && (
            <div className="overflow-x-auto rounded border border-line bg-white">
              <table className="dt">
                <thead>
                  <tr>{headings.map((heading) => <th key={heading}>{heading}</th>)}</tr>
                </thead>
                <tbody>
                  {!data?.receipts?.length ? (
                    <tr><td colSpan={headings.length} className="dt-empty">No delivery challan details found for this item.</td></tr>
                  ) : data.receipts.map((receipt, index) => (
                    <tr key={`${receipt.grcNo}-${receipt.deliveryNo}-${index}`}>
                      <td>{receipt.location || '-'}</td>
                      <td>{receipt.grcNo || '-'}</td>
                      <td>{date(receipt.grcDate)}</td>
                      <td>{receipt.stockPoint || '-'}</td>
                      <td>{receipt.deliveryNo || '-'}</td>
                      <td>{date(receipt.deliveryDate)}</td>
                      <td>{receipt.lrNo || '-'}</td>
                      <td>{receipt.transporter || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// function Section({ section, data, tone, onSupplierSelect, onItemSelect }) {
//   const columns = section.columns || [];
//   const rows = data?.rows || [];
//   const totals = data?.totals || {};

//   return (
//     <div className="card">
//       {section.title && (
//         <div
//           className={
//             'card-head '
//             + (tone === 'green' ? 'bg-okgreen text-white' : '')
//           }
//         >
//           <span className="card-title">
//             {tone === 'green' && <Icon name="chart" size={15} />}
//             {section.title}
//           </span>
//           {data?.count !== undefined && tone !== 'green' && (
//             <span className="pill pill-blue">{data.count} records</span>
//           )}
//         </div>
//       )}
//       <div className="card-body">
//         <div className="overflow-x-auto">
//           <table className="dt">
//             <thead>
//               <tr>
//                 {columns.map((c) => (
//                   <th key={c.t} className={isNumeric(c) ? 'text-right' : ''}>{c.t}</th>
//                 ))}
//               </tr>
//             </thead>
//             <tbody>
//               {rows.length === 0 && (
//                 <tr>
//                   <td colSpan={columns.length} className="dt-empty">No data found</td>
//                 </tr>
//               )}
//               {rows.map((row, i) => (
//                 <tr key={row._id || i}>
//                   {columns.map((c) => (
//                     <td key={c.t} className={isNumeric(c) ? 'text-right' : ''}>
//                       {c.f === 'image'
//                         ? <HoverImage src={row[c.k]} />
//                         : c.modal === 'supplier'
//                           ? (cellOf(row, c) && row.supplierId
//                             ? <button
//                                 type="button"
//                                 className="text-brand underline hover:opacity-80"
//                                 onClick={() => onSupplierSelect(row)}
//                               >
//                                 {cellOf(row, c)}
//                               </button>
//                             : cellOf(row, c))
//                         : c.modal === 'item'
//                           ? (cellOf(row, c)
//                             ? <button
//                                 type="button"
//                                 className="text-brand underline hover:opacity-80"
//                                 onClick={() => onItemSelect(row)}
//                               >
//                                 {cellOf(row, c)}
//                               </button>
//                             : '')
//                         : c.linkStyle
//                           ? <span className="text-brand underline">{cellOf(row, c)}</span>
//                         : c.link
//                           /* a column that names a destination renders as a
//                              link - used by Master Stock Report to open one
//                              barcode's own report. Blank cells stay plain, so
//                              a row with nothing to point at has nothing to
//                              click. */
//                           ? (cellOf(row, c) && c.link(row)
//                             ? <a className="text-brand underline hover:opacity-80" href={c.link(row)}>{cellOf(row, c)}</a>
//                             : cellOf(row, c))
//                           : cellOf(row, c)}
//                     </td>
//                   ))}
//                 </tr>
//               ))}
//             </tbody>
//             {section.totalsRow && (
//               <tfoot>
//                 <tr className="font-bold">
//                   {columns.map((c, i) => (
//                     <td key={c.t} className={isNumeric(c) ? 'text-right' : ''}>
//                       {i === 0 ? 'Total' : (c.total ? fmt('amount', totals[c.k] ?? 0) : '')}
//                     </td>
//                   ))}
//                 </tr>
//               </tfoot>
//             )}
//           </table>
//         </div>
//       </div>
//     </div>
//   );
// }





function Section({ section, data, tone, onSupplierSelect, onItemSelect }) {
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
                      {c.f === 'image'
                        ? <HoverImage src={row[c.k]} />
                        : c.modal === 'supplier'
                          ? (cellOf(row, c) && row.supplierId
                            ? <button
                                type="button"
                                className="text-brand underline hover:opacity-80"
                                onClick={() => onSupplierSelect(row)}
                              >
                                {cellOf(row, c)}
                              </button>
                            : cellOf(row, c))
                        : c.modal === 'item'
                          ? (cellOf(row, c)
                            ? <button
                                type="button"
                                className="text-brand underline hover:opacity-80"
                                onClick={() => onItemSelect(row)}
                              >
                                {cellOf(row, c)}
                              </button>
                            : '')
                        : c.linkStyle
                          ? <span className="text-brand underline">{cellOf(row, c)}</span>
                        : c.link
                          /* a column that names a destination renders as a
                             link - used by Master Stock Report to open one
                             barcode's own report. Blank cells stay plain, so
                             a row with nothing to point at has nothing to
                             click. */
                          ? (cellOf(row, c) && c.link(row)
                            ? <a className="text-brand underline hover:opacity-80" href={c.link(row)}>{cellOf(row, c)}</a>
                            : cellOf(row, c))
                          : cellOf(row, c)}
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
   figure covers every group rather than the one table above 

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

/* ---- grouped filter layout (filterLayout: 'groups') ----------------------

   The filter card as the Master Stock Report mock draws it: the date range
   on its own line top right, then one bordered section per entry of
   spec.filterGroups - coloured left edge, icon, a fold button - each
   holding labelled inputs. A field entry is a filter KEY, or
   { label, range: [minKey, maxKey] }, which renders one label over a
   Start / End pair so eleven Min/Max keys read as the six ranges they are. */
const GROUP_LABEL = 'mb-1 block text-[11.5px] font-semibold uppercase tracking-wide text-[#5d6b83]';

function FilterGroups({ spec, draft, set, business }) {
  const [folded, setFolded] = useState({});
  const byKey = new Map((spec.filters || []).map((f) => [f.k, f]));
  const [fromK, toK] = spec.headerDates || [];

  return (
    <>
      {fromK && (
        <div className="mb-4 flex flex-wrap items-center justify-end gap-x-5 gap-y-2">
          {[[fromK, 'From Date'], [toK, 'To Date']].filter(([k]) => k).map(([k, lab]) => (
            <label key={k} className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-wide text-[#5d6b83]">
              {lab}
              <input type="date" className="f-input !w-[150px]" value={draft[k] || ''} onChange={(e) => set(k, e.target.value)} />
            </label>
          ))}
        </div>
      )}

      {(spec.filterGroups || []).map((g) => {
        const shut = Boolean(folded[g.title]);
        return (
          /* no overflow-hidden here: it clipped the dropdowns (barcode
             suggestions, item / supplier pickers) at the section's edge.
             The header rounds its own top corners instead. */
          <div key={g.title} className="relative mb-3 rounded-md border border-line" style={{ borderLeft: '4px solid ' + g.color }}>
            <div className="flex items-center gap-2.5 rounded-tr-md px-4 py-2.5" style={{ backgroundColor: g.color + '0d' }}>
              <span className="flex h-7 w-7 items-center justify-center rounded" style={{ backgroundColor: g.color + '22', color: g.color }}>
                <Icon name={g.icon || 'filter'} size={14} />
              </span>
              <span className="text-[13px] font-bold uppercase tracking-wide text-ink">{g.title}</span>
              <span className="flex-1" />
              <button
                type="button"
                aria-label={(shut ? 'Expand ' : 'Collapse ') + g.title}
                className="flex h-6 w-6 items-center justify-center rounded border border-line bg-white text-inkmuted hover:text-ink"
                onClick={() => setFolded((o) => ({ ...o, [g.title]: !shut }))}
              >
                <Icon name={shut ? 'plus' : 'minus'} size={12} />
              </button>
            </div>
            {!shut && (
              <div className="flex flex-wrap items-start gap-x-4 gap-y-3 px-4 pb-4 pt-3">
                {(g.fields || []).map((entry) => {
                  if (typeof entry === 'string' || !entry.range) {
                    const f = byKey.get(typeof entry === 'string' ? entry : entry.k);
                    if (!f) return null;
                    return (
                      <div
                        key={f.k}
                        className={
                          'w-full '
                          + (f.k === 'discount'
                            ? 'max-w-[110px]'
                            : g.title === 'Basic Filters'
                              ? 'max-w-[145px]'
                              : 'max-w-[180px]')
                        }
                      >
                        <label className={GROUP_LABEL}>{f.label}{(f.req || f.oneOf) && <span className="f-req">*</span>}</label>
                        <Filter f={f} value={draft[f.k]} onChange={(v) => set(f.k, v)} business={business} depValue={f.dependsOn ? draft[f.dependsOn] : undefined} />
                      </div>
                    );
                  }
                  const [lo, hi] = entry.range;
                  return (
                    <div key={lo} className="w-full max-w-[180px]">
                      <label className={GROUP_LABEL}>{entry.label}</label>
                      <div className="flex gap-2">
                        <input type="text" className="f-input min-w-0 flex-1" placeholder="Start" value={draft[lo] || ''} onChange={(e) => set(lo, e.target.value)} />
                        <input type="text" className="f-input min-w-0 flex-1" placeholder="End" value={draft[hi] || ''} onChange={(e) => set(hi, e.target.value)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

/* What a report's API is asked: the page, the scope from the top bar, the tab
   and the filters as last searched. One builder for the screen and for its
   exports, so an export asks exactly what the screen shows. */
function reportQuery({ page, perPage, business, location, finYear, tab, applied }, extra = {}) {
  const qs = new URLSearchParams({
    page: String(page),
    perPage: String(perPage),
    business: business || '',
    location: location || '',
    finYear: finYear || '',
  });
  if (tab) qs.set('tab', tab);
  Object.entries(applied).forEach(([k, v]) => {
    if (Array.isArray(v)) { if (v.length) qs.set(k, v.join(',')); }
    else if (v) qs.set(k, v);
  });
  Object.entries(extra).forEach(([k, v]) => qs.set(k, v));
  return qs;
}

/* `toolbar` - optional, (api) => a node shown beside Reset / Search, for a
   report with an action of its own (Barcode Report's Import). api.searchFor
   runs the report with some filters set - {} runs it again as it stands -
   so an action that changed the data can show the result. */
export default function ReportView({ spec, toolbar = null }) {
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
  /* the export being prepared ('csv' / 'xls' / 'print') - an exportAll
     report fetches its whole result first */
  const [exporting, setExporting] = useState('');
  const [selectedSupplierRow, setSelectedSupplierRow] = useState(null);
  const [selectedItemRow, setSelectedItemRow] = useState(null);

  /* Setting a filter clears every filter that depends on it: the suppliers
     picked for one city are not a valid pick for another. */
  const set = (k, v) => setDraft((d) => {
    const next = { ...d, [k]: v };
    (spec.filters || []).forEach((f) => {
      if (f.dependsOn === k) next[f.k] = Array.isArray(d[f.k]) ? [] : '';
    });
    return next;
  });

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

  /* Only the LATEST load may land. A top-bar change, or a new search from a
     later page, asks again while an answer is still on its way - and a slower
     earlier answer must never paint over the later one (the wrong page, the
     pager out of step). */
  const loadSeq = useRef(0);
  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    const latest = () => seq === loadSeq.current;
    if (!business) { setData(null); setLoading(false); return; }
    if (!searched) { setLoading(false); return; }

    setLoading(true);
    setError('');

    const qs = reportQuery({ page, perPage: spec.perPage || 15, business, location, finYear, tab, applied });

    try {
      const r = await fetch('/api/reports/' + spec.slug + '?' + qs);
      const d = await r.json();
      if (!latest()) return;
      if (!r.ok) { setError(d.error || 'Could not run that report.'); setData(null); return; }
      setData(d);
    } catch {
      if (!latest()) return;
      setError('Could not reach the server.');
      setData(null);
    } finally {
      if (latest()) setLoading(false);
    }
  }, [spec.slug, spec.perPage, page, applied, tab, business, location, finYear, searched]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [applied, tab, business, location, finYear]);

  function search() {
    const blankValue = (v) => (Array.isArray(v) ? !v.length : !String(v || '').trim());
    const missing = required.find((f) => blankValue(draft[f.k]));
    if (missing) { setError(missing.label + ' is required.'); return; }
    /* several searches, any one of them enough */
    const oneOf = (spec.filters || []).filter((f) => f.oneOf);
    if (oneOf.length && oneOf.every((f) => blankValue(draft[f.k]))) {
      setError('Enter ' + oneOf.map((f) => f.label).join(' or ') + '.');
      return;
    }
    setError('');
    /* new filters start at page 1 in the same render - so they are asked for
       once, not at the old page and then again at page 1 */
    if (draft !== applied) setPage(1);
    setApplied(draft);
    setSearched(true);
  }

  function searchFor(values = {}) {
    const next = { ...draft, ...values };
    setVisible((v) => { const n = new Set(v); Object.keys(values).forEach((k) => n.add(k)); return n; });
    setDraft(next);
    setError('');
    setPage(1);
    /* a new object every time, so the report runs even when nothing changed */
    setApplied({ ...next });
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
     this project has - except an exportAll report's, which carry its WHOLE
     result: the search on screen asked again with export=1 (its API answers
     every row, in the order its pages show them). Multi-table reports export
     the first table. */
  const exportCols = sections[0]?.columns || [];
  const exportHeaders = () => exportCols.map((c) => c.t);
  /* -> { rows, short } - `short`: the whole result is bigger than what came
     back (an API's export cap), said out loud rather than a file that only
     looks complete */
  async function exportRows() {
    let rows = (data?.sections?.[0]?.rows) || [];
    let short = '';
    if (spec.exportAll && searched && business) {
      const qs = reportQuery({ page: 1, perPage: spec.perPage || 15, business, location, finYear, tab, applied }, { export: '1' });
      const r = await fetch('/api/reports/' + spec.slug + '?' + qs, { cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not export that report.');
      rows = d.sections?.[0]?.rows || [];
      const total = Number(d.total);
      if (Number.isFinite(total) && rows.length < total) {
        short = `Exported the first ${rows.length} of ${total} rows. Narrow the search to take the rest.`;
      }
    }
    return { rows: rows.map((r) => exportCols.map((c) => cellOf(r, c))), short };
  }
  async function runExport(kind) {
    if (exporting) return;
    /* an exportAll report asks the server for the search's whole result -
       also before its first page has come back, or after it failed - so a
       file is never an empty stand-in for rows nobody fetched. Never without
       a business: an unscoped request is every business's rows, the reason
       load() waits for one too. */
    const fetches = Boolean(spec.exportAll && searched && business);
    /* the print window opens now, on the click: one opened after waiting for
       the server is a pop-up the browser blocks */
    const win = kind === 'print' && fetches ? window.open('', '_blank') : null;
    if (kind === 'print' && fetches && !win) {
      setError('The browser blocked the print window. Allow pop-ups for this site, then press Print again.');
      return;
    }
    if (win) { win.document.write('<p style="font-family:Arial;padding:20px">Preparing the print...</p>'); win.document.close(); }
    setExporting(kind);
    /* only an export that asks the server again has news for the message
       line - every other report's exports leave it as it was, and so does
       this one while the table on screen failed to load (that still needs
       saying) */
    if (fetches && data) setError('');
    try {
      const { rows, short } = await exportRows();
      if (kind === 'csv') download(spec.slug + '.csv', toCsv(exportHeaders(), rows), 'text/csv');
      else if (kind === 'xls') download(spec.slug + '.xls', toXlsHtml(spec.title, exportHeaders(), rows), 'application/vnd.ms-excel');
      else printTable(spec.title, exportHeaders(), rows, win);
      if (short) setError(short);
    } catch (e) {
      if (win) win.close();
      setError(e.message || 'Could not export that report.');
    } finally {
      setExporting('');
    }
  }

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
        {spec.filterLayout !== 'groups' && (
          <div className="card-head">
            <span className="card-title">
              <Icon name="filter" size={15} />
              {spec.filterTitle || (spec.subtitle ? 'Report Filters' : 'Filters')}
            </span>
          </div>
        )}
        <div className="card-body">
          {error && <div className="flash flash-err">{error}</div>}
          {!business && <div className="flash flash-err">Select a business in the top bar.</div>}

          {spec.filterLayout === 'groups' ? (
            <FilterGroups spec={spec} draft={draft} set={set} business={business} />
          ) : spec.filterLayout === 'rows' ? (
            /* EVERY FILTER ON SCREEN, name on the left and its input on the
               right. A report opts into this with filterLayout: 'rows' when its
               filters are the point of the screen; the default stays the
               "pick what you need" panel, which is what keeps the other
               reports from opening as a wall of empty boxes.

               No Add Filter button and no per-filter remove: nothing is hidden,
               so there is nothing to add back or take away. */
            <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 md:grid-cols-2 xl:grid-cols-4">
              {(spec.filters || []).map((f) => (
                <div key={f.k} className="flex items-center gap-3">
                  <label className="w-[104px] shrink-0 text-[12.5px] leading-tight text-ink">
                    {f.label}{(f.req || f.oneOf) && <span className="f-req">*</span>}
                  </label>
                  <div className="min-w-0 flex-1">
                    <Filter f={f} value={draft[f.k]} onChange={(v) => set(f.k, v)} business={business} depValue={f.dependsOn ? draft[f.dependsOn] : undefined} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-x-[18px] gap-y-3.5">
              {(spec.filters || []).filter((f) => visible.has(f.k)).map((f) => (
                <div key={f.k} className="w-full sm:w-[228px]">
                  <div className="mb-[5px] flex items-center justify-between">
                    <label className="block text-[13px] text-ink">
                      {f.label}{(f.req || f.oneOf) && <span className="f-req">*</span>}
                    </label>
                    {!f.req && !f.oneOf && (
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
                  <Filter f={f} value={draft[f.k]} onChange={(v) => set(f.k, v)} business={business} depValue={f.dependsOn ? draft[f.dependsOn] : undefined} />
                </div>
              ))}
              <AddFilterMenu filters={spec.filters || []} visible={visible} onAdd={addFilter} />
            </div>
          )}

          <div className="mt-4 flex items-center gap-2">
            {spec.hint && <span className="text-[12.5px] text-inkmuted">{spec.hint}</span>}
            <span className="flex-1" />
            {toolbar ? toolbar({ searchFor, filters: applied, searched }) : null}
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
            {data?.note && <span className="text-[12.5px] text-inkmuted" role="status">{data.note}</span>}
            <span className="flex-1" />
            <button type="button" className="btn" onClick={() => runExport('csv')} disabled={Boolean(exporting)}>
              {exporting === 'csv' ? <span className="spin" /> : <Icon name="file" size={14} />} Export CSV
            </button>
            <button type="button" className="btn" onClick={() => runExport('xls')} disabled={Boolean(exporting)}>
              {exporting === 'xls' ? <span className="spin" /> : <Icon name="file" size={14} />} Export to Excel
            </button>
            <button type="button" className="btn" onClick={() => runExport('print')} disabled={Boolean(exporting)}>
              {exporting === 'print' ? <span className="spin" /> : <Icon name="printer" size={14} />} Print
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
              onSupplierSelect={setSelectedSupplierRow}
              onItemSelect={setSelectedItemRow}
            />
          ))}

          {!loading && spec.grandTotal && data && (
            <GrandTotal columns={spec.grandTotal} totals={data.grandTotal} />
          )}

          {!loading && spec.paginated !== false && data && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 bg-[#eef2f8] px-3 py-2">
              <span className="whitespace-nowrap text-[13px] text-cell">
                PAGE <b className="text-brand-link">{data.page || 1}</b> OF {data.pages || 1}
              </span>
              <nav
                aria-label="Report pagination"
                className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2 py-2 shadow-sm"
              >
                <button
                  type="button"
                  aria-label="Previous page"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-inkmuted hover:bg-[#f5f8fd] disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={(data.page || 1) <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <Icon name="chevL" size={16} />
                </button>
                {paginationItems(Number(data.pages) || 1, Number(data.page) || 1).map((item, index) => (
                  typeof item === 'number' ? (
                    <button
                      key={item}
                      type="button"
                      aria-label={'Page ' + item}
                      aria-current={item === (Number(data.page) || 1) ? 'page' : undefined}
                      className={
                        'h-8 min-w-8 rounded-md px-2 text-sm font-semibold '
                        + (item === (Number(data.page) || 1)
                          ? 'bg-[#368cf5] text-white'
                          : 'text-inkmuted hover:bg-[#f5f8fd]')
                      }
                      onClick={() => setPage(item)}
                    >
                      {item}
                    </button>
                  ) : (
                    <span key={item + index} className="px-1 text-inkmuted" aria-hidden="true">…</span>
                  )
                ))}
                <button
                  type="button"
                  aria-label="Next page"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-inkmuted hover:bg-[#f5f8fd] disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={(data.page || 1) >= (data.pages || 1)}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <Icon name="chevR" size={16} />
                </button>
              </nav>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn"
                  disabled={(data.page || 1) <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={(data.page || 1) >= (data.pages || 1)}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {selectedSupplierRow && (
        <SupplierDetailsModal
          row={selectedSupplierRow}
          business={business}
          onClose={() => setSelectedSupplierRow(null)}
        />
      )}
      {selectedItemRow && (
        <ItemDetailsModal
          row={selectedItemRow}
          business={business}
          onClose={() => setSelectedItemRow(null)}
        />
      )}
    </>
  );
}
