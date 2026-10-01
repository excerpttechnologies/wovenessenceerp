'use client';
import { useEffect, useRef } from 'react';
import Icon from './Icon';

/* Barcode Report -> Import -> the search button (top right of the Import
   Barcodes dialog, components/BarcodeReportImport.jsx): which ERP's Barcode
   Report to open, to copy from and paste back into the dialog.

   Both are OTHER systems' Barcode Report pages, not this one - so each choice
   is a plain link to it, opened in a new tab: target=_blank, rel=noopener
   noreferrer, so the other site gets no handle on this tab. Nothing goes
   through this app's router, and the Import dialog stays open behind the
   popup (z-[90], over the dialog's z-[80]).

   Keyboard: the first choice takes focus when it opens, Tab / Shift+Tab stay
   inside it, Escape closes it, and focus goes back to what opened it. */

/* fixed destinations, exactly as given */
export const ERP_BARCODE_REPORTS = [
  { key: 'v0', label: 'ERP V0', url: 'https://tmplfbrcs654165.orbiteerp.com/reports/barcode-report' },
  { key: 'v1', label: 'ERP V1', url: 'https://erp.orbiteerp.com/admin/reports/barcode-report' },
];

const hostOf = (url) => { try { return new URL(url).host; } catch { return url; } };

export default function ErpSelectorModal({ open, onClose }) {
  const box = useRef(null);
  const firstChoice = useRef(null);
  /* the latest onClose, without re-running the open/close effect (and so
     moving focus) every time the page re-renders */
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    firstChoice.current?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current?.(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus();
    };
  }, [open]);

  if (!open) return null;

  /* Tab past the last control comes back to the first, and the other way */
  const keepFocusInside = (event) => {
    if (event.key !== 'Tab' || !box.current) return;
    const items = [...box.current.querySelectorAll('a[href], button:not([disabled])')];
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby="erp-select-title"
        aria-describedby="erp-select-hint"
        onKeyDown={keepFocusInside}
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-[460px] flex-col overflow-y-auto rounded-lg bg-white shadow-xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-3">
          <h2 id="erp-select-title" className="text-[15px] font-bold uppercase tracking-wide">Select ERP</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded text-2xl leading-none text-inkmuted hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4">
          <p id="erp-select-hint" className="mb-4 text-center text-[13px] text-inkmuted">Select Barcode Report ERP</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ERP_BARCODE_REPORTS.map((erp, i) => (
              <a
                key={erp.key}
                ref={i === 0 ? firstChoice : undefined}
                href={erp.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${erp.label} - open its Barcode Report (${hostOf(erp.url)}) in a new tab`}
                /* closed once the click has opened the tab */
                onClick={() => { window.setTimeout(() => close.current?.(), 0); }}
                className="flex flex-col items-center gap-2 rounded-lg border-2 border-line bg-white px-4 py-5 text-center text-ink transition-colors hover:border-brand hover:bg-[#eef4ff] focus:outline-none focus-visible:border-brand focus-visible:bg-[#eef4ff] focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#eef4ff] text-brand">
                  <Icon name="barcode" size={22} />
                </span>
                <span className="text-[16px] font-bold">{erp.label}</span>
                <span className="break-all text-[11px] text-inkmuted">{hostOf(erp.url)}</span>
              </a>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 justify-center border-t border-line px-5 py-3">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
