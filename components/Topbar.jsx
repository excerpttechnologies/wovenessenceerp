'use client';
import Icon from './Icon';
import NotificationBell from './NotificationBell';
import { ChatBotButton } from './ChatBot';
import { useScope, FIN_YEARS } from './ScopeContext';

export default function Topbar({ onToggleSidebar }) {
  const { businesses, locations, business, location, finYear, setBusiness, setLocation, setFinYear } = useScope();

  return (
    <header className="sticky top-0 z-20 flex h-topbar items-center gap-4 bg-white px-5">
      <div className="flex items-center gap-2">
        {/* <span className="grid grid-cols-3 gap-0.5">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <i key={n} className={'block h-1.5 w-1.5 ' + (n === 1 || n === 5 ? 'bg-[#7ea3dd]' : 'bg-[#2f5fb3]')} />
          ))}
        </span> */}
        <span className="leading-none">
          <b className="text-[17px] text-brand-logo">RETAIL ERP</b>
          <span className="block text-[8.5px] text-[#7b8798]">EXCERPT TECHNOLOGIES PVT LTD</span>
        </span>
      </div>

      <div className="flex-1" />

      {/* Company and Location sit side by side, are styled identically and are
          both ellipsised at 200px - and here they are named from the same words:
          the branch TEMPLE FABRICS, SILKS & SAREES holds a location recorded as
          OMSHREE FABS (TEMPLE FABRICS RRN). With no caption over either box the
          location reads as though the branch had switched to it. Both selects
          were already keyed on _id and neither has ever matched on a name; what
          was missing was saying which box is which. `title` carries the full
          name, since the visible text is cut off. */}
      <div>
        <span className="block text-[11px] leading-tight text-inkmuted">Company</span>
        <div className="tb-select-wrapper">
          <select
            className="tb-select"
            aria-label="Company"
            title={businesses.find((b) => b.value === business)?.label || 'Select Business'}
            value={business}
            onChange={(e) => setBusiness(e.target.value)}
          >
            {businesses.length === 0 && <option value="">Select Business</option>}
            {businesses.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <span className="block text-[11px] leading-tight text-inkmuted">Location</span>
        <div className="tb-select-wrapper">
          <select
            className="tb-select"
            aria-label="Location"
            title={locations.find((l) => l.value === location)?.label || 'Select Location'}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          >
            {locations.length === 0 && <option value="">Select Location</option>}
            {locations.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[#56637d]"><Icon name="cal" size={26} /></span>
        <span>
          <span className="block text-[11px] leading-tight text-inkmuted">Financial Year</span>
          <select
            className="border-0 bg-transparent p-0 text-[15px] font-bold text-ink outline-none"
            value={finYear}
            onChange={(e) => setFinYear(e.target.value)}
          >
            {FIN_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </span>
      </div>

      {/* bell and help bot as one group, so the pair keeps a tight gap */}
      <div className="flex shrink-0 items-center gap-1">
        <NotificationBell />
        <ChatBotButton />
      </div>

      <button type="button" onClick={onToggleSidebar} aria-label="Toggle menu" className="border-0 bg-transparent p-1 text-[#3c4a63]">
        <Icon name="burger" size={22} />
      </button>
    </header>
  );
}
