# -*- coding: utf-8 -*-
import io


def one(path, old, new, why):
    s = io.open(path, encoding='utf-8').read()
    assert s.count(old) == 1, path + ' :: ' + why + ' (found %d)' % s.count(old)
    io.open(path, 'w', encoding='utf-8', newline='\n').write(s.replace(old, new))
    print('patched', path, '-', why)


# ------------------------------------------------------------- list route --
L = 'app/api/item/route.js'

one(L,
    """/* Permission gate for this screen.

   READ IS DELIBERATELY NOT GATED HERE. Barcode Generation, GRC/GRT scanning, Inter Company Challan, Purchase Invoice and Print Label all look items up through it,
   so refusing a read would break screens that have nothing to do with
   this one. Create, update and delete are gated as normal. */""",
    """/* Permission gate for this screen.

   READING THE ITEM LIST answers to Item read OR to any screen that resolves
   item codes - Print Label, Barcode Generation (reached from a GRC), GRT
   scanning and the till. See ITEM_LOOKUP_SCREENS in lib/screenPermission.js.

   Without that, gating Item read would stop a GRC operator scanning a code,
   which has nothing to do with administering the Item master. Writing still
   needs Item's own permission. */""",
    'list note')

one(L,
    "import { screenDenial, SCREENS, ACTIONS as PERM } from '@/lib/screenPermission';",
    "import {\n"
    "  screenDenial, screenDenialAny, SCREENS, ACTIONS as PERM, ITEM_LOOKUP_SCREENS,\n"
    "} from '@/lib/screenPermission';",
    'list import')

one(L,
    """  const filter = {};
  const barcodeImageByCode = {};""",
    """  /* Item read, or any screen that legitimately resolves item codes. */
  const denied = await screenDenialAny({
    session, screens: ITEM_LOOKUP_SCREENS, action: PERM.READ,
    businessId: sp.get('business'), label: 'items',
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const filter = {};
  const barcodeImageByCode = {};""",
    'list GET guard')

# ----------------------------------------------------------- detail route --
D = 'app/api/item/[id]/detail/route.js'

one(D,
    "import { requireSession } from '@/lib/session';\n",
    "import { requireSession } from '@/lib/session';\n"
    "import {\n"
    "  screenDenialAny, ACTIONS as PERM, ITEM_LOOKUP_SCREENS,\n"
    "} from '@/lib/screenPermission';\n",
    'detail import')

one(D,
    """  const item = await Item.findById(id).lean();
  if (!item) return json({ error: 'Not found' }, 404);""",
    """  const item = await Item.findById(id).lean();
  if (!item) return json({ error: 'Not found' }, 404);

  /* Same rule as the list: Item read, or any screen that resolves item codes.
     This is the shape the GRC grid, the till and Purchase Invoice all read a
     picked item through, so gating it on Item alone would break them. */
  const denied = await screenDenialAny({
    session, screens: ITEM_LOOKUP_SCREENS, action: PERM.READ,
    businessId: item.businessId, label: 'items',
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);""",
    'detail GET guard')

# --------------------------------------------------------------- by-id ----
I = 'app/api/item/[id]/route.js'

one(I,
    """/* Permission gate for this screen.

   READ IS DELIBERATELY NOT GATED HERE. Barcode Generation, GRC/GRT scanning, Inter Company Challan, Purchase Invoice and Print Label all look items up through it,
   so refusing a read would break screens that have nothing to do with
   this one. Create, update and delete are gated as normal. */""",
    """/* Permission gate for this screen.

   THE PLAIN BY-ID ROUTE IS THE EDIT FORM, so it answers to Item read alone.
   The lookups other screens make go to ./detail, which accepts any screen
   that resolves item codes - see ITEM_LOOKUP_SCREENS. */""",
    'by-id note')

one(I,
    """  const doc = await Item.findById(id).lean();
  if (!doc) return json({ doc: null }, 404);
  return json({ doc: { ...doc, _id: String(doc._id) } });""",
    """  const doc = await Item.findById(id).lean();
  if (!doc) return json({ doc: null }, 404);

  /* Scoped to the item's own business, not to whichever business the screen
     happens to be switched to. */
  const denied = await screenDenial({
    session, ...ITEM, action: PERM.READ, businessId: doc.businessId,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  return json({ doc: { ...doc, _id: String(doc._id) } });""",
    'by-id GET guard')
