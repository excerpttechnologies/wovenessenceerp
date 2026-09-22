/* Roles & Permissions - the data behind the screen.

   A PLAIN MODULE, deliberately. lib/rbac.js is the real authority on what a
   role may do, but it imports models/User.js for ROLES, which pulls mongoose
   into anything that imports it - fine on the server, fatal in a client
   component. components/transferConstants.js exists for exactly this reason
   and this follows it: the constants live here, with no mongoose anywhere
   near them, so the screen can read them directly.

   FRONTEND ONLY FOR NOW. Nothing here is fetched and nothing is saved - the
   matrix below is the seed the screen opens with, and edits live in React
   state until the API is built. When it is, ROLES / RESOURCES / ACTIONS stay
   as the single description of the shape; only DEFAULT_MATRIX and
   SAMPLE_USERS get replaced by real reads.

   The role names are spelled exactly as lib/rbac.js already enforces them, so
   the screen and the server cannot disagree about what a role is called. */

/* ---------------------------------------------------------------- roles -- */

export const ROLES = [
  {
    k: 'Super Admin',
    label: 'Super Admin',
    tone: 'pill-red',
    locked: true,
    description: 'Unrestricted. Works across every business and location.',
  },
  {
    k: 'Admin',
    label: 'Admin',
    tone: 'pill-red',
    locked: true,
    description: 'Unrestricted within the businesses the account is assigned to.',
  },
  {
    k: 'Location Manager',
    label: 'Location Manager',
    tone: 'pill-blue',
    description: 'Runs a branch end to end - receives, sells, transfers and bills.',
  },
  {
    k: 'Location User',
    label: 'Location User',
    tone: 'pill-blue',
    description: 'A destination branch: receives what is sent to it and sells. Cannot despatch.',
  },
  {
    k: 'Cashier',
    label: 'Cashier',
    tone: 'pill-grey',
    description: 'The till only - sells, refunds, and reads reports.',
  },
];

/* Super Admin and Admin hold '*' in lib/rbac.js, so their matrix is not a set
   of choices: every box is on and none of them is editable. */
export const isLockedRole = (role) => Boolean(ROLES.find((r) => r.k === role)?.locked);

/* -------------------------------------------------------------- actions -- */

export const ACTIONS = [
  { k: 'view', label: 'View' },
  { k: 'create', label: 'Create' },
  { k: 'edit', label: 'Edit' },
  { k: 'delete', label: 'Delete' },
  { k: 'approve', label: 'Approve' },
  { k: 'lock', label: 'Lock' },
  { k: 'export', label: 'Export' },
  { k: 'sensitive', label: 'View Sensitive' },
];

/* ------------------------------------------------------------ resources --

   One row per module as the sidebar groups them, not one per API route - the
   matrix is read by whoever administers the system, and they think in screens.

   `actions` is which columns APPLY to a row. A column left out renders as a
   dash rather than an empty box, so "cannot be granted" looks different from
   "not granted": a Dashboard you can only look at should not offer a Delete
   checkbox nobody will ever tick. */

export const RESOURCES = [
  { k: 'dashboard', label: 'Dashboard', actions: ['view'] },
  { k: 'masters', label: 'Masters', actions: ['view', 'create', 'edit', 'delete'] },
  { k: 'contacts', label: 'Contacts', actions: ['view', 'create', 'edit', 'delete', 'export', 'sensitive'] },
  { k: 'items', label: 'Inventory & Items', actions: ['view', 'create', 'edit', 'delete', 'export'] },
  { k: 'barcodes', label: 'Barcode Generation', actions: ['view', 'create', 'edit', 'delete', 'export'] },
  { k: 'purchase', label: 'Purchase (GRC / GRT)', actions: ['view', 'create', 'edit', 'delete', 'approve', 'export'] },
  { k: 'purchaseInvoice', label: 'Purchase Invoice', actions: ['view', 'create', 'edit', 'delete', 'approve', 'lock', 'export'] },
  { k: 'sell', label: 'Sell & Delivery Challan', actions: ['view', 'create', 'edit', 'delete', 'approve', 'export'] },
  { k: 'pos', label: 'POS', actions: ['view', 'create', 'edit', 'delete', 'export', 'sensitive'] },
  { k: 'transfers', label: 'Stock Transfers', actions: ['view', 'create', 'edit', 'delete', 'approve', 'lock', 'export'] },
  { k: 'ic', label: 'Inter Company Sell', actions: ['view', 'create', 'edit', 'delete', 'approve', 'export'] },
  { k: 'transport', label: 'Transportation', actions: ['view', 'create', 'edit', 'delete', 'export'] },
  { k: 'vouchers', label: 'Vouchers & Ledger', actions: ['view', 'create', 'edit', 'delete', 'approve', 'lock', 'export', 'sensitive'] },
  { k: 'reports', label: 'Reports', actions: ['view', 'export', 'sensitive'] },
  { k: 'users', label: 'Users & Roles', actions: ['view', 'create', 'edit', 'delete', 'sensitive'] },
];

export function appliesTo(resourceKey, actionKey) {
  const res = RESOURCES.find((r) => r.k === resourceKey);
  return Boolean(res && res.actions.includes(actionKey));
}

/* --------------------------------------------------------------- matrix --

   Seeded to match what lib/rbac.js ROLE_PERMISSIONS actually allows today, so
   the screen opens showing the system's real posture rather than a blank grid
   somebody has to fill in from memory.

   Written out per role rather than layered, for the same reason rbac.js
   writes its own table out longhand: reading one block tells you a role's
   whole reach. */

function grant(pairs) {
  const out = {};
  Object.entries(pairs).forEach(([resource, actions]) => {
    out[resource] = {};
    actions.forEach((a) => { out[resource][a] = true; });
  });
  return out;
}

/* Every applicable box, for the two unrestricted roles. */
function everything() {
  const out = {};
  RESOURCES.forEach((r) => {
    out[r.k] = {};
    r.actions.forEach((a) => { out[r.k][a] = true; });
  });
  return out;
}

export const DEFAULT_MATRIX = {
  'Super Admin': everything(),
  Admin: everything(),

  /* GRC_MANAGE, BARCODE_*, POS_*, the whole TRANSFER_* set, BILLING_MANAGE
     and REPORTS_VIEW - everything except administering the system itself. */
  'Location Manager': grant({
    dashboard: ['view'],
    masters: ['view'],
    contacts: ['view', 'create', 'edit', 'export'],
    items: ['view', 'create', 'edit', 'export'],
    barcodes: ['view', 'create', 'edit', 'export'],
    purchase: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
    purchaseInvoice: ['view', 'create', 'edit', 'approve', 'lock', 'export'],
    sell: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
    pos: ['view', 'create', 'edit', 'export', 'sensitive'],
    transfers: ['view', 'create', 'edit', 'delete', 'approve', 'lock', 'export'],
    ic: ['view', 'create', 'edit', 'approve', 'export'],
    transport: ['view', 'create', 'edit', 'export'],
    vouchers: ['view', 'create', 'edit', 'approve', 'export'],
    reports: ['view', 'export'],
    users: ['view'],
  }),

  /* GRC_VIEW, POS_SELL, POS_RETURN, TRANSFER_RECEIVE, TRANSFER_RETURN,
     REPORTS_VIEW. Receiving and returning a transfer are edits to a document
     somebody else raised, which is why Stock Transfers carries Edit but not
     Create - this branch cannot despatch of its own accord. */
  'Location User': grant({
    dashboard: ['view'],
    masters: ['view'],
    contacts: ['view'],
    items: ['view'],
    barcodes: ['view'],
    purchase: ['view'],
    purchaseInvoice: ['view'],
    sell: ['view', 'create'],
    pos: ['view', 'create', 'export'],
    transfers: ['view', 'edit'],
    ic: ['view'],
    transport: ['view'],
    vouchers: ['view'],
    reports: ['view'],
  }),

  /* POS_SELL, POS_RETURN, REPORTS_VIEW and nothing else. */
  Cashier: grant({
    dashboard: ['view'],
    pos: ['view', 'create', 'export'],
    reports: ['view'],
  }),
};

/* How many boxes a role holds - the "reach" figure on the Roles tab. */
export function grantedCount(matrix, role) {
  const held = (matrix && matrix[role]) || {};
  return RESOURCES.reduce(
    (n, r) => n + r.actions.filter((a) => held[r.k] && held[r.k][a]).length,
    0
  );
}

export const TOTAL_GRANTS = RESOURCES.reduce((n, r) => n + r.actions.length, 0);

/* ---------------------------------------------------------------- users --

   Placeholder rows, so the table has shape to review. Replaced by a read of
   the user collection when the API lands - models/User.js already carries
   name, email, role, businessId, locationIds, isActive, allow and deny. */

export const SAMPLE_USERS = [
  { _id: 'u1', name: 'Sagar', email: 'sagar@excerpttech.example', role: 'Super Admin', scope: 'All businesses', status: 'Active', lastActive: '12 min ago' },
  { _id: 'u2', name: 'Priya Menon', email: 'priya@templefabrics.example', role: 'Location Manager', scope: 'Temple Fabrics - Warehouse', status: 'Active', lastActive: '48 min ago' },
  { _id: 'u3', name: 'Rahul Shetty', email: 'rahul@templefabrics.example', role: 'Location User', scope: 'Temple Fabrics - Jayanagar', status: 'Active', lastActive: '3 hr ago' },
  { _id: 'u4', name: 'Neha Rao', email: 'neha@omshreefabs.example', role: 'Cashier', scope: 'OMSHREE FABS - Counter 1', status: 'Active', lastActive: '26 min ago' },
  { _id: 'u5', name: 'Farah Khan', email: 'farah@omshreefabs.example', role: 'Location Manager', scope: 'OMSHREE FABS', status: 'Invited', lastActive: 'Never' },
];

export const STATUSES = ['Active', 'Invited', 'Disabled'];

export const STATUS_TONE = {
  Active: 'pill-green',
  Invited: 'pill-grey',
  Disabled: 'pill-red',
};

/* Initials for the avatar chip - first letter of up to two words, the same
   rule components/ProductImage.jsx uses for its fallback. */
export function initialsOf(name) {
  return String(name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase() || '?';
}
