/* The share routes - WhatsApp, Email, Instagram - as plain browser actions.

   Used by components/ShareDocDialog.jsx (the Share panel) and by any screen
   that puts the routes on buttons of its own (View POS), so there is one
   definition of what each route does. Client-side only: every function uses
   window / navigator and is called from a click handler.

   Each returns { error } or { notice } - a sentence for the operator, or
   nothing - rather than showing anything itself.

   WHAT EACH ROUTE HONESTLY DOES
     WhatsApp   wa.me with the text: the app on a phone, WhatsApp Web on a
                desktop. No number is needed - WhatsApp asks who to send to.
                No file is attached; there is no public URL to give it.
     Email      mailto: with the subject and body. There is no mail backend
                in this app, so nothing is attached.
     Instagram  Instagram has NO link that pre-fills a message. On a phone
                the system share sheet is opened (Instagram is one of its
                targets); elsewhere the text is copied and Instagram Direct
                opened, for the operator to paste. */

export function shareWhatsApp(message) {
  try {
    /* no `noopener` in the features string: window.open returns null when it
       is set, which would report every successful open as blocked. The
       opener is severed by hand instead. */
    const win = window.open('https://wa.me/?text=' + encodeURIComponent(message), '_blank');
    if (!win) {
      return { error: 'Your browser blocked the WhatsApp window. Allow pop-ups for this site and try again.' };
    }
    try { win.opener = null; } catch { /* cross-origin once it navigates */ }
    return { notice: 'WhatsApp opened - pick the contact and send.' };
  } catch {
    return { error: 'Could not open WhatsApp.' };
  }
}

export function shareEmail(subject, body) {
  try {
    window.location.href = 'mailto:?subject=' + encodeURIComponent(subject || '')
      + '&body=' + encodeURIComponent(body || '');
    /* mailto: does nothing at all when no mail app is registered, so success
       is never claimed - only a hint for that case */
    return { notice: 'If no mail window opened, no mail app is set up on this machine.' };
  } catch {
    return { error: 'Could not open your mail app.' };
  }
}

export async function shareInstagram(subject, message) {
  /* a phone: the system share sheet lists Instagram among its targets */
  if (typeof navigator !== 'undefined' && navigator.share
    && /Android|iPhone|iPad/i.test(navigator.userAgent || '')) {
    try {
      await navigator.share({ title: subject, text: message });
      return {};
    } catch (e) {
      if (e && e.name === 'AbortError') return {};   // the operator closed the sheet
    }
  }
  /* a desktop: copy, then open Direct for pasting */
  try {
    await navigator.clipboard.writeText(message);
  } catch {
    return { error: 'Could not copy the message for Instagram.' };
  }
  const win = window.open('https://www.instagram.com/direct/inbox/', '_blank');
  if (win) { try { win.opener = null; } catch { /* cross-origin */ } }
  return {
    notice: win
      ? 'Message copied. Instagram opened - pick the person and paste it (Ctrl+V).'
      : 'Message copied. Open Instagram and paste it into the chat (Ctrl+V).',
  };
}
