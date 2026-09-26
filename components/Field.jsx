





// 'use client';
// import { useState, useEffect, useRef } from 'react';
// import MultiSelect from './MultiSelect';
// import { useOptions, useCities } from './useOptions';
// import { compressImage, prettyBytes } from '@/lib/imageFile';
// import BarcodeScanner from './BarcodeScanner';

// function Label({ f }) {
//   /* ph = placeholder-only field: the original shows no label above these,
//      the text sits inside the input instead (Basic Information tab). */
//   if (f.ph) return null;
//   return (
//     <label className="f-label">
//       {f.label}
//       {f.req && !/\*$/.test(f.label) && <span className="f-req">*</span>}
//       {f.hint && <span className="f-hint">{f.hint}</span>}
//       {f.info && <span className="ml-1 text-brand-link">&#9432;</span>}
//     </label>
//   );
// }

// function RefField({ f, value, onChange, multi, onOptionChange, selectedOption }) {
//   const [query, setQuery] = useState('');
//   const [lastSelectedOption, setLastSelectedOption] = useState(null);
//   const meetsMinimum = !f.minSearch || query.trim().length >= f.minSearch;
//   const { options, loading, error } = useOptions(f.ref, query, meetsMinimum);
//   const currentSelectedOption = selectedOption || lastSelectedOption;
//   const displayedOptions = currentSelectedOption && !options.some((option) => option.value === currentSelectedOption.value)
//     ? [currentSelectedOption, ...options]
//     : options;
//   return (
//     <MultiSelect
//       mode={multi ? 'multi' : 'single'}
//       options={displayedOptions}
//       loading={loading}
//       error={error}
//       disabled={f.readOnly || f.disabled}
//       /* A field that waits for typing must SAY so - otherwise an empty list
//          is indistinguishable from a master with no records in it. */
//       emptyText={!meetsMinimum
//         ? 'Type at least ' + f.minSearch + ' character' + (f.minSearch > 1 ? 's' : '') + ' to search'
//         : query.trim()
//           ? 'Nothing matches "' + query.trim() + '"'
//           : 'No records found'}
//       value={multi ? (value || []) : (value || '')}
//       placeholder={f.placeholder || 'Select...'}
//       onChange={(next) => {
//         onChange(next);
//         if (!multi) {
//           const option = displayedOptions.find((item) => item.value === next);
//           setLastSelectedOption(option || null);
//           onOptionChange?.(option);
//         }
//       }}
//       onSearch={setQuery}
//     />
//   );
// }

// /* Loads options from /api/options and renders them as checkboxes.
//    Value is an array of id strings, same shape as multiref. */
// function CheckRefField({ f, value, onChange }) {
//   const { options, loading } = useOptions(f.ref);
//   const picked = Array.isArray(value) ? value : [];

//   function toggle(id) {
//     onChange(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);
//   }

//   if (loading) {
//     return (
//       <div className="flex items-center gap-2 rounded-md border border-linestrong bg-white px-3 py-2 text-[13px] text-inkmuted">
//         <span className="spin" style={{ width: 14, height: 14 }} /> Loading…
//       </div>
//     );
//   }

//   if (!options.length) {
//     return (
//       <div className="rounded-md border border-linestrong bg-white px-3 py-2 text-[13px] text-inkmuted">
//         No options found
//       </div>
//     );
//   }

//   return (
//     <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-md border border-linestrong bg-white px-3 py-2">
//       {options.map((o) => (
//         <label key={o.value} className="flex cursor-pointer items-center gap-1.5 text-[13px]">
//           <input
//             type="checkbox"
//             checked={picked.includes(o.value)}
//             onChange={() => toggle(o.value)}
//           />
//           {o.label}
//         </label>
//       ))}
//     </div>
//   );
// }

// /* ==========================================================================
//    File / image picker.

//    The old version rendered a styled span next to a `hidden` <input type=
//    "file"> with nothing connecting the two - no <label>, no ref, no click
//    handler - so the button was decorative and the picker never opened. It
//    also stored only `file.name`, discarding the file itself.

//    Wrapping the input in a <label> fixes both the mouse and the keyboard,
//    and needs no ref.

//    The file is POSTed to /api/upload, which writes it to disk and returns a
//    short URL; that URL is what gets stored in the record, so Item.image and
//    the waybill fields keep their existing String type. Images are downscaled
//    first (lib/imageFile.js) - that is bandwidth and disk, not storage policy.

//    Values that are already data URIs still preview, so anything saved before
//    server-side storage existed keeps rendering.
//    ========================================================================== */
// function FileField({ f, value, onChange }) {
//   const [busy, setBusy] = useState(false);
//   const [err, setErr] = useState('');
//   const [meta, setMeta] = useState(null); // { name, size } for this session

//   const acceptsImages = String(f.accept || '').includes('image');
//   const stored = typeof value === 'string' ? value : '';
//   const isUploaded = stored.startsWith('/api/files/');
//   const isLegacyDataUrl = stored.startsWith('data:image/');
//   const canPreview = isLegacyDataUrl || (isUploaded && /\.(jpg|png|webp|gif)$/i.test(stored));

//   async function upload(blob, filename) {
//     const body = new FormData();
//     body.append('file', blob, filename);
//     const r = await fetch('/api/upload', { method: 'POST', body });
//     const d = await r.json().catch(() => ({}));
//     if (!r.ok) throw new Error(d.error || 'Upload failed.');
//     return d;
//   }

//   async function pick(e) {
//     const file = e.target.files?.[0];
//     /* let the same file be chosen again after a Remove */
//     e.target.value = '';
//     if (!file) return;

//     setErr('');
//     setBusy(true);
//     try {
//       let blob = file;
//       let name = file.name;

//       if (file.type.startsWith('image/')) {
//         const out = await compressImage(file, {
//           maxDim: f.maxDim,
//           maxBytes: f.maxKb ? f.maxKb * 1024 : undefined,
//         });
//         blob = out.blob;
//         /* the canvas re-encodes to JPEG, so the name must follow or the
//            server picks the extension from a type that no longer matches */
//         if (out.type === 'image/jpeg' && !/\.jpe?g$/i.test(name)) {
//           name = name.replace(/\.[^.]+$/, '') + '.jpg';
//         }
//       }

//       const saved = await upload(blob, name);
//       onChange(saved.url);
//       setMeta({ name: file.name, size: saved.size });
//     } catch (ex) {
//       setErr(ex.message || 'Could not upload that file.');
//     } finally {
//       setBusy(false);
//     }
//   }

//   function clear() {
//     /* only the reference is dropped. The file itself is content-addressed
//        and may be shared with another record, so it is left on disk - see
//        the note on orphans in lib/uploads.js. */
//     onChange('');
//     setMeta(null);
//     setErr('');
//   }

//   const caption = meta
//     ? meta.name + (meta.size ? ' (' + prettyBytes(meta.size) + ')' : '')
//     : isUploaded
//       ? 'Stored file'
//       : isLegacyDataUrl
//         ? 'Embedded image'
//         : stored || 'No file chosen';

//   return (
//     <div>
//       <div className="flex items-center gap-2">
//         <label
//           className={
//             'flex h-9 flex-1 items-center gap-2 overflow-hidden rounded-md border border-linestrong bg-white px-1 text-[13px] '
//             + (busy ? 'cursor-wait opacity-60' : 'cursor-pointer hover:border-brand')
//           }
//         >
//           <span className="shrink-0 rounded bg-[#eff2f7] px-2 py-1">
//             {busy ? 'Uploading...' : acceptsImages ? 'Choose File' : 'Choose Image'}
//           </span>
//           <span className="truncate text-inkmuted">{caption}</span>
//           <input
//             type="file"
//             className="hidden"
//             accept={f.accept || undefined}
//             disabled={busy}
//             onChange={pick}
//           />
//         </label>

//         {stored && !busy && (
//           <button
//             type="button"
//             onClick={clear}
//             className="shrink-0 rounded border border-linestrong px-2 py-1 text-[12px] text-inkmuted hover:border-danger hover:text-danger"
//           >
//             Remove
//           </button>
//         )}
//       </div>

//       {canPreview && (
//         /* eslint-disable-next-line @next/next/no-img-element -- these are
//            session-gated app routes, not something next/image can optimise */
//         <img
//           src={stored}
//           alt=""
//           className="mt-2 h-20 w-20 rounded border border-line object-cover"
//         />
//       )}

//       {isUploaded && !canPreview && (
//         <a
//           href={stored}
//           target="_blank"
//           rel="noreferrer"
//           className="mt-1 inline-block text-[12px] text-brand-link hover:underline"
//         >
//           Open attachment
//         </a>
//       )}

//       {err && <div className="f-err">{err}</div>}
//     </div>
//   );
// }

// function CityField({ f, value, onChange, multi }) {
//   /* cities come from /api/cities, not the ref map */
//   const options = useCities('');
//   return (
//     <MultiSelect
//       mode={multi ? 'multi' : 'single'}
//       options={options}
//       value={multi ? (value || []) : (value || '')}
//       placeholder={f.placeholder || 'Select City'}
//       disabled={f.readOnly || f.disabled}
//       onChange={onChange}
//     />
//   );
// }

// /* PIN code with address lookup - `type: 'zip'`.

//    f.fill maps what /api/pincode returns onto this form's own keys:
//      fill: { city: 'billingCity', state: 'billingState',
//              country: 'billingCountry', district: 'billingDistrict' }
//    Only the keys listed in f.fill are written, so the Shipping block points the
//    same control at its own four fields. Without f.fill this is a plain digits
//    box and no lookup runs.

//    Nothing is fetched until six digits are present, and the call is debounced,
//    so typing "560001" fires one request rather than one per keystroke. */
// function PincodeField({ f, value, onChange, patch }) {
//   const [status, setStatus] = useState(null);
//   const latest = useRef(0);

//   const pin = String(value ?? '').trim();

//   useEffect(() => {
//     if (!f.fill) return;
//     if (!/^\d{6}$/.test(pin)) { setStatus(null); return; }

//     const ticket = ++latest.current;
//     setStatus({ text: 'Looking up ' + pin + '…' });

//     const t = setTimeout(() => {
//       fetch('/api/pincode?pin=' + encodeURIComponent(pin))
//         .then((r) => r.json())
//         .then((d) => {
//           /* a slow earlier request must not land on top of a newer one */
//           if (ticket !== latest.current) return;
//           if (!d.found) { setStatus({ err: true, text: d.reason || 'Not found.' }); return; }

//           const next = {};
//           Object.entries(f.fill).forEach(([from, key]) => {
//             if (d[from]) next[key] = d[from];
//           });
//           patch(next);
//           setStatus({ text: [d.district, d.state].filter(Boolean).join(', ') || 'Found' });
//         })
//         .catch(() => {
//           if (ticket === latest.current) setStatus({ err: true, text: 'Lookup failed.' });
//         });
//     }, 450);

//     return () => clearTimeout(t);
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [pin]);

//   return (
//     <>
//       <input
//         type="text"
//         inputMode="numeric"
//         maxLength={6}
//         className="f-input"
//         value={value ?? ''}
//         readOnly={!!f.readOnly}
//         placeholder={f.placeholder || (f.ph ? f.label : '')}
//         /* digits only - the lookup keys off exactly six of them */
//         onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
//       />
//       {/* `hideLookupText` drops the confirmatory line under the box - the
//           resolved "SURAT, GUJARAT" and the "Looking up…" that precedes it - on
//           forms where the City and State fields it filled already say the same
//           thing. A failed lookup still speaks up either way: quietly filling
//           nothing is the one outcome the operator has to be told about. */}
//       {status && (status.err || !f.hideLookupText) && (
//         <div className={'mt-1 text-[11.5px] ' + (status.err ? 'text-danger' : 'text-inkmuted')}>
//           {status.text}
//         </div>
//       )}
//     </>
//   );
// }

// /* "Active" / "active" / "In-Active" -> one comparable word, so a badge's
//    colour does not depend on the portal's capitalisation or hyphens. */
// const squashWord = (v) => String(v ?? '').toLowerCase().replace(/[^a-z]/g, '');

// export default function Field({ f, value, error, onChange, onOptionChange, selectedOption }) {
//   /* Written as literal class strings: Tailwind scans source text, so a class
//      assembled at runtime (`md:col-span-${n}`) would never be generated. */
//   const SPAN = { 2: 'md:col-span-2', 3: 'md:col-span-2 xl:col-span-3', all: 'col-span-full' };
//   /* f.row forces this field to open a new grid row instead of flowing on after
//      the previous one. The Agent Basic tab needs it: Type sits alone above Short
//      Name, which sits alone above the six-across name row, and none of those
//      three rows fills its track count. */
//   const span = (SPAN[f.span] || '') + (f.row ? ' xl:col-start-1' : '');
//   const set = (v) => onChange(f.k, v);
//   /* the PIN code lookup writes City / State / Country / District in one go.
//      No parent had to change for this: every consumer of Field passes an
//      onChange of (key, value) backed by a functional setState, so back-to-back
//      calls merge instead of clobbering each other. */
//   const patch = (obj) => Object.entries(obj).forEach(([k, v]) => onChange(k, v));

//   let control = null;

//   switch (f.type) {
//     case 'textarea':
//       control = (
//         <textarea
//           className="f-input f-textarea" value={value ?? ''}
//           readOnly={!!f.readOnly} placeholder={f.placeholder || (f.ph ? f.label : '')}
//           onChange={(e) => set(e.target.value)}
//         />
//       );
//       break;

//     case 'select':
//       control = (
//         <select className="f-input" value={value ?? ''} disabled={f.readOnly || f.disabled} onChange={(e) => set(e.target.value)}>
//           <option value="">{f.placeholder || 'Select...'}</option>
//           {(f.opts || []).map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
//         </select>
//       );
//       break;

//     case 'radio':
//       control = (
//         <div className="f-radio-row">
//           {(f.opts || []).map((o) => (
//             <label key={o.v} className="f-radio">
//               <input
//                 type="radio"
//                 name={f.name || f.k}
//                 checked={(value ?? '') === o.v}
//                 onChange={() => set(o.v)}
//               />
//               {o.l}
//             </label>
//           ))}
//         </div>
//       );
//       break;

//     case 'ref':
//       control = <RefField f={f} value={value} onChange={set} onOptionChange={onOptionChange} selectedOption={selectedOption} />;
//       break;

//     case 'multiref':
//       control = <RefField f={f} value={value} onChange={set} multi />;
//       break;

//     case 'checkref': {
//       /* Dynamic options loaded from /api/options, displayed as checkboxes.
//          Value is an array of ObjectId strings (same shape as multiref). */
//       control = <CheckRefField f={f} value={value} onChange={set} />;
//       break;
//     }

//     case 'zip':
//       control = <PincodeField f={f} value={value} onChange={set} patch={patch} />;
//       break;

//     case 'city':
//       control = <CityField f={f} value={value} onChange={set} />;
//       break;

//     case 'multicity':
//       control = <CityField f={f} value={value} onChange={set} multi />;
//       break;

//     case 'date':
//       if (f.displayFormat === 'DD/MM/YYYY') {
//         const iso = value ? String(value).slice(0, 10) : '';
//         const display = iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)
//           ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4)
//           : String(value || '');
//         control = (
//           <input
//             type="text" inputMode="numeric" className="f-input" placeholder="DD/MM/YYYY"
//             value={display}
//             onChange={(e) => {
//               const raw = e.target.value.replace(/[^\d]/g, '').slice(0, 8);
//               const shown = raw.length > 4 ? raw.slice(0, 2) + '/' + raw.slice(2, 4) + '/' + raw.slice(4) : raw;
//               const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(shown);
//               set(match ? match[3] + '-' + match[2] + '-' + match[1] : shown);
//             }}
//           />
//         );
//       } else {
//         control = (
//           <input
//             type="date" className="f-input"
//             value={value ? String(value).slice(0, 10) : ''}
//             onChange={(e) => set(e.target.value)}
//           />
//         );
//       }
//       break;

//     /* Date AND clock time in one native control - the browser renders the
//        calendar and the time side by side, and both are editable.

//        The stored value is an ISO timestamp in UTC, but datetime-local speaks
//        local time, so it is converted on the way in rather than sliced: a
//        naive String(value).slice(0, 16) would display a UTC clock and show
//        the wrong time to everyone outside UTC. */
//     case 'datetime': {
//       const local = (v) => {
//         if (!v) return '';
//         const dt = new Date(v);
//         if (Number.isNaN(dt.getTime())) return String(v).slice(0, 16);
//         const p = (n) => String(n).padStart(2, '0');
//         return dt.getFullYear() + '-' + p(dt.getMonth() + 1) + '-' + p(dt.getDate())
//           + 'T' + p(dt.getHours()) + ':' + p(dt.getMinutes());
//       };
//       control = (
//         <input
//           type="datetime-local" className="f-input"
//           value={local(value)}
//           onChange={(e) => set(e.target.value)}
//         />
//       );
//       break;
//     }

//     case 'number':
//       control = (
//         <input
//           type="number" className="f-input" value={value ?? ''}
//           onChange={(e) => set(e.target.value === '' ? '' : Number(e.target.value))}
//           /* A number input listens for wheel scroll even without this being
//              the field the cursor was aimed at reading, not typing into - so
//              a scroll that was meant to move the page silently steps
//              whichever number field the cursor happened to be over
//              (Invoice Qty, Taxable, Freight, ...). Blurring on wheel does not
//              call preventDefault, so the scroll still reaches the page
//              normally; it just stops being interpreted as a step on this
//              field. */
//           onWheel={(e) => e.currentTarget.blur()}
//         />
//       );
//       break;

//     case 'file':
//       control = <FileField f={f} value={value} onChange={set} />;
//       break;

//     case 'text':
//       /* For vendorWaybill field, add barcode scanner */
//       if (f.k === 'vendorWaybill') {
//         const [showScanner, setShowScanner] = useState(false);
//         control = (
//           <div className="flex gap-2">
//             <input
//               type="text"
//               className="f-input flex-1"
//               value={value ?? ''}
//               placeholder={f.placeholder || 'Enter waybill number or scan barcode'}
//               onChange={(e) => set(e.target.value)}
//             />
//             <button
//               type="button"
//               className="btn btn-primary"
//               onClick={() => setShowScanner(true)}
//             >
//               SCAN
//             </button>
//             {showScanner && (
//               <BarcodeScanner
//                 onScan={(scannedValue) => {
//                   set(scannedValue);
//                   setShowScanner(false);
//                 }}
//                 onClose={() => setShowScanner(false)}
//               />
//             )}
//           </div>
//         );
//       } else {
//         control = (
//           <input
//             type="text" className={'f-input' + (f.uppercase ? ' uppercase' : '')} value={value ?? ''}
//             readOnly={!!f.readOnly} placeholder={f.placeholder || (f.ph ? f.label : '')}
//             onChange={(e) => set(e.target.value)}
//           />
//         );
//       }
//       break;

//     case 'checkgroup': {
//       /* several fixed options, any number tickable - Freight, Auto Charges
//          Mode and Tips Mode on the Transporter form */
//       const picked = Array.isArray(value) ? value : [];
//       control = (
//         <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-md border border-linestrong bg-white px-3 py-2">
//           {(f.opts || []).map((o) => (
//             <label key={o.v} className="flex cursor-pointer items-center gap-1.5 text-[13px]">
//               <input
//                 type="checkbox"
//                 checked={picked.includes(o.v)}
//                 onChange={() =>
//                   set(picked.includes(o.v) ? picked.filter((x) => x !== o.v) : [...picked, o.v])
//                 }
//               />
//               {o.l}
//             </label>
//           ))}
//         </div>
//       );
//       break;
//     }

//     case 'checkbox':
//       control = (
//         <label className="f-radio-row gap-2 text-[13.5px]">
//           <input type="checkbox" checked={!!value} onChange={(e) => set(e.target.checked)} />
//           {f.label}
//         </label>
//       );
//       break;

//     case 'password':
//       control = (
//         <input
//           type="password" className="f-input" value={value ?? ''}
//           placeholder={f.placeholder || (f.ph ? f.label : '')}
//           onChange={(e) => set(e.target.value)}
//         />
//       );
//       break;

//     /* ----------------------------------------------------------------------
//        Read-only pill.

//        For a value the record carries but nobody types: the GST portal's own
//        answer - Active, Regular, Yes, No. An input would invite editing it,
//        and a hand-edited copy of a registration detail is worse than none, so
//        this renders as text at input height and sits in the grid like any
//        other field. Empty reads as a dash rather than as a blank cell, which
//        is how it looks before a GST paste has filled anything in.

//        The value still travels in the form state and the payload exactly as a
//        text field's would - only the control is different.
//        ---------------------------------------------------------------------- */
//     case 'badge': {
//       const shown = String(value ?? '').trim();
//       const tone = squashWord(shown);
//       const good = tone === 'active' || tone === 'yes';
//       const bad = tone === 'no' || tone === 'cancelled' || tone === 'suspended'
//         || tone === 'inactive' || tone === 'inactivepending';
//       control = (
//         <div className="flex h-9 items-center">
//           {shown ? (
//             <span
//               className={
//                 'inline-flex items-center rounded-full px-2.5 py-1 text-[12.5px] font-bold '
//                 + (good ? 'bg-okgreenbg text-okgreen'
//                   : bad ? 'bg-[#fdeceb] text-danger'
//                     : 'bg-pillgrey text-cell')
//               }
//             >
//               {shown}
//             </span>
//           ) : (
//             <span className="text-[13.5px] text-inkmuted">&mdash;</span>
//           )}
//         </div>
//       );
//       break;
//     }

//     default:
//       control = (
//           <input
//           type="text" className={'f-input' + (f.uppercase ? ' uppercase' : '')} value={value ?? ''}
//           readOnly={!!f.readOnly} placeholder={f.placeholder || (f.ph ? f.label : '')}
//           onChange={(e) => set(e.target.value)}
//         />
//       );
//   }

//   return (
//     <div className={span}>
//       <Label f={f} />
//       {control}
//       {error && <div className="f-err">{error}</div>}
//     </div>
//   );
// }















/////////suhas





// 'use client';
// import MultiSelect from './MultiSelect';
// import { useOptions, useCities } from './useOptions';

// function Label({ f }) {
//   /* ph = placeholder-only field: the original shows no label above these,
//      the text sits inside the input instead (Basic Information tab). */
//   if (f.ph) return null;
//   return (
//     <label className="f-label">
//       {f.label}
//       {f.req && !/\*$/.test(f.label) && <span className="f-req">*</span>}
//       {f.hint && <span className="f-hint">{f.hint}</span>}
//       {f.info && <span className="ml-1 text-brand-link">&#9432;</span>}
//     </label>
//   );
// }

// function RefField({ f, value, onChange, multi }) {
//   const { options, loading } = useOptions(f.ref);
//   return (
//     <MultiSelect
//       mode={multi ? 'multi' : 'single'}
//       options={options}
//       loading={loading}
//       value={multi ? (value || []) : (value || '')}
//       placeholder={f.placeholder || 'Select...'}
//       onChange={onChange}
//     />
//   );
// }

// function CityField({ f, value, onChange, multi }) {
//   /* cities come from /api/cities, not the ref map */
//   const options = useCities('');
//   return (
//     <MultiSelect
//       mode={multi ? 'multi' : 'single'}
//       options={options}
//       value={multi ? (value || []) : (value || '')}
//       placeholder={f.placeholder || 'Select City'}
//       onChange={onChange}
//     />
//   );
// }

// export default function Field({ f, value, error, onChange }) {
//   /* Written as literal class strings: Tailwind scans source text, so a class
//      assembled at runtime (`md:col-span-${n}`) would never be generated. */
//   const SPAN = { 2: 'md:col-span-2', 3: 'md:col-span-2 xl:col-span-3', all: 'col-span-full' };
//   const span = SPAN[f.span] || '';
//   const set = (v) => onChange(f.k, v);

//   let control = null;

//   switch (f.type) {
//     case 'textarea':
//       control = (
//         <textarea className="f-input f-textarea" value={value ?? ''} onChange={(e) => set(e.target.value)} />
//       );
//       break;

//     case 'select':
//       control = (
//         <select className="f-input" value={value ?? ''} onChange={(e) => set(e.target.value)}>
//           <option value="">{f.placeholder || 'Select...'}</option>
//           {(f.opts || []).map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
//         </select>
//       );
//       break;

//     case 'radio':
//       control = (
//         <div className="f-radio-row">
//           {(f.opts || []).map((o) => (
//             <label key={o.v} className="f-radio">
//               <input
//                 type="radio"
//                 name={f.k}
//                 checked={(value ?? '') === o.v}
//                 onChange={() => set(o.v)}
//               />
//               {o.l}
//             </label>
//           ))}
//         </div>
//       );
//       break;

//     case 'ref':
//       control = <RefField f={f} value={value} onChange={set} />;
//       break;

//     case 'multiref':
//       control = <RefField f={f} value={value} onChange={set} multi />;
//       break;

//     case 'city':
//       control = <CityField f={f} value={value} onChange={set} />;
//       break;

//     case 'multicity':
//       control = <CityField f={f} value={value} onChange={set} multi />;
//       break;

//     case 'date':
//       control = (
//         <input
//           type="date" className="f-input"
//           value={value ? String(value).slice(0, 10) : ''}
//           onChange={(e) => set(e.target.value)}
//         />
//       );
//       break;

//     case 'number':
//       control = (
//         <input
//           type="number" className="f-input" value={value ?? ''}
//           onChange={(e) => set(e.target.value === '' ? '' : Number(e.target.value))}
//         />
//       );
//       break;

//     case 'file':
//       control = (
//         <div className="flex h-9 items-center gap-2 rounded-md border border-linestrong bg-white px-1 text-[13px]">
//           <span className="rounded bg-[#eff2f7] px-2 py-1">Choose Files</span>
//           <span className="text-inkmuted">{value ? String(value) : 'No file chosen'}</span>
//           <input type="file" className="hidden" onChange={(e) => set(e.target.files?.[0]?.name || '')} />
//         </div>
//       );
//       break;

//     case 'checkbox':
//       control = (
//         <label className="f-radio-row gap-2 text-[13.5px]">
//           <input type="checkbox" checked={!!value} onChange={(e) => set(e.target.checked)} />
//           {f.label}
//         </label>
//       );
//       break;

//     case 'password':
//       control = (
//         <input
//           type="password" className="f-input" value={value ?? ''}
//           placeholder={f.placeholder || (f.ph ? f.label : '')}
//           onChange={(e) => set(e.target.value)}
//         />
//       );
//       break;

//     default:
//       control = (
//         <input
//           type="text" className="f-input" value={value ?? ''}
//           readOnly={!!f.readOnly} placeholder={f.placeholder || (f.ph ? f.label : '')}
//           onChange={(e) => set(e.target.value)}
//         />
//       );
//   }

//   return (
//     <div className={span}>
//       <Label f={f} />
//       {control}
//       {error && <div className="f-err">{error}</div>}
//     </div>
//   );
// }









'use client';
import { useState, useEffect, useRef } from 'react';
import MultiSelect from './MultiSelect';
import { useOptions, useCities } from './useOptions';
import { compressImage, prettyBytes } from '@/lib/imageFile';
import BarcodeScanner from './BarcodeScanner';

function Label({ f }) {
  /* ph = placeholder-only field: the original shows no label above these,
     the text sits inside the input instead (Basic Information tab). */
  if (f.ph) return null;
  return (
    <label className="f-label">
      {f.label}
      {f.req && !/\*$/.test(f.label) && <span className="f-req">*</span>}
      {f.hint && <span className="f-hint">{f.hint}</span>}
      {f.info && <span className="ml-1 text-brand-link">&#9432;</span>}
    </label>
  );
}

function RefField({ f, value, onChange, multi, onOptionChange, selectedOption }) {
  const [query, setQuery] = useState('');
  const [lastSelectedOption, setLastSelectedOption] = useState(null);
  const meetsMinimum = !f.minSearch || query.trim().length >= f.minSearch;
  const { options, loading, error } = useOptions(f.ref, query, meetsMinimum);
  /* the remembered pick only while it is still the value - a value changed
     from outside (e.g. Stock Point following the header location) must not
     leave the old option pinned to the top of the list */
  const currentSelectedOption = selectedOption
    || (lastSelectedOption && lastSelectedOption.value === value ? lastSelectedOption : null);
  const displayedOptions = currentSelectedOption && !options.some((option) => option.value === currentSelectedOption.value)
    ? [currentSelectedOption, ...options]
    : options;
  return (
    <MultiSelect
      mode={multi ? 'multi' : 'single'}
      options={displayedOptions}
      loading={loading}
      error={error}
      disabled={f.readOnly || f.disabled}
      /* A field that waits for typing must SAY so - otherwise an empty list
         is indistinguishable from a master with no records in it. */
      emptyText={!meetsMinimum
        ? 'Type at least ' + f.minSearch + ' character' + (f.minSearch > 1 ? 's' : '') + ' to search'
        : query.trim()
          ? 'Nothing matches "' + query.trim() + '"'
          : 'No records found'}
      value={multi ? (value || []) : (value || '')}
      placeholder={f.placeholder || 'Select...'}
      onChange={(next) => {
        onChange(next);
        if (!multi) {
          const option = displayedOptions.find((item) => item.value === next);
          setLastSelectedOption(option || null);
          onOptionChange?.(option);
        }
      }}
      onSearch={setQuery}
    />
  );
}

/* Loads options from /api/options and renders them as checkboxes.
   Value is an array of id strings, same shape as multiref. */
function CheckRefField({ f, value, onChange }) {
  const { options, loading } = useOptions(f.ref);
  const picked = Array.isArray(value) ? value : [];

  function toggle(id) {
    onChange(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-linestrong bg-white px-3 py-2 text-[13px] text-inkmuted">
        <span className="spin" style={{ width: 14, height: 14 }} /> Loading…
      </div>
    );
  }

  if (!options.length) {
    return (
      <div className="rounded-md border border-linestrong bg-white px-3 py-2 text-[13px] text-inkmuted">
        No options found
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-md border border-linestrong bg-white px-3 py-2">
      {options.map((o) => (
        <label key={o.value} className="flex cursor-pointer items-center gap-1.5 text-[13px]">
          <input
            type="checkbox"
            checked={picked.includes(o.value)}
            onChange={() => toggle(o.value)}
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}

/* ==========================================================================
   File / image picker.

   The old version rendered a styled span next to a `hidden` <input type=
   "file"> with nothing connecting the two - no <label>, no ref, no click
   handler - so the button was decorative and the picker never opened. It
   also stored only `file.name`, discarding the file itself.

   Wrapping the input in a <label> fixes both the mouse and the keyboard,
   and needs no ref.

   The file is POSTed to /api/upload, which writes it to disk and returns a
   short URL; that URL is what gets stored in the record, so Item.image and
   the waybill fields keep their existing String type. Images are downscaled
   first (lib/imageFile.js) - that is bandwidth and disk, not storage policy.

   Values that are already data URIs still preview, so anything saved before
   server-side storage existed keeps rendering.
   ========================================================================== */
function FileField({ f, value, onChange }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [meta, setMeta] = useState(null); // { name, size } for this session

  const acceptsImages = String(f.accept || '').includes('image');
  const stored = typeof value === 'string' ? value : '';
  const isUploaded = stored.startsWith('/api/files/');
  const isLegacyDataUrl = stored.startsWith('data:image/');
  const canPreview = isLegacyDataUrl || (isUploaded && /\.(jpg|png|webp|gif)$/i.test(stored));

  async function upload(blob, filename) {
    const body = new FormData();
    body.append('file', blob, filename);
    const r = await fetch('/api/upload', { method: 'POST', body });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Upload failed.');
    return d;
  }

  async function pick(e) {
    const file = e.target.files?.[0];
    /* let the same file be chosen again after a Remove */
    e.target.value = '';
    if (!file) return;

    setErr('');
    setBusy(true);
    try {
      let blob = file;
      let name = file.name;

      if (file.type.startsWith('image/')) {
        const out = await compressImage(file, {
          maxDim: f.maxDim,
          maxBytes: f.maxKb ? f.maxKb * 1024 : undefined,
        });
        blob = out.blob;
        /* the canvas re-encodes to JPEG, so the name must follow or the
           server picks the extension from a type that no longer matches */
        if (out.type === 'image/jpeg' && !/\.jpe?g$/i.test(name)) {
          name = name.replace(/\.[^.]+$/, '') + '.jpg';
        }
      }

      const saved = await upload(blob, name);
      onChange(saved.url);
      setMeta({ name: file.name, size: saved.size });
    } catch (ex) {
      setErr(ex.message || 'Could not upload that file.');
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    /* only the reference is dropped. The file itself is content-addressed
       and may be shared with another record, so it is left on disk - see
       the note on orphans in lib/uploads.js. */
    onChange('');
    setMeta(null);
    setErr('');
  }

  const caption = meta
    ? meta.name + (meta.size ? ' (' + prettyBytes(meta.size) + ')' : '')
    : isUploaded
      ? 'Stored file'
      : isLegacyDataUrl
        ? 'Embedded image'
        : stored || 'No file chosen';

  return (
    <div>
      <div className="flex items-center gap-2">
        <label
          className={
            'flex h-9 flex-1 items-center gap-2 overflow-hidden rounded-md border border-linestrong bg-white px-1 text-[13px] '
            + (busy ? 'cursor-wait opacity-60' : 'cursor-pointer hover:border-brand')
          }
        >
          <span className="shrink-0 rounded bg-[#eff2f7] px-2 py-1">
            {busy ? 'Uploading...' : acceptsImages ? 'Choose File' : 'Choose Image'}
          </span>
          <span className="truncate text-inkmuted">{caption}</span>
          <input
            type="file"
            className="hidden"
            accept={f.accept || undefined}
            disabled={busy}
            onChange={pick}
          />
        </label>

        {stored && !busy && (
          <button
            type="button"
            onClick={clear}
            className="shrink-0 rounded border border-linestrong px-2 py-1 text-[12px] text-inkmuted hover:border-danger hover:text-danger"
          >
            Remove
          </button>
        )}
      </div>

      {canPreview && (
        /* eslint-disable-next-line @next/next/no-img-element -- these are
           session-gated app routes, not something next/image can optimise */
        <img
          src={stored}
          alt=""
          className="mt-2 h-20 w-20 rounded border border-line object-cover"
        />
      )}

      {isUploaded && !canPreview && (
        <a
          href={stored}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block text-[12px] text-brand-link hover:underline"
        >
          Open attachment
        </a>
      )}

      {err && <div className="f-err">{err}</div>}
    </div>
  );
}

function CityField({ f, value, onChange, multi }) {
  /* cities come from /api/cities, not the ref map */
  const options = useCities('');
  return (
    <MultiSelect
      mode={multi ? 'multi' : 'single'}
      options={options}
      value={multi ? (value || []) : (value || '')}
      placeholder={f.placeholder || 'Select City'}
      disabled={f.readOnly || f.disabled}
      onChange={onChange}
    />
  );
}

/* PIN code with address lookup - `type: 'zip'`.

   f.fill maps what /api/pincode returns onto this form's own keys:
     fill: { city: 'billingCity', state: 'billingState',
             country: 'billingCountry', district: 'billingDistrict' }
   Only the keys listed in f.fill are written, so the Shipping block points the
   same control at its own four fields. Without f.fill this is a plain digits
   box and no lookup runs.

   Nothing is fetched until six digits are present, and the call is debounced,
   so typing "560001" fires one request rather than one per keystroke. */
function PincodeField({ f, value, onChange, patch }) {
  const [status, setStatus] = useState(null);
  const latest = useRef(0);

  const pin = String(value ?? '').trim();

  useEffect(() => {
    if (!f.fill) return;
    if (!/^\d{6}$/.test(pin)) { setStatus(null); return; }

    const ticket = ++latest.current;
    setStatus({ text: 'Looking up ' + pin + '…' });

    const t = setTimeout(() => {
      fetch('/api/pincode?pin=' + encodeURIComponent(pin))
        .then((r) => r.json())
        .then((d) => {
          /* a slow earlier request must not land on top of a newer one */
          if (ticket !== latest.current) return;
          if (!d.found) { setStatus({ err: true, text: d.reason || 'Not found.' }); return; }

          const next = {};
          Object.entries(f.fill).forEach(([from, key]) => {
            if (d[from]) next[key] = d[from];
          });
          patch(next);
          setStatus({ text: [d.district, d.state].filter(Boolean).join(', ') || 'Found' });
        })
        .catch(() => {
          if (ticket === latest.current) setStatus({ err: true, text: 'Lookup failed.' });
        });
    }, 450);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  return (
    <>
      <input
        type="text"
        inputMode="numeric"
        maxLength={6}
        className="f-input"
        value={value ?? ''}
        readOnly={!!f.readOnly}
        placeholder={f.placeholder || (f.ph ? f.label : '')}
        /* digits only - the lookup keys off exactly six of them */
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      />
      {/* `hideLookupText` drops the confirmatory line under the box - the
          resolved "SURAT, GUJARAT" and the "Looking up…" that precedes it - on
          forms where the City and State fields it filled already say the same
          thing. A failed lookup still speaks up either way: quietly filling
          nothing is the one outcome the operator has to be told about. */}
      {status && (status.err || !f.hideLookupText) && (
        <div className={'mt-1 text-[11.5px] ' + (status.err ? 'text-danger' : 'text-inkmuted')}>
          {status.text}
        </div>
      )}
    </>
  );
}

/* "Active" / "active" / "In-Active" -> one comparable word, so a badge's
   colour does not depend on the portal's capitalisation or hyphens. */
const squashWord = (v) => String(v ?? '').toLowerCase().replace(/[^a-z]/g, '');

export default function Field({ f, value, error, onChange, onOptionChange, selectedOption }) {
  /* Written as literal class strings: Tailwind scans source text, so a class
     assembled at runtime (`md:col-span-${n}`) would never be generated. */
  const SPAN = { 2: 'md:col-span-2', 3: 'md:col-span-2 xl:col-span-3', all: 'col-span-full' };
  /* f.row forces this field to open a new grid row instead of flowing on after
     the previous one. The Agent Basic tab needs it: Type sits alone above Short
     Name, which sits alone above the six-across name row, and none of those
     three rows fills its track count. */
  const span = (SPAN[f.span] || '') + (f.row ? ' xl:col-start-1' : '');
  const set = (v) => onChange(f.k, v);
  /* the PIN code lookup writes City / State / Country / District in one go.
     No parent had to change for this: every consumer of Field passes an
     onChange of (key, value) backed by a functional setState, so back-to-back
     calls merge instead of clobbering each other. */
  const patch = (obj) => Object.entries(obj).forEach(([k, v]) => onChange(k, v));

  let control = null;

  switch (f.type) {
    case 'textarea':
      control = (
        <textarea
          className="f-input f-textarea" value={value ?? ''}
          readOnly={!!f.readOnly} placeholder={f.placeholder || (f.ph ? f.label : '')}
          onChange={(e) => set(e.target.value)}
        />
      );
      break;

    case 'select':
      control = (
        <select className="f-input" value={value ?? ''} disabled={f.readOnly || f.disabled} onChange={(e) => set(e.target.value)}>
          <option value="">{f.placeholder || 'Select...'}</option>
          {(f.opts || []).map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
      );
      break;

    case 'radio':
      control = (
        <div className="f-radio-row">
          {(f.opts || []).map((o) => (
            <label key={o.v} className="f-radio">
              <input
                type="radio"
                name={f.name || f.k}
                checked={(value ?? '') === o.v}
                onChange={() => set(o.v)}
              />
              {o.l}
            </label>
          ))}
        </div>
      );
      break;

    case 'ref':
      control = <RefField f={f} value={value} onChange={set} onOptionChange={onOptionChange} selectedOption={selectedOption} />;
      break;

    case 'multiref':
      control = <RefField f={f} value={value} onChange={set} multi />;
      break;

    case 'checkref': {
      /* Dynamic options loaded from /api/options, displayed as checkboxes.
         Value is an array of ObjectId strings (same shape as multiref). */
      control = <CheckRefField f={f} value={value} onChange={set} />;
      break;
    }

    case 'zip':
      control = <PincodeField f={f} value={value} onChange={set} patch={patch} />;
      break;

    case 'city':
      control = <CityField f={f} value={value} onChange={set} />;
      break;

    case 'multicity':
      control = <CityField f={f} value={value} onChange={set} multi />;
      break;

    case 'date':
      if (f.displayFormat === 'DD/MM/YYYY') {
        const iso = value ? String(value).slice(0, 10) : '';
        const display = iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)
          ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4)
          : String(value || '');
        control = (
          <input
            type="text" inputMode="numeric" className="f-input" placeholder="DD/MM/YYYY"
            value={display}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^\d]/g, '').slice(0, 8);
              const shown = raw.length > 4 ? raw.slice(0, 2) + '/' + raw.slice(2, 4) + '/' + raw.slice(4) : raw;
              const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(shown);
              set(match ? match[3] + '-' + match[2] + '-' + match[1] : shown);
            }}
          />
        );
      } else {
        control = (
          <input
            type="date" className="f-input"
            value={value ? String(value).slice(0, 10) : ''}
            onChange={(e) => set(e.target.value)}
          />
        );
      }
      break;

    /* Date AND clock time in one native control - the browser renders the
       calendar and the time side by side, and both are editable.

       The stored value is an ISO timestamp in UTC, but datetime-local speaks
       local time, so it is converted on the way in rather than sliced: a
       naive String(value).slice(0, 16) would display a UTC clock and show
       the wrong time to everyone outside UTC. */
    case 'datetime': {
      const local = (v) => {
        if (!v) return '';
        const dt = new Date(v);
        if (Number.isNaN(dt.getTime())) return String(v).slice(0, 16);
        const p = (n) => String(n).padStart(2, '0');
        return dt.getFullYear() + '-' + p(dt.getMonth() + 1) + '-' + p(dt.getDate())
          + 'T' + p(dt.getHours()) + ':' + p(dt.getMinutes());
      };
      control = (
        <input
          type="datetime-local" className="f-input"
          value={local(value)}
          onChange={(e) => set(e.target.value)}
        />
      );
      break;
    }

    case 'number':
      control = (
        <input
          type="number" className="f-input" value={value ?? ''}
          onChange={(e) => set(e.target.value === '' ? '' : Number(e.target.value))}
          /* A number input listens for wheel scroll even without this being
             the field the cursor was aimed at reading, not typing into - so
             a scroll that was meant to move the page silently steps
             whichever number field the cursor happened to be over
             (Invoice Qty, Taxable, Freight, ...). Blurring on wheel does not
             call preventDefault, so the scroll still reaches the page
             normally; it just stops being interpreted as a step on this
             field. */
          onWheel={(e) => e.currentTarget.blur()}
        />
      );
      break;

    case 'file':
      control = <FileField f={f} value={value} onChange={set} />;
      break;

    case 'text':
      /* For vendorWaybill field, add barcode scanner */
      if (f.k === 'vendorWaybill') {
        const [showScanner, setShowScanner] = useState(false);
        control = (
          <div className="flex gap-2">
            <input
              type="text"
              className="f-input flex-1"
              value={value ?? ''}
              placeholder={f.placeholder || 'Enter waybill number or scan barcode'}
              onChange={(e) => set(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowScanner(true)}
            >
              SCAN
            </button>
            {showScanner && (
              <BarcodeScanner
                onScan={(scannedValue) => {
                  set(scannedValue);
                  setShowScanner(false);
                }}
                onClose={() => setShowScanner(false)}
              />
            )}
          </div>
        );
      } else {
        control = (
          <input
            type="text" className={'f-input' + (f.uppercase ? ' uppercase' : '')} value={value ?? ''}
            readOnly={!!f.readOnly} placeholder={f.placeholder || (f.ph ? f.label : '')}
            onChange={(e) => set(e.target.value)}
          />
        );
      }
      break;

    case 'checkgroup': {
      /* several fixed options, any number tickable - Freight, Auto Charges
         Mode and Tips Mode on the Transporter form */
      const picked = Array.isArray(value) ? value : [];
      control = (
        <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-md border border-linestrong bg-white px-3 py-2">
          {(f.opts || []).map((o) => (
            <label key={o.v} className="flex cursor-pointer items-center gap-1.5 text-[13px]">
              <input
                type="checkbox"
                checked={picked.includes(o.v)}
                onChange={() =>
                  set(picked.includes(o.v) ? picked.filter((x) => x !== o.v) : [...picked, o.v])
                }
              />
              {o.l}
            </label>
          ))}
        </div>
      );
      break;
    }

    case 'checkbox':
      control = (
        <label className="f-radio-row gap-2 text-[13.5px]">
          <input type="checkbox" checked={!!value} onChange={(e) => set(e.target.checked)} />
          {f.label}
        </label>
      );
      break;

    case 'password':
      control = (
        <input
          type="password" className="f-input" value={value ?? ''}
          placeholder={f.placeholder || (f.ph ? f.label : '')}
          onChange={(e) => set(e.target.value)}
        />
      );
      break;

    /* ----------------------------------------------------------------------
       Read-only pill.

       For a value the record carries but nobody types: the GST portal's own
       answer - Active, Regular, Yes, No. An input would invite editing it,
       and a hand-edited copy of a registration detail is worse than none, so
       this renders as text at input height and sits in the grid like any
       other field. Empty reads as a dash rather than as a blank cell, which
       is how it looks before a GST paste has filled anything in.

       The value still travels in the form state and the payload exactly as a
       text field's would - only the control is different.
       ---------------------------------------------------------------------- */
    case 'badge': {
      const shown = String(value ?? '').trim();
      const tone = squashWord(shown);
      const good = tone === 'active' || tone === 'yes';
      const bad = tone === 'no' || tone === 'cancelled' || tone === 'suspended'
        || tone === 'inactive' || tone === 'inactivepending';
      control = (
        <div className="flex h-9 items-center">
          {shown ? (
            <span
              className={
                'inline-flex items-center rounded-full px-2.5 py-1 text-[12.5px] font-bold '
                + (good ? 'bg-okgreenbg text-okgreen'
                  : bad ? 'bg-[#fdeceb] text-danger'
                    : 'bg-pillgrey text-cell')
              }
            >
              {shown}
            </span>
          ) : (
            <span className="text-[13.5px] text-inkmuted">&mdash;</span>
          )}
        </div>
      );
      break;
    }

    default:
      control = (
          <input
          type="text" className={'f-input' + (f.uppercase ? ' uppercase' : '')} value={value ?? ''}
          readOnly={!!f.readOnly} placeholder={f.placeholder || (f.ph ? f.label : '')}
          onChange={(e) => set(e.target.value)}
        />
      );
  }

  return (
    <div className={span}>
      <Label f={f} />
      {control}
      {error && <div className="f-err">{error}</div>}
    </div>
  );
}