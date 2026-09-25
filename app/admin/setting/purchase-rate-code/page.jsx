'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import { useScope } from '@/components/ScopeContext';
import {
  CODE_DIGITS,
  PASSTHROUGH_NOTE,
  encodeRate,
  decodeRate,
  validateMapping,
} from '@/lib/purchaseRateCode';

/* Purchase Rate Code Master - one record per scope. This file IS the page,
   the same way app/admin/setting/barcode-label-setting/page.jsx is.

   It lives under /admin/setting/ rather than the /admin/masters/ that was
   suggested, because every entry in the sidebar's Masters group already
   points at /admin/setting/<slug>; there is no /admin/masters route segment
   in this app, and adding one would have made this the only master that does
   not sit with the others.

   The preview at the bottom runs the SAME encodeRate/decodeRate from
   lib/purchaseRateCode.js that the barcode generation screen uses, so what
   an admin sees here is what the label will carry - not a second
   implementation that can drift. */

const ENDPOINT = '/api/purchase-rate-code';

export default function PurchaseRateCodePage() {
  const scope = useScope();

  const [mapping, setMapping] = useState(() =>
    Object.fromEntries(CODE_DIGITS.map((digit) => [digit, '']))
  );
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /* HIDING ONLY - the route checks every save for itself. can() answers
     true whenever it does not positively know otherwise, so an ungoverned
     role keeps the button exactly as it was. Update OR create, matching
     the rule the route applies. */
  const SCREEN = '/admin/setting/purchase-rate-code';
  const maySave = scope.can
    ? (scope.can(SCREEN, 'update') || scope.can(SCREEN, 'create'))
    : true;
  const noSaveReason = 'You do not have Update permission for this screen.';
  const [flash, setFlash] = useState(null);
  const [preview, setPreview] = useState('');

  const qs = useMemo(
    () => new URLSearchParams({ business: scope.business || '', location: scope.location || '' }).toString(),
    [scope.business, scope.location]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${ENDPOINT}?${qs}`);
      const data = await res.json().catch(() => ({}));
      const saved = data.doc?.digitMappings || {};
      setMapping(Object.fromEntries(CODE_DIGITS.map((digit) => [digit, saved[digit] || ''])));
      if (data.doc) setIsActive(data.doc.isActive !== false);
    } catch {
      setFlash({ ok: false, text: 'Could not load the saved configuration.' });
    } finally {
      setLoading(false);
    }
  }, [qs]);

  useEffect(() => { load(); }, [load]);

  /* Validated live so the Save button can say why it is refusing, rather than
     the admin discovering it only after a round trip. */
  const { ok, errors } = useMemo(() => validateMapping(mapping), [mapping]);

  const setDigit = (digit, value) =>
    setMapping((current) => ({ ...current, [digit]: value.trim().toUpperCase() }));

  async function save() {
    if (!ok) { setFlash({ ok: false, text: errors[0] }); return; }
    setSaving(true);
    setFlash(null);
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          digitMappings: mapping,
          isActive,
          business: scope.business,
          location: scope.location,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setFlash({ ok: true, text: 'Configuration saved.' });
    } catch (e) {
      setFlash({ ok: false, text: e.message || 'Save failed' });
    } finally {
      setSaving(false);
    }
  }

  /* The preview echoes what the mapping currently in the form would do -
     including the unsaved edits - so a change can be checked before saving. */
  const encodedPreview = encodeRate(preview, mapping);
  const decodedPreview = decodeRate(encodedPreview, mapping);

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">
          <Icon name="barcode" size={15} /> Purchase Rate Code Master
        </span>
      </div>

      <div className="card-body">
        <p className="mb-4 text-[13px] text-inkmuted">
          Configure the alphabet/code used to encode and decode Purchase Rate digits.
          {' '}{PASSTHROUGH_NOTE}
        </p>

        {flash && (
          <div className={`flash ${flash.ok ? 'flash-ok' : 'flash-err'}`}>{flash.text}</div>
        )}

        {loading ? (
          <div className="dt-empty"><span className="spin" /></div>
        ) : (
          <>
            <div className="max-w-[420px] overflow-x-auto">
              <table className="dt">
                <thead>
                  <tr>
                    <th style={{ width: 110 }}>Digit</th>
                    <th>Code / Alphabet</th>
                  </tr>
                </thead>
                <tbody>
                  {CODE_DIGITS.map((digit) => (
                    <tr key={digit}>
                      <td className="font-semibold">{digit}</td>
                      <td>
                        <input
                          className="f-input h-8 w-[120px]"
                          value={mapping[digit]}
                          maxLength={4}
                          placeholder="-"
                          onChange={(e) => setDigit(digit, e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <label className="mt-4 flex w-fit cursor-pointer items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#0d5ddc]"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Active - encode purchase rates using this configuration
            </label>

            {/* Every reason the mapping cannot be saved, all at once. */}
            {!ok && (
              <ul className="mt-3 list-disc pl-5 text-[12.5px] text-danger">
                {errors.map((message) => <li key={message}>{message}</li>)}
              </ul>
            )}

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving || !ok || !maySave}
                title={!maySave ? noSaveReason : undefined}
                onClick={save}
              >
                <Icon name="save" size={13} /> {saving ? 'Saving...' : 'Save Configuration'}
              </button>
              <button type="button" className="btn" disabled={saving} onClick={load}>
                <Icon name="undo" size={13} /> Revert
              </button>
            </div>

            {/* ---------------------------------------------------- preview -- */}
            <div className="mt-6 border-t border-line pt-4">
              <label className="f-label">Try it - type a purchase rate</label>
              <input
                className="f-input max-w-[240px]"
                value={preview}
                inputMode="decimal"
                placeholder="119583.05"
                onChange={(e) => setPreview(e.target.value)}
              />
              {preview !== '' && (
                <div className="mt-3 space-y-1 text-[13px]">
                  <div>
                    Encoded:{' '}
                    <span className="font-mono font-bold">
                      {encodedPreview || <span className="text-danger">complete the mapping above first</span>}
                    </span>
                  </div>
                  {encodedPreview && (
                    <div className="text-inkmuted">
                      Decodes back to: <span className="font-mono">{decodedPreview}</span>
                      {decodedPreview !== String(preview).trim() && (
                        <span className="ml-2 text-danger">
                          does not round-trip - check for duplicate codes
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
