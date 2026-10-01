'use client';
import { useEffect, useState } from 'react';
import { useScope } from './ScopeContext';

/* Loads {value,label} options for a ref name. Hits /api/options, which maps
   the name to a model - no page registry involved. */

/* ==========================================================================
   Option lists are shared state.

   A quick-add dialog creates a record that every open dropdown for that ref
   should see straight away. Callers used to force this by changing the React
   `key` on the field so it remounted - but a remount only refires the fetch,
   and /api/options answers with no Cache-Control header at all, so the
   browser was free to serve the repeat GET from its own memory cache. The
   new record then did not appear until the page was reloaded.

   Two fixes, both needed: `cache: no-store` so the request actually
   reaches the server, and refreshOptions() so a create can tell every
   mounted dropdown to reload rather than relying on a remount.
   ========================================================================== */
const listeners = new Set();
const versions = new Map();

/* Call after creating a record of this ref type. */
export function refreshOptions(ref) {
  versions.set(ref, (versions.get(ref) || 0) + 1);
  listeners.forEach((fn) => fn());
}

export function useOptions(ref, query = '', enabled = true, params = null) {
  const { business, location } = useScope();
  /* Extra query params a caller needs on the options request - the Master
     Stock Report's supplier picker sends the chosen city. Carried through
     the effect as a STRING so it reruns when a value changes, not on the
     fresh object a caller builds every render. */
  const extra = params ? JSON.stringify(params) : '';
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  /* An empty list and a FAILED request are different things, and the picker
     was showing "No options" for both - so a dropdown that could not reach
     the server looked exactly like a company with no suppliers. The caller
     needs to be able to tell them apart and say so. */
  const [error, setError] = useState('');
  const [version, setVersion] = useState(() => versions.get(ref) || 0);

  useEffect(() => {
    const onBump = () => setVersion(versions.get(ref) || 0);
    listeners.add(onBump);
    return () => { listeners.delete(onBump); };
  }, [ref]);

  useEffect(() => {
    if (!ref || !enabled) {
      setOptions([]);
      setLoading(false);
      setError('');
      return undefined;
    }
    let off = false;
    setLoading(true);
    setError('');

    const qs = new URLSearchParams({ ref, business: business || '', location: location || '', q: query });
    if (extra) {
      Object.entries(JSON.parse(extra)).forEach(([k, v]) => {
        if (v !== undefined && v !== null && String(v) !== '') qs.set(k, String(v));
      });
    }
    fetch('/api/options?' + qs, { cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || 'Request failed');
        return d;
      })
      .then((d) => { if (!off) setOptions(d.options || []); })
      .catch(() => {
        if (off) return;
        setOptions([]);
        setError('Unable to load the list. Check your connection and try again.');
      })
      .finally(() => { if (!off) setLoading(false); });

    /* a scope change mid-flight must not let the old list land last */
    return () => { off = true; };
  }, [ref, business, location, query, version, enabled, extra]);

  return { options, loading, error };
}

export function useCities(term) {
  const [options, setOptions] = useState([]);

  useEffect(() => {
    const qs = new URLSearchParams({ q: term || '' });
    fetch('/api/cities?' + qs)
      .then((r) => r.json())
      .then((d) => setOptions(d.options || []))
      .catch(() => setOptions([]));
  }, [term]);

  return options;
}
