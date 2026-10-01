// // /* Barcode Report - spec.

// //    Plain module (no 'use client') so the API route could import it too, the
// //    same arrangement every other screen folder in this project uses.

// //    Item Code is required and the screen stays empty until it is filled in,
// //    matching the deployed report: this reads the barcode rows one item at a
// //    time rather than dumping the whole collection. */

// // export const REPORT = {
// //   slug: 'barcode-report',
// //   title: 'Barcode Report',
// //   /* nothing loads until Search is pressed with an item code */
// //   searchOnly: true,
// //   perPage: 15,

// //   filters: [
// //     { k: 'itemCode', label: 'Item Code', type: 'text', req: true, placeholder: 'Enter item code' },
// //     { k: 'location', label: 'Business Location', type: 'ref', ref: 'companylocations', all: 'All Locations' },
// //   ],

// //   sections: [{
// //     key: 'barcodes',
// //     title: 'Barcodes',
// //     totalsRow: true,
// //     columns: [
// //       { k: 'barcodeGenerated', t: 'Barcode' },
// //       { k: 'itemCode', t: 'Item Code' },
// //       { k: 'description', t: 'Description' },
// //       { k: 'qty', t: 'Qty', f: 'amount', total: true },
// //       { k: 'uom', t: 'UOM' },
// //       { k: 'hsn', t: 'HSN' },
// //       { k: 'purRate', t: 'Pur Rate', f: 'amount' },
// //       { k: 'finalNet', t: 'Final Net', f: 'amount', total: true },
// //       { k: 'gst', t: 'GST %', f: 'amount' },
// //       { k: 'retailPrice', t: 'Retail Price', f: 'amount' },
// //       { k: 'offerPrice', t: 'Offer Price', f: 'amount' },
// //       { k: 'wspPrice', t: 'WSP Price', f: 'amount' },
// //       { k: 'dpPrice', t: 'DP Price', f: 'amount' },
// //       { k: 'grcNo', t: 'GRC No' },
// //     ],
// //   }],
// // };


















// /* Barcode Report - spec.

//    Plain module (no 'use client') so the API route could import it too, the
//    same arrangement every other screen folder in this project uses.

//    Item Code is required and the screen stays empty until it is filled in,
//    matching the deployed report: this reads the barcode rows one item at a
//    time rather than dumping the whole collection. */

// export const REPORT = {
//   slug: 'barcode-report',
//   title: 'Barcode Report',
//   /* nothing loads until Search is pressed with an item code */
//   searchOnly: true,
//   perPage: 15,

//   filters: [
//     { k: 'itemCode', label: 'Item Code', type: 'text', req: true, placeholder: 'Enter item code' },
//     { k: 'location', label: 'Business Location', type: 'ref', ref: 'companylocations', all: 'All Locations' },
//   ],

//   sections: [{
//     key: 'barcodes',
//     title: 'Barcodes',
//     totalsRow: true,
//     columns: [
//       /* opens that barcode's Details (the same page, ?barcodeNo=) */
//       { k: 'barcodeGenerated', t: 'Barcode', link: (row) => '/admin/reports/barcode-report?barcodeNo=' + encodeURIComponent(row.barcodeNo || row.barcodeGenerated) },
//       { k: 'itemCode', t: 'Item Code' },
//       { k: 'description', t: 'Description' },
//       /* the item's masters, and the imported Details' design / supplier */
//       { k: 'group', t: 'Group' },
//       { k: 'subGroup', t: 'Sub Group' },
//       { k: 'designNo', t: 'Design No' },
//       { k: 'supplier', t: 'Supplier' },
//       { k: 'qty', t: 'Qty', f: 'amount', total: true },
//       { k: 'uom', t: 'UOM' },
//       { k: 'hsn', t: 'HSN' },
//       { k: 'purRate', t: 'Pur Rate', f: 'amount' },
//       { k: 'finalNet', t: 'Final Net', f: 'amount', total: true },
//       { k: 'gst', t: 'GST %', f: 'amount' },
//       { k: 'retailPrice', t: 'Retail Price', f: 'amount' },
//       { k: 'offerPrice', t: 'Offer Price', f: 'amount' },
//       { k: 'wspPrice', t: 'WSP Price', f: 'amount' },
//       { k: 'dpPrice', t: 'DP Price', f: 'amount' },
//       { k: 'grcNo', t: 'GRC No' },
//     ],
//   }],
// };


















/* Barcode Report - spec.

   Plain module (no 'use client') so the API route could import it too, the
   same arrangement every other screen folder in this project uses.

   A Barcode or an Item Code is needed and the screen stays empty until one
   is filled in, matching the deployed report: this reads the barcode rows one
   barcode or one item at a time rather than dumping the whole collection.

   THE BARCODE is the unit's own barcode NUMBER - barcodeLabel.barcodeNo
   ("8A1881", "9A1002"), the number Barcode Generation issued from the Barcode
   Setting series. Never its composed reference, barcodeGenerated
   ("G1093 * 05079 * 5 * 5" = supplier * GRC * bill line * serial), which is
   another thing: the Barcode column shows the number, the Barcode filter
   searches the number, and a barcode's link opens the number.

   The Barcode filter takes a whole number or the start of one: a SERIES
   ("9A") lists every barcode beginning with it, a whole number ("9A1002")
   that barcode (app/api/reports/barcode-report/route.js). */

export const REPORT = {
  slug: 'barcode-report',
  title: 'Barcode Report',
  /* nothing loads until Search is pressed with a barcode or an item code */
  searchOnly: true,
  perPage: 15,
  /* Export CSV / Excel / Print carry the whole result - every barcode of a
     series - not the 15 rows on screen (components/ReportView.jsx) */
  exportAll: true,

  filters: [
    /* the actual barcode number - a whole one, or the start of one (a series) */
    { k: 'barcodeNo', label: 'Barcode', type: 'text', oneOf: true, placeholder: 'Barcode or series, e.g. 9A1002 or 9A' },
    /* every barcode of an item code, as the report always listed them */
    { k: 'itemCode', label: 'Item Code', type: 'text', oneOf: true, placeholder: 'Enter item code' },
    { k: 'location', label: 'Business Location', type: 'ref', ref: 'companylocations', all: 'All Locations' },
  ],

  sections: [{
    key: 'barcodes',
    title: 'Barcodes',
    totalsRow: true,
    columns: [
      /* the barcode NUMBER; opens that barcode's Details (the same page,
         ?barcodeNo=) */
      { k: 'barcodeNo', t: 'Barcode', link: (row) => '/admin/reports/barcode-report?barcodeNo=' + encodeURIComponent(row.barcodeNo) },
      { k: 'itemCode', t: 'Item Code' },
      { k: 'description', t: 'Description' },
      /* the item's masters, and the imported Details' design / supplier */
      { k: 'group', t: 'Group' },
      { k: 'subGroup', t: 'Sub Group' },
      { k: 'designNo', t: 'Design No' },
      { k: 'supplier', t: 'Supplier' },
      { k: 'qty', t: 'Qty', f: 'amount', total: true },
      { k: 'uom', t: 'UOM' },
      { k: 'hsn', t: 'HSN' },
      { k: 'purRate', t: 'Pur Rate', f: 'amount' },
      { k: 'finalNet', t: 'Final Net', f: 'amount', total: true },
      { k: 'gst', t: 'GST %', f: 'amount' },
      { k: 'retailPrice', t: 'Retail Price', f: 'amount' },
      { k: 'offerPrice', t: 'Offer Price', f: 'amount' },
      { k: 'wspPrice', t: 'WSP Price', f: 'amount' },
      { k: 'dpPrice', t: 'DP Price', f: 'amount' },
      { k: 'grcNo', t: 'GRC No' },
    ],
  }],
};
