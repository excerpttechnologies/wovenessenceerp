import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import Role from '@/models/Role';
import { ROLES as BUILT_IN } from '@/models/User';
import { handler, json } from '@/lib/apiError';
import { requirePermission, PERMISSIONS } from '@/lib/rbac';
import { escapeRegex } from '@/lib/validate';

/* /api/role - the roles a business has defined for itself.

   The five built-in roles are NOT served from here; they are code, in
   models/User.js. This is the extra ones. See models/Role.js for why the two
   are kept apart.

     GET  ?business=<id>            the custom roles of that business
     POST { business, data: { name, description } }

   Only an account holding ADMIN_ALL may read or write, the same gate
   /api/user and /api/role-permission use.

   A built-in name is refused rather than shadowed: two "Cashier" entries in
   one dropdown, one enforced by code and one not, is a trap. */

export const RESERVED = Object.values(BUILT_IN);

export function validateRole(data) {
  const errors = {};

  const name = String(data?.name || '').trim();
  if (!name) errors.name = 'Role name is required';
  else if (name.length < 2) errors.name = 'Use at least 2 characters';
  else if (name.length > 40) errors.name = 'Keep it under 40 characters';
  else if (RESERVED.some((r) => r.toLowerCase() === name.toLowerCase())) {
    errors.name = '"' + name + '" is a built-in role. Choose another name.';
  }

  if (String(data?.description || '').length > 200) {
    errors.description = 'Keep it under 200 characters';
  }

  return errors;
}

export const GET = handler(async (req) => {
  await requirePermission(PERMISSIONS.ADMIN_ALL);
  const sp = new URL(req.url).searchParams;
  await dbConnect();

  const business = sp.get('business');
  /* No business means no list - returning every business's roles would put
     one branch's invented roles in another's dropdown. */
  if (!business || !isValidObjectId(business)) {
    return json({ rows: [], total: 0 });
  }

  const filter = { businessId: business };

  const search = (sp.get('search') || '').trim();
  if (search) {
    const rx = { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = [{ name: rx }, { description: rx }];
  }

  const rows = await Role.find(filter).sort({ name: 1 }).lean();

  return json({
    rows: rows.map((r) => ({ ...r, _id: String(r._id) })),
    total: rows.length,
  });
});

export const POST = handler(async (req) => {
  const session = await requirePermission(PERMISSIONS.ADMIN_ALL);
  const body = await req.json().catch(() => ({}));
  const data = body?.data || {};
  await dbConnect();

  const business = String(body.business || '');
  if (!isValidObjectId(business)) {
    return json({ errors: { name: 'Choose a business in the top bar first.' } }, 422);
  }

  const errors = validateRole(data);
  if (Object.keys(errors).length) return json({ errors }, 422);

  const name = String(data.name).trim();

  /* Checked here as well as by the unique index: this answers with a message
     about the field, the index answers with a 409 from lib/apiError. Both are
     needed - the pre-check is the readable one, the index is the one that
     holds when two requests arrive together. */
  const clash = await Role.findOne({ businessId: business, name })
    .collation({ locale: 'en', strength: 2 })
    .select('_id')
    .lean();
  if (clash) return json({ errors: { name: 'A role called "' + name + '" already exists.' } }, 422);

  const created = await Role.create({
    businessId: business,
    name,
    description: String(data.description || '').trim(),
    isActive: data.isActive !== false,
    createdBy: session?.name || session?.email || '',
  });

  return json({ ok: true, id: String(created._id), name: created.name }, 201);
});
