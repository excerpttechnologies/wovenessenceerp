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

   Super Admin is never checked - it is the installation's owner, and a stored
   document must not be able to lock the last way in. Admin IS checked: it is
   the top role a customer administers, so it has to be narrowable.

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
  CONTACT_TYPE: '/admin/contact/contact-type',
  SUPPLIER: '/admin/contact/supplier',
  AGENT: '/admin/contact/agent',
  CUSTOMER: '/admin/contact/customer',
  PRODUCT_FILTER: '/admin/inventory/product/filter',
  PRODUCT_GROUP: '/admin/inventory/product/group',
  UOM: '/admin/inventory/uom',
  ATTRIBUTE_ADDON: '/admin/inventory/attribute-addon',
  ITEM: '/admin/inventory/item',
  STOCK_ADJUSTMENT: '/admin/inventory/stock-adjustment',
  GRC: '/admin/transaction/purchase/grc',
  GRT: '/admin/transaction/purchase/grt',
  POS: '/admin/transaction/sell/pos',
  POS_RETURN: '/admin/transaction/sell/pos-return',
  BUSINESS: '/admin/setting/business',
  COMPANY_LOCATION: '/admin/setting/companylocations',
  TRANSPORTER: '/admin/transport/transporter',
  LEDGER_GROUP: '/admin/setting/ledgergroups',
  LEDGER: '/admin/setting/ledger',
  LEDGER_MAPPING: '/admin/setting/ledgergroupmapping',
  VOUCHER_SETTING: '/admin/setting/voucher-setting',
  DOC_SETUP: '/admin/setting/docsetup',
  PURCHASE_GROUP: '/admin/setting/purchasegroup',
  STOCK_POINT: '/admin/setting/stockpoint',
  POS_COUNTER: '/admin/setting/poscounter',
  BARCODE_SETTING: '/admin/setting/barcodesetting',
  SPLIT_BARCODE_SETTING: '/admin/setting/split-barcode-setting',
  BARCODE_LABEL_SETTING: '/admin/setting/barcode-label-setting',
  PURCHASE_RATE_CODE: '/admin/setting/purchase-rate-code',
  PAYMENT_METHOD: '/admin/setting/paymentmethod',
  TAX: '/admin/setting/tax',
  HSN: '/admin/setting/hsn',
  CITY_GROUP: '/admin/setting/citygroup',
  PURCHASE_CHARGE: '/admin/setting/purchase/master/charge',
  PURCHASE_TERM: '/admin/setting/purchase/master/term',
  SALES_TERM: '/admin/setting/sales/master/term',
  LOYALTY_POINT: '/admin/setting/loyaltypoint',
  LOGIN_SECURITY: '/admin/setting/login-security',
  POS_SETTING: '/admin/setting/pos_setting',
  ECOM_SETTING: '/admin/setting/ecom_setting',
  INVOICE_LAYOUT_SETTING: '/admin/setting/invoice-layout-setting',
  LOCATION_SETTING: '/admin/setting/location-setting',
  BUSINESS_CONTACT: '/admin/setting/business-contact',
  PRINT_LABEL: '/admin/inventory/barcode-print',
  BARCODE_ITEM: '/admin/inventory/barcodeitem',
  SELL_DELIVERY_CHALLAN: '/admin/transaction/sell/deliverychallan',
};

export const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DOWNLOAD: 'download',
  DELETE: 'delete',
};

/* The owner only. Admin is subject to its saved matrix like any other role -
   it simply has nothing saved until somebody narrows it, and a role with no
   override is allowed (see below). */
const UNRESTRICTED = [ROLES.SUPER_ADMIN];

/* Reads better in a message than the stored key. */
const VERB = {
  create: 'create',
  read: 'view',
  update: 'edit',
  download: 'export',
  delete: 'delete',
};

/* What this session may do, across every screen - the whole matrix in one
   read, for the browser to hide controls with.

   Returns { governed, screens }. `governed: false` means nobody has
   customised this role, so the UI must show everything exactly as it did
   before permissions existed. Only when governed is true does an absent
   screen or action mean "withhold it".

   THIS IS A CONVENIENCE, NOT THE ENFORCEMENT. Hiding a button is a courtesy
   to the operator; screenDenial() on the route is what actually stops the
   request, and it is checked whether the button was rendered or not. */
export async function effectivePermissions({ session, businessId }) {
  const role = String(session?.role || '').trim();
  if (!role || UNRESTRICTED.includes(role)) return { role, governed: false, screens: {} };

  const scoped = businessId && isValidObjectId(String(businessId))
    ? await RolePermission.findOne({ businessId, role }).select('permissions').lean()
    : null;

  if (!scoped) {
    /* Same rule as screenDenial: configured somewhere means governed
       everywhere, so a role cannot slip its restrictions by switching the
       company in the top bar. */
    const governedElsewhere = await RolePermission.exists({ role });
    return { role, governed: Boolean(governedElsewhere), screens: {} };
  }

  const screens = {};
  Object.entries(scoped.permissions || {}).forEach(([k, list]) => {
    if (Array.isArray(list) && list.length) screens[k] = list;
  });
  return { role, governed: true, screens };
}

/* The screens that legitimately look an ITEM up without being the Item
   master: Print Label, Barcode Generation (reached from a GRC), GRT scanning
   and the till. A role that may work any of those must be able to resolve an
   item code without also being granted the Item screen itself, or gating
   Item read would break four unrelated screens.

   Kept as a named list rather than left implicit, so the next person to wire
   a screen that resolves item codes knows where to add it. */
export const ITEM_LOOKUP_SCREENS = [
  '/admin/inventory/item',
  '/admin/inventory/barcode-print',
  '/admin/transaction/purchase/grc',
  '/admin/transaction/purchase/grt',
  '/admin/transaction/sell/pos',
];

/* The screens that read GENERATED BARCODE ROWS without owning them: Print
   Label prints them, and the GRT vendor-items picker chooses from them. GRC
   is here because the Print Label screen is also reached from the GRC list's
   Barcode Print action, carrying ?grc=<id>.

   Same reasoning as ITEM_LOOKUP_SCREENS: one endpoint serves several screens,
   so it answers to any of their permissions rather than to one. */
export const BARCODE_ROW_SCREENS = [
  '/admin/inventory/barcode-print',
  '/admin/transaction/purchase/grc',
  '/admin/transaction/purchase/grt',
];

/* The screens that read the generated-barcode LIST: Inventory > Barcode Item
   browses it, and the till types into it - the POS item-suggestion dropdown
   is the same query. Gating it on Barcode Item alone would take the
   suggestions away from the counter, which has nothing to do with browsing
   the barcode master. */
export const BARCODE_LIST_SCREENS = [
  '/admin/inventory/barcodeitem',
  '/admin/transaction/sell/pos',
];

/* The screens that read ONE BUSINESS RECORD without administering the Business
   master: every document that prints a company letterhead. The IC challan form
   and print view fetch both branches by id (sender and receiver), and the GRT
   list fetches the one it is standing in.

   Judged WITHOUT a business scope on purpose - see the note on the by-id GET
   in app/api/business/[id]/route.js. An IC challan names two branches, so
   scoping the letterhead to the branch being fetched would refuse the other
   company's half of a document the operator is allowed to print. */
export const BUSINESS_HEADER_SCREENS = [
  '/admin/setting/business',
  '/admin/transaction/intercompanysell/deliverychallan',
  '/admin/transaction/intercompanysell/receivedeliverychallan',
  '/admin/transaction/purchase/grt',
];

/* The screens that read ONE LOCATION RECORD without administering the Company
   Locations master: the two older stock-transfer paperwork forms, which print
   the branch's address on the document they raise.

   Unlike the business letterhead this one IS scoped, because a stock transfer
   stays inside one business - so there is a right business to judge against
   and no reason to widen it. */
export const LOCATION_HEADER_SCREENS = [
  '/admin/setting/companylocations',
  '/admin/transaction/stocktransfers/transferstockpacket',
  '/admin/transaction/stocktransfers/transferstocklocation',
];

/* The screens that read THE COUNTER LIST without administering it: the till
   fills its counter dropdown straight from /api/pos-counter rather than
   through /api/options (components/PosTill.jsx), so gating that list on the
   master alone would leave a cashier unable to say which till they are
   standing at. Choosing a counter and configuring one are different jobs. */
export const COUNTER_PICKER_SCREENS = [
  '/admin/setting/poscounter',
  '/admin/transaction/sell/pos',
];

/* The screens that READ THE ACTIVE BARCODE SETTING without administering it.
   components/GCRBarcodeGeneration.jsx pulls the list and picks the newest row
   whose effective date has passed, and that component is mounted on the GRC
   barcode-generation and GRC print pages - so generating labels would stop
   working if this answered to the master alone.

   Print Label is included because it is the other half of the same job and is
   reached from the GRC list's Barcode Print action. Reading which barcode
   format is in force is not the same as changing it: writing still needs the
   master's own permission. */
export const BARCODE_SETTING_SCREENS = [
  '/admin/setting/barcodesetting',
  '/admin/transaction/purchase/grc',
  '/admin/inventory/barcode-print',
];

/* The screens that READ THE LABEL LAYOUT without administering it. Three
   places load it to draw a sticker: components/BarcodePrintLabel.jsx (the
   Print Label screen), components/GCRBarcodeGeneration.jsx (the GRC barcode
   generation and print pages) and components/useBarcodeLabelFormat.js (the
   GRC-side barcode print page). Gating it on the master alone would stop
   labels rendering on all three.

   Choosing which fields a sticker carries is the master's own job, so writing
   still needs it. */
export const BARCODE_LABEL_SCREENS = [
  '/admin/setting/barcode-label-setting',
  '/admin/transaction/purchase/grc',
  '/admin/inventory/barcode-print',
];

/* The screens that READ THE RATE-CODE MAPPING without administering it. The
   barcode generation view encodes the purchase rate into the label with it
   (components/GCRBarcodeGeneration.jsx), so generating labels needs to read
   it - but only this master may change it, because a changed mapping makes
   every code already printed decode to a different rate. */
export const RATE_CODE_SCREENS = [
  '/admin/setting/purchase-rate-code',
  '/admin/transaction/purchase/grc',
];

/* The screens that RESOLVE A TAX RATE while a document is being written.
   components/TransactionFormView.jsx types an item code, looks the HSN up on
   /api/hsn, then reads the slab from /api/tax/<id> - and that one component
   builds GRC, GRT, Purchase Invoice, Debit Note, Sell Delivery Challan, Sales
   Invoice, Sales Return, Credit Note and Stock Adjustment. The barcode
   generation view does the same lookups.

   This is the widest of the shared lists, and for a plain reason: a role that
   may raise a document must be able to price it. Refusing the lookup would
   not hide the tax master from them - it would make every line on their
   document compute zero GST.

   ONLY THE SCREENS REGISTERED IN SCREENS CAN APPEAR HERE, because a screen
   the matrix cannot grant is a screen nobody can be given. As more document
   screens are registered, add them here too. */
const RATE_CONSUMER_SCREENS = [
  '/admin/transaction/purchase/grc',
  '/admin/transaction/purchase/grt',
  '/admin/transaction/sell/deliverychallan',
  '/admin/inventory/stock-adjustment',
];

export const HSN_LOOKUP_SCREENS = [
  '/admin/setting/hsn',
  /* the Item master both picks an HSN and quick-adds one */
  '/admin/inventory/item',
  ...RATE_CONSUMER_SCREENS,
];

export const TAX_LOOKUP_SCREENS = [
  '/admin/setting/tax',
  ...RATE_CONSUMER_SCREENS,
];

/* Allowed if ANY of `screens` grants the action - the "or" form of
   screenDenial. Returns the LAST denial when none of them does, so the
   message names something the operator can actually be granted. */
export async function screenDenialAny({ session, screens, action, businessId, label = '' }) {
  let denied = null;
  for (const screen of screens) {
    // eslint-disable-next-line no-await-in-loop
    denied = await screenDenial({ session, screen, action, businessId, label });
    if (!denied) return null;
  }
  return denied;
}

/* null when the action is allowed; { message, code } when it is not. */
export async function screenDenial({ session, screen, action, businessId, label = '' }) {
  if (!session) {
    return { message: 'Sign in to continue.', code: 'UNAUTHENTICATED' };
  }

  const role = String(session.role || '').trim();

  /* An account with no role at all is the legacy default, which lib/rbac.js
     treats as Super Admin. Matching that here keeps existing installs working. */
  if (!role || UNRESTRICTED.includes(role)) return null;

  /* A RECORD WITH NO BUSINESS OF ITS OWN.

     Several collections carry rows seeded with businessId: null - product
     groups are the documented case, which is why
     scripts/updateProductGroupsBusinessId.mjs exists. A by-id guard scopes
     on the record's own business, so for those rows there is no business to
     look a matrix up against, and falling through to the rule below would
     deny a governed role every time: the permission could never be granted,
     because there is nowhere to grant it.

     So a row belonging to no business is judged against every business: the
     role may act on it if it holds that permission ANYWHERE. Still a real
     check - a role that never holds it is refused - and it opens no route
     into another branch's data, because the row is not in a branch. */
  if (!businessId || !isValidObjectId(String(businessId))) {
    const all = await RolePermission.find({ role }).select('permissions').lean();
    if (!all.length) return null;                    // ungoverned - unchanged

    const anywhere = all.some((d) => {
      const held = (d.permissions || {})[screen];
      return Array.isArray(held) && held.includes(action);
    });
    if (anywhere) return null;

    return {
      message: 'Your role (' + role + ') is not allowed to ' + (VERB[action] || action)
        + ' ' + (label || 'this') + '. Ask an administrator to grant it on '
        + 'Staff Management > Roles & Permissions.',
      code: 'SCREEN_FORBIDDEN',
    };
  }

  const scoped = await RolePermission.findOne({ businessId, role })
    .select('permissions')
    .lean();

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
