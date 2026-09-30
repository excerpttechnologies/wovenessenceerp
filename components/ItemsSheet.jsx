// "use client";

// import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
// import Icon from "./Icon";
// import {
//   sheetColumns, parseTsv, toTsv, planPaste, planClear, rowErrors, lockReason, needsCheck, isBlankRow,
//   describeSkipped,
// } from "@/lib/itemsSheet";

// /* The ITEMS tab of GRC Barcode Generation, as a spreadsheet.

//    It keeps the look of the table it replaced - the same borders, header,
//    striping, import highlights and columns - and adds what makes it a sheet:
//    a cell cursor; range selection by dragging, Shift+click and Shift+arrows;
//    typing straight into a cell; Enter, Tab, Shift+Tab, the arrows and Esc as
//    in Excel; copy, cut and paste of tab-separated blocks, so cells copied
//    from Excel land in the matching columns; Delete to clear; Ctrl+Z / Ctrl+Y;
//    and rows added and removed in place.

//    What each column shows and accepts is lib/itemsSheet.js, shared with the
//    Submit check. The grid owns only the cursor, the selection and the editor.
//    The rows belong to GCRBarcodeGeneration and go back through onChangeRows,
//    so the totals, Export Excel and Submit all read the edited values and
//    hold no copy of their own.

//    Only the rows around what is on screen are rendered (a fixed row height
//    with spacer rows above and below), and each row is memoised, re-rendering
//    only when its own data, selection or editor changes - so a GRC of
//    thousands of lines scrolls, edits and pastes without rebuilding them all.

//    The header and the Sl No column stay put while the rows scroll under them,
//    and the sheet scrolls inside its own box in both directions, so the totals
//    and buttons below never move away. */

// const OVERSCAN = 12;
// const UNDO_LIMIT = 100;
// const BRAND = "#2b57b0";            // tailwind brand.DEFAULT
// const INACTIVE_CURSOR = "#9ca3af";  // the cursor while the sheet is not focused
// const SELECTED_OPAQUE = "#e3eaf7";  // brand/10 over white - the frozen column cannot be see-through
// const HEADER_SELECTED = "#dfe6f3";
// const DIRS = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };

// const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
// const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
// const rectOf = (a, b) => ({ r1: Math.min(a.r, b.r), r2: Math.max(a.r, b.r), c1: Math.min(a.c, b.c), c2: Math.max(a.c, b.c) });
// const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// function LockGlyph() {
//   return (
//     <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2"
//       strokeLinecap="round" strokeLinejoin="round" className="mr-1 inline-block align-[-1px]" aria-hidden="true">
//       <rect x="5" y="11" width="14" height="10" rx="2" />
//       <path d="M8 11V7a4 4 0 018 0v4" />
//     </svg>
//   );
// }

// /* One grid row. Memoised: the props are this row's own data, whether the
//    cursor / selection / editor is on it, and handlers that never change, so
//    moving the cursor re-renders two rows, not the sheet. */
// const SheetRow = memo(function SheetRow({
//   row, r, columns, activeC, activeFocused, selC1, selC2, editing, errors, locked, confirming,
//   editorRef, onEditorChange, onEditorKeyDown, onEditorBlur, onRequestRemove, onConfirmRemove, onCancelRemove,
// }) {
//   const status = row._importStatus;
//   const tint = status === "CHANGED" ? "bg-red-50" : status === "NEW" ? "bg-green-50" : r % 2 === 0 ? "bg-white" : "bg-gray-50";
//   const accent = status === "CHANGED"
//     ? "border-l-4 border-l-red-500"
//     : status === "NEW" ? "border-l-4 border-l-green-500" : "border-l border-l-gray-300";

//   return (
//     <tr data-row={r} className={tint}>
//       {columns.map((col, c) => {
//         const frozen = c === 0;
//         const isActive = activeC === c;
//         const isSelected = selC1 !== null && c >= selC1 && c <= selC2;
//         const isEditing = editing !== null && editing.c === c;
//         const error = errors ? errors[col.key] || "" : "";
//         const style = {};
//         if (isActive) style.boxShadow = `inset 0 0 0 2px ${activeFocused ? BRAND : INACTIVE_CURSOR}`;
//         if (frozen && isSelected) style.backgroundColor = SELECTED_OPAQUE;
//         const classes = [
//           "relative whitespace-nowrap border-b border-r border-gray-300 px-2 py-2",
//           frozen ? `sticky left-0 z-10 font-medium ${accent} ${isSelected ? "" : tint}` : "",
//           !frozen && isSelected && !isActive ? "bg-brand/10" : "",
//           col.variant === "identifier" ? "font-mono font-semibold" : "",
//           locked ? "text-gray-400" : col.variant === "identifier" ? "text-indigo-700" : col.readOnly && !frozen ? "text-gray-600" : "",
//           col.readOnly || locked ? "cursor-default" : "cursor-cell",
//         ].filter(Boolean).join(" ");

//         return (
//           <td
//             key={col.key}
//             data-r={r}
//             data-c={c}
//             className={classes}
//             style={style}
//             title={error || (frozen && locked) || undefined}
//             aria-selected={isActive || undefined}
//           >
//             {isEditing ? (
//               <>
//                 {/* keeps the column its width while the editor covers the cell */}
//                 <span className="invisible">{col.display(row, r)}</span>
//                 <input
//                   ref={editorRef}
//                   value={editing.value}
//                   onChange={(event) => onEditorChange(event.target.value)}
//                   onKeyDown={onEditorKeyDown}
//                   onBlur={onEditorBlur}
//                   aria-label={`${col.label}, row ${r + 1}`}
//                   aria-invalid={editing.error ? true : undefined}
//                   spellCheck={false}
//                   autoComplete="off"
//                   className={`absolute inset-0 z-[5] h-full w-full select-text border-2 bg-white px-2 text-xs text-gray-900 outline-none ${editing.error ? "border-red-600" : "border-brand"}`}
//                 />
//                 {editing.error ? (
//                   <div role="alert" className="pointer-events-none absolute left-0 top-full z-[25] mt-0.5 whitespace-nowrap rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-medium text-white shadow">
//                     {editing.error}
//                   </div>
//                 ) : null}
//               </>
//             ) : (
//               <>
//                 {frozen && locked ? <LockGlyph /> : null}
//                 {col.display(row, r)}
//                 {frozen && row._edited ? (
//                   <span title="Edited - not saved yet" className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-500 align-middle" />
//                 ) : null}
//                 {col.key === "itemName" && status === "CHANGED" ? (
//                   <span className="ml-1 rounded bg-red-500 px-1 py-0.5 text-[10px] font-semibold text-white">CHANGED</span>
//                 ) : null}
//                 {col.key === "itemName" && status === "NEW" ? (
//                   <span className="ml-1 rounded bg-green-600 px-1 py-0.5 text-[10px] font-semibold text-white">NEW</span>
//                 ) : null}
//                 {error ? (
//                   <span aria-hidden="true" className="pointer-events-none absolute right-0 top-0 h-0 w-0 border-l-[7px] border-t-[7px] border-l-transparent border-t-red-600" />
//                 ) : null}
//               </>
//             )}
//           </td>
//         );
//       })}
//       <td className="whitespace-nowrap border-b border-r border-gray-300 px-2 py-1 text-center">
//         {locked ? (
//           <span className="text-[11px] text-gray-400" title={locked}>Locked</span>
//         ) : confirming ? (
//           /* Not Tab stops either, for the reason given on the trash button
//              below: a pending confirm left the red Delete as the first thing
//              native Tab reached after the grid. The confirm is a click;
//              Escape (or moving the cursor) cancels it. */
//           <span className="inline-flex items-center gap-1">
//             <button type="button" tabIndex={-1} onClick={() => onConfirmRemove(row)} className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-red-700">
//               Delete
//             </button>
//             <button type="button" tabIndex={-1} onClick={onCancelRemove} className="rounded px-1 py-0.5 text-[10px] font-medium text-gray-600 hover:bg-gray-100">
//               Cancel
//             </button>
//           </span>
//         ) : (
//           <button
//             type="button"
//             /* NOT A TAB STOP. This sits in an Action cell that is not one
//                of `columns`, so the grid's own cell cursor can never reach
//                it - but native Tab could, and did: tabbing out of the last
//                cell of a blank last row (tabFrom returns false and the
//                handler does not preventDefault) dropped focus straight onto
//                a row's delete button. Worse, once focus was on it
//                onGridKeyDown bails, so arrows and Escape stopped working
//                too. Tab now leaves the sheet for the next real control,
//                which is what the tabFrom comment always claimed happened.
//                Deleting a row stays a deliberate click. */
//             tabIndex={-1}
//             onClick={() => onRequestRemove(row)}
//             title="Delete row"
//             aria-label={`Delete row ${r + 1}`}
//             className="inline-flex rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
//           >
//             <Icon name="trash" size={14} />
//           </button>
//         )}
//       </td>
//     </tr>
//   );
// });

// export default function ItemsSheet({
//   rows,
//   customFields = [],
//   identifierOf = null,
//   rateCodeMapping = null,
//   createRow,
//   onChangeRows,
//   onRemoveRow,
//   pendingDeleteCount = 0,
//   onUndoDeletes = null,
//   focusRequest = null,
// }) {
//   /* keyed on the custom-field NAMES: the parent rebuilds that array on every
//      edit, and a new column set would re-render every row */
//   const fieldKey = JSON.stringify(customFields);
//   const columns = useMemo(() => sheetColumns(JSON.parse(fieldKey), { identifierOf }), [fieldKey, identifierOf]);
//   const firstEditable = Math.max(0, columns.findIndex((col) => !col.readOnly));

//   const [active, setActive] = useState(() => ({ r: 0, c: firstEditable }));
//   const [anchor, setAnchor] = useState(() => ({ r: 0, c: firstEditable }));
//   /* { r, c, rowId, value, original, error, mode } - mode "replace" when the
//      edit began by typing over the cell (the arrows then move on, as in
//      Excel), "edit" when it began with Enter, F2 or a double-click (the
//      arrows then move the caret) */
//   const [editing, setEditing] = useState(null);
//   const [confirmId, setConfirmId] = useState(null);
//   const [notice, setNotice] = useState(null);
//   const [focused, setFocused] = useState(false);
//   const [view, setView] = useState({ top: 0, height: 600 });
//   const [metrics, setMetrics] = useState({ row: 33, head: 34 });

//   const scrollRef = useRef(null);
//   const dragRef = useRef(false);
//   const rafRef = useRef(0);
//   const undoRef = useRef([]);
//   const redoRef = useRef([]);
//   const emittedRef = useRef(null);
//   /* the latest props and state, for handlers that must stay the same
//      function across renders so the memoised rows are not re-rendered */
//   const live = useRef(null);
//   live.current = { rows, columns, active, anchor, editing, metrics, rateCodeMapping, createRow, onChangeRows, onRemoveRow };

//   const focusGrid = useCallback(() => {
//     scrollRef.current?.focus({ preventScroll: true });
//   }, []);

//   /* --------------------------------------------------- rows out, undo -- */

//   /* Hands a new rows array to the parent. The array replaced goes on the
//      undo stack - rows are never mutated, so a snapshot is just a reference. */
//   const emit = useCallback((next) => {
//     const cur = live.current;
//     undoRef.current.push(cur.rows);
//     if (undoRef.current.length > UNDO_LIMIT) undoRef.current.shift();
//     redoRef.current = [];
//     emittedRef.current = next;
//     cur.rows = next;
//     cur.onChangeRows(next);
//   }, []);

//   /* Rows that change from outside - Add Item, an import, a save re-reading
//      the GRC, a row removed - end the undo history: stepping back past them
//      would quietly undo that change too. */
//   useEffect(() => {
//     if (rows !== emittedRef.current) {
//       undoRef.current = [];
//       redoRef.current = [];
//       emittedRef.current = rows;
//     }
//   }, [rows]);

//   const restore = useCallback((from, to, label) => {
//     const snapshot = from.current.pop();
//     if (!snapshot) return;
//     const cur = live.current;
//     to.current.push(cur.rows);
//     emittedRef.current = snapshot;
//     cur.rows = snapshot;
//     cur.editing = null;
//     setEditing(null);
//     cur.onChangeRows(snapshot);
//     setNotice({ tone: "info", text: label });
//   }, []);
//   const undo = useCallback(() => restore(undoRef, redoRef, "Undone"), [restore]);
//   const redo = useCallback(() => restore(redoRef, undoRef, "Redone"), [restore]);

//   /* ------------------------------------------------------- viewport --- */

//   useEffect(() => {
//     const el = scrollRef.current;
//     if (!el) return undefined;
//     const update = () => setView((v) => (v.top === el.scrollTop && v.height === el.clientHeight ? v : { top: el.scrollTop, height: el.clientHeight }));
//     update();
//     const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
//     observer?.observe(el);
//     return () => {
//       observer?.disconnect();
//       cancelAnimationFrame(rafRef.current);
//     };
//   }, []);

//   const onScroll = useCallback(() => {
//     if (rafRef.current) return;
//     rafRef.current = requestAnimationFrame(() => {
//       rafRef.current = 0;
//       const el = scrollRef.current;
//       if (!el) return;
//       setView((v) => (v.top === el.scrollTop && v.height === el.clientHeight ? v : { top: el.scrollTop, height: el.clientHeight }));
//     });
//   }, []);

//   /* the real row and header heights, so the spacers match what is drawn */
//   useIsoLayoutEffect(() => {
//     const el = scrollRef.current;
//     if (!el) return;
//     const head = el.querySelector("thead");
//     const tr = el.querySelector("tbody tr[data-row]");
//     const row = tr ? tr.getBoundingClientRect().height : metrics.row;
//     const headHeight = head ? head.getBoundingClientRect().height : metrics.head;
//     if (row > 0 && (Math.abs(row - metrics.row) > 0.5 || Math.abs(headHeight - metrics.head) > 0.5)) {
//       setMetrics({ row, head: headHeight });
//     }
//   });

//   useEffect(() => {
//     const up = () => { dragRef.current = false; };
//     window.addEventListener("mouseup", up);
//     return () => window.removeEventListener("mouseup", up);
//   }, []);

//   /* Brings row r into the scroll box, below the sticky header. */
//   const revealRow = useCallback((r) => {
//     const el = scrollRef.current;
//     if (!el) return;
//     const { row: rh, head: hh } = live.current.metrics;
//     const top = r * rh;
//     if (top < el.scrollTop) el.scrollTop = top;
//     else if (hh + top + rh > el.scrollTop + el.clientHeight) el.scrollTop = hh + top + rh - el.clientHeight;
//   }, []);

//   /* ...and the cursor's column, clear of the frozen Sl No column */
//   useEffect(() => {
//     const el = scrollRef.current;
//     if (!el || active.c === 0) return;
//     const cell = el.querySelector(`td[data-r="${active.r}"][data-c="${active.c}"]`);
//     if (!cell) return;
//     const frozen = el.querySelector('th[data-c="0"]')?.offsetWidth || 0;
//     const left = cell.offsetLeft;
//     const right = left + cell.offsetWidth;
//     if (left - frozen < el.scrollLeft) el.scrollLeft = Math.max(0, left - frozen);
//     else if (right > el.scrollLeft + el.clientWidth) el.scrollLeft = right - el.clientWidth;
//   }, [active.r, active.c]);

//   /* rows removed or replaced: keep the cursor on the sheet, and close an
//      editor whose row is gone */
//   useEffect(() => {
//     const maxR = Math.max(0, rows.length - 1);
//     const maxC = columns.length - 1;
//     const fit = (p) => (p.r > maxR || p.c > maxC ? { r: Math.min(p.r, maxR), c: Math.min(p.c, maxC) } : p);
//     setActive(fit);
//     setAnchor(fit);
//     const ed = live.current.editing;
//     if (ed && rows[ed.r]?.id !== ed.rowId) {
//       live.current.editing = null;
//       setEditing(null);
//     }
//   }, [rows, columns.length]);

//   const moveTo = useCallback((r, c, extend = false) => {
//     const { rows: rs, columns: cols } = live.current;
//     if (!rs.length) return;
//     const next = { r: clamp(r, 0, rs.length - 1), c: clamp(c, 0, cols.length - 1) };
//     setActive(next);
//     if (!extend) setAnchor(next);
//     /* moving on is moving away from a row's pending "Delete?" */
//     setConfirmId(null);
//     revealRow(next.r);
//   }, [revealRow]);

//   /* -------------------------------------------------------- editing --- */

//   const startEdit = useCallback((r, c, mode, initial) => {
//     const { rows: rs, columns: cols } = live.current;
//     const row = rs[r];
//     const col = cols[c];
//     if (!row || !col || col.readOnly) return false;
//     const locked = lockReason(row);
//     if (locked) {
//       setNotice({ tone: "error", text: `Row ${r + 1}: ${locked}` });
//       return false;
//     }
//     const original = col.text(row);
//     const next = { r, c, rowId: row.id, value: initial !== undefined ? initial : original, original, error: "", mode };
//     live.current.editing = next;
//     setEditing(next);
//     setActive({ r, c });
//     setAnchor({ r, c });
//     setConfirmId(null);
//     setNotice(null);
//     revealRow(r);
//     return true;
//   }, [revealRow]);

//   const cancelEdit = useCallback(() => {
//     live.current.editing = null;
//     setEditing(null);
//   }, []);

//   /* Applies the open edit. Returns false - keeping the editor open with the
//      reason - when the column refuses the value. */
//   const commitEdit = useCallback(() => {
//     const cur = live.current;
//     const ed = cur.editing;
//     if (!ed) return true;
//     const row = cur.rows[ed.r];
//     if (!row || row.id !== ed.rowId || ed.value === ed.original) {
//       cur.editing = null;
//       setEditing(null);
//       return true;
//     }
//     const col = cur.columns[ed.c];
//     const result = col.parse(ed.value, row, { rateCodeMapping: cur.rateCodeMapping });
//     if (result.error) {
//       const kept = { ...ed, error: result.error };
//       cur.editing = kept;
//       setEditing(kept);
//       setNotice({ tone: "error", text: `Row ${ed.r + 1} ${col.label}: ${result.error}` });
//       return false;
//     }
//     cur.editing = null;
//     setEditing(null);
//     emit(cur.rows.map((item, i) => (i === ed.r ? { ...item, ...result.patch, _edited: true } : item)));
//     setNotice(null);
//     return true;
//   }, [emit]);

//   const addRow = useCallback(() => {
//     const cur = live.current;
//     const row = cur.createRow(cur.rows[cur.rows.length - 1] || null);
//     const next = [...cur.rows, row];
//     emit(next);
//     const target = { r: next.length - 1, c: cur.columns.findIndex((col) => !col.readOnly) };
//     setActive(target);
//     setAnchor(target);
//     setConfirmId(null);
//     setNotice({ tone: "info", text: `Row ${next.length} added - type to fill it in` });
//     requestAnimationFrame(() => {
//       revealRow(target.r);
//       focusGrid();
//     });
//   }, [emit, revealRow, focusGrid]);

//   /* Tab / Shift+Tab: the next editable cell, wrapping onto the next row.
//      Tab past the last cell adds a row - unless that last row is still empty,
//      when Tab leaves the sheet instead of piling up empty rows. Returns
//      whether it moved. */
//   const tabFrom = useCallback((r, c, dir) => {
//     const { rows: rs, columns: cols } = live.current;
//     let rr = r;
//     let cc = c;
//     for (let step = 0; step <= cols.length; step += 1) {
//       cc += dir;
//       if (cc >= cols.length) { cc = 0; rr += 1; }
//       if (cc < 0) { cc = cols.length - 1; rr -= 1; }
//       if (rr < 0) return false;
//       if (rr >= rs.length) {
//         if (dir < 0 || !rs.length || isBlankRow(rs[rs.length - 1])) return false;
//         addRow();
//         return true;
//       }
//       if (!cols[cc].readOnly) {
//         moveTo(rr, cc);
//         return true;
//       }
//     }
//     return false;
//   }, [addRow, moveTo]);

//   const onEditorChange = useCallback((value) => {
//     setEditing((ed) => (ed ? { ...ed, value, error: "" } : ed));
//   }, []);

//   const onEditorKeyDown = useCallback((event) => {
//     const ed = live.current.editing;
//     if (!ed) return;
//     const { key, shiftKey } = event;
//     if (key === "Enter") {
//       event.preventDefault();
//       event.stopPropagation();
//       if (commitEdit()) {
//         focusGrid();
//         moveTo(ed.r + (shiftKey ? -1 : 1), ed.c);
//       }
//     } else if (key === "Tab") {
//       event.preventDefault();
//       event.stopPropagation();
//       if (commitEdit()) {
//         focusGrid();
//         if (!tabFrom(ed.r, ed.c, shiftKey ? -1 : 1)) moveTo(ed.r, ed.c);
//       }
//     } else if (key === "Escape") {
//       event.preventDefault();
//       event.stopPropagation();
//       cancelEdit();
//       setNotice(null);
//       focusGrid();
//     } else if (DIRS[key] && ed.mode === "replace") {
//       event.preventDefault();
//       event.stopPropagation();
//       if (commitEdit()) {
//         focusGrid();
//         moveTo(ed.r + DIRS[key][0], ed.c + DIRS[key][1]);
//       }
//     }
//   }, [commitEdit, cancelEdit, focusGrid, moveTo, tabFrom]);

//   /* Clicking away keeps a valid value, as Excel does. A value the column
//      refuses cannot be left in the cell, so the old one is put back and the
//      reason shown. Switching windows leaves the edit open. */
//   const onEditorBlur = useCallback(() => {
//     if (typeof document !== "undefined" && !document.hasFocus()) return;
//     const ed = live.current.editing;
//     if (!ed) return;
//     if (!commitEdit()) {
//       const reason = live.current.editing?.error || "";
//       const label = live.current.columns[ed.c]?.label || "";
//       cancelEdit();
//       setNotice({ tone: "error", text: `Row ${ed.r + 1} ${label}: ${reason} - the previous value was kept` });
//     }
//   }, [commitEdit, cancelEdit]);

//   const editorRef = useCallback((el) => {
//     if (!el) return;
//     el.focus({ preventScroll: true });
//     const end = el.value.length;
//     try { el.setSelectionRange(end, end); } catch { /* not a text input */ }
//   }, []);

//   /* ------------------------------------------------------ selection --- */

//   const selectAll = useCallback(() => {
//     const { rows: rs, columns: cols } = live.current;
//     if (!rs.length) return;
//     setAnchor({ r: rs.length - 1, c: cols.length - 1 });
//     setActive({ r: 0, c: 0 });
//   }, []);

//   const selectionText = useCallback(() => {
//     const { rows: rs, columns: cols, active: a, anchor: b } = live.current;
//     const rect = rectOf(a, b);
//     const lines = [];
//     for (let r = rect.r1; r <= rect.r2; r += 1) {
//       const row = rs[r];
//       if (!row) continue;
//       const line = [];
//       for (let c = rect.c1; c <= rect.c2; c += 1) line.push(cols[c].display(row, r));
//       lines.push(line);
//     }
//     return { text: toTsv(lines), cells: lines.length * (rect.c2 - rect.c1 + 1) };
//   }, []);

//   const clearSelection = useCallback(() => {
//     const cur = live.current;
//     const plan = planClear({ rows: cur.rows, columns: cur.columns, rect: rectOf(cur.active, cur.anchor), ctx: { rateCodeMapping: cur.rateCodeMapping } });
//     if (plan.changed) emit(plan.rows);
//     if (plan.skipped.length) {
//       setNotice({ tone: "error", text: `${plan.changed ? `Cleared ${plural(plan.changed, "cell")}. ` : ""}Not cleared - ${describeSkipped(plan.skipped, cur.columns)}` });
//     } else {
//       setNotice(plan.changed ? { tone: "info", text: `Cleared ${plural(plan.changed, "cell")}` } : null);
//     }
//   }, [emit]);

//   /* ------------------------------------------------- grid keyboard ---- */

//   const onGridKeyDown = useCallback((event) => {
//     if (event.target !== scrollRef.current) return;     // a button in the sheet, or the editor
//     const cur = live.current;
//     const { key } = event;
//     const ctrl = event.ctrlKey || event.metaKey;
//     const lower = key.length === 1 ? key.toLowerCase() : key;

//     if (ctrl && lower === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return; }
//     if (ctrl && lower === "y") { event.preventDefault(); redo(); return; }
//     if (ctrl && lower === "a") { event.preventDefault(); selectAll(); return; }
//     if (ctrl && (lower === "c" || lower === "x" || lower === "v")) return;  // arrive as copy / cut / paste

//     if (!cur.rows.length) {
//       if (key === "Enter" || (key.length === 1 && !ctrl && !event.altKey)) {
//         event.preventDefault();
//         addRow();
//         if (key.length === 1) startEdit(0, cur.columns.findIndex((col) => !col.readOnly), "replace", key);
//       }
//       return;
//     }

//     const a = cur.active;
//     const last = { r: cur.rows.length - 1, c: cur.columns.length - 1 };
//     if (DIRS[key]) {
//       event.preventDefault();
//       const [dr, dc] = DIRS[key];
//       const r = ctrl ? (dr < 0 ? 0 : dr > 0 ? last.r : a.r) : a.r + dr;
//       const c = ctrl ? (dc < 0 ? 0 : dc > 0 ? last.c : a.c) : a.c + dc;
//       moveTo(r, c, event.shiftKey);
//       return;
//     }

//     const page = Math.max(1, Math.floor((scrollRef.current.clientHeight - cur.metrics.head) / cur.metrics.row) - 1);
//     switch (key) {
//       case "Tab":
//         if (tabFrom(a.r, a.c, event.shiftKey ? -1 : 1)) event.preventDefault();
//         return;
//       case "Home":
//         event.preventDefault();
//         moveTo(ctrl ? 0 : a.r, 0, event.shiftKey);
//         return;
//       case "End":
//         event.preventDefault();
//         moveTo(ctrl ? last.r : a.r, last.c, event.shiftKey);
//         return;
//       case "PageDown":
//         event.preventDefault();
//         moveTo(a.r + page, a.c, event.shiftKey);
//         return;
//       case "PageUp":
//         event.preventDefault();
//         moveTo(a.r - page, a.c, event.shiftKey);
//         return;
//       case "Enter":
//         event.preventDefault();
//         if (event.shiftKey || !startEdit(a.r, a.c, "edit")) moveTo(a.r + (event.shiftKey ? -1 : 1), a.c);
//         return;
//       case "F2":
//         event.preventDefault();
//         startEdit(a.r, a.c, "edit");
//         return;
//       case "Escape":
//         setAnchor(a);
//         setConfirmId(null);
//         setNotice(null);
//         return;
//       case "Delete":
//       case "Backspace":
//         event.preventDefault();
//         clearSelection();
//         return;
//       default:
//     }

//     /* typing over the cell, as in Excel */
//     if (key.length === 1 && !ctrl && !event.altKey) {
//       if (startEdit(a.r, a.c, "replace", key)) event.preventDefault();
//     }
//   }, [addRow, clearSelection, moveTo, redo, selectAll, startEdit, tabFrom, undo]);

//   /* --------------------------------------------------- grid mouse ----- */

//   const onGridMouseDown = useCallback((event) => {
//     if (event.button !== 0) return;
//     if (event.target.closest("button, input, a, select, textarea")) return;
//     const th = event.target.closest("th[data-c]");
//     const td = th ? null : event.target.closest("td[data-c]");
//     if (!th && !td) return;            // the scrollbar, a spacer
//     event.preventDefault();
//     if (live.current.editing && !commitEdit()) return;   // a refused value keeps its cell
//     focusGrid();
//     setConfirmId(null);
//     const { rows: rs } = live.current;
//     if (th) {
//       /* the whole column, cursor at its top */
//       if (!rs.length) return;
//       const c = Number(th.dataset.c);
//       setAnchor({ r: rs.length - 1, c });
//       setActive({ r: 0, c });
//       return;
//     }
//     const cell = { r: Number(td.dataset.r), c: Number(td.dataset.c) };
//     setActive(cell);
//     if (!event.shiftKey) setAnchor(cell);
//     dragRef.current = true;
//   }, [commitEdit, focusGrid]);

//   const onGridMouseOver = useCallback((event) => {
//     if (!dragRef.current) return;
//     const td = event.target.closest?.("td[data-c]");
//     if (!td) return;
//     const cell = { r: Number(td.dataset.r), c: Number(td.dataset.c) };
//     setActive((a) => (a.r === cell.r && a.c === cell.c ? a : cell));
//   }, []);

//   const onGridDoubleClick = useCallback((event) => {
//     if (event.target.closest("button, input")) return;
//     const td = event.target.closest("td[data-c]");
//     if (!td) return;
//     startEdit(Number(td.dataset.r), Number(td.dataset.c), "edit");
//   }, [startEdit]);

//   /* ---------------------------------------------------- clipboard ----- */

//   const onGridCopy = useCallback((event) => {
//     if (live.current.editing || !live.current.rows.length) return;   // the editor's own text copy
//     const { text, cells } = selectionText();
//     event.clipboardData.setData("text/plain", text);
//     event.preventDefault();
//     setNotice({ tone: "info", text: `Copied ${plural(cells, "cell")}` });
//   }, [selectionText]);

//   const onGridCut = useCallback((event) => {
//     if (live.current.editing || !live.current.rows.length) return;
//     const { text } = selectionText();
//     event.clipboardData.setData("text/plain", text);
//     event.preventDefault();
//     clearSelection();
//   }, [selectionText, clearSelection]);

//   const onGridPaste = useCallback((event) => {
//     const text = event.clipboardData?.getData("text/plain") ?? "";
//     const cur = live.current;
//     /* one value into the open editor is the browser's own paste; a block
//        (tabs or line breaks) goes into the cells from the editor's cell on */
//     if (cur.editing && !/[\t\n\r]/.test(text.replace(/\r?\n$/, ""))) return;
//     event.preventDefault();
//     if (cur.editing) cancelEdit();
//     const matrix = parseTsv(text);
//     if (!matrix.length) return;

//     const rect = rectOf(cur.active, cur.anchor);
//     const oneValue = matrix.length === 1 && matrix[0].length === 1;
//     const plan = planPaste({
//       rows: cur.rows,
//       columns: cur.columns,
//       top: rect.r1,
//       left: rect.c1,
//       matrix,
//       fill: oneValue && (rect.r1 !== rect.r2 || rect.c1 !== rect.c2) ? rect : null,
//       ctx: { rateCodeMapping: cur.rateCodeMapping },
//       createRow: cur.createRow,
//     });
//     if (plan.changed || plan.added) emit(plan.rows);
//     setActive({ r: rect.r1, c: rect.c1 });
//     setAnchor({ r: Math.max(rect.r1, plan.bottom), c: Math.max(rect.c1, plan.right) });

//     const done = [];
//     if (plan.changed) done.push(`Pasted ${plural(plan.changed, "cell")}`);
//     if (plan.added) done.push(`added ${plural(plan.added, "row")}`);
//     if (plan.droppedCols) done.push(`${plural(plan.droppedCols, "value")} past the last column left out`);
//     const summary = done.length ? done.join(", ") : "Nothing was pasted";
//     setNotice(plan.skipped.length
//       ? { tone: "error", text: `${summary}. Not pasted - ${describeSkipped(plan.skipped, cur.columns)}` }
//       : { tone: "info", text: `${summary}.` });
//     focusGrid();
//   }, [cancelEdit, emit, focusGrid]);

//   /* ------------------------------------------------------ row actions -- */

//   const onRequestRemove = useCallback((row) => {
//     if (lockReason(row)) return;
//     if (isBlankRow(row)) {
//       live.current.onRemoveRow(row);
//       focusGrid();
//       return;
//     }
//     setConfirmId(row.id);
//   }, [focusGrid]);

//   const onConfirmRemove = useCallback((row) => {
//     setConfirmId(null);
//     live.current.onRemoveRow(row);
//     setNotice({
//       tone: "info",
//       text: row._id ? `Row removed - barcode ${row.barcodeNo || ""} will be deleted when you Submit` : "Row removed",
//     });
//     focusGrid();
//   }, [focusGrid]);

//   const onCancelRemove = useCallback(() => {
//     setConfirmId(null);
//     focusGrid();
//   }, [focusGrid]);

//   /* A refused Submit asks for the first cell to fix. */
//   useEffect(() => {
//     if (!focusRequest) return;
//     const { rows: rs, columns: cols } = live.current;
//     const r = rs.findIndex((row) => row.id === focusRequest.rowId);
//     if (r < 0) return;
//     const c = cols.findIndex((col) => col.key === focusRequest.key);
//     moveTo(r, c < 0 ? firstEditable : c);
//     requestAnimationFrame(focusGrid);
//   }, [focusRequest, moveTo, focusGrid, firstEditable]);

//   /* ------------------------------------------------------- render ----- */

//   const errorCache = useMemo(() => new WeakMap(), [columns]);
//   const errorsOf = (row) => {
//     if (!needsCheck(row) || lockReason(row)) return null;
//     if (!errorCache.has(row)) errorCache.set(row, rowErrors(row, columns));
//     return errorCache.get(row);
//   };

//   let editedCount = 0;
//   let errorCells = 0;
//   rows.forEach((row) => {
//     if (row._edited) editedCount += 1;
//     const errors = errorsOf(row);
//     if (errors) errorCells += Object.keys(errors).length;
//   });

//   const n = rows.length;
//   const rect = rectOf(active, anchor);
//   let start = Math.max(0, Math.floor(view.top / metrics.row) - OVERSCAN);
//   let end = Math.min(n, Math.ceil((view.top + view.height) / metrics.row) + OVERSCAN);
//   /* the row being edited stays mounted however far it is scrolled */
//   if (editing && editing.r < n) {
//     start = Math.min(start, editing.r);
//     end = Math.max(end, editing.r + 1);
//   }
//   start = Math.min(start, n);

//   const selectedCells = (rect.r2 - rect.r1 + 1) * (rect.c2 - rect.c1 + 1);
//   const where = !n
//     ? "No rows yet - Add Row, paste from Excel, or Import Excel"
//     : selectedCells > 1
//       ? `${plural(rect.r2 - rect.r1 + 1, "row")} × ${plural(rect.c2 - rect.c1 + 1, "column")} selected`
//       : `Row ${active.r + 1} · ${columns[active.c]?.label || ""}`;

//   const spacer = (height, key) => (
//     <tr key={key} aria-hidden="true">
//       <td colSpan={columns.length + 1} className="p-0" style={{ height }} />
//     </tr>
//   );

//   return (
//     <div>
//       <div
//         ref={scrollRef}
//         tabIndex={0}
//         aria-label="Items - editable sheet. Arrow keys move, Enter or F2 edits, Tab moves to the next cell."
//         onKeyDown={onGridKeyDown}
//         onMouseDown={onGridMouseDown}
//         onMouseOver={onGridMouseOver}
//         onDoubleClick={onGridDoubleClick}
//         onCopy={onGridCopy}
//         onCut={onGridCut}
//         onPaste={onGridPaste}
//         onScroll={onScroll}
//         onFocus={() => setFocused(true)}
//         onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
//         className="relative max-h-[60vh] min-h-[180px] overflow-auto outline-none"
//       >
//         <table className="w-full min-w-[1200px] border-separate border-spacing-0 text-xs">
//           <thead>
//             <tr className="bg-gray-100 text-left text-gray-700">
//               {columns.map((col, c) => {
//                 const inSelection = n > 0 && c >= rect.c1 && c <= rect.c2;
//                 return (
//                   <th
//                     key={col.key}
//                     data-c={c}
//                     scope="col"
//                     style={{ minWidth: col.width, backgroundColor: inSelection ? HEADER_SELECTED : undefined }}
//                     title={col.readOnly ? `${col.label} - ${col.note || "worked out, not typed"}` : `${col.label} - click to select the column`}
//                     className={`sticky top-0 cursor-pointer select-none whitespace-nowrap border-b border-r border-t border-gray-300 bg-gray-100 px-2 py-2 ${c === 0 ? "left-0 z-30 border-l" : "z-20"}`}
//                   >
//                     {col.label}
//                   </th>
//                 );
//               })}
//               <th scope="col" className="sticky top-0 z-20 w-16 whitespace-nowrap border-b border-r border-t border-gray-300 bg-gray-100 px-2 py-2 text-center">
//                 Action
//               </th>
//             </tr>
//           </thead>
//           <tbody>
//             {n === 0 ? (
//               <tr>
//                 <td colSpan={columns.length + 1} className="border-b border-l border-r border-gray-300 px-3 py-8 text-center text-gray-500">No data found</td>
//               </tr>
//             ) : null}
//             {start > 0 ? spacer(start * metrics.row, "above") : null}
//             {rows.slice(start, end).map((row, k) => {
//               const r = start + k;
//               const inRows = r >= rect.r1 && r <= rect.r2;
//               return (
//                 <SheetRow
//                   key={row.id ?? `row-${r}`}
//                   row={row}
//                   r={r}
//                   columns={columns}
//                   activeC={active.r === r ? active.c : -1}
//                   activeFocused={active.r === r ? focused : false}
//                   selC1={inRows ? rect.c1 : null}
//                   selC2={inRows ? rect.c2 : null}
//                   editing={editing && editing.r === r ? editing : null}
//                   errors={errorsOf(row)}
//                   locked={lockReason(row)}
//                   confirming={confirmId === row.id}
//                   editorRef={editorRef}
//                   onEditorChange={onEditorChange}
//                   onEditorKeyDown={onEditorKeyDown}
//                   onEditorBlur={onEditorBlur}
//                   onRequestRemove={onRequestRemove}
//                   onConfirmRemove={onConfirmRemove}
//                   onCancelRemove={onCancelRemove}
//                 />
//               );
//             })}
//             {end < n ? spacer((n - end) * metrics.row, "below") : null}
//           </tbody>
//         </table>
//       </div>

//       <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-gray-300 bg-gray-50 px-3 py-2 text-xs">
//         <div className="flex min-w-0 flex-1 items-center gap-3">
//           <button
//             type="button"
//             onClick={addRow}
//             title="Add an empty row at the end - Tab past the last cell does the same"
//             className="flex shrink-0 items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
//           >
//             <Icon name="plus" size={14} /> Add Row
//           </button>
//           <span role="status" aria-live="polite" className={`min-w-0 break-words ${notice?.tone === "error" ? "font-medium text-red-700" : "text-gray-600"}`}>
//             {notice?.text || where}
//           </span>
//         </div>
//         <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-500">
//           {editedCount > 0 ? <span className="text-amber-700">{plural(editedCount, "row")} edited - Submit to save</span> : null}
//           {pendingDeleteCount > 0 ? (
//             <span className="text-red-700">
//               {plural(pendingDeleteCount, "saved row")} will be deleted on Submit
//               {onUndoDeletes ? (
//                 <>
//                   {" · "}
//                   <button type="button" onClick={onUndoDeletes} className="font-medium underline">Undo</button>
//                 </>
//               ) : null}
//             </span>
//           ) : null}
//           {errorCells > 0 ? <span className="text-red-700">{plural(errorCells, "cell")} to fix</span> : null}
//           <span className="hidden xl:inline">Enter / F2 edit · Tab next · Esc cancel · Ctrl+C / Ctrl+V · Ctrl+Z undo</span>
//         </div>
//       </div>
//     </div>
//   );
// }



























"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon";
import {
  sheetColumns, parseTsv, toTsv, planPaste, planClear, rowErrors, lockReason, needsCheck, isBlankRow,
  describeSkipped,
} from "@/lib/itemsSheet";

/* The ITEMS tab of GRC Barcode Generation, as a spreadsheet.

   It keeps the look of the table it replaced - the same borders, header,
   striping, import highlights and columns - and adds what makes it a sheet:
   a cell cursor; range selection by dragging, Shift+click and Shift+arrows;
   typing straight into a cell; Enter, Tab, Shift+Tab, the arrows and Esc as
   in Excel; copy, cut and paste of tab-separated blocks, so cells copied
   from Excel land in the matching columns; Delete to clear; Ctrl+Z / Ctrl+Y;
   and rows added and removed in place.

   What each column shows and accepts is lib/itemsSheet.js, shared with the
   Submit check. The grid owns only the cursor, the selection and the editor.
   The rows belong to GCRBarcodeGeneration and go back through onChangeRows,
   so the totals, Export Excel and Submit all read the edited values and
   hold no copy of their own.

   Only the rows around what is on screen are rendered (a fixed row height
   with spacer rows above and below), and each row is memoised, re-rendering
   only when its own data, selection or editor changes - so a GRC of
   thousands of lines scrolls, edits and pastes without rebuilding them all.

   The header and the Sl No column stay put while the rows scroll under them,
   and the sheet scrolls inside its own box in both directions, so the totals
   and buttons below never move away. */

const OVERSCAN = 12;
const UNDO_LIMIT = 100;
const BRAND = "#2b57b0";            // tailwind brand.DEFAULT
const INACTIVE_CURSOR = "#9ca3af";  // the cursor while the sheet is not focused
const SELECTED_OPAQUE = "#e3eaf7";  // brand/10 over white - the frozen column cannot be see-through
const HEADER_SELECTED = "#dfe6f3";
const DIRS = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const rectOf = (a, b) => ({ r1: Math.min(a.r, b.r), r2: Math.max(a.r, b.r), c1: Math.min(a.c, b.c), c2: Math.max(a.c, b.c) });
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function LockGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className="mr-1 inline-block align-[-1px]" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </svg>
  );
}

/* One grid row. Memoised: the props are this row's own data, whether the
   cursor / selection / editor is on it, and handlers that never change, so
   moving the cursor re-renders two rows, not the sheet. */
const SheetRow = memo(function SheetRow({
  row, r, columns, activeC, activeFocused, selC1, selC2, editing, errors, locked, confirming,
  editorRef, onEditorChange, onEditorKeyDown, onEditorBlur, onEditorPick, onRequestRemove, onConfirmRemove, onCancelRemove,
}) {
  const status = row._importStatus;
  const tint = status === "CHANGED" ? "bg-red-50" : status === "NEW" ? "bg-green-50" : r % 2 === 0 ? "bg-white" : "bg-gray-50";
  const accent = status === "CHANGED"
    ? "border-l-4 border-l-red-500"
    : status === "NEW" ? "border-l-4 border-l-green-500" : "border-l border-l-gray-300";

  return (
    <tr data-row={r} className={tint}>
      {columns.map((col, c) => {
        const frozen = c === 0;
        const isActive = activeC === c;
        const isSelected = selC1 !== null && c >= selC1 && c <= selC2;
        const isEditing = editing !== null && editing.c === c;
        const error = errors ? errors[col.key] || "" : "";
        const style = {};
        if (isActive) style.boxShadow = `inset 0 0 0 2px ${activeFocused ? BRAND : INACTIVE_CURSOR}`;
        if (frozen && isSelected) style.backgroundColor = SELECTED_OPAQUE;
        const classes = [
          "relative whitespace-nowrap border-b border-r border-gray-300 px-2 py-2",
          frozen ? `sticky left-0 z-10 font-medium ${accent} ${isSelected ? "" : tint}` : "",
          !frozen && isSelected && !isActive ? "bg-brand/10" : "",
          col.variant === "identifier" ? "font-mono font-semibold" : "",
          locked ? "text-gray-400" : col.variant === "identifier" ? "text-indigo-700" : col.readOnly && !frozen ? "text-gray-600" : "",
          col.readOnly || locked ? "cursor-default" : "cursor-cell",
        ].filter(Boolean).join(" ");

        return (
          <td
            key={col.key}
            data-r={r}
            data-c={c}
            className={classes}
            style={style}
            title={error || (frozen && locked) || undefined}
            aria-selected={isActive || undefined}
          >
            {isEditing ? (
              <>
                {/* keeps the column its width while the editor covers the cell */}
                <span className="invisible">{col.display(row, r)}</span>
                <input
                  ref={editorRef}
                  value={editing.value}
                  onChange={(event) => onEditorChange(event.target.value)}
                  onKeyDown={onEditorKeyDown}
                  onBlur={onEditorBlur}
                  aria-label={`${col.label}, row ${r + 1}`}
                  aria-invalid={editing.error ? true : undefined}
                  spellCheck={false}
                  autoComplete="off"
                  className={`absolute inset-0 z-[5] h-full w-full select-text border-2 bg-white px-2 text-xs text-gray-900 outline-none ${editing.error ? "border-red-600" : "border-brand"}`}
                />
                {editing.error ? (
                  <div role="alert" className="pointer-events-none absolute left-0 top-full z-[25] mt-0.5 whitespace-nowrap rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-medium text-white shadow">
                    {editing.error}
                  </div>
                ) : col.options ? (
                  /* the column's short list - click one, or Up / Down while
                     editing; typing "p", "f", "m", "y" picks by its start */
                  <ul role="listbox" aria-label={`${col.label} options`} className="absolute left-0 top-full z-[25] mt-0.5 min-w-full overflow-hidden rounded border border-gray-300 bg-white py-0.5 text-xs shadow">
                    {col.options.map((option) => {
                      const on = String(editing.value).trim().toLowerCase() === option.toLowerCase();
                      return (
                        <li
                          key={option}
                          role="option"
                          aria-selected={on}
                          onMouseDown={(event) => { event.preventDefault(); onEditorPick(option); }}
                          className={`cursor-pointer whitespace-nowrap px-2 py-1 ${on ? "bg-brand text-white" : "text-gray-800 hover:bg-brand/10"}`}
                        >
                          {option}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </>
            ) : (
              <>
                {frozen && locked ? <LockGlyph /> : null}
                {col.display(row, r)}
                {frozen && row._edited ? (
                  <span title="Edited - not saved yet" className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-500 align-middle" />
                ) : null}
                {col.key === "itemName" && status === "CHANGED" ? (
                  <span className="ml-1 rounded bg-red-500 px-1 py-0.5 text-[10px] font-semibold text-white">CHANGED</span>
                ) : null}
                {col.key === "itemName" && status === "NEW" ? (
                  <span className="ml-1 rounded bg-green-600 px-1 py-0.5 text-[10px] font-semibold text-white">NEW</span>
                ) : null}
                {error ? (
                  <span aria-hidden="true" className="pointer-events-none absolute right-0 top-0 h-0 w-0 border-l-[7px] border-t-[7px] border-l-transparent border-t-red-600" />
                ) : null}
              </>
            )}
          </td>
        );
      })}
      <td className="whitespace-nowrap border-b border-r border-gray-300 px-2 py-1 text-center">
        {locked ? (
          <span className="text-[11px] text-gray-400" title={locked}>Locked</span>
        ) : confirming ? (
          /* Not Tab stops either, for the reason given on the trash button
             below: a pending confirm left the red Delete as the first thing
             native Tab reached after the grid. The confirm is a click;
             Escape (or moving the cursor) cancels it. */
          <span className="inline-flex items-center gap-1">
            <button type="button" tabIndex={-1} onClick={() => onConfirmRemove(row)} className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-red-700">
              Delete
            </button>
            <button type="button" tabIndex={-1} onClick={onCancelRemove} className="rounded px-1 py-0.5 text-[10px] font-medium text-gray-600 hover:bg-gray-100">
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            /* NOT A TAB STOP. This sits in an Action cell that is not one
               of `columns`, so the grid's own cell cursor can never reach
               it - but native Tab could, and did: tabbing out of the last
               cell of a blank last row (tabFrom returns false and the
               handler does not preventDefault) dropped focus straight onto
               a row's delete button. Worse, once focus was on it
               onGridKeyDown bails, so arrows and Escape stopped working
               too. Tab now leaves the sheet for the next real control,
               which is what the tabFrom comment always claimed happened.
               Deleting a row stays a deliberate click. */
            tabIndex={-1}
            onClick={() => onRequestRemove(row)}
            title="Delete row"
            aria-label={`Delete row ${r + 1}`}
            className="inline-flex rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
          >
            <Icon name="trash" size={14} />
          </button>
        )}
      </td>
    </tr>
  );
});

export default function ItemsSheet({
  rows,
  customFields = [],
  identifierOf = null,
  rateCodeMapping = null,
  createRow,
  onChangeRows,
  onRemoveRow,
  pendingDeleteCount = 0,
  onUndoDeletes = null,
  focusRequest = null,
}) {
  /* keyed on the custom-field NAMES: the parent rebuilds that array on every
     edit, and a new column set would re-render every row */
  const fieldKey = JSON.stringify(customFields);
  const columns = useMemo(() => sheetColumns(JSON.parse(fieldKey), { identifierOf }), [fieldKey, identifierOf]);
  const firstEditable = Math.max(0, columns.findIndex((col) => !col.readOnly));

  const [active, setActive] = useState(() => ({ r: 0, c: firstEditable }));
  const [anchor, setAnchor] = useState(() => ({ r: 0, c: firstEditable }));
  /* { r, c, rowId, value, original, error, mode } - mode "replace" when the
     edit began by typing over the cell (the arrows then move on, as in
     Excel), "edit" when it began with Enter, F2 or a double-click (the
     arrows then move the caret) */
  const [editing, setEditing] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [focused, setFocused] = useState(false);
  const [view, setView] = useState({ top: 0, height: 600 });
  const [metrics, setMetrics] = useState({ row: 33, head: 34 });

  const scrollRef = useRef(null);
  const dragRef = useRef(false);
  const rafRef = useRef(0);
  const undoRef = useRef([]);
  const redoRef = useRef([]);
  const emittedRef = useRef(null);
  /* the latest props and state, for handlers that must stay the same
     function across renders so the memoised rows are not re-rendered */
  const live = useRef(null);
  live.current = { rows, columns, active, anchor, editing, metrics, rateCodeMapping, createRow, onChangeRows, onRemoveRow };

  const focusGrid = useCallback(() => {
    scrollRef.current?.focus({ preventScroll: true });
  }, []);

  /* --------------------------------------------------- rows out, undo -- */

  /* Hands a new rows array to the parent. The array replaced goes on the
     undo stack - rows are never mutated, so a snapshot is just a reference. */
  const emit = useCallback((next) => {
    const cur = live.current;
    undoRef.current.push(cur.rows);
    if (undoRef.current.length > UNDO_LIMIT) undoRef.current.shift();
    redoRef.current = [];
    emittedRef.current = next;
    cur.rows = next;
    cur.onChangeRows(next);
  }, []);

  /* Rows that change from outside - Add Item, an import, a save re-reading
     the GRC, a row removed - end the undo history: stepping back past them
     would quietly undo that change too. */
  useEffect(() => {
    if (rows !== emittedRef.current) {
      undoRef.current = [];
      redoRef.current = [];
      emittedRef.current = rows;
    }
  }, [rows]);

  const restore = useCallback((from, to, label) => {
    const snapshot = from.current.pop();
    if (!snapshot) return;
    const cur = live.current;
    to.current.push(cur.rows);
    emittedRef.current = snapshot;
    cur.rows = snapshot;
    cur.editing = null;
    setEditing(null);
    cur.onChangeRows(snapshot);
    setNotice({ tone: "info", text: label });
  }, []);
  const undo = useCallback(() => restore(undoRef, redoRef, "Undone"), [restore]);
  const redo = useCallback(() => restore(redoRef, undoRef, "Redone"), [restore]);

  /* ------------------------------------------------------- viewport --- */

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const update = () => setView((v) => (v.top === el.scrollTop && v.height === el.clientHeight ? v : { top: el.scrollTop, height: el.clientHeight }));
    update();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(el);
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const onScroll = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const el = scrollRef.current;
      if (!el) return;
      setView((v) => (v.top === el.scrollTop && v.height === el.clientHeight ? v : { top: el.scrollTop, height: el.clientHeight }));
    });
  }, []);

  /* the real row and header heights, so the spacers match what is drawn */
  useIsoLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const head = el.querySelector("thead");
    const tr = el.querySelector("tbody tr[data-row]");
    const row = tr ? tr.getBoundingClientRect().height : metrics.row;
    const headHeight = head ? head.getBoundingClientRect().height : metrics.head;
    if (row > 0 && (Math.abs(row - metrics.row) > 0.5 || Math.abs(headHeight - metrics.head) > 0.5)) {
      setMetrics({ row, head: headHeight });
    }
  });

  useEffect(() => {
    const up = () => { dragRef.current = false; };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  /* Brings row r into the scroll box, below the sticky header. */
  const revealRow = useCallback((r) => {
    const el = scrollRef.current;
    if (!el) return;
    const { row: rh, head: hh } = live.current.metrics;
    const top = r * rh;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (hh + top + rh > el.scrollTop + el.clientHeight) el.scrollTop = hh + top + rh - el.clientHeight;
  }, []);

  /* ...and the cursor's column, clear of the frozen Sl No column */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || active.c === 0) return;
    const cell = el.querySelector(`td[data-r="${active.r}"][data-c="${active.c}"]`);
    if (!cell) return;
    const frozen = el.querySelector('th[data-c="0"]')?.offsetWidth || 0;
    const left = cell.offsetLeft;
    const right = left + cell.offsetWidth;
    if (left - frozen < el.scrollLeft) el.scrollLeft = Math.max(0, left - frozen);
    else if (right > el.scrollLeft + el.clientWidth) el.scrollLeft = right - el.clientWidth;
  }, [active.r, active.c]);

  /* rows removed or replaced: keep the cursor on the sheet, and close an
     editor whose row is gone */
  useEffect(() => {
    const maxR = Math.max(0, rows.length - 1);
    const maxC = columns.length - 1;
    const fit = (p) => (p.r > maxR || p.c > maxC ? { r: Math.min(p.r, maxR), c: Math.min(p.c, maxC) } : p);
    setActive(fit);
    setAnchor(fit);
    const ed = live.current.editing;
    if (ed && rows[ed.r]?.id !== ed.rowId) {
      live.current.editing = null;
      setEditing(null);
    }
  }, [rows, columns.length]);

  const moveTo = useCallback((r, c, extend = false) => {
    const { rows: rs, columns: cols } = live.current;
    if (!rs.length) return;
    const next = { r: clamp(r, 0, rs.length - 1), c: clamp(c, 0, cols.length - 1) };
    setActive(next);
    if (!extend) setAnchor(next);
    /* moving on is moving away from a row's pending "Delete?" */
    setConfirmId(null);
    revealRow(next.r);
  }, [revealRow]);

  /* -------------------------------------------------------- editing --- */

  const startEdit = useCallback((r, c, mode, initial) => {
    const { rows: rs, columns: cols } = live.current;
    const row = rs[r];
    const col = cols[c];
    if (!row || !col || col.readOnly) return false;
    const locked = lockReason(row);
    if (locked) {
      setNotice({ tone: "error", text: `Row ${r + 1}: ${locked}` });
      return false;
    }
    const original = col.text(row);
    const next = { r, c, rowId: row.id, value: initial !== undefined ? initial : original, original, error: "", mode };
    live.current.editing = next;
    setEditing(next);
    setActive({ r, c });
    setAnchor({ r, c });
    setConfirmId(null);
    setNotice(null);
    revealRow(r);
    return true;
  }, [revealRow]);

  const cancelEdit = useCallback(() => {
    live.current.editing = null;
    setEditing(null);
  }, []);

  /* Applies the open edit. Returns false - keeping the editor open with the
     reason - when the column refuses the value. */
  const commitEdit = useCallback(() => {
    const cur = live.current;
    const ed = cur.editing;
    if (!ed) return true;
    const row = cur.rows[ed.r];
    if (!row || row.id !== ed.rowId || ed.value === ed.original) {
      cur.editing = null;
      setEditing(null);
      return true;
    }
    const col = cur.columns[ed.c];
    const result = col.parse(ed.value, row, { rateCodeMapping: cur.rateCodeMapping });
    if (result.error) {
      const kept = { ...ed, error: result.error };
      cur.editing = kept;
      setEditing(kept);
      setNotice({ tone: "error", text: `Row ${ed.r + 1} ${col.label}: ${result.error}` });
      return false;
    }
    cur.editing = null;
    setEditing(null);
    emit(cur.rows.map((item, i) => (i === ed.r ? { ...item, ...result.patch, _edited: true } : item)));
    setNotice(null);
    return true;
  }, [emit]);

  const addRow = useCallback(() => {
    const cur = live.current;
    const row = cur.createRow(cur.rows[cur.rows.length - 1] || null);
    const next = [...cur.rows, row];
    emit(next);
    const target = { r: next.length - 1, c: cur.columns.findIndex((col) => !col.readOnly) };
    setActive(target);
    setAnchor(target);
    setConfirmId(null);
    setNotice({ tone: "info", text: `Row ${next.length} added - type to fill it in` });
    requestAnimationFrame(() => {
      revealRow(target.r);
      focusGrid();
    });
  }, [emit, revealRow, focusGrid]);

  /* Tab / Shift+Tab: the next editable cell, wrapping onto the next row.
     Tab past the last cell adds a row - unless that last row is still empty,
     when Tab leaves the sheet instead of piling up empty rows. Returns
     whether it moved. */
  const tabFrom = useCallback((r, c, dir) => {
    const { rows: rs, columns: cols } = live.current;
    let rr = r;
    let cc = c;
    for (let step = 0; step <= cols.length; step += 1) {
      cc += dir;
      if (cc >= cols.length) { cc = 0; rr += 1; }
      if (cc < 0) { cc = cols.length - 1; rr -= 1; }
      if (rr < 0) return false;
      if (rr >= rs.length) {
        if (dir < 0 || !rs.length || isBlankRow(rs[rs.length - 1])) return false;
        addRow();
        return true;
      }
      if (!cols[cc].readOnly) {
        moveTo(rr, cc);
        return true;
      }
    }
    return false;
  }, [addRow, moveTo]);

  const onEditorChange = useCallback((value) => {
    setEditing((ed) => (ed ? { ...ed, value, error: "" } : ed));
  }, []);

  const onEditorKeyDown = useCallback((event) => {
    const ed = live.current.editing;
    if (!ed) return;
    const { key, shiftKey } = event;
    /* a drop-down cell: Up / Down step through its list while editing (after
       Enter, F2 or a double-click) - or with Alt at any time; after typing
       over the cell they move on, as everywhere else */
    const options = live.current.columns[ed.c]?.options;
    if (options && (key === "ArrowDown" || key === "ArrowUp") && (ed.mode === "edit" || event.altKey)) {
      event.preventDefault();
      event.stopPropagation();
      const at = options.findIndex((option) => option.toLowerCase() === String(ed.value).trim().toLowerCase());
      const step = key === "ArrowDown" ? 1 : -1;
      const value = options[at < 0 ? (step > 0 ? 0 : options.length - 1) : (at + step + options.length) % options.length];
      const next = { ...ed, value, error: "" };
      live.current.editing = next;
      setEditing(next);
      return;
    }
    if (key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      if (commitEdit()) {
        focusGrid();
        moveTo(ed.r + (shiftKey ? -1 : 1), ed.c);
      }
    } else if (key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      if (commitEdit()) {
        focusGrid();
        if (!tabFrom(ed.r, ed.c, shiftKey ? -1 : 1)) moveTo(ed.r, ed.c);
      }
    } else if (key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancelEdit();
      setNotice(null);
      focusGrid();
    } else if (DIRS[key] && ed.mode === "replace") {
      event.preventDefault();
      event.stopPropagation();
      if (commitEdit()) {
        focusGrid();
        moveTo(ed.r + DIRS[key][0], ed.c + DIRS[key][1]);
      }
    }
  }, [commitEdit, cancelEdit, focusGrid, moveTo, tabFrom]);

  /* Clicking away keeps a valid value, as Excel does. A value the column
     refuses cannot be left in the cell, so the old one is put back and the
     reason shown. Switching windows leaves the edit open. */
  const onEditorBlur = useCallback(() => {
    if (typeof document !== "undefined" && !document.hasFocus()) return;
    const ed = live.current.editing;
    if (!ed) return;
    if (!commitEdit()) {
      const reason = live.current.editing?.error || "";
      const label = live.current.columns[ed.c]?.label || "";
      cancelEdit();
      setNotice({ tone: "error", text: `Row ${ed.r + 1} ${label}: ${reason} - the previous value was kept` });
    }
  }, [commitEdit, cancelEdit]);

  /* an option clicked in a drop-down cell: it is the value, applied at once,
     and the cursor stays on the cell */
  const onEditorPick = useCallback((option) => {
    const ed = live.current.editing;
    if (!ed) return;
    live.current.editing = { ...ed, value: option, error: "" };
    if (commitEdit()) focusGrid();
  }, [commitEdit, focusGrid]);

  const editorRef = useCallback((el) => {
    if (!el) return;
    el.focus({ preventScroll: true });
    const end = el.value.length;
    try { el.setSelectionRange(end, end); } catch { /* not a text input */ }
  }, []);

  /* ------------------------------------------------------ selection --- */

  const selectAll = useCallback(() => {
    const { rows: rs, columns: cols } = live.current;
    if (!rs.length) return;
    setAnchor({ r: rs.length - 1, c: cols.length - 1 });
    setActive({ r: 0, c: 0 });
  }, []);

  const selectionText = useCallback(() => {
    const { rows: rs, columns: cols, active: a, anchor: b } = live.current;
    const rect = rectOf(a, b);
    const lines = [];
    for (let r = rect.r1; r <= rect.r2; r += 1) {
      const row = rs[r];
      if (!row) continue;
      const line = [];
      for (let c = rect.c1; c <= rect.c2; c += 1) line.push(cols[c].display(row, r));
      lines.push(line);
    }
    return { text: toTsv(lines), cells: lines.length * (rect.c2 - rect.c1 + 1) };
  }, []);

  const clearSelection = useCallback(() => {
    const cur = live.current;
    const plan = planClear({ rows: cur.rows, columns: cur.columns, rect: rectOf(cur.active, cur.anchor), ctx: { rateCodeMapping: cur.rateCodeMapping } });
    if (plan.changed) emit(plan.rows);
    if (plan.skipped.length) {
      setNotice({ tone: "error", text: `${plan.changed ? `Cleared ${plural(plan.changed, "cell")}. ` : ""}Not cleared - ${describeSkipped(plan.skipped, cur.columns)}` });
    } else {
      setNotice(plan.changed ? { tone: "info", text: `Cleared ${plural(plan.changed, "cell")}` } : null);
    }
  }, [emit]);

  /* ------------------------------------------------- grid keyboard ---- */

  const onGridKeyDown = useCallback((event) => {
    if (event.target !== scrollRef.current) return;     // a button in the sheet, or the editor
    const cur = live.current;
    const { key } = event;
    const ctrl = event.ctrlKey || event.metaKey;
    const lower = key.length === 1 ? key.toLowerCase() : key;

    if (ctrl && lower === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return; }
    if (ctrl && lower === "y") { event.preventDefault(); redo(); return; }
    if (ctrl && lower === "a") { event.preventDefault(); selectAll(); return; }
    if (ctrl && (lower === "c" || lower === "x" || lower === "v")) return;  // arrive as copy / cut / paste

    if (!cur.rows.length) {
      if (key === "Enter" || (key.length === 1 && !ctrl && !event.altKey)) {
        event.preventDefault();
        addRow();
        if (key.length === 1) startEdit(0, cur.columns.findIndex((col) => !col.readOnly), "replace", key);
      }
      return;
    }

    const a = cur.active;
    const last = { r: cur.rows.length - 1, c: cur.columns.length - 1 };
    if (DIRS[key]) {
      event.preventDefault();
      const [dr, dc] = DIRS[key];
      const r = ctrl ? (dr < 0 ? 0 : dr > 0 ? last.r : a.r) : a.r + dr;
      const c = ctrl ? (dc < 0 ? 0 : dc > 0 ? last.c : a.c) : a.c + dc;
      moveTo(r, c, event.shiftKey);
      return;
    }

    const page = Math.max(1, Math.floor((scrollRef.current.clientHeight - cur.metrics.head) / cur.metrics.row) - 1);
    switch (key) {
      case "Tab":
        if (tabFrom(a.r, a.c, event.shiftKey ? -1 : 1)) event.preventDefault();
        return;
      case "Home":
        event.preventDefault();
        moveTo(ctrl ? 0 : a.r, 0, event.shiftKey);
        return;
      case "End":
        event.preventDefault();
        moveTo(ctrl ? last.r : a.r, last.c, event.shiftKey);
        return;
      case "PageDown":
        event.preventDefault();
        moveTo(a.r + page, a.c, event.shiftKey);
        return;
      case "PageUp":
        event.preventDefault();
        moveTo(a.r - page, a.c, event.shiftKey);
        return;
      case "Enter":
        event.preventDefault();
        if (event.shiftKey || !startEdit(a.r, a.c, "edit")) moveTo(a.r + (event.shiftKey ? -1 : 1), a.c);
        return;
      case "F2":
        event.preventDefault();
        startEdit(a.r, a.c, "edit");
        return;
      case "Escape":
        setAnchor(a);
        setConfirmId(null);
        setNotice(null);
        return;
      case "Delete":
      case "Backspace":
        event.preventDefault();
        clearSelection();
        return;
      default:
    }

    /* typing over the cell, as in Excel */
    if (key.length === 1 && !ctrl && !event.altKey) {
      if (startEdit(a.r, a.c, "replace", key)) event.preventDefault();
    }
  }, [addRow, clearSelection, moveTo, redo, selectAll, startEdit, tabFrom, undo]);

  /* --------------------------------------------------- grid mouse ----- */

  const onGridMouseDown = useCallback((event) => {
    if (event.button !== 0) return;
    if (event.target.closest("button, input, a, select, textarea")) return;
    const th = event.target.closest("th[data-c]");
    const td = th ? null : event.target.closest("td[data-c]");
    if (!th && !td) return;            // the scrollbar, a spacer
    event.preventDefault();
    if (live.current.editing && !commitEdit()) return;   // a refused value keeps its cell
    focusGrid();
    setConfirmId(null);
    const { rows: rs } = live.current;
    if (th) {
      /* the whole column, cursor at its top */
      if (!rs.length) return;
      const c = Number(th.dataset.c);
      setAnchor({ r: rs.length - 1, c });
      setActive({ r: 0, c });
      return;
    }
    const cell = { r: Number(td.dataset.r), c: Number(td.dataset.c) };
    setActive(cell);
    if (!event.shiftKey) setAnchor(cell);
    dragRef.current = true;
  }, [commitEdit, focusGrid]);

  const onGridMouseOver = useCallback((event) => {
    if (!dragRef.current) return;
    const td = event.target.closest?.("td[data-c]");
    if (!td) return;
    const cell = { r: Number(td.dataset.r), c: Number(td.dataset.c) };
    setActive((a) => (a.r === cell.r && a.c === cell.c ? a : cell));
  }, []);

  const onGridDoubleClick = useCallback((event) => {
    if (event.target.closest("button, input")) return;
    const td = event.target.closest("td[data-c]");
    if (!td) return;
    startEdit(Number(td.dataset.r), Number(td.dataset.c), "edit");
  }, [startEdit]);

  /* ---------------------------------------------------- clipboard ----- */

  const onGridCopy = useCallback((event) => {
    if (live.current.editing || !live.current.rows.length) return;   // the editor's own text copy
    const { text, cells } = selectionText();
    event.clipboardData.setData("text/plain", text);
    event.preventDefault();
    setNotice({ tone: "info", text: `Copied ${plural(cells, "cell")}` });
  }, [selectionText]);

  const onGridCut = useCallback((event) => {
    if (live.current.editing || !live.current.rows.length) return;
    const { text } = selectionText();
    event.clipboardData.setData("text/plain", text);
    event.preventDefault();
    clearSelection();
  }, [selectionText, clearSelection]);

  const onGridPaste = useCallback((event) => {
    const text = event.clipboardData?.getData("text/plain") ?? "";
    const cur = live.current;
    /* one value into the open editor is the browser's own paste; a block
       (tabs or line breaks) goes into the cells from the editor's cell on */
    if (cur.editing && !/[\t\n\r]/.test(text.replace(/\r?\n$/, ""))) return;
    event.preventDefault();
    if (cur.editing) cancelEdit();
    const matrix = parseTsv(text);
    if (!matrix.length) return;

    const rect = rectOf(cur.active, cur.anchor);
    const oneValue = matrix.length === 1 && matrix[0].length === 1;
    const plan = planPaste({
      rows: cur.rows,
      columns: cur.columns,
      top: rect.r1,
      left: rect.c1,
      matrix,
      fill: oneValue && (rect.r1 !== rect.r2 || rect.c1 !== rect.c2) ? rect : null,
      ctx: { rateCodeMapping: cur.rateCodeMapping },
      createRow: cur.createRow,
    });
    if (plan.changed || plan.added) emit(plan.rows);
    setActive({ r: rect.r1, c: rect.c1 });
    setAnchor({ r: Math.max(rect.r1, plan.bottom), c: Math.max(rect.c1, plan.right) });

    const done = [];
    if (plan.changed) done.push(`Pasted ${plural(plan.changed, "cell")}`);
    if (plan.added) done.push(`added ${plural(plan.added, "row")}`);
    if (plan.droppedCols) done.push(`${plural(plan.droppedCols, "value")} past the last column left out`);
    const summary = done.length ? done.join(", ") : "Nothing was pasted";
    setNotice(plan.skipped.length
      ? { tone: "error", text: `${summary}. Not pasted - ${describeSkipped(plan.skipped, cur.columns)}` }
      : { tone: "info", text: `${summary}.` });
    focusGrid();
  }, [cancelEdit, emit, focusGrid]);

  /* ------------------------------------------------------ row actions -- */

  const onRequestRemove = useCallback((row) => {
    if (lockReason(row)) return;
    if (isBlankRow(row)) {
      live.current.onRemoveRow(row);
      focusGrid();
      return;
    }
    setConfirmId(row.id);
  }, [focusGrid]);

  const onConfirmRemove = useCallback((row) => {
    setConfirmId(null);
    live.current.onRemoveRow(row);
    setNotice({
      tone: "info",
      text: row._id ? `Row removed - barcode ${row.barcodeNo || ""} will be deleted when you Submit` : "Row removed",
    });
    focusGrid();
  }, [focusGrid]);

  const onCancelRemove = useCallback(() => {
    setConfirmId(null);
    focusGrid();
  }, [focusGrid]);

  /* A refused Submit asks for the first cell to fix. */
  useEffect(() => {
    if (!focusRequest) return;
    const { rows: rs, columns: cols } = live.current;
    const r = rs.findIndex((row) => row.id === focusRequest.rowId);
    if (r < 0) return;
    const c = cols.findIndex((col) => col.key === focusRequest.key);
    moveTo(r, c < 0 ? firstEditable : c);
    requestAnimationFrame(focusGrid);
  }, [focusRequest, moveTo, focusGrid, firstEditable]);

  /* ------------------------------------------------------- render ----- */

  const errorCache = useMemo(() => new WeakMap(), [columns]);
  const errorsOf = (row) => {
    if (!needsCheck(row) || lockReason(row)) return null;
    if (!errorCache.has(row)) errorCache.set(row, rowErrors(row, columns));
    return errorCache.get(row);
  };

  let editedCount = 0;
  let errorCells = 0;
  rows.forEach((row) => {
    if (row._edited) editedCount += 1;
    const errors = errorsOf(row);
    if (errors) errorCells += Object.keys(errors).length;
  });

  const n = rows.length;
  const rect = rectOf(active, anchor);
  let start = Math.max(0, Math.floor(view.top / metrics.row) - OVERSCAN);
  let end = Math.min(n, Math.ceil((view.top + view.height) / metrics.row) + OVERSCAN);
  /* the row being edited stays mounted however far it is scrolled */
  if (editing && editing.r < n) {
    start = Math.min(start, editing.r);
    end = Math.max(end, editing.r + 1);
  }
  start = Math.min(start, n);

  const selectedCells = (rect.r2 - rect.r1 + 1) * (rect.c2 - rect.c1 + 1);
  const where = !n
    ? "No rows yet - Add Row, paste from Excel, or Import Excel"
    : selectedCells > 1
      ? `${plural(rect.r2 - rect.r1 + 1, "row")} × ${plural(rect.c2 - rect.c1 + 1, "column")} selected`
      : `Row ${active.r + 1} · ${columns[active.c]?.label || ""}`;

  const spacer = (height, key) => (
    <tr key={key} aria-hidden="true">
      <td colSpan={columns.length + 1} className="p-0" style={{ height }} />
    </tr>
  );

  return (
    <div>
      <div
        ref={scrollRef}
        tabIndex={0}
        aria-label="Items - editable sheet. Arrow keys move, Enter or F2 edits, Tab moves to the next cell."
        onKeyDown={onGridKeyDown}
        onMouseDown={onGridMouseDown}
        onMouseOver={onGridMouseOver}
        onDoubleClick={onGridDoubleClick}
        onCopy={onGridCopy}
        onCut={onGridCut}
        onPaste={onGridPaste}
        onScroll={onScroll}
        onFocus={() => setFocused(true)}
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
        className="relative max-h-[60vh] min-h-[180px] overflow-auto outline-none"
      >
        <table className="w-full min-w-[1200px] border-separate border-spacing-0 text-xs">
          <thead>
            <tr className="bg-gray-100 text-left text-gray-700">
              {columns.map((col, c) => {
                const inSelection = n > 0 && c >= rect.c1 && c <= rect.c2;
                return (
                  <th
                    key={col.key}
                    data-c={c}
                    scope="col"
                    style={{ minWidth: col.width, backgroundColor: inSelection ? HEADER_SELECTED : undefined }}
                    title={col.readOnly ? `${col.label} - ${col.note || "worked out, not typed"}`
                      : col.options ? `${col.label} - ${col.options.join(" / ")}` : `${col.label} - click to select the column`}
                    className={`sticky top-0 cursor-pointer select-none whitespace-nowrap border-b border-r border-t border-gray-300 bg-gray-100 px-2 py-2 ${c === 0 ? "left-0 z-30 border-l" : "z-20"}`}
                  >
                    {col.label}
                  </th>
                );
              })}
              <th scope="col" className="sticky top-0 z-20 w-16 whitespace-nowrap border-b border-r border-t border-gray-300 bg-gray-100 px-2 py-2 text-center">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {n === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="border-b border-l border-r border-gray-300 px-3 py-8 text-center text-gray-500">No data found</td>
              </tr>
            ) : null}
            {start > 0 ? spacer(start * metrics.row, "above") : null}
            {rows.slice(start, end).map((row, k) => {
              const r = start + k;
              const inRows = r >= rect.r1 && r <= rect.r2;
              return (
                <SheetRow
                  key={row.id ?? `row-${r}`}
                  row={row}
                  r={r}
                  columns={columns}
                  activeC={active.r === r ? active.c : -1}
                  activeFocused={active.r === r ? focused : false}
                  selC1={inRows ? rect.c1 : null}
                  selC2={inRows ? rect.c2 : null}
                  editing={editing && editing.r === r ? editing : null}
                  errors={errorsOf(row)}
                  locked={lockReason(row)}
                  confirming={confirmId === row.id}
                  editorRef={editorRef}
                  onEditorChange={onEditorChange}
                  onEditorKeyDown={onEditorKeyDown}
                  onEditorBlur={onEditorBlur}
                  onEditorPick={onEditorPick}
                  onRequestRemove={onRequestRemove}
                  onConfirmRemove={onConfirmRemove}
                  onCancelRemove={onCancelRemove}
                />
              );
            })}
            {end < n ? spacer((n - end) * metrics.row, "below") : null}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-gray-300 bg-gray-50 px-3 py-2 text-xs">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={addRow}
            title="Add an empty row at the end - Tab past the last cell does the same"
            className="flex shrink-0 items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <Icon name="plus" size={14} /> Add Row
          </button>
          <span role="status" aria-live="polite" className={`min-w-0 break-words ${notice?.tone === "error" ? "font-medium text-red-700" : "text-gray-600"}`}>
            {notice?.text || where}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-500">
          {editedCount > 0 ? <span className="text-amber-700">{plural(editedCount, "row")} edited - Submit to save</span> : null}
          {pendingDeleteCount > 0 ? (
            <span className="text-red-700">
              {plural(pendingDeleteCount, "saved row")} will be deleted on Submit
              {onUndoDeletes ? (
                <>
                  {" · "}
                  <button type="button" onClick={onUndoDeletes} className="font-medium underline">Undo</button>
                </>
              ) : null}
            </span>
          ) : null}
          {errorCells > 0 ? <span className="text-red-700">{plural(errorCells, "cell")} to fix</span> : null}
          <span className="hidden xl:inline">Enter / F2 edit · Tab next · Esc cancel · Ctrl+C / Ctrl+V · Ctrl+Z undo</span>
        </div>
      </div>
    </div>
  );
}
