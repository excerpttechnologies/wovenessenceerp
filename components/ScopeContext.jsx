// 'use client';
// import { createContext, useContext, useEffect, useState } from 'react';

// /* The three top-bar selectors scope every query in the app:
//    business -> location -> financial year. */
// const ScopeContext = createContext(null);

// export const FIN_YEARS = ['2026-2027', '2025-2026', '2024-2025', '2023-2024'];

// export function ScopeProvider({ children }) {
//   const [businesses, setBusinesses] = useState([]);
//   const [locations, setLocations] = useState([]);
//   const [business, setBusiness] = useState('');
//   const [location, setLocation] = useState('');
//   const [finYear, setFinYear] = useState(FIN_YEARS[0]);
//   const [user, setUser] = useState(null);

//   useEffect(() => {
//     fetch('/api/auth/me')
//       .then((r) => (r.ok ? r.json() : { user: null }))
//       .then((d) => setUser(d.user))
//       .catch(() => {});
//   }, []);

//   useEffect(() => {
//     fetch('/api/options?ref=business')
//       .then((r) => r.json())
//       .then((d) => {
//         const list = d.options || [];
//         setBusinesses(list);
//         const saved = localStorage.getItem('orbit.business');
//         const pick = list.find((o) => o.value === saved) ? saved : list[0]?.value || '';
//         setBusiness(pick);
//       })
//       .catch(() => {});
//   }, []);

//   useEffect(() => {
//     if (!business) { setLocations([]); setLocation(''); return; }
//     localStorage.setItem('orbit.business', business);
//     fetch('/api/options?ref=companylocations&business=' + business)
//       .then((r) => r.json())
//       .then((d) => {
//         const list = d.options || [];
//         setLocations(list);
//         const saved = localStorage.getItem('orbit.location');
//         const pick = list.find((o) => o.value === saved) ? saved : list[0]?.value || '';
//         setLocation(pick);
//       })
//       .catch(() => {});
//   }, [business]);

//   useEffect(() => { if (location) localStorage.setItem('orbit.location', location); }, [location]);

//   const value = {
//     user,
//     businesses, locations, business, location, finYear,
//     setBusiness, setLocation, setFinYear,
//     // appended to every list/save request
//     query: () => new URLSearchParams({ business, location, finYear }).toString(),
//   };
//   return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>;
// }

// export function useScope() {
//   const ctx = useContext(ScopeContext);
//   if (!ctx) throw new Error('useScope must be used inside <ScopeProvider>');
//   return ctx;
// }












'use client';
import { createContext, useContext, useEffect, useState } from 'react';

/* The three top-bar selectors scope every query in the app:
   business -> location -> financial year. */
const ScopeContext = createContext(null);

export const FIN_YEARS = ['2026-2027', '2025-2026', '2024-2025', '2023-2024'];

/* Both selections are remembered by _id, never by name or list position: two
   branches can share a name and the list order shifts as branches are added
   or renamed, so anything but the id eventually resolves to the wrong row.
   Location is keyed per business - a location exists only inside one branch,
   and a single shared key meant switching branch overwrote the location the
   previous branch had been left on. */
const BUSINESS_KEY = 'orbit.business';
const locationKey = (businessId) => 'orbit.location.' + businessId;

export function ScopeProvider({ children }) {
  const [businesses, setBusinesses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [business, setBusiness] = useState('');
  const [location, setLocation] = useState('');
  const [finYear, setFinYear] = useState(FIN_YEARS[0]);
  const [user, setUser] = useState(null);

  /* Both selectors are filled in from /api/options one tick after mount, so
     `business` and `location` are '' on the first render of every screen.
     A consumer cannot tell that empty-because-still-loading apart from
     empty-because-there-is-none, and the two mean opposite things: the first
     must not be queried with, the second is a final answer. `businessReady`
     flips once /api/options?ref=business has settled (resolved or failed).

     Location is tracked as "which business the current location belongs to"
     rather than a plain boolean. A boolean set inside the effect is still
     true for the OLD business during the render that follows a business
     change - the effect has not run yet - and a consumer reading it then
     fires a request with a location that no longer applies. Comparing against
     `business` is correct on that very first render. */
  /* What this account's role may do, for hiding controls it cannot use.
     `governed:false` (nobody has customised the role, or the request failed)
     means show everything - the pre-permissions behaviour. The server checks
     every request regardless, so a stale or missing answer here is a cosmetic
     problem, never a security one. */
  const [perms, setPerms] = useState({ governed: false, screens: {} });

  const [businessReady, setBusinessReady] = useState(false);
  const [locationsFor, setLocationsFor] = useState(null);
  const locationReady = locationsFor === business;

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => setUser(d.user))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/options?ref=business')
      .then((r) => r.json())
      .then((d) => {
        const list = d.options || [];
        setBusinesses(list);
        /* The branch the operator last selected wins, looked up by id in
           the list that just came back. This provider is mounted by the
           /admin layout, so it remounts on every hard load - a refresh, or
           the redirect out of /login - and with no restore step each of those
           silently re-selected the main branch. Switching to any other branch
           therefore looked like it reverted on its own.

           Only then the main branch: /api/options flags it with isDefault and
           sorts it first, which is the right landing place on a first visit.
           list[0] is the last resort, for a database where no branch carries
           the flag. */
        const saved = localStorage.getItem(BUSINESS_KEY);
        const remembered = list.find((o) => o.value === saved)?.value;
        const main = list.find((o) => o.isDefault);
        setBusiness(remembered || main?.value || list[0]?.value || '');
      })
      .catch(() => {})
      .finally(() => setBusinessReady(true));
  }, []);

  useEffect(() => {
    if (!business) { setLocations([]); setLocation(''); setLocationsFor(business); return; }
    fetch('/api/options?ref=companylocations&business=' + business)
      .then((r) => r.json())
      .then((d) => {
        const list = d.options || [];
        setLocations(list);
        const saved = localStorage.getItem(locationKey(business));
        
        /* Auto-select TEMPLE FABRICS WAREHOUSE on first load, but allow
           switching to other locations. The saved location is restored if
           it exists in the current business's location list. Otherwise,
           default to TEMPLE FABRICS WAREHOUSE if available, or fall back
           to the first location. */
        let pick = '';
        if (saved && list.find((o) => o.value === saved)) {
          pick = saved;
        } else {
          const warehouse = list.find((o) => 
            o.label && o.label.toUpperCase().includes('TEMPLE FABRICS WAREHOUSE')
          );
          pick = warehouse?.value || list[0]?.value || '';
        }
        setLocation(pick);
      })
      .catch(() => {})
      .finally(() => setLocationsFor(business));
  }, [business]);

  /* Re-read on every business change: permissions are stored per business,
       so the same role can be allowed more in one branch than another. */
  useEffect(() => {
    if (!businessReady) return undefined;
    let cancelled = false;
    fetch('/api/my-permissions?business=' + (business || ''), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { governed: false, screens: {} }))
      .then((d) => { if (!cancelled) setPerms(d || { governed: false, screens: {} }); })
      .catch(() => { if (!cancelled) setPerms({ governed: false, screens: {} }); });
    return () => { cancelled = true; };
  }, [business, businessReady]);

  useEffect(() => { if (business) localStorage.setItem(BUSINESS_KEY, business); }, [business]);

  /* Only once the list for THIS business has settled. On the render right
     after a branch change `location` still holds the previous branch's value,
     and writing that under the new branch's key would remember a location
     that does not belong to it. */
  useEffect(() => {
    if (business && location && locationsFor === business) {
      localStorage.setItem(locationKey(business), location);
    }
  }, [business, location, locationsFor]);

  /* May this account do `action` on `screen`?

     Answers TRUE whenever it does not positively know otherwise - an
     ungoverned role, a screen nobody has wired, a failed request. Hiding a
     control the operator is actually allowed to use is the worse mistake:
     the button going missing looks like a bug, while a button that turns out
     to be refused at least explains itself. */
  const can = (screen, action) => {
    if (!perms.governed) return true;
    if (!screen) return true;
    const held = perms.screens?.[screen];
    return Array.isArray(held) && held.includes(action);
  };

  const value = {
    user,
    businesses, locations, business, location, finYear,
    businessReady, locationReady,
    setBusiness, setLocation, setFinYear,
    perms, can,
    // appended to every list/save request
    query: () => new URLSearchParams({ business, location, finYear }).toString(),
  };
  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>;
}

export function useScope() {
  const ctx = useContext(ScopeContext);
  if (!ctx) throw new Error('useScope must be used inside <ScopeProvider>');
  return ctx;
}