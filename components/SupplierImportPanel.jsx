'use client';
import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import Icon from './Icon';
import { matchOption, parseGstText, squash } from '@/lib/gstPasteParser';

/* Import Supplier Data - a pasted GST portal result and Excel.

   The GST side calls NO external service. GSTIN lookup is a paid, per-call
   API, so the operator searches the GSTIN on the government portal in their
   own browser, copies the result, and pastes it here; the parsing happens
   locally in lib/gstPasteParser.js. Nothing leaves this machine except the
   two lookups against our OWN database - does this GSTIN already exist, and
   do these HSN codes / this city exist in our masters - which are free.

  GST values are applied directly to the form after parsing. Excel keeps its
  existing review table because this change only simplifies the GST flow.

  Nothing here saves. Imported values land in the form's state and the
   supplier is written only when the operator hits Submit. */

/* Parsed GST -> supplier form. Everything the portal prints that this form
  has a home for now goes into a field. */

/* Taxpayer Type is the portal's word; gstType is ours, and its options are
   fixed by the supplier form. Composition and SEZ line up exactly; every
   other taxpayer type on the portal is a registered dealer. */
function gstTypeFromTaxpayer(taxpayerType) {
  const v = squash(taxpayerType);
  if (!v) return '';
  if (v.includes('composition')) return 'Composition';
  if (v.includes('sez')) return 'SEZ';
  return 'Registered';
}

/* Constitution of Business -> the Business Type dropdown.

   Written out rather than left to matchOption, because a loose match gets
   this wrong in a way that looks right: "Limited Liability Partnership"
   contains "Partnership", so a partial match would file every LLP as a
   partnership. Order matters here too - the LLP test runs before the
   partnership one for the same reason.

   A constitution none of these covers ("Government Department", "Statutory
   Body", "Foreign Company") is answered with 'Others', which the dropdown
   holds; an empty or unreadable one is answered with nothing at all, and the
   caller says so rather than picking something plausible. */
function businessTypeFromConstitution(constitution) {
  const v = squash(constitution);
  if (!v) return '';
  if (v.includes('proprietor')) return 'Proprietorship';
  if (v.includes('limitedliabilitypartnership') || v.includes('llp')) return 'LLP';
  if (v.includes('privatelimited')) return 'Private Limited';
  if (v.includes('publiclimited')) return 'Public Limited';
  if (v.includes('partnership')) return 'Partnership';
  if (v.includes('hindu') || v === 'huf') return 'HUF';
  if (v.includes('trust') || v.includes('society') || v.includes('club') || v.includes('aop')) return 'Trust';
  if (v.includes('individual')) return 'Individual';
  if (v.includes('unregistered')) return 'Un-Registered';
  return 'Others';
}

/* `cityMatch` is the city as our own master spells it, or '' when we could
   not match it - in which case the field is deliberately left for the
   operator rather than filled with a name the dropdown does not hold. */
function mapParsedToFields(parsed, cityMatch) {
  const values = {};
  const put = (field, value) => { if (String(value ?? '').trim()) values[field] = String(value).trim(); };

  put('gstNo', parsed.gstin);
  put('pan', parsed.pan);

  /* GST TRADE NAME → both ERP name fields.
     The GST portal stores two separate names:
       legalName  = the proprietor/director's registered legal name
                    (e.g. "MITTA ASWARTHA VENKATA KARTHIK")
       tradeName  = the name the business actually operates under
                    (e.g. "MAHATHI TECHNOLOGIES")

     Every dropdown, GRC, purchase document and printed label in this ERP
     reads `businessName` (= "Legal Name of Business"). That field must
     carry the trading name, not the proprietor's personal name.

     Rule:
       • tradeName present  → use it for both businessName and shortName
       • tradeName absent   → fall back to legalName for both
       • both absent        → put() silently skips (value is empty)

     This keeps both fields identical and ensures the name shown throughout
     the system matches what the supplier trades under. */
  const primaryName = String(parsed.tradeName ?? '').trim() || String(parsed.legalName ?? '').trim();
  put('businessName', primaryName);   // Legal Name of Business
  put('shortName',    primaryName);   // Trade Name
  put('additionalTradeName', parsed.additionalTradeName);
  put('gstRegDate', parsed.registrationDate?.iso);
  put('businessType', businessTypeFromConstitution(parsed.constitution));
  put('gstType', gstTypeFromTaxpayer(parsed.taxpayerType));
  put('gstStatus', parsed.gstStatus);
  put('gstTaxpayerType', parsed.taxpayerType);
  put('gstAadhaarAuthenticated', parsed.aadhaarAuthenticated);
  put('gstEkycVerified', parsed.ekycVerified);
  put('gstCoreBusinessActivity', parsed.coreBusinessActivity || parsed.businessActivities.join(', '));
  /* no field of their own - stored against the supplier so the jurisdiction
     the search returned is not simply discarded */
  put('gstAdministrativeOffice', parsed.administrativeOffice);
  put('gstOtherOffice', parsed.otherOffice);
  put('billingAddressLine1', parsed.address?.line1);
  put('billingAddressLine2', parsed.address?.line2);
  put('billingDistrict', parsed.address?.district);
  put('billingState', parsed.address?.state);
  put('billingZipCode', parsed.address?.pincode);
  put('billingCity', cityMatch);
  /* Country is not printed - a GSTIN is an Indian registration, so an address
     read off one is in India by definition. Only claimed when there was an
     address to read. */
  if (parsed.address?.line1 || parsed.address?.state) put('billingCountry', 'India');
  return values;
}

/* Excel headers -> supplier form. Matched on a squashed lowercase form of the
   header, so "Contact Number", "contact_number" and "CONTACT NUMBER" are the
   same column. Several spellings map to one field because these sheets come
   from different vendors. */
const EXCEL_ALIASES = {
  businessName: ['suppliername', 'supplier', 'businessname', 'name', 'partyname', 'legalname'],
  shortName: ['shortname', 'tradename', 'alias'],
  gstNo: ['gstin', 'gstno', 'gst', 'gstnumber'],
  billingAddressLine1: ['address', 'addressline1', 'address1', 'billingaddress'],
  billingAddressLine2: ['addressline2', 'address2'],
  billingCity: ['city', 'town'],
  billingDistrict: ['district'],
  billingState: ['state'],
  billingZipCode: ['pincode', 'pin', 'zipcode', 'zip', 'postalcode'],
  billingCountry: ['country'],
  billingMobile: ['contactnumber', 'mobile', 'mobileno', 'phone', 'phoneno', 'contact'],
  billingAlternateContactNumber: ['alternatecontactnumber', 'alternatecontact', 'altcontact', 'alternatemobile'],
  billingEmail: ['email', 'emailid', 'emailaddress'],
  billingEmail2: ['email2', 'alternateemail', 'secondaryemail'],
  billingWebsiteUrl: ['website', 'websiteurl', 'url', 'web'],
  billingLandline: ['landline', 'telephone'],
  billingFax: ['fax'],
  pan: ['pan', 'panno', 'pannumber'],
};

const FIELD_BY_HEADER = (() => {
  const map = new Map();
  Object.entries(EXCEL_ALIASES).forEach(([field, aliases]) => {
    aliases.forEach((a) => { if (!map.has(a)) map.set(a, field); });
  });
  return map;
})();

function readWorkbook(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const wb = XLSX.read(reader.result, { type: 'array', cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        if (!sheet) throw new Error('That workbook has no sheets.');
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
        const headers = (rows.shift() || []).map((h) => String(h ?? '').trim());
        if (!headers.some(Boolean)) throw new Error('The first row must contain column headings.');
        const body = rows.filter((r) => r.some((c) => String(c ?? '').trim() !== ''));
        if (!body.length) throw new Error('The sheet has headings but no data rows.');
        resolve({ headers, rows: body });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsArrayBuffer(file);
  });
}

/* One sheet row -> {field: value}, plus the headings we could not place, so
   the review step can say what was ignored instead of dropping it silently. */
function mapExcelRow(headers, row) {
  const values = {};
  const unmapped = [];
  headers.forEach((header, i) => {
    const raw = String(row[i] ?? '').trim();
    const field = FIELD_BY_HEADER.get(squash(header));
    if (!field) { if (header && raw) unmapped.push(header); return; }
    if (raw && !values[field]) values[field] = raw;
  });
  return { values, unmapped };
}

function Modal({ title, onClose, children, wide, headerAction }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
      <div className={'flex max-h-[calc(100vh-2rem)] w-full flex-col rounded-lg bg-white shadow-xl ' + (wide ? 'max-w-[760px]' : 'max-w-[460px]')}>
        <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-3">
          <span className="text-[15px] font-bold uppercase tracking-wide">{title}</span>
          <div className="flex items-center gap-1">
            {headerAction}
            <button type="button" onClick={onClose} className="text-2xl leading-none text-inkmuted" aria-label="Close">×</button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

/* `subject` is the word this panel calls the record it is filling. It exists
   because the POS till's Add Customer dialog reuses this panel whole, and a
   dialog headed "Import Supplier Data" while adding a customer reads like the
   wrong screen opened. It changes wording only - the parsing, the field map
   and the Excel reader are the same for both.

   Defaulting to 'Supplier' keeps the three supplier call sites reading exactly
   as they did. */
export default function SupplierImportPanel({ data = {}, labels = {}, onApply, subject = 'Supplier' }) {
  const lower = subject.toLowerCase();
  const [mode, setMode] = useState(null);          // 'gst' | 'excel' | null
  const [paste, setPaste] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [review, setReview] = useState(null);      // Excel review data
  const fileRef = useRef(null);

  const labelFor = (k) => labels[k] || k;
  const close = () => { setMode(null); setError(''); setReview(null); setPaste(''); };

    /* Build the Excel review table from a {field: value} patch. */
  function openReview(source, values, context = [], unmapped = []) {
    const rows = Object.entries(values)
      .filter(([, v]) => String(v ?? '').trim() !== '')
      .map(([field, incoming]) => {
        const current = String(data[field] ?? '');
        return { field, incoming: String(incoming), current, conflict: current.trim() !== '' && current !== String(incoming) };
      })
      .filter((r) => r.current !== r.incoming);

    if (!rows.length) {
      setError('Nothing new to import - the form already holds these values.');
      return;
    }
    setReview({ source, rows, context, unmapped });
    setError('');
  }

  /* Look a value up in one of OUR masters. Free, local, and the reason the
     preview can say "5210 is not in your HSN master" instead of guessing. */
  async function lookup(url) {
    try {
      const r = await fetch(url);
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  }

  /* Paste -> parse -> apply the mapped fields directly. No GST API. */
  async function parsePaste() {
    const text = paste.trim();
    if (!text) { setError('Paste the GST taxpayer details first.'); return; }

    const parsed = parseGstText(text);
    if (!parsed.ok) {
      setError('Unable to identify GST taxpayer information. Please paste the complete GST taxpayer result from the GST portal.');
      return;
    }
    if (!parsed.gstin) {
      setError('GSTIN could not be detected. Please include the full search result, which carries the GSTIN/UIN.');
      return;
    }

    setBusy(true); setError('');
    try {
      /* City: only fill it if our own city master actually holds it. A city
         the dropdown does not have would either sit there invalid or tempt a
         duplicate master record, so an unmatched one is left blank and said
         out loud instead. */
      const wantCity = parsed.address?.city || '';
      let cityMatch = wantCity;
      if (wantCity) {
        const cities = await lookup('/api/cities?q=' + encodeURIComponent(wantCity));
        cityMatch = matchOption(wantCity, cities?.options || []) || wantCity;
      }

      const values = mapParsedToFields(parsed, cityMatch);
      onApply(values, 'GST');
      close();
    } finally {
      setBusy(false);
    }
  }

  async function pickExcel(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true); setError('');
    try {
      const { headers, rows } = await readWorkbook(file);
      /* one supplier per import - this panel fills the form in front of the
         user, so the first data row is the one being edited */
      const { values, unmapped } = mapExcelRow(headers, rows[0]);
      if (!Object.keys(values).length) {
        setError('None of the column headings matched a ' + lower + ' field. Expected headings such as Name, GSTIN, Address, City, State, Pincode.');
        return;
      }
      const context = rows.length > 1
        ? [['Note', `The sheet has ${rows.length} rows; the first one is shown. Import the rest from the ${lower} list.`]]
        : [];
      openReview('Excel', values, context, unmapped);
    } catch (e) {
      setError(e.message || 'Could not read that workbook.');
    } finally {
      setBusy(false);
    }
  }

  function applyChosen() {
    const patch = {};
    review.rows.forEach((r) => { patch[r.field] = r.incoming; });
    onApply(patch, review.source);
    close();
  }

  return (
    <div className="mb-4">
      <div className="mb-3 flex items-center border-b border-line bg-[#f7f9fc] px-3 py-2">
        <span className="text-[14px] font-bold">Import {subject} Data</span>
      </div>
      <div className="flex flex-wrap gap-2 px-3">
        <button type="button" className="btn" onClick={() => { setMode('gst'); setError(''); }}>
          <Icon name="search" size={14} /> Import from GST
        </button>
        <span className="self-center text-[12px] text-inkmuted">
          Paste the taxpayer details you copied from the GST portal - no lookup fee.
        </span>
        <button type="button" className="btn" onClick={() => { setMode('excel'); setError(''); fileRef.current?.click(); }}>
          <Icon name="file" size={14} /> Import from Excel
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={pickExcel} className="hidden" />
      </div>

        {/* Paste box. Parsing is local and applies the mapped fields directly. */}
        {mode === 'gst' && (
        <Modal
          title={'Import ' + subject + ' From GST'}
          onClose={close}
          wide
          headerAction={(
            /* Same blue, radius and hover as the .btn-primary below it - the
              Import button, and the active tab - so the shortcut
               to the portal reads as an action rather than as chrome. Size,
               position and tooltip are untouched. */
            <a
              href="https://services.gst.gov.in/services/searchtp"
              target="_blank"
              rel="noopener noreferrer"
              title="Search GST Portal"
              aria-label="Search GST Portal"
              className="flex h-8 w-8 items-center justify-center rounded-md bg-brand leading-none text-white hover:bg-brand-hover"
            >
              <Icon name="plus" size={16} />
            </a>
          )}
        >
          <div className="flex-1 overflow-y-auto p-5">
            <p className="mb-3 text-[13px] text-inkmuted">
              Copy the complete taxpayer details from the GST portal and paste them below.
              The system will automatically identify and populate the matching {lower} information.
            </p>
            <textarea
              value={paste}
              autoFocus
              rows={14}
              placeholder="Paste complete GST taxpayer details here..."
              onChange={(e) => { setPaste(e.target.value); setError(''); }}
              className="w-full resize-y rounded-md border border-linestrong p-2.5 font-mono text-[12.5px] leading-[1.5]"
            />
            {error && <div className="flash flash-err mt-3">{error}</div>}
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-3">
            <button type="button" className="btn" onClick={close}>Cancel</button>
            <button type="button" className="btn btn-primary flex h-[38px] min-w-[160px] justify-center" onClick={parsePaste} disabled={busy}>
              {busy ? <span className="spin" /> : <Icon name="check" size={14} />} Import
            </button>
          </div>
        </Modal>
      )}

      {/* Excel picker is the OS dialog, so only an error needs a surface */}
      {mode === 'excel' && !review && error && (
        <Modal title="Import from Excel" onClose={close}>
          <div className="p-5">
            <div className="flash flash-err">{error}</div>
            <button type="button" className="btn mt-3 flex h-[38px] w-full justify-center" onClick={() => fileRef.current?.click()}>
              <Icon name="file" size={14} /> Choose another file
            </button>
          </div>
        </Modal>
      )}

      {review && review.source === 'Excel' && (
        <Modal title="Excel Import Preview" onClose={close} wide>
          <div className="flex-1 overflow-y-auto p-5">
            <p className="mb-3 text-[13px] text-inkmuted">
              Tick the values to bring into the form. Rows that would replace something you already
              entered are left unticked. Nothing is saved until you Submit.
            </p>

            {/* Every value below is text the operator pasted. It is rendered
                as text - no markup is interpreted anywhere in this panel. */}
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#f7f9fc] text-left">
                  <th className="border border-line px-2 py-2">Field</th>
                  <th className="border border-line px-2 py-2">Current</th>
                  <th className="border border-line px-2 py-2">Incoming</th>
                </tr>
              </thead>
              <tbody>
                {review.rows.map((r) => (
                  <tr key={r.field} className={r.conflict ? 'bg-[#fff8e6]' : ''}>
                    <td className="border border-line px-2 py-2 font-semibold">
                      {labelFor(r.field)}
                    </td>
                    <td className="border border-line px-2 py-2 text-inkmuted">{r.current || '—'}</td>
                    <td className="border border-line px-2 py-2">{r.incoming}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {review.context.length > 0 && (
              <div className="mt-4">
                <div className="mb-1 text-[13px] font-bold">Also returned</div>
                <table className="w-full border-collapse text-[13px]">
                  <tbody>
                    {review.context.map(([label, value]) => (
                      <tr key={label}>
                        <td className="border border-line px-2 py-1.5 font-semibold">{label}</td>
                        <td className="border border-line px-2 py-1.5">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-1 text-[12px] text-inkmuted">Shown for reference - the supplier form has no field for these.</p>
              </div>
            )}

            {review.unmapped?.length > 0 && (
              <p className="mt-3 text-[12px] text-inkmuted">
                Ignored columns: {review.unmapped.join(', ')} - no matching {lower} field.
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-3">
            <button type="button" className="btn" onClick={close}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={applyChosen}>
              <Icon name="check" size={14} />
              {` Import ${review.rows.length} field${review.rows.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
