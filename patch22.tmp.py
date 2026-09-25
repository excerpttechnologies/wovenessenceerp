# -*- coding: utf-8 -*-
import io

P = 'components/ListView.jsx'
s = io.open(P, encoding='utf-8').read()


def one(old, new, why):
    global s
    assert s.count(old) == 1, 'not found once: ' + why
    s = s.replace(old, new)


one("  const { business, location, finYear, businessReady, locationReady } = useScope();",
    """  const { business, location, finYear, businessReady, locationReady, can } = useScope();

  /* Which screen this list IS, for permission purposes. basePath + slugPath
     is already the sidebar href the permission matrix is keyed by
     ('/admin/contact/' + 'customer'), so nothing has to be declared twice;
     cfg.screen overrides it for a list that lives somewhere else.

     HIDING ONLY. The routes check every request for themselves - see
     lib/screenPermission.js. can() answers true whenever it does not
     positively know otherwise, so an ungoverned role, or a screen nobody has
     wired, keeps every control exactly as it was. */
  const screenKey = cfg.screen || ((cfg.basePath || '') + (cfg.slugPath || ''));
  const mayCreate = can(screenKey, 'create');
  const mayUpdate = can(screenKey, 'update');
  const mayDelete = can(screenKey, 'delete');""",
    'screenKey + may*')

# anchored on the line above, which only the live copy has unprefixed
one("""              return router.push(base + "/add");
            }}
            showAdd={cfg.showAdd !== false}""",
    """              return router.push(base + "/add");
            }}
            showAdd={cfg.showAdd !== false && mayCreate}""",
    'ADD button')

one("""                            items={(
                              cfg.actionMenu || [
                                {
                                  label: "Edit",
                                  icon: "pencil",
                                  to: (r) => base + "/" + r._id,
                                },
                              ]
                            ).map((m) => ({
                              ...m,
                              href: m.to ? m.to(row) : undefined,
                              rowId: row._id
                            }))}""",
    """                            items={(
                              cfg.actionMenu || [
                                {
                                  label: "Edit",
                                  icon: "pencil",
                                  to: (r) => base + "/" + r._id,
                                  need: "update",
                                },
                              ]
                            )
                              /* An entry is dropped when the role may not do
                                 it. `action: 'delete'` says so by itself;
                                 anything else declares `need` in the cfg,
                                 because a link's label is not something to
                                 guess a permission from. */
                              .filter((m) => {
                                if (m.action === 'delete') return mayDelete;
                                if (m.need === 'update') return mayUpdate;
                                if (m.need === 'create') return mayCreate;
                                if (m.need === 'delete') return mayDelete;
                                return true;
                              })
                              .map((m) => ({
                              ...m,
                              href: m.to ? m.to(row) : undefined,
                              rowId: row._id
                            }))}""",
    'action menu filter')

io.open(P, 'w', encoding='utf-8', newline='\n').write(s)
print('patched', P)
