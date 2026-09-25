# -*- coding: utf-8 -*-
import io

P = 'lib/screenPermission.js'
s = io.open(P, encoding='utf-8').read()

OLD = (
    "  const scoped = businessId && isValidObjectId(String(businessId))\n"
    "    ? await RolePermission.findOne({ businessId, role }).select('permissions').lean()\n"
    "    : null;\n"
)

NEW = (
    "  /* A RECORD WITH NO BUSINESS OF ITS OWN.\n"
    "\n"
    "     Several collections carry rows seeded with businessId: null - product\n"
    "     groups are the documented case, which is why\n"
    "     scripts/updateProductGroupsBusinessId.mjs exists. A by-id guard scopes\n"
    "     on the record's own business, so for those rows there is no business to\n"
    "     look a matrix up against, and falling through to the rule below would\n"
    "     deny a governed role every time: the permission could never be granted,\n"
    "     because there is nowhere to grant it.\n"
    "\n"
    "     So a row belonging to no business is judged against every business: the\n"
    "     role may act on it if it holds that permission ANYWHERE. Still a real\n"
    "     check - a role that never holds it is refused - and it opens no route\n"
    "     into another branch's data, because the row is not in a branch. */\n"
    "  if (!businessId || !isValidObjectId(String(businessId))) {\n"
    "    const all = await RolePermission.find({ role }).select('permissions').lean();\n"
    "    if (!all.length) return null;                    // ungoverned - unchanged\n"
    "\n"
    "    const anywhere = all.some((d) => {\n"
    "      const held = (d.permissions || {})[screen];\n"
    "      return Array.isArray(held) && held.includes(action);\n"
    "    });\n"
    "    if (anywhere) return null;\n"
    "\n"
    "    return {\n"
    "      message: 'Your role (' + role + ') is not allowed to ' + (VERB[action] || action)\n"
    "        + ' ' + (label || 'this') + '. Ask an administrator to grant it on '\n"
    "        + 'Staff Management > Roles & Permissions.',\n"
    "      code: 'SCREEN_FORBIDDEN',\n"
    "    };\n"
    "  }\n"
    "\n"
    "  const scoped = await RolePermission.findOne({ businessId, role })\n"
    "    .select('permissions')\n"
    "    .lean();\n"
)

assert s.count(OLD) == 1, 'anchor found %d times' % s.count(OLD)
io.open(P, 'w', encoding='utf-8', newline='\n').write(s.replace(OLD, NEW))
print('patched: records with no businessId are judged across businesses')
