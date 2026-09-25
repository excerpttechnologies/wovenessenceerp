'use client';
import { useState } from 'react';
import Icon from './Icon';

export default function Toolbar({
  columns, hidden, onToggleColumn, search, onSearch, onAdd, addLabel = 'ADD',
  onExportCsv, onExportExcel, onExportPdf, showAdd = true,
  showCsv = true, showExcel = true, showPdf = true,
  /* ADD is DISABLED rather than removed when the role may not create here.

     A button that vanishes leaves the operator wondering whether the screen
     is broken or they are looking in the wrong place; one that is visibly
     dead, with the reason beside it, tells them what to ask for. The server
     refuses the request either way - see lib/screenPermission.js. */
  addDisabled = false, addDisabledReason = '',
}) {
  const [pop, setPop] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative">
          <button type="button" className="btn" onClick={() => setPop((p) => !p)}>
            <Icon name="cols" size={14} /> Column visibility
          </button>
          {pop && (
            <div className="absolute z-40 mt-1 max-h-72 min-w-[210px] overflow-auto rounded-md border border-linestrong bg-white p-2 shadow-pop">
              {columns.map((c, i) => (
                <label key={c.t + i} className="flex cursor-pointer gap-2 px-1.5 py-1 text-[13px]">
                  <input
                    type="checkbox"
                    checked={!hidden.includes(c.t)}
                    onChange={() => onToggleColumn(c.t)}
                  />
                  {c.t}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1" />

        {/* Icon only, with the wording kept in title and aria-label.

            All three used to draw the SAME "file" icon, which is fine beside a
            label and useless without one - so each takes an icon that says
            which format it is: a document for CSV, a grid for the spreadsheet,
            and a printer for PDF, which is what that export actually does
            (lib/format prints the table). */}
        {/* Each export in the colour its format is known by - Excel green,
            PDF red, CSV a neutral slate - so the three are told apart at a
            glance now that they carry no words. The wording stays in title and
            aria-label for the tooltip and for screen readers. */}
        {showCsv && <button type="button" className="inline-flex h-9 w-10 items-center justify-center rounded bg-[#495464] text-white" title="Export to CSV" aria-label="Export to CSV" onClick={onExportCsv}><Icon name="file" size={16} /></button>}
        {showExcel && <button type="button" className="inline-flex h-9 w-10 items-center justify-center rounded bg-[#1d6f42] text-white" title="Export to Excel" aria-label="Export to Excel" onClick={onExportExcel}><Icon name="grid" size={16} /></button>}
        {showPdf && <button type="button" className="inline-flex h-9 w-10 items-center justify-center rounded bg-[#b30b00] text-white" title="Export to PDF" aria-label="Export to PDF" onClick={onExportPdf}><Icon name="printer" size={16} /></button>}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        <span className="relative">
          <span className="absolute left-2.5 top-2 text-[#93a0b5]"><Icon name="search" size={15} /></span>
          <input
            className="search-input"
            placeholder="Search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
        </span>
        {showAdd && (
          <button
            type="button"
            className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onAdd}
            disabled={addDisabled}
            title={addDisabled ? addDisabledReason : undefined}
          >
            <Icon name="plus" size={14} /> {addLabel}
          </button>
        )}
        {showAdd && addDisabled && addDisabledReason && (
          <span className="text-[12px] text-danger">{addDisabledReason}</span>
        )}
      </div>
    </>
  );
}
