import mongoose from 'mongoose';

/* What a role may do, per business.

   lib/rbac.js holds the DEFAULT reach of each role, written out in code. This
   collection holds the overrides an administrator has saved on the Roles &
   Permissions screen. A role with no document here is not "a role with no
   permissions" - it is a role nobody has customised, and it falls back to the
   code default. That distinction is the whole design:

     no document   -> use the default from the code
     a document    -> use exactly what it says, even if it says nothing

   so an administrator who deliberately strips a role back to nothing gets
   nothing, rather than silently being handed the defaults again.

   SCOPED PER BUSINESS, like every other setting in this project. Two branches
   can run the same role name with different reach, which is what a group of
   companies sharing one install actually needs.

   `permissions` is a map of SCREEN -> the actions granted on it:

     { '/admin/inventory/item': ['create', 'read', 'update'] }

   The key is the sidebar href, because that is already unique and already
   stable - config/nav.js is the list of screens, so nothing has to be kept in
   step by hand. Only granted actions are stored; an action that is not in the
   array is not held. Storing the absences as `false` would double the
   document and mean the same thing.

   NOTHING ENFORCES THIS YET. The screen writes it and reads it back; no other
   route consults it. Wiring enforcement in is a separate piece of work, and
   doing it quietly here would change what every other screen allows without
   anybody asking for that.

   Collection name pinned lowercase, same reasoning as every other model. */

export const LABEL_FIELD = 'role';

const RolePermissionSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'business',
      default: null,
      index: true,
    },

    /* The role name exactly as models/User.js ROLES spells it. Not a ref -
       roles are code, not rows. */
    role: { type: String, default: '', index: true },

    /* { '<sidebar href>': ['create', 'read', ...] } */
    permissions: { type: mongoose.Schema.Types.Mixed, default: {} },

    /* Who last changed it, for the audit trail. A string rather than a ref so
       a deleted account does not break the record - the same call
       models/attachmentSchema.js made for uploadedBy. */
    updatedBy: { type: String, default: '' },
  },
  { timestamps: true }
);

/* One document per role per business. Partial so the rows that predate a role
   name being set cannot collide on ''. */
RolePermissionSchema.index(
  { businessId: 1, role: 1 },
  { unique: true, partialFilterExpression: { role: { $gt: '' } } }
);

export default mongoose.models.rolePermission ||
  mongoose.model('rolePermission', RolePermissionSchema, 'rolepermission');
