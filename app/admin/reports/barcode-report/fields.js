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
//       { k: 'barcodeGenerated', t: 'Barcode' },
//       { k: 'itemCode', t: 'Item Code' },
//       { k: 'description', t: 'Description' },
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

   Item Code is required and the screen stays empty until it is filled in,
   matching the deployed report: this reads the barcode rows one item at a
   time rather than dumping the whole collection. */

export const REPORT = {
  slug: 'barcode-report',
  title: 'Barcode Report',
  /* nothing loads until Search is pressed with an item code */
  searchOnly: true,
  perPage: 15,

  filters: [
    { k: 'itemCode', label: 'Item Code', type: 'text', req: true, placeholder: 'Enter item code' },
    { k: 'location', label: 'Business Location', type: 'ref', ref: 'companylocations', all: 'All Locations' },
  ],

  sections: [{
    key: 'barcodes',
    title: 'Barcodes',
    totalsRow: true,
    columns: [
      /* opens that barcode's Details (the same page, ?barcodeNo=) */
      { k: 'barcodeGenerated', t: 'Barcode', link: (row) => '/admin/reports/barcode-report?barcodeNo=' + encodeURIComponent(row.barcodeNo || row.barcodeGenerated) },
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

