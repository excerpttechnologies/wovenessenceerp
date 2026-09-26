# -*- coding: utf-8 -*-
"""Stock Point defaults from the top bar on the IC challan form.

Mirrors what this same file already does for Business and Location further
up - fetch the list, and if the field has no usable value, take the first -
except the list here is the one the top bar's business and location already
scope, which is exactly what the operator means by "the stock point I am
standing in".
"""
import io

NL = chr(10)


def one(path, old, new, why):
    s = io.open(path, encoding='utf-8').read()
    assert s.count(old) == 1, path + ' :: ' + why + ' (found %d)' % s.count(old)
    io.open(path, 'w', encoding='utf-8', newline=NL).write(s.replace(old, new))
    print('patched', path, '-', why)


P = 'components/IcChallanForm.jsx'

# the shared options hook, which already scopes its request by the top bar
one(P,
    "import { useScope } from './ScopeContext';",
    "import { useScope } from './ScopeContext';" + NL
    + "import { useOptions } from './useOptions';",
    'import useOptions')

# default the stock point once the scoped list arrives
one(P,
    """  /* GSTIN and address follow the chosen business */""",
    """  /* STOCK POINT follows the top bar.

     useOptions already asks /api/options?ref=stockpoint with the business and
     location from the top bar, and that ref is locationScoped - so the list it
     returns is precisely the stock points of the branch the operator is
     standing in. Nearly always that is one, and being made to pick from a list
     of one is a question with a single answer.

     Two cases are handled:
       nothing chosen yet          -> take the first
       chosen, but not in the list -> replace it. This is the case that
                                      matters when the top bar is switched
                                      mid-form: the old branch's stock point
                                      would otherwise stay selected and the
                                      challan would be raised against a point
                                      that belongs to another location.

     A choice that IS valid for the current scope is never touched, so an
     operator who picked the second of several keeps it.

     Only ever applies to forms that declare the field - the auto purchase
     return reuses this component with its own spec and has no stock point,
     and must not be given one. */
  const stockPointOptions = useOptions(
    'stockpoint',
    '',
    FIELDS.some((f) => f.k === 'stockPointId')
  );

  useEffect(() => {
    const options = stockPointOptions.options || [];
    if (!options.length) return;
    setData((cur) => {
      const chosen = String(cur.stockPointId || '');
      if (chosen && options.some((o) => String(o.value) === chosen)) return cur;
      return { ...cur, stockPointId: options[0].value };
    });
  }, [stockPointOptions.options]);

  /* GSTIN and address follow the chosen business */""",
    'stock point default')
