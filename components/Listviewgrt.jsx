// // // // "use client";
// // // // import { useCallback, useEffect, useState } from "react";
// // // // import { useRouter } from "next/navigation";
// // // // import Icon from "./Icon";
// // // // import Toolbar from "./Toolbar";
// // // // import ModalForm from "./ModalForm";
// // // // import FilterPanel from "./FilterPanel";
// // // // import { useScope } from "./ScopeContext";
// // // // import { fmt, toCsv, toXlsHtml, download, printTable } from "@/lib/format";

// // // // /* ==========================================================================
// // // //    Generic list card.

// // // //    The page passes its own cfg - columns, endpoint, base path. There is no
// // // //    registry lookup here any more; `cfg.endpoint` points at that resource's
// // // //    own REST route (/api/business, /api/ledger, ...).

// // // //    ========================================================================== */

// // // // /* Action ▾ button with its dropdown. The GRC list needs Edit / Barcode Print /
// // // //    GRC Print here; other lists fall back to a single Edit entry. */
// // // // function ActionMenu({ items, open, onToggle, onGo }) {
// // // //   return (
// // // //     <span
// // // //       className="relative inline-block"
// // // //       onClick={(e) => e.stopPropagation()}
// // // //     >
// // // //       <button
// // // //         type="button"
// // // //         className="h-[26px] cursor-pointer rounded border-0 bg-brand px-2.5 text-xs text-white"
// // // //         onClick={onToggle}
// // // //       >
// // // //         Action &#9662;
// // // //       </button>

// // // //       {open && (
// // // //         <span className="absolute left-0 top-[28px] z-30 block min-w-[190px] rounded-md border border-line bg-white py-1 shadow-pop">
// // // //           {items.map((m, i) => (
// // // //             <button
// // // //               key={m.label}
// // // //               type="button"
// // // //               onClick={() => onGo(m.href)}
// // // //               className={
// // // //                 "flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13.5px] text-ink hover:bg-[#f5f8fd] " +
// // // //                 (i > 0 ? "border-t border-line" : "")
// // // //               }
// // // //             >
// // // //               <Icon name={m.icon} size={14} />
// // // //               {m.label}
// // // //             </button>
// // // //           ))}
// // // //         </span>
// // // //       )}
// // // //     </span>
// // // //   );
// // // // }

// // // // export default function ListView({ cfg, slug }) {
// // // //   const router = useRouter();
// // // //   const { business, location, finYear } = useScope();
// // // //   const [state, setState] = useState({
// // // //     rows: [],
// // // //     labels: {},
// // // //     page: 1,
// // // //     pages: 1,
// // // //     total: 0,
// // // //   });
// // // //   const [search, setSearch] = useState("");
// // // //   const [hidden, setHidden] = useState([]);
// // // //   const [loading, setLoading] = useState(true);
// // // //   const [page, setPage] = useState(1);
// // // //   const [modal, setModal] = useState(false);
// // // //   const [filters, setFilters] = useState({});
// // // //   const [menuFor, setMenuFor] = useState(null);

// // // //   /* close the open Action menu on any outside click */
// // // //   useEffect(() => {
// // // //     if (!menuFor) return;
// // // //     const close = () => setMenuFor(null);
// // // //     document.addEventListener("click", close);
// // // //     return () => document.removeEventListener("click", close);
// // // //   }, [menuFor]);

// // // //   const columns = cfg.columns || [];
// // // //   const actionPos = cfg.actionPosition || "right";
// // // //   const actionVariant = cfg.actionVariant || "icons";

// // // //   const slugPath = cfg.slugPath || slug;
// // // //   const base = (cfg.basePath || "/admin/setting/") + slugPath;

// // // //   const searched = !cfg.searchOnly || Object.keys(filters).length > 0;

// // // //   const load = useCallback(async () => {
// // // //     if (cfg.searchOnly && Object.keys(filters).length === 0) {
// // // //       setLoading(false);
// // // //       return;
// // // //     }
// // // //     setLoading(true);

// // // //     const qs = new URLSearchParams({
// // // //       page: String(page),
// // // //       search,
// // // //       business: business || "",
// // // //       location: location || "",
// // // //       finYear: finYear || "",
// // // //     });
// // // //     Object.entries(filters).forEach(([k, v]) => {
// // // //       if (v) qs.set(k, v);
// // // //     });

// // // //     const url = cfg.endpoint + "?" + qs;

// // // //     try {
// // // //       const r = await fetch(url);
// // // //       const d = await r.json();
// // // //       setState({
// // // //         rows: d.rows || [],
// // // //         labels: d.labels || {},
// // // //         page: d.page || 1,
// // // //         pages: d.pages || 1,
// // // //         total: d.total || 0,
// // // //       });
// // // //     } finally {
// // // //       setLoading(false);
// // // //     }
// // // //   }, [
// // // //     cfg.endpoint,
// // // //     slugPath,
// // // //     page,
// // // //     search,
// // // //     business,
// // // //     location,
// // // //     finYear,
// // // //     filters,
// // // //     cfg.searchOnly,
// // // //   ]);

// // // //   useEffect(() => {
// // // //     load();
// // // //   }, [load]);
// // // //   useEffect(() => {
// // // //     setPage(1);
// // // //   }, [slugPath, search, business, location, finYear]);

// // // //   const visible = columns.filter((c) => !hidden.includes(c.t));

// // // //   const cellValue = (row, col) => {
// // // //     const raw = row[col.k];
// // // //     if (col.f === "pill") {
// // // //       const v = String(raw || "");
// // // //       if (!v) return "";
// // // //       return (
// // // //         <span
// // // //           className={
// // // //             "pill " + (v === "Fully Adjusted" ? "pill-green" : "pill-grey")
// // // //           }
// // // //         >
// // // //           {v}
// // // //         </span>
// // // //       );
// // // //     }
// // // //     if (col.f === "dash") return raw ? String(raw) : "\u2014";
// // // //     return fmt(col.f, raw, state.labels);
// // // //   };

// // // //   const exportRows = () =>
// // // //     state.rows.map((r) =>
// // // //       visible.map((c) => {
// // // //         if (c.f === "pill") return String(r[c.k] || "");
// // // //         if (c.f === "dash") return r[c.k] ? String(r[c.k]) : "";
// // // //         return fmt(c.f, r[c.k], state.labels);
// // // //       }),
// // // //     );
// // // //   const exportHeaders = () => visible.map((c) => c.t);
// // // //   const fileBase = String(slugPath).replace(/\//g, "-");

// // // //   async function remove(id) {
// // // //     if (!window.confirm("Delete this record?")) return;
// // // //     await fetch(cfg.endpoint + "/" + id, { method: "DELETE" });
// // // //     load();
// // // //   }

// // // //   return (
// // // //     <>
// // // //       {cfg.aboveCardButton && (
// // // //         <button type="button" className="btn btn-primary mb-3">
// // // //           <Icon name="grid" size={14} /> {cfg.aboveCardButton}
// // // //         </button>
// // // //       )}

// // // //       {cfg.filters && (
// // // //         <FilterPanel
// // // //           filters={cfg.filters}
// // // //           onSearch={(f) => {
// // // //             setPage(1);
// // // //             setFilters(f);
// // // //           }}
// // // //         />
// // // //       )}

// // // //       {modal && (
// // // //         <ModalForm
// // // //           cfg={cfg}
// // // //           slug={slugPath}
// // // //           onClose={() => setModal(false)}
// // // //           onSaved={() => {
// // // //             setModal(false);
// // // //             load();
// // // //           }}
// // // //         />
// // // //       )}

// // // //       <div className="card">
// // // //         <div className="card-head">
// // // //           <span className="card-title">{cfg.title}</span>
// // // //           <span className="flex-1" />
// // // //           {cfg.extraAction && (
// // // //             <button
// // // //               type="button"
// // // //               className="btn btn-primary"
// // // //               onClick={() => router.push(cfg.extraAction.href)}
// // // //             >
// // // //               <Icon name={cfg.extraAction.icon || "grid"} size={14} />{" "}
// // // //               {cfg.extraAction.label}
// // // //             </button>
// // // //           )}
// // // //           {cfg.showRefresh !== false && (
// // // //             <button type="button" className="btn btn-ghost" onClick={load}>
// // // //               <Icon name="refresh" size={14} /> Refresh
// // // //             </button>
// // // //           )}
// // // //         </div>

// // // //         <div className="card-body">
// // // //           <Toolbar
// // // //             columns={columns}
// // // //             hidden={hidden}
// // // //             onToggleColumn={(t) =>
// // // //               setHidden((h) =>
// // // //                 h.includes(t) ? h.filter((x) => x !== t) : [...h, t],
// // // //               )
// // // //             }
// // // //             search={search}
// // // //             onSearch={setSearch}
// // // //             onAdd={() => {
// // // //               if (cfg.formMode === "modal") return setModal(true);
// // // //               if (cfg.addHref) return router.push(cfg.addHref);
// // // //               return router.push(base + "/add");
// // // //             }}
// // // //             showAdd={cfg.showAdd !== false}
// // // //             showCsv={cfg.showCsv !== false}
// // // //             onExportCsv={() =>
// // // //               download(
// // // //                 fileBase + ".csv",
// // // //                 toCsv(exportHeaders(), exportRows()),
// // // //                 "text/csv",
// // // //               )
// // // //             }
// // // //             onExportExcel={() =>
// // // //               download(
// // // //                 fileBase + ".xls",
// // // //                 toXlsHtml(cfg.title, exportHeaders(), exportRows()),
// // // //                 "application/vnd.ms-excel",
// // // //               )
// // // //             }
// // // //             onExportPdf={() =>
// // // //               printTable(cfg.title, exportHeaders(), exportRows())
// // // //             }
// // // //           />

// // // //           <div className="mt-3 overflow-x-auto">
// // // //             <table className="dt">
// // // //               <thead>
// // // //                 <tr>
// // // //                   {actionPos === "left" && <th>Action</th>}
// // // //                   {visible.map((c, i) => (
// // // //                     <th key={c.t + i}>{c.t}</th>
// // // //                   ))}
// // // //                   {actionPos === "right" && <th>Action</th>}
// // // //                 </tr>
// // // //               </thead>
// // // //               <tbody>
// // // //                 {loading && (
// // // //                   <tr>
// // // //                     <td colSpan={visible.length + 1} className="dt-empty">
// // // //                       <span className="spin" />
// // // //                     </td>
// // // //                   </tr>
// // // //                 )}
// // // //                 {!loading && !searched && (
// // // //                   <tr>
// // // //                     <td colSpan={visible.length + 1} className="dt-empty">
// // // //                       Use the filter above to search.
// // // //                     </td>
// // // //                   </tr>
// // // //                 )}
// // // //                 {!loading && searched && state.rows.length === 0 && (
// // // //                   <tr>
// // // //                     <td colSpan={visible.length + 1} className="dt-empty">
// // // //                       No Data..
// // // //                     </td>
// // // //                   </tr>
// // // //                 )}
// // // //                 {!loading &&
// // // //                   state.rows.map((row) => {
// // // //                     const actions = (
// // // //                       <td>
// // // //                         {actionVariant === "dropdown" ? (
// // // //                           <ActionMenu
// // // //                             items={(
// // // //                               cfg.actionMenu || [
// // // //                                 {
// // // //                                   label: "Edit",
// // // //                                   icon: "pencil",
// // // //                                   to: (r) => base + "/" + r._id,
// // // //                                 },
// // // //                               ]
// // // //                             ).map((m) => ({ ...m, href: m.to(row) }))}
// // // //                             open={menuFor === row._id}
// // // //                             onToggle={() =>
// // // //                               setMenuFor((m) =>
// // // //                                 m === row._id ? null : row._id,
// // // //                               )
// // // //                             }
// // // //                             onGo={(href) => {
// // // //                               setMenuFor(null);
// // // //                               router.push(href);
// // // //                             }}
// // // //                           />
// // // //                         ) : (
// // // //                           <span className="inline-flex items-center gap-1.5">
// // // //                             {(
// // // //                               cfg.actionIcons || ["view", "edit", "delete"]
// // // //                             ).map((a) => {
// // // //                               if (a === "view")
// // // //                                 return (
// // // //                                   <button
// // // //                                     key={a}
// // // //                                     className="act-btn bg-[#2b7fd4]"
// // // //                                     title="View"
// // // //                                     onClick={() =>
// // // //                                       router.push(base + "/" + row._id)
// // // //                                     }
// // // //                                   >
// // // //                                     <Icon name="eye" size={12} />
// // // //                                   </button>
// // // //                                 );
// // // //                               if (a === "edit")
// // // //                                 return (
// // // //                                   <button
// // // //                                     key={a}
// // // //                                     className="act-btn bg-warnyellow"
// // // //                                     title="Edit"
// // // //                                     onClick={() =>
// // // //                                       router.push(base + "/" + row._id)
// // // //                                     }
// // // //                                   >
// // // //                                     <Icon name="pencil" size={12} />
// // // //                                   </button>
// // // //                                 );
// // // //                               if (a === "print")
// // // //                                 return (
// // // //                                   <button
// // // //                                     key={a}
// // // //                                     className="act-btn bg-[#2b7fd4]"
// // // //                                     title="Print"
// // // //                                     onClick={() => window.print()}
// // // //                                   >
// // // //                                     <Icon name="file" size={12} />
// // // //                                   </button>
// // // //                                 );
// // // //                               return (
// // // //                                 <button
// // // //                                   key={a}
// // // //                                   className="act-btn bg-danger"
// // // //                                   title="Delete"
// // // //                                   onClick={() => remove(row._id)}
// // // //                                 >
// // // //                                   <Icon name="trash" size={12} />
// // // //                                 </button>
// // // //                               );
// // // //                             })}
// // // //                             {cfg.actionExtraButton && (
// // // //                               <button
// // // //                                 className="btn h-6 px-2 text-[11px]"
// // // //                                 onClick={() => window.print()}
// // // //                               >
// // // //                                 <Icon name="file" size={11} />{" "}
// // // //                                 {cfg.actionExtraButton}
// // // //                               </button>
// // // //                             )}
// // // //                           </span>
// // // //                         )}
// // // //                       </td>
// // // //                     );
// // // //                     return (
// // // //                       <tr key={row._id}>
// // // //                         {actionPos === "left" && actions}
// // // //                         {visible.map((c, i) => (
// // // //                           <td key={c.t + i}>{cellValue(row, c)}</td>
// // // //                         ))}
// // // //                         {actionPos === "right" && actions}
// // // //                       </tr>
// // // //                     );
// // // //                   })}
// // // //               </tbody>
// // // //             </table>
// // // //           </div>

// // // //           <div className="flex items-center pt-3 text-[13px] text-cell">
// // // //             <span>
// // // //               Page <b className="text-brand-link">{state.page}</b> of{" "}
// // // //               {state.pages}
// // // //             </span>
// // // //             <span className="flex-1" />
// // // //             <span className="flex gap-2">
// // // //               <button
// // // //                 className="btn"
// // // //                 disabled={state.page <= 1}
// // // //                 onClick={() => setPage((p) => p - 1)}
// // // //               >
// // // //                 Previous
// // // //               </button>
// // // //               <button
// // // //                 className="btn"
// // // //                 disabled={state.page >= state.pages}
// // // //                 onClick={() => setPage((p) => p + 1)}
// // // //               >
// // // //                 Next
// // // //               </button>
// // // //             </span>
// // // //           </div>
// // // //         </div>
// // // //       </div>
// // // //     </>
// // // //   );
// // // // }







// // // "use client";
// // // import { useCallback, useEffect, useState } from "react";
// // // import { useRouter } from "next/navigation";
// // // import Icon from "./Icon";
// // // import Toolbar from "./Toolbar";
// // // import ModalForm from "./ModalForm";
// // // import FilterPanel from "./FilterPanel";
// // // import { useScope } from "./ScopeContext";
// // // import { fmt, toCsv, toXlsHtml, download, printTable } from "@/lib/format";

// // // /* ==========================================================================
// // //    Generic list card.

// // //    The page passes its own cfg - columns, endpoint, base path. There is no
// // //    registry lookup here any more; `cfg.endpoint` points at that resource's
// // //    own REST route (/api/business, /api/ledger, ...).

// // //    ========================================================================== */

// // // /* Action ▾ button with its dropdown. The GRC list needs Edit / Barcode Print /
// // //    GRC Print here; other lists fall back to a single Edit entry. */
// // // function ActionMenu({ items, open, onToggle, onGo }) {
// // //   return (
// // //     <span
// // //       className="relative inline-block"
// // //       onClick={(e) => e.stopPropagation()}
// // //     >
// // //       <button
// // //         type="button"
// // //         className="h-[26px] cursor-pointer rounded border-0 bg-brand px-2.5 text-xs text-white"
// // //         onClick={onToggle}
// // //       >
// // //         Action &#9662;
// // //       </button>

// // //       {open && (
// // //         <span className="absolute left-0 top-[28px] z-30 block min-w-[190px] rounded-md border border-line bg-white py-1 shadow-pop">
// // //           {items.map((m, i) => (
// // //             <button
// // //               key={m.label}
// // //               type="button"
// // //               onClick={() => onGo(m.href)}
// // //               className={
// // //                 "flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13.5px] text-ink hover:bg-[#f5f8fd] " +
// // //                 (i > 0 ? "border-t border-line" : "")
// // //               }
// // //             >
// // //               <Icon name={m.icon} size={14} />
// // //               {m.label}
// // //             </button>
// // //           ))}
// // //         </span>
// // //       )}
// // //     </span>
// // //   );
// // // }

// // // export default function ListView({ cfg, slug }) {
// // //   const router = useRouter();
// // //   const { business, location, finYear } = useScope();
// // //   const [state, setState] = useState({
// // //     rows: [],
// // //     labels: {},
// // //     page: 1,
// // //     pages: 1,
// // //     total: 0,
// // //   });
// // //   const [search, setSearch] = useState("");
// // //   const [hidden, setHidden] = useState([]);
// // //   const [loading, setLoading] = useState(true);
// // //   const [page, setPage] = useState(1);
// // //   const [modal, setModal] = useState(false);
// // //   const [filters, setFilters] = useState({});
// // //   const [menuFor, setMenuFor] = useState(null);

// // //   /* close the open Action menu on any outside click */
// // //   useEffect(() => {
// // //     if (!menuFor) return;
// // //     const close = () => setMenuFor(null);
// // //     document.addEventListener("click", close);
// // //     return () => document.removeEventListener("click", close);
// // //   }, [menuFor]);

// // //   const columns = cfg.columns || [];
// // //   const actionPos = cfg.actionPosition || "right";
// // //   const actionVariant = cfg.actionVariant || "icons";

// // //   const slugPath = cfg.slugPath || slug;
// // //   const base = (cfg.basePath || "/admin/setting/") + slugPath;

// // //   const searched = !cfg.searchOnly || Object.keys(filters).length > 0;

// // //   const load = useCallback(async () => {
// // //     if (cfg.searchOnly && Object.keys(filters).length === 0) {
// // //       setLoading(false);
// // //       return;
// // //     }
// // //     setLoading(true);

// // //     const qs = new URLSearchParams({
// // //       page: String(page),
// // //       search,
// // //       business: business || "",
// // //       location: location || "",
// // //       finYear: finYear || "",
// // //     });
// // //     Object.entries(filters).forEach(([k, v]) => {
// // //       if (v) qs.set(k, v);
// // //     });

// // //     const url = cfg.endpoint + "?" + qs;

// // //     try {
// // //       const r = await fetch(url);
// // //       const d = await r.json();
// // //       setState({
// // //         rows: d.rows || [],
// // //         labels: d.labels || {},
// // //         page: d.page || 1,
// // //         pages: d.pages || 1,
// // //         total: d.total || 0,
// // //       });
// // //     } finally {
// // //       setLoading(false);
// // //     }
// // //   }, [
// // //     cfg.endpoint,
// // //     slugPath,
// // //     page,
// // //     search,
// // //     business,
// // //     location,
// // //     finYear,
// // //     filters,
// // //     cfg.searchOnly,
// // //   ]);

// // //   useEffect(() => {
// // //     load();
// // //   }, [load]);
// // //   useEffect(() => {
// // //     setPage(1);
// // //   }, [slugPath, search, business, location, finYear]);

// // //   const visible = columns.filter((c) => !hidden.includes(c.t));

// // //   const cellValue = (row, col) => {
// // //     const raw = row[col.k];
// // //     let content;

// // //     if (col.f === "pill") {
// // //       const v = String(raw || "");
// // //       content = v ? (
// // //         <span
// // //           className={
// // //             "pill " + (v === "Fully Adjusted" ? "pill-green" : "pill-grey")
// // //           }
// // //         >
// // //           {v}
// // //         </span>
// // //       ) : (
// // //         ""
// // //       );
// // //     } else if (col.f === "dash") {
// // //       content = raw ? String(raw) : "\u2014";
// // //     } else {
// // //       content = fmt(col.f, raw, state.labels);
// // //     }

// // //     /* Optional inline label after the value - `badge` is a function on the
// // //        column that receives the whole row, so it can key off any field, not
// // //        just this column's. Business Masters uses it to mark the main branch.
// // //        Returns null for rows that shouldn't carry one. */
// // //     const badge = col.badge ? col.badge(row) : null;
// // //     if (!badge) return content;

// // //     return (
// // //       <span className="inline-flex flex-wrap items-center gap-2">
// // //         {content}
// // //         <span
// // //           className={
// // //             "pill " + (badge.tone === "green" ? "pill-green" : "pill-grey")
// // //           }
// // //         >
// // //           {badge.label}
// // //         </span>
// // //       </span>
// // //     );
// // //   };

// // //   const exportRows = () =>
// // //     state.rows.map((r) =>
// // //       visible.map((c) => {
// // //         if (c.f === "pill") return String(r[c.k] || "");
// // //         if (c.f === "dash") return r[c.k] ? String(r[c.k]) : "";
// // //         return fmt(c.f, r[c.k], state.labels);
// // //       }),
// // //     );
// // //   const exportHeaders = () => visible.map((c) => c.t);
// // //   const fileBase = String(slugPath).replace(/\//g, "-");

// // //   async function remove(id) {
// // //     if (!window.confirm("Delete this record?")) return;
// // //     const r = await fetch(cfg.endpoint + "/" + id, { method: "DELETE" });
// // //     /* A refused delete used to look identical to a successful one - the row
// // //        simply stayed. Business Masters now returns 409 for the main branch. */
// // //     if (!r.ok) {
// // //       const d = await r.json().catch(() => ({}));
// // //       window.alert(d.error || "Could not delete this record.");
// // //       return;
// // //     }
// // //     load();
// // //   }

// // //   return (
// // //     <>
// // //       {cfg.aboveCardButton && (
// // //         <button type="button" className="btn btn-primary mb-3">
// // //           <Icon name="grid" size={14} /> {cfg.aboveCardButton}
// // //         </button>
// // //       )}

// // //       {cfg.filters && (
// // //         <FilterPanel
// // //           filters={cfg.filters}
// // //           onSearch={(f) => {
// // //             setPage(1);
// // //             setFilters(f);
// // //           }}
// // //         />
// // //       )}

// // //       {modal && (
// // //         <ModalForm
// // //           cfg={cfg}
// // //           slug={slugPath}
// // //           onClose={() => setModal(false)}
// // //           onSaved={() => {
// // //             setModal(false);
// // //             load();
// // //           }}
// // //         />
// // //       )}

// // //       <div className="card">
// // //         <div className="card-head">
// // //           <span className="card-title">{cfg.title}</span>
// // //           <span className="flex-1" />
// // //           {cfg.extraAction && (
// // //             <button
// // //               type="button"
// // //               className="btn btn-primary"
// // //               onClick={() => router.push(cfg.extraAction.href)}
// // //             >
// // //               <Icon name={cfg.extraAction.icon || "grid"} size={14} />{" "}
// // //               {cfg.extraAction.label}
// // //             </button>
// // //           )}
// // //           {cfg.showRefresh !== false && (
// // //             <button type="button" className="btn btn-ghost" onClick={load}>
// // //               <Icon name="refresh" size={14} /> Refresh
// // //             </button>
// // //           )}
// // //         </div>

// // //         <div className="card-body">
// // //           <Toolbar
// // //             columns={columns}
// // //             hidden={hidden}
// // //             onToggleColumn={(t) =>
// // //               setHidden((h) =>
// // //                 h.includes(t) ? h.filter((x) => x !== t) : [...h, t],
// // //               )
// // //             }
// // //             search={search}
// // //             onSearch={setSearch}
// // //             onAdd={() => {
// // //               if (cfg.formMode === "modal") return setModal(true);
// // //               if (cfg.addHref) return router.push(cfg.addHref);
// // //               return router.push(base + "/add");
// // //             }}
// // //             showAdd={cfg.showAdd !== false}
// // //             showCsv={cfg.showCsv !== false}
// // //             onExportCsv={() =>
// // //               download(
// // //                 fileBase + ".csv",
// // //                 toCsv(exportHeaders(), exportRows()),
// // //                 "text/csv",
// // //               )
// // //             }
// // //             onExportExcel={() =>
// // //               download(
// // //                 fileBase + ".xls",
// // //                 toXlsHtml(cfg.title, exportHeaders(), exportRows()),
// // //                 "application/vnd.ms-excel",
// // //               )
// // //             }
// // //             onExportPdf={() =>
// // //               printTable(cfg.title, exportHeaders(), exportRows())
// // //             }
// // //           />

// // //           <div className="mt-3 overflow-x-auto">
// // //             <table className="dt">
// // //               <thead>
// // //                 <tr>
// // //                   {actionPos === "left" && <th>Action</th>}
// // //                   {visible.map((c, i) => (
// // //                     <th key={c.t + i}>{c.t}</th>
// // //                   ))}
// // //                   {actionPos === "right" && <th>Action</th>}
// // //                 </tr>
// // //               </thead>
// // //               <tbody>
// // //                 {loading && (
// // //                   <tr>
// // //                     <td colSpan={visible.length + 1} className="dt-empty">
// // //                       <span className="spin" />
// // //                     </td>
// // //                   </tr>
// // //                 )}
// // //                 {!loading && !searched && (
// // //                   <tr>
// // //                     <td colSpan={visible.length + 1} className="dt-empty">
// // //                       Use the filter above to search.
// // //                     </td>
// // //                   </tr>
// // //                 )}
// // //                 {!loading && searched && state.rows.length === 0 && (
// // //                   <tr>
// // //                     <td colSpan={visible.length + 1} className="dt-empty">
// // //                       No Data..
// // //                     </td>
// // //                   </tr>
// // //                 )}
// // //                 {!loading &&
// // //                   state.rows.map((row) => {
// // //                     const actions = (
// // //                       <td>
// // //                         {actionVariant === "dropdown" ? (
// // //                           <ActionMenu
// // //                             items={(
// // //                               cfg.actionMenu || [
// // //                                 {
// // //                                   label: "Edit",
// // //                                   icon: "pencil",
// // //                                   to: (r) => base + "/" + r._id,
// // //                                 },
// // //                               ]
// // //                             ).map((m) => ({ ...m, href: m.to(row) }))}
// // //                             open={menuFor === row._id}
// // //                             onToggle={() =>
// // //                               setMenuFor((m) =>
// // //                                 m === row._id ? null : row._id,
// // //                               )
// // //                             }
// // //                             onGo={(href) => {
// // //                               setMenuFor(null);
// // //                               router.push(href);
// // //                             }}
// // //                           />
// // //                         ) : (
// // //                           <span className="inline-flex items-center gap-1.5">
// // //                             {(
// // //                               cfg.actionIcons || ["view", "edit", "delete"]
// // //                             ).map((a) => {
// // //                               if (a === "view")
// // //                                 return (
// // //                                   <button
// // //                                     key={a}
// // //                                     className="act-btn bg-[#2b7fd4]"
// // //                                     title="View"
// // //                                     onClick={() =>
// // //                                       router.push(base + "/" + row._id)
// // //                                     }
// // //                                   >
// // //                                     <Icon name="eye" size={12} />
// // //                                   </button>
// // //                                 );
// // //                               if (a === "edit")
// // //                                 return (
// // //                                   <button
// // //                                     key={a}
// // //                                     className="act-btn bg-warnyellow"
// // //                                     title="Edit"
// // //                                     onClick={() =>
// // //                                       router.push(base + "/" + row._id)
// // //                                     }
// // //                                   >
// // //                                     <Icon name="pencil" size={12} />
// // //                                   </button>
// // //                                 );
// // //                               if (a === "print")
// // //                                 return (
// // //                                   <button
// // //                                     key={a}
// // //                                     className="act-btn bg-[#2b7fd4]"
// // //                                     title="Print"
// // //                                     onClick={() => window.print()}
// // //                                   >
// // //                                     <Icon name="file" size={12} />
// // //                                   </button>
// // //                                 );
// // //                               return (
// // //                                 <button
// // //                                   key={a}
// // //                                   className="act-btn bg-danger"
// // //                                   title="Delete"
// // //                                   onClick={() => remove(row._id)}
// // //                                 >
// // //                                   <Icon name="trash" size={12} />
// // //                                 </button>
// // //                               );
// // //                             })}
// // //                             {cfg.actionExtraButton && (
// // //                               <button
// // //                                 className="btn h-6 px-2 text-[11px]"
// // //                                 onClick={() => window.print()}
// // //                               >
// // //                                 <Icon name="file" size={11} />{" "}
// // //                                 {cfg.actionExtraButton}
// // //                               </button>
// // //                             )}
// // //                           </span>
// // //                         )}
// // //                       </td>
// // //                     );
// // //                     return (
// // //                       <tr key={row._id}>
// // //                         {actionPos === "left" && actions}
// // //                         {visible.map((c, i) => (
// // //                           <td key={c.t + i}>{cellValue(row, c)}</td>
// // //                         ))}
// // //                         {actionPos === "right" && actions}
// // //                       </tr>
// // //                     );
// // //                   })}
// // //               </tbody>
// // //             </table>
// // //           </div>

// // //           <div className="flex items-center pt-3 text-[13px] text-cell">
// // //             <span>
// // //               Page <b className="text-brand-link">{state.page}</b> of{" "}
// // //               {state.pages}
// // //             </span>
// // //             <span className="flex-1" />
// // //             <span className="flex gap-2">
// // //               <button
// // //                 className="btn"
// // //                 disabled={state.page <= 1}
// // //                 onClick={() => setPage((p) => p - 1)}
// // //               >
// // //                 Previous
// // //               </button>
// // //               <button
// // //                 className="btn"
// // //                 disabled={state.page >= state.pages}
// // //                 onClick={() => setPage((p) => p + 1)}
// // //               >
// // //                 Next
// // //               </button>
// // //             </span>
// // //           </div>
// // //         </div>
// // //       </div>
// // //     </>
// // //   );
// // // }










// // "use client";
// // import { useCallback, useEffect, useState } from "react";
// // import { useRouter } from "next/navigation";
// // import Icon from "./Icon";
// // import Toolbar from "./Toolbar";
// // import ModalForm from "./ModalForm";
// // import FilterPanel from "./FilterPanel";
// // import { useScope } from "./ScopeContext";
// // import { fmt, toCsv, toXlsHtml, download, printTable } from "@/lib/format";

// // /* ==========================================================================
// //    Generic list card.

// //    The page passes its own cfg - columns, endpoint, base path. There is no
// //    registry lookup here any more; `cfg.endpoint` points at that resource's
// //    own REST route (/api/business, /api/ledger, ...).

// //    ========================================================================== */

// // /* Action ▾ button with its dropdown. The GRC list needs Edit / Barcode Print /
// //    GRC Print here; other lists fall back to a single Edit entry. */
// // function ActionMenu({ items, open, onToggle, onGo }) {
// //   return (
// //     <span
// //       className="relative inline-block"
// //       onClick={(e) => e.stopPropagation()}
// //     >
// //       <button
// //         type="button"
// //         className="h-[26px] cursor-pointer rounded border-0 bg-brand px-2.5 text-xs text-white"
// //         onClick={onToggle}
// //       >
// //         Action &#9662;
// //       </button>

// //       {open && (
// //         <span className="absolute left-0 top-[28px] z-30 block min-w-[190px] rounded-md border border-line bg-white py-1 shadow-pop">
// //           {items.map((m, i) => (
// //             <button
// //               key={m.label}
// //               type="button"
// //               onClick={() => onGo(m.href)}
// //               className={
// //                 "flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13.5px] text-ink hover:bg-[#f5f8fd] " +
// //                 (i > 0 ? "border-t border-line" : "")
// //               }
// //             >
// //               <Icon name={m.icon} size={14} />
// //               {m.label}
// //             </button>
// //           ))}
// //         </span>
// //       )}
// //     </span>
// //   );
// // }

// // export default function ListView({ cfg, slug }) {
// //   const router = useRouter();
// //   const { business, location, finYear } = useScope();
// //   const [state, setState] = useState({
// //     rows: [],
// //     labels: {},
// //     page: 1,
// //     pages: 1,
// //     total: 0,
// //   });
// //   const [search, setSearch] = useState("");
// //   const [hidden, setHidden] = useState([]);
// //   const [loading, setLoading] = useState(true);
// //   const [page, setPage] = useState(1);
// //   const [modal, setModal] = useState(false);
// //   const [filters, setFilters] = useState({});
// //   const [menuFor, setMenuFor] = useState(null);

// //   /* close the open Action menu on any outside click */
// //   useEffect(() => {
// //     if (!menuFor) return;
// //     const close = () => setMenuFor(null);
// //     document.addEventListener("click", close);
// //     return () => document.removeEventListener("click", close);
// //   }, [menuFor]);

// //   const columns = cfg.columns || [];
// //   const actionPos = cfg.actionPosition || "right";
// //   const actionVariant = cfg.actionVariant || "icons";

// //   const slugPath = cfg.slugPath || slug;
// //   const base = (cfg.basePath || "/admin/setting/") + slugPath;

// //   const searched = !cfg.searchOnly || Object.keys(filters).length > 0;

// //   const load = useCallback(async () => {
// //     if (cfg.searchOnly && Object.keys(filters).length === 0) {
// //       setLoading(false);
// //       return;
// //     }
// //     setLoading(true);

// //     const qs = new URLSearchParams({
// //       page: String(page),
// //       search,
// //       business: business || "",
// //       location: location || "",
// //       finYear: finYear || "",
// //     });
// //     Object.entries(filters).forEach(([k, v]) => {
// //       if (v) qs.set(k, v);
// //     });

// //     const url = cfg.endpoint + "?" + qs;

// //     try {
// //       const r = await fetch(url);
// //       const d = await r.json();
// //       setState({
// //         rows: d.rows || [],
// //         labels: d.labels || {},
// //         page: d.page || 1,
// //         pages: d.pages || 1,
// //         total: d.total || 0,
// //       });
// //     } finally {
// //       setLoading(false);
// //     }
// //   }, [
// //     cfg.endpoint,
// //     slugPath,
// //     page,
// //     search,
// //     business,
// //     location,
// //     finYear,
// //     filters,
// //     cfg.searchOnly,
// //   ]);

// //   useEffect(() => {
// //     load();
// //   }, [load]);
// //   useEffect(() => {
// //     setPage(1);
// //   }, [slugPath, search, business, location, finYear]);

// //   const visible = columns.filter((c) => !hidden.includes(c.t));

// //   const cellValue = (row, col) => {
// //     /* col.value lets a column derive its text from the whole row rather than
// //        one key - e.g. showing a boolean status as Active / Inactive */
// //     const raw = col.value ? col.value(row) : row[col.k];
// //     let content;

// //     if (col.f === "pill") {
// //       const v = String(raw || "");
// //       content = v ? (
// //         <span
// //           className={
// //             "pill " + (v === "Fully Adjusted" ? "pill-green" : "pill-grey")
// //           }
// //         >
// //           {v}
// //         </span>
// //       ) : (
// //         ""
// //       );
// //     } else if (col.f === "badges") {
// //       /* an array rendered as pills - Freight Mode on the Transporter list.
// //          col.tone(value) picks the colour; default grey. */
// //       const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
// //       content = list.length ? (
// //         <span className="inline-flex flex-wrap gap-1">
// //           {list.map((v) => (
// //             <span key={v} className={"pill pill-" + (col.tone ? col.tone(v) : "blue")}>
// //               {v}
// //             </span>
// //           ))}
// //         </span>
// //       ) : (
// //         ""
// //       );
// //     } else if (col.f === "dash") {
// //       content = raw ? String(raw) : "\u2014";
// //     } else {
// //       content = fmt(col.f, raw, state.labels);
// //     }

// //     /* Optional inline label after the value - `badge` is a function on the
// //        column that receives the whole row, so it can key off any field, not
// //        just this column's. Business Masters uses it to mark the main branch.
// //        Returns null for rows that shouldn't carry one. */
// //     const badge = col.badge ? col.badge(row) : null;
// //     if (!badge) return content;

// //     return (
// //       <span className="inline-flex flex-wrap items-center gap-2">
// //         {content}
// //         <span
// //           className={
// //             "pill " + (badge.tone === "green" ? "pill-green" : "pill-grey")
// //           }
// //         >
// //           {badge.label}
// //         </span>
// //       </span>
// //     );
// //   };

// //   const exportRows = () =>
// //     state.rows.map((r) =>
// //       visible.map((c) => {
// //         const v = c.value ? c.value(r) : r[c.k];
// //         if (c.f === "pill") return String(v || "");
// //         if (c.f === "dash") return v ? String(v) : "";
// //         if (c.f === "badges") return Array.isArray(v) ? v.join(", ") : String(v ?? "");
// //         return fmt(c.f, v, state.labels);
// //       }),
// //     );
// //   const exportHeaders = () => visible.map((c) => c.t);
// //   const fileBase = String(slugPath).replace(/\//g, "-");

// //   async function remove(id) {
// //     if (!window.confirm("Delete this record?")) return;
// //     const r = await fetch(cfg.endpoint + "/" + id, { method: "DELETE" });
// //     /* A refused delete used to look identical to a successful one - the row
// //        simply stayed. Business Masters now returns 409 for the main branch. */
// //     if (!r.ok) {
// //       const d = await r.json().catch(() => ({}));
// //       window.alert(d.error || "Could not delete this record.");
// //       return;
// //     }
// //     load();
// //   }

// //   return (
// //     <>
// //       {cfg.aboveCardButton && (
// //         <button type="button" className="btn btn-primary mb-3">
// //           <Icon name="grid" size={14} /> {cfg.aboveCardButton}
// //         </button>
// //       )}

// //       {cfg.filters && (
// //         <FilterPanel
// //           filters={cfg.filters}
// //           onSearch={(f) => {
// //             setPage(1);
// //             setFilters(f);
// //           }}
// //         />
// //       )}

// //       {modal && (
// //         <ModalForm
// //           cfg={cfg}
// //           slug={slugPath}
// //           onClose={() => setModal(false)}
// //           onSaved={() => {
// //             setModal(false);
// //             load();
// //           }}
// //         />
// //       )}

// //       <div className="card">
// //         <div className="card-head">
// //           <span className="card-title">{cfg.title}</span>
// //           <span className="flex-1" />
// //           {cfg.extraAction && (
// //             <button
// //               type="button"
// //               className="btn btn-primary"
// //               onClick={() => router.push(cfg.extraAction.href)}
// //             >
// //               <Icon name={cfg.extraAction.icon || "grid"} size={14} />{" "}
// //               {cfg.extraAction.label}
// //             </button>
// //           )}
// //           {cfg.showRefresh !== false && (
// //             <button type="button" className="btn btn-ghost" onClick={load}>
// //               <Icon name="refresh" size={14} /> Refresh
// //             </button>
// //           )}
// //         </div>

// //         <div className="card-body">
// //           <Toolbar
// //             columns={columns}
// //             hidden={hidden}
// //             onToggleColumn={(t) =>
// //               setHidden((h) =>
// //                 h.includes(t) ? h.filter((x) => x !== t) : [...h, t],
// //               )
// //             }
// //             search={search}
// //             onSearch={setSearch}
// //             onAdd={() => {
// //               if (cfg.formMode === "modal") return setModal(true);
// //               if (cfg.addHref) return router.push(cfg.addHref);
// //               return router.push(base + "/add");
// //             }}
// //             showAdd={cfg.showAdd !== false}
// //             showCsv={cfg.showCsv !== false}
// //             onExportCsv={() =>
// //               download(
// //                 fileBase + ".csv",
// //                 toCsv(exportHeaders(), exportRows()),
// //                 "text/csv",
// //               )
// //             }
// //             onExportExcel={() =>
// //               download(
// //                 fileBase + ".xls",
// //                 toXlsHtml(cfg.title, exportHeaders(), exportRows()),
// //                 "application/vnd.ms-excel",
// //               )
// //             }
// //             onExportPdf={() =>
// //               printTable(cfg.title, exportHeaders(), exportRows())
// //             }
// //           />

// //           <div className="mt-3 overflow-x-auto">
// //             <table className="dt">
// //               <thead>
// //                 <tr>
// //                   {actionPos === "left" && <th>Action</th>}
// //                   {visible.map((c, i) => (
// //                     <th key={c.t + i}>{c.t}</th>
// //                   ))}
// //                   {actionPos === "right" && <th>Action</th>}
// //                 </tr>
// //               </thead>
// //               <tbody>
// //                 {loading && (
// //                   <tr>
// //                     <td colSpan={visible.length + 1} className="dt-empty">
// //                       <span className="spin" />
// //                     </td>
// //                   </tr>
// //                 )}
// //                 {!loading && !searched && (
// //                   <tr>
// //                     <td colSpan={visible.length + 1} className="dt-empty">
// //                       Use the filter above to search.
// //                     </td>
// //                   </tr>
// //                 )}
// //                 {!loading && searched && state.rows.length === 0 && (
// //                   <tr>
// //                     <td colSpan={visible.length + 1} className="dt-empty">
// //                       No Data..
// //                     </td>
// //                   </tr>
// //                 )}
// //                 {!loading &&
// //                   state.rows.map((row) => {
// //                     const actions = (
// //                       <td>
// //                         {actionVariant === "dropdown" ? (
// //                           <ActionMenu
// //                             items={(
// //                               cfg.actionMenu || [
// //                                 {
// //                                   label: "Edit",
// //                                   icon: "pencil",
// //                                   to: (r) => base + "/" + r._id,
// //                                 },
// //                               ]
// //                             ).map((m) => ({ ...m, href: m.to(row) }))}
// //                             open={menuFor === row._id}
// //                             onToggle={() =>
// //                               setMenuFor((m) =>
// //                                 m === row._id ? null : row._id,
// //                               )
// //                             }
// //                             onGo={(href) => {
// //                               setMenuFor(null);
// //                               router.push(href);
// //                             }}
// //                           />
// //                         ) : (
// //                           <span className="inline-flex items-center gap-1.5">
// //                             {(
// //                               /* actionIcons may be a plain array, or a
// //                                  function of the row when a particular record
// //                                  shouldn't be offered every action - Business
// //                                  Masters drops "delete" on the main branch, so
// //                                  the button isn't shown for something the API
// //                                  would refuse anyway. */
// //                               typeof cfg.actionIcons === "function"
// //                                 ? cfg.actionIcons(row) || []
// //                                 : cfg.actionIcons || ["view", "edit", "delete"]
// //                             ).map((a) => {
// //                               if (a === "view")
// //                                 return (
// //                                   <button
// //                                     key={a}
// //                                     className="act-btn bg-[#2b7fd4]"
// //                                     title="View"
// //                                     onClick={() =>
// //                                       router.push(base + "/" + row._id)
// //                                     }
// //                                   >
// //                                     <Icon name="eye" size={12} />
// //                                   </button>
// //                                 );
// //                               if (a === "edit")
// //                                 return (
// //                                   <button
// //                                     key={a}
// //                                     className="act-btn bg-warnyellow"
// //                                     title="Edit"
// //                                     onClick={() =>
// //                                       router.push(base + "/" + row._id)
// //                                     }
// //                                   >
// //                                     <Icon name="pencil" size={12} />
// //                                   </button>
// //                                 );
// //                               if (a === "print")
// //                                 return (
// //                                   <button
// //                                     key={a}
// //                                     className="act-btn bg-[#2b7fd4]"
// //                                     title="Print"
// //                                     onClick={() => window.print()}
// //                                   >
// //                                     <Icon name="file" size={12} />
// //                                   </button>
// //                                 );
// //                               return (
// //                                 <button
// //                                   key={a}
// //                                   className="act-btn bg-danger"
// //                                   title="Delete"
// //                                   onClick={() => remove(row._id)}
// //                                 >
// //                                   <Icon name="trash" size={12} />
// //                                 </button>
// //                               );
// //                             })}
// //                             {cfg.actionExtraButton && (
// //                               <button
// //                                 className="btn h-6 px-2 text-[11px]"
// //                                 onClick={() => window.print()}
// //                               >
// //                                 <Icon name="file" size={11} />{" "}
// //                                 {cfg.actionExtraButton}
// //                               </button>
// //                             )}
// //                           </span>
// //                         )}
// //                       </td>
// //                     );
// //                     return (
// //                       <tr key={row._id}>
// //                         {actionPos === "left" && actions}
// //                         {visible.map((c, i) => (
// //                           <td key={c.t + i}>{cellValue(row, c)}</td>
// //                         ))}
// //                         {actionPos === "right" && actions}
// //                       </tr>
// //                     );
// //                   })}
// //               </tbody>
// //             </table>
// //           </div>

// //           <div className="flex items-center pt-3 text-[13px] text-cell">
// //             <span>
// //               Page <b className="text-brand-link">{state.page}</b> of{" "}
// //               {state.pages}
// //             </span>
// //             <span className="flex-1" />
// //             <span className="flex gap-2">
// //               <button
// //                 className="btn"
// //                 disabled={state.page <= 1}
// //                 onClick={() => setPage((p) => p - 1)}
// //               >
// //                 Previous
// //               </button>
// //               <button
// //                 className="btn"
// //                 disabled={state.page >= state.pages}
// //                 onClick={() => setPage((p) => p + 1)}
// //               >
// //                 Next
// //               </button>
// //             </span>
// //           </div>
// //         </div>
// //       </div>
// //     </>
// //   );
// // }




















 
// "use client";
// import { useCallback, useEffect, useRef, useState } from "react";
// import { useRouter } from "next/navigation";
// import Icon from "./Icon";
// import Toolbar from "./Toolbar";
// import ModalForm from "./ModalForm";
// import FilterPanel from "./FilterPanel";
// import { useScope } from "./ScopeContext";
// import { fmt, toCsv, toXlsHtml, download, printTable } from "@/lib/format";
 
// /* ==========================================================================
//    Generic list card.
 
//    The page passes its own cfg - columns, endpoint, base path. There is no
//    registry lookup here any more; `cfg.endpoint` points at that resource's
//    own REST route (/api/business, /api/ledger, ...).
 
//    ========================================================================== */
 
// /* Action ▾ button with its dropdown. The GRC list needs Edit / Barcode Print /
//    GRC Print here; other lists fall back to a single Edit entry.
 
//    The menu is positioned FIXED, anchored to the button, rather than absolute
//    inside the row. The table sits in a `.overflow-x-auto` wrapper, and that
//    clips absolutely-positioned children - so on any list wide enough to
//    scroll, the Action column ends up at the edge and its menu was being cut
//    off entirely. Fixed positioning escapes the clip; the rect is measured on
//    open, and the menu flips to the left of the button when it would otherwise
//    run off the right of the window. */
// function ActionMenu({ items, open, onToggle, onGo, onAction }) {
//   const btnRef = useRef(null);
//   const [pos, setPos] = useState(null);
 
//   useEffect(() => {
//     if (!open || !btnRef.current) { setPos(null); return; }
//     const r = btnRef.current.getBoundingClientRect();
//     const WIDTH = 190;
//     setPos({
//       top: r.bottom + 2,
//       left: Math.min(r.left, window.innerWidth - WIDTH - 12),
//     });
//   }, [open]);
 
//   return (
//     <span
//       className="relative inline-block"
//       onClick={(e) => e.stopPropagation()}
//     >
//       <button
//         ref={btnRef}
//         type="button"
//         className="h-[26px] cursor-pointer rounded border-0 bg-brand px-2.5 text-xs text-white"
//         onClick={onToggle}
//       >
//         Action &#9662;
//       </button>
 
//       {open && pos && (
//         <span
//           className="fixed z-50 block min-w-[190px] rounded-md border border-line bg-white py-1 shadow-pop"
//           style={{ top: pos.top, left: pos.left }}
//         >
//           {items.map((m, i) => (
//             <button
//               key={m.label}
//               type="button"
//               onClick={() => {
//                 if (m.action) {
//                   onAction(m.action, m);
//                 } else {
//                   onGo(m.href);
//                 }
//               }}
//               className={
//                 "flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13.5px] text-ink hover:bg-[#f5f8fd] " +
//                 (i > 0 ? "border-t border-line" : "")
//               }
//             >
//               <Icon name={m.icon} size={14} />
//               {m.label}
//             </button>
//           ))}
//         </span>
//       )}
//     </span>
//   );
// }
 
// export default function ListView({ cfg, slug }) {
//   const router = useRouter();
//   const { business, location, finYear, businessReady, locationReady } = useScope();
//   const [state, setState] = useState({
//     rows: [],
//     labels: {},
//     page: 1,
//     pages: 1,
//     total: 0,
//   });
//   const [search, setSearch] = useState("");
//   const [hidden, setHidden] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);
//   const [page, setPage] = useState(1);
//   const [modal, setModal] = useState(false);
//   const [filters, setFilters] = useState({});
//   const [menuFor, setMenuFor] = useState(null);
//   const [viewRow, setViewRow] = useState(null);

//   // Default items per page - matches API default
//   const PER_PAGE = 10;
 
//   /* close the open Action menu on any outside click */
//   useEffect(() => {
//     if (!menuFor) return;
//     const close = () => setMenuFor(null);
//     document.addEventListener("click", close);
//     return () => document.removeEventListener("click", close);
//   }, [menuFor]);
 
//   const columns = cfg.columns || [];
//   const actionPos = cfg.actionPosition || "right";
//   const actionVariant = cfg.actionVariant || "icons";
 
//   const slugPath = cfg.slugPath || slug;
//   const base = (cfg.basePath || "/admin/setting/") + slugPath;
 
//   const searched = !cfg.searchOnly || Object.keys(filters).length > 0;
 
//   /* ------------------------------------------------------------------
//      Scope gate.

//      Every business-scoped screen declares `scope: ["business", ...]` in its
//      cfg, and SingleFormView / MappingView have always honoured it - ListView
//      never did. The selectors are empty on the first render and only fill in
//      once /api/options answers, so the list fired immediately with
//      `business=&location=`. The API reads an empty business as "no business
//      filter" and replies with every tenant's rows; a moment later the properly
//      scoped request came back and replaced them. That is what made the Agents
//      table paint rows and then drop to "No Data.." about a second later - the
//      first response was never this business's data to begin with.

//      So: wait until the selectors have actually resolved. The request carries
//      business AND location whatever a screen declares in cfg.scope, and the
//      provider fills location in a beat after business, so both have to be
//      settled or the list simply fires twice - the second one being the flash
//      all over again on any endpoint that filters by location. finYear is
//      synchronous (it starts on FIN_YEARS[0]) and needs no gate.
//      ------------------------------------------------------------------ */
//   const needs = cfg.scope || [];
//   const scoped = needs.includes("business") || needs.includes("location");
//   const scopePending = scoped && (!businessReady || !locationReady);
//   /* Resolved, but this deployment has no business at all - querying now would
//      be the unscoped query all over again, so don't. */
//   const noBusiness = needs.includes("business") && !scopePending && !business;

//   /* Only the newest request may write state. Two are still legitimately in
//      flight at once (typing in Search, paging), and without this the slower of
//      the two can land last and overwrite the newer answer. */
//   const reqRef = useRef(0);

//   const load = useCallback(async () => {
//     /* Hold the spinner - deliberately NOT an empty table, which would read as
//        "no records" for as long as the scope takes to arrive. */
//     if (scopePending) return;
//     if (noBusiness) {
//       reqRef.current += 1;
//       setError(null);
//       setState({ rows: [], labels: {}, page: 1, pages: 1, total: 0 });
//       setLoading(false);
//       return;
//     }
//     if (cfg.searchOnly && Object.keys(filters).length === 0) {
//       setLoading(false);
//       return;
//     }
//     setLoading(true);
//     const seq = ++reqRef.current;

//     const qs = new URLSearchParams({
//       page: String(page),
//       search,
//       business: business || "",
//       location: location || "",
//       finYear: finYear || "",
//     });
//     Object.entries(filters).forEach(([k, v]) => {
//       if (v) qs.set(k, v);
//     });
 
//     /* cfg.fixedQuery pins query parameters the SCREEN owns rather than the
//        operator - the Incoming Transfers list is the same endpoint as Stock
//        Transfers with box=in. Applied after the filters so a screen's own
//        scope cannot be cleared by a filter of the same name. */
//     Object.entries(cfg.fixedQuery || {}).forEach(([k, v]) => {
//       if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
//     });
 
//     const url = cfg.endpoint + "?" + qs;
 
//     try {
//       const r = await fetch(url, { cache: "no-store" });
//       const d = await r.json().catch(() => ({}));

//       /* A newer request has already been sent - this answer is stale and must
//          not be allowed to write over it. */
//       if (seq !== reqRef.current) return;

//       /* 401 / 403 / 500 is not "no records". Emptying the table on a failed
//          request is what turns a session or server problem into a silent,
//          wrong-looking empty list, so keep what is on screen and say so. */
//       if (!r.ok) {
//         setError(d.error || `Could not load ${cfg.title || "records"} (${r.status}).`);
//         return;
//       }
//       setError(null);
//       setState({
//         rows: d.rows || [],
//         labels: d.labels || {},
//         page: d.page || 1,
//         pages: d.pages || 1,
//         total: d.total || 0,
//       });
//     } catch (e) {
//       if (seq === reqRef.current) setError("Network error - could not reach the server.");
//     } finally {
//       if (seq === reqRef.current) setLoading(false);
//     }
//   }, [
//     cfg.endpoint,
//     cfg.title,
//     slugPath,
//     page,
//     search,
//     business,
//     location,
//     finYear,
//     filters,
//     cfg.searchOnly,
//     cfg.fixedQuery,
//     scopePending,
//     noBusiness,
//   ]);
 
//   useEffect(() => {
//     load();
//   }, [load]);
//   useEffect(() => {
//     setPage(1);
//   }, [slugPath, search, business, location, finYear]);
 
//   const visible = columns.filter((c) => !hidden.includes(c.t));
 
//   const cellValue = (row, col) => {
//     /* col.value lets a column derive its text from the whole row rather than
//        one key - e.g. showing a boolean status as Active / Inactive */
//     const raw = col.value ? col.value(row) : row[col.k];
//     let content;
 
//     if (col.f === "pill") {
//       const v = String(raw || "");
//       content = v ? (
//         <span
//           className={
//             "pill " + (v === "Fully Adjusted" ? "pill-green" : "pill-grey")
//           }
//         >
//           {v}
//         </span>
//       ) : (
//         ""
//       );
//     } else if (col.f === "badges") {
//       /* an array rendered as pills - Freight Mode on the Transporter list.
//          col.tone(value) picks the colour; default grey. */
//       const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
//       content = list.length ? (
//         <span className="inline-flex flex-wrap gap-1">
//           {list.map((v) => (
//             <span key={v} className={"pill pill-" + (col.tone ? col.tone(v) : "blue")}>
//               {v}
//             </span>
//           ))}
//         </span>
//       ) : (
//         ""
//       );

      
//     } else if (col.f === "dash") {
//       } else if (col.f === "image") {
//       content = raw ? (
//         <img
//           src={raw}
//           alt=""
//           className="h-10 w-10 rounded object-cover border border-line"
//           onError={(e) => { e.currentTarget.style.display = "none"; }}
//         />
//       ) : (
//         <span className="text-cell">—</span>
//       );
//     } else {
      
//       content = fmt(col.f, raw, state.labels);
//     }
  
    

    
 
//     /* Optional inline label after the value - `badge` is a function on the
//        column that receives the whole row, so it can key off any field, not
//        just this column's. Business Masters uses it to mark the main branch.
//        Returns null for rows that shouldn't carry one. */
//     const badge = col.badge ? col.badge(row) : null;
//     if (!badge) return content;
 
//     return (
//       <span className="inline-flex flex-wrap items-center gap-2">
//         {content}
//         {badge.tone === "verified" ? (
//           <svg
//             width="18"
//             height="18"
//             viewBox="0 0 100 100"
//             title="Verified"
//             style={{ display: "inline-block", flexShrink: 0, verticalAlign: "middle" }}
//           >
//             <path
//               fill="#42A5F5"
//               d="M50 2 L62 12 L78 5 L84 21 L99 25 L92 40 L99 55 L84 63 L85 80 L68 79 L60 95 L50 87 L35 95 L28 80 L12 81 L13 64 L2 55 L9 40 L2 25 L18 20 L23 5 L39 12 Z"
//             />
//             <path
//               d="M27 50 L42 65 L73 32"
//               fill="none"
//               stroke="#FFFFFF"
//               strokeWidth="11"
//               strokeLinecap="square"
//               strokeLinejoin="miter"
//             />
//           </svg>
//         ) : (
//           <span
//             className={
//               "pill " + (badge.tone === "green" ? "pill-green" : "pill-grey")
//             }
//           >
//             {badge.label}
//           </span>
//         )}
//       </span>
//     );
//   };
 
//   const exportRows = () =>
//     state.rows.map((r) =>
//       visible.map((c) => {
//         const v = c.value ? c.value(r) : r[c.k];
//         if (c.f === "pill") return String(v || "");
//         if (c.f === "dash") return v ? String(v) : "";
//         if (c.f === "image") return v ? String(v) : "";
//         if (c.f === "badges") return Array.isArray(v) ? v.join(", ") : String(v ?? "");
//         return fmt(c.f, v, state.labels);
//       }),
//     );
//   const exportHeaders = () => visible.map((c) => c.t);
//   const fileBase = String(slugPath).replace(/\//g, "-");
 
//   async function remove(id) {
//     if (!window.confirm("Delete this record?")) return;
//     const r = await fetch(cfg.endpoint + "/" + id, { method: "DELETE" });
//     /* A refused delete used to look identical to a successful one - the row
//        simply stayed. Business Masters now returns 409 for the main branch. */
//     if (!r.ok) {
//       const d = await r.json().catch(() => ({}));
//       window.alert(d.error || "Could not delete this record.");
//       return;
//     }
//     load();
//   }
 
//   return (
//     <>
//       {cfg.aboveCardButton && (
//         <button type="button" className="btn btn-primary mb-3">
//           <Icon name="grid" size={14} /> {cfg.aboveCardButton}
//         </button>
//       )}
 
//       {cfg.filters && (
//         <FilterPanel
//           filters={cfg.filters}
//           onSearch={(f) => {
//             setPage(1);
//             setFilters(f);
//           }}
//         />
//       )}
 
//       {modal && (
//         <ModalForm
//           cfg={cfg}
//           slug={slugPath}
//           onClose={() => setModal(false)}
//           onSaved={() => {
//             setModal(false);
//             load();
//           }}
//         />
//       )}
 
//       <div className="card">
//         <div className="card-head">
//           <span className="card-title">{cfg.title}</span>
//           <span className="flex-1" />
//           {cfg.extraAction && (
//             <button
//               type="button"
//               className="btn btn-primary"
//               onClick={() => router.push(cfg.extraAction.href)}
//             >
//               <Icon name={cfg.extraAction.icon || "grid"} size={14} />{" "}
//               {cfg.extraAction.label}
//             </button>
//           )}
//           {cfg.showRefresh !== false && (
//             <button type="button" className="btn btn-ghost" onClick={load}>
//               <Icon name="refresh" size={14} /> Refresh
//             </button>
//           )}
//         </div>
 
//         <div className="card-body">
//           <Toolbar
//             columns={columns}
//             hidden={hidden}
//             onToggleColumn={(t) =>
//               setHidden((h) =>
//                 h.includes(t) ? h.filter((x) => x !== t) : [...h, t],
//               )
//             }
//             search={search}
//             onSearch={setSearch}
//             onAdd={() => {
//               if (cfg.formMode === "modal") return setModal(true);
//               /* Carry the top bar's scope onto the add screen.

//                  A full-screen screen like the POS till is outside this layout
//                  and has its own Business / Location pickers, which it seeds
//                  from the query string. Without this it opened on its OWN
//                  defaults, so ADD from a list showing one branch could land the
//                  operator on another - and the first scan would be billed
//                  against the wrong one.

//                  Only what the list itself declares is passed on, so a screen
//                  that is not scoped is left alone. */
//               if (cfg.addHref) {
//                 const needs = cfg.scope || [];
//                 const carry = new URLSearchParams();
//                 if (needs.includes("business") && business) carry.set("business", business);
//                 if (needs.includes("location") && location) carry.set("location", location);
//                 if (needs.includes("finYear") && finYear) carry.set("finYear", finYear);
//                 const qs = carry.toString();
//                 return router.push(cfg.addHref + (qs ? (cfg.addHref.includes("?") ? "&" : "?") + qs : ""));
//               }
//               return router.push(base + "/add");
//             }}
//             showAdd={cfg.showAdd !== false}
//             showCsv={cfg.showCsv !== false}
//             onExportCsv={() =>
//               download(
//                 fileBase + ".csv",
//                 toCsv(exportHeaders(), exportRows()),
//                 "text/csv",
//               )
//             }
//             onExportExcel={() =>
//               download(
//                 fileBase + ".xls",
//                 toXlsHtml(cfg.title, exportHeaders(), exportRows()),
//                 "application/vnd.ms-excel",
//               )
//             }
//             onExportPdf={() =>
//               printTable(cfg.title, exportHeaders(), exportRows())
//             }
//           />
 
//           <div className="mt-3 overflow-x-auto">
//             <table className="dt">
//               <thead>
//                 <tr>
//                   {actionPos === "left" && <th>Action</th>}
//                   {cfg.serialNumber && <th>#</th>}
//                   {visible.map((c, i) => (
//                     <th key={c.t + i}>{c.t}</th>
//                   ))}
//                   {actionPos === "right" && <th>Action</th>}
//                 </tr>
//               </thead>
//               <tbody>
//                 {(loading || scopePending) && (
//                   <tr>
//                     <td colSpan={visible.length + 1 + (cfg.serialNumber ? 1 : 0)} className="dt-empty">
//                       <span className="spin" />
//                     </td>
//                   </tr>
//                 )}
//                 {!loading && !scopePending && error && (
//                   <tr>
//                     <td colSpan={visible.length + 1 + (cfg.serialNumber ? 1 : 0)} className="dt-empty text-danger">
//                       {error}{" "}
//                       <button type="button" className="underline" onClick={load}>
//                         Retry
//                       </button>
//                     </td>
//                   </tr>
//                 )}
//                 {!loading && !scopePending && !error && noBusiness && (
//                   <tr>
//                     <td colSpan={visible.length + 1 + (cfg.serialNumber ? 1 : 0)} className="dt-empty">
//                       Select a business to view this list.
//                     </td>
//                   </tr>
//                 )}
//                 {!loading && !scopePending && !error && !noBusiness && !searched && (
//                   <tr>
//                     <td colSpan={visible.length + 1 + (cfg.serialNumber ? 1 : 0)} className="dt-empty">
//                       Use the filter above to search.
//                     </td>
//                   </tr>
//                 )}
//                 {!loading && !scopePending && !error && !noBusiness && searched && state.rows.length === 0 && (
//                   <tr>
//                     <td colSpan={visible.length + 1 + (cfg.serialNumber ? 1 : 0)} className="dt-empty">
//                       No Data..
//                     </td>
//                   </tr>
//                 )}
//                 {/* rows are kept on screen through an error - a failed refresh
//                     should not wipe the list the operator was looking at */}
//                 {!loading && !scopePending &&
//                   state.rows.map((row, rowIndex) => {
//                     const actions = (
//                       <td>
//                         {actionVariant === "dropdown" ? (
//                           <ActionMenu
//                             items={(
//                               cfg.actionMenu || [
//                                 {
//                                   label: "Edit",
//                                   icon: "pencil",
//                                   to: (r) => base + "/" + r._id,
//                                 },
//                               ]
//                             ).map((m) => ({ 
//                               ...m, 
//                               href: m.to ? m.to(row) : undefined,
//                               rowId: row._id 
//                             }))}
//                             open={menuFor === row._id}
//                             onToggle={() =>
//                               setMenuFor((m) =>
//                                 m === row._id ? null : row._id,
//                               )
//                             }
//                             onGo={(href) => {
//                               setMenuFor(null);
//                               router.push(href);
//                             }}
//                             onAction={(action, item) => {
//                               setMenuFor(null);
//                               if (action === 'delete') {
//                                 remove(item.rowId);
//                               }
//                             }}
//                           />
//                         ) : (
//                           <span className="inline-flex items-center gap-1.5">
//                             {(
//                               /* actionIcons may be a plain array, or a
//                                  function of the row when a particular record
//                                  shouldn't be offered every action - Business
//                                  Masters drops "delete" on the main branch, so
//                                  the button isn't shown for something the API
//                                  would refuse anyway. */
//                               typeof cfg.actionIcons === "function"
//                                 ? cfg.actionIcons(row) || []
//                                 : cfg.actionIcons || ["view", "edit", "delete"]
//                             ).map((a) => {
//                               if (a === "view")
//                                 return (
//                                   <button
//                                     key={a}
//                                     className="act-btn bg-[#2b7fd4]"
//                                     title="View"
//                                     onClick={() => cfg.viewModal ? setViewRow(row) : router.push(base + "/" + row._id)}
//                                   >
//                                     <Icon name="eye" size={12} />
//                                   </button>
//                                 );
//                               if (a === "edit")
//                                 return (
//                                   <button
//                                     key={a}
//                                     className="act-btn bg-warnyellow"
//                                     title="Edit"
//                                     onClick={() =>
//                                       router.push(base + "/" + row._id)
//                                     }
//                                   >
//                                     <Icon name="pencil" size={12} />
//                                   </button>
//                                 );
//                               if (a === "print")
//                                 return (
//                                   <button
//                                     key={a}
//                                     className="act-btn bg-[#2b7fd4]"
//                                     title="Print"
//                                     onClick={() => window.print()}
//                                   >
//                                     <Icon name="file" size={12} />
//                                   </button>
//                                 );
//                               return (
//                                 <button
//                                   key={a}
//                                   className="act-btn bg-danger"
//                                   title="Delete"
//                                   onClick={() => remove(row._id)}
//                                 >
//                                   <Icon name="trash" size={12} />
//                                 </button>
//                               );
//                             })}
//                             {cfg.actionExtraButton && (
//                               <button
//                                 className="btn h-6 px-2 text-[11px]"
//                                 onClick={() => window.print()}
//                               >
//                                 <Icon name="file" size={11} />{" "}
//                                 {cfg.actionExtraButton}
//                               </button>
//                             )}
//                           </span>
//                         )}
//                       </td>
//                     );
//                     return (
//                       <tr key={row._id}>
//                         {actionPos === "left" && actions}
//                         {cfg.serialNumber && <td>{(page - 1) * PER_PAGE + rowIndex + 1}</td>}
//                         {visible.map((c, i) => (
//                           <td key={c.t + i}>{cellValue(row, c)}</td>
//                         ))}
//                         {actionPos === "right" && actions}
//                       </tr>
//                     );
//                   })}
//               </tbody>
//             </table>
//           </div>
 
//           <div className="flex items-center pt-3 text-[13px] text-cell">
//             <span>
//               Page <b className="text-brand-link">{state.page}</b> of{" "}
//               {state.pages}
//             </span>
//             <span className="flex-1" />
//             <span className="flex gap-2">
//               <button
//                 className="btn"
//                 disabled={state.page <= 1}
//                 onClick={() => setPage((p) => p - 1)}
//               >
//                 Previous
//               </button>
//               <button
//                 className="btn"
//                 disabled={state.page >= state.pages}
//                 onClick={() => setPage((p) => p + 1)}
//               >
//                 Next
//               </button>
//             </span>
//           </div>
//         </div>
//       </div>
//       {viewRow && cfg.viewModal && (
//         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={() => setViewRow(null)}>
//           <div className="max-h-[90vh] w-full max-w-6xl overflow-auto rounded-lg bg-white shadow-xl" onMouseDown={(event) => event.stopPropagation()}>
//             <div className="flex items-center border-b border-line px-5 py-3"><span className="card-title">Preview {cfg.title}</span><span className="flex-1" /><button type="button" className="btn btn-primary mr-2" onClick={() => window.print()}>Download / Print</button><button type="button" className="btn" onClick={() => setViewRow(null)}>Close</button></div>
//             <div className="grid grid-cols-1 gap-2 border-b border-line p-5 text-sm md:grid-cols-4"><div><b>Vendor:</b> {state.labels[String(viewRow.supplierId)] || viewRow.supplierName || '-'}</div><div><b>GRT No:</b> {viewRow.grtNo || '-'}</div><div><b>GRT Date:</b> {fmt('date', viewRow.grtDate)}</div><div><b>Total Qty:</b> {viewRow.qty || 0}</div>{['oldStock', 'vendorGstNo', 'grcNumber', 'vendorDocNo', 'vendorDocDate', 'purchaseGroupId', 'occasion', 'purchaseTermId', 'agentId', 'logisticId'].map((key) => <div key={key}><b>{key}:</b> {key.endsWith('Date') ? fmt('date', viewRow[key]) : key.endsWith('Id') ? (state.labels[String(viewRow[key])] || viewRow[key] || '-') : (viewRow[key] || '-')}</div>)}</div>
//             <div className="overflow-x-auto p-5"><table className="dt min-w-[1450px]"><thead><tr><th>SL.No</th><th>Barcode</th><th>Item Code</th><th>Item Name</th><th>HSN</th><th>Pur Rate</th><th>Final NET</th><th>Retail Price</th><th>Qty</th><th>GST %</th><th>Before GST</th><th>IGST Amount</th><th>CGST Amount</th><th>SGST Amount</th><th>Net Amount</th></tr></thead><tbody>{(() => { const items = Array.isArray(viewRow.items) ? viewRow.items : []; const totals = { qty: 0, taxable: 0, igst: 0, cgst: 0, sgst: 0, net: 0 }; const rows = items.map((item, index) => { const qty = Number(item.qty) || 0; const finalNet = Number(item.finalNet || item.purRate) || 0; const taxable = finalNet * qty; const gstAmount = taxable * ((Number(item.gst) || 0) / 100); const amounts = { qty, taxable, igst: 0, cgst: gstAmount / 2, sgst: gstAmount / 2, net: taxable + gstAmount }; Object.keys(totals).forEach((key) => { totals[key] += amounts[key]; }); return <tr key={item._id || index}><td>{index + 1}</td><td>{/* the returned unit's own barcodeNo, never barcodeGenerated */}{item.barcodeNo || '-'}</td><td>{item.itemCode || '-'}</td><td>{item.supplierDescription || item.itemName || item.printDescription || '-'}</td><td>{item.hsn || '-'}</td><td>{item.purRate || '-'}</td><td>{item.finalNet || '-'}</td><td>{item.retailPrice || item.offerPrice || '-'}</td><td>{qty.toFixed(2)}</td><td>{item.gst || 0}%</td><td>{taxable.toFixed(2)}</td><td>{amounts.igst.toFixed(2)}</td><td>{amounts.cgst.toFixed(2)}</td><td>{amounts.sgst.toFixed(2)}</td><td>{amounts.net.toFixed(2)}</td></tr>; }); if (!items.length) return <tr><td colSpan={15} className="dt-empty">No items selected.</td></tr>; return <>{rows}<tr className="font-semibold"><td colSpan={8}>Total</td><td>{totals.qty.toFixed(2)}</td><td>-</td><td>{totals.taxable.toFixed(2)}</td><td>{totals.igst.toFixed(2)}</td><td>{totals.cgst.toFixed(2)}</td><td>{totals.sgst.toFixed(2)}</td><td>{totals.net.toFixed(2)}</td></tr></>; })()}</tbody></table></div>
//           </div>
//         </div>
//       )}
//     </>
//   );
// } 





 
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "./Icon";
import Toolbar from "./Toolbar";
import ModalForm from "./ModalForm";
import FilterPanel from "./FilterPanel";
import AttachmentsDialog from "./AttachmentsDialog";
import ShareDocDialog from "./ShareDocDialog";
import { useScope } from "./ScopeContext";
import { fmt, toCsv, toXlsHtml, download, printTable } from "@/lib/format";
 
/* ==========================================================================
   Generic list card.
 
   The page passes its own cfg - columns, endpoint, base path. There is no
   registry lookup here any more; `cfg.endpoint` points at that resource's
   own REST route (/api/business, /api/ledger, ...).
 
   ========================================================================== */
 
/* Action ▾ button with its dropdown. The GRC list needs Edit / Barcode Print /
   GRC Print here; other lists fall back to a single Edit entry.
 
   The menu is positioned FIXED, anchored to the button, rather than absolute
   inside the row. The table sits in a `.overflow-x-auto` wrapper, and that
   clips absolutely-positioned children - so on any list wide enough to
   scroll, the Action column ends up at the edge and its menu was being cut
   off entirely. Fixed positioning escapes the clip; the rect is measured on
   open, and the menu flips to the left of the button when it would otherwise
   run off the right of the window. */
function ActionMenu({ items, open, onToggle, onGo, onAction }) {
  const btnRef = useRef(null);
  const [pos, setPos] = useState(null);
 
  useEffect(() => {
    if (!open || !btnRef.current) { setPos(null); return; }
    const r = btnRef.current.getBoundingClientRect();
    const WIDTH = 190;
    setPos({
      top: r.bottom + 2,
      left: Math.min(r.left, window.innerWidth - WIDTH - 12),
    });
  }, [open]);
 
  return (
    <span
      className="relative inline-block"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        ref={btnRef}
        type="button"
        className="h-[26px] cursor-pointer rounded border-0 bg-brand px-2.5 text-xs text-white"
        onClick={onToggle}
      >
        Action &#9662;
      </button>
 
      {open && pos && (
        <span
          className="fixed z-50 block min-w-[190px] rounded-md border border-line bg-white py-1 shadow-pop"
          style={{ top: pos.top, left: pos.left }}
        >
          {items.map((m, i) => (
            <button
              key={m.label}
              type="button"
              onClick={() => {
                if (m.action) {
                  onAction(m.action, m);
                } else {
                  onGo(m.href);
                }
              }}
              className={
                "flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13.5px] text-ink hover:bg-[#f5f8fd] " +
                (i > 0 ? "border-t border-line" : "")
              }
            >
              <Icon name={m.icon} size={14} />
              {m.label}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
 
export default function ListView({ cfg, slug }) {
  const router = useRouter();
  const { business, location, finYear, businessReady, locationReady } = useScope();
  const [state, setState] = useState({
    rows: [],
    labels: {},
    page: 1,
    pages: 1,
    total: 0,
  });
  const [search, setSearch] = useState("");
  const [hidden, setHidden] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const [filters, setFilters] = useState({});
  const [menuFor, setMenuFor] = useState(null);
  const [viewRow, setViewRow] = useState(null);

  // Default items per page - matches API default
  const PER_PAGE = 10;
 
  /* close the open Action menu on any outside click */
  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuFor]);
 
  /* The row whose Upload button was pressed. Holding the ROW - not just an
     id - is what lets the dialog caption itself with that record's own
     number, and makes it impossible for the dialog to be open against one
     record while showing another's. */
  const [uploadRow, setUploadRow] = useState(null);
  /* The row whose Share button was pressed - the row itself, so every message
     is composed from that record and no id is carried separately. */
  const [shareRow, setShareRow] = useState(null);
  /* Set when Share asks for a Download or a Print. window.print() photographs
     the DOM as it stands at the instant it is called, so it cannot be fired
     in the same handler that asks for the preview - React has not committed
     it yet and the paper would come out blank. The effect below prints once
     the preview it is waiting for is actually on screen. The same staging the
     barcode print run uses (app/admin/transaction/purchase/barcode-print). */
  const [pendingPrint, setPendingPrint] = useState(null);

  /* PRINT THE PREVIEW THAT IS ON SCREEN.
     The browser's print-to-PDF is this application's existing download
     mechanism - the preview's own "Download / Print" button has always used
     window.print() - so Download and Print are the same call; they differ
     only in what the operator does in the browser's dialog.
     document.title is what every browser offers as the default PDF filename,
     so it becomes the record's own number for the duration of the print and
     is put back afterwards. afterprint restores it, with a timer behind that
     for the browsers that never fire the event. */
  const printAs = useCallback((name) => {
    const previous = document.title;
    if (name) document.title = name;
    let done = false;
    const restore = () => {
      if (done) return;
      done = true;
      document.title = previous;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    try { window.print(); } finally { setTimeout(restore, 1500); }
  }, []);

  /* Fires only once the previewed row is the row that was asked for, so the
     print always photographs a rendered preview rather than an empty page. */
  useEffect(() => {
    if (!pendingPrint) return undefined;
    /* the preview was closed before it could be printed - drop the request
       rather than let it fire against some later, unrelated preview */
    if (!viewRow) { setPendingPrint(null); return undefined; }
    if (String(viewRow._id) !== String(pendingPrint.id)) return undefined;
    const { name, openedPreview } = pendingPrint;
    setPendingPrint(null);
    /* Two animation frames before printing, as the barcode print run does
       (app/admin/transaction/purchase/barcode-print): window.print()
       photographs the DOM synchronously, and a commit is not a paint. */
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        printAs(name);
        /* a preview this print opened is put away again afterwards, so the
           operator is left on the list they started from */
        if (openedPreview) setViewRow(null);
      });
    });
    return () => { window.cancelAnimationFrame(raf1); if (raf2) window.cancelAnimationFrame(raf2); };
  }, [pendingPrint, viewRow, printAs]);

  /* "TFJ/26/0131" -> "GRT-TFJ-26-0131": a filename a file system accepts */
  const docFileName = useCallback((row) => {
    const base = cfg.share?.fileName?.(row) || cfg.title || "document";
    return String(base).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }, [cfg]);

  const columns = cfg.columns || [];
  const actionPos = cfg.actionPosition || "right";
  const actionVariant = cfg.actionVariant || "icons";
 
  const slugPath = cfg.slugPath || slug;
  const base = (cfg.basePath || "/admin/setting/") + slugPath;
 
  const searched = !cfg.searchOnly || Object.keys(filters).length > 0;
 
  /* ------------------------------------------------------------------
     Scope gate.

     Every business-scoped screen declares `scope: ["business", ...]` in its
     cfg, and SingleFormView / MappingView have always honoured it - ListView
     never did. The selectors are empty on the first render and only fill in
     once /api/options answers, so the list fired immediately with
     `business=&location=`. The API reads an empty business as "no business
     filter" and replies with every tenant's rows; a moment later the properly
     scoped request came back and replaced them. That is what made the Agents
     table paint rows and then drop to "No Data.." about a second later - the
     first response was never this business's data to begin with.

     So: wait until the selectors have actually resolved. The request carries
     business AND location whatever a screen declares in cfg.scope, and the
     provider fills location in a beat after business, so both have to be
     settled or the list simply fires twice - the second one being the flash
     all over again on any endpoint that filters by location. finYear is
     synchronous (it starts on FIN_YEARS[0]) and needs no gate.
     ------------------------------------------------------------------ */
  const needs = cfg.scope || [];
  const scoped = needs.includes("business") || needs.includes("location");
  const scopePending = scoped && (!businessReady || !locationReady);
  /* Resolved, but this deployment has no business at all - querying now would
     be the unscoped query all over again, so don't. */
  const noBusiness = needs.includes("business") && !scopePending && !business;

  /* Only the newest request may write state. Two are still legitimately in
     flight at once (typing in Search, paging), and without this the slower of
     the two can land last and overwrite the newer answer. */
  const reqRef = useRef(0);

  const load = useCallback(async () => {
    /* Hold the spinner - deliberately NOT an empty table, which would read as
       "no records" for as long as the scope takes to arrive. */
    if (scopePending) return;
    if (noBusiness) {
      reqRef.current += 1;
      setError(null);
      setState({ rows: [], labels: {}, page: 1, pages: 1, total: 0, summary: null });
      setLoading(false);
      return;
    }
    if (cfg.searchOnly && Object.keys(filters).length === 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const seq = ++reqRef.current;

    const qs = new URLSearchParams({
      page: String(page),
      search,
      business: business || "",
      location: location || "",
      finYear: finYear || "",
    });
    Object.entries(filters).forEach(([k, v]) => {
      if (v) qs.set(k, v);
    });
 
    /* cfg.fixedQuery pins query parameters the SCREEN owns rather than the
       operator - the Incoming Transfers list is the same endpoint as Stock
       Transfers with box=in. Applied after the filters so a screen's own
       scope cannot be cleared by a filter of the same name. */
    Object.entries(cfg.fixedQuery || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
    });
 
    const url = cfg.endpoint + "?" + qs;
 
    try {
      const r = await fetch(url, { cache: "no-store" });
      const d = await r.json().catch(() => ({}));

      /* A newer request has already been sent - this answer is stale and must
         not be allowed to write over it. */
      if (seq !== reqRef.current) return;

      /* 401 / 403 / 500 is not "no records". Emptying the table on a failed
         request is what turns a session or server problem into a silent,
         wrong-looking empty list, so keep what is on screen and say so. */
      if (!r.ok) {
        setError(d.error || `Could not load ${cfg.title || "records"} (${r.status}).`);
        return;
      }
      setError(null);
      setState({
        rows: d.rows || [],
        labels: d.labels || {},
        page: d.page || 1,
        pages: d.pages || 1,
        total: d.total || 0,
        /* figures for cfg.summaryCards, computed server-side over the whole
           filtered set - see the endpoint. Absent on endpoints that do not
           send one, which is why the cards render only when both exist. */
        summary: d.summary || null,
      });
    } catch (e) {
      if (seq === reqRef.current) setError("Network error - could not reach the server.");
    } finally {
      if (seq === reqRef.current) setLoading(false);
    }
  }, [
    cfg.endpoint,
    cfg.title,
    slugPath,
    page,
    search,
    business,
    location,
    finYear,
    filters,
    cfg.searchOnly,
    cfg.fixedQuery,
    scopePending,
    noBusiness,
  ]);
 
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    setPage(1);
  }, [slugPath, search, business, location, finYear]);
 
  const visible = columns.filter((c) => !hidden.includes(c.t));
 
  const cellValue = (row, col) => {
    /* col.value lets a column derive its text from the whole row rather than
       one key - e.g. showing a boolean status as Active / Inactive */
    const raw = col.value ? col.value(row) : row[col.k];
    let content;
 
    if (col.f === "pill") {
      const v = String(raw || "");
      content = v ? (
        <span
          className={
            "pill " + (v === "Fully Adjusted" ? "pill-green" : "pill-grey")
          }
        >
          {v}
        </span>
      ) : (
        ""
      );
    } else if (col.f === "badges") {
      /* an array rendered as pills - Freight Mode on the Transporter list.
         col.tone(value) picks the colour; default grey. */
      const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
      content = list.length ? (
        <span className="inline-flex flex-wrap gap-1">
          {list.map((v) => (
            <span key={v} className={"pill pill-" + (col.tone ? col.tone(v) : "blue")}>
              {v}
            </span>
          ))}
        </span>
      ) : (
        ""
      );

      
    } else if (col.f === "dash") {
      } else if (col.f === "image") {
      content = raw ? (
        <img
          src={raw}
          alt=""
          className="h-10 w-10 rounded object-cover border border-line"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
      ) : (
        <span className="text-cell">—</span>
      );
    } else {
      
      content = fmt(col.f, raw, state.labels);
    }
  
    

    
 
    /* Optional inline label after the value - `badge` is a function on the
       column that receives the whole row, so it can key off any field, not
       just this column's. Business Masters uses it to mark the main branch.
       Returns null for rows that shouldn't carry one. */
    const badge = col.badge ? col.badge(row) : null;
    if (!badge) return content;
 
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        {content}
        {badge.tone === "verified" ? (
          <svg
            width="18"
            height="18"
            viewBox="0 0 100 100"
            title="Verified"
            style={{ display: "inline-block", flexShrink: 0, verticalAlign: "middle" }}
          >
            <path
              fill="#42A5F5"
              d="M50 2 L62 12 L78 5 L84 21 L99 25 L92 40 L99 55 L84 63 L85 80 L68 79 L60 95 L50 87 L35 95 L28 80 L12 81 L13 64 L2 55 L9 40 L2 25 L18 20 L23 5 L39 12 Z"
            />
            <path
              d="M27 50 L42 65 L73 32"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="11"
              strokeLinecap="square"
              strokeLinejoin="miter"
            />
          </svg>
        ) : (
          <span
            className={
              "pill " + (badge.tone === "green" ? "pill-green" : "pill-grey")
            }
          >
            {badge.label}
          </span>
        )}
      </span>
    );
  };
 
  const exportRows = () =>
    state.rows.map((r) =>
      visible.map((c) => {
        const v = c.value ? c.value(r) : r[c.k];
        if (c.f === "pill") return String(v || "");
        if (c.f === "dash") return v ? String(v) : "";
        if (c.f === "image") return v ? String(v) : "";
        if (c.f === "badges") return Array.isArray(v) ? v.join(", ") : String(v ?? "");
        return fmt(c.f, v, state.labels);
      }),
    );
  const exportHeaders = () => visible.map((c) => c.t);
  const fileBase = String(slugPath).replace(/\//g, "-");
 
  async function remove(id) {
    if (!window.confirm("Delete this record?")) return;
    const r = await fetch(cfg.endpoint + "/" + id, { method: "DELETE" });
    /* A refused delete used to look identical to a successful one - the row
       simply stayed. Business Masters now returns 409 for the main branch. */
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      window.alert(d.error || "Could not delete this record.");
      return;
    }
    load();
  }
 
  return (
    <>
      {/* Summary boxes. Driven by cfg.summaryCards - [{ k, label, f }] - and
          filled from the endpoint's `summary`, so the numbers cover every
          matching row rather than the page on screen. */}
      {cfg.summaryCards && state.summary && (
        <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          {cfg.summaryCards.map((c) => (
            <div key={c.k} className="card px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-inkmuted">
                {c.label}
              </div>
              <div className="mt-1 text-[20px] font-bold text-brand">
                {c.f === "amount"
                  ? Number(state.summary[c.k] || 0).toFixed(2)
                  : (state.summary[c.k] ?? 0)}
              </div>
            </div>
          ))}
        </div>
      )}

      {cfg.aboveCardButton && (
        <button type="button" className="btn btn-primary mb-3">
          <Icon name="grid" size={14} /> {cfg.aboveCardButton}
        </button>
      )}
 
      {cfg.filters && (
        <FilterPanel
          filters={cfg.filters}
          onSearch={(f) => {
            setPage(1);
            setFilters(f);
          }}
        />
      )}
 
      {modal && (
        <ModalForm
          cfg={cfg}
          slug={slugPath}
          onClose={() => setModal(false)}
          onSaved={() => {
            setModal(false);
            load();
          }}
        />
      )}
 
      <div className="card">
        <div className="card-head">
          <span className="card-title">{cfg.title}</span>
          <span className="flex-1" />
          {cfg.extraAction && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => router.push(cfg.extraAction.href)}
            >
              <Icon name={cfg.extraAction.icon || "grid"} size={14} />{" "}
              {cfg.extraAction.label}
            </button>
          )}
          {cfg.showRefresh !== false && (
            <button type="button" className="btn btn-ghost" onClick={load}>
              <Icon name="refresh" size={14} /> Refresh
            </button>
          )}
        </div>
 
        <div className="card-body">
          <Toolbar
            columns={columns}
            hidden={hidden}
            onToggleColumn={(t) =>
              setHidden((h) =>
                h.includes(t) ? h.filter((x) => x !== t) : [...h, t],
              )
            }
            search={search}
            onSearch={setSearch}
            onAdd={() => {
              if (cfg.formMode === "modal") return setModal(true);
              /* Carry the top bar's scope onto the add screen.

                 A full-screen screen like the POS till is outside this layout
                 and has its own Business / Location pickers, which it seeds
                 from the query string. Without this it opened on its OWN
                 defaults, so ADD from a list showing one branch could land the
                 operator on another - and the first scan would be billed
                 against the wrong one.

                 Only what the list itself declares is passed on, so a screen
                 that is not scoped is left alone. */
              if (cfg.addHref) {
                const needs = cfg.scope || [];
                const carry = new URLSearchParams();
                if (needs.includes("business") && business) carry.set("business", business);
                if (needs.includes("location") && location) carry.set("location", location);
                if (needs.includes("finYear") && finYear) carry.set("finYear", finYear);
                const qs = carry.toString();
                return router.push(cfg.addHref + (qs ? (cfg.addHref.includes("?") ? "&" : "?") + qs : ""));
              }
              return router.push(base + "/add");
            }}
            showAdd={cfg.showAdd !== false}
            showCsv={cfg.showCsv !== false}
            onExportCsv={() =>
              download(
                fileBase + ".csv",
                toCsv(exportHeaders(), exportRows()),
                "text/csv",
              )
            }
            onExportExcel={() =>
              download(
                fileBase + ".xls",
                toXlsHtml(cfg.title, exportHeaders(), exportRows()),
                "application/vnd.ms-excel",
              )
            }
            onExportPdf={() =>
              printTable(cfg.title, exportHeaders(), exportRows())
            }
          />
 
          <div className="mt-3 overflow-x-auto">
            <table className="dt">
              <thead>
                <tr>
                  {actionPos === "left" && <th>Action</th>}
                  {cfg.serialNumber && <th>#</th>}
                  {visible.map((c, i) => (
                    <th key={c.t + i}>{c.t}</th>
                  ))}
                  {actionPos === "right" && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {(loading || scopePending) && (
                  <tr>
                    <td colSpan={visible.length + 1 + (cfg.serialNumber ? 1 : 0)} className="dt-empty">
                      <span className="spin" />
                    </td>
                  </tr>
                )}
                {!loading && !scopePending && error && (
                  <tr>
                    <td colSpan={visible.length + 1 + (cfg.serialNumber ? 1 : 0)} className="dt-empty text-danger">
                      {error}{" "}
                      <button type="button" className="underline" onClick={load}>
                        Retry
                      </button>
                    </td>
                  </tr>
                )}
                {!loading && !scopePending && !error && noBusiness && (
                  <tr>
                    <td colSpan={visible.length + 1 + (cfg.serialNumber ? 1 : 0)} className="dt-empty">
                      Select a business to view this list.
                    </td>
                  </tr>
                )}
                {!loading && !scopePending && !error && !noBusiness && !searched && (
                  <tr>
                    <td colSpan={visible.length + 1 + (cfg.serialNumber ? 1 : 0)} className="dt-empty">
                      Use the filter above to search.
                    </td>
                  </tr>
                )}
                {!loading && !scopePending && !error && !noBusiness && searched && state.rows.length === 0 && (
                  <tr>
                    <td colSpan={visible.length + 1 + (cfg.serialNumber ? 1 : 0)} className="dt-empty">
                      No Data..
                    </td>
                  </tr>
                )}
                {/* rows are kept on screen through an error - a failed refresh
                    should not wipe the list the operator was looking at */}
                {!loading && !scopePending &&
                  state.rows.map((row, rowIndex) => {
                    const actions = (
                      <td>
                        {actionVariant === "dropdown" ? (
                          <ActionMenu
                            items={(
                              cfg.actionMenu || [
                                {
                                  label: "Edit",
                                  icon: "pencil",
                                  to: (r) => base + "/" + r._id,
                                },
                              ]
                            ).map((m) => ({ 
                              ...m, 
                              href: m.to ? m.to(row) : undefined,
                              rowId: row._id 
                            }))}
                            open={menuFor === row._id}
                            onToggle={() =>
                              setMenuFor((m) =>
                                m === row._id ? null : row._id,
                              )
                            }
                            onGo={(href) => {
                              setMenuFor(null);
                              router.push(href);
                            }}
                            onAction={(action, item) => {
                              setMenuFor(null);
                              if (action === 'delete') {
                                remove(item.rowId);
                              }
                            }}
                          />
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            {(
                              /* actionIcons may be a plain array, or a
                                 function of the row when a particular record
                                 shouldn't be offered every action - Business
                                 Masters drops "delete" on the main branch, so
                                 the button isn't shown for something the API
                                 would refuse anyway. */
                              typeof cfg.actionIcons === "function"
                                ? cfg.actionIcons(row) || []
                                : cfg.actionIcons || ["view", "edit", "delete"]
                            ).map((a) => {
                              if (a === "view")
                                return (
                                  <button
                                    key={a}
                                    className="act-btn bg-[#2b7fd4]"
                                    title="View"
                                    onClick={() => cfg.viewModal ? setViewRow(row) : router.push(base + "/" + row._id)}
                                  >
                                    <Icon name="eye" size={12} />
                                  </button>
                                );
                              if (a === "edit")
                                return (
                                  <button
                                    key={a}
                                    className="act-btn bg-warnyellow"
                                    title="Edit"
                                    onClick={() =>
                                      router.push(base + "/" + row._id)
                                    }
                                  >
                                    <Icon name="pencil" size={12} />
                                  </button>
                                );
                              if (a === "print")
                                return (
                                  <button
                                    key={a}
                                    className="act-btn bg-[#2b7fd4]"
                                    title="Print"
                                    onClick={() => window.print()}
                                  >
                                    <Icon name="file" size={12} />
                                  </button>
                                );
                              /* Attach a document or a photo to THIS row.
                                 cfg.attachKind names the collection the
                                 record lives in (/api/attachments); the id
                                 comes from the row under the button, so a
                                 file cannot land on the wrong record. */
                              if (a === "share")
                                /* gated on cfg.share for the same reason the
                                   upload button is gated on cfg.attachKind:
                                   a list that has not said what to share
                                   would otherwise show a dead button */
                                return cfg.share ? (
                                  <button
                                    key={a}
                                    className="act-btn bg-[#6d28d9]"
                                    title="Share"
                                    onClick={() => setShareRow(row)}
                                  >
                                    <Icon name="share" size={12} />
                                  </button>
                                ) : null;
                              if (a === "upload")
                                /* gated on the SAME condition as the dialog
                                   below: a list that asks for the icon but
                                   never says which record type it is would
                                   otherwise show a button that does nothing
                                   at all when pressed */
                                return cfg.attachKind ? (
                                  <button
                                    key={a}
                                    className="act-btn bg-[#0d9488]"
                                    title="Upload document / photo"
                                    onClick={() => setUploadRow(row)}
                                  >
                                    <Icon name="upload" size={12} />
                                  </button>
                                ) : null;
                              return (
                                <button
                                  key={a}
                                  className="act-btn bg-danger"
                                  title="Delete"
                                  onClick={() => remove(row._id)}
                                >
                                  <Icon name="trash" size={12} />
                                </button>
                              );
                            })}
                            {cfg.actionExtraButton && (
                              <button
                                className="btn h-6 px-2 text-[11px]"
                                onClick={() => window.print()}
                              >
                                <Icon name="file" size={11} />{" "}
                                {cfg.actionExtraButton}
                              </button>
                            )}
                          </span>
                        )}
                      </td>
                    );
                    return (
                      <tr key={row._id}>
                        {actionPos === "left" && actions}
                        {cfg.serialNumber && <td>{(page - 1) * PER_PAGE + rowIndex + 1}</td>}
                        {visible.map((c, i) => (
                          <td key={c.t + i}>{cellValue(row, c)}</td>
                        ))}
                        {actionPos === "right" && actions}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
 
          <div className="flex items-center pt-3 text-[13px] text-cell">
            <span>
              Page <b className="text-brand-link">{state.page}</b> of{" "}
              {state.pages}
            </span>
            <span className="flex-1" />
            <span className="flex gap-2">
              <button
                className="btn"
                disabled={state.page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <button
                className="btn"
                disabled={state.page >= state.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </span>
          </div>
        </div>
      </div>
      {viewRow && cfg.viewModal && (
        <div className="preview-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={() => setViewRow(null)}>
          {/* print-doc: globals.css hides `body *` at print time and shows
              only .print-doc, so without it this modal's own Download / Print
              button sent a blank page to the printer. no-print keeps the two
              buttons themselves off the paper. */}
          <div className="print-doc preview-doc max-h-[90vh] w-full max-w-6xl overflow-auto rounded-lg bg-white shadow-xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="no-print flex items-center border-b border-line px-5 py-3"><span className="card-title">Preview {cfg.title}</span><span className="flex-1" /><button type="button" className="btn btn-primary mr-2" onClick={() => printAs(docFileName(viewRow))}>Download / Print</button><button type="button" className="btn" onClick={() => setViewRow(null)}>Close</button></div>
            <div className="grid grid-cols-1 gap-2 border-b border-line p-5 text-sm md:grid-cols-4"><div><b>Vendor:</b> {state.labels[String(viewRow.supplierId)] || viewRow.supplierName || '-'}</div><div><b>GRT No:</b> {viewRow.grtNo || '-'}</div><div><b>GRT Date:</b> {fmt('date', viewRow.grtDate)}</div><div><b>Total Qty:</b> {viewRow.qty || 0}</div>{['oldStock', 'vendorGstNo', 'grcNumber', 'vendorDocNo', 'vendorDocDate', 'purchaseGroupId', 'occasion', 'purchaseTermId', 'agentId', 'logisticId'].map((key) => <div key={key}><b>{key}:</b> {key.endsWith('Date') ? fmt('date', viewRow[key]) : key.endsWith('Id') ? (state.labels[String(viewRow[key])] || viewRow[key] || '-') : (viewRow[key] || '-')}</div>)}</div>
            <div className="overflow-x-auto p-5"><table className="dt min-w-[1450px]"><thead><tr><th>SL.No</th><th>Barcode</th><th>Item Code</th><th>Item Name</th><th>HSN</th><th>Pur Rate</th><th>Final NET</th><th>Retail Price</th><th>Qty</th><th>GST %</th><th>Before GST</th><th>IGST Amount</th><th>CGST Amount</th><th>SGST Amount</th><th>Net Amount</th></tr></thead><tbody>{(() => { const items = Array.isArray(viewRow.items) ? viewRow.items : []; const totals = { qty: 0, taxable: 0, igst: 0, cgst: 0, sgst: 0, net: 0 }; const rows = items.map((item, index) => { const qty = Number(item.qty) || 0; const finalNet = Number(item.finalNet || item.purRate) || 0; const taxable = finalNet * qty; const gstAmount = taxable * ((Number(item.gst) || 0) / 100); const amounts = { qty, taxable, igst: 0, cgst: gstAmount / 2, sgst: gstAmount / 2, net: taxable + gstAmount }; Object.keys(totals).forEach((key) => { totals[key] += amounts[key]; }); return <tr key={item._id || index}><td>{index + 1}</td><td>{/* the returned unit's OWN number (barcodeNo, "9A1165"), never the composed barcodeGenerated ("G513 * 05184 * 1 * 2") - two different things, and this column is the physical sticker's number */}{item.barcodeNo || '-'}</td><td>{item.itemCode || '-'}</td><td>{item.supplierDescription || item.itemName || item.printDescription || '-'}</td><td>{item.hsn || '-'}</td><td>{item.purRate || '-'}</td><td>{item.finalNet || '-'}</td><td>{item.retailPrice || item.offerPrice || '-'}</td><td>{qty.toFixed(2)}</td><td>{item.gst || 0}%</td><td>{taxable.toFixed(2)}</td><td>{amounts.igst.toFixed(2)}</td><td>{amounts.cgst.toFixed(2)}</td><td>{amounts.sgst.toFixed(2)}</td><td>{amounts.net.toFixed(2)}</td></tr>; }); if (!items.length) return <tr><td colSpan={15} className="dt-empty">No items selected.</td></tr>; return <>{rows}<tr className="font-semibold"><td colSpan={8}>Total</td><td>{totals.qty.toFixed(2)}</td><td>-</td><td>{totals.taxable.toFixed(2)}</td><td>{totals.igst.toFixed(2)}</td><td>{totals.cgst.toFixed(2)}</td><td>{totals.sgst.toFixed(2)}</td><td>{totals.net.toFixed(2)}</td></tr></>; })()}</tbody></table></div>
          </div>
        </div>
      )}

      {/* Upload Document / Photo for ONE record. cfg.attachKind names the
          collection (/api/attachments); the id is this row's own _id, so a
          file can only ever be attached to the record its button sits on.
          Rendered only while a row is selected, so no stale row survives. */}
      {/* Share ONE record. Download and Print open that record's own preview
          and print it, which is the existing implementation rather than a
          second one; the message text is built by the page from the row. */}
      {shareRow && cfg.share && (
        <ShareDocDialog
          open
          heading={cfg.share.heading || ("Share " + (cfg.title || "document"))}
          recordLabel={cfg.share.recordLabel?.(shareRow, state.labels) || ""}
          subject={cfg.share.subject?.(shareRow, state.labels) || ""}
          lines={cfg.share.lines?.(shareRow, state.labels) || []}
          /* Both open THIS row's own preview and print it - the existing
             implementation, not a second one. Download and Print differ only
             in what the operator chooses in the browser's own dialog. */
          onDownload={() => { setPendingPrint({ id: String(shareRow._id), name: docFileName(shareRow), openedPreview: !viewRow }); setViewRow(shareRow); }}
          onPrint={() => { setPendingPrint({ id: String(shareRow._id), name: docFileName(shareRow), openedPreview: !viewRow }); setViewRow(shareRow); }}
          onClose={() => setShareRow(null)}
        />
      )}

      {uploadRow && cfg.attachKind && (
        <AttachmentsDialog
          open
          kind={cfg.attachKind}
          id={String(uploadRow._id)}
          title={cfg.attachTitle ? cfg.attachTitle(uploadRow) : (uploadRow[columns[0]?.k] || "")}
          onClose={() => setUploadRow(null)}
          onUploaded={() => load()}
        />
      )}
    </>
  );
}