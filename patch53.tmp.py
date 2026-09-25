# -*- coding: utf-8 -*-
"""Row actions as buttons in a row, instead of a dropdown.

ListView already had two variants - "dropdown" (one Action button that opens a
menu) and "icons" (small square icon buttons). The icons variant cannot serve
the POS list, because it hard-codes each button's destination as base + /:id,
and POS has three different ones (view, payment, print).

So this adds a third variant, "buttons", which renders cfg.actionMenu entries
inline - the same entries, the same hrefs and the same permission filter the
dropdown uses, just laid out in a row.

ListView carries a commented-out prior revision above the live code, so every
edit here is applied to the live region only.
"""
import io

NL = chr(10)


def live_split(s):
    lines = s.split(NL)
    for i, l in enumerate(lines):
        if l.strip() and not l.lstrip().startswith('//'):
            return NL.join(lines[:i]), NL.join(lines[i:])
    raise AssertionError('no live region')


def one(path, old, new, why):
    s = io.open(path, encoding='utf-8').read()
    dead, live = live_split(s)
    assert live.count(old) == 1, path + ' :: ' + why + ' (found %d live)' % live.count(old)
    io.open(path, 'w', encoding='utf-8', newline=NL).write(dead + NL + live.replace(old, new))
    print('patched', path, '-', why)


L = 'components/ListView.jsx'

# 1. one definition of "which entries may this role use", shared by both
#    variants so they can never drift apart.
one(L,
    '  const actionVariant = cfg.actionVariant || "icons";',
    '''  const actionVariant = cfg.actionVariant || "icons";

  /* The row's action entries, already filtered by permission and with their
     hrefs resolved. Shared by the dropdown and the buttons variant so the two
     can never offer different things.

     An entry is dropped when the role may not do it. `action: 'delete'` says
     so by itself; anything else declares `need` in the cfg, because a link's
     label is not something to guess a permission from. */
  const rowActions = (row) => (
    cfg.actionMenu || [
      { label: "Edit", icon: "pencil", to: (r) => base + "/" + r._id, need: "update" },
    ]
  )
    .filter((m) => {
      if (m.action === 'delete') return mayDelete;
      if (m.need === 'update') return mayUpdate;
      if (m.need === 'create') return mayCreate;
      if (m.need === 'delete') return mayDelete;
      return true;
    })
    .map((m) => ({ ...m, href: m.to ? m.to(row) : undefined, rowId: row._id }));''',
    'shared rowActions helper')

# 2. the dropdown now uses it
one(L,
    '''                          <ActionMenu
                            items={(
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
                            }))}''',
    '''                          <ActionMenu
                            items={rowActions(row)}''',
    'dropdown uses the helper')

# 3. the new variant
one(L,
    '''                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            {(
                              /* actionIcons may be a plain array, or a''',
    '''                        ) : actionVariant === "buttons" ? (
                          /* The same entries the dropdown would list, laid out
                             in a row. Used where the actions go to different
                             places - POS has view, payments and print - which
                             the icons variant below cannot express, because it
                             builds every destination as base + /:id. */
                          <span className="inline-flex flex-wrap items-center gap-1.5">
                            {rowActions(row).length === 0 ? (
                              <span className="text-[11px] text-inkmuted">No actions</span>
                            ) : rowActions(row).map((m) => (
                              <button
                                key={m.label}
                                type="button"
                                className={'btn px-2 py-1 text-[12px] '
                                  + (m.action === 'delete' ? 'bg-danger text-white' : '')}
                                title={m.label}
                                onClick={() => {
                                  if (m.action === 'delete') { remove(m.rowId); return; }
                                  if (m.href) router.push(m.href);
                                }}
                              >
                                {m.icon && <Icon name={m.icon} size={12} />} {m.label}
                              </button>
                            ))}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            {(
                              /* actionIcons may be a plain array, or a''',
    'buttons variant')

# 4. the POS list asks for it
P = 'app/admin/transaction/sell/pos/page.jsx'
s = io.open(P, encoding='utf-8').read()
old = '  actionVariant: "dropdown",'
assert s.count(old) == 1, 'pos page anchor found %d times' % s.count(old)
io.open(P, 'w', encoding='utf-8', newline=NL).write(s.replace(
    old,
    '  /* three different destinations - view, payments, print - shown side by\n'
    '     side rather than behind one Action menu. */\n'
    '  actionVariant: "buttons",'))
print('patched', P, '- POS list uses the buttons variant')
