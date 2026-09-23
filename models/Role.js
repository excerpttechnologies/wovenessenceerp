import mongoose from 'mongoose';

/* Roles somebody created on the Roles & Permissions screen.

   THE FIVE BUILT-IN ROLES ARE NOT IN HERE. Super Admin, Admin, Location
   Manager, Location User and Cashier live in models/User.js ROLES and are
   enforced by lib/rbac.js - they are code, not rows, and a copy of them in a
   collection would be a second answer to what they mean. This collection
   holds the EXTRA roles a business defines for itself, and nothing else.

   Reading "all roles" therefore means the five from the code plus whatever is
   here; the screen does that join, because it is the only caller that needs
   it.

   SCOPED PER BUSINESS, like every other setting in this project - one branch
   inventing "Floor Supervisor" does not put it in another branch's list.

   WHAT A CUSTOM ROLE CAN AND CANNOT DO TODAY. Its permission matrix saves and
   loads like any other role's (models/RolePermission.js). It is deliberately
   NOT offered when assigning a user, because lib/rbac.js resolves a role it
   does not recognise to the NARROWEST permission set - so giving somebody a
   custom role today would quietly cut their access on the routes rbac does
   enforce. That changes the moment enforcement reads RolePermission instead.

   Collection name pinned lowercase, same reasoning as every other model. */

export const LABEL_FIELD = 'name';

const RoleSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'business',
      default: null,
      index: true,
    },

    name: { type: String, default: '', trim: true },
    description: { type: String, default: '', trim: true },

    isActive: { type: Boolean, default: true },

    /* Who made it, for the audit trail. A string rather than a ref so a
       deleted account does not break the record - the same call
       models/attachmentSchema.js made for uploadedBy. */
    createdBy: { type: String, default: '' },
  },
  { timestamps: true }
);

/* One role of a given name per business. Collation strength 2 so "Floor
   Supervisor" and "floor supervisor" collide rather than sitting side by side
   as two roles nobody can tell apart in a dropdown. */
RoleSchema.index(
  { businessId: 1, name: 1 },
  {
    unique: true,
    collation: { locale: 'en', strength: 2 },
    partialFilterExpression: { name: { $gt: '' } },
  }
);

export default mongoose.models.role ||
  mongoose.model('role', RoleSchema, 'role');
