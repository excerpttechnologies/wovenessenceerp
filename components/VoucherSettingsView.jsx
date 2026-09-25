'use client';
import { useEffect, useState } from 'react';
import Icon from './Icon';
import MultiSelect from './MultiSelect';
import { useScope } from './ScopeContext';
import { useOptions } from './useOptions';

/* Voucher Settings - three bordered sections, each with a Dr and Cr
   multi-select of ledger groups. One document holds all three. */

export default function VoucherSettingsView({ cfg, slug }) {
  const scope = useScope();
  const spec = cfg.voucher;
  const { options, loading } = useOptions(spec.ref);

  const slugPath = cfg.slugPath || slug;

  const [groups, setGroups] = useState({});
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


  useEffect(() => {
    if (!scope.business) return;

    const qs = new URLSearchParams({
      business: scope.business, location: scope.location || '', finYear: scope.finYear || '',
    });

    fetch(cfg.endpoint + '?' + qs)
      .then((r) => r.json())
      .then((d) => setGroups((d.doc && d.doc.groups) || {}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugPath, scope.business, scope.location, scope.finYear]);

  const side = (gk, s) => (groups[gk] && groups[gk][s]) || [];
  const setSide = (gk, s, v) => setGroups((g) => ({ ...g, [gk]: { ...(g[gk] || {}), [s]: v } }));

  async function submit() {
    setSaving(true); setFlash(null);
    try {
      const payload = {
        groups,
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
        <span className="card-title"><Icon name="voucher" size={15} /> {cfg.title}</span>
        <span className="flex-1" />
        <button type="button" className="btn btn-ghost" disabled><Icon name="refresh" size={14} /> Refresh</button>
      </div>

      <div className="card-body">
        {flash && <div className="flash flash-ok">{flash}</div>}

        {spec.groups.map((g) => (
          <div key={g.k} className="vs-group">
            <h4 className="mb-0.5 text-[15px] font-bold">{g.title}</h4>
            <p className="mb-3 text-[13px] text-inkmuted">{g.sub}</p>

            <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2">
              <div>
                <div className="text-[13px]">Debtor (Dr) Ledger Groups</div>
                <div className="mb-1.5 text-[12.5px] text-inkmuted">{g.drCap}</div>
                <MultiSelect
                  options={options} loading={loading}
                  value={side(g.k, 'dr')}
                  onChange={(v) => setSide(g.k, 'dr', v)}
                />
              </div>
              <div>
                <div className="text-[13px]">Creditor (Cr) Ledger Groups</div>
                <div className="mb-1.5 text-[12.5px] text-inkmuted">{g.crCap}</div>
                <MultiSelect
                  options={options} loading={loading}
                  value={side(g.k, 'cr')}
                  onChange={(v) => setSide(g.k, 'cr', v)}
                />
              </div>
            </div>
          </div>
        ))}

        <div className="rounded-md border border-line px-4 py-3 text-[12.5px] text-inkmuted">{spec.note}</div>

        {!maySave && <div className="mt-3 text-[12px] text-danger">{noSaveReason}</div>}
        <button
          type="button"
          className="btn btn-primary mt-3 flex h-[38px] w-full justify-center"
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
