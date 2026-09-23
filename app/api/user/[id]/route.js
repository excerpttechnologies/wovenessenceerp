import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { handler, json } from '@/lib/apiError';
import { requirePermission, PERMISSIONS } from '@/lib/rbac';
import { hashPassword } from '@/lib/auth';
import { validate, toIds, toList, allowedRoleNames } from '../route';

/* /api/user/<id> - read, update, deactivate one account. */

export const GET = handler(async (req, { params }) => {
  await requirePermission(PERMISSIONS.ADMIN_ALL);
  const { id } = await params;
  await dbConnect();
  if (!isValidObjectId(id)) return json({ error: 'Not found', code: 'NOT_FOUND' }, 404);

  const doc = await User.findById(id).select('-password').lean();
  if (!doc) return json({ error: 'User not found.', code: 'NOT_FOUND' }, 404);

  return json({
    doc: { ...doc, _id: String(doc._id), locationIds: (doc.locationIds || []).map(String) },
  });
});

export const PUT = handler(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.ADMIN_ALL);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const data = body?.data || {};
  await dbConnect();

  if (!isValidObjectId(id)) return json({ error: 'Not found', code: 'NOT_FOUND' }, 404);

  /* The account's own business decides which custom roles are on offer; the
     body's business is only used when it is actually changing. */
  const existing = await User.findById(id).select('businessId').lean();
  if (!existing) return json({ error: 'User not found.', code: 'NOT_FOUND' }, 404);
  const business = isValidObjectId(body.business) ? body.business : existing.businessId;

  const errors = validate(data, {
    isNew: false,
    allowedRoles: await allowedRoleNames(business),
  });
  if (Object.keys(errors).length) return json({ errors }, 422);

  const email = String(data.email).toLowerCase().trim();
  const clash = await User.findOne({ email, _id: { $ne: id } }).select('_id').lean();
  if (clash) return json({ errors: { email: 'Another account already uses that email.' } }, 422);

  const active = data.isActive !== false && data.isActive !== 'false';

  /* An administrator locking themselves out is unrecoverable without database
     access, so the two ways of doing it are refused rather than allowed and
     regretted. */
  if (String(session.id) === String(id)) {
    if (!active) {
      return json({ errors: { isActive: 'You cannot disable your own account.' } }, 422);
    }
    if (data.role && data.role !== session.role && !['Super Admin', 'Admin'].includes(data.role)) {
      return json({
        errors: { role: 'You cannot remove your own administrator role - ask another administrator to do it.' },
      }, 422);
    }
  }

  const update = {
    name: String(data.name).trim(),
    email,
    role: data.role,
    isActive: active,
    locationIds: toIds(data.locationIds),
    allow: toList(data.allow),
    deny: toList(data.deny),
  };
  if (isValidObjectId(body.business)) update.businessId = body.business;

  /* only when one was actually typed - see the note in ../route.js */
  if (data.password) update.password = hashPassword(data.password);

  const updated = await User.findByIdAndUpdate(id, update, { new: true }).select('-password').lean();
  if (!updated) return json({ error: 'User not found.', code: 'NOT_FOUND' }, 404);

  return json({ ok: true, id: String(updated._id) });
});

/* Accounts are DEACTIVATED, never deleted: their name is on documents,
   movements and audit rows, and a deleted account would leave those
   unattributable. isActive:false is already what the sign-in check reads. */
export const DELETE = handler(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.ADMIN_ALL);
  const { id } = await params;
  await dbConnect();
  if (!isValidObjectId(id)) return json({ error: 'Not found', code: 'NOT_FOUND' }, 404);

  if (String(session.id) === String(id)) {
    return json({ error: 'You cannot disable your own account.', code: 'SELF_LOCKOUT' }, 422);
  }

  const doc = await User.findByIdAndUpdate(id, { isActive: false }, { new: true }).select('-password').lean();
  if (!doc) return json({ error: 'User not found.', code: 'NOT_FOUND' }, 404);

  return json({ ok: true, deactivated: true });
});
