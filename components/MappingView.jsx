'use client';
import { useEffect, useState } from 'react';
import Icon from './Icon';
import MultiSelect from './MultiSelect';
import { useScope } from './ScopeContext';
import { useOptions } from './useOptions';

/* Purpose <-> selector tables: Ledger Mapping, Ledger Setting,
   Business Contact Mapping. One document holds every pair. */

export default function MappingView({ cfg, slug }) {
  const scope = useScope();
  const map = cfg.mapping;
  const { options, loading } = useOptions(map.ref);
  const dyn = useOptions(map.dynamicRowsFrom || null);

  const slugPath = cfg.slugPath || slug;

  const [pairs, setPairs] = useState({});
  const [flash, setFlash] = useState(null);
  const [saving, setSaving] = useState(false);

  /* HIDING ONLY - the route checks every save for itself. can() answers true
     whenever it does not positively know otherwise, so an ungoverned role
     keeps the button exactly as it was. Update OR create, matching the rule
     the route applies. */
  const screenKey = (cfg.basePath || '') + (cfg.slugPath || slug || '');
  const maySave = scope.can
    ? (scope.can(screenKey, 'update') || scope.can(screenKey, 'create'))
    : true;
  const noSaveReason = 'You do not have Update permission for this screen.';


  const rows = map.dynamicRowsFrom
    ? dyn.options.map((o) => ({ key: o.value, label: o.label }))
    : (map.rows || []).map((r) => ({ key: r, label: r }));

  useEffect(() => {
    if ((cfg.scope || []).includes('business') && !scope.business) return;

    const qs = new URLSearchParams({
      business: scope.business || '', location: scope.location || '', finYear: scope.finYear || '',
    });

    fetch(cfg.endpoint + '?' + qs)
      .then((r) => r.json())
      .then((d) => setPairs((d.doc && d.doc.pairs) || {}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugPath, scope.business, scope.location, scope.finYear]);

  async function submit() {
    setSaving(true); setFlash(null);
    try {
      const payload = {
        pairs,
        business: scope.business, location: scope.location, finYear: scope.finYear,
      };
      await fetch(cfg.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setFlash('Saved successfully.');
    } finally { setSaving(false); }
  }

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title"><Icon name="ledger" size={15} /> {cfg.title}</span>
        <span className="flex-1" />
        <button type="button" className="btn btn-ghost" disabled><Icon name="refresh" size={14} /> Refresh</button>
      </div>

      <div className="card-body">
        {flash && <div className="flash flash-ok">{flash}</div>}

        <div className="mx-auto max-w-[900px]">
          <table className="map-tbl">
            <thead>
              <tr><th>{map.keyHeader}</th><th>{map.valueHeader}</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="map-key">{r.label}</td>
                  <td>
                    <MultiSelect
                      mode="single"
                      options={options}
                      loading={loading}
                      value={pairs[r.key] || ''}
                      placeholder={map.placeholder || 'Select...'}
                      onChange={(v) => setPairs((p) => ({ ...p, [r.key]: v }))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            type="button"
            className="btn btn-primary btn-submit"
            onClick={submit}
            disabled={saving || !maySave}
            title={!maySave ? noSaveReason : undefined}
          >
            {saving ? <span className="spin" /> : <Icon name="save" size={14} />} Submit
          </button>
          {!maySave && <span className="ml-2 text-[12px] text-danger">{noSaveReason}</span>}
        </div>
      </div>
    </div>
  );
}
