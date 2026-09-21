import * as XLSX from 'xlsx';
import dbConnect from '@/lib/db';
import { requireSession } from '@/lib/session';
import { json, scopeOf } from '@/lib/reports';
import { findMissingImages, SHEET_HEADERS, sheetRows } from '@/lib/missingImages';

/* ==========================================================================
   /api/reports/master-stock-report/missing-images  -  read-only.

   Every unit currently in stock whose Image column cannot show a picture,
   one line per barcode number. What counts as missing, and why a stored URL
   can still be missing, is documented in lib/missingImages.js - this route
   only serves it.

   Same scope as the report it belongs to (business / location / finYear from
   the top bar), so the numbers here and the numbers on screen always refer
   to the same stock.

     GET ...?business=..&location=..&finYear=..                -> JSON
     GET ...?business=..&location=..&finYear=..&format=xlsx    -> .xlsx file

   Deliberately unpaged: this is a worklist to be handed to whoever is taking
   the photographs, and half of it is not a worklist.
   ========================================================================== */

export async function GET(req) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const sp = new URL(req.url).searchParams;
  await dbConnect();

  const scope = scopeOf(sp);
  const { rows, counts, scanned } = await findMissingImages(scope);

  if (sp.get('format') !== 'xlsx') {
    return json({ total: rows.length, scanned, counts, rows });
  }

  const sheet = XLSX.utils.aoa_to_sheet([SHEET_HEADERS, ...sheetRows(rows)]);
  /* widths, so Item Name and the URL are readable without dragging columns */
  sheet['!cols'] = [
    { wch: 16 }, { wch: 14 }, { wch: 30 }, { wch: 8 },
    { wch: 12 }, { wch: 14 }, { wch: 60 }, { wch: 12 },
  ];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Missing Images');
  const buf = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="missing-images-${stamp}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
