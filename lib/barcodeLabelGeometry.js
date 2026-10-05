// /* The CODE128 encoder JsBarcode itself draws with. Imported rather than
//    re-implemented so barsBox() below counts the modules that will actually be
//    printed - see barcodeModules(). It is the same module components/
//    BarcodeSvg.jsx pulls in, so it costs the client bundle nothing new.

//    A NAMESPACE import, and the class is picked out lazily inside a function.
//    The package ships CommonJS: under Node `import pkg from` hands back the
//    module.exports object, but under webpack it handed back undefined, and
//    reading `.default` off it at module scope threw - at IMPORT time, which
//    took down every page that renders a label rather than just the sizing.
//    A namespace object always exists, and resolving inside the call means the
//    worst case is a barcode drawn at its old full-band size. */
// import * as CODE128_MODULE from 'jsbarcode/bin/barcodes/CODE128/index.js';

// function code128Class() {
//   const mod = CODE128_MODULE || {};
//   return mod.CODE128
//     || mod.default?.CODE128
//     || mod.default?.default?.CODE128
//     || null;
// }

// /* ==========================================================================
//    THE PHYSICAL GEOMETRY OF A BARCODE LABEL.

//    A barcode label is a printed object, not a card on a web page. Its width
//    and height come from the barcode label catalog (labelSize "50 x 40 mm",
//    stickerInRow 2) and everything on it is laid out in MILLIMETRES - the one
//    CSS unit that survives the browser's print pipeline at its real size.

//    Pure and client-safe, and deliberately not in a .jsx file: the numbers
//    below decide whether a sticker can be scanned, so they are testable on
//    their own (scripts/testGrcBarcodeLabel.mjs) rather than only observable
//    by printing one.

//    ---------------------------------------------------------------- why ----
//    The GRC label used to be laid out in px inside a box with no size of its
//    own, so a label was as wide as whatever container it landed in - about
//    100mm on A4 for a 50mm sticker - and the bars were squeezed into a fixed
//    190px box under the DEFAULT preserveAspectRatio, which scales BOTH axes:
//    a 22-character CODE128 value is 277 modules and 360px wide at the encoder
//    settings used, so it came back at 53% and the 42px bar height collapsed to
//    22px. Short bars at a sub-dot module width is what "the barcode is
//    missing / half printed / will not scan" looks like coming off a printer.
//    ========================================================================== */

// /* "50 x 40 mm" -> { w: 50, h: 40 }. Falls back to a sane default rather than
//    rendering a zero-sized label when a catalog row is missing its sizes - the
//    seeded catalog is not self-consistent ('RT 72 x 116 mm' declares a label
//    size of "0 x 0 mm"). */
// export function parseSize(text, fallback = { w: 50, h: 40 }) {
//   const m = String(text || '').match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
//   if (!m) return fallback;
//   const w = Number(m[1]);
//   const h = Number(m[2]);
//   if (!w || !h) return fallback;
//   return { w, h };
// }

// /* THE EIGHT SECTIONS of the GRC label, as fractions of its usable height:

//      1 barcode graphic
//      2 barcode identifier        number | secondary reference
//      3 product description       three lines (DESCRIPTION_LINES)
//      4 product information       HSN | qty + unit | qty
//      5 rate code / item / offer  encoded PR | item code | offer price
//      6 rate
//      7 tax / washing             (Inclusive all taxes) | DRY WASH ONLY
//      8 disclaimer

//    They sum to exactly 1, so the sections always fill the sticker and can
//    never overflow it, at ANY configured label height - 50x40, 50x25, 38x25.
//    A section cannot grow: its track is a fixed millimetre height and its
//    content is clipped to it. That is what keeps the barcode where it is when
//    a description runs long, and keeps the disclaimer on the label when a
//    price runs wide.

//    `font` is the type size as a fraction of the section's OWN height, so text
//    can never be taller than the band it sits in. */
// /* The barcode band holds bars that are narrow (BAR_DRAW_SCALE) but tall,
//    and the description has THREE lines. Every font ratio is set so its type
//    is the size it has always been, whatever its band became (share x ratio
//    = the original 0.075x0.66, 0.135x0.39, 0.085x0.66, 0.125x0.66,
//    0.0825x0.58), so rows gained or lost only the space between them. */
// export const LABEL_SECTIONS = {
//   barcode:     { share: 0.2700 },
//   identifier:  { share: 0.0700, font: 0.7071 },
//   description: { share: 0.2000, font: 0.2633 },  /* three lines */
//   detailRow1:  { share: 0.0850, font: 0.66 },
//   detailRow2:  { share: 0.0850, font: 0.66 },
//   rate:        { share: 0.1200, font: 0.6875 },
//   taxWash:     { share: 0.0850, font: 0.5629 },
//   disclaimer:  { share: 0.0850, font: 0.5629 },
// };
// /* how many lines the description band is divided into */
// export const DESCRIPTION_LINES = 3;

// /* The order they are stacked in, top to bottom. One list, used to build the
//    grid tracks AND to render, so a section cannot be given a track it is not
//    rendered into or rendered into a track it was not given. */
// export const SECTION_ORDER = [
//   'barcode', 'identifier', 'description',
//   'detailRow1', 'detailRow2', 'rate', 'taxWash', 'disclaimer',
// ];

// /* Sticker margins. Small - the label is only 50mm across and every
//    millimetre spent here is a millimetre of barcode lost - but never zero:
//    ink that runs to the die cut is ink the printer clips. */
// export const PAD_X_MM = 1.2;
// export const PAD_Y_MM = 0.8;

// /* The cut line round a label, in millimetres rather than pixels - and
//    subtracted from the usable height below, because it is part of the
//    sticker's box. A 1px border is 0.265mm, which is exactly what the
//    disclaimer at the foot of the label was being clipped by: the section
//    tracks were budgeted against the padding alone, so the stack came out
//    2px taller than the content box it had to fit in. Everything on a label
//    is measured in the label's own units, this included. */
// export const BORDER_MM = 0.2;
// /* ---- THE UNPRINTABLE EDGE ----------------------------------------------
//    Every printer grips the sheet, and the strip under the rollers takes no
//    ink: a desktop laser reserves 4-5mm, a thermal label printer 1-2mm. CSS
//    cannot measure it and the browser's own preview knows nothing about it, so
//    a row of labels laid flush against the page edge loses whatever falls
//    inside that strip - silently, and only on paper.
//    That is what cut the barcode NUMBER off the first sticker. The seeded
//    'TF 50 x 40' stock declares a 100mm sheet carrying two 50mm labels, so on
//    stock the row was exactly as wide as its page and labelPageRule sets
//    `margin: 0`. barcodeNo is printed at the LEFT edge of the leading label,
//    1.4mm in; a 4mm gripper strip therefore swallowed 2.6mm of it, which at
//    the identifier's type size is the first two and a bit characters -
//    "9A1022" came off the printer as "1022".
//    So a row is fitted INSIDE the page rather than flush against it: the
//    labels give up whatever width it takes to keep this margin at both ends.
//    Two millimetres clears a thermal printer outright and leaves a desktop
//    printer far less of the label to eat; the remainder is covered by the
//    sticker's own PAD_X_MM and by every field now being sized to fit
//    (fitType below) rather than cut with an ellipsis. */
// export const SAFE_MARGIN_MM = 2;
// /* The fallback page, and the margin labelPageRule asks for on it. A4 is what
//    a desktop printer and "Microsoft Print to PDF" are loaded with. */
// export const A4_W_MM = 210;
// export const A4_H_MM = 297;
// export const A4_MARGIN_MM = 5;

// /* The blank run either side of the bars, in modules. CODE128 asks for ten;
//    a scanner uses it to find where the symbol starts and ends. It is inside
//    the barcode's own viewBox, so it survives however narrow the label is -
//    unlike padding, which the bars would simply be scaled into. */
// export const QUIET_ZONE_MODULES = 10;

// /* A number as a CSS millimetre length. */
// export const mm = (n) => Number(n).toFixed(3) + 'mm';

// /* The mm geometry of one label, derived ONCE per sheet and handed to every
//    label on it - so no label can compute a different size from its neighbour.

//      w, h    the sticker, exactly as configured
//      band(k) the height of section k, in mm
//      type(k) the type size for section k, in mm */
// export function labelGeometry(format, page = null) {
//   const { w, h } = page ? fittedLabelSize(format, page) : parseSize(format?.labelSize);
//   /* box-sizing is border-box, so w and h include BOTH the padding and the
//      cut line. What the sections have to fit inside is what is left. */
//   const usableH = Math.max(0, h - (PAD_Y_MM + BORDER_MM) * 2);
//   const usableW = Math.max(0, w - (PAD_X_MM + BORDER_MM) * 2);
//   const band = (key) => usableH * LABEL_SECTIONS[key].share;
//   const type = (key) => band(key) * (LABEL_SECTIONS[key].font || 0);
//   return { w, h, usableH, usableW, band, type };
// }

// /* How many labels sit across the sheet. Two is the seeded default and what
//    the GRC sheet has always shown. */
// export function labelsPerRow(format) {
//   return Math.max(1, Number(format?.stickerInRow) || 2);
// }
// /* "100 x 40 mm" -> { w: 100, h: 40 }, or null when the catalog row has no
//    usable sheet size. Shared by printableBox and stockPageCss so the sheet is
//    read the same way in both. */
// export function parsePageSize(format) {
//   const m = String(format?.pageSize || '').match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
//   if (!m) return null;
//   const w = Number(m[1]);
//   const h = Number(m[2]);
//   return w && h ? { w, h } : null;
// }
// /* The box a row of labels may actually occupy: the page, less the margin the
//    @page rule asks for, less the unprintable edge at BOTH ends.
//    On stock the page is the sheet itself with no CSS margin, so the whole
//    allowance comes out of SAFE_MARGIN_MM. On A4 the 5mm @page margin is
//    already there and the safety is taken on top of it. */
// export function printableBox(format, { onStock = false } = {}) {
//   const sheet = onStock ? parsePageSize(format) : null;
//   const w = sheet ? sheet.w : A4_W_MM - A4_MARGIN_MM * 2;
//   const h = sheet ? sheet.h : A4_H_MM - A4_MARGIN_MM * 2;
//   return {
//     w: Math.max(0, w - SAFE_MARGIN_MM * 2),
//     h: Math.max(0, h - SAFE_MARGIN_MM * 2),
//   };
// }
// /* The size a label is DRAWN at: its catalog size, reduced only as far as it
//    must be for a whole row of them to sit inside the printable box.
//        left margin + label x perRow + gaps + right margin <= page width
//    Never enlarged - a 50mm sticker on A4 has 99mm of slack and stays 50mm, so
//    this changes nothing for the paper that already fits. On the 100mm 'TF 50
//    x 40' stock it takes each 50mm label down to 48mm, which is what buys the
//    2mm at each end that the printer was helping itself to. */
// export function fittedLabelSize(format, { onStock = false, gapMm = 1 } = {}) {
//   const { w, h } = parseSize(format?.labelSize);
//   const perRow = labelsPerRow(format);
//   const box = printableBox(format, { onStock });
//   const maxW = (box.w - gapMm * (perRow - 1)) / perRow;
//   return {
//     w: maxW > 0 ? Math.min(w, maxW) : w,
//     h: box.h > 0 ? Math.min(h, box.h) : h,
//   };
// }
// /* EVERYTHING A SCREEN NEEDS TO LAY OUT A RUN, from one call - so the GRC
//    Barcode Print page and the Barcode Generation picker cannot arrive at two
//    different sheets from the same format. Both used to repeat these five
//    lines, and both computed the @page rule from the UNFITTED label size. */
// export function labelRun(format, paper = 'a4') {
//   const onStock = paper === 'stock';
//   /* a cut line's worth of gutter on A4 that somebody has to guillotine; none
//      on die-cut stock, where the sheet IS the page */
//   const gapMm = onStock ? 0 : 1;
//   const page = { onStock, gapMm };
//   const size = fittedLabelSize(format, page);
//   const perRow = labelsPerRow(format);
//   return {
//     onStock,
//     gapMm,
//     perRow,
//     size,
//     page,
//     gap: gapMm + 'mm',
//     pageRule: labelPageRule(format, { onStock, gapMm }),
//     stockSize: stockPageCss(format, size.w, size.h, perRow, gapMm),
//   };
// }
// /* ---- TYPE THAT FITS ----------------------------------------------------
//    A sticker is too small to leave to chance: one character more than the
//    designer imagined and a field either runs off the label or is cut with an
//    ellipsis - and a cut barcode number is a number nobody can key in.
//    So every single-line field is given the largest type size at which it
//    actually fits the width it has.
//    Width is ESTIMATED from the character count rather than measured: a
//    measurement means a DOM round trip per field per label and a sheet can
//    carry hundreds. The two ratios are a character's advance width as a
//    fraction of the font size - exact for a monospace face, and a deliberately
//    generous average for the proportional one, so the estimate errs towards
//    type that is a shade too small rather than a field that is a shade too
//    wide. */
// export const MONO_CHAR_W = 0.62;
// /* 0.65, not the 0.52 an average lower-case sans would suggest, because a
//    LABEL IS PRINTED IN CAPITALS: globals.css sets `body { text-transform:
//    uppercase }` and the sheet is portaled to <body>, so every field here but
//    the identifier (which sets textTransform none, a barcode value being
//    case-sensitive) renders as capitals. Measured against Helvetica/Arial
//    advances, capitals run 6-24% wider than that average - "DRY WASH ONLY" is
//    0.645em per character, the disclaimer 0.623 - so an estimate built for
//    mixed case under-measured every one of them and the field overflowed the
//    size it had just been "fitted" to. This is above the widest of them. */
// export const TEXT_CHAR_W = 0.65;
// /* Type is fitted to a shade LESS than the width available. The character
//    count is an estimate, not a measurement, and solving for the size at which
//    the estimate exactly equals the width leaves nothing for it to be wrong
//    by - which is how a fitted field still came out clipped. */
// const FILL = 0.96;
// /* The largest type size, in mm, at which every one of `texts` fits on a
//    single line inside `widthMm` laid side by side. Capped at maxFontMm -
//    nothing is ever enlarged past the size its band was designed for. */
// export function fitType(texts, widthMm, maxFontMm, charW = TEXT_CHAR_W) {
//   const chars = (Array.isArray(texts) ? texts : [texts])
//     .reduce((n, t) => n + String(t ?? '').length, 0);
//   if (!chars || !(widthMm > 0)) return maxFontMm;
//   return Math.min(maxFontMm, (widthMm * FILL) / (chars * charW));
// }

// /* ==========================================================================
//    THE PAGE a sheet of these labels is printed on.

//    Written out inside the Barcode Generation print picker and nowhere else,
//    so the GRC Barcode Print page - which prints the very same sheet - had no
//    @page rule at all and came out at whatever the browser's default page and
//    margins happened to be. Both read it from here now.
//    ========================================================================== */

// /* One physical sheet of the configured sticker stock as a CSS page size,
//    widened if the labels on it do not actually fit.

//    The seeded catalog is not self-consistent - 'RT 72 x 116 mm' declares a
//    72mm sheet, a label size of "0 x 0 mm" and 2 labels per row. parseSize
//    rejects the zero and substitutes 50x40, so two 50mm labels would be laid
//    across a 72mm page and the second one would fall off the edge of the
//    paper. Taking the wider of the two keeps every label on the sheet; a
//    little extra margin is recoverable, a clipped barcode is not.

//    Returns null when there is no usable sheet size at all, so the caller can
//    fall back to A4 rather than emit a zero-sized page that prints nothing. */
// export function stockPageCss(format, labelW, labelH, perRow, gapMm) {
//   const sheet = parsePageSize(format);
//   if (!sheet) return null;

//   /* The sizes handed in here are the FITTED ones, so the row already sits
//      inside the sheet with SAFE_MARGIN_MM to spare at each end and these
//      maxima normally hand the sheet back unchanged. They stay as the last
//      guard against a catalog row whose declared sheet is narrower than the
//      labels it claims to carry. */
//   const needW = labelW * perRow + gapMm * (perRow - 1);
//   return Math.max(sheet.w, needW) + 'mm ' + Math.max(sheet.h, labelH) + 'mm';
// }

// /* The @page rule for a label run.

//    On sticker stock the sheet IS the page, so the page is one sheet with no
//    margin. Otherwise A4 with a 5mm margin - what a desktop printer and
//    "Microsoft Print to PDF" are loaded with - and the labels are guillotined
//    along their cut lines. */
// export function labelPageRule(format, { onStock = false, gapMm = 1 } = {}) {
//   /* THE FITTED SIZE, the same one the labels are drawn at. Reading the raw
//      catalog size here meant the page announced to the browser was derived
//      from one width while the labels had been fitted against another: on the
//      malformed 'RT 72 x 116 mm' row (labelSize "0 x 0 mm", so parseSize falls
//      back to 50x40, 2-up) the labels were fitted into the 72mm sheet's 68mm
//      printable box while the @page still said 100mm - the row was then
//      centred in a page 28mm wider than the paper. One size per run. */
//   const { w, h } = fittedLabelSize(format, { onStock, gapMm });
//   const stock = onStock ? stockPageCss(format, w, h, labelsPerRow(format), gapMm) : null;
//   return stock
//     ? '@page { size: ' + stock + '; margin: 0; }'
//     : '@page { size: A4; margin: 5mm; }';
// }

// /* ==========================================================================
//    HOW BIG THE BARS ARE DRAWN INSIDE THEIR BAND.

//    The band is the space the barcode may occupy. It is not the size of the
//    symbol: a barcode drawn to the last millimetre of its band is a black slab
//    that crowds everything under it, and on a 6-character value it is far
//    wider than a scanner needs.

//    The symbol is therefore sized from the VALUE, inside that band:

//      height  a fixed share of the band (BAR_HEIGHT_SHARE), bottom-anchored
//      width   readableBarsBox: one module at TARGET_X_MM, capped at
//              BAR_MAX_WIDTH_SHARE of the usable width but not below the
//              readable floor - then barsBox draws BAR_DRAW_SCALE of that

//    Nothing here crops or stretches: the width is the number of modules times
//    a module width, so every bar keeps its proportion to every other bar.
//    ========================================================================== */

// /* The module width the READABLE box uses when the label can afford it (the
//    drawn module is BAR_DRAW_SCALE of whatever the readable box works out).
//    ISO/IEC 15417 asks for 0.250mm and a 203dpi thermal dot is 0.125mm, so
//    0.33mm is two whole dots plus a margin - comfortably readable, and narrow
//    enough that a short value no longer fills the sticker. */
// export const TARGET_X_MM = 0.33;

// /* The share of the barcode band the bars themselves take. The bars sit at the
//    FOOT of the band (components/GrcBarcodeLabel.jsx), BAR_TEXT_GAP_MM above
//    the barcode number, so the rest of the band is white space above them.
//    They used to be 0.62 of the band and centred in it, which left ~2.4mm of
//    white between the bars and the number printed under them. */
// export const BAR_HEIGHT_SHARE = 0.80;   /* of the 0.27 band: 8.2mm on 50x40 */
// export const BAR_TEXT_GAP_MM = 0.5;

// /* THE BARS ARE DRAWN AT HALF WIDTH - by request, so the graphic takes much
//    less of the sticker's width (every bar in proportion, nothing cropped).
//    The height is set separately, by the barcode band and BAR_HEIGHT_SHARE.
//    A taller symbol does NOT make a narrow one readable: a scanner resolves
//    bar WIDTHS, and the height only helps it keep a line across the bars.

//    READ BEFORE PRINTING: halving the width halves the module. A composed
//    value such as "G1319*05197*1*1" is 220 modules; at full size it was drawn
//    at the 0.19mm readable floor, at half size it is 0.095mm - narrower than
//    one dot of a 203dpi thermal printer (0.125mm), and only ~1.1 dots of a
//    300dpi one (0.085mm), so those bars cannot be reproduced faithfully and
//    are not expected to scan. On 'stock' paper the label is fitted to 48mm,
//    a shade narrower still. The short unit number ("9A2313", 110 modules),
//    which the scanner already resolves (lib/inventory.js), is drawn by this
//    rule at 0.165mm - below the floor too; it would reach 0.19mm only if it
//    were ENCODED instead of the composed value and floored at MIN_X_MM, which
//    changes what the bars carry. Set this back to 1 to return to the
//    readable width. */
// export const BAR_DRAW_SCALE = 0.5;

// /* The widest the READABLE box may be: this share of the label's usable
//    width. A narrower symbol means a narrower module, so this cap never takes
//    a value below the width it could otherwise be read at - ISO_X_MM for a
//    value that can reach it, MIN_X_MM (the close-range floor) for the rest -
//    and a value already below that floor at the full width keeps the full
//    width. BAR_DRAW_SCALE is applied after, and is NOT bound by this floor. */
// export const BAR_MAX_WIDTH_SHARE = 0.85;
// export const ISO_X_MM = 0.25;
// export const MIN_X_MM = 0.19;

// /* The modules a CODE128 symbol needs for this value, quiet zones included.
//    Counted with the SAME encoder JsBarcode draws with, not estimated: CODE128
//    packs pairs of digits into one symbol character in C mode, so arithmetic on
//    the character count is wrong for exactly the digit-heavy values this ERP
//    issues. Returns 0 when the value cannot be encoded. */
// export function barcodeModules(value) {
//   const text = String(value ?? '');
//   if (!text) return 0;
//   try {
//     const CODE128 = code128Class();
//     if (!CODE128) return 0;
//     const encoded = new CODE128(text, { width: 1, height: 40, format: 'CODE128' }).encode();
//     return (encoded?.data?.length || 0) + QUIET_ZONE_MODULES * 2;
//   } catch {
//     /* CODE128 encodes anything printable; a control character pasted into a
//        value can still throw. 0 means "no idea how wide" and barsBox then
//        hands the bars the whole band, which is what they had before. */
//     return 0;
//   }
// }

// /* The box the bars are drawn in, in mm, for one label and one value:

//      { w, h, x, modules }   w x h to draw, x the printed module width

//    w is capped at the usable width, so a value too long for the stock still
//    fills it rather than overflowing; x then says what that cost.
//    When the value cannot be encoded the box is the full band, which is what
//    an empty svg occupies anyway. */
// export function barsBox(geometry, value) {
//   const full = readableBarsBox(geometry, value);
//   const w = full.w * BAR_DRAW_SCALE;
//   return { w, h: full.h, x: full.modules ? w / full.modules : 0, modules: full.modules };
// }

// /* The box at FULL scale - the size the value can be read at (see
//    BAR_DRAW_SCALE for why the label draws it smaller). Height is already the
//    drawn height: the band itself was cut to match. */
// export function readableBarsBox(geometry, value) {
//   const usableW = Number(geometry?.usableW) || 0;
//   const band = typeof geometry?.band === 'function' ? geometry.band('barcode') : 0;
//   const h = Math.min(band * BAR_HEIGHT_SHARE, Math.max(0, band - BAR_TEXT_GAP_MM));
//   const modules = barcodeModules(value);
//   if (!modules) return { w: usableW, h, x: 0, modules: 0 };
//   /* the module width filling the label would give, and the narrowest this
//      value may be taken to (see BAR_MAX_WIDTH_SHARE) */
//   const fullX = usableW / modules;
//   const floorX = Math.min(fullX, fullX >= ISO_X_MM ? ISO_X_MM : MIN_X_MM);
//   /* rounded UP to the micron, and a micron more if floating point still
//      leaves the module a hair under the floor (220 x 0.19 is 41.7999...) */
//   let floorW = Math.ceil(modules * floorX * 1000) / 1000;
//   if (floorW / modules < floorX) floorW += 0.001;
//   const w = Math.min(usableW, modules * TARGET_X_MM, Math.max(usableW * BAR_MAX_WIDTH_SHARE, floorW));
//   return { w, h, x: w / modules, modules };
// }




//sagar

/* The CODE128 encoder JsBarcode itself draws with. Imported rather than
   re-implemented so barsBox() below counts the modules that will actually be
   printed - see barcodeModules(). It is the same module components/
   BarcodeSvg.jsx pulls in, so it costs the client bundle nothing new.

   A NAMESPACE import, and the class is picked out lazily inside a function.
   The package ships CommonJS: under Node `import pkg from` hands back the
   module.exports object, but under webpack it handed back undefined, and
   reading `.default` off it at module scope threw - at IMPORT time, which
   took down every page that renders a label rather than just the sizing.
   A namespace object always exists, and resolving inside the call means the
   worst case is a barcode drawn at its old full-band size. */
import * as CODE128_MODULE from 'jsbarcode/bin/barcodes/CODE128/index.js';

function code128Class() {
  const mod = CODE128_MODULE || {};
  return mod.CODE128
    || mod.default?.CODE128
    || mod.default?.default?.CODE128
    || null;
}

/* ==========================================================================
   THE PHYSICAL GEOMETRY OF A BARCODE LABEL.

   A barcode label is a printed object, not a card on a web page. Its width
   and height come from the barcode label catalog (labelSize "50 x 40 mm",
   stickerInRow 2) and everything on it is laid out in MILLIMETRES - the one
   CSS unit that survives the browser's print pipeline at its real size.

   Pure and client-safe, and deliberately not in a .jsx file: the numbers
   below decide whether a sticker can be scanned, so they are testable on
   their own (scripts/testGrcBarcodeLabel.mjs) rather than only observable
   by printing one.

   ---------------------------------------------------------------- why ----
   The GRC label used to be laid out in px inside a box with no size of its
   own, so a label was as wide as whatever container it landed in - about
   100mm on A4 for a 50mm sticker - and the bars were squeezed into a fixed
   190px box under the DEFAULT preserveAspectRatio, which scales BOTH axes:
   a 22-character CODE128 value is 277 modules and 360px wide at the encoder
   settings used, so it came back at 53% and the 42px bar height collapsed to
   22px. Short bars at a sub-dot module width is what "the barcode is
   missing / half printed / will not scan" looks like coming off a printer.
   ========================================================================== */

/* "50 x 40 mm" -> { w: 50, h: 40 }. Falls back to a sane default rather than
   rendering a zero-sized label when a catalog row is missing its sizes - the
   seeded catalog is not self-consistent ('RT 72 x 116 mm' declares a label
   size of "0 x 0 mm"). */
export function parseSize(text, fallback = { w: 50, h: 40 }) {
  const m = String(text || '').match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
  if (!m) return fallback;
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!w || !h) return fallback;
  return { w, h };
}

/* THE EIGHT SECTIONS of the GRC label, as fractions of its usable height:

     1 barcode graphic
     2 barcode identifier        number | secondary reference
     3 product description       three lines (DESCRIPTION_LINES)
     4 product information       HSN | qty + unit | qty
     5 rate code / item / offer  encoded PR | item code | offer price
     6 rate
     7 tax / washing             (Inclusive all taxes) | DRY WASH ONLY
     8 disclaimer

   They sum to exactly 1, so the sections always fill the sticker and can
   never overflow it, at ANY configured label height - 50x40, 50x25, 38x25.
   A section cannot grow: its track is a fixed millimetre height and its
   content is clipped to it. That is what keeps the barcode where it is when
   a description runs long, and keeps the disclaimer on the label when a
   price runs wide.

   `font` is the type size as a fraction of the section's OWN height, so text
   can never be taller than the band it sits in. */
/* The barcode band holds bars that are narrow (BAR_DRAW_SCALE) but tall,
   and the description has THREE lines. Every font ratio is set so its type
   is the size it has always been, whatever its band became (share x ratio
   = the original 0.075x0.66, 0.135x0.39, 0.085x0.66, 0.125x0.66,
   0.0825x0.58), so rows gained or lost only the space between them. */
export const LABEL_SECTIONS = {
  barcode:     { share: 0.2700 },
  identifier:  { share: 0.0700, font: 0.7071 },
  description: { share: 0.2000, font: 0.2633 },  /* three lines */
  detailRow1:  { share: 0.0850, font: 0.66 },
  detailRow2:  { share: 0.0850, font: 0.66 },
  rate:        { share: 0.1200, font: 0.6875 },
  taxWash:     { share: 0.0850, font: 0.5629 },
  disclaimer:  { share: 0.0850, font: 0.5629 },
};
/* how many lines the description band is divided into */
export const DESCRIPTION_LINES = 3;

/* The order they are stacked in, top to bottom. One list, used to build the
   grid tracks AND to render, so a section cannot be given a track it is not
   rendered into or rendered into a track it was not given. */
export const SECTION_ORDER = [
  'barcode', 'identifier', 'description',
  'detailRow1', 'detailRow2', 'rate', 'taxWash', 'disclaimer',
];

/* Sticker margins. Small - the label is only 50mm across and every
   millimetre spent here is a millimetre of barcode lost - but never zero:
   ink that runs to the die cut is ink the printer clips. */
export const PAD_X_MM = 1.2;
export const PAD_Y_MM = 0.8;

/* The cut line round a label, in millimetres rather than pixels - and
   subtracted from the usable height below, because it is part of the
   sticker's box. A 1px border is 0.265mm, which is exactly what the
   disclaimer at the foot of the label was being clipped by: the section
   tracks were budgeted against the padding alone, so the stack came out
   2px taller than the content box it had to fit in. Everything on a label
   is measured in the label's own units, this included. */
export const BORDER_MM = 0.2;
/* ---- THE UNPRINTABLE EDGE ----------------------------------------------
   Every printer grips the sheet, and the strip under the rollers takes no
   ink: a desktop laser reserves 4-5mm, a thermal label printer 1-2mm. CSS
   cannot measure it and the browser's own preview knows nothing about it, so
   a row of labels laid flush against the page edge loses whatever falls
   inside that strip - silently, and only on paper.
   That is what cut the barcode NUMBER off the first sticker. The seeded
   'TF 50 x 40' stock declares a 100mm sheet carrying two 50mm labels, so on
   stock the row was exactly as wide as its page and labelPageRule sets
   `margin: 0`. barcodeNo is printed at the LEFT edge of the leading label,
   1.4mm in; a 4mm gripper strip therefore swallowed 2.6mm of it, which at
   the identifier's type size is the first two and a bit characters -
   "9A1022" came off the printer as "1022".
   So a row is fitted INSIDE the page rather than flush against it: the
   labels give up whatever width it takes to keep this margin at both ends.
   Two millimetres clears a thermal printer outright and leaves a desktop
   printer far less of the label to eat; the remainder is covered by the
   sticker's own PAD_X_MM and by every field now being sized to fit
   (fitType below) rather than cut with an ellipsis. */
export const SAFE_MARGIN_MM = 2;
/* The fallback page, and the margin labelPageRule asks for on it. A4 is what
   a desktop printer and "Microsoft Print to PDF" are loaded with. */
export const A4_W_MM = 210;
export const A4_H_MM = 297;
export const A4_MARGIN_MM = 5;

/* The blank run either side of the bars, in modules. CODE128 asks for ten;
   a scanner uses it to find where the symbol starts and ends. It is inside
   the barcode's own viewBox, so it survives however narrow the label is -
   unlike padding, which the bars would simply be scaled into. */
export const QUIET_ZONE_MODULES = 10;

/* A number as a CSS millimetre length. */
export const mm = (n) => Number(n).toFixed(3) + 'mm';

/* The mm geometry of one label, derived ONCE per sheet and handed to every
   label on it - so no label can compute a different size from its neighbour.

     w, h    the sticker, exactly as configured
     band(k) the height of section k, in mm
     type(k) the type size for section k, in mm */
export function labelGeometry(format, page = null) {
  const { w, h } = page ? fittedLabelSize(format, page) : parseSize(format?.labelSize);
  /* box-sizing is border-box, so w and h include BOTH the padding and the
     cut line. What the sections have to fit inside is what is left. */
  const usableH = Math.max(0, h - (PAD_Y_MM + BORDER_MM) * 2);
  const usableW = Math.max(0, w - (PAD_X_MM + BORDER_MM) * 2);
  const band = (key) => usableH * LABEL_SECTIONS[key].share;
  const type = (key) => band(key) * (LABEL_SECTIONS[key].font || 0);
  return { w, h, usableH, usableW, band, type };
}

/* How many labels sit across the sheet. Two is the seeded default and what
   the GRC sheet has always shown. */
export function labelsPerRow(format) {
  return Math.max(1, Number(format?.stickerInRow) || 2);
}
/* "100 x 40 mm" -> { w: 100, h: 40 }, or null when the catalog row has no
   usable sheet size. Shared by printableBox and stockPageCss so the sheet is
   read the same way in both. */
export function parsePageSize(format) {
  const m = String(format?.pageSize || '').match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  return w && h ? { w, h } : null;
}
/* The box a row of labels may actually occupy: the page, less the margin the
   @page rule asks for, less the unprintable edge at BOTH ends.
   On stock the page is the sheet itself with no CSS margin, so the whole
   allowance comes out of SAFE_MARGIN_MM. On A4 the 5mm @page margin is
   already there and the safety is taken on top of it. */
export function printableBox(format, { onStock = false } = {}) {
  const sheet = onStock ? parsePageSize(format) : null;
  const w = sheet ? sheet.w : A4_W_MM - A4_MARGIN_MM * 2;
  const h = sheet ? sheet.h : A4_H_MM - A4_MARGIN_MM * 2;
  return {
    w: Math.max(0, w - SAFE_MARGIN_MM * 2),
    h: Math.max(0, h - SAFE_MARGIN_MM * 2),
  };
}
/* The size a label is DRAWN at: its catalog size, reduced only as far as it
   must be for a whole row of them to sit inside the printable box.
       left margin + label x perRow + gaps + right margin <= page width
   Never enlarged - a 50mm sticker on A4 has 99mm of slack and stays 50mm, so
   this changes nothing for the paper that already fits. On the 100mm 'TF 50
   x 40' stock it takes each 50mm label down to 48mm, which is what buys the
   2mm at each end that the printer was helping itself to. */
export function fittedLabelSize(format, { onStock = false, gapMm = 1 } = {}) {
  const { w, h } = parseSize(format?.labelSize);
  const perRow = labelsPerRow(format);
  const box = printableBox(format, { onStock });
  const maxW = (box.w - gapMm * (perRow - 1)) / perRow;
  return {
    w: maxW > 0 ? Math.min(w, maxW) : w,
    h: box.h > 0 ? Math.min(h, box.h) : h,
  };
}
/* EVERYTHING A SCREEN NEEDS TO LAY OUT A RUN, from one call - so the GRC
   Barcode Print page and the Barcode Generation picker cannot arrive at two
   different sheets from the same format. Both used to repeat these five
   lines, and both computed the @page rule from the UNFITTED label size. */
export function labelRun(format, paper = 'a4') {
  const onStock = paper === 'stock';
  /* a cut line's worth of gutter on A4 that somebody has to guillotine; none
     on die-cut stock, where the sheet IS the page */
  const gapMm = onStock ? 0 : 1;
  const page = { onStock, gapMm };
  const size = fittedLabelSize(format, page);
  const perRow = labelsPerRow(format);
  return {
    onStock,
    gapMm,
    perRow,
    size,
    page,
    gap: gapMm + 'mm',
    pageRule: labelPageRule(format, { onStock, gapMm }),
    stockSize: stockPageCss(format, size.w, size.h, perRow, gapMm),
  };
}
/* ---- TYPE THAT FITS ----------------------------------------------------
   A sticker is too small to leave to chance: one character more than the
   designer imagined and a field either runs off the label or is cut with an
   ellipsis - and a cut barcode number is a number nobody can key in.
   So every single-line field is given the largest type size at which it
   actually fits the width it has.
   Width is ESTIMATED from the character count rather than measured: a
   measurement means a DOM round trip per field per label and a sheet can
   carry hundreds. The two ratios are a character's advance width as a
   fraction of the font size - exact for a monospace face, and a deliberately
   generous average for the proportional one, so the estimate errs towards
   type that is a shade too small rather than a field that is a shade too
   wide. */
export const MONO_CHAR_W = 0.62;
/* 0.65, not the 0.52 an average lower-case sans would suggest, because a
   LABEL IS PRINTED IN CAPITALS: globals.css sets `body { text-transform:
   uppercase }` and the sheet is portaled to <body>, so every field here but
   the identifier (which sets textTransform none, a barcode value being
   case-sensitive) renders as capitals. Measured against Helvetica/Arial
   advances, capitals run 6-24% wider than that average - "DRY WASH ONLY" is
   0.645em per character, the disclaimer 0.623 - so an estimate built for
   mixed case under-measured every one of them and the field overflowed the
   size it had just been "fitted" to. This is above the widest of them. */
export const TEXT_CHAR_W = 0.65;
/* Type is fitted to a shade LESS than the width available. The character
   count is an estimate, not a measurement, and solving for the size at which
   the estimate exactly equals the width leaves nothing for it to be wrong
   by - which is how a fitted field still came out clipped. */
const FILL = 0.96;
/* The largest type size, in mm, at which every one of `texts` fits on a
   single line inside `widthMm` laid side by side. Capped at maxFontMm -
   nothing is ever enlarged past the size its band was designed for. */
export function fitType(texts, widthMm, maxFontMm, charW = TEXT_CHAR_W) {
  const chars = (Array.isArray(texts) ? texts : [texts])
    .reduce((n, t) => n + String(t ?? '').length, 0);
  if (!chars || !(widthMm > 0)) return maxFontMm;
  return Math.min(maxFontMm, (widthMm * FILL) / (chars * charW));
}

/* ==========================================================================
   THE PAGE a sheet of these labels is printed on.

   Written out inside the Barcode Generation print picker and nowhere else,
   so the GRC Barcode Print page - which prints the very same sheet - had no
   @page rule at all and came out at whatever the browser's default page and
   margins happened to be. Both read it from here now.
   ========================================================================== */

/* One physical sheet of the configured sticker stock as a CSS page size,
   widened if the labels on it do not actually fit.

   The seeded catalog is not self-consistent - 'RT 72 x 116 mm' declares a
   72mm sheet, a label size of "0 x 0 mm" and 2 labels per row. parseSize
   rejects the zero and substitutes 50x40, so two 50mm labels would be laid
   across a 72mm page and the second one would fall off the edge of the
   paper. Taking the wider of the two keeps every label on the sheet; a
   little extra margin is recoverable, a clipped barcode is not.

   Returns null when there is no usable sheet size at all, so the caller can
   fall back to A4 rather than emit a zero-sized page that prints nothing. */
export function stockPageCss(format, labelW, labelH, perRow, gapMm) {
  const sheet = parsePageSize(format);
  if (!sheet) return null;

  /* The sizes handed in here are the FITTED ones, so the row already sits
     inside the sheet with SAFE_MARGIN_MM to spare at each end and these
     maxima normally hand the sheet back unchanged. They stay as the last
     guard against a catalog row whose declared sheet is narrower than the
     labels it claims to carry. */
  const needW = labelW * perRow + gapMm * (perRow - 1);
  return Math.max(sheet.w, needW) + 'mm ' + Math.max(sheet.h, labelH) + 'mm';
}

/* The @page rule for a label run.

   On sticker stock the sheet IS the page, so the page is one sheet with no
   margin. Otherwise A4 with a 5mm margin - what a desktop printer and
   "Microsoft Print to PDF" are loaded with - and the labels are guillotined
   along their cut lines. */
export function labelPageRule(format, { onStock = false, gapMm = 1 } = {}) {
  /* THE FITTED SIZE, the same one the labels are drawn at. Reading the raw
     catalog size here meant the page announced to the browser was derived
     from one width while the labels had been fitted against another: on the
     malformed 'RT 72 x 116 mm' row (labelSize "0 x 0 mm", so parseSize falls
     back to 50x40, 2-up) the labels were fitted into the 72mm sheet's 68mm
     printable box while the @page still said 100mm - the row was then
     centred in a page 28mm wider than the paper. One size per run. */
  const { w, h } = fittedLabelSize(format, { onStock, gapMm });
  const stock = onStock ? stockPageCss(format, w, h, labelsPerRow(format), gapMm) : null;
  return stock
    ? '@page { size: ' + stock + '; margin: 0; }'
    : '@page { size: A4; margin: 5mm; }';
}

/* ==========================================================================
   HOW BIG THE BARS ARE DRAWN INSIDE THEIR BAND.

   The band is the space the barcode may occupy. It is not the size of the
   symbol: a barcode drawn to the last millimetre of its band is a black slab
   that crowds everything under it, and on a 6-character value it is far
   wider than a scanner needs.

   The symbol is therefore sized from the VALUE, inside that band:

     height  a fixed share of the band (BAR_HEIGHT_SHARE), bottom-anchored
     width   readableBarsBox: one module at TARGET_X_MM, capped at
             BAR_MAX_WIDTH_SHARE of the usable width but not below the
             readable floor - then barsBox draws BAR_DRAW_SCALE of that

   Nothing here crops or stretches: the width is the number of modules times
   a module width, so every bar keeps its proportion to every other bar.
   ========================================================================== */

/* The module width the READABLE box uses when the label can afford it (the
   drawn module is BAR_DRAW_SCALE of whatever the readable box works out).
   ISO/IEC 15417 asks for 0.250mm and a 203dpi thermal dot is 0.125mm, so
   0.33mm is two whole dots plus a margin - comfortably readable, and narrow
   enough that a short value no longer fills the sticker. */
export const TARGET_X_MM = 0.33;

/* The share of the barcode band the bars themselves take. The bars sit at the
   FOOT of the band (components/GrcBarcodeLabel.jsx), BAR_TEXT_GAP_MM above
   the barcode number, so the rest of the band is white space above them.
   They used to be 0.62 of the band and centred in it, which left ~2.4mm of
   white between the bars and the number printed under them. */
export const BAR_HEIGHT_SHARE = 0.80;   /* of the 0.27 band: 8.2mm on 50x40 */
export const BAR_TEXT_GAP_MM = 0.5;

/* THE BARS ARE DRAWN AT HALF WIDTH - by request, so the graphic takes much
   less of the sticker's width (every bar in proportion, nothing cropped).
   The height is set separately, by the barcode band and BAR_HEIGHT_SHARE.
   A taller symbol does NOT make a narrow one readable: a scanner resolves
   bar WIDTHS, and the height only helps it keep a line across the bars.

   READ BEFORE PRINTING: halving the width halves the module. A composed
   value such as "G1319*05197*1*1" is 220 modules; at full size it was drawn
   at the 0.19mm readable floor, at half size it is 0.095mm - narrower than
   one dot of a 203dpi thermal printer (0.125mm), and only ~1.1 dots of a
   300dpi one (0.085mm), so those bars cannot be reproduced faithfully and
   are not expected to scan. On 'stock' paper the label is fitted to 48mm,
   a shade narrower still. The short unit number ("9A2313", 110 modules),
   which the scanner already resolves (lib/inventory.js), is drawn by this
   rule at 0.165mm - below the floor too; it would reach 0.19mm only if it
   were ENCODED instead of the composed value and floored at MIN_X_MM, which
   changes what the bars carry. Set this back to 1 to return to the
   readable width.

   SET BACK TO 1 (05-10-2026): at 0.5 the mobile app's camera read these
   labels as garbage ("E01*-5198*1*,") and no scan matched. Full width
   puts the module back at the 0.19mm readable floor. */
export const BAR_DRAW_SCALE = 1;

/* The widest the READABLE box may be: this share of the label's usable
   width. A narrower symbol means a narrower module, so this cap never takes
   a value below the width it could otherwise be read at - ISO_X_MM for a
   value that can reach it, MIN_X_MM (the close-range floor) for the rest -
   and a value already below that floor at the full width keeps the full
   width. BAR_DRAW_SCALE is applied after, and is NOT bound by this floor. */
export const BAR_MAX_WIDTH_SHARE = 0.85;
export const ISO_X_MM = 0.25;
export const MIN_X_MM = 0.19;

/* The modules a CODE128 symbol needs for this value, quiet zones included.
   Counted with the SAME encoder JsBarcode draws with, not estimated: CODE128
   packs pairs of digits into one symbol character in C mode, so arithmetic on
   the character count is wrong for exactly the digit-heavy values this ERP
   issues. Returns 0 when the value cannot be encoded. */
export function barcodeModules(value) {
  const text = String(value ?? '');
  if (!text) return 0;
  try {
    const CODE128 = code128Class();
    if (!CODE128) return 0;
    const encoded = new CODE128(text, { width: 1, height: 40, format: 'CODE128' }).encode();
    return (encoded?.data?.length || 0) + QUIET_ZONE_MODULES * 2;
  } catch {
    /* CODE128 encodes anything printable; a control character pasted into a
       value can still throw. 0 means "no idea how wide" and barsBox then
       hands the bars the whole band, which is what they had before. */
    return 0;
  }
}

/* The box the bars are drawn in, in mm, for one label and one value:

     { w, h, x, modules }   w x h to draw, x the printed module width

   w is capped at the usable width, so a value too long for the stock still
   fills it rather than overflowing; x then says what that cost.
   When the value cannot be encoded the box is the full band, which is what
   an empty svg occupies anyway. */
export function barsBox(geometry, value) {
  const full = readableBarsBox(geometry, value);
  const w = full.w * BAR_DRAW_SCALE;
  return { w, h: full.h, x: full.modules ? w / full.modules : 0, modules: full.modules };
}

/* The box at FULL scale - the size the value can be read at (see
   BAR_DRAW_SCALE for why the label draws it smaller). Height is already the
   drawn height: the band itself was cut to match. */
export function readableBarsBox(geometry, value) {
  const usableW = Number(geometry?.usableW) || 0;
  const band = typeof geometry?.band === 'function' ? geometry.band('barcode') : 0;
  const h = Math.min(band * BAR_HEIGHT_SHARE, Math.max(0, band - BAR_TEXT_GAP_MM));
  const modules = barcodeModules(value);
  if (!modules) return { w: usableW, h, x: 0, modules: 0 };
  /* the module width filling the label would give, and the narrowest this
     value may be taken to (see BAR_MAX_WIDTH_SHARE) */
  const fullX = usableW / modules;
  const floorX = Math.min(fullX, fullX >= ISO_X_MM ? ISO_X_MM : MIN_X_MM);
  /* rounded UP to the micron, and a micron more if floating point still
     leaves the module a hair under the floor (220 x 0.19 is 41.7999...) */
  let floorW = Math.ceil(modules * floorX * 1000) / 1000;
  if (floorW / modules < floorX) floorW += 0.001;
  const w = Math.min(usableW, modules * TARGET_X_MM, Math.max(usableW * BAR_MAX_WIDTH_SHARE, floorW));
  return { w, h, x: w / modules, modules };
}
