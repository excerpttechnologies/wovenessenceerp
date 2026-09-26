


// // // import { isValidObjectId } from 'mongoose';
// // // import dbConnect from '@/lib/db';
// // // import { requireSession } from '@/lib/session';

// // // /* /api/options?ref=<name>&business=<id>
// // //    Feeds every `ref` dropdown in the app. Replaces the `options` branch of the
// // //    old /api/settings/[action] handler.

// // //    This is a model index, not a page registry - it maps a dropdown's target
// // //    name to a model file and the field to display. Nothing here renders a page. */

// // // const json = (d, s = 200) => Response.json(d, { status: s });

// // // const REFS = {
// // //   /* defaultField: rows where this field is truthy sort first and come back
// // //      flagged `isDefault`, so a picker can preselect one instead of falling back
// // //      to whatever happens to be first alphabetically. Business uses it to make
// // //      the main branch the default selection. */
// // //   business:                  { load: () => import('@/models/Business'), scoped: false, defaultField: 'isMainBranch' },
// // //   companylocations:          { load: () => import('@/models/CompanyLocation') },
// // //   ledgergroups:              { load: () => import('@/models/LedgerGroup') },
// // //   ledger:                    { load: () => import('@/models/Ledger') },
// // //   docsetup:                  { load: () => import('@/models/DocSetup') },
// // //   purchasegroup:             { load: () => import('@/models/PurchaseGroup') },
// // //   stockpoint:                { load: () => import('@/models/StockPoint') },
// // //   poscounter:                { load: () => import('@/models/PosCounter') },
// // //   paymentmethod:             { load: () => import('@/models/PaymentMethod') },
// // //   tax:                       { load: () => import('@/models/Tax') },
// // //   hsn:                       { load: () => import('@/models/Hsn') },
// // //   citygroup:                 { load: () => import('@/models/CityGroup') },
// // //   barcodesetting:            { load: () => import('@/models/BarcodeSetting') },
// // //   'purchase/master/charge':  { load: () => import('@/models/PurchaseCharge') },
// // //   'purchase/master/term':    { load: () => import('@/models/PurchaseTerm') },
// // //   'sales/master/term':       { load: () => import('@/models/SalesTerm') },

// // //   'contact-type':            { load: () => import('@/models/ContactType') },
// // //   supplier:                  { load: () => import('@/models/Contact'), kind: 'Supplier', label: 'businessName' },
// // //   agent:                     { load: () => import('@/models/Contact'), kind: 'Agent', label: 'businessName' },
// // //   customer:                  { load: () => import('@/models/Contact'), kind: 'Customer', label: 'businessName' },

// // //   'product/filter':          { load: () => import('@/models/ProductFilter') },
// // //   'product/group':           { load: () => import('@/models/ProductGroup') },
// // //   uom:                       { load: () => import('@/models/Uom') },
// // //   'attribute-addon':         { load: () => import('@/models/AttributeAddon') },
// // //   item:                      { load: () => import('@/models/Item') },
// // //   logistic:                  { load: () => import('@/models/Logistic') },

// // //   /* Transportation module */
// // //   transporter:               { load: () => import('@/models/Transporter') },
// // //   vehicle:                   { load: () => import('@/models/Vehicle') },
// // //   driver:                    { load: () => import('@/models/Driver') },
// // //   'transport-route':         { load: () => import('@/models/TransportRoute') },
// // //   dispatch:                  { load: () => import('@/models/Dispatch') },
// // //   /* consignments no dispatch has claimed yet - the Dispatch form's picker */
// // //   'delivery-unassigned':     {
// // //     load: () => import('@/models/Delivery'),
// // //     where: { $or: [{ dispatchId: null }, { dispatchId: { $exists: false } }] },
// // //   },
// // // };

// // // export async function GET(req) {
// // //   const session = await requireSession();
// // //   if (!session) return json({ error: 'Unauthorized' }, 401);

// // //   const sp = new URL(req.url).searchParams;
// // //   const ref = sp.get('ref');
// // //   const entry = REFS[ref];
// // //   if (!entry) return json({ options: [] });

// // //   await dbConnect();

// // //   const mod = await entry.load();
// // //   const Model = mod.default;
// // //   const label = entry.label || mod.LABEL_FIELD || 'name';

// // //   const filter = {};
// // //   if (entry.scoped !== false) {
// // //     const b = sp.get('business');
// // //     if (b && isValidObjectId(b)) filter.businessId = b;
// // //   }
// // //   if (entry.kind) filter.contactKind = entry.kind;
// // //   /* a ref can narrow its own pool - see 'delivery-unassigned' */
// // //   if (entry.where) Object.assign(filter, entry.where);

// // //   /* typing in the control narrows server-side - the old endpoint pulled up to
// // //      2000 rows and filtered in the browser, which does not survive 56k customers */
// // //   const q = (sp.get('q') || '').trim();
// // //   if (q) filter[label] = { $regex: escapeRegex(q), $options: 'i' };

// // //   /* the default row sorts first, so it survives the 200-row cap */
// // //   const sort = entry.defaultField
// // //     ? { [entry.defaultField]: -1, [label]: 1 }
// // //     : { [label]: 1 };

// // //   const rows = await Model.find(filter).sort(sort).limit(200).lean();

// // //   return json({
// // //     options: rows.map((r) => ({
// // //       value: String(r._id),
// // //       label: String(r[label] ?? '(untitled)'),
// // //       ...(entry.defaultField && r[entry.defaultField] ? { isDefault: true } : {}),
// // //     })),
// // //   });






 
// // import { isValidObjectId } from 'mongoose';
// // import dbConnect from '@/lib/db';
// // import { requireSession } from '@/lib/session';

// // /* A contact kind's model, in the { default } shape REFS' loaders return - from
// //    lib/contacts.js, so the supplier picker reads suppliers, the customer picker
// //    customers and the agent picker agents, wherever lib/contactStorage.js keeps
// //    them. */
// // const contactOptionsModel = (kind) => import('@/lib/contacts')
// //   .then((m) => ({ default: m.CONTACT_MODEL_BY_KIND[kind], LABEL_FIELD: m.LABEL_FIELD }));
 
// // /* /api/options?ref=<name>&business=<id>
// //    Feeds every `ref` dropdown in the app. Replaces the `options` branch of the
// //    old /api/settings/[action] handler.
 
// //    This is a model index, not a page registry - it maps a dropdown's target
// //    name to a model file and the field to display. Nothing here renders a page. */
 
// // /* no-store, explicitly. Dropdown lists change the moment somebody uses a
// //    quick-add, and without a cache directive the browser is free to answer a
// //    repeat GET from its own memory cache - so a record created seconds ago
// //    did not appear until the page was reloaded. */
// // const json = (d, s = 200) => Response.json(d, {
// //   status: s,
// //   headers: { 'Cache-Control': 'no-store' },
// // });
 
// // const REFS = {
// //   /* defaultField: rows where this field is truthy sort first and come back
// //      flagged `isDefault`, so a picker can preselect one instead of falling back
// //      to whatever happens to be first alphabetically. Business uses it to make
// //      the main branch the default selection. */
// //   business:                  { load: () => import('@/models/Business'), scoped: false, defaultField: 'isMainBranch' },
// //   companylocations:          { load: () => import('@/models/CompanyLocation') },
// //   ledgergroups:              { load: () => import('@/models/LedgerGroup') },
// //   ledger:                    { load: () => import('@/models/Ledger') },
// //   docsetup:                  { load: () => import('@/models/DocSetup') },
// //   purchasegroup:             { load: () => import('@/models/PurchaseGroup') },
// //   stockpoint:                { load: () => import('@/models/StockPoint') },
// //   poscounter:                { load: () => import('@/models/PosCounter') },
// //   /* Staff Management -> Sales Persons. Only Active people are offered:
// //      retiring someone should take them out of the till's picker without
// //      deleting the record the past bills point at. codeField appends the
// //      SP Code for display and makes it searchable, the same way supplier
// //      does with the G-code. */
// //   salesperson:               { load: () => import('@/models/SalesPerson'), where: { status: 'Active' }, codeField: 'spCode' },
// //   paymentmethod:             { load: () => import('@/models/PaymentMethod') },
// //   tax:                       { load: () => import('@/models/Tax') },
// //   hsn:                       { load: () => import('@/models/Hsn') },
// //   citygroup:                 { load: () => import('@/models/CityGroup') },
// //   barcodesetting:            { load: () => import('@/models/BarcodeSetting') },
// //   'purchase/master/charge':  { load: () => import('@/models/PurchaseCharge') },
// //   'purchase/master/term':    { load: () => import('@/models/PurchaseTerm') },
// //   'sales/master/term':       { load: () => import('@/models/SalesTerm') },
 
// //   'contact-type':            { load: () => import('@/models/ContactType') },
// //   /* The three contact forms each pick a type of their own kind - the Agent
// //      form must not offer "RETAIL" or "Vendor for Goods". contactType is the
// //      Customer/Supplier/Agent selector on the Contact Type master. */
// //   'contact-type-agent':      { load: () => import('@/models/ContactType'), where: { contactType: 'Agent' } },
// //   'contact-type-supplier':   { load: () => import('@/models/ContactType'), where: { contactType: 'Supplier' } },
// //   'contact-type-customer':   { load: () => import('@/models/ContactType'), where: { contactType: 'Customer' } },
// //   /* nameFallback: businessName is blank on a contact entered as a person -
// //      the Agent form does not even ask for it - so fall back to the personal
// //      name rather than showing "(untitled)" in every picker. This mirrors what
// //      lib/refLabels.js resolveRefLabels already does for list columns. */
// //   /* codeField: the contact's own code - "G524", "PO8", "IC16" - which the
// //      business calls the G-code and uses to identify a vendor on paper. It is
// //      appended to the label, and searched, so typing either the name or the
// //      code finds the supplier. Without it the code was invisible in every
// //      picker and unsearchable, even though lists already showed it.

// //      supplier is BUSINESS-SCOPED like the other two. It carried scoped:false,
// //      which mixed every company's vendors into one list and then truncated
// //      that list at 200 - so a company with 819 suppliers could not reach most
// //      of its own, and could pick another company's. */
// //   /* load: the kind's own model. `kind` still filters on contactKind, which is
// //      right whether the kinds share `contact` or each has its own collection. */
// //   supplier:                  { load: () => contactOptionsModel('Supplier'), kind: 'Supplier', label: 'businessName', nameFallback: ['firstName', 'lastName'], codeField: 'contactId' },
// //   agent:                     { load: () => contactOptionsModel('Agent'), kind: 'Agent', label: 'businessName', nameFallback: ['firstName', 'lastName'], codeField: 'contactId' },
// //   customer:                  { load: () => contactOptionsModel('Customer'), kind: 'Customer', label: 'businessName', nameFallback: ['firstName', 'lastName'], codeField: 'contactId' },
 
// //   'product/filter':          { load: () => import('@/models/ProductFilter') },
// //   'product/group':           { load: () => import('@/models/ProductGroup') },
// //   uom:                       { load: () => import('@/models/Uom') },
// //   'attribute-addon':         { load: () => import('@/models/AttributeAddon'), where: { name: { $nin: ['SUPPLIER DESCRIPTION', 'Supplier Description', 'supplier description'] } } },
// //   item:                      { load: () => import('@/models/Item') },
// //   logistic:                  { load: () => import('@/models/Logistic') },
 
// //   /* Transportation module */
// //   transporter:               { load: () => import('@/models/Transporter') },
// //   vehicle:                   { load: () => import('@/models/Vehicle') },
// //   driver:                    { load: () => import('@/models/Driver') },
// //   'transport-route':         { load: () => import('@/models/TransportRoute') },
// //   dispatch:                  { load: () => import('@/models/Dispatch') },
// //   /* consignments no dispatch has claimed yet - the Dispatch form's picker */
// //   'delivery-unassigned':     {
// //     load: () => import('@/models/Delivery'),
// //     where: { $or: [{ dispatchId: null }, { dispatchId: { $exists: false } }] },
// //   },
// //   'delivery-available-grc':  { load: () => import('@/models/Delivery') },
 
// //   /* Inter Company Sell */
// //   'ic-delivery-challan':      { load: () => import('@/models/IcDeliveryChallan') },
// //   'ic-sales-invoice':         { load: () => import('@/models/IcSalesInvoice') },
// //   'ic-auto-purchase-return':  { load: () => import('@/models/IcAutoPurchaseReturn') },
// //   'ic-sales-return':          { load: () => import('@/models/IcSalesReturn') },
// //   /* challans not yet pulled into an inter company sales invoice */
// //   'ic-delivery-challan-open': {
// //     load: () => import('@/models/IcDeliveryChallan'),
// //     where: { $or: [{ icSalesInvoiceId: null }, { icSalesInvoiceId: { $exists: false } }] },
// //   },

// //   /* Stock Transfers */
// //   'stock-transfer-packet':   { load: () => import('@/models/StockTransferPacket') },
// //   'stock-transfer-location': { load: () => import('@/models/StockTransferLocation') },
// //   'stock-transfer-received': { load: () => import('@/models/StockTransferReceived') },
// //   /* packets not yet consolidated into a stock transfer location */
// //   'stock-transfer-packet-open': {
// //     load: () => import('@/models/StockTransferPacket'),
// //     where: {
// //       $or: [
// //         { stockTransferLocationId: null },
// //         { stockTransferLocationId: { $exists: false } },
// //       ],
// //     },
// //   },
// // };
 
// // export async function GET(req) {
// //   const session = await requireSession();
// //   if (!session) return json({ error: 'Unauthorized' }, 401);
 
// //   const sp = new URL(req.url).searchParams;
// //   const ref = sp.get('ref');
// //   const entry = REFS[ref];
// //   if (!entry) return json({ options: [] });
 
// //   await dbConnect();
 
// //   const mod = await entry.load();
// //   const Model = mod.default;
// //   const label = entry.label || mod.LABEL_FIELD || 'name';
 
// //   const filter = {};
// //   if (entry.scoped !== false) {
// //     const b = sp.get('business');
// //     if (b && isValidObjectId(b)) filter.businessId = b;
// //   }
// //   if (entry.kind) filter.contactKind = entry.kind;
// //   /* a ref can narrow its own pool - see 'delivery-unassigned' */
// //   if (entry.where) Object.assign(filter, entry.where);
 
// //   /* typing in the control narrows server-side - the old endpoint pulled up to
// //      2000 rows and filtered in the browser, which does not survive 56k customers */
// //   const q = (sp.get('q') || '').trim();
// //   if (q) {
// //     const rx = { $regex: escapeRegex(q), $options: 'i' };
// //     if (entry.nameFallback || entry.codeField) {
// //       /* Search the label, the fallback name fields AND the code.

// //          The fallbacks matter because businessName is empty on a contact
// //          entered as a person - typing "DIRECT" found nothing for them. The
// //          code matters because the business identifies a vendor by its G-code
// //          as often as by its name: typing "G524" must find the same supplier
// //          as typing "KARNATAKA".

// //          Wrapped in $and so it cannot collide with a ref that already uses
// //          $or in its own `where`. */
// //       (filter.$and ||= []).push({
// //         $or: [
// //           { [label]: rx },
// //           ...(entry.nameFallback || []).map((f) => ({ [f]: rx })),
// //           ...(entry.codeField ? [{ [entry.codeField]: rx }] : []),
// //         ],
// //       });
// //     } else {
// //       filter[label] = rx;
// //     }
// //   }
  
// //   /* Ensure SUPPLIER DESCRIPTION is always excluded */
// //   if (ref === 'attribute-addon') {
// //     (filter.$and ||= []).push({ name: { $nin: ['SUPPLIER DESCRIPTION', 'Supplier Description', 'supplier description'] } });
// //   }
 
// //   /* the default row sorts first, so it survives the 200-row cap */
// //   const sort = ref === 'supplier'
// //     ? { createdAt: -1, [label]: 1 }
// //     : entry.defaultField
// //     ? { [entry.defaultField]: -1, [label]: 1 }
// //     : { [label]: 1 };
 
// //   const rows = await Model.find(filter).sort(sort).limit(200).lean();

// //   /* label, or the fallback name fields, or "(untitled)" - see nameFallback */
// //   const textOf = (r) => {
// //     if (ref === 'uom') {
// //       return [r[label], r.shortName].map((value) => String(value || '').trim()).filter(Boolean).join(' / ');
// //     }
// //     const primary = String(r[label] ?? '').trim();
// //     if (primary) return primary;
// //     const alt = (entry.nameFallback || [])
// //       .map((f) => String(r[f] ?? '').trim())
// //       .filter(Boolean)
// //       .join(' ');
// //     return alt || '(untitled)';
// //   };

// //   /* "KARNATAKA Saree Centre, MYSORE (G524)".

// //      The code is appended for DISPLAY only - `value` stays the ObjectId, so
// //      what gets stored is the reference and never the formatted text. A
// //      supplier without a code simply shows its name. */
// //   const labelOf = (r) => {
// //     const name = textOf(r);
// //     const code = entry.codeField ? String(r[entry.codeField] ?? '').trim() : '';
// //     return code ? name + ' (' + code + ')' : name;
// //   };

// //   return json({
// //     options: rows.map((r) => ({
// //       value: String(r._id),
// //       label: labelOf(r),
// //       /* the parts, unformatted, for a caller that needs them on their own */
// //       name: textOf(r),
// //       ...(entry.codeField ? { code: String(r[entry.codeField] ?? '') } : {}),
// //       ...(entry.codeField === 'contactId' ? { gstNo: String(r.gstNo ?? '') } : {}),
// //       ...(entry.defaultField && r[entry.defaultField] ? { isDefault: true } : {}),
// //     })),
// //   });
// // }
 
// // function escapeRegex(s) {
// //   return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// // }









// // import { isValidObjectId } from 'mongoose';
// // import dbConnect from '@/lib/db';
// // import { requireSession } from '@/lib/session';

// // /* /api/options?ref=<name>&business=<id>
// //    Feeds every `ref` dropdown in the app. Replaces the `options` branch of the
// //    old /api/settings/[action] handler.

// //    This is a model index, not a page registry - it maps a dropdown's target
// //    name to a model file and the field to display. Nothing here renders a page. */

// // const json = (d, s = 200) => Response.json(d, { status: s });

// // const REFS = {
// //   /* defaultField: rows where this field is truthy sort first and come back
// //      flagged `isDefault`, so a picker can preselect one instead of falling back
// //      to whatever happens to be first alphabetically. Business uses it to make
// //      the main branch the default selection. */
// //   business:                  { load: () => import('@/models/Business'), scoped: false, defaultField: 'isMainBranch' },
// //   companylocations:          { load: () => import('@/models/CompanyLocation') },
// //   ledgergroups:              { load: () => import('@/models/LedgerGroup') },
// //   ledger:                    { load: () => import('@/models/Ledger') },
// //   docsetup:                  { load: () => import('@/models/DocSetup') },
// //   purchasegroup:             { load: () => import('@/models/PurchaseGroup') },
// //   stockpoint:                { load: () => import('@/models/StockPoint') },
// //   poscounter:                { load: () => import('@/models/PosCounter') },
// //   paymentmethod:             { load: () => import('@/models/PaymentMethod') },
// //   tax:                       { load: () => import('@/models/Tax') },
// //   hsn:                       { load: () => import('@/models/Hsn') },
// //   citygroup:                 { load: () => import('@/models/CityGroup') },
// //   barcodesetting:            { load: () => import('@/models/BarcodeSetting') },
// //   'purchase/master/charge':  { load: () => import('@/models/PurchaseCharge') },
// //   'purchase/master/term':    { load: () => import('@/models/PurchaseTerm') },
// //   'sales/master/term':       { load: () => import('@/models/SalesTerm') },

// //   'contact-type':            { load: () => import('@/models/ContactType') },
// //   supplier:                  { load: () => import('@/models/Contact'), kind: 'Supplier', label: 'businessName' },
// //   agent:                     { load: () => import('@/models/Contact'), kind: 'Agent', label: 'businessName' },
// //   customer:                  { load: () => import('@/models/Contact'), kind: 'Customer', label: 'businessName' },

// //   'product/filter':          { load: () => import('@/models/ProductFilter') },
// //   'product/group':           { load: () => import('@/models/ProductGroup') },
// //   uom:                       { load: () => import('@/models/Uom') },
// //   'attribute-addon':         { load: () => import('@/models/AttributeAddon') },
// //   item:                      { load: () => import('@/models/Item') },
// //   logistic:                  { load: () => import('@/models/Logistic') },

// //   /* Transportation module */
// //   transporter:               { load: () => import('@/models/Transporter') },
// //   vehicle:                   { load: () => import('@/models/Vehicle') },
// //   driver:                    { load: () => import('@/models/Driver') },
// //   'transport-route':         { load: () => import('@/models/TransportRoute') },
// //   dispatch:                  { load: () => import('@/models/Dispatch') },
// //   /* consignments no dispatch has claimed yet - the Dispatch form's picker */
// //   'delivery-unassigned':     {
// //     load: () => import('@/models/Delivery'),
// //     where: { $or: [{ dispatchId: null }, { dispatchId: { $exists: false } }] },
// //   },
// // };

// // export async function GET(req) {
// //   const session = await requireSession();
// //   if (!session) return json({ error: 'Unauthorized' }, 401);

// //   const sp = new URL(req.url).searchParams;
// //   const ref = sp.get('ref');
// //   const entry = REFS[ref];
// //   if (!entry) return json({ options: [] });

// //   await dbConnect();

// //   const mod = await entry.load();
// //   const Model = mod.default;
// //   const label = entry.label || mod.LABEL_FIELD || 'name';

// //   const filter = {};
// //   if (entry.scoped !== false) {
// //     const b = sp.get('business');
// //     if (b && isValidObjectId(b)) filter.businessId = b;
// //   }
// //   if (entry.kind) filter.contactKind = entry.kind;
// //   /* a ref can narrow its own pool - see 'delivery-unassigned' */
// //   if (entry.where) Object.assign(filter, entry.where);

// //   /* typing in the control narrows server-side - the old endpoint pulled up to
// //      2000 rows and filtered in the browser, which does not survive 56k customers */
// //   const q = (sp.get('q') || '').trim();
// //   if (q) filter[label] = { $regex: escapeRegex(q), $options: 'i' };

// //   /* the default row sorts first, so it survives the 200-row cap */
// //   const sort = entry.defaultField
// //     ? { [entry.defaultField]: -1, [label]: 1 }
// //     : { [label]: 1 };

// //   const rows = await Model.find(filter).sort(sort).limit(200).lean();

// //   return json({
// //     options: rows.map((r) => ({
// //       value: String(r._id),
// //       label: String(r[label] ?? '(untitled)'),
// //       ...(entry.defaultField && r[entry.defaultField] ? { isDefault: true } : {}),
// //     })),
// //   });






 
// import { isValidObjectId } from 'mongoose';
// import dbConnect from '@/lib/db';
// import { requireSession } from '@/lib/session';
 
// /* /api/options?ref=<name>&business=<id>
//    Feeds every `ref` dropdown in the app. Replaces the `options` branch of the
//    old /api/settings/[action] handler.
 
//    This is a model index, not a page registry - it maps a dropdown's target
//    name to a model file and the field to display. Nothing here renders a page. */
 
// /* no-store, explicitly. Dropdown lists change the moment somebody uses a
//    quick-add, and without a cache directive the browser is free to answer a
//    repeat GET from its own memory cache - so a record created seconds ago
//    did not appear until the page was reloaded. */
// const json = (d, s = 200) => Response.json(d, {
//   status: s,
//   headers: { 'Cache-Control': 'no-store' },
// });
 
// const REFS = {
//   /* defaultField: rows where this field is truthy sort first and come back
//      flagged `isDefault`, so a picker can preselect one instead of falling back
//      to whatever happens to be first alphabetically. Business uses it to make
//      the main branch the default selection. */
//   business:                  { load: () => import('@/models/Business'), scoped: false, defaultField: 'isMainBranch' },
//   companylocations:          { load: () => import('@/models/CompanyLocation') },
//   ledgergroups:              { load: () => import('@/models/LedgerGroup') },
//   ledger:                    { load: () => import('@/models/Ledger') },
//   docsetup:                  { load: () => import('@/models/DocSetup') },
//   purchasegroup:             { load: () => import('@/models/PurchaseGroup') },
//   /* locationScoped: a stock point belongs to ONE location, so offering the
//      whole business's list lets an operator standing in the warehouse pick a
//      stock point that physically sits in another branch location. */
//   stockpoint:                { load: () => import('@/models/StockPoint'), locationScoped: true },
//   poscounter:                { load: () => import('@/models/PosCounter') },
//   /* Staff Management -> Sales Persons. Only Active people are offered:
//      retiring someone should take them out of the till's picker without
//      deleting the record the past bills point at. codeField appends the
//      SP Code for display and makes it searchable, the same way supplier
//      does with the G-code. */
//   salesperson:               { load: () => import('@/models/SalesPerson'), where: { status: 'Active' }, codeField: 'spCode' },
//   paymentmethod:             { load: () => import('@/models/PaymentMethod') },
//   tax:                       { load: () => import('@/models/Tax') },
//   hsn:                       { load: () => import('@/models/Hsn') },
//   citygroup:                 { load: () => import('@/models/CityGroup') },
//   barcodesetting:            { load: () => import('@/models/BarcodeSetting') },
//   'purchase/master/charge':  { load: () => import('@/models/PurchaseCharge') },
//   'purchase/master/term':    { load: () => import('@/models/PurchaseTerm') },
//   'sales/master/term':       { load: () => import('@/models/SalesTerm') },
 
//   'contact-type':            { load: () => import('@/models/ContactType') },
//   /* The three contact forms each pick a type of their own kind - the Agent
//      form must not offer "RETAIL" or "Vendor for Goods". contactType is the
//      Customer/Supplier/Agent selector on the Contact Type master. */
//   'contact-type-agent':      { load: () => import('@/models/ContactType'), where: { contactType: 'Agent' } },
//   'contact-type-supplier':   { load: () => import('@/models/ContactType'), where: { contactType: 'Supplier' } },
//   'contact-type-customer':   { load: () => import('@/models/ContactType'), where: { contactType: 'Customer' } },
//   /* nameFallback: businessName is blank on a contact entered as a person -
//      the Agent form does not even ask for it - so fall back to the personal
//      name rather than showing "(untitled)" in every picker. This mirrors what
//      lib/refLabels.js resolveRefLabels already does for list columns. */
//   /* codeField: the contact's own code - "G524", "PO8", "IC16" - which the
//      business calls the G-code and uses to identify a vendor on paper. It is
//      appended to the label, and searched, so typing either the name or the
//      code finds the supplier. Without it the code was invisible in every
//      picker and unsearchable, even though lists already showed it.

//      supplier is BUSINESS-SCOPED like the other two. It carried scoped:false,
//      which mixed every company's vendors into one list and then truncated
//      that list at 200 - so a company with 819 suppliers could not reach most
//      of its own, and could pick another company's. */
//   supplier:                  { load: () => import('@/models/Contact'), kind: 'Supplier', label: 'businessName', nameFallback: ['firstName', 'lastName'], codeField: 'contactId' },
//   agent:                     { load: () => import('@/models/Contact'), kind: 'Agent', label: 'businessName', nameFallback: ['firstName', 'lastName'], codeField: 'contactId' },
//   customer:                  { load: () => import('@/models/Contact'), kind: 'Customer', label: 'businessName', nameFallback: ['firstName', 'lastName'], codeField: 'contactId' },
 
//   'product/filter':          { load: () => import('@/models/ProductFilter') },
//   'product/group':           { load: () => import('@/models/ProductGroup') },
//   uom:                       { load: () => import('@/models/Uom') },
//   'attribute-addon':         { load: () => import('@/models/AttributeAddon'), where: { name: { $nin: ['SUPPLIER DESCRIPTION', 'Supplier Description', 'supplier description'] } } },
//   item:                      { load: () => import('@/models/Item') },
//   logistic:                  { load: () => import('@/models/Logistic') },
 
//   /* Transportation module */
//   transporter:               { load: () => import('@/models/Transporter') },
//   vehicle:                   { load: () => import('@/models/Vehicle') },
//   driver:                    { load: () => import('@/models/Driver') },
//   'transport-route':         { load: () => import('@/models/TransportRoute') },
//   dispatch:                  { load: () => import('@/models/Dispatch') },
//   /* consignments no dispatch has claimed yet - the Dispatch form's picker */
//   'delivery-unassigned':     {
//     load: () => import('@/models/Delivery'),
//     where: { $or: [{ dispatchId: null }, { dispatchId: { $exists: false } }] },
//   },
//   'delivery-available-grc':  { load: () => import('@/models/Delivery') },
 
//   /* Inter Company Sell */
//   'ic-delivery-challan':      { load: () => import('@/models/IcDeliveryChallan') },
//   'ic-sales-invoice':         { load: () => import('@/models/IcSalesInvoice') },
//   'ic-auto-purchase-return':  { load: () => import('@/models/IcAutoPurchaseReturn') },
//   'ic-sales-return':          { load: () => import('@/models/IcSalesReturn') },
//   /* challans not yet pulled into an inter company sales invoice */
//   'ic-delivery-challan-open': {
//     load: () => import('@/models/IcDeliveryChallan'),
//     where: { $or: [{ icSalesInvoiceId: null }, { icSalesInvoiceId: { $exists: false } }] },
//   },

//   /* Stock Transfers */
//   'stock-transfer-packet':   { load: () => import('@/models/StockTransferPacket') },
//   'stock-transfer-location': { load: () => import('@/models/StockTransferLocation') },
//   'stock-transfer-received': { load: () => import('@/models/StockTransferReceived') },
//   /* packets not yet consolidated into a stock transfer location */
//   'stock-transfer-packet-open': {
//     load: () => import('@/models/StockTransferPacket'),
//     where: {
//       $or: [
//         { stockTransferLocationId: null },
//         { stockTransferLocationId: { $exists: false } },
//       ],
//     },
//   },
// };
 
// export async function GET(req) {
//   const session = await requireSession();
//   if (!session) return json({ error: 'Unauthorized' }, 401);
 
//   const sp = new URL(req.url).searchParams;
//   const ref = sp.get('ref');
//   const entry = REFS[ref];
//   if (!entry) return json({ options: [] });
 
//   await dbConnect();
 
//   const mod = await entry.load();
//   const Model = mod.default;
//   const label = entry.label || mod.LABEL_FIELD || 'name';
 
//   const filter = {};
//   if (entry.scoped !== false) {
//     const b = sp.get('business');
//     if (b && isValidObjectId(b)) filter.businessId = b;
//   }
//   /* Narrow to the top bar's LOCATION as well, for refs that live at one.

//      Opt-in per ref, not global: most refs are business-wide (and
//      companylocations must never be filtered by the location it is used to
//      choose). useOptions already sends `location`; until now nothing read it.

//      A row with no locationId is a business-wide one and stays visible - some
//      businesses never assigned stock points to a location, and a strict match
//      would leave their dropdown empty. */
//   if (entry.locationScoped) {
//     const l = sp.get('location');
//     if (l && isValidObjectId(l)) {
//       filter.$and = [...(filter.$and || []), { $or: [{ locationId: l }, { locationId: null }] }];
//     }
//   }
//   if (entry.kind) filter.contactKind = entry.kind;
//   /* a ref can narrow its own pool - see 'delivery-unassigned' */
//   if (entry.where) Object.assign(filter, entry.where);
 
//   /* typing in the control narrows server-side - the old endpoint pulled up to
//      2000 rows and filtered in the browser, which does not survive 56k customers */
//   const q = (sp.get('q') || '').trim();
//   if (q) {
//     const rx = { $regex: escapeRegex(q), $options: 'i' };
//     if (entry.nameFallback || entry.codeField) {
//       /* Search the label, the fallback name fields AND the code.

//          The fallbacks matter because businessName is empty on a contact
//          entered as a person - typing "DIRECT" found nothing for them. The
//          code matters because the business identifies a vendor by its G-code
//          as often as by its name: typing "G524" must find the same supplier
//          as typing "KARNATAKA".

//          Wrapped in $and so it cannot collide with a ref that already uses
//          $or in its own `where`. */
//       (filter.$and ||= []).push({
//         $or: [
//           { [label]: rx },
//           ...(entry.nameFallback || []).map((f) => ({ [f]: rx })),
//           ...(entry.codeField ? [{ [entry.codeField]: rx }] : []),
//         ],
//       });
//     } else {
//       filter[label] = rx;
//     }
//   }
  
//   /* Ensure SUPPLIER DESCRIPTION is always excluded */
//   if (ref === 'attribute-addon') {
//     (filter.$and ||= []).push({ name: { $nin: ['SUPPLIER DESCRIPTION', 'Supplier Description', 'supplier description'] } });
//   }
 
//   /* the default row sorts first, so it survives the 200-row cap */
//   const sort = ref === 'supplier'
//     ? { createdAt: -1, [label]: 1 }
//     : entry.defaultField
//     ? { [entry.defaultField]: -1, [label]: 1 }
//     : { [label]: 1 };
 
//   const rows = await Model.find(filter).sort(sort).limit(200).lean();

//   /* label, or the fallback name fields, or "(untitled)" - see nameFallback */
//   const textOf = (r) => {
//     if (ref === 'uom') {
//       return [r[label], r.shortName].map((value) => String(value || '').trim()).filter(Boolean).join(' / ');
//     }
//     const primary = String(r[label] ?? '').trim();
//     if (primary) return primary;
//     const alt = (entry.nameFallback || [])
//       .map((f) => String(r[f] ?? '').trim())
//       .filter(Boolean)
//       .join(' ');
//     return alt || '(untitled)';
//   };

//   /* "KARNATAKA Saree Centre, MYSORE (G524)".

//      The code is appended for DISPLAY only - `value` stays the ObjectId, so
//      what gets stored is the reference and never the formatted text. A
//      supplier without a code simply shows its name. */
//   const labelOf = (r) => {
//     const name = textOf(r);
//     const code = entry.codeField ? String(r[entry.codeField] ?? '').trim() : '';
//     return code ? name + ' (' + code + ')' : name;
//   };

//   return json({
//     options: rows.map((r) => ({
//       value: String(r._id),
//       label: labelOf(r),
//       /* the parts, unformatted, for a caller that needs them on their own */
//       name: textOf(r),
//       ...(entry.codeField ? { code: String(r[entry.codeField] ?? '') } : {}),
//       ...(entry.codeField === 'contactId' ? { gstNo: String(r.gstNo ?? '') } : {}),
//       ...(entry.defaultField && r[entry.defaultField] ? { isDefault: true } : {}),
//     })),
//   });
// }
 
// function escapeRegex(s) {
//   return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// }




























/////suhas






// // import { isValidObjectId } from 'mongoose';
// // import dbConnect from '@/lib/db';
// // import { requireSession } from '@/lib/session';

// // /* /api/options?ref=<name>&business=<id>
// //    Feeds every `ref` dropdown in the app. Replaces the `options` branch of the
// //    old /api/settings/[action] handler.

// //    This is a model index, not a page registry - it maps a dropdown's target
// //    name to a model file and the field to display. Nothing here renders a page. */

// // const json = (d, s = 200) => Response.json(d, { status: s });

// // const REFS = {
// //   /* defaultField: rows where this field is truthy sort first and come back
// //      flagged `isDefault`, so a picker can preselect one instead of falling back
// //      to whatever happens to be first alphabetically. Business uses it to make
// //      the main branch the default selection. */
// //   business:                  { load: () => import('@/models/Business'), scoped: false, defaultField: 'isMainBranch' },
// //   companylocations:          { load: () => import('@/models/CompanyLocation') },
// //   ledgergroups:              { load: () => import('@/models/LedgerGroup') },
// //   ledger:                    { load: () => import('@/models/Ledger') },
// //   docsetup:                  { load: () => import('@/models/DocSetup') },
// //   purchasegroup:             { load: () => import('@/models/PurchaseGroup') },
// //   stockpoint:                { load: () => import('@/models/StockPoint') },
// //   poscounter:                { load: () => import('@/models/PosCounter') },
// //   paymentmethod:             { load: () => import('@/models/PaymentMethod') },
// //   tax:                       { load: () => import('@/models/Tax') },
// //   hsn:                       { load: () => import('@/models/Hsn') },
// //   citygroup:                 { load: () => import('@/models/CityGroup') },
// //   barcodesetting:            { load: () => import('@/models/BarcodeSetting') },
// //   'purchase/master/charge':  { load: () => import('@/models/PurchaseCharge') },
// //   'purchase/master/term':    { load: () => import('@/models/PurchaseTerm') },
// //   'sales/master/term':       { load: () => import('@/models/SalesTerm') },

// //   'contact-type':            { load: () => import('@/models/ContactType') },
// //   supplier:                  { load: () => import('@/models/Contact'), kind: 'Supplier', label: 'businessName' },
// //   agent:                     { load: () => import('@/models/Contact'), kind: 'Agent', label: 'businessName' },
// //   customer:                  { load: () => import('@/models/Contact'), kind: 'Customer', label: 'businessName' },

// //   'product/filter':          { load: () => import('@/models/ProductFilter') },
// //   'product/group':           { load: () => import('@/models/ProductGroup') },
// //   uom:                       { load: () => import('@/models/Uom') },
// //   'attribute-addon':         { load: () => import('@/models/AttributeAddon') },
// //   item:                      { load: () => import('@/models/Item') },
// //   logistic:                  { load: () => import('@/models/Logistic') },

// //   /* Transportation module */
// //   transporter:               { load: () => import('@/models/Transporter') },
// //   vehicle:                   { load: () => import('@/models/Vehicle') },
// //   driver:                    { load: () => import('@/models/Driver') },
// //   'transport-route':         { load: () => import('@/models/TransportRoute') },
// //   dispatch:                  { load: () => import('@/models/Dispatch') },
// //   /* consignments no dispatch has claimed yet - the Dispatch form's picker */
// //   'delivery-unassigned':     {
// //     load: () => import('@/models/Delivery'),
// //     where: { $or: [{ dispatchId: null }, { dispatchId: { $exists: false } }] },
// //   },
// // };

// // export async function GET(req) {
// //   const session = await requireSession();
// //   if (!session) return json({ error: 'Unauthorized' }, 401);

// //   const sp = new URL(req.url).searchParams;
// //   const ref = sp.get('ref');
// //   const entry = REFS[ref];
// //   if (!entry) return json({ options: [] });

// //   await dbConnect();

// //   const mod = await entry.load();
// //   const Model = mod.default;
// //   const label = entry.label || mod.LABEL_FIELD || 'name';

// //   const filter = {};
// //   if (entry.scoped !== false) {
// //     const b = sp.get('business');
// //     if (b && isValidObjectId(b)) filter.businessId = b;
// //   }
// //   if (entry.kind) filter.contactKind = entry.kind;
// //   /* a ref can narrow its own pool - see 'delivery-unassigned' */
// //   if (entry.where) Object.assign(filter, entry.where);

// //   /* typing in the control narrows server-side - the old endpoint pulled up to
// //      2000 rows and filtered in the browser, which does not survive 56k customers */
// //   const q = (sp.get('q') || '').trim();
// //   if (q) filter[label] = { $regex: escapeRegex(q), $options: 'i' };

// //   /* the default row sorts first, so it survives the 200-row cap */
// //   const sort = entry.defaultField
// //     ? { [entry.defaultField]: -1, [label]: 1 }
// //     : { [label]: 1 };

// //   const rows = await Model.find(filter).sort(sort).limit(200).lean();

// //   return json({
// //     options: rows.map((r) => ({
// //       value: String(r._id),
// //       label: String(r[label] ?? '(untitled)'),
// //       ...(entry.defaultField && r[entry.defaultField] ? { isDefault: true } : {}),
// //     })),
// //   });






 
// import { isValidObjectId } from 'mongoose';
// import dbConnect from '@/lib/db';
// import { requireSession } from '@/lib/session';

// /* A contact kind's model, in the { default } shape REFS' loaders return - from
//    lib/contacts.js, so the supplier picker reads suppliers, the customer picker
//    customers and the agent picker agents, wherever lib/contactStorage.js keeps
//    them. */
// const contactOptionsModel = (kind) => import('@/lib/contacts')
//   .then((m) => ({ default: m.CONTACT_MODEL_BY_KIND[kind], LABEL_FIELD: m.LABEL_FIELD }));
 
// /* /api/options?ref=<name>&business=<id>
//    Feeds every `ref` dropdown in the app. Replaces the `options` branch of the
//    old /api/settings/[action] handler.
 
//    This is a model index, not a page registry - it maps a dropdown's target
//    name to a model file and the field to display. Nothing here renders a page. */
 
// /* no-store, explicitly. Dropdown lists change the moment somebody uses a
//    quick-add, and without a cache directive the browser is free to answer a
//    repeat GET from its own memory cache - so a record created seconds ago
//    did not appear until the page was reloaded. */
// const json = (d, s = 200) => Response.json(d, {
//   status: s,
//   headers: { 'Cache-Control': 'no-store' },
// });
 
// const REFS = {
//   /* defaultField: rows where this field is truthy sort first and come back
//      flagged `isDefault`, so a picker can preselect one instead of falling back
//      to whatever happens to be first alphabetically. Business uses it to make
//      the main branch the default selection. */
//   business:                  { load: () => import('@/models/Business'), scoped: false, defaultField: 'isMainBranch' },
//   companylocations:          { load: () => import('@/models/CompanyLocation') },
//   ledgergroups:              { load: () => import('@/models/LedgerGroup') },
//   ledger:                    { load: () => import('@/models/Ledger') },
//   docsetup:                  { load: () => import('@/models/DocSetup') },
//   purchasegroup:             { load: () => import('@/models/PurchaseGroup') },
//   stockpoint:                { load: () => import('@/models/StockPoint') },
//   poscounter:                { load: () => import('@/models/PosCounter') },
//   /* Staff Management -> Sales Persons. Only Active people are offered:
//      retiring someone should take them out of the till's picker without
//      deleting the record the past bills point at. codeField appends the
//      SP Code for display and makes it searchable, the same way supplier
//      does with the G-code. */
//   salesperson:               { load: () => import('@/models/SalesPerson'), where: { status: 'Active' }, codeField: 'spCode' },
//   paymentmethod:             { load: () => import('@/models/PaymentMethod') },
//   tax:                       { load: () => import('@/models/Tax') },
//   hsn:                       { load: () => import('@/models/Hsn') },
//   citygroup:                 { load: () => import('@/models/CityGroup') },
//   barcodesetting:            { load: () => import('@/models/BarcodeSetting') },
//   'purchase/master/charge':  { load: () => import('@/models/PurchaseCharge') },
//   'purchase/master/term':    { load: () => import('@/models/PurchaseTerm') },
//   'sales/master/term':       { load: () => import('@/models/SalesTerm') },
 
//   'contact-type':            { load: () => import('@/models/ContactType') },
//   /* The three contact forms each pick a type of their own kind - the Agent
//      form must not offer "RETAIL" or "Vendor for Goods". contactType is the
//      Customer/Supplier/Agent selector on the Contact Type master. */
//   'contact-type-agent':      { load: () => import('@/models/ContactType'), where: { contactType: 'Agent' } },
//   'contact-type-supplier':   { load: () => import('@/models/ContactType'), where: { contactType: 'Supplier' } },
//   'contact-type-customer':   { load: () => import('@/models/ContactType'), where: { contactType: 'Customer' } },
//   /* nameFallback: businessName is blank on a contact entered as a person -
//      the Agent form does not even ask for it - so fall back to the personal
//      name rather than showing "(untitled)" in every picker. This mirrors what
//      lib/refLabels.js resolveRefLabels already does for list columns. */
//   /* codeField: the contact's own code - "G524", "PO8", "IC16" - which the
//      business calls the G-code and uses to identify a vendor on paper. It is
//      appended to the label, and searched, so typing either the name or the
//      code finds the supplier. Without it the code was invisible in every
//      picker and unsearchable, even though lists already showed it.

//      supplier is BUSINESS-SCOPED like the other two. It carried scoped:false,
//      which mixed every company's vendors into one list and then truncated
//      that list at 200 - so a company with 819 suppliers could not reach most
//      of its own, and could pick another company's. */
//   /* load: the kind's own model. `kind` still filters on contactKind, which is
//      right whether the kinds share `contact` or each has its own collection. */
//   supplier:                  { load: () => contactOptionsModel('Supplier'), kind: 'Supplier', label: 'businessName', nameFallback: ['firstName', 'lastName'], codeField: 'contactId' },
//   agent:                     { load: () => contactOptionsModel('Agent'), kind: 'Agent', label: 'businessName', nameFallback: ['firstName', 'lastName'], codeField: 'contactId' },
//   customer:                  { load: () => contactOptionsModel('Customer'), kind: 'Customer', label: 'businessName', nameFallback: ['firstName', 'lastName'], codeField: 'contactId' },
 
//   'product/filter':          { load: () => import('@/models/ProductFilter') },
//   'product/group':           { load: () => import('@/models/ProductGroup') },
//   uom:                       { load: () => import('@/models/Uom') },
//   'attribute-addon':         { load: () => import('@/models/AttributeAddon'), where: { name: { $nin: ['SUPPLIER DESCRIPTION', 'Supplier Description', 'supplier description'] } } },
//   item:                      { load: () => import('@/models/Item') },
//   logistic:                  { load: () => import('@/models/Logistic') },
 
//   /* Transportation module */
//   transporter:               { load: () => import('@/models/Transporter') },
//   vehicle:                   { load: () => import('@/models/Vehicle') },
//   driver:                    { load: () => import('@/models/Driver') },
//   'transport-route':         { load: () => import('@/models/TransportRoute') },
//   dispatch:                  { load: () => import('@/models/Dispatch') },
//   /* consignments no dispatch has claimed yet - the Dispatch form's picker */
//   'delivery-unassigned':     {
//     load: () => import('@/models/Delivery'),
//     where: { $or: [{ dispatchId: null }, { dispatchId: { $exists: false } }] },
//   },
//   'delivery-available-grc':  { load: () => import('@/models/Delivery') },
 
//   /* Inter Company Sell */
//   'ic-delivery-challan':      { load: () => import('@/models/IcDeliveryChallan') },
//   'ic-sales-invoice':         { load: () => import('@/models/IcSalesInvoice') },
//   'ic-auto-purchase-return':  { load: () => import('@/models/IcAutoPurchaseReturn') },
//   'ic-sales-return':          { load: () => import('@/models/IcSalesReturn') },
//   /* challans not yet pulled into an inter company sales invoice */
//   'ic-delivery-challan-open': {
//     load: () => import('@/models/IcDeliveryChallan'),
//     where: { $or: [{ icSalesInvoiceId: null }, { icSalesInvoiceId: { $exists: false } }] },
//   },

//   /* Stock Transfers */
//   'stock-transfer-packet':   { load: () => import('@/models/StockTransferPacket') },
//   'stock-transfer-location': { load: () => import('@/models/StockTransferLocation') },
//   'stock-transfer-received': { load: () => import('@/models/StockTransferReceived') },
//   /* packets not yet consolidated into a stock transfer location */
//   'stock-transfer-packet-open': {
//     load: () => import('@/models/StockTransferPacket'),
//     where: {
//       $or: [
//         { stockTransferLocationId: null },
//         { stockTransferLocationId: { $exists: false } },
//       ],
//     },
//   },
// };
 
// export async function GET(req) {
//   const session = await requireSession();
//   if (!session) return json({ error: 'Unauthorized' }, 401);
 
//   const sp = new URL(req.url).searchParams;
//   const ref = sp.get('ref');
//   const entry = REFS[ref];
//   if (!entry) return json({ options: [] });
 
//   await dbConnect();
 
//   const mod = await entry.load();
//   const Model = mod.default;
//   const label = entry.label || mod.LABEL_FIELD || 'name';
 
//   const filter = {};
//   if (entry.scoped !== false) {
//     const b = sp.get('business');
//     if (b && isValidObjectId(b)) filter.businessId = b;
//   }
//   if (entry.kind) filter.contactKind = entry.kind;
//   /* a ref can narrow its own pool - see 'delivery-unassigned' */
//   if (entry.where) Object.assign(filter, entry.where);
 
//   /* typing in the control narrows server-side - the old endpoint pulled up to
//      2000 rows and filtered in the browser, which does not survive 56k customers */
//   const q = (sp.get('q') || '').trim();
//   if (q) {
//     const rx = { $regex: escapeRegex(q), $options: 'i' };
//     if (entry.nameFallback || entry.codeField) {
//       /* Search the label, the fallback name fields AND the code.

//          The fallbacks matter because businessName is empty on a contact
//          entered as a person - typing "DIRECT" found nothing for them. The
//          code matters because the business identifies a vendor by its G-code
//          as often as by its name: typing "G524" must find the same supplier
//          as typing "KARNATAKA".

//          Wrapped in $and so it cannot collide with a ref that already uses
//          $or in its own `where`. */
//       (filter.$and ||= []).push({
//         $or: [
//           { [label]: rx },
//           ...(entry.nameFallback || []).map((f) => ({ [f]: rx })),
//           ...(entry.codeField ? [{ [entry.codeField]: rx }] : []),
//         ],
//       });
//     } else {
//       filter[label] = rx;
//     }
//   }
  
//   /* Ensure SUPPLIER DESCRIPTION is always excluded */
//   if (ref === 'attribute-addon') {
//     (filter.$and ||= []).push({ name: { $nin: ['SUPPLIER DESCRIPTION', 'Supplier Description', 'supplier description'] } });
//   }
 
//   /* the default row sorts first, so it survives the 200-row cap */
//   const sort = ref === 'supplier'
//     ? { createdAt: -1, [label]: 1 }
//     : entry.defaultField
//     ? { [entry.defaultField]: -1, [label]: 1 }
//     : { [label]: 1 };
 
//   const rows = await Model.find(filter).sort(sort).limit(200).lean();

//   /* label, or the fallback name fields, or "(untitled)" - see nameFallback */
//   const textOf = (r) => {
//     if (ref === 'uom') {
//       return [r[label], r.shortName].map((value) => String(value || '').trim()).filter(Boolean).join(' / ');
//     }
//     const primary = String(r[label] ?? '').trim();
//     if (primary) return primary;
//     const alt = (entry.nameFallback || [])
//       .map((f) => String(r[f] ?? '').trim())
//       .filter(Boolean)
//       .join(' ');
//     return alt || '(untitled)';
//   };

//   /* "KARNATAKA Saree Centre, MYSORE (G524)".

//      The code is appended for DISPLAY only - `value` stays the ObjectId, so
//      what gets stored is the reference and never the formatted text. A
//      supplier without a code simply shows its name. */
//   const labelOf = (r) => {
//     const name = textOf(r);
//     const code = entry.codeField ? String(r[entry.codeField] ?? '').trim() : '';
//     return code ? name + ' (' + code + ')' : name;
//   };

//   return json({
//     options: rows.map((r) => ({
//       value: String(r._id),
//       label: labelOf(r),
//       /* the parts, unformatted, for a caller that needs them on their own */
//       name: textOf(r),
//       ...(entry.codeField ? { code: String(r[entry.codeField] ?? '') } : {}),
//       ...(entry.codeField === 'contactId' ? { gstNo: String(r.gstNo ?? '') } : {}),
//       ...(entry.defaultField && r[entry.defaultField] ? { isDefault: true } : {}),
//     })),
//   });
// }
 
// function escapeRegex(s) {
//   return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// }









// import { isValidObjectId } from 'mongoose';
// import dbConnect from '@/lib/db';
// import { requireSession } from '@/lib/session';

// /* /api/options?ref=<name>&business=<id>
//    Feeds every `ref` dropdown in the app. Replaces the `options` branch of the
//    old /api/settings/[action] handler.

//    This is a model index, not a page registry - it maps a dropdown's target
//    name to a model file and the field to display. Nothing here renders a page. */

// const json = (d, s = 200) => Response.json(d, { status: s });

// const REFS = {
//   /* defaultField: rows where this field is truthy sort first and come back
//      flagged `isDefault`, so a picker can preselect one instead of falling back
//      to whatever happens to be first alphabetically. Business uses it to make
//      the main branch the default selection. */
//   business:                  { load: () => import('@/models/Business'), scoped: false, defaultField: 'isMainBranch' },
//   companylocations:          { load: () => import('@/models/CompanyLocation') },
//   ledgergroups:              { load: () => import('@/models/LedgerGroup') },
//   ledger:                    { load: () => import('@/models/Ledger') },
//   docsetup:                  { load: () => import('@/models/DocSetup') },
//   purchasegroup:             { load: () => import('@/models/PurchaseGroup') },
//   stockpoint:                { load: () => import('@/models/StockPoint') },
//   poscounter:                { load: () => import('@/models/PosCounter') },
//   paymentmethod:             { load: () => import('@/models/PaymentMethod') },
//   tax:                       { load: () => import('@/models/Tax') },
//   hsn:                       { load: () => import('@/models/Hsn') },
//   citygroup:                 { load: () => import('@/models/CityGroup') },
//   barcodesetting:            { load: () => import('@/models/BarcodeSetting') },
//   'purchase/master/charge':  { load: () => import('@/models/PurchaseCharge') },
//   'purchase/master/term':    { load: () => import('@/models/PurchaseTerm') },
//   'sales/master/term':       { load: () => import('@/models/SalesTerm') },

//   'contact-type':            { load: () => import('@/models/ContactType') },
//   supplier:                  { load: () => import('@/models/Contact'), kind: 'Supplier', label: 'businessName' },
//   agent:                     { load: () => import('@/models/Contact'), kind: 'Agent', label: 'businessName' },
//   customer:                  { load: () => import('@/models/Contact'), kind: 'Customer', label: 'businessName' },

//   'product/filter':          { load: () => import('@/models/ProductFilter') },
//   'product/group':           { load: () => import('@/models/ProductGroup') },
//   uom:                       { load: () => import('@/models/Uom') },
//   'attribute-addon':         { load: () => import('@/models/AttributeAddon') },
//   item:                      { load: () => import('@/models/Item') },
//   logistic:                  { load: () => import('@/models/Logistic') },

//   /* Transportation module */
//   transporter:               { load: () => import('@/models/Transporter') },
//   vehicle:                   { load: () => import('@/models/Vehicle') },
//   driver:                    { load: () => import('@/models/Driver') },
//   'transport-route':         { load: () => import('@/models/TransportRoute') },
//   dispatch:                  { load: () => import('@/models/Dispatch') },
//   /* consignments no dispatch has claimed yet - the Dispatch form's picker */
//   'delivery-unassigned':     {
//     load: () => import('@/models/Delivery'),
//     where: { $or: [{ dispatchId: null }, { dispatchId: { $exists: false } }] },
//   },
// };

// export async function GET(req) {
//   const session = await requireSession();
//   if (!session) return json({ error: 'Unauthorized' }, 401);

//   const sp = new URL(req.url).searchParams;
//   const ref = sp.get('ref');
//   const entry = REFS[ref];
//   if (!entry) return json({ options: [] });

//   await dbConnect();

//   const mod = await entry.load();
//   const Model = mod.default;
//   const label = entry.label || mod.LABEL_FIELD || 'name';

//   const filter = {};
//   if (entry.scoped !== false) {
//     const b = sp.get('business');
//     if (b && isValidObjectId(b)) filter.businessId = b;
//   }
//   if (entry.kind) filter.contactKind = entry.kind;
//   /* a ref can narrow its own pool - see 'delivery-unassigned' */
//   if (entry.where) Object.assign(filter, entry.where);

//   /* typing in the control narrows server-side - the old endpoint pulled up to
//      2000 rows and filtered in the browser, which does not survive 56k customers */
//   const q = (sp.get('q') || '').trim();
//   if (q) filter[label] = { $regex: escapeRegex(q), $options: 'i' };

//   /* the default row sorts first, so it survives the 200-row cap */
//   const sort = entry.defaultField
//     ? { [entry.defaultField]: -1, [label]: 1 }
//     : { [label]: 1 };

//   const rows = await Model.find(filter).sort(sort).limit(200).lean();

//   return json({
//     options: rows.map((r) => ({
//       value: String(r._id),
//       label: String(r[label] ?? '(untitled)'),
//       ...(entry.defaultField && r[entry.defaultField] ? { isDefault: true } : {}),
//     })),
//   });






 
import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import { requireSession } from '@/lib/session';
 
/* /api/options?ref=<name>&business=<id>
   Feeds every `ref` dropdown in the app. Replaces the `options` branch of the
   old /api/settings/[action] handler.
 
   This is a model index, not a page registry - it maps a dropdown's target
   name to a model file and the field to display. Nothing here renders a page. */
 
/* no-store, explicitly. Dropdown lists change the moment somebody uses a
   quick-add, and without a cache directive the browser is free to answer a
   repeat GET from its own memory cache - so a record created seconds ago
   did not appear until the page was reloaded. */
const json = (d, s = 200) => Response.json(d, {
  status: s,
  headers: { 'Cache-Control': 'no-store' },
});
 
const REFS = {
  /* defaultField: rows where this field is truthy sort first and come back
     flagged `isDefault`, so a picker can preselect one instead of falling back
     to whatever happens to be first alphabetically. Business uses it to make
     the main branch the default selection. */
  business:                  { load: () => import('@/models/Business'), scoped: false, defaultField: 'isMainBranch' },
  companylocations:          { load: () => import('@/models/CompanyLocation') },
  ledgergroups:              { load: () => import('@/models/LedgerGroup') },
  ledger:                    { load: () => import('@/models/Ledger') },
  docsetup:                  { load: () => import('@/models/DocSetup') },
  purchasegroup:             { load: () => import('@/models/PurchaseGroup') },
  /* locationScoped: a stock point belongs to ONE location, so offering the
     whole business's list lets an operator standing in the warehouse pick a
     stock point that physically sits in another branch location. */
  stockpoint:                { load: () => import('@/models/StockPoint'), locationScoped: true },
  poscounter:                { load: () => import('@/models/PosCounter') },
  /* Staff Management -> Sales Persons. Only Active people are offered:
     retiring someone should take them out of the till's picker without
     deleting the record the past bills point at. codeField appends the
     SP Code for display and makes it searchable, the same way supplier
     does with the G-code. */
  salesperson:               { load: () => import('@/models/SalesPerson'), where: { status: 'Active' }, codeField: 'spCode' },
  paymentmethod:             { load: () => import('@/models/PaymentMethod') },
  tax:                       { load: () => import('@/models/Tax') },
  hsn:                       { load: () => import('@/models/Hsn') },
  citygroup:                 { load: () => import('@/models/CityGroup') },
  barcodesetting:            { load: () => import('@/models/BarcodeSetting') },
  'purchase/master/charge':  { load: () => import('@/models/PurchaseCharge') },
  'purchase/master/term':    { load: () => import('@/models/PurchaseTerm') },
  'sales/master/term':       { load: () => import('@/models/SalesTerm') },
 
  'contact-type':            { load: () => import('@/models/ContactType') },
  /* The three contact forms each pick a type of their own kind - the Agent
     form must not offer "RETAIL" or "Vendor for Goods". contactType is the
     Customer/Supplier/Agent selector on the Contact Type master. */
  'contact-type-agent':      { load: () => import('@/models/ContactType'), where: { contactType: 'Agent' } },
  'contact-type-supplier':   { load: () => import('@/models/ContactType'), where: { contactType: 'Supplier' } },
  'contact-type-customer':   { load: () => import('@/models/ContactType'), where: { contactType: 'Customer' } },
  /* nameFallback: businessName is blank on a contact entered as a person -
     the Agent form does not even ask for it - so fall back to the personal
     name rather than showing "(untitled)" in every picker. This mirrors what
     lib/refLabels.js resolveRefLabels already does for list columns. */
  /* codeField: the contact's own code - "G524", "PO8", "IC16" - which the
     business calls the G-code and uses to identify a vendor on paper. It is
     appended to the label, and searched, so typing either the name or the
     code finds the supplier. Without it the code was invisible in every
     picker and unsearchable, even though lists already showed it.

     supplier is BUSINESS-SCOPED like the other two. It carried scoped:false,
     which mixed every company's vendors into one list and then truncated
     that list at 200 - so a company with 819 suppliers could not reach most
     of its own, and could pick another company's. */
  supplier:                  { load: () => import('@/models/Contact'), kind: 'Supplier', label: 'businessName', nameFallback: ['firstName', 'lastName'], codeField: 'contactId' },
  agent:                     { load: () => import('@/models/Contact'), kind: 'Agent', label: 'businessName', nameFallback: ['firstName', 'lastName'], codeField: 'contactId' },
  customer:                  { load: () => import('@/models/Contact'), kind: 'Customer', label: 'businessName', nameFallback: ['firstName', 'lastName'], codeField: 'contactId' },
 
  'product/filter':          { load: () => import('@/models/ProductFilter') },
  'product/group':           { load: () => import('@/models/ProductGroup') },
  uom:                       { load: () => import('@/models/Uom') },
  'attribute-addon':         { load: () => import('@/models/AttributeAddon'), where: { name: { $nin: ['SUPPLIER DESCRIPTION', 'Supplier Description', 'supplier description'] } } },
  item:                      { load: () => import('@/models/Item') },
  logistic:                  { load: () => import('@/models/Logistic') },
 
  /* Transportation module */
  transporter:               { load: () => import('@/models/Transporter') },
  vehicle:                   { load: () => import('@/models/Vehicle') },
  driver:                    { load: () => import('@/models/Driver') },
  'transport-route':         { load: () => import('@/models/TransportRoute') },
  dispatch:                  { load: () => import('@/models/Dispatch') },
  /* consignments no dispatch has claimed yet - the Dispatch form's picker */
  'delivery-unassigned':     {
    load: () => import('@/models/Delivery'),
    where: { $or: [{ dispatchId: null }, { dispatchId: { $exists: false } }] },
  },
  'delivery-available-grc':  { load: () => import('@/models/Delivery') },
 
  /* Inter Company Sell */
  'ic-delivery-challan':      { load: () => import('@/models/IcDeliveryChallan') },
  'ic-sales-invoice':         { load: () => import('@/models/IcSalesInvoice') },
  'ic-auto-purchase-return':  { load: () => import('@/models/IcAutoPurchaseReturn') },
  'ic-sales-return':          { load: () => import('@/models/IcSalesReturn') },
  /* challans not yet pulled into an inter company sales invoice */
  'ic-delivery-challan-open': {
    load: () => import('@/models/IcDeliveryChallan'),
    where: { $or: [{ icSalesInvoiceId: null }, { icSalesInvoiceId: { $exists: false } }] },
  },

  /* Stock Transfers */
  'stock-transfer-packet':   { load: () => import('@/models/StockTransferPacket') },
  'stock-transfer-location': { load: () => import('@/models/StockTransferLocation') },
  'stock-transfer-received': { load: () => import('@/models/StockTransferReceived') },
  /* packets not yet consolidated into a stock transfer location */
  'stock-transfer-packet-open': {
    load: () => import('@/models/StockTransferPacket'),
    where: {
      $or: [
        { stockTransferLocationId: null },
        { stockTransferLocationId: { $exists: false } },
      ],
    },
  },
};
 
export async function GET(req) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);
 
  const sp = new URL(req.url).searchParams;
  const ref = sp.get('ref');
  const entry = REFS[ref];
  if (!entry) return json({ options: [] });
 
  await dbConnect();
 
  const mod = await entry.load();
  const Model = mod.default;
  const label = entry.label || mod.LABEL_FIELD || 'name';
 
  const filter = {};
  if (entry.scoped !== false) {
    const b = sp.get('business');
    if (b && isValidObjectId(b)) filter.businessId = b;
  }
  /* Narrow to the top bar's LOCATION as well, for refs that live at one.

     Opt-in per ref, not global: most refs are business-wide (and
     companylocations must never be filtered by the location it is used to
     choose). useOptions already sends `location`; until now nothing read it.

     A row with no locationId is a business-wide one and stays visible - some
     businesses never assigned stock points to a location, and a strict match
     would leave their dropdown empty. */
  if (entry.locationScoped) {
    const l = sp.get('location');
    if (l && isValidObjectId(l)) {
      filter.$and = [...(filter.$and || []), { $or: [{ locationId: l }, { locationId: null }] }];
    }
  }
  if (entry.kind) filter.contactKind = entry.kind;
  /* a ref can narrow its own pool - see 'delivery-unassigned' */
  if (entry.where) Object.assign(filter, entry.where);
 
  /* typing in the control narrows server-side - the old endpoint pulled up to
     2000 rows and filtered in the browser, which does not survive 56k customers */
  const q = (sp.get('q') || '').trim();
  if (q) {
    const rx = { $regex: escapeRegex(q), $options: 'i' };
    if (entry.nameFallback || entry.codeField) {
      /* Search the label, the fallback name fields AND the code.

         The fallbacks matter because businessName is empty on a contact
         entered as a person - typing "DIRECT" found nothing for them. The
         code matters because the business identifies a vendor by its G-code
         as often as by its name: typing "G524" must find the same supplier
         as typing "KARNATAKA".

         Wrapped in $and so it cannot collide with a ref that already uses
         $or in its own `where`. */
      (filter.$and ||= []).push({
        $or: [
          { [label]: rx },
          ...(entry.nameFallback || []).map((f) => ({ [f]: rx })),
          ...(entry.codeField ? [{ [entry.codeField]: rx }] : []),
        ],
      });
    } else {
      filter[label] = rx;
    }
  }
  
  /* Ensure SUPPLIER DESCRIPTION is always excluded */
  if (ref === 'attribute-addon') {
    (filter.$and ||= []).push({ name: { $nin: ['SUPPLIER DESCRIPTION', 'Supplier Description', 'supplier description'] } });
  }
 
  /* the default row sorts first, so it survives the 200-row cap */
  const sort = ref === 'supplier'
    ? { createdAt: -1, [label]: 1 }
    : entry.defaultField
    ? { [entry.defaultField]: -1, [label]: 1 }
    : { [label]: 1 };
 
  const rows = await Model.find(filter).sort(sort).limit(200).lean();

  /* label, or the fallback name fields, or "(untitled)" - see nameFallback */
  const textOf = (r) => {
    if (ref === 'uom') {
      return [r[label], r.shortName].map((value) => String(value || '').trim()).filter(Boolean).join(' / ');
    }
    const primary = String(r[label] ?? '').trim();
    if (primary) return primary;
    const alt = (entry.nameFallback || [])
      .map((f) => String(r[f] ?? '').trim())
      .filter(Boolean)
      .join(' ');
    return alt || '(untitled)';
  };

  /* "KARNATAKA Saree Centre, MYSORE (G524)".

     The code is appended for DISPLAY only - `value` stays the ObjectId, so
     what gets stored is the reference and never the formatted text. A
     supplier without a code simply shows its name. */
  const labelOf = (r) => {
    const name = textOf(r);
    const code = entry.codeField ? String(r[entry.codeField] ?? '').trim() : '';
    return code ? name + ' (' + code + ')' : name;
  };

  return json({
    options: rows.map((r) => ({
      value: String(r._id),
      label: labelOf(r),
      /* the parts, unformatted, for a caller that needs them on their own */
      name: textOf(r),
      ...(entry.codeField ? { code: String(r[entry.codeField] ?? '') } : {}),
      ...(entry.codeField === 'contactId' ? { gstNo: String(r.gstNo ?? '') } : {}),
      ...(entry.defaultField && r[entry.defaultField] ? { isDefault: true } : {}),
      /* which location the row belongs to ('' = shared by the whole
         business), so a form can pick the row bound to the header LOCATION */
      ...(entry.locationScoped ? { locationId: r.locationId ? String(r.locationId) : '' } : {}),
    })),
  });
}
 
function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}