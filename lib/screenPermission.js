import { isValidObjectId } from 'mongoose';
import RolePermission from '@/models/RolePermission';
import { ROLES } from '@/models/User';

/* ==========================================================================
   Enforcing the matrix saved on Staff Management -> Roles & Permissions.

   WIRED INTO EXACTLY ONE SCREEN so far: Inter Company Sell -> Delivery
   Challan. Every other route is untouched and still behaves as it always
   has. Switching the rest on is a route-by-route decision, and doing it in
   one sweep would change what a hundred screens allow without anybody having
   asked for that.

   THE RULE THAT KEEPS TODAY WORKING:

     no saved override for the role  ->  ALLOW
     a saved override                ->  allow only what it grants

   That is the whole safety story. Nothing changes for anybody until an
   administrator saves a matrix for their role, and when they do, it applies
   only to the screens that have been wired. The alternative - enforcing the
   code defaults from lib/rbac.js - would have quietly restricted every role
   the moment this shipped, which is not what "add validation" asked for.

   Super Admin and Admin are never checked; they hold '*' in lib/rbac.js and a
   stored document must not be able to compete with that.

   RETURNS A DENIAL, IT DOES NOT THROW. The routes this is called from answer
   with Response.json directly and are not wrapped in lib/apiError handler(),
   so a throw would surface as an unhandled 500 rather than a 403. Callers do:

     const denial = await screenDenial({ session, screen, action, businessId });
     if (denial) return json({ error: denial.message, code: denial.code }, 403);
   ========================================================================== */

/* The sidebar hrefs, which are what the matrix is keyed by - see
   models/RolePermission.js. One constant per wired screen, so a typo cannot
   silently mean "no override found, allow everything". */
export const SCREENS = {
  IC_DELIVERY_CHALLAN: '/admin/transaction/intercompanysell/deliverychallan',
  IC_RECEIVE_DELIVERY_CHALLAN: '/admin/transaction/intercompanysell/receivedeliverychallan',
};

export const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DOWNLOAD: 'download',
  DELETE: 'delete',
};

const UNRESTRICTED = [ROLES.SUPER_ADMIN, ROLES.ADMIN];

/* Reads better in a message than the stored key. */
const VERB = {
  create: 'create',
  read: 'view',
  update: 'edit',
  download: 'export',
  delete: 'delete',
};

/* null when the action is allowed; { message, code } when it is not. */
export async function screenDenial({ session, screen, action, businessId, label = '' }) {
  if (!session) {
    return { message: 'Sign in to continue.', code: 'UNAUTHENTICATED' };
  }

  const role = String(session.role || '').trim();

  /* An account with no role at all is the legacy default, which lib/rbac.js
     treats as Super Admin. Matching that here keeps existing installs working. */
  if (!role || UNRESTRICTED.includes(role)) return null;

  const scoped = businessId && isValidObjectId(String(businessId))
    ? await RolePermission.findOne({ businessId, role }).select('permissions').lean()
    : null;

  /* NO OVERRIDE FOR THIS BUSINESS. Two very different situations hide here,
     and treating them the same is what let a restricted account walk straight
     past its restrictions by changing the company in the top bar:

       the role is not governed anywhere  -> nobody has configured it at all,
                                             so behave as before: ALLOW
       the role IS governed somewhere     -> it has been configured, and
                                             nobody granted it anything HERE,
                                             so it holds nothing here: DENY

     The second case is the fix. Permissions are stored per business by
     design, so a role restricted in one branch must not come out unrestricted
     in another simply because no matrix was saved there - that is an escape
     hatch, not a default. */
  if (!scoped) {
    const governedElsewhere = await RolePermission.exists({ role });
    if (!governedElsewhere) return null;

    return {
      message: 'Your role (' + role + ') has no permissions for this business. '
        + 'Ask an administrator to grant them on Staff Management > Roles & '
        + 'Permissions with this business selected in the top bar.',
      code: 'SCREEN_FORBIDDEN_SCOPE',
    };
  }

  const granted = (scoped.permissions || {})[screen];
  if (Array.isArray(granted) && granted.includes(action)) return null;

  return {
    message: 'Your role (' + role + ') is not allowed to ' + (VERB[action] || action)
      + ' ' + (label || 'this') + '. Ask an administrator to grant it on '
      + 'Staff Management > Roles & Permissions.',
    code: 'SCREEN_FORBIDDEN',
  };
}
