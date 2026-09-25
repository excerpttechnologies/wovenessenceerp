import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import RolePermission from '@/models/RolePermission';
import { ROLES as USER_ROLES } from '@/models/User';
import Role from '@/models/Role';
import { handler, json } from '@/lib/apiError';
import { requirePermission, PERMISSIONS } from '@/lib/rbac';
import { ACTIONS, RESOURCES } from '@/app/admin/staff-management/roles-permissions/fields';

/* /api/role-permission - what each role may do, per business.

   WHAT THIS DOES AND DOES NOT DO. It stores and returns the permission matrix
   the Roles & Permissions screen edits. It does NOT enforce anything: no other
   route consults this collection, and none was changed to. Enforcement is a
   separate piece of work - switching it on quietly here would change what
   every other screen allows without anybody having asked for that.

   ABSENCE IS MEANINGFUL. A role with no document has not been customised and
   falls back to the default written in lib/rbac.js; a role WITH a document
   uses exactly what it says, even when that is nothing. So the response says
   which roles are saved rather than returning a merged answer - the merge
   belongs to the caller, which knows the defaults.

     GET    ?business=<id>              every saved role for that business
     GET    ?business=<id>&role=<name>  one role
     POST   { business, role, permissions }
     DELETE ?business=<id>&role=<name>  drop the override, back to the default

   Only an account holding ADMIN_ALL may read or write, the same gate
   /api/user uses: the screen that decides who may do what is the one place a
   privilege check has to protect the privilege checks themselves.

   The valid screens and actions are imported from the screen's own fields.js,
   which derives them from config/nav.js. One list, so a permission can never
   be stored against a screen that does not exist. */

/* The OWNER role only. Super Admin is the installation's owner and must stay
   unrestricted, or a saved document could lock the last way in.

   Admin is deliberately NOT here: it is the top role a customer administers
   and has to be narrowable. It cannot lock itself out of this endpoint, which
   is gated on ADMIN_ALL from lib/rbac.js rather than on the saved matrix. */
const LOCKED = [USER_ROLES.SUPER_ADMIN];

const BUILT_IN_ROLES = Object.values(USER_ROLES);
const VALID_ACTIONS = new Set(ACTIONS.map((a) => a.k));
const VALID_RESOURCES = new Set(RESOURCES.map((r) => r.k));

/* A role is real if the code defines it or this business has created it.
   Checked against the database rather than a fixed list, because custom roles
   are rows - see models/Role.js. */
async function knownRole(role, businessId) {
  if (!role) return false;
  if (BUILT_IN_ROLES.includes(role)) return true;
  return Boolean(await Role.exists({ businessId, name: role }));
}

const UNKNOWN_ROLE = 'That role does not exist. Built-in roles are: '
  + BUILT_IN_ROLES.join(', ') + '. Custom ones are created on the Roles tab.';

const scopeOf = (sp) => {
  const b = sp.get('business');
  /* An invalid or missing business must NOT collapse to {} - that would read
     and overwrite another tenant's row. Answered as "no scope, no data". */
  return b && isValidObjectId(b) ? { businessId: b } : null;
};

/* Stored shape -> the shape the screen holds, and back again. Only granted
   actions are kept; anything unrecognised is dropped rather than stored, so a
   renamed screen cannot leave permissions behind that nothing can see. */
function cleanPermissions(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;

  Object.entries(raw).forEach(([resource, actions]) => {
    if (!VALID_RESOURCES.has(resource)) return;

    /* accepts either ['create','read'] or { create: true, read: false } - the
       screen holds the second shape and the database the first */
    const list = Array.isArray(actions)
      ? actions
      : Object.entries(actions || {}).filter(([, on]) => on).map(([k]) => k);

    const kept = [...new Set(list.map(String))].filter((a) => VALID_ACTIONS.has(a));
    if (kept.length) out[resource] = kept;
  });

  return out;
}

export const GET = handler(async (req) => {
  await requirePermission(PERMISSIONS.ADMIN_ALL);
  const sp = new URL(req.url).searchParams;
  const scope = scopeOf(sp);
  if (!scope) return json({ roles: {}, saved: [], total: 0 });

  await dbConnect();

  const role = (sp.get('role') || '').trim();
  const filter = role ? { ...scope, role } : scope;

  const rows = await RolePermission.find(filter).lean();

  const roles = {};
  rows.forEach((r) => { roles[r.role] = cleanPermissions(r.permissions); });

  return json({
    roles,
    /* which roles carry an override - the caller uses its own defaults for
       every role NOT in this list */
    saved: rows.map((r) => r.role),
    updatedBy: rows.reduce((acc, r) => ({ ...acc, [r.role]: r.updatedBy || '' }), {}),
    updatedAt: rows.reduce((acc, r) => ({ ...acc, [r.role]: r.updatedAt || null }), {}),
    total: rows.length,
  });
});

export const POST = handler(async (req) => {
  const session = await requirePermission(PERMISSIONS.ADMIN_ALL);
  const body = await req.json().catch(() => ({}));
  await dbConnect();

  const business = String(body.business || '');
  if (!isValidObjectId(business)) {
    return json({ errors: { business: 'Choose a business in the top bar first.' } }, 422);
  }

  const role = String(body.role || '').trim();
  if (!await knownRole(role, business)) {
    return json({ errors: { role: UNKNOWN_ROLE } }, 422);
  }
  if (LOCKED.includes(role)) {
    return json({
      error: role + ' is unrestricted by definition and cannot be edited.',
      code: 'ROLE_LOCKED',
    }, 422);
  }

  const permissions = cleanPermissions(body.permissions);

  await RolePermission.findOneAndUpdate(
    { businessId: business, role },
    {
      $set: {
        businessId: business,
        role,
        permissions,
        updatedBy: session?.name || session?.email || '',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const granted = Object.values(permissions).reduce((n, list) => n + list.length, 0);
  return json({ ok: true, role, granted });
});

/* Reset. Deletes the override rather than saving an empty one, because an
   empty document means "this role holds nothing" while no document means
   "this role uses the default" - and Reset means the second. */
export const DELETE = handler(async (req) => {
  await requirePermission(PERMISSIONS.ADMIN_ALL);
  const sp = new URL(req.url).searchParams;
  const scope = scopeOf(sp);
  if (!scope) return json({ errors: { business: 'Choose a business in the top bar first.' } }, 422);

  await dbConnect();

  const role = (sp.get('role') || '').trim();
  if (!await knownRole(role, scope.businessId)) {
    return json({ errors: { role: UNKNOWN_ROLE } }, 422);
  }
  const res = await RolePermission.deleteOne({ ...scope, role });

  return json({ ok: true, role, removed: res.deletedCount || 0 });
});
