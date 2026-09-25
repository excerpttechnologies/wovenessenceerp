// 'use client';
// import { useEffect, useRef, useState } from 'react';
// import { useRouter } from 'next/navigation';
// import Icon from './Icon';
// import Field from './Field';
// import ModalForm from './ModalForm';
// import { refreshOptions } from './useOptions';
// import { useScope } from './ScopeContext';
// import {
//   normalizeGstin, isValidGstin,
//   GSTIN_FORMAT_MESSAGE, GSTIN_DUPLICATE_MESSAGE, GSTIN_DUPLICATE_ON_SAVE_MESSAGE,
// } from '@/lib/gstin';

// /* What the GST duplicate check has to say about the GST NO in the box.

//    Keyed on the normalised value: a result for anything else - a number edited
//    since, a response that arrived late - is not shown at all. The format error
//    is not here; it is an ordinary field error, and Field shows it. */
// function GstCheckNote({ check, value, supplierHref }) {
//   if (!check || !value || check.value !== value) return null;

//   if (check.status === 'checking') {
//     return <div className="mt-1 text-xs text-inkmuted">Checking GST number...</div>;
//   }
//   if (check.status === 'available') {
//     return (
//       <div className="mt-1 flex items-center gap-1 text-xs text-okgreen">
//         <Icon name="check" size={13} /> GST number is available.
//       </div>
//     );
//   }
//   if (check.status === 'error') {
//     return (
//       <div className="mt-1 text-xs text-inkmuted">
//         Could not check the GST number just now - it will be checked again on Submit.
//       </div>
//     );
//   }
//   if (check.status !== 'duplicate') return null;

//   const s = check.supplier;
//   return (
//     <div role="alert" className="mt-1 rounded-md border border-danger/30 bg-[#fdecea] px-2.5 py-2 text-xs leading-snug text-danger">
//       <div className="font-bold uppercase tracking-wide">&#9888; GST number already exists</div>
//       <div className="mt-0.5">This GST number is already registered to another supplier.</div>
//       {s?.name && (
//         <div className="mt-1 text-ink">
//           Existing Supplier: <span className="font-semibold">{s.name}</span>
//           {s.contactId ? ' (' + s.contactId + ')' : ''}
//         </div>
//       )}
//       {s?.id && (
//         /* a new tab, so a half-filled form - or the consignment behind the
//            Delivery screen's supplier dialog - is not lost by looking */
//         <a
//           href={supplierHref(s.id)}
//           target="_blank"
//           rel="noopener noreferrer"
//           className="mt-1 inline-block font-semibold text-brand-link hover:underline"
//         >
//           View existing supplier
//         </a>
//       )}
//     </div>
//   );
// }

// /* Supplier / Customer / Agent add form: four tabs across the top, each with its
//    own grey-headed sections and its own Submit (the original saves per tab).

//    `onSaved` lets this be embedded in a dialog rather than owning the page:
//    when it is supplied, finishing the last tab calls it instead of navigating
//    to the list. That is how the Delivery / LR screen offers the full supplier
//    form inline without the user losing the consignment they were booking. */
// export default function TabbedFormView({ cfg, id, slug, onSaved }) {
//   const router = useRouter();
//   const scope = useScope();
//   const tabs = cfg.tabs || [];
//   const slugPath = cfg.slugPath || slug;
//   const listUrl = (cfg.basePath || '/admin/contact/') + slugPath;
//   const [active, setActive] = useState(0);
//   const [recordId, setRecordId] = useState(id || null);
//   const [errors, setErrors] = useState({});
//   const [flash, setFlash] = useState(null);
//   const [saving, setSaving] = useState(false);
//   const [quickAddField, setQuickAddField] = useState(null);
//   /* GST NO duplicate check - see runGstCheck below */
//   const [gstCheck, setGstCheck] = useState(null);
//   const [ownGst, setOwnGst] = useState('');
//   const gstTicket = useRef(0);
//   const gstInflight = useRef(null);
//   /* Set synchronously on the first click, so a double-click cannot send the
//      record twice in the moment before the disabled button has rendered. */
//   const submitting = useRef(false);

//   useEffect(() => {
//     if (tabs.length && active >= tabs.length) setActive(tabs.length - 1);
//   }, [active, tabs.length]);

//   const allFields = tabs.flatMap((t) => (t.sections || []).flatMap((s) => s.fields || []));

//   const [data, setData] = useState(() => {
//     const d = {};
//     /* a composite (`f.parts`) holds nothing of its own - see joinParts below -
//        so it is kept out of the state and therefore out of the payload */
//     allFields.forEach((f) => {
//       if (f.parts) return;
//       d[f.k] = f.def !== undefined ? f.def : (f.type === 'checkbox' ? false : '');
//     });
//     tabs.forEach((t) => (t.sections || []).forEach((s) => { if (s.toggle) d[s.toggle.k] = false; }));
//     return d;
//   });

//   useEffect(() => {
//     if (!id) return;
//     fetch(cfg.endpoint + '/' + id)
//       .then((r) => r.json())
//       .then((d) => {
//         if (!d.doc) return;
//         /* the number this record already holds - never its own duplicate */
//         setOwnGst(normalizeGstin(d.doc.gstNo));
//         setData((prev) => {
//           const next = { ...prev };
//           Object.keys(next).forEach((k) => {
//             const v = d.doc[k];
//             if (v === null || v === undefined) return;
//             next[k] = allFields.find((f) => f.k === k)?.type === 'ref' ? String(v) : v;
//           });
//           return next;
//         });
//       });
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [id, slugPath]);

//   const set = (k, v) => { setData((d) => ({ ...d, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };

//   /* GST NO DUPLICATE CHECK - opt in with cfg.gstLookup.

//      Asked when the GST field loses focus, when an import fills it, and again
//      on Submit - never per keystroke. Each answer describes ONE normalised
//      value: it is shown only while the box still holds that value, and a
//      response that arrives after a newer check has started is dropped, so a
//      slow answer for an old number can never land on a new one.

//      The API is the authority - it checks again on save, and a unique index
//      backs it - so this only warns early and stops a save that is already
//      known to fail. The number the record was loaded (or last saved) with is
//      not sent at all: a supplier cannot be its own duplicate. */
//   const gstValue = normalizeGstin(data.gstNo);
//   const gstTabIndex = tabs.findIndex((t) => (t.sections || []).some((s) => (s.fields || []).some((f) => f.k === 'gstNo')));
//   const gstShown = cfg.gstLookup && gstCheck && gstCheck.value === gstValue ? gstCheck.status : null;

//   function runGstCheck(raw) {
//     const value = normalizeGstin(raw);
//     /* the same number is already being asked about - share that answer
//        rather than sending a second request */
//     if (gstInflight.current?.value === value) return gstInflight.current.promise;
//     const ticket = ++gstTicket.current;
//     gstInflight.current = null;

//     if (!value) { setGstCheck(null); return Promise.resolve(null); }
//     /* not a GSTIN yet - nothing worth asking the database about */
//     if (!isValidGstin(value)) {
//       const result = { value, status: 'invalid' };
//       setGstCheck(result);
//       setErrors((e) => ({ ...e, gstNo: GSTIN_FORMAT_MESSAGE }));
//       return Promise.resolve(result);
//     }
//     if (recordId && value === ownGst) {
//       const result = { value, status: 'own' };
//       setGstCheck(result);
//       return Promise.resolve(result);
//     }

//     setGstCheck({ value, status: 'checking' });
//     const qs = new URLSearchParams({ gstNo: value, business: scope.business || '' });
//     if (recordId) qs.set('excludeId', recordId);
//     const promise = fetch(cfg.endpoint + '?' + qs.toString())
//       .then(async (r) => {
//         const d = await r.json().catch(() => ({}));
//         if (!r.ok) throw new Error(d.error || 'GST check failed');
//         return d.exists
//           ? { value, status: 'duplicate', supplier: d.supplier || null }
//           : { value, status: 'available' };
//       })
//       /* could not ask - which is not a verdict. Submit is still allowed and
//          the API makes the real check. */
//       .catch(() => ({ value, status: 'error' }))
//       .then((result) => {
//         if (ticket === gstTicket.current) setGstCheck(result);
//         return result;
//       })
//       .finally(() => {
//         if (gstInflight.current?.promise === promise) gstInflight.current = null;
//       });
//     gstInflight.current = { value, promise };
//     return promise;
//   }

//   function onGstBlur() {
//     const raw = String(data.gstNo ?? '');
//     const value = normalizeGstin(raw);
//     /* show the number the way it will be stored */
//     if (raw !== value) set('gstNo', value);
//     /* already answered for this exact number - no second request */
//     if (gstCheck && gstCheck.value === value && gstCheck.status !== 'error') {
//       if (gstCheck.status === 'invalid') setErrors((e) => ({ ...e, gstNo: GSTIN_FORMAT_MESSAGE }));
//       return;
//     }
//     runGstCheck(value);
//   }

//   /* COMPOSITE FIELDS - opt in with `parts` on a field.

//      One input standing in for two real columns: Address over
//      billingAddressLine1 + billingAddressLine2. Nothing new is stored and no
//      schema changes - the value shown is joined from the parts on every
//      render and split back into them on every keystroke, so the payload, the
//      API field list and the collection keep the exact keys they always had.

//      The parts stay in the tab definition marked `hidden`, which is what keeps
//      them in the API's field list while taking their inputs off the form. A
//      form that declares no `parts` anywhere (Customers) never reaches any of
//      this. */
//   const PART_SEP = ', ';
//   const joinParts = (f) => (f.parts || [])
//     .map((k) => String(data[k] ?? '').trim())
//     .filter(Boolean)
//     .join(PART_SEP);

//   /* Split on the FIRST separator only. That makes the round trip stable:
//      "Shop 5" + "Ring Road, Surat" shows as "Shop 5, Ring Road, Surat" and
//      comes back apart exactly as it went in, so opening a supplier and saving
//      without touching the address rewrites the same two values it read. */
//   function setParts(f, v) {
//     const [head, tail] = f.parts;
//     const text = String(v);
//     const at = text.indexOf(PART_SEP);
//     const patch = at === -1
//       ? { [head]: text, [tail]: '' }
//       : { [head]: text.slice(0, at), [tail]: text.slice(at + PART_SEP.length) };
//     setData((d) => ({ ...d, ...patch }));
//     setErrors((e) => ({ ...e, [f.k]: undefined, [head]: undefined, [tail]: undefined }));
//   }

//   /* STEP FLOW - opt in with cfg.wizard.

//      Only the footer changes. The tab strip above stays exactly as it is, so
//      the page keeps the look it shares with every other contact form; what
//      this switches is Submit-on-every-tab for Next / Back+Next / Back+Submit.

//      Without it the component behaves as it always has: a Submit on each tab
//      that saves that tab. The Agent form and the supplier dialog embedded in
//      the LR screen both rely on that, so the old path is left untouched and
//      the new behaviour is switched on per page.

//      With it: Next validates the current step and moves on WITHOUT saving, so
//      the API is called once, from Submit on the last step. `data` is one
//      shared state across all tabs, so stepping back and forth cannot lose
//      anything. */
//   const wizard = cfg.wizard === true;
//   const isLastStep = active === tabs.length - 1;

//   /* Required fields of ONE step. Deliberately not the whole form: Next must
//      not complain about a field two steps ahead that the user has not reached.
//      The full check still happens server-side on Submit, and the 422 handler
//      below jumps to whichever step holds the offending field. */
//   function validateStep(index) {
//     const t = tabs[index];
//     if (!t) return {};
//     const found = {};
//     (t.sections || []).forEach((s) => (s.fields || []).forEach((fld) => {
//       if (!fld.req) return;
//       if (cfg.isFieldVisible && !cfg.isFieldVisible(fld, data)) return;
//       /* the server drops this requirement for the same callers, so the client
//          must not block on a field the API would have accepted blank */
//       if (fld.k === 'firstName' && cfg.allowBlankFirstName === true) return;
//       const v = data[fld.k];
//       const empty = v === undefined || v === null
//         || (Array.isArray(v) ? v.length === 0 : String(v).trim() === '');
//       if (empty) found[fld.k] = (fld.label || fld.k) + ' is required.';
//     }));
//     return found;
//   }

//   function goNext() {
//     const found = validateStep(active);
//     if (Object.keys(found).length) {
//       setErrors((e) => ({ ...e, ...found }));
//       setFlash({ type: 'err', msg: 'Please complete the highlighted fields before continuing.' });
//       return;
//     }
//     /* a GST NO already known to be invalid or taken is not carried forward
//        onto steps that would only have to be filled in again */
//     if (active === gstTabIndex && (gstShown === 'invalid' || gstShown === 'duplicate')) {
//       setFlash({ type: 'err', msg: gstShown === 'invalid' ? GSTIN_FORMAT_MESSAGE : GSTIN_DUPLICATE_MESSAGE });
//       return;
//     }
//     setFlash(null);
//     setActive((a) => Math.min(a + 1, tabs.length - 1));
//   }

//   function goBack() {
//     /* no validation on the way back - the point of Back is to fix something */
//     setFlash(null);
//     setActive((a) => Math.max(a - 1, 0));
//   }

//   /* Every step at once, for Submit. Steps the operator skipped by clicking
//      the tab strip have never been through goNext, so without this the only
//      thing standing between them and a 422 is the server. Returns the first
//      failing step so the form can land them on it. */
//   function validateAll() {
//     const found = {};
//     let firstBad = -1;
//     tabs.forEach((_, i) => {
//       const step = validateStep(i);
//       if (Object.keys(step).length && firstBad === -1) firstBad = i;
//       Object.assign(found, step);
//     });
//     return { found, firstBad };
//   }

//   /* Used by the import panel: merge reviewed values into the shared state.
//      Only the keys the operator ticked arrive here, so a field they typed by
//      hand and did not tick is not in the patch and is left alone.

//      An imported GST NO is normalised and checked straight away - there is no
//      blur to wait for. A duplicate one is still filled in, so the operator can
//      see what the import said; it is the save that is refused. */
//   function applyPatch(patch, source) {
//     const keys = Object.keys(patch || {});
//     if (!keys.length) return;
//     const gstImported = cfg.gstLookup && Object.prototype.hasOwnProperty.call(patch, 'gstNo');
//     const next = gstImported ? { ...patch, gstNo: normalizeGstin(patch.gstNo) } : patch;
//     setData((d) => ({ ...d, ...next }));
//     setErrors((e) => { const n = { ...e }; keys.forEach((k) => { n[k] = undefined; }); return n; });
//     setFlash({ type: 'ok', msg: `${keys.length} field${keys.length === 1 ? '' : 's'} filled from ${source}. Review them, then Submit.` });
//     if (gstImported) runGstCheck(next.gstNo);
//   }

//   /* "Same as Billing Address" copies the billing block into shipping */
//   function copyBillingToShipping(on) {
//     set('sameAsBilling', on);
//     if (!on) return;
//     setData((d) => {
//       const next = { ...d };
//       Object.keys(d).forEach((k) => {
//         if (k.startsWith('billing')) next['shipping' + k.slice('billing'.length)] = d[k];
//       });
//       next.sameAsBilling = true;
//       return next;
//     });
//   }

//   async function submit() {
//     if (submitting.current) return;
//     submitting.current = true;
//     setSaving(true);
//     try {
//       /* the whole form, before anything is sent. The server still re-checks -
//          this only saves a round trip and lands the operator on the right tab. */
//       if (wizard) {
//         const { found, firstBad } = validateAll();
//         if (firstBad >= 0) {
//           setErrors((e) => ({ ...e, ...found }));
//           setActive(firstBad);
//           setFlash({ type: 'err', msg: 'Please complete the highlighted fields before submitting.' });
//           return;
//         }
//       }
//       setFlash(null);

//       /* GST NO: waits for the answer (sharing a check already in flight) and
//          stops only for a number known to be invalid or taken. A check that
//          could not be made does not block - the API checks regardless. */
//       if (cfg.gstLookup) {
//         const gst = await runGstCheck(data.gstNo);
//         if (gst && (gst.status === 'invalid' || gst.status === 'duplicate')) {
//           if (gstTabIndex >= 0) setActive(gstTabIndex);
//           setFlash({ type: 'err', msg: gst.status === 'invalid' ? GSTIN_FORMAT_MESSAGE : GSTIN_DUPLICATE_MESSAGE });
//           return;
//         }
//       }

//       /* contactKind is NOT sent - the API stamps it server-side so the
//          supplier/agent/customer discriminator can't be spoofed */
//       const payload = {
//         data,
//         business: scope.business, location: scope.location, finYear: scope.finYear,
//         allowBlankFirstName: cfg.allowBlankFirstName === true,
//       };

//       const r = await fetch(cfg.endpoint + (recordId ? '/' + recordId : ''), {
//         method: recordId ? 'PUT' : 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(payload),
//       });
//       const d = await r.json().catch(() => ({}));
//       if (r.status === 422) {
//         setErrors(d.errors || {});
//         /* jump to the first tab that actually has an error */
//         const bad = Object.keys(d.errors || {})[0];
//         const idx = tabs.findIndex((t) => (t.sections || []).some((s) => (s.fields || []).some((f) => f.k === bad)));
//         if (idx >= 0) setActive(idx);
//         setFlash({ type: 'err', msg: 'Please correct the highlighted fields.' });
//         return;
//       }
//       /* The API found the GST NO taken at the moment of saving - after this
//          form had been told it was free (another user, another tab). */
//       if (r.status === 409 && d.code === 'DUPLICATE_GST') {
//         gstTicket.current += 1;          /* any check still in flight is now stale */
//         gstInflight.current = null;
//         setGstCheck({ value: normalizeGstin(data.gstNo), status: 'duplicate', supplier: d.supplier || null });
//         if (gstTabIndex >= 0) setActive(gstTabIndex);
//         setFlash({ type: 'err', msg: GSTIN_DUPLICATE_ON_SAVE_MESSAGE });
//         return;
//       }
//       /* any other failure is reported - never mistaken for a save */
//       if (!r.ok) {
//         setFlash({ type: 'err', msg: d.error || 'Save failed. Nothing was saved.' });
//         return;
//       }
//       setRecordId(d.id);
//       /* the number just saved is now this record's own */
//       setOwnGst(normalizeGstin(data.gstNo));
//       if (wizard || active === tabs.length - 1) {
//         /* embedded in a dialog: hand the new record back rather than leaving
//            the page the caller was in the middle of */
//         if (onSaved) onSaved(d);
//         else router.push(listUrl);
//       }
//       else { setFlash({ type: 'ok', msg: 'Saved. Continue with the next tab.' }); setActive((a) => a + 1); }
//     } finally {
//       submitting.current = false;
//       setSaving(false);
//     }
//   }

//   const tab = tabs[active] || tabs[0];

//   const quickAdd = quickAddField ? cfg.quickAdds?.[quickAddField] : null;

//   /* Known-taken GST NO: Submit is disabled as well as refused. Not while a
//      check is merely running - clicking Submit is what blurs the GST field,
//      and disabling the button mid-click would swallow that click. */
//   const gstBlocksSubmit = gstShown === 'duplicate';

//   if (!tab) return null;

//   return (
//     <>
//       {quickAdd && (
//         <ModalForm
//           cfg={quickAdd}
//           slug={quickAdd.slug || quickAddField}
//           onClose={() => setQuickAddField(null)}
//           onSaved={(result) => {
//             setQuickAddField(null);
//             set(quickAddField, result.id);
//             refreshOptions(quickAdd.ref || quickAdd.slug || quickAddField);
//           }}
//         />
//       )}
//       <div className="card">
//       {/* tab bar - column count follows tabs.length, so a page with 3 tabs
//           (Supplier, Agent) doesn't leave an empty 4th cell. Driven by the
//           --tab-count custom property, with the rule in globals.css: a
//           dynamically built `md:grid-cols-${n}` class would never be generated,
//           since there is no Tailwind safelist in this project. */}
//       <div className="tabstrip border-b border-line" style={{ '--tab-count': tabs.length }}>
//         {tabs.map((t, i) => (
//           <button
//             key={t.key}
//             type="button"
//             onClick={() => { setFlash(null); setActive(i); }}
//             className={
//               'py-3 text-center text-[13.5px] ' +
//               (i === active ? 'bg-brand font-bold text-white' : 'bg-white text-brand-link hover:bg-[#f5f8fd]')
//             }
//           >
//             {t.label}
//           </button>
//         ))}
//       </div>

//       <div className="card-body">
//         {flash && <div className={'flash ' + (flash.type === 'err' ? 'flash-err' : 'flash-ok')}>{flash.msg}</div>}

//         {/* Per-step extras supplied by the page - the supplier form puts its
//             GST / Excel import panel on step 1 through here, so this component
//             stays unaware of anything supplier-specific. */}
//         {cfg.renderStepExtras?.({ tab, index: active, data, applyPatch })}

//         {(tab.sections || []).map((s, si) => (
//           <div key={si} className="mb-4">
//             {(s.title || s.toggle) && (
//               <div className="mb-3 flex items-center border-b border-line bg-[#f7f9fc] px-3 py-2">
//                 <span className="text-[14px] font-bold">{s.title}</span>
//                 <span className="flex-1" />
//                 {s.toggle && (
//                   <label className="flex items-center gap-2 text-[13px]">
//                     <input
//                       type="checkbox"
//                       checked={!!data[s.toggle.k]}
//                       onChange={(e) => copyBillingToShipping(e.target.checked)}
//                     />
//                     {s.toggle.label}
//                   </label>
//                 )}
//               </div>
//             )}
//             {/* column count per section: the Customer page needs a 4-across
//                 identity row above 6-across name and address rows */}
//             {/* `.form-grid` is already the 3-across variant, so cols: 3 needs
//                 no new CSS. Written as literal class strings because Tailwind
//                 scans source text - a built-up `xl:grid-cols-${n}` would never
//                 be generated. */}
//             <div
//               className={
//                 s.cols === 6 ? 'form-grid-6'
//                   : s.cols === 3 ? 'form-grid'
//                     : s.cols === 1 ? 'grid grid-cols-1 gap-x-[22px] gap-y-3.5'
//                       : 'form-grid-4'
//               }
//             >
//               {(s.fields || []).filter((f) => !f.hidden && (!cfg.isFieldVisible || cfg.isFieldVisible(f, data))).map((f) => {
//                 const add = cfg.quickAdds?.[f.k];
//                 /* cfg.isFieldReadOnly is the sibling of cfg.isFieldVisible:
//                    the page decides, this component only asks. The Supplier
//                    form uses it to freeze the GST-registered billing address.
//                    A page that supplies neither hook is unaffected. */
//                 const locked = cfg.isFieldReadOnly?.(f, data) === true;
//                 const shown = locked ? { ...f, readOnly: true } : f;
//                 const gstField = f.k === 'gstNo' && cfg.gstLookup;
//                 return (
//                   <div key={f.k} className={add ? 'flex items-end gap-1.5' : ''}>
//                     {/* blur bubbles in React, so the GST field is heard here
//                         without Field needing an onBlur prop of its own */}
//                     <div className={add ? 'min-w-0 flex-1' : ''} onBlur={gstField ? onGstBlur : undefined}>
//                       <Field
//                         f={shown}
//                         value={f.parts ? joinParts(f) : data[f.k]}
//                         error={f.parts ? (errors[f.k] || f.parts.map((k) => errors[k]).find(Boolean)) : errors[f.k]}
//                         onChange={f.parts ? ((_k, v) => setParts(f, v)) : set}
//                         onOptionChange={(option) => {
//                           const patch = cfg.onOptionChange?.(f, option, data) || {};
//                           setData((current) => ({
//                             ...current,
//                             ...patch,
//                             ...(f.k === 'typeId' ? { _supplierTypeLabel: option?.label || '' } : {}),
//                           }));
//                         }}
//                       />
//                       {gstField && (
//                         <GstCheckNote check={gstCheck} value={gstValue} supplierHref={(sid) => listUrl + '/' + sid} />
//                       )}
//                     </div>
//                     {add && !locked && (
//                       <button
//                         type="button"
//                         title={add.label || 'Add'}
//                         aria-label={add.label || 'Add'}
//                         className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand text-white hover:opacity-90"
//                         onClick={() => setQuickAddField(f.k)}
//                       >
//                         <Icon name="plus" size={15} />
//                       </button>
//                     )}
//                   </div>
//                 );
//               })}
//             </div>
//           </div>
//         ))}

//         {wizard ? (
//           /* Exactly one Submit in the whole flow, and it is on the last step.
//              Next never touches the API - it only validates and advances - so
//              an abandoned wizard leaves no half-written supplier behind, which
//              is what the per-tab save used to do. */
//           <div className="mt-4 flex items-center gap-2 border-t border-line pt-4">
//             {active > 0 && (
//               <button type="button" className="btn" onClick={goBack} disabled={saving}>
//                 <Icon name="back" size={14} /> Back
//               </button>
//             )}
//             <span className="flex-1" />
//             {isLastStep ? (
//               <button type="button" className="btn btn-primary flex h-[38px] min-w-[160px] justify-center" onClick={submit} disabled={saving || gstBlocksSubmit}>
//                 {saving ? <span className="spin" /> : <Icon name="save" size={14} />} Submit
//               </button>
//             ) : (
//               <button type="button" className="btn btn-primary flex h-[38px] min-w-[160px] justify-center" onClick={goNext} disabled={saving}>
//                 Next <span aria-hidden="true">&rarr;</span>
//               </button>
//             )}
//           </div>
//         ) : (
//           <button type="button" className="btn btn-primary mt-2 flex h-[38px] w-full max-w-[390px] justify-center" onClick={submit} disabled={saving || gstBlocksSubmit}>
//             {saving ? <span className="spin" /> : <Icon name="save" size={14} />} Submit
//           </button>
//         )}
//       </div>
//       </div>
//     </>
//   );
// }



//sagar updated




 'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from './Icon';
import Field from './Field';
import ModalForm from './ModalForm';
import { refreshOptions } from './useOptions';
import { useScope } from './ScopeContext';

/* Supplier / Customer / Agent add form: four tabs across the top, each with its
   own grey-headed sections and its own Submit (the original saves per tab).

   `onSaved` lets this be embedded in a dialog rather than owning the page:
   when it is supplied, finishing the last tab calls it instead of navigating
   to the list. That is how the Delivery / LR screen offers the full supplier
   form inline without the user losing the consignment they were booking. */
export default function TabbedFormView({ cfg, id, slug, onSaved }) {
  const router = useRouter();
  const scope = useScope();
  const tabs = cfg.tabs || [];
  const slugPath = cfg.slugPath || slug;
  const listUrl = (cfg.basePath || '/admin/contact/') + slugPath;
  const [active, setActive] = useState(0);
  const [recordId, setRecordId] = useState(id || null);

  /* May this account save on this screen? Editing needs update, a new record
     needs create. The route refuses either way (lib/screenPermission.js);
     this only stops the operator filling in a long form to be told no at the
     end. can() answers true unless it positively knows otherwise, so an
     ungoverned role is unaffected. */
  const maySave = scope.can
    ? scope.can(listUrl, recordId ? 'update' : 'create')
    : true;
  const noSaveReason = recordId
    ? 'You do not have Update permission for this screen.'
    : 'You do not have Create permission for this screen.';

  const [errors, setErrors] = useState({});
  const [flash, setFlash] = useState(null);
  const [saving, setSaving] = useState(false);
  const [quickAddField, setQuickAddField] = useState(null);
  const [gstMatch, setGstMatch] = useState(null);
  const [gstChecking, setGstChecking] = useState(false);

  useEffect(() => {
    if (tabs.length && active >= tabs.length) setActive(tabs.length - 1);
  }, [active, tabs.length]);

  const allFields = tabs.flatMap((t) => (t.sections || []).flatMap((s) => s.fields || []));

  const [data, setData] = useState(() => {
    const d = {};
    /* a composite (`f.parts`) holds nothing of its own - see joinParts below -
       so it is kept out of the state and therefore out of the payload */
    allFields.forEach((f) => {
      if (f.parts) return;
      d[f.k] = f.def !== undefined ? f.def : (f.type === 'checkbox' ? false : '');
    });
    tabs.forEach((t) => (t.sections || []).forEach((s) => { if (s.toggle) d[s.toggle.k] = false; }));
    return d;
  });

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
            next[k] = allFields.find((f) => f.k === k)?.type === 'ref' ? String(v) : v;
          });
          return next;
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, slugPath]);

  const set = (k, v) => { setData((d) => ({ ...d, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };

  /* COMPOSITE FIELDS - opt in with `parts` on a field.

     One input standing in for two real columns: Address over
     billingAddressLine1 + billingAddressLine2. Nothing new is stored and no
     schema changes - the value shown is joined from the parts on every
     render and split back into them on every keystroke, so the payload, the
     API field list and the collection keep the exact keys they always had.

     The parts stay in the tab definition marked `hidden`, which is what keeps
     them in the API's field list while taking their inputs off the form. A
     form that declares no `parts` anywhere (Customers) never reaches any of
     this. */
  const PART_SEP = ', ';
  const joinParts = (f) => (f.parts || [])
    .map((k) => String(data[k] ?? '').trim())
    .filter(Boolean)
    .join(PART_SEP);

  /* Split on the FIRST separator only. That makes the round trip stable:
     "Shop 5" + "Ring Road, Surat" shows as "Shop 5, Ring Road, Surat" and
     comes back apart exactly as it went in, so opening a supplier and saving
     without touching the address rewrites the same two values it read. */
  function setParts(f, v) {
    const [head, tail] = f.parts;
    const text = String(v);
    const at = text.indexOf(PART_SEP);
    const patch = at === -1
      ? { [head]: text, [tail]: '' }
      : { [head]: text.slice(0, at), [tail]: text.slice(at + PART_SEP.length) };
    setData((d) => ({ ...d, ...patch }));
    setErrors((e) => ({ ...e, [f.k]: undefined, [head]: undefined, [tail]: undefined }));
  }

  /* STEP FLOW - opt in with cfg.wizard.

     Only the footer changes. The tab strip above stays exactly as it is, so
     the page keeps the look it shares with every other contact form; what
     this switches is Submit-on-every-tab for Next / Back+Next / Back+Submit.

     Without it the component behaves as it always has: a Submit on each tab
     that saves that tab. The Agent form and the supplier dialog embedded in
     the LR screen both rely on that, so the old path is left untouched and
     the new behaviour is switched on per page.

     With it: Next validates the current step and moves on WITHOUT saving, so
     the API is called once, from Submit on the last step. `data` is one
     shared state across all tabs, so stepping back and forth cannot lose
     anything. */
  const wizard = cfg.wizard === true;
  const isLastStep = active === tabs.length - 1;

  /* Required fields of ONE step. Deliberately not the whole form: Next must
     not complain about a field two steps ahead that the user has not reached.
     The full check still happens server-side on Submit, and the 422 handler
     below jumps to whichever step holds the offending field. */
  function validateStep(index) {
    const t = tabs[index];
    if (!t) return {};
    const found = {};
    (t.sections || []).forEach((s) => (s.fields || []).forEach((fld) => {
      if (!fld.req) return;
      if (cfg.isFieldVisible && !cfg.isFieldVisible(fld, data)) return;
      /* the server drops this requirement for the same callers, so the client
         must not block on a field the API would have accepted blank */
      if (fld.k === 'firstName' && cfg.allowBlankFirstName === true) return;
      const v = data[fld.k];
      const empty = v === undefined || v === null
        || (Array.isArray(v) ? v.length === 0 : String(v).trim() === '');
      if (empty) found[fld.k] = (fld.label || fld.k) + ' is required.';
    }));
    return found;
  }

  function goNext() {
    const found = validateStep(active);
    if (Object.keys(found).length) {
      setErrors((e) => ({ ...e, ...found }));
      setFlash({ type: 'err', msg: 'Please complete the highlighted fields before continuing.' });
      return;
    }
    setFlash(null);
    setActive((a) => Math.min(a + 1, tabs.length - 1));
  }

  function goBack() {
    /* no validation on the way back - the point of Back is to fix something */
    setFlash(null);
    setActive((a) => Math.max(a - 1, 0));
  }

  /* Every step at once, for Submit. Steps the operator skipped by clicking
     the tab strip have never been through goNext, so without this the only
     thing standing between them and a 422 is the server. Returns the first
     failing step so the form can land them on it. */
  function validateAll() {
    const found = {};
    let firstBad = -1;
    tabs.forEach((_, i) => {
      const step = validateStep(i);
      if (Object.keys(step).length && firstBad === -1) firstBad = i;
      Object.assign(found, step);
    });
    return { found, firstBad };
  }

  /* Used by the import panel: merge reviewed values into the shared state.
     Only the keys the operator ticked arrive here, so a field they typed by
     hand and did not tick is not in the patch and is left alone. */
  function applyPatch(patch, source) {
    const keys = Object.keys(patch || {});
    if (!keys.length) return;
    setData((d) => ({ ...d, ...patch }));
    setErrors((e) => { const next = { ...e }; keys.forEach((k) => { next[k] = undefined; }); return next; });
    setFlash({ type: 'ok', msg: `${keys.length} field${keys.length === 1 ? '' : 's'} filled from ${source}. Review them, then Submit.` });
  }

  useEffect(() => {
    if (!cfg.gstLookup || recordId || !String(data.gstNo || '').trim()) {
      setGstMatch(null);
      setGstChecking(false);
      return undefined;
    }
    const gstNo = String(data.gstNo).trim().toUpperCase();
    let cancelled = false;
    setGstChecking(true);
    fetch(`${cfg.endpoint}?gstNo=${encodeURIComponent(gstNo)}&business=${scope.business || ''}`)
      .then((response) => response.json())
      .then((result) => {
        if (!cancelled) setGstMatch(result.doc || null);
      })
      .catch(() => {
        if (!cancelled) setGstMatch(null);
      })
      .finally(() => {
        if (!cancelled) setGstChecking(false);
      });
    return () => { cancelled = true; };
  }, [cfg.endpoint, cfg.gstLookup, data.gstNo, recordId, scope.business]);

  function useExistingSupplier() {
    if (!gstMatch) return;
    const next = { ...data };
    allFields.forEach((f) => {
      const value = gstMatch[f.k];
      if (value !== null && value !== undefined) next[f.k] = f.type === 'ref' ? String(value) : value;
    });
    setData(next);
    setRecordId(String(gstMatch._id));
    setGstMatch(null);
    setFlash({ type: 'ok', msg: 'Existing supplier details loaded.' });
  }

  /* "Same as Billing Address" copies the billing block into shipping */
  function copyBillingToShipping(on) {
    set('sameAsBilling', on);
    if (!on) return;
    setData((d) => {
      const next = { ...d };
      Object.keys(d).forEach((k) => {
        if (k.startsWith('billing')) next['shipping' + k.slice('billing'.length)] = d[k];
      });
      next.sameAsBilling = true;
      return next;
    });
  }

  async function submit() {
    /* the whole form, before anything is sent. The server still re-checks -
       this only saves a round trip and lands the operator on the right tab. */
    if (wizard) {
      const { found, firstBad } = validateAll();
      if (firstBad >= 0) {
        setErrors((e) => ({ ...e, ...found }));
        setActive(firstBad);
        setFlash({ type: 'err', msg: 'Please complete the highlighted fields before submitting.' });
        return;
      }
    }
    setSaving(true); setFlash(null);
    try {
      /* contactKind is NOT sent - the API stamps it server-side so the
         supplier/agent/customer discriminator can't be spoofed */
      const payload = {
        data,
        business: scope.business, location: scope.location, finYear: scope.finYear,
        allowBlankFirstName: cfg.allowBlankFirstName === true,
      };

      const r = await fetch(cfg.endpoint + (recordId ? '/' + recordId : ''), {
        method: recordId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (r.status === 422) {
        setErrors(d.errors || {});
        /* jump to the first tab that actually has an error */
        const bad = Object.keys(d.errors || {})[0];
        const idx = tabs.findIndex((t) => (t.sections || []).some((s) => (s.fields || []).some((f) => f.k === bad)));
        if (idx >= 0) setActive(idx);
        setFlash({ type: 'err', msg: 'Please correct the highlighted fields.' });
        return;
      }

      /* ANY other failure - 403 refused, 409 duplicate, 500 - is a failure.
         Only 422 was handled above, so everything else fell through to
         "Saved. Continue with the next tab." and the operator was told a
         refused save had worked. It also ran setRecordId(d.id) with an
         undefined id, which would have turned the next tab's PUT into a POST.
         FormView has always got this right; this is the copy that drifted. */
      if (!r.ok) {
        setFlash({ type: 'err', msg: d.error || 'Could not save.' });
        return;
      }

      setRecordId(d.id);
      if (wizard || active === tabs.length - 1) {
        /* embedded in a dialog: hand the new record back rather than leaving
           the page the caller was in the middle of */
        if (onSaved) onSaved(d);
        else router.push(listUrl);
      }
      else { setFlash({ type: 'ok', msg: 'Saved. Continue with the next tab.' }); setActive((a) => a + 1); }
    } finally { setSaving(false); }
  }

  const tab = tabs[active] || tabs[0];

  const quickAdd = quickAddField ? cfg.quickAdds?.[quickAddField] : null;

  if (!tab) return null;

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
      {/* tab bar - column count follows tabs.length, so a page with 3 tabs
          (Supplier, Agent) doesn't leave an empty 4th cell. Driven by the
          --tab-count custom property, with the rule in globals.css: a
          dynamically built `md:grid-cols-${n}` class would never be generated,
          since there is no Tailwind safelist in this project. */}
      <div className="tabstrip border-b border-line" style={{ '--tab-count': tabs.length }}>
        {tabs.map((t, i) => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setFlash(null); setActive(i); }}
            className={
              'py-3 text-center text-[13.5px] ' +
              (i === active ? 'bg-brand font-bold text-white' : 'bg-white text-brand-link hover:bg-[#f5f8fd]')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card-body">
        {flash && <div className={'flash ' + (flash.type === 'err' ? 'flash-err' : 'flash-ok')}>{flash.msg}</div>}

        {/* Per-step extras supplied by the page - the supplier form puts its
            GST / Excel import panel on step 1 through here, so this component
            stays unaware of anything supplier-specific. */}
        {cfg.renderStepExtras?.({ tab, index: active, data, applyPatch })}

        {(tab.sections || []).map((s, si) => (
          <div key={si} className="mb-4">
            {(s.title || s.toggle) && (
              <div className="mb-3 flex items-center border-b border-line bg-[#f7f9fc] px-3 py-2">
                <span className="text-[14px] font-bold">{s.title}</span>
                <span className="flex-1" />
                {s.toggle && (
                  <label className="flex items-center gap-2 text-[13px]">
                    <input
                      type="checkbox"
                      checked={!!data[s.toggle.k]}
                      onChange={(e) => copyBillingToShipping(e.target.checked)}
                    />
                    {s.toggle.label}
                  </label>
                )}
              </div>
            )}
            {/* column count per section: the Customer page needs a 4-across
                identity row above 6-across name and address rows */}
            {/* `.form-grid` is already the 3-across variant, so cols: 3 needs
                no new CSS. Written as literal class strings because Tailwind
                scans source text - a built-up `xl:grid-cols-${n}` would never
                be generated. */}
            <div
              className={
                s.cols === 6 ? 'form-grid-6'
                  : s.cols === 3 ? 'form-grid'
                    : s.cols === 1 ? 'grid grid-cols-1 gap-x-[22px] gap-y-3.5'
                      : 'form-grid-4'
              }
            >
              {(s.fields || []).filter((f) => !f.hidden && (!cfg.isFieldVisible || cfg.isFieldVisible(f, data))).map((f) => {
                const add = cfg.quickAdds?.[f.k];
                /* cfg.isFieldReadOnly is the sibling of cfg.isFieldVisible:
                   the page decides, this component only asks. The Supplier
                   form uses it to freeze the GST-registered billing address.
                   A page that supplies neither hook is unaffected. */
                const locked = cfg.isFieldReadOnly?.(f, data) === true;
                const shown = locked ? { ...f, readOnly: true } : f;
                return (
                  <div key={f.k} className={add ? 'flex items-end gap-1.5' : ''}>
                    <div className={add ? 'min-w-0 flex-1' : ''}>
                      <Field
                        f={shown}
                        value={f.parts ? joinParts(f) : data[f.k]}
                        error={f.parts ? (errors[f.k] || f.parts.map((k) => errors[k]).find(Boolean)) : errors[f.k]}
                        onChange={f.parts ? ((_k, v) => setParts(f, v)) : set}
                        onOptionChange={(option) => {
                          const patch = cfg.onOptionChange?.(f, option, data) || {};
                          setData((current) => ({
                            ...current,
                            ...patch,
                            ...(f.k === 'typeId' ? { _supplierTypeLabel: option?.label || '' } : {}),
                          }));
                        }}
                      />
                      {f.k === 'gstNo' && cfg.gstLookup && gstChecking && (
                        <div className="mt-1 text-xs text-inkmuted">Checking GST...</div>
                      )}
                      {f.k === 'gstNo' && cfg.gstLookup && gstMatch && (
                        <button
                          type="button"
                          className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-danger hover:underline"
                          onClick={useExistingSupplier}
                        >
                          <Icon name="check" size={14} /> GST already exists. Fetch all details
                        </button>
                      )}
                    </div>
                    {add && !locked && (
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
          </div>
        ))}

        {wizard ? (
          /* Exactly one Submit in the whole flow, and it is on the last step.
             Next never touches the API - it only validates and advances - so
             an abandoned wizard leaves no half-written supplier behind, which
             is what the per-tab save used to do. */
          <div className="mt-4 flex items-center gap-2 border-t border-line pt-4">
            {active > 0 && (
              <button type="button" className="btn" onClick={goBack} disabled={saving}>
                <Icon name="back" size={14} /> Back
              </button>
            )}
            {!maySave && (
              <span className="text-[12px] text-danger">{noSaveReason}</span>
            )}
            <span className="flex-1" />
            {isLastStep ? (
              <button type="button" className="btn btn-primary flex h-[38px] min-w-[160px] justify-center" onClick={submit} disabled={saving || gstChecking || !!gstMatch || !maySave}
                title={!maySave ? noSaveReason : undefined}>
                {saving ? <span className="spin" /> : <Icon name="save" size={14} />} Submit
              </button>
            ) : (
              <button type="button" className="btn btn-primary flex h-[38px] min-w-[160px] justify-center" onClick={goNext} disabled={saving}>
                Next <span aria-hidden="true">&rarr;</span>
              </button>
            )}
          </div>
        ) : (
          <>
            <button type="button" className="btn btn-primary mt-2 flex h-[38px] w-full max-w-[390px] justify-center disabled:cursor-not-allowed disabled:opacity-50" onClick={submit} disabled={saving || gstChecking || !!gstMatch || !maySave}
                  title={!maySave ? noSaveReason : undefined}>
              {saving ? <span className="spin" /> : <Icon name="save" size={14} />} Submit
            </button>
            {!maySave && (
              <div className="mt-1 text-[12px] text-danger">{noSaveReason}</div>
            )}
          </>
        )}
      </div>
      </div>
    </>
  );
}
