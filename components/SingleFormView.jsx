'use client';
import { useEffect, useState } from 'react';
import Icon from './Icon';
import Field from './Field';
import { useScope } from './ScopeContext';

/* One-record-per-scope settings pages: Purchase Setting, POS Setting,
   Login Security, Location Setting, E-commerce Settings, Loyalty Point.

   GET  <endpoint>?business=&location=&finYear=  -> { doc }
   POST <endpoint>                               -> upsert
*/

export default function SingleFormView({ cfg, slug }) {
  const scope = useScope();
  const sections = cfg.sections || [{ title: '', fields: cfg.fields || [] }];
  const allFields = sections.flatMap((s) => s.fields);

  const slugPath = cfg.slugPath || slug;

  const [data, setData] = useState(() => {
    const d = {};
    allFields.forEach((f) => { d[f.k] = f.def !== undefined ? f.def : ''; });
    return d;
  });
  const [errors, setErrors] = useState({});
  const [flash, setFlash] = useState(null);
  const [saving, setSaving] = useState(false);

  /* HIDING ONLY - the route checks every save for itself. can() answers
     true whenever it does not positively know otherwise, so an ungoverned
     role keeps the button exactly as it was. Update OR create, matching
     the rule the route applies: one button, either grant. */
  const screenKey = (cfg.basePath || '') + (cfg.slugPath || slug || '');
  const maySave = scope.can
    ? (scope.can(screenKey, 'update') || scope.can(screenKey, 'create'))
    : true;
  const noSaveReason = 'You do not have Update permission for this screen.';

  useEffect(() => {
    if ((cfg.scope || []).includes('business') && !scope.business) return;

    const qs = new URLSearchParams({
      business: scope.business || '', location: scope.location || '', finYear: scope.finYear || '',
    });
    const url = cfg.endpoint + '?' + qs;

    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (!d.doc) return;
        setData((prev) => {
          const next = { ...prev };
          Object.keys(next).forEach((k) => {
            const v = d.doc[k];
            if (v !== null && v !== undefined) {
              next[k] = allFields.find((f) => f.k === k)?.type === 'ref' ? String(v) : v;
            }
          });
          return next;
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugPath, scope.business, scope.location, scope.finYear]);

  const set = (k, v) => { setData((d) => ({ ...d, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };

  async function submit() {
    setSaving(true); setFlash(null);
    try {
      const payload = {
        data,
        business: scope.business, location: scope.location, finYear: scope.finYear,
      };
      const r = await fetch(cfg.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (r.status === 422) {
        setErrors(d.errors || {});
        setFlash({ type: 'err', msg: 'Please correct the highlighted fields.' });
        return;
      }
      setFlash({ type: 'ok', msg: 'Saved successfully.' });
    } finally { setSaving(false); }
  }

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title"><Icon name="gear" size={15} /> {cfg.title}</span>
        <span className="flex-1" />
        <button type="button" className="btn btn-ghost" disabled><Icon name="refresh" size={14} /> Refresh</button>
      </div>

      <div className="card-body">
        {flash && <div className={'flash ' + (flash.type === 'err' ? 'flash-err' : 'flash-ok')}>{flash.msg}</div>}

        {sections.map((s, i) => (
          <div key={i} className="form-section">
            {s.title && <div className="form-section-title">{s.title}</div>}
            <div className="form-grid">
              {s.fields.map((f) => (
                <Field key={f.k} f={f} value={data[f.k]} error={errors[f.k]} onChange={set} />
              ))}
            </div>
          </div>
        ))}

        {!maySave && <div className="mb-2 text-[12px] text-danger">{noSaveReason}</div>}
        <button
          type="button"
          className="btn btn-primary btn-submit"
          onClick={submit}
          disabled={saving || !maySave}
          title={!maySave ? noSaveReason : undefined}
        >
          {saving ? <span className="spin" /> : <Icon name="save" size={14} />} Submit
        </button>
      </div>
    </div>
  );
}
