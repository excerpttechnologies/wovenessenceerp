import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import User, { ROLES } from '@/models/User';
import Role from '@/models/Role';
import { handler, json } from '@/lib/apiError';
import { requirePermission, PERMISSIONS } from '@/lib/rbac';
import { escapeRegex } from '@/lib/validate';
import { hashPassword } from '@/lib/auth';

/* /api/user - the accounts that can sign in, and what each may do.

   Without this the role and location model added in lib/rbac.js would be
   enforced but unconfigurable: every account in the database is a Super Admin
   with no locations, so nothing would ever be restricted and the whole
   permission layer would be theatre.

   Only an account that already holds ADMIN_ALL may read or write here - user
   management is the one screen where a privilege check protects the privilege
   checks themselves.

   Passwords are never returned, and are only written when one is supplied, so
   editing a user's locations does not silently reset their password. */

const PER_PAGE = 15;

export const GET = handler(async (req) => {
  await requirePermission(PERMISSIONS.ADMIN_ALL);
  const sp = new URL(req.url).searchParams;
  await dbConnect();

  const page = Math.max(1, Number(sp.get('page') || 1));
  const perPage = Math.min(200, Number(sp.get('perPage') || PER_PAGE));

  const filter = {};
  const b = sp.get('business'); if (b && isValidObjectId(b)) filter.businessId = b;

  const search = (sp.get('search') || '').trim();
  if (search) {
    const rx = { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = [{ name: rx }, { email: rx }, { role: rx }];
  }

  const total = await User.countDocuments(filter);
  const rows = await User.find(filter)
    .select('-password')
    .sort({ createdAt: -1 })
    .skip((page - 1) * perPage)
    .limit(perPage)
    .lean();

  return json({
    rows: rows.map((r) => ({
      ...r,
      _id: String(r._id),
      locationIds: (r.locationIds || []).map(String),
      /* what the list actually needs to show at a glance */
      locationCount: (r.locationIds || []).length,
      access: (r.locationIds || []).length ? (r.locationIds || []).length + ' location(s)' : 'All locations',
    })),
    labels: {},
    total,
    page,
    pages: Math.max(1, Math.ceil(total / perPage)),
    perPage,
  });
});

export const POST = handler(async (req) => {
  await requirePermission(PERMISSIONS.ADMIN_ALL);
  const body = await req.json().catch(() => ({}));
  const data = body?.data || {};
  await dbConnect();

  const business = isValidObjectId(body.business) ? body.business : null;
  const errors = validate(data, {
    isNew: true,
    allowedRoles: await allowedRoleNames(business),
  });
  if (Object.keys(errors).length) return json({ errors }, 422);

  const email = String(data.email).toLowerCase().trim();
  if (await User.exists({ email })) {
    return json({ errors: { email: 'An account with that email already exists.' } }, 422);
  }

  const created = await User.create({
    name: String(data.name).trim(),
    email,
    password: hashPassword(data.password),
    role: data.role || ROLES.LOCATION_USER,
    isActive: data.isActive !== false && data.isActive !== 'false',
    businessId: business,
    locationIds: toIds(data.locationIds),
    allow: toList(data.allow),
    deny: toList(data.deny),
  });

  return json({ ok: true, id: String(created._id) }, 201);
});

/* ------------------------------------------------------------- shared ---- */

/* The role names an account may be given: the five from the code plus the
   ones this business has created on the Roles & Permissions screen.

   Read from the database rather than a fixed list, because custom roles are
   rows (models/Role.js). Scoped to the business so one branch's invented role
   cannot be assigned inside another. */
export async function allowedRoleNames(businessId) {
  const built = Object.values(ROLES);
  if (!businessId || !isValidObjectId(businessId)) return built;
  const rows = await Role.find({ businessId }).select('name').lean();
  return [...built, ...rows.map((r) => r.name).filter(Boolean)];
}

export function validate(data, { isNew, allowedRoles }) {
  const errors = {};
  if (!String(data.name || '').trim()) errors.name = 'Name is required';

  const email = String(data.email || '').trim();
  if (!email) errors.email = 'Email is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'That is not a valid email address';

  /* Required on create, optional on edit - a blank password when editing
     means "leave it as it is", not "set it to empty". */
  if (isNew && !String(data.password || '')) errors.password = 'Password is required';
  else if (data.password && String(data.password).length < 8) {
    errors.password = 'Use at least 8 characters';
  }

  /* Defaults to the built-ins when the caller did not look custom roles up,
     so an older call site cannot accidentally widen what is accepted. */
  const allowed = allowedRoles && allowedRoles.length ? allowedRoles : Object.values(ROLES);
  if (data.role && !allowed.includes(data.role)) {
    errors.role = 'Choose one of: ' + allowed.join(', ');
  }
  return errors;
}

export function toIds(v) {
  const list = Array.isArray(v) ? v : (v ? [v] : []);
  return list.map(String).filter((x) => isValidObjectId(x));
}

export function toList(v) {
  const list = Array.isArray(v) ? v : (v ? [v] : []);
  return list.map(String).filter(Boolean);
}
