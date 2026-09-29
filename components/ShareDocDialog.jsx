'use client';
import { useEffect, useState } from 'react';
import Icon from './Icon';

/* ==========================================================================
   SHARE ONE DOCUMENT - WhatsApp, Email, Download, Print.

   Opened from the Share button in a list's Action column, and always about
   the ONE record whose button was pressed: every field it shows and every
   message it composes is built by the caller from that row, and nothing here
   holds a record number, an id or an address of its own.

   WHAT EACH ROUTE HONESTLY DOES
     WhatsApp  wa.me with the message text. On a phone that hands off to the
               WhatsApp app, on a desktop to WhatsApp Web. A local file on
               localhost CANNOT be attached to it - there is no public URL to
               give WhatsApp - so the message carries the document's DETAILS
               and the operator attaches the downloaded file themselves if
               they want the sheet as well. Nothing here pretends otherwise.
     Email     mailto:, with the subject and the same details in the body.
               This application has no mail backend (no nodemailer, no send
               service anywhere in the repo), so there is nothing to attach
               through and no attachment is faked.
     Download  the browser's own print-to-PDF over the record's preview -
               which IS this application's existing download mechanism, the
               one the preview's "Download / Print" button already uses. The
               caller sets the document title so the suggested filename is
               the record's own number.
     Print     the same preview through the browser's print dialog.
     Instagram (only when the caller asks for it with `instagram`) Instagram
               has NO link that pre-fills a message, on the web or in the
               app. So on a phone the system share sheet is opened, where
               Instagram is one of the targets; elsewhere the message is
               copied and Instagram Direct opened, for the operator to paste.

   Download and Print show only when the caller passes a handler for them.

   Copy message is the fallback for a blocked popup or a machine with no
   WhatsApp: the text is the same one the other two routes send.
   ========================================================================== */
/* Declared HERE, not inside the component: a component redefined on every
   render is a NEW TYPE each time, so React unmounts and remounts all four
   buttons and anything holding keyboard focus loses it. */
function Row({ icon, label, hint, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[52px] w-full items-center gap-3 rounded-lg border border-gray-300 px-4 py-3 text-left hover:border-brand hover:bg-[#f5f8fd]"
    >
      <Icon name={icon} size={20} />
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-[11px] text-gray-500">{hint}</span>}
      </span>
    </button>
  );
}

export default function ShareDocDialog({
  open,
  heading = 'Share',
  /* "GRT No: TFJ/26/0131" - shown at the top so the operator can see WHICH
     record is about to be sent before they send it */
  recordLabel = '',
  subject = '',
  /* ['GRT No: ...', 'GRT Date: ...', ...] - the message body, built by the
     caller from the row */
  lines = [],
  onDownload,
  onPrint,
  onClose,
  /* opt-in: a screen that wants the Instagram route passes true */
  instagram = false,
}) {
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    setError('');
    setNotice('');
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  const message = [subject, '', ...lines].filter((l) => l !== undefined && l !== null).join('\n');

  function whatsapp() {
    setError('');
    setNotice('');
    try {
      /* wa.me is the one link that works in both places: the app on a phone,
         WhatsApp Web on a desktop. It needs no number - WhatsApp asks the
         sender who to send it to. */
      /* NO `noopener` IN THE FEATURES STRING. window.open returns NULL by
         specification whenever noopener is set, so testing the return value
         for "was it blocked?" reported a blocked popup on every SUCCESSFUL
         click. The opener is severed with win.opener = null instead, which
         gives the same protection and still lets the result be tested. */
      const win = window.open('https://wa.me/?text=' + encodeURIComponent(message), '_blank');
      if (!win) {
        setError('Your browser blocked the WhatsApp window. Allow pop-ups for this site, or use Copy message below and paste it into WhatsApp.');
        return;
      }
      try { win.opener = null; } catch { /* cross-origin once it navigates */ }
      setNotice('WhatsApp opened. The document itself is not attached - download it and attach it there if you need the full sheet.');
    } catch {
      setError('Could not open WhatsApp. Use Copy message below and paste it into WhatsApp.');
    }
  }

  function email() {
    setError('');
    setNotice('');
    try {
      window.location.href = 'mailto:?subject=' + encodeURIComponent(subject)
        + '&body=' + encodeURIComponent(lines.join('\n'));
      /* mailto: does NOTHING when no handler is registered and the page
         simply stays put, so success is never asserted. If we are still here
         and visible a moment later, say what to do instead. */
      const before = Date.now();
      window.setTimeout(() => {
        if (Date.now() - before < 60000 && document.visibilityState === 'visible') {
          setNotice('If no mail window opened, no mail app is set up on this machine - use Copy message below.');
        }
      }, 1200);
    } catch {
      setError('Could not open your mail app. Use Copy message below instead.');
    }
  }

  async function instagramShare() {
    setError('');
    setNotice('');
    /* a phone: the system share sheet lists Instagram among its targets */
    if (typeof navigator !== 'undefined' && navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent || '')) {
      try {
        await navigator.share({ title: subject, text: message });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;   // the operator closed the sheet
      }
    }
    /* a desktop: copy, then open Direct for pasting */
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      setError('Could not copy the message - open "Message being sent" below and copy it, then paste it into Instagram.');
      return;
    }
    const win = window.open('https://www.instagram.com/direct/inbox/', '_blank');
    if (win) { try { win.opener = null; } catch { /* cross-origin */ } }
    setNotice(win
      ? 'Message copied. Instagram opened - pick the person and paste it (Ctrl+V).'
      : 'Message copied. Open Instagram and paste it into the chat (Ctrl+V).');
  }

  async function copyMessage() {
    setError('');
    try {
      await navigator.clipboard.writeText(message);
      setNotice('Message copied.');
    } catch {
      setError('Could not copy automatically - select the text above and copy it.');
    }
  }

  return (
    <div
      className="no-print fixed inset-0 z-[95] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-doc-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      {/* full-width sheet on a phone, centred card from sm up; every control
          is at least 38px tall for a finger */}
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-xl bg-white shadow-xl sm:max-h-[88vh] sm:max-w-[440px] sm:rounded-lg">
        <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3">
          <h3 id="share-doc-title" className="text-base font-semibold sm:text-lg">{heading}</h3>
          <button type="button" onClick={() => onClose?.()} className="flex h-[38px] w-[38px] items-center justify-center text-2xl leading-none text-gray-500" aria-label="Close">&times;</button>
        </div>

        <div className="px-4 py-4">
          {recordLabel && (
            <p className="mb-3 truncate text-sm font-semibold text-gray-700">{recordLabel}</p>
          )}
          {error && <div className="flash flash-err mb-3">{error}</div>}
          {notice && !error && <div className="flash flash-ok mb-3">{notice}</div>}

          <div className="grid gap-2.5">
            <Row icon="share" label="WhatsApp" hint="Opens WhatsApp with the document details" onClick={whatsapp} />
            <Row icon="mail" label="Email" hint="Opens your mail app with the details in the body" onClick={email} />
            {/* Download and Print are ONE action - the browser's print dialog
                is this application's only document output. "Save as PDF" in
                it is the download; a printer is the print. The hints say that
                rather than promising a file the code cannot produce. */}
            {instagram && <Row icon="instagram" label="Instagram" hint="Copies the details and opens Instagram to paste them" onClick={instagramShare} />}
            {onDownload && <Row icon="save" label="Download" hint={'Opens the print dialog - choose "Save as PDF"'} onClick={() => { onClose?.(); onDownload?.(); }} />}
            {onPrint && <Row icon="printer" label="Print" hint="Opens the print dialog - choose your printer" onClick={() => { onClose?.(); onPrint?.(); }} />}
          </div>

          <details className="mt-4">
            <summary className="cursor-pointer text-[12px] font-semibold text-brand-link">Message being sent</summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded border border-gray-200 bg-[#f8fafc] p-2 text-[11px] normal-case text-gray-700">{message}</pre>
            <button type="button" className="btn mt-2 min-h-[38px] w-full justify-center" onClick={copyMessage}>
              Copy message
            </button>
          </details>
        </div>

        <div className="sticky bottom-0 flex justify-end border-t border-gray-200 bg-white px-4 py-3">
          <button type="button" className="btn min-h-[38px]" onClick={() => onClose?.()}>Close</button>
        </div>
      </div>
    </div>
  );
}
