import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import Role from '@/models/Role';
import RolePermission from '@/models/RolePermission';
import User from '@/models/User';
import { handler, json } from '@/lib/apiError';
import { requirePermission, PERMISSIONS } from '@/lib/rbac';
import { validateRole } from '../route';

/* /api/role/<id> - rename, re-describe or remove one custom role. */

export const GET = handler(async (req, { params }) => {
  await requirePermission(PERMISSIONS.ADMIN_ALL);
  const { id } = await params;
  await dbConnect();
  if (!isValidObjectId(id)) return json({ error: 'Not found', code: 'NOT_FOUND' }, 404);

  const doc = await Role.findById(id).lean();
  if (!doc) return json({ error: 'Role not found.', code: 'NOT_FOUND' }, 404);

  return json({ doc: { ...doc, _id: String(doc._id) } });
});

export const PUT = handler(async (req, { params }) => {
  await requirePermission(PERMISSIONS.ADMIN_ALL);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const data = body?.data || {};
  await dbConnect();

  if (!isValidObjectId(id)) return json({ error: 'Not found', code: 'NOT_FOUND' }, 404);

  const existing = await Role.findById(id).lean();
  if (!existing) return json({ error: 'Role not found.', code: 'NOT_FOUND' }, 404);

  const errors = validateRole(data);
  if (Object.keys(errors).length) return json({ errors }, 422);

  const name = String(data.name).trim();

  const clash = await Role.findOne({
    businessId: existing.businessId,
    name,
    _id: { $ne: id },
  })
    .collation({ locale: 'en', strength: 2 })
    .select('_id')
    .lean();
  if (clash) return json({ errors: { name: 'Another role is already called "' + name + '".' } }, 422);

  /* A rename has to carry the saved permissions with it. RolePermission is
     keyed by the role NAME, not by this document's id, so renaming without
     this would strand the matrix under the old name and the role would come
     back looking newly created with nothing granted. */
  if (name !== existing.name) {
    await RolePermission.updateOne(
      { businessId: existing.businessId, role: existing.name },
      { $set: { role: name } }
    );
  }

  await Role.updateOne({ _id: id }, {
    $set: {
      name,
      description: String(data.description || '').trim(),
      isActive: data.isActive !== false,
    },
  });

  return json({ ok: true, id, name, renamedFrom: name !== existing.name ? existing.name : null });
});

/* Removing a role removes its saved matrix too - a permission row for a role
   that no longer exists is unreachable from every screen and would quietly
   come back to life if somebody later created a role with the same name. */
export const DELETE = handler(async (req, { params }) => {
  await requirePermission(PERMISSIONS.ADMIN_ALL);
  const { id } = await params;
  await dbConnect();
  if (!isValidObjectId(id)) return json({ error: 'Not found', code: 'NOT_FOUND' }, 404);

  const existing = await Role.findById(id).lean();
  if (!existing) return json({ error: 'Role not found.', code: 'NOT_FOUND' }, 404);

  /* Refused while anybody still holds it: deleting would leave those accounts
     pointing at a role that no longer exists, and lib/rbac.js resolves an
     unknown role to the narrowest permission set - so the deletion would
     silently cut their access instead of just tidying a list. */
  const holders = await User.countDocuments({ role: existing.name });
  if (holders) {
    return json({
      error: holders + ' account(s) still use "' + existing.name
        + '". Move them to another role first.',
      code: 'ROLE_IN_USE',
      holders,
    }, 409);
  }

  await RolePermission.deleteOne({ businessId: existing.businessId, role: existing.name });
  await Role.deleteOne({ _id: id });

  return json({ ok: true, deleted: existing.name });
});
