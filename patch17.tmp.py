# -*- coding: utf-8 -*-
import io


def one(path, old, new, why):
    s = io.open(path, encoding='utf-8').read()
    assert s.count(old) == 1, path + ' :: not found once: ' + why
    io.open(path, 'w', encoding='utf-8', newline='\n').write(s.replace(old, new))
    print('patched', path, '-', why)


one('lib/screenPermission.js',
    "  AGENT: '/admin/contact/agent',",
    "  AGENT: '/admin/contact/agent',\n"
    "  CUSTOMER: '/admin/contact/customer',",
    'SCREENS entry')

IMPORT = ("import { screenDenial, SCREENS, ACTIONS as PERM } from '@/lib/screenPermission';\n"
          "\nconst CUSTOMER = { screen: SCREENS.CUSTOMER, label: 'customers' };\n")

# ----------------------------------------------------------------- list route
L = 'app/api/customer/route.js'
one(L,
    "import { nextContactId } from '@/lib/contactId';",
    "import { nextContactId } from '@/lib/contactId';\n" + IMPORT,
    'import')

one(L,
    """  const filter = {};
  const b = sp.get('business'); if (b && isValidObjectId(b)) filter.businessId = b;
  /* pinned server-side so the discriminator can't be spoofed */
  filter.contactKind = 'Customer';""",
    """  /* Only refuses when this role has a saved permission matrix that withholds
     it - see lib/screenPermission.js. */
  const denied = await screenDenial({
    session, ...CUSTOMER, action: PERM.READ, businessId: sp.get('business'),
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const filter = {};
  const b = sp.get('business'); if (b && isValidObjectId(b)) filter.businessId = b;
  /* pinned server-side so the discriminator can't be spoofed */
  filter.contactKind = 'Customer';""",
    'GET guard')

one(L,
    """  /* POS quick-add deliberately omits the full customer page's sales and
     ledger tabs. Keep that smaller contract explicit instead of making those
     fields optional for every customer submission. */""",
    """  /* ALSO COVERS THE TILL'S QUICK-ADD (body.quick). Creating a customer is
     creating a customer wherever the form lives, so the permission that
     governs it is Customers > Create - a counter that should be able to add
     a walk-in needs that ticked for its role. Gating quick-add on the POS
     screen instead would mean two different answers to one question.

     Asked before the fields are validated: a request that is not allowed to
     happen should be refused as not allowed. */
  const denied = await screenDenial({
    session, ...CUSTOMER, action: PERM.CREATE, businessId: body.business,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  /* POS quick-add deliberately omits the full customer page's sales and
     ledger tabs. Keep that smaller contract explicit instead of making those
     fields optional for every customer submission. */""",
    'POST guard')

# ------------------------------------------------------------------ id route
I = 'app/api/customer/[id]/route.js'
one(I,
    "import dbConnect from '@/lib/db';",
    "import { isValidObjectId } from 'mongoose';\nimport dbConnect from '@/lib/db';",
    'isValidObjectId import')

one(I,
    "import { TABS } from '@/app/admin/contact/customer/tabs';",
    "import { TABS } from '@/app/admin/contact/customer/tabs';\n" + IMPORT,
    'import')

one(I,
    """  const doc = await Customer.findById(id).lean();
  if (!doc) return json({ doc: null }, 404);
  return json({ doc: { ...doc, _id: String(doc._id) } });""",
    """  const doc = await Customer.findById(id).lean();
  if (!doc) return json({ doc: null }, 404);

  /* Scoped to the customer's own business, not to whichever business the
     screen happens to be switched to. */
  const denied = await screenDenial({
    session, ...CUSTOMER, action: PERM.READ, businessId: doc.businessId,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  return json({ doc: { ...doc, _id: String(doc._id) } });""",
    'GET by id guard')

one(I,
    """  const { errors, doc, ok } = validate(FIELDS, body.data || {});
  if (!ok) return json({ errors }, 422);

  const updated = await Customer.findByIdAndUpdate(id, doc, { new: true, runValidators: true });""",
    """  /* Read first only to learn which business owns it, then decide permission
     BEFORE validating. */
  const current = isValidObjectId(id)
    ? await Customer.findById(id, { businessId: 1 }).lean()
    : null;
  if (!current) return json({ error: 'Not found' }, 404);

  const denied = await screenDenial({
    session, ...CUSTOMER, action: PERM.UPDATE,
    businessId: body.business || current.businessId,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const { errors, doc, ok } = validate(FIELDS, body.data || {});
  if (!ok) return json({ errors }, 422);

  const updated = await Customer.findByIdAndUpdate(id, doc, { new: true, runValidators: true });""",
    'PUT guard')

one(I,
    """  const { id } = await params;
  await dbConnect();

  await Customer.findByIdAndDelete(id);
  return json({ ok: true });""",
    """  const { id } = await params;
  await dbConnect();

  /* Already gone is still a success, exactly as before - the guard only has
     something to say when there is a record to protect. */
  const existing = isValidObjectId(id)
    ? await Customer.findById(id, { businessId: 1 }).lean()
    : null;
  if (!existing) return json({ ok: true });

  const denied = await screenDenial({
    session, ...CUSTOMER, action: PERM.DELETE, businessId: existing.businessId,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  await Customer.findByIdAndDelete(id);
  return json({ ok: true });""",
    'DELETE guard')

# ------------------------------------------------------------- history route
H = 'app/api/customer/[id]/history/route.js'
one(H,
    "import { imageUrl } from '@/lib/inventory';",
    "import { imageUrl } from '@/lib/inventory';\n" + IMPORT,
    'import')

one(H,
    """  const customer = await Customer.findById(id).lean();
  if (!customer) return json({ error: 'Customer not found.', code: 'NOT_FOUND' }, 404);""",
    """  const customer = await Customer.findById(id).lean();
  if (!customer) return json({ error: 'Customer not found.', code: 'NOT_FOUND' }, 404);

  /* Same gate as the Customers list. This is a customer's buying history, so
     a role that may not read customers must not be able to pull it here
     instead - the till reads this endpoint, which is exactly why it needs
     saying rather than leaving as the one way round the list's permission. */
  const session = await requireUser();
  const denied = await screenDenial({
    session, ...CUSTOMER, action: PERM.READ, businessId: business || customer.businessId,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);""",
    'history guard')
