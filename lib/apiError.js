/* One place that turns a thrown error into an HTTP response.

   Every route in this project already answers with Response.json({...}) and a
   status; what they did not have was a shared way to report a FAILURE, so a
   duplicate-scan and a database outage both surfaced to the operator as
   "Save failed". The engine throws typed errors (InventoryError,
   LockBusyError, AuthzError, BarcodePlanError) and this maps them.

   Response shape, matching what the existing screens already read:
     { error: "<message the operator should see>", code: "<machine code>" }
   plus whatever context the error carried (the offending barcodes, the lock
   holder), so a screen can highlight the exact rows.

   Validation failures keep the project's existing 422 + { errors: {...} }
   shape - FormView and TransactionFormView both branch on that. */

export const json = (d, s = 200) => Response.json(d, { status: s });

export function apiError(err) {
  /* thrown deliberately by the engine or the authz layer */
  if (err && typeof err === 'object' && err.status && err.message) {
    const { status, message, code, name, stack, ...rest } = err;
    void name; void stack;
    return json({ error: message, code: code || 'ERROR', ...safe(rest) }, status);
  }

  /* Mongoose validation - report per field so the form can highlight them */
  if (err?.name === 'ValidationError' && err.errors) {
    const errors = {};
    Object.entries(err.errors).forEach(([k, v]) => { errors[k] = v.message; });
    return json({ errors, error: 'Please correct the highlighted fields.' }, 422);
  }

  /* a unique index rejected the write - almost always a duplicate document
     number or barcode, which is a conflict rather than a server fault */
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'value';
    return json({
      error: 'That ' + humanise(field) + ' already exists. It was issued to another document a moment ago - try again.',
      code: 'DUPLICATE_KEY',
      field,
    }, 409);
  }

  /* a bad ObjectId reaching a typed path */
  if (err?.name === 'CastError') {
    return json({ error: 'Invalid ' + humanise(err.path || 'value') + '.', code: 'BAD_INPUT' }, 400);
  }

  /* genuinely unexpected: log the detail, tell the operator nothing that
     leaks internals */
  console.error('[api]', err);
  return json({ error: 'Something went wrong. Nothing was saved.', code: 'INTERNAL' }, 500);
}

/* Only forward context a screen can use; never a stack or a driver object. */
function safe(rest) {
  const out = {};
  /* businessName rides along with a wrong-business scan, so a screen can name
     the branch to switch to rather than re-deriving it from the message. */
  ['errors', 'skipped', 'barcodeNo', 'unit', 'field', 'holder', 'conflicts', 'rows', 'businessName'].forEach((k) => {
    if (rest[k] !== undefined) out[k] = rest[k];
  });
  return out;
}

function humanise(field) {
  return String(field)
    .replace(/Id$/, '')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim()
    .toLowerCase();
}

/* Wraps a route handler so a throw anywhere inside it becomes a proper
   response instead of an unhandled rejection.

     export const POST = handler(async (req) => { ... });                    */
export function handler(fn) {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      return apiError(err);
    }
  };
}
