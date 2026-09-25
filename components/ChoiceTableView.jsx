'use client';
import { useEffect, useState } from 'react';
import Icon from './Icon';
import { useScope } from './ScopeContext';

/* Barcode Label Settings / Invoice Layout Settings:
   Choice checkbox + Default radio per catalog row, plus a preview cell.
   Only rows with Choice ticked can be Default. */

export default function ChoiceTableView({ cfg, slug }) {
  const scope = useScope();
  const spec = cfg.choice;

  const slugPath = cfg.slugPath || slug;

  const [catalog, setCatalog] = useState([]);
  const [chosen, setChosen] = useState([]);
  const [def, setDef] = useState('');
  const [flash, setFlash] = useState(null);
  const [saving, setSaving] = useState(false);

  /* HIDING ONLY - the route checks every save for itself. can() answers
     true whenever it does not positively know otherwise, so an ungoverned
     role keeps the button exactly as it was. Update OR create, matching
     the rule the route applies. */
  const screenKey = (cfg.basePath || '') + (cfg.slugPath || slug || '');
  const maySave = scope.can
    ? (scope.can(screenKey, 'update') || scope.can(screenKey, 'create'))
    : true;
  const noSaveReason = 'You do not have Update permission for this screen.';

  useEffect(() => {
    fetch('/api/catalog?name=' + spec.catalog)
      .then((r) => r.json())
      .then((d) => setCatalog(d.rows || []))
      .catch(() => setCatalog([]));
  }, [spec.catalog]);

  useEffect(() => {
    if (!scope.business) return;

    const qs = new URLSearchParams({
      business: scope.business, location: scope.location || '', finYear: scope.finYear || '',
    });

    fetch(cfg.endpoint + '?' + qs)
      .then((r) => r.json())
      .then((d) => {
        const rows = (d.doc && d.doc.rows) || [];
        setChosen(rows.filter((r) => r.choice).map((r) => r.name));
        const dr = rows.find((r) => r.isDefault);
        setDef(dr ? dr.name : '');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugPath, scope.business, scope.location, scope.finYear]);

  function toggle(name) {
    setChosen((c) => {
      const next = c.includes(name) ? c.filter((x) => x !== name) : [...c, name];
      if (!next.includes(def)) setDef('');
      return next;
    });
  }

  async function submit() {
    setSaving(true); setFlash(null);
    try {
      const rows = catalog.map((r) => ({
        name: r.name, choice: chosen.includes(r.name), isDefault: def === r.name,
      }));
      const payload = {
        rows,
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
        <span className="card-title"><Icon name="grid" size={15} /> {cfg.title}</span>
      </div>

      <div className="card-body">
        {flash && <div className="flash flash-ok">{flash}</div>}

        <div className="overflow-x-auto">
          <table className="dt">
            <thead>
              <tr>
                <th className="text-center">Choice</th>
                <th className="text-center">Default</th>
                <th>{spec.nameHeader}</th>
                <th>Description</th>
                {spec.extraCols.map((c) => <th key={c.k} className="text-center">{c.t}</th>)}
                <th className="text-center">Preview</th>
              </tr>
            </thead>
            <tbody>
              {catalog.length === 0 && (
                <tr><td colSpan={5 + spec.extraCols.length} className="dt-empty">No Data..</td></tr>
              )}
              {catalog.map((r) => (
                <tr key={r._id}>
                  <td className="text-center">
                    <input type="checkbox" checked={chosen.includes(r.name)} onChange={() => toggle(r.name)} />
                  </td>
                  <td className="text-center">
                    <input
                      type="radio" name="defaultChoice"
                      disabled={!chosen.includes(r.name)}
                      checked={def === r.name}
                      onChange={() => setDef(r.name)}
                    />
                  </td>
                  <td className="text-brand-link">{r.name}</td>
                  <td>{r.description}</td>
                  {spec.extraCols.map((c) => <td key={c.k} className="text-center">{r[c.k]}</td>)}
                  <td className="text-center text-[#c3cbd9]"><Icon name="file" size={18} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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
