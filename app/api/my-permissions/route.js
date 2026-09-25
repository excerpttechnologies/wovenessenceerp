import dbConnect from '@/lib/db';
import { requireSession } from '@/lib/session';
import { effectivePermissions } from '@/lib/screenPermission';

/* /api/my-permissions?business=<id>

   What the SIGNED-IN account may do, so the screens can stop offering
   controls its role is not allowed to use. Always about the caller - there is
   no id to pass and no way to ask about somebody else, which is why it needs
   no privilege of its own beyond being signed in.

   FOR HIDING BUTTONS ONLY. Every route still checks for itself
   (lib/screenPermission.js screenDenial), so a hidden button and a forged
   request are refused by the same rule. If this endpoint fails the screens
   fall back to showing everything, which is the pre-permissions behaviour and
   costs nothing: the server is still the one saying no.

     { role, governed, screens: { '<sidebar href>': ['read','create',...] } }

   governed:false means nobody has customised this role - show everything. */

const json = (d, s = 200) => Response.json(d, {
  status: s,
  /* a permission change must not sit in a cache until the tab is reloaded */
  headers: { 'Cache-Control': 'no-store' },
});

export async function GET(req) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const sp = new URL(req.url).searchParams;
  await dbConnect();

  const perms = await effectivePermissions({
    session,
    businessId: sp.get('business'),
  });

  return json(perms);
}
