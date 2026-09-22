'use client';
import { useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import {
  ROLES, ACTIONS, RESOURCES, DEFAULT_MATRIX, SAMPLE_USERS, STATUSES, STATUS_TONE,
  isLockedRole, appliesTo, grantedCount, TOTAL_GRANTS, initialsOf,
} from './fields';

/* Staff Management -> Roles & Permissions.

   Who can sign in, and what each role may do. Three tabs on one screen:

     Users        every account, its role and the branch it is scoped to
     Roles        the five roles, what each is for, and how far it reaches
     Permissions  the matrix - one row per module, one column per action

   FRONTEND ONLY. There is no API behind this yet: the rows come from
   ./fields.js and every edit lives in React state until the page is
   reloaded. That is deliberate and it is said on screen rather than left for
   somebody to discover by saving and refreshing - a screen that looks like it
   persisted something it did not is worse than one that admits it cannot.

   Not a ListView. Three tabs, a matrix of checkboxes and a dialog are none of
   the things ListView does, and bending the component 55 other screens depend
   on to fit one page is the worse trade - the same call
   receivedeliverychallan made. It does borrow ListView's look: the same .dt
   table, .pill badges and .btn buttons, so it does not read as a screen from
   a different application.

   The matrix is seeded from what lib/rbac.js ROLE_PERMISSIONS actually allows
   today, so it opens on the system's real posture. See ./fields.js. */

const TABS = [['users', 'Users'], ['roles', 'Roles'], ['permissions', 'Permissions']];

const EMPTY_INVITE = { name: '', email: '', role: 'Cashier', scope: '' };

export default function RolesPermissionsPage() {
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState(SAMPLE_USERS);
  const [matrix, setMatrix] = useState(DEFAULT_MATRIX);
  const [role, setRole] = useState('Location Manager');
  const [search, setSearch] = useState('');
  const [flash, setFlash] = useState(null);

  /* invite dialog */
  const [inviting, setInviting] = useState(false);
  const [invite, setInvite] = useState(EMPTY_INVITE);
  const [inviteErrors, setInviteErrors] = useState({});

  const locked = isLockedRole(role);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => (u.name + ' ' + u.email + ' ' + u.role + ' ' + u.scope)
      .toLowerCase().includes(q));
  }, [users, search]);

  /* How many accounts hold each role - the figure on the Roles tab. */
  const usersPerRole = useMemo(() => {
    const out = {};
    users.forEach((u) => { out[u.role] = (out[u.role] || 0) + 1; });
    return out;
  }, [users]);

  function toggle(resourceKey, actionKey) {
    if (locked) return;
    setMatrix((cur) => {
      const held = cur[role] || {};
      const row = held[resourceKey] || {};
      return {
        ...cur,
        [role]: { ...held, [resourceKey]: { ...row, [actionKey]: !row[actionKey] } },
      };
    });
  }

  function resetRole() {
    setMatrix((cur) => ({ ...cur, [role]: DEFAULT_MATRIX[role] }));
    setFlash({ type: 'ok', msg: role + ' reset to its default permissions.' });
  }

  /* The one place this screen is honest about not being finished. */
  function save() {
    setFlash({
      type: 'err',
      msg: 'Not saved - there is no API behind this screen yet. The changes are on screen only and go when the page reloads.',
    });
  }

  function submitInvite() {
    const errs = {};
    if (!invite.name.trim()) errs.name = 'Name is required';
    if (!invite.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invite.email.trim())) errs.email = 'That is not an email address';
    if (users.some((u) => u.email.toLowerCase() === invite.email.trim().toLowerCase())) {
      errs.email = 'That email already has an account';
    }
    setInviteErrors(errs);
    if (Object.keys(errs).length) return;

    setUsers((cur) => [...cur, {
      _id: 'new-' + Date.now(),
      name: invite.name.trim(),
      email: invite.email.trim(),
      role: invite.role,
      scope: invite.scope.trim() || 'Not set',
      status: 'Invited',
      lastActive: 'Never',
    }]);
    setInviting(false);
    setInvite(EMPTY_INVITE);
    setInviteErrors({});
    setFlash({ type: 'ok', msg: 'Added to the list on screen. No invitation was sent - the API is not built yet.' });
  }

  function setUserField(id, key, value) {
    setUsers((cur) => cur.map((u) => (u._id === id ? { ...u, [key]: value } : u)));
  }

  return (
    <div className="card p-4">
      <div className="mb-1 flex flex-wrap items-center gap-3 border-b border-line pb-3">
        <div>
          <div className="card-title">Users &amp; roles</div>
          <div className="text-[12px] text-inkmuted">Who can sign in, and what each role may do</div>
        </div>
        <span className="flex-1" />
        <button type="button" className="btn btn-primary" onClick={() => setInviting(true)}>
          <Icon name="plus" size={14} /> Invite user
        </button>
      </div>

      {/* Said once, at the top, rather than implied by a Save button that
          quietly does nothing. */}
      <div className="note-box mt-3 text-[12px]">
        <b>Preview only.</b> This screen is not connected yet - the users and the
        matrix come from <code>fields.js</code>, and anything changed here is kept in the
        browser until the page reloads. The permissions shown are the ones
        <code> lib/rbac.js</code> enforces today.
      </div>

      {flash && (
        <div className={'mt-3 rounded border px-3 py-2 text-[13px] '
          + (flash.type === 'ok'
            ? 'border-green-300 bg-green-50 text-green-800'
            : 'border-danger bg-[#fdf1f1] text-danger')}
        >
          {flash.msg}
        </div>
      )}

      <div className="mb-3 mt-3 flex gap-2">
        {TABS.map(([key, text]) => (
          <button
            key={key}
            type="button"
            className={'btn h-8 px-3 text-[12px] ' + (tab === key ? 'btn-primary' : '')}
            onClick={() => { setTab(key); setFlash(null); }}
          >
            {text}
          </button>
        ))}
      </div>

      {/* ======================================================== USERS ==== */}
      {tab === 'users' && (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <input
              className="f-input h-8 w-full max-w-[320px]"
              placeholder="Search name, email, role or branch"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="flex-1" />
            <span className="text-[12px] text-inkmuted">
              {shown.length} of {users.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="dt">
              <thead>
                <tr>
                  <th>#</th>
                  <th>User</th>
                  <th>Role</th>
                  <th>Scope</th>
                  <th>Status</th>
                  <th className="whitespace-nowrap">Last active</th>
                </tr>
              </thead>
              <tbody>
                {!shown.length && (
                  <tr><td colSpan={6} className="dt-empty">
                    {users.length ? 'No user matches that search.' : 'No users yet.'}
                  </td></tr>
                )}

                {shown.map((u, i) => {
                  const tone = ROLES.find((r) => r.k === u.role)?.tone || 'pill-grey';
                  return (
                    <tr key={u._id}>
                      <td className="text-center">{i + 1}</td>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pillgrey text-[11px] font-semibold text-cell">
                            {initialsOf(u.name)}
                          </span>
                          <span>
                            <div className="font-semibold">{u.name}</div>
                            <div className="text-[11px] normal-case text-inkmuted">{u.email}</div>
                          </span>
                        </div>
                      </td>
                      <td>
                        {/* Editable here so the tab is useful to look at, and
                            because changing somebody's role is the single most
                            common thing done on a screen like this. */}
                        <select
                          className="f-input h-7 w-[170px] text-[12px]"
                          value={u.role}
                          onChange={(e) => setUserField(u._id, 'role', e.target.value)}
                        >
                          {ROLES.map((r) => <option key={r.k} value={r.k}>{r.label}</option>)}
                        </select>
                        <span className={'pill ' + tone + ' ml-2 align-middle'}>
                          {grantedCount(matrix, u.role)}/{TOTAL_GRANTS}
                        </span>
                      </td>
                      <td>{u.scope}</td>
                      <td>
                        <select
                          className="f-input h-7 w-[120px] text-[12px]"
                          value={u.status}
                          onChange={(e) => setUserField(u._id, 'status', e.target.value)}
                        >
                          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="whitespace-nowrap">
                        <span className={'pill ' + (STATUS_TONE[u.status] || 'pill-grey')}>
                          {u.lastActive}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ======================================================== ROLES ==== */}
      {tab === 'roles' && (
        <div className="overflow-x-auto">
          <table className="dt">
            <thead>
              <tr>
                <th>#</th>
                <th>Role</th>
                <th>What it is for</th>
                <th className="text-center">Users</th>
                <th className="whitespace-nowrap text-center">Reach</th>
                <th>Permissions</th>
              </tr>
            </thead>
            <tbody>
              {ROLES.map((r, i) => {
                const held = grantedCount(matrix, r.k);
                const pct = Math.round((held / TOTAL_GRANTS) * 100);
                return (
                  <tr key={r.k}>
                    <td className="text-center">{i + 1}</td>
                    <td className="whitespace-nowrap">
                      <span className={'pill ' + r.tone}>{r.label}</span>
                      {r.locked && (
                        <div className="mt-1 text-[11px] text-inkmuted">unrestricted</div>
                      )}
                    </td>
                    <td className="normal-case">{r.description}</td>
                    <td className="text-center">{usersPerRole[r.k] || 0}</td>
                    <td className="whitespace-nowrap text-center">
                      <div>{held} / {TOTAL_GRANTS}</div>
                      {/* a bar reads faster than the fraction alone */}
                      <div className="mx-auto mt-1 h-1.5 w-24 rounded bg-pillgrey">
                        <div
                          className="h-1.5 rounded bg-brand"
                          style={{ width: pct + '%' }}
                        />
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn h-7 px-3 text-[12px]"
                        onClick={() => { setRole(r.k); setTab('permissions'); setFlash(null); }}
                      >
                        <Icon name="eye" size={12} /> Open matrix
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ================================================== PERMISSIONS ==== */}
      {tab === 'permissions' && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div>
              <div className="text-[15px] font-bold">Permission matrix</div>
              <div className="text-[12px] text-inkmuted">
                {locked
                  ? 'This role is unrestricted - every permission is held and none can be withdrawn.'
                  : 'A dash means the action does not apply to that module, not that it is withheld.'}
              </div>
            </div>
            <span className="flex-1" />
            <select
              className="f-input h-8 w-[200px]"
              value={role}
              onChange={(e) => { setRole(e.target.value); setFlash(null); }}
            >
              {ROLES.map((r) => <option key={r.k} value={r.k}>{r.label}</option>)}
            </select>
            <button type="button" className="btn h-8 px-3 text-[12px]" disabled={locked} onClick={resetRole}>
              <Icon name="undo" size={12} /> Reset
            </button>
            <button type="button" className="btn btn-primary h-8 px-3 text-[12px]" disabled={locked} onClick={save}>
              <Icon name="save" size={12} /> Save
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="dt min-w-[900px]">
              <thead>
                <tr>
                  <th>Resource</th>
                  {ACTIONS.map((a) => (
                    <th key={a.k} className="whitespace-nowrap text-center">{a.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RESOURCES.map((res) => (
                  <tr key={res.k}>
                    <td className="whitespace-nowrap font-semibold">{res.label}</td>
                    {ACTIONS.map((a) => {
                      const allowed = appliesTo(res.k, a.k);
                      const on = Boolean(matrix[role]?.[res.k]?.[a.k]);
                      return (
                        <td key={a.k} className="text-center">
                          {allowed ? (
                            <input
                              type="checkbox"
                              className="h-4 w-4 cursor-pointer align-middle accent-brand disabled:cursor-not-allowed"
                              checked={locked ? true : on}
                              disabled={locked}
                              onChange={() => toggle(res.k, a.k)}
                              aria-label={res.label + ' - ' + a.label}
                            />
                          ) : (
                            <span className="text-inkmuted" title="Does not apply to this module">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-2 text-[12px] text-inkmuted">
            {grantedCount(locked ? DEFAULT_MATRIX : matrix, role)} of {TOTAL_GRANTS} permissions held by {role}.
          </div>
        </>
      )}

      {/* ======================================================= INVITE ==== */}
      {inviting && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
          onMouseDown={() => setInviting(false)}
        >
          <div
            className="my-10 w-full max-w-[460px] rounded-lg bg-white shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-line px-5 py-3">
              <span className="card-title">Invite user</span>
              <span className="flex-1" />
              <button type="button" className="btn" onClick={() => setInviting(false)}>
                <Icon name="x" size={12} /> Close
              </button>
            </div>

            <div className="form-grid p-5">
              <div>
                <label className="f-label">Name <span className="f-req">*</span></label>
                <input
                  className="f-input"
                  value={invite.name}
                  onChange={(e) => setInvite((c) => ({ ...c, name: e.target.value }))}
                />
                {inviteErrors.name && <div className="f-err">{inviteErrors.name}</div>}
              </div>

              <div>
                <label className="f-label">Email <span className="f-req">*</span></label>
                <input
                  className="f-input normal-case"
                  value={invite.email}
                  onChange={(e) => setInvite((c) => ({ ...c, email: e.target.value }))}
                />
                {inviteErrors.email && <div className="f-err">{inviteErrors.email}</div>}
              </div>

              <div>
                <label className="f-label">Role</label>
                <select
                  className="f-input"
                  value={invite.role}
                  onChange={(e) => setInvite((c) => ({ ...c, role: e.target.value }))}
                >
                  {ROLES.map((r) => <option key={r.k} value={r.k}>{r.label}</option>)}
                </select>
                <div className="f-hint">
                  {ROLES.find((r) => r.k === invite.role)?.description}
                </div>
              </div>

              <div>
                <label className="f-label">Scope</label>
                <input
                  className="f-input"
                  placeholder="Business, or business and branch"
                  value={invite.scope}
                  onChange={(e) => setInvite((c) => ({ ...c, scope: e.target.value }))}
                />
                <div className="f-hint">Leave blank for every location of the business.</div>
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-line px-5 py-3">
              <button type="button" className="btn btn-primary" onClick={submitInvite}>
                <Icon name="check" size={12} /> Add to list
              </button>
              <button type="button" className="btn" onClick={() => setInviting(false)}>Cancel</button>
              <span className="flex-1" />
              <span className="text-[11px] text-inkmuted">No email is sent yet.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
