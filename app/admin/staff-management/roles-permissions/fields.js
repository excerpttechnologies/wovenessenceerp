import { NAV } from '@/config/nav';

/* Roles & Permissions - the data behind the screen.

   THE RESOURCE LIST IS THE SIDEBAR. It is derived from config/nav.js at
   module load rather than typed out here, because a permission list that is
   maintained by hand goes stale the first time somebody adds a screen and
   forgets: the new page would then be invisible to the permission editor
   while being perfectly reachable in the app. Deriving it means adding an
   entry to NAV adds its permissions, and removing one removes them.

   One resource per sidebar leaf, keyed by href - the href is already unique
   and already stable, so it needs no second identifier invented for it.

   FRONTEND ONLY FOR NOW. Nothing here is fetched and nothing is saved. The
   matrix below is the seed the screen opens with, and edits live in React
   state until the API is built. When it is, ROLES / ACTIONS / RESOURCES stay
   as the description of the shape; only the default grants and SAMPLE_USERS
   get replaced by real reads.

   Role names are spelled exactly as lib/rbac.js already enforces them, so the
   screen and the server cannot disagree about what a role is called. */

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

/* Super Admin and Admin hold '*' in lib/rbac.js, so their grid is not a set of
   choices: every box is on and none of them is editable. */
export const isLockedRole = (role) => Boolean(ROLES.find((r) => r.k === role)?.locked);

/* -------------------------------------------------------------- actions -- */

export const ACTIONS = [
  { k: 'create', label: 'Create' },
  { k: 'read', label: 'Read' },
  { k: 'update', label: 'Update' },
  { k: 'download', label: 'Download' },
  { k: 'delete', label: 'Delete' },
];

/* ------------------------------------------------------------ resources --

   Built from NAV. Top-level entries that are a link rather than a group
   (Dashboard, Logistic, Ledger Transaction) are collected under "General".

   Logout is not a resource - it is not a screen anybody is granted or denied,
   and offering "Logout Delete" would be nonsense. */

const SKIP_HREFS = new Set(['/logout']);

function buildGroups() {
  const groups = [];
  const general = { group: 'General', resources: [] };

  NAV.forEach((item) => {
    if (item.href && !item.children) {
      if (SKIP_HREFS.has(item.href)) return;
      general.resources.push({ k: item.href, label: item.label, href: item.href, group: 'General' });
      return;
    }
    const resources = (item.children || [])
      .filter((c) => c.href && !SKIP_HREFS.has(c.href))
      .map((c) => ({ k: c.href, label: c.label, href: c.href, group: item.label }));

    if (resources.length) groups.push({ group: item.label, resources });
  });

  /* General first - Dashboard is the screen everybody lands on. */
  return general.resources.length ? [general, ...groups] : groups;
}

export const RESOURCE_GROUPS = buildGroups();

export const RESOURCES = RESOURCE_GROUPS.flatMap((g) => g.resources);

/* Two sidebar groups use the same child label (Inter Company Sell and Sell
   both have a "Delivery Challan"), so a resource is shown with its group when
   the label alone would be ambiguous. */
const LABEL_COUNTS = RESOURCES.reduce((acc, r) => {
  acc[r.label] = (acc[r.label] || 0) + 1;
  return acc;
}, {});

export function resourceTitle(resource) {
  return LABEL_COUNTS[resource.label] > 1
    ? resource.group + ' ' + resource.label
    : resource.label;
}

export const TOTAL_GRANTS = RESOURCES.length * ACTIONS.length;

/* --------------------------------------------------------------- matrix --

   Seeded from what lib/rbac.js ROLE_PERMISSIONS actually allows today, so the
   screen opens on the system's real posture rather than a blank grid somebody
   has to fill in from memory.

   Expressed per sidebar GROUP rather than per screen, because that is the
   granularity the roles are actually described at - "a cashier runs the till"
   - with a short list of per-screen exceptions after it for the cases a group
   rule gets wrong. A resource the rules do not mention is granted nothing. */

const ALL = ACTIONS.map((a) => a.k);
const READ = ['read'];
const READ_DL = ['read', 'download'];
const WRITE = ['create', 'read', 'update', 'download'];
const FULL = ['create', 'read', 'update', 'download', 'delete'];

const RULES = {
  'Location Manager': {
    groups: {
      General: READ_DL,
      Masters: READ_DL,
      Inventory: WRITE,
      Contacts: WRITE,
      Transportation: WRITE,
      Purchase: FULL,
      Sell: FULL,
      'Stock Transfers': FULL,
      'Inter Company Sell': WRITE,
      'Main Reports': READ_DL,
      Reports: READ_DL,
      'Staff Management': READ,
      'Cash Register': WRITE,
      Voucher: WRITE,
      'E-commerce': READ_DL,
    },
    resources: {
      /* administering the system is not a branch manager's job */
      '/admin/setting/users': READ,
      '/admin/staff-management/roles-permissions': READ,
    },
  },

  /* GRC_VIEW, POS_SELL, POS_RETURN, TRANSFER_RECEIVE, TRANSFER_RETURN,
     REPORTS_VIEW. Receiving and returning a transfer are updates to a
     document somebody else raised, which is why Stock Transfers carries
     Update but not Create - this branch cannot despatch of its own accord. */
  'Location User': {
    groups: {
      General: READ,
      Masters: READ,
      Inventory: READ,
      Contacts: READ,
      Transportation: READ,
      Purchase: READ,
      Sell: READ,
      'Stock Transfers': ['read', 'update'],
      'Inter Company Sell': ['read', 'update'],
      'Main Reports': READ,
      Reports: READ,
      'Cash Register': READ,
      Voucher: READ,
      'E-commerce': READ,
    },
    resources: {
      '/admin/transaction/sell/pos': WRITE,
      '/admin/transaction/sell/pos-return': WRITE,
      '/admin/transaction/sell/deliverychallan': WRITE,
      '/admin/setting/users': [],
      '/admin/staff-management/roles-permissions': [],
    },
  },

  /* POS_SELL, POS_RETURN, REPORTS_VIEW and nothing else. Expressed per
     screen, because "the till" is three screens and not a sidebar group. */
  Cashier: {
    groups: {
      General: READ,
      'Main Reports': READ,
      Reports: READ,
    },
    resources: {
      '/admin/transaction/sell/pos': WRITE,
      '/admin/transaction/sell/pos-return': WRITE,
      '/admin/cashregister': READ,
      '/admin/cashregister/open': ['create', 'read', 'update'],
    },
  },
};

function grantsFor(role, resource) {
  if (isLockedRole(role)) return ALL;
  const rule = RULES[role];
  if (!rule) return [];
  if (Object.prototype.hasOwnProperty.call(rule.resources || {}, resource.k)) {
    return rule.resources[resource.k];
  }
  return (rule.groups || {})[resource.group] || [];
}

function buildMatrix() {
  const out = {};
  ROLES.forEach((r) => {
    out[r.k] = {};
    RESOURCES.forEach((res) => {
      out[r.k][res.k] = {};
      grantsFor(r.k, res).forEach((a) => { out[r.k][res.k][a] = true; });
    });
  });
  return out;
}

export const DEFAULT_MATRIX = buildMatrix();

/* How many boxes a role holds - the "reach" figure on the Roles tab. */
export function grantedCount(matrix, role) {
  const held = (matrix && matrix[role]) || {};
  return RESOURCES.reduce(
    (n, r) => n + ACTIONS.filter((a) => held[r.k] && held[r.k][a.k]).length,
    0
  );
}

/* Granted / total within one sidebar group, for the group header. */
export function groupTally(matrix, role, group) {
  const held = (matrix && matrix[role]) || {};
  const resources = RESOURCE_GROUPS.find((g) => g.group === group)?.resources || [];
  const on = resources.reduce(
    (n, r) => n + ACTIONS.filter((a) => held[r.k] && held[r.k][a.k]).length,
    0
  );
  return { on, total: resources.length * ACTIONS.length };
}

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
