'use client';
import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { compressImage } from '@/lib/imageFile';
import { barcodeImageProblem, BARCODE_IMAGE_ACCEPT, BARCODE_IMAGE_MESSAGES } from '@/lib/barcodeImage';

/* THE BARCODE IMAGE - picking, showing and uploading the picture of ONE
   barcode (lib/barcodeImage.js says where it is kept and why). Shared by
   Barcode Report -> Import (components/BarcodeReportImport.jsx) and the
   Barcode Report's Details screen (components/BarcodeDetailView.jsx), so both
   accept the same files and upload them the same way.

   A picture only ever comes in as a picture to STORE - it is never read by
   OCR (that is the Import dialog's own, separate screenshot input). */

/* Whether the browser can really decode it as an image */
function decodes(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img.naturalWidth > 0 && img.naturalHeight > 0); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(false); };
    img.src = url;
  });
}

/* A picked, pasted or dropped file -> { file } or { problem } - its type,
   extension and size (lib/barcodeImage.js), then whether it decodes. */
export async function checkBarcodeImage(file) {
  const problem = barcodeImageProblem(file);
  if (problem) return { problem };
  if (!(await decodes(file))) return { problem: BARCODE_IMAGE_MESSAGES.unreadable };
  return { file };
}

/* The picture through the app's own upload flow: downsized as every picture
   uploaded here is (lib/imageFile.js compressImage - at most 1600 px, about
   600 KB, JPEG), then POST /api/upload, which stores it and answers its URL.
   Resolves { url, name }; throws with the upload-failed message, so nothing
   goes on as if it had been uploaded. */
export async function uploadBarcodeImage(file) {
  let out;
  try {
    out = await compressImage(file);
  } catch (e) {
    throw new Error(`${BARCODE_IMAGE_MESSAGES.uploadFailed} ${e?.message || ''}`.trim());
  }
  const name = (String(file?.name || '').replace(/\.[^.]+$/, '') || 'barcode-image') + '.jpg';
  const body = new FormData();
  body.append('file', new File([out.blob], name, { type: out.type || 'image/jpeg' }));
  let res;
  try {
    res = await fetch('/api/upload', { method: 'POST', body });
  } catch {
    throw new Error(BARCODE_IMAGE_MESSAGES.uploadFailed);
  }
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.url) throw new Error(`${BARCODE_IMAGE_MESSAGES.uploadFailed}${d.error ? ` (${d.error})` : ''}`);
  return { url: d.url, name };
}

/* A barcode image, or why there is none - never a broken-image icon: a
   picture that fails to load says so in the same fixed box. */
export function BarcodeImageThumb({ src, alt = 'Barcode image', height = 160, emptyText = 'No barcode image available.', label = '', onClick = null }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  const shown = Boolean(src) && !failed;
  return (
    <div className="min-w-0">
      {label ? <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-inkmuted">{label}</div> : null}
      <div className="flex items-center justify-center overflow-hidden rounded border border-line bg-white px-2 text-center text-[12px] text-inkmuted" style={{ height }}>
        {shown
          ? (
            <img
              src={src}
              alt={alt}
              onError={() => setFailed(true)}
              className="max-h-full max-w-full object-contain cursor-pointer"
              onClick={onClick}
              title="Click to enlarge"
            />
          )
          : <span>{src ? 'The barcode image could not be loaded.' : emptyText}</span>}
      </div>
    </div>
  );
}

/* Upload / paste / drag & drop - one barcode image. `onPicked(file)` gets a
   checked file; nothing is uploaded here. Paste works with Ctrl+V anywhere in
   the box, right-click -> Paste in its paste field, or the Paste Image button
   (the browser may ask to allow the clipboard). */
export function BarcodeImageInput({ onPicked, disabled = false, uploadLabel = 'Upload Barcode Image', compact = false }) {
  const fileRef = useRef(null);
  const [error, setError] = useState('');
  const [over, setOver] = useState(false);

  const take = async (file) => {
    if (disabled) return;
    const checked = await checkBarcodeImage(file);
    if (checked.problem) { setError(checked.problem); return; }
    setError('');
    onPicked(checked.file);
  };
  /* a paste: an image on the clipboard is taken; anything else - text - is
     never taken for a barcode image */
  const onPaste = (event) => {
    event.stopPropagation();
    event.preventDefault();
    const files = [...(event.clipboardData?.files || [])].filter((f) => /^image\//i.test(f.type));
    if (!files.length) { setError(BARCODE_IMAGE_MESSAGES.notImage); return; }
    take(files[0]);
  };
  const pasteFromClipboard = async () => {
    if (disabled) return;
    if (!navigator.clipboard?.read) { setError(BARCODE_IMAGE_MESSAGES.clipboardBlocked); return; }
    try {
      for (const item of await navigator.clipboard.read()) {
        const type = item.types.find((t) => /^image\//i.test(t));
        if (!type) continue;
        const blob = await item.getType(type);
        const ext = type.split('/')[1] === 'jpeg' ? 'jpg' : type.split('/')[1];
        take(new File([blob], `pasted-barcode-image.${ext}`, { type }));
        return;
      }
      setError(BARCODE_IMAGE_MESSAGES.notImage);
    } catch {
      setError(BARCODE_IMAGE_MESSAGES.clipboardBlocked);
    }
  };

  return (
    <div
      className={'rounded border border-dashed px-3 text-center text-[12.5px] text-inkmuted '
        + (compact ? 'py-2 ' : 'py-3 ') + (over ? 'border-brand bg-[#eef4ff]' : 'border-linestrong bg-[#f7f9fc]')}
      aria-label="Barcode image drop zone"
      onPaste={onPaste}
      onDragOver={(e) => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); e.stopPropagation(); setOver(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(false); }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        const files = [...(e.dataTransfer?.files || [])];
        if (files.length) take(files[0]);
      }}
    >
      {!compact && <div className="mb-2">Drag &amp; Drop image here</div>}
      {!compact && <div className="mb-2 text-[11.5px] uppercase tracking-wide">or</div>}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button type="button" className="btn" onClick={() => fileRef.current?.click()} disabled={disabled}>
          <Icon name="upload" size={14} /> {uploadLabel}
        </button>
        <button type="button" className="btn" onClick={pasteFromClipboard} disabled={disabled}>
          <Icon name="image" size={14} /> Paste Image
        </button>
        <input ref={fileRef} type="file" accept={BARCODE_IMAGE_ACCEPT} className="hidden" aria-label="Barcode image file"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) take(f); }} />
      </div>
      <input
        value=""
        onChange={() => {}}
        onPaste={onPaste}
        disabled={disabled}
        aria-label="Paste barcode image here"
        placeholder="or click here and press Ctrl+V (or right-click -> Paste)"
        className="mt-2 w-full rounded border border-line bg-white px-2 py-1 text-center text-[12px]"
      />
      <div className="mt-1 text-[11px]">JPG, JPEG, PNG or WEBP, up to 10 MB.</div>
      {error && <div className="mt-2 rounded bg-[#fdecec] px-2 py-1 text-[12px] font-semibold text-danger" role="alert">{error}</div>}
    </div>
  );
}
