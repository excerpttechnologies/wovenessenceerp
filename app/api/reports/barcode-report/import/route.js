import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import { handler, json } from '@/lib/apiError';
import { requirePermission, canUseLocation, PERMISSIONS } from '@/lib/rbac';
import Business from '@/models/Business';
import CompanyLocation from '@/models/CompanyLocation';
import { barcodeKey } from '@/lib/barcodeValue';
import { IMPORT_LIMIT } from '@/lib/barcodeReportImport';
import { checkImport, applyImport } from '@/lib/barcodeReportImportService';

/* /api/reports/barcode-report/import

   Barcode Report -> Import: the other ERP's Barcode Report - its table, or
   one barcode's Details page - pasted or read from its Excel file in the
   browser (components/BarcodeReportImport.jsx), brought into THIS ERP. The
   same request / response as Supplier -> GST Parse's preview then apply:

     mode "check"   reads only. What every row would become (new / same /
                    changed / locked / invalid), the masters found for it and
                    the ones not found, per-field errors, warnings, and for a
                    barcode already here its saved data beside the pasted one.
     mode "import"  does it, in one transaction, from a FRESH classification
                    (lib/barcodeReportImportService.js) - the browser's preview
                    is never trusted to still be true. Returns { total,
                    inserted, updated, replaced, filled, skipped, failed,
                    mastersMatched, unmatched, errors, warnings, actions }.

   An import SEEDS barcodes that exist (user, 2026-09-30): a number of this
   ERP's own Barcode Setting series is imported too, and lifts that series'
   counter past it so Barcode Generation never issues it again. A number
   held here is never inserted again: it is compared, and only the
   differences the operator approves are written -

     update  [{ barcode, unitId, fields: { field: saved value they saw } }]
             each field written only while the saved value is still the one
             they saw, on the unit they saw (a plain barcode string, as older
             screens send, takes every updatable difference)
     skip    [barcode]   new rows left unticked

   Masters are found, never created or changed. An import never deletes,
   never renumbers, and never changes what a unit IS (item, quantity, unit).

   A barcode read from an IMAGE that is not a report table (lookupOnly) is
   only looked up: its row shows this ERP's own values, and it is never
   written, in either mode (lib/barcodeReportImport.js lookupRow). Rows of a
   report-table image come in only with `compared: true` - the operator's
   word that they compared them with the image. */

export const POST = handler(async (req) => {
  const body = await req.json().catch(() => ({}));
  const mode = body?.mode === 'import' ? 'import' : 'check';
  const locationId = String(body?.location || '').trim();
  if (!isValidObjectId(locationId)) return json({ error: 'Choose the Business Location the barcodes go into.' }, 422);

  /* importing is receiving stock - the permission Barcode Generation needs */
  const session = await requirePermission(PERMISSIONS.BARCODE_GENERATE, { locationId });
  await dbConnect();

  /* the location, and a business that still exists: a location left behind by
     a deleted business never shows in the header, and stock put there could
     never be seen again */
  const location = await CompanyLocation.findById(locationId).select('name businessId').lean();
  if (!location) return json({ error: 'That Business Location no longer exists.' }, 422);
  const businessId = String(location.businessId || '');
  if (body?.business && String(body.business) !== businessId) {
    return json({ error: 'That location belongs to another business - choose one of the selected business\'s locations.' }, 422);
  }
  const business = isValidObjectId(businessId) ? await Business.findById(businessId).select('_id').lean() : null;
  if (!business) return json({ error: 'That location\'s business no longer exists - choose another location.' }, 422);

  const records = Array.isArray(body?.records) ? body.records : [];
  if (!records.length) return json({ error: 'There are no barcodes to import.' }, 422);
  if (records.length > IMPORT_LIMIT) return json({ error: `Import at most ${IMPORT_LIMIT} barcodes at a time.` }, 422);
  const scope = { businessId, locationId, finYear: String(body?.finYear || '').trim() };
  /* a Details page's stock is placed only at a location this operator may use */
  const canUse = (id) => canUseLocation(session, id);

  if (mode === 'check') {
    return json({ location: location.name || '', ...(await checkImport(records, scope, { canUse })) });
  }

  /* an image's rows only once the operator confirmed they compared them */
  if (records.some((r) => (r?.origin === 'image' || r?.origin === 'ocr') && !r?.lookupOnly) && body?.compared !== true) {
    return json({ error: 'Confirm that you compared every barcode and quantity with the image first.' }, 422);
  }
  const keys = (list) => new Set((Array.isArray(list) ? list : []).map((code) => barcodeKey(code)).filter(Boolean));
  const approved = new Map();
  (Array.isArray(body?.update) ? body.update : []).slice(0, IMPORT_LIMIT).forEach((u) => {
    if (typeof u === 'string') { if (barcodeKey(u)) approved.set(barcodeKey(u), { all: true }); return; }
    const key = barcodeKey(u?.barcode);
    if (!key) return;
    const fields = new Map(Object.entries(u?.fields && typeof u.fields === 'object' ? u.fields : {}).slice(0, 40)
      .map(([field, seen]) => [String(field).slice(0, 30), String(seen ?? '').slice(0, 300)]));
    approved.set(key, { unitId: String(u?.unitId || ''), fields, all: false });
  });
  const result = await applyImport(records, scope, { approved, skipNew: keys(body?.skip), user: session, canUse });
  return json({ ok: true, location: location.name || '', ...result });
});
