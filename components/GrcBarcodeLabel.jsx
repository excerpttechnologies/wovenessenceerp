'use client';
import BarcodeSvg from './BarcodeSvg';
import { toLabelData, formatLabelPrice } from '@/lib/barcodeLabelPrint';
import {
  labelGeometry,
  labelsPerRow,
  barsBox,
  fitType,
  MONO_CHAR_W,
  TEXT_CHAR_W,
  SECTION_ORDER,
  PAD_X_MM,
  PAD_Y_MM,
  BORDER_MM,
  QUIET_ZONE_MODULES,
  BAR_TEXT_GAP_MM,
  DESCRIPTION_LINES,
  mm,
} from '@/lib/barcodeLabelGeometry';

/* ==========================================================================
   GrcBarcodeLabel — the SINGLE label renderer shared by:

     - app/admin/transaction/purchase/barcode-print/[id]/page.jsx
         (the authoritative print output)
     - components/GCRBarcodeGeneration.jsx PrintLabelPicker preview
         (the WYSIWYG preview that must match print exactly)

   Both hand it the SAME rows and the SAME label format, so what is on screen
   and what comes off the printer are one layout with one geometry.

   A LABEL IS A PHYSICAL OBJECT, not a card on a web page. Its width, height
   and the eight bands it is divided into come from lib/barcodeLabelGeometry.js
   and are set in MILLIMETRES — the one CSS unit that survives the browser's
   print pipeline at its real size. This file used to lay the same label out
   in pixels inside a box with no size of its own, so a 50 x 40 mm sticker
   came out as wide as whatever column it landed in (~135mm in a max-w-5xl
   page) and no band had a fixed height: the description pushed the rate down,
   the disclaimer fell off the bottom, and the preview and the paper agreed
   with each other only by accident.

   DATA CONTRACT — every label value comes from toLabelData() (whitelist) +
   the row's own qty text. Nothing outside that contract can reach the paper.
   ========================================================================== */

/* -----------------------------------------------------------------------
   LABEL FIELD MAP
   Controls which label key fills LEFT | CENTRE | RIGHT on each row. P-M-F
   and the WSP price are no longer printed - both stay on the record, only
   the sticker leaves them off.

     detail row 1   hsn | itemCode | qtyWithUnit (qty + unit together)
     detail row 2   encodedCostPrice | (blank) | offer (worked out in Label:
                    only when there is an offer that differs from the rate)
     RATE line      retailPrice, centred
----------------------------------------------------------------------- */
export const LABEL_FIELDS = {
  detailRow1: ['hsn', 'itemCode', 'qtyWithUnit'],
  detailRow2: ['encodedCostPrice', '', ''],
};

/* -----------------------------------------------------------------------
   labelFor(row) — augments the toLabelData whitelist with qtyWithUnit.
   qty is stored as the operator typed it ("16", "2.50"); the numeric
   quantity from toLabelData is the fallback when that text is blank.

   ONE ROW IN, ONE LABEL OUT. Every value on a sticker — the number, the
   composed barcode value, the description, the HSN, the price — is read off
   the SAME barcode record here, so no two fields on a label can ever come
   from two different barcodes. Nothing downstream pairs values by position.
----------------------------------------------------------------------- */
export function labelFor(row) {
  const label = toLabelData(row);
  const qtyText =
    String(row?.qty ?? '').trim() ||
    (label.quantity ? String(label.quantity) : '');
  return { ...label, qtyText, qtyWithUnit: [qtyText, label.unit].filter(Boolean).join(' ') };
}

/* The bars are drawn by the shared components/BarcodeSvg.jsx — the one
   CODE128 implementation in the application, so a label printed from this
   screen scans the same as the same label printed from any other. It carries
   data-barcode, which is what the print readiness check in
   GCRBarcodeGeneration.jsx counts before it opens the print dialog. */
export { BarcodeSvg };

/* Text that must not be re-cased or wrapped: a barcode value is
   case-sensitive (globals.css uppercases body text) and must stay on its own
   single line, cut with an ellipsis rather than pushed onto a second one. */
const ONE_LINE = { overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' };
/* A field that must print IN FULL or not at all. Its type size is worked out
   from the width it has (fitType), so there is nothing left to cut - and the
   ellipsis is dropped, because on these fields an ellipsis is a defect: a
   barcode number reading "9A10..." cannot be keyed in, and a rate reading
   "RATE : ₹28..." is not a price. nowrap keeps it on its one line; the
   hidden overflow stays only as the last resort behind the fitting. */
const ONE_LINE_FULL = { overflow: 'hidden', whiteSpace: 'nowrap' };
/* the gutter between the two halves of a footer / identifier row */
const ROW_GAP_MM = 1;
/* The space between the columns of the two product rows. The columns
   themselves are only as wide as their values (see productColumns in Label),
   so the block takes the width it needs instead of being spread across the
   whole sticker - a smaller gap alone could not do that, because fixed
   percentage columns keep each value pinned to the left edge, the middle
   and the right edge whatever the gap is. */
const PRODUCT_GAP_MM = 3;
/* ...the LEAST space between them: the centred block spreads its columns
   apart until it is this share of the sticker's usable width wide, so every
   label's block has the same outer edges whatever its values are */
const PRODUCT_BLOCK_SHARE = 0.85;
/* barcode number -> composed value: a fixed ~1cm, not pushed to the edges */
const ID_GAP_MM = 10;
/* The fixed wording printed on every sticker. Named rather than written into
   the markup so the footer's type size can be worked out from the very
   strings that are about to be drawn - the fit and the text cannot drift
   apart. Business wording, unchanged. */
const TAX_NOTE = '(Inclusive all taxes)';
const WASH_NOTE = 'DRY WASH ONLY';
const DISCLAIMER = 'No exchange, no guarantee, No Return';

/* -----------------------------------------------------------------------
   Label — one complete printable sticker.

              [ machine-readable barcode ]
     barcodeNo  <-10mm->  barcodeGenerated
     description (up to 3 lines)
     HSN   item code   qty + unit      (compact: each column as wide as
     encoded PR        ₹offer/-         its values, 3mm apart)
                   RATE : ₹.../-
     (Inclusive all taxes)       DRY WASH ONLY
         No exchange, no guarantee, No Return

   The eight bands are the eight LABEL_SECTIONS, in SECTION_ORDER, each a
   fixed millimetre track of the sticker's own height. A band cannot grow:
   a missing field leaves its place blank, a long value is cut with an
   ellipsis and a long description wraps inside its two-line box. That is
   what keeps the barcode at the top where a scanner expects it, and the
   disclaimer on the label, whatever the data does.

   Accepts the label data object (from labelFor / toLabelData), never the raw
   barcode row, so the whitelist is the only gate to paper.
----------------------------------------------------------------------- */
export function Label({ label, geometry }) {
  const g = geometry;
  const band = (key) => mm(g.band(key));
  const type = (key) => mm(g.type(key));
  /* how big THIS value's bars are drawn inside the barcode band */
  const bars = barsBox(g, label.barcode);
  /* built once, so the size it is set at is measured from the very strings
     that are drawn. RATE is the retail price (the offer only when a row has
     no retail price at all); the offer is printed (third column, row 5)
     only for a real offer - a row with none carries '' or, from an Excel
     import, its own retail price. */
  const ratePrice = formatLabelPrice(label.retailPrice || label.sellingPrice);
  const offerPrice = formatLabelPrice(label.offerPrice);
  const hasOffer = offerPrice !== '' && Number(offerPrice) > 0
    && ratePrice !== '' && Number(offerPrice) !== Number(ratePrice);
  const rateText = 'RATE : ₹' + ratePrice + '/-';
  const offerText = hasOffer ? offerPrice : '';

  const detailRow1 = LABEL_FIELDS.detailRow1.map((k) => label[k] ?? '');
  const detailRow2 = LABEL_FIELDS.detailRow2.map((k) => label[k] ?? '');
  // Place offer price in the third column of row 2 if it exists
  if (offerText) {
    detailRow2[2] = offerText;
  }

  /* THE BARCODE IDENTIFIER ROW — both values off the SAME record.

     LEFT   barcodeNo   the unit's own number, "9A1135"
     RIGHT  the composed value - supplier code, GRC number, Bill Sl No. and
            Serial No., "G512*05173*5*1" - and it is label.barcode itself,
            the very string the bars above were drawn from, so the text and
            the bars cannot say two different things.

     A record made before composed values existed has none: its bars encode
     its own number, which is what the left-hand side already prints, and the
     right-hand side stays empty rather than showing something invented. */
  const barcodeNo = label.barcodeNo;
  const secondary = label.barcodeGenerated ? label.barcode : '';

  /* THE PRODUCT BLOCK takes only the width its values need. Each of its
     three columns is as wide as the longer of its two values, and BOTH rows
     use those same widths, so the columns stay lined up under each other;
     PRODUCT_GAP_MM sits between them and the block is centred on the
     sticker. Widths come from the same character estimate
     fitType sizes type with, and when the values are too long for the
     sticker the whole block is set smaller together rather than cut. */
  const allChars = [0, 1, 2].map((i) => Math.max(String(detailRow1[i] ?? '').length, String(detailRow2[i] ?? '').length));
  /* a column empty on both rows takes no place (and no gap) at all */
  const productCols = [0, 1, 2].filter((i) => allChars[i] > 0);
  const productChars = productCols.map((i) => allChars[i]);
  const gapCount = Math.max(0, productCols.length - 1);
  const productFont = fitType('M'.repeat(productChars.reduce((sum, n) => sum + n, 0)), g.usableW - PRODUCT_GAP_MM * gapCount,
    Math.min(g.type('detailRow1'), g.type('detailRow2')));
  const productWidths = productChars.map((n) => n * productFont * TEXT_CHAR_W);
  const productGap = gapCount
    ? Math.max(PRODUCT_GAP_MM, (g.usableW * PRODUCT_BLOCK_SHARE - productWidths.reduce((sum, w) => sum + w, 0)) / gapCount)
    : 0;
  const productColumns = productWidths.map((w) => mm(w)).join(' ');
  const threeUp = (key, cells, style = {}) => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: productColumns,
        /* the block is centred on the sticker, like the number row above -
           both rows share productColumns and productGap, so they line up */
        justifyContent: 'center',
        alignItems: 'center',
        columnGap: mm(productGap),
        height: band(key),
        fontSize: mm(productFont),
        lineHeight: band(key),
        ...style,
      }}
    >
      {productCols.map((i) => (
        <span key={i} style={{ ...ONE_LINE, textAlign: 'left' }}>
          {cells[i]}
        </span>
      ))}
    </div>
  );

  return (
    <div
      data-label=""
      className="barcode-label"
      style={{
        boxSizing: 'border-box',
        width: mm(g.w),
        height: mm(g.h),
        padding: mm(PAD_Y_MM) + ' ' + mm(PAD_X_MM),
        border: mm(BORDER_MM) + ' dashed #94a3b8',
        overflow: 'hidden',
        display: 'grid',
        /* One track per section, in the one order they are rendered in, so a
           section can neither be given a track it is not rendered into nor
           rendered into a track it was not given. */
        gridTemplateRows: SECTION_ORDER.map((key) => band(key)).join(' '),
        color: '#000',
        background: '#fff',
      }}
    >
      {/* 1 — MACHINE-READABLE BARCODE, at the top of every label.

          SIZED FROM THE VALUE, NOT FROM THE BAND. readableBarsBox works out
          how many modules this symbol needs and the width it can be read at
          (TARGET_X_MM per module, capped at BAR_MAX_WIDTH_SHARE of the label,
          not below the ISO / MIN_X_MM floor); barsBox then draws it at
          BAR_DRAW_SCALE (0.5) of that width, centred, bottom-anchored
          (lib/barcodeLabelGeometry.js). On 50 x 40 a composed value comes
          out about 21 x 8.2mm at ~0.095mm/module - BELOW the readable floor,
          see BAR_DRAW_SCALE before printing.

          Nothing is cropped or squeezed to achieve that: the box is modules x
          module-width, so every bar keeps its proportion to every other bar.
          preserveAspectRatio="none" then lets the symbol fill that box on both
          axes — under the default, a symbol wider than its box is scaled down
          on BOTH axes and the lost height is what makes a label need a second
          pass under the scanner. quietZone is the blank run either side that
          tells a scanner where the symbol starts and ends — inside the SVG's
          own viewBox, so it survives however narrow the label is. */}
      {/* The bars sit at the FOOT of the band, BAR_TEXT_GAP_MM above the
          barcode number, rather than centred with ~2.4mm of white below. */}
      <div
        style={{
          boxSizing: 'border-box',
          height: band('barcode'),
          paddingBottom: mm(BAR_TEXT_GAP_MM),
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <div style={{ width: mm(bars.w), height: mm(bars.h) }}>
          <BarcodeSvg
            value={label.barcode}
            height={60}
            quietZone={QUIET_ZONE_MODULES}
            preserveAspectRatio="none"
            className="block h-full w-full"
          />
        </div>
      </div>

      {/* 2 — barcodeNo then barcodeGenerated, ID_GAP_MM (~1cm) apart, the
          pair CENTRED under the bars. textTransform none: globals.css
          uppercases body text and a barcode value is case-sensitive. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: mm(secondary ? ID_GAP_MM : 0),
          height: band('identifier'),
          /* THE BARCODE NUMBER IS NEVER CUT. Both values are measured against
             the width they have to share (the gap taken out first) and the
             row is set at the largest size where BOTH fit whole - so a long
             composed value shrinks the pair rather than eating into the
             number beside it. Monospace, so the estimate is exact. */
          fontSize: mm(fitType(
            [barcodeNo, secondary],
            g.usableW - (secondary ? ID_GAP_MM : 0),
            g.type('identifier'),
            MONO_CHAR_W,
          )),
          lineHeight: band('identifier'),
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          /* regular here, bold on the number: Consolas (what this stack
             resolves to on Windows) has only 400 and 700, so the 600 this
             row used to carry already rendered bold and a bolder number
             could not stand out from it */
          fontWeight: 400,
          letterSpacing: '0.01em',
          textTransform: 'none',
        }}
      >
        {/* the unit's own number in bold; the composed value also bold to match */}
        {/* heavier than bold: Consolas stops at 700, so a thin outline in
            the text colour thickens every stroke without widening the
            characters (the row's fit and the 10mm gap are unchanged) */}
        <span style={{ ...ONE_LINE_FULL, fontWeight: 700, WebkitTextStroke: '0.06em currentColor' }}>{barcodeNo}</span>
        {secondary && <span style={{ ...ONE_LINE_FULL, fontWeight: 700, WebkitTextStroke: '0.06em currentColor' }}>{secondary}</span>}
      </div>

      {/* 3 — the print description, up to DESCRIPTION_LINES (3) lines,
          centred; its band is three lines tall, so a longer
          description wraps in its own space instead of reaching the rows
          below */}
      <div
        style={{
          height: band('description'),
          fontSize: type('description'),
          lineHeight: mm(g.band('description') / DESCRIPTION_LINES),
          /* centred, like the number row above and the product block below */
          textAlign: 'center',
          color: '#334155',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: DESCRIPTION_LINES,
          /* a long unbroken run - a description with no spaces, a stitched
             style code - breaks inside the label instead of running past its
             right edge */
          wordBreak: 'break-word',
          overflowWrap: 'anywhere',
        }}
      >
        {label.description}
      </div>

      {/* 4 — HSN | item code | qty + unit (normal weight: information, not price) */}
      {threeUp('detailRow1', detailRow1, { fontWeight: 400 })}

      {/* 5 — encoded cost price | (blank) | offer price */}
      {threeUp('detailRow2', detailRow2, { fontWeight: 400 })}

      {/* 6 — RATE, centred */}
      <div
        style={{
          height: band('rate'),
          /* a price is never abbreviated: a five-figure amount sets the whole
             line a shade smaller rather than losing its last digits */
          fontSize: mm(fitType(rateText, g.usableW, g.type('rate'))),
          lineHeight: band('rate'),
          textAlign: 'center',
          fontWeight: 800,
          ...ONE_LINE_FULL,
        }}
      >
        {rateText}
      </div>

      {/* 7 — FOOTER: tax note (left) | washing instruction (right).

          Two boxes on one flex row, each as wide as its own words, with the
          space between them. It used to borrow the three-column grid above,
          whose outer tracks are 1fr of a 1.5fr centre - 13.0mm on a 50mm
          sticker. "(Inclusive all taxes)" needs 19.9mm, so it was cut to
          "(Inclusive all ta…" on every label ever printed, while the unused
          centre track sat empty between the two. Laid out this way the pair
          needs 32.1mm of the 45mm available and both print whole. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: mm(ROW_GAP_MM),
          height: band('taxWash'),
          fontSize: mm(fitType(
            [TAX_NOTE, WASH_NOTE],
            g.usableW - ROW_GAP_MM,
            g.type('taxWash'),
          )),
          lineHeight: band('taxWash'),
          color: '#475569',
        }}
      >
        <span style={{ ...ONE_LINE_FULL, textAlign: 'left' }}>{TAX_NOTE}</span>
        <span style={{ ...ONE_LINE_FULL, textAlign: 'right' }}>{WASH_NOTE}</span>
      </div>

      {/* 8 — disclaimer */}
      <div
        style={{
          height: band('disclaimer'),
          fontSize: mm(fitType(DISCLAIMER, g.usableW, g.type('disclaimer'))),
          lineHeight: band('disclaimer'),
          textAlign: 'center',
          color: '#475569',
          ...ONE_LINE_FULL,
        }}
      >
        {DISCLAIMER}
      </div>
    </div>
  );
}

/* -----------------------------------------------------------------------
   GrcBarcodeLabelSheet — the labels of a GRC, laid out on the sticker stock
   they are printed on.

   rows    — barcode rows, each carrying `copies` (from withLabelCounts)
   format  — the chosen barcode label catalog row (labelSize "50 x 40 mm",
             stickerInRow 2). null until the catalog answers, which falls back
             to that same 50 x 40 mm 2-up default rather than rendering a
             label with no size.
   gap     — the gutter between stickers: a cut line's worth on a sheet of A4
             that somebody has to guillotine, zero on die-cut stock where the
             sheet IS the page.

   Each row is expanded into `copies` identical stickers — the same barcode
   number on every copy. Nothing here reserves, generates or saves anything,
   so printing a second metre sticker or a twenty-fifth batch sticker cannot
   move the barcode sequence.

   print-doc + alignContent:start stay on the wrapper so the sheet still
   survives the generic @media print rules in globals.css for a Ctrl+P on the
   print page; a label RUN takes the #barcode-print-root path instead, where
   globals.css overrides .print-doc back into normal flow so the sheet can
   fragment across as many pages as it needs.
----------------------------------------------------------------------- */
export default function GrcBarcodeLabelSheet({ rows, format = null, gap = '1mm', page = null }) {
  /* `page` says which paper this run is going on, so the labels can be fitted
     inside its printable width (lib/barcodeLabelGeometry.js fittedLabelSize).
     Defaulted to the A4 run - where a 50mm sticker has 99mm of slack and is
     not reduced at all - so a caller that does not pass it is unaffected.
     ONE geometry for the whole sheet, so no label can come out a different
     size from its neighbour, and the same one on screen as on paper. */
  const geometry = labelGeometry(format, page || { onStock: false, gapMm: 1 });
  const perRow = labelsPerRow(format);

  const labels = (rows || []).flatMap((row, ri) => {
    const n = Math.max(0, Math.floor(Number(row.copies) || 0));
    return Array.from({ length: n }, (_, copy) => ({
      key: `${row._id || row.id || ri}-${copy}`,
      label: labelFor(row),
    }));
  });

  if (!labels.length) {
    return (
      <div className="py-6 text-center text-[13px] text-slate-400">
        No labels to display.
      </div>
    );
  }

  return (
    <div
      className="print-doc"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(' + perRow + ', ' + mm(geometry.w) + ')',
        gridAutoRows: mm(geometry.h),
        gap,
        justifyContent: 'center',
        /* Without this the implicit rows stretch to fill whatever height the
           sheet is given, and a single row of labels comes out a full page
           tall with the cut line running the length of the paper. */
        alignContent: 'start',
      }}
    >
      {labels.map(({ key, label }) => (
        <Label key={key} label={label} geometry={geometry} />
      ))}
    </div>
  );
}
