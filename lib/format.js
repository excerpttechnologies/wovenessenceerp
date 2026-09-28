export function fmt(kind, value, labels = {}) {
  if (value === null || value === undefined || value === '') return '';
  switch (kind) {
    case 'ref': return labels[String(value)] || '';
    case 'activeText': return String(value);
    case 'yesno': return value === true ? 'Yes' : value === false ? 'No' : String(value);
    case 'amount': return Number(value).toFixed(2);
    case 'date': {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return String(value);
      const p = (n) => String(n).padStart(2, '0');
      return p(d.getDate()) + '-' + p(d.getMonth() + 1) + '-' + d.getFullYear();
    }
    case 'datetime': {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return String(value);
      const p = (n) => String(n).padStart(2, '0');
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
        + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
    }
    case 'dash': return String(value);
    case 'list': return Array.isArray(value) ? value.join(', ') : String(value);
    case 'count': return Array.isArray(value) ? String(value.length) : '0';
    default: return String(value);
  }
}

/* Exports without a library: CSV and an Excel-readable HTML table, print for PDF. */
export function download(name, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

/* A CSV is a text file, but Excel is what opens it, and Excel reinterprets
   what it reads exactly as it does in toXlsHtml below - which is why the
   Date column came out as ######## there too. A .csv carries no formatting
   to say otherwise, so the only way to hold a value is to write it as a
   FORMULA returning a string: ="28-09-2026 12:27:22 PM". Excel evaluates
   that to the text and leaves it alone.

   Applied ONLY where Excel would actually get it wrong, so the file stays
   ordinary CSV everywhere else: WALK-IN CUSTOMER and CASH are written
   plainly, and only dates, times, numbers with leading zeros and long digit
   runs are wrapped. `numeric` names the columns to leave as real numbers,
   the same as toXlsHtml.

   It also closes CSV INJECTION. A cell beginning = + - or @ is run as a
   formula by Excel when the file is opened; wrapping it makes the cell a
   string literal, so a customer name typed as =HYPERLINK(..) is shown
   rather than executed. */
const EXCEL_WOULD_CONVERT = /^[0-9][0-9\-/.,: ]*(\s*[APap][Mm])?$/;
const FORMULA_START = /^[=+\-@\t\r]/;

export function toCsv(headers, rows, numeric = []) {
  const asNumber = new Set(numeric);
  const quote = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';

  const cell = (v, i) => {
    const text = String(v ?? '');
    if (asNumber.has(i) || text === '') return quote(text);
    if (!FORMULA_START.test(text) && !EXCEL_WOULD_CONVERT.test(text)) return quote(text);
    /* ="..." - the inner quotes are doubled for the formula, and the whole
       field is quoted and doubled again for the CSV itself */
    return quote('="' + text.replace(/"/g, '""') + '"');
  };

  return [
    headers.map((h) => quote(h)).join(','),
    ...rows.map((r) => r.map(cell).join(',')),
  ].join('\r\n');
}

/* EVERY CELL IS WRITTEN AS TEXT unless the caller names its column as a
   number, because Excel reinterprets anything it is handed and three of those
   guesses corrupt data this app exports:

     "28-09-2026 12:27:22 PM"  read as a date, then shown as ######## in a
                               column too narrow for the format it chose
     "0054"                    leading zeros dropped - invoice 0054 became 54
     "98765434567"             an 11-digit phone number became 9.88E+10

   mso-number-format:'\@' is the instruction to leave the value exactly as
   written. It is an Excel-specific style and is ignored by anything else that
   opens the file, so nothing is lost by sending it.

   `numeric` is a list of COLUMN INDEXES that should stay real numbers, so a
   sheet of amounts can still be summed in Excel. A caller that names none
   gets every column as text - the safe reading, and the right one for a
   screen that has not said which of its columns are figures.

   Cells are HTML-escaped as well. They were not, so a value carrying & or <
   - an item description, a note - broke the markup of the sheet from that
   cell onward. */
export function toXlsHtml(title, headers, rows, numeric = []) {
  const esc = (v) => String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const asNumber = new Set(numeric);
  /* Built from char codes rather than written out: the value Excel wants is
     mso-number-format:'\@' - a backslash and an at-sign inside single
     quotes inside a double-quoted attribute inside a JS string, which is one
     layer of escaping too many to read or to keep correct. */
  const Q = String.fromCharCode(39);   // '
  const BS = String.fromCharCode(92);  // \
  const TEXT_CELL = ' style="mso-number-format:' + Q + BS + '@' + Q + '"';

  const th = headers.map((h) => '<th>' + esc(h) + '</th>').join('');
  const tr = rows.map((r) => '<tr>'
    + r.map((c, i) => '<td' + (asNumber.has(i) ? '' : TEXT_CELL) + '>' + esc(c) + '</td>').join('')
    + '</tr>').join('');

  return '<html><head><meta charset="utf-8"></head><body><table border="1">'
    + '<thead><tr>' + th + '</tr></thead><tbody>' + tr + '</tbody></table></body></html>';
}

export function printTable(title, headers, rows) {
  const w = window.open('', '_blank');
  if (!w) return;
  const th = headers.map((h) => '<th>' + h + '</th>').join('');
  const tr = rows.map((r) => '<tr>' + r.map((c) => '<td>' + (c ?? '') + '</td>').join('') + '</tr>').join('');
  w.document.write(
    '<html><head><title>' + title + '</title><style>'
    + 'body{font-family:Arial;padding:20px}h3{margin:0 0 12px}'
    + 'table{border-collapse:collapse;width:100%;font-size:12px}'
    + 'th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#f2f4f8}'
    + '</style></head><body><h3>' + title + '</h3><table><thead><tr>'
    + th + '</tr></thead><tbody>' + tr + '</tbody></table></body></html>'
  );
  w.document.close();
  w.print();
}
