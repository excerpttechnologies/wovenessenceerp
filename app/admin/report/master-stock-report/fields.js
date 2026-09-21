// /* Master Stock Report - spec.

//    Plain module (no 'use client') so the API route could import it too, the
//    same arrangement every other report folder in this project uses.

//    THE GRAIN: one row is ONE barcode currently IN_STOCK. A barcode row is one
//    unit of stock in this ERP (lib/barcodeLabel.js:4), so nothing here
//    aggregates several units into a line and no join can multiply one unit
//    into several rows.

//    COLUMN ORDER is the reference workbook's, exactly: Location Name, Group
//    Name, Item Name, Supplier Code, Supplier Name, Date, Age, BARCODE NUMBER,
//    Close Qty, Close Value, COST PRICE, HSN, GST %, RSP, Discount %, RSP Offer
//    Price, WSP, E COM, UOM. The CSV / Excel / PDF exports are built from this
//    same list by ReportView, so they cannot drift from the screen. */

// export const REPORT = {
//   /* ReportView calls /api/reports/<slug> */
//   slug: 'master-stock-report',
//   title: 'Master Stock Report',
//   subtitle: 'Every barcode currently in stock, with its item, supplier, age, quantity, valuation and printed prices.',
//   perPage: 25,
//   countLabel: 'Total Barcodes',

//   /* Every filter here has a matching clause in the route - none of them is
//      decoration. Business, Location and Financial Year are not listed: they
//      come from the top bar's scope, which ReportView sends on every request. */
//   filters: [
//     { k: 'search', label: 'Search', type: 'text', placeholder: 'Barcode, item, description or HSN' },
//     { k: 'barcodeNo', label: 'Barcode Number', type: 'text', placeholder: 'e.g. 9A1135' },
//     { k: 'itemCode', label: 'Item', type: 'text', placeholder: 'Item / style code' },
//     { k: 'supplierId', label: 'Supplier', type: 'ref', ref: 'supplier', all: 'All Suppliers' },
//     { k: 'hsn', label: 'HSN', type: 'text', placeholder: 'HSN code' },
//     /* GST % is typed, not picked from the Tax master. That master
//        (models/Tax.js, the ref: 'tax' option list) keys on its own _id and
//        keeps free text in taxName: 15 rows today, in which "GST 5%",
//        "GST 5 %" and a bare "GST" all mean 5, "GST 3%" and "GST 15%" appear
//        twice each, and one row reads igst 212 / cgst 1221. barcodeLabel.gst
//        stores the PERCENTAGE ITSELF rather than a reference to that master,
//        so a tax _id could not filter it without inventing a mapping this
//        database does not have. The route compares the NUMBER, so 5, "5" and
//        "5.00" all match the one slab. */
//     { k: 'gst', label: 'GST %', type: 'text', placeholder: 'GST %' },
//     { k: 'uom', label: 'UOM', type: 'ref', ref: 'uom', all: 'All UOM' },
//     { k: 'startDate', label: 'From Date', type: 'date' },
//     { k: 'endDate', label: 'To Date', type: 'date' },
//   ],

//   sections: [{
//     key: 'stock',
//     title: 'Stock',
//     totalsRow: true,
//     columns: [
//       { k: 'locationName', t: 'Location Name' },
//       { k: 'groupName', t: 'Group Name' },
//       { k: 'itemName', t: 'Item Name' },
//       { k: 'supplierCode', t: 'Supplier Code' },
//       { k: 'supplierName', t: 'Supplier Name' },
//       { k: 'date', t: 'Date', f: 'date' },
//       { k: 'age', t: 'Age' },
//       { k: 'barcodeNumber', t: 'BARCODE NUMBER' },
//       /* the only two columns that are additive: a quantity and a valuation.
//          A per-unit price is not summed - totalling COST PRICE or RSP down a
//          column would produce a number that means nothing. */
//       { k: 'closeQty', t: 'Close Qty', f: 'amount', total: true },
//       { k: 'closeValue', t: 'Close Value', f: 'amount', total: true },
//       { k: 'costPrice', t: 'COST PRICE', f: 'amount' },
//       { k: 'hsn', t: 'HSN' },
//       { k: 'gst', t: 'GST %', f: 'amount' },
//       { k: 'rsp', t: 'RSP', f: 'amount' },
//       { k: 'discount', t: 'Discount %', f: 'amount' },
//       { k: 'rspOfferPrice', t: 'RSP Offer Price', f: 'amount' },
//       { k: 'wsp', t: 'WSP', f: 'amount' },
//       { k: 'ecom', t: 'E COM', f: 'amount' },
//       { k: 'uom', t: 'UOM' },
//     ],
//   }],
// };





//suhas 


/* Master Stock Report - spec.

   Plain module (no 'use client') so the API route could import it too, the
   same arrangement every other report folder in this project uses.

   THE GRAIN: one row is ONE barcode currently IN_STOCK. A barcode row is one
   unit of stock in this ERP (lib/barcodeLabel.js:4), so nothing here
   aggregates several units into a line and no join can multiply one unit
   into several rows.

   COLUMN ORDER is the reference workbook's, exactly: Location Name, Group
   Name, Item Name, Supplier Code, Supplier Name, Date, Age, BARCODE NUMBER,
   Close Qty, Close Value, COST PRICE, HSN, GST %, RSP, Discount %, RSP Offer
   Price, WSP, E COM, UOM. The CSV / Excel / PDF exports are built from this
   same list by ReportView, so they cannot drift from the screen. */

export const REPORT = {
  /* ReportView calls /api/reports/<slug> */
  slug: 'master-stock-report',
  title: 'Master Stock Report',
  subtitle: 'Every barcode currently in stock, with its item, supplier, age, quantity, valuation and printed prices.',
  perPage: 25,
  countLabel: 'Total Barcodes',

  /* Every filter here has a matching clause in the route - none of them is
     decoration. Business, Location and Financial Year are not listed: they
     come from the top bar's scope, which ReportView sends on every request.

     Text filters: name/code fields match case-insensitive "contains".
     Numeric filters: "Min"/"Max" pairs are inclusive (>= / <=); the route
     must parse them as numbers and ignore blanks. */
  filters: [
   //  { k: 'search', label: 'Search', type: 'text', placeholder: 'Barcode, item, description or HSN' },
   //  { k: 'barcodeNo', label: 'Barcode Number', type: 'text', placeholder: 'e.g. 9A1135' },
    { k: 'groupName', label: 'Group Name', type: 'text', placeholder: 'Group name' },
    { k: 'itemCode', label: 'Item Name', type: 'text', placeholder: 'Item Name' },
   //  { k: 'itemName', label: 'Item Name', type: 'text', placeholder: 'Item name' },
    { k: 'supplierId', label: 'Supplier', type: 'ref', ref: 'supplier', all: 'All Suppliers' },
    { k: 'hsn', label: 'HSN', type: 'text', placeholder: 'HSN code' },
    /* GST % is typed, not picked from the Tax master. That master
       (models/Tax.js, the ref: 'tax' option list) keys on its own _id and
       keeps free text in taxName: 15 rows today, in which "GST 5%",
       "GST 5 %" and a bare "GST" all mean 5, "GST 3%" and "GST 15%" appear
       twice each, and one row reads igst 212 / cgst 1221. barcodeLabel.gst
       stores the PERCENTAGE ITSELF rather than a reference to that master,
       so a tax _id could not filter it without inventing a mapping this
       database does not have. The route compares the NUMBER, so 5, "5" and
       "5.00" all match the one slab. */
    { k: 'gst', label: 'GST %', type: 'text', placeholder: 'GST %' },
    { k: 'uom', label: 'UOM', type: 'ref', ref: 'uom', all: 'All UOM' },

    { k: 'ageMin', label: 'Age Min (days)', type: 'text', placeholder: 'Min age' },
    { k: 'ageMax', label: 'Age Max (days)', type: 'text', placeholder: 'Max age' },

    { k: 'costPriceMin', label: 'Cost Price Min', type: 'text', placeholder: 'Min cost' },
    { k: 'costPriceMax', label: 'Cost Price Max', type: 'text', placeholder: 'Max cost' },
    { k: 'rspMin', label: 'RSP Min', type: 'text', placeholder: 'Min RSP' },
    { k: 'rspMax', label: 'RSP Max', type: 'text', placeholder: 'Max RSP' },
    { k: 'discount', label: 'Discount %', type: 'text', placeholder: 'Discount %' },
    { k: 'rspOfferPriceMin', label: 'RSP Offer Price Min', type: 'text', placeholder: 'Min offer price' },
    { k: 'rspOfferPriceMax', label: 'RSP Offer Price Max', type: 'text', placeholder: 'Max offer price' },
    { k: 'wspMin', label: 'WSP Min', type: 'text', placeholder: 'Min WSP' },
    { k: 'wspMax', label: 'WSP Max', type: 'text', placeholder: 'Max WSP' },
    { k: 'ecomMin', label: 'E COM Min', type: 'text', placeholder: 'Min E COM' },
    { k: 'ecomMax', label: 'E COM Max', type: 'text', placeholder: 'Max E COM' },

    { k: 'startDate', label: 'From Date', type: 'date' },
    { k: 'endDate', label: 'To Date', type: 'date' },
  ],

  sections: [{
    key: 'stock',
    title: 'Stock',
    totalsRow: true,
    columns: [
      { k: 'locationName', t: 'Location Name' },
      { k: 'groupName', t: 'Group Name' },
      { k: 'itemName', t: 'Item Name' },
      { k: 'supplierCode', t: 'Supplier Code' },
      { k: 'supplierName', t: 'Supplier Name' },
      { k: 'date', t: 'Date', f: 'date' },
      { k: 'age', t: 'Age' },
      { k: 'barcodeNumber', t: 'BARCODE NUMBER' },
      /* the only two columns that are additive: a quantity and a valuation.
         A per-unit price is not summed - totalling COST PRICE or RSP down a
         column would produce a number that means nothing. */
      { k: 'closeQty', t: 'Close Qty', f: 'amount', total: true },
      { k: 'closeValue', t: 'Close Value', f: 'amount', total: true },
      { k: 'costPrice', t: 'COST PRICE', f: 'amount' },
      { k: 'hsn', t: 'HSN' },
      { k: 'gst', t: 'GST %', f: 'amount' },
      { k: 'rsp', t: 'RSP', f: 'amount' },
      { k: 'discount', t: 'Discount %', f: 'amount' },
      { k: 'rspOfferPrice', t: 'RSP Offer Price', f: 'amount' },
      { k: 'wsp', t: 'WSP', f: 'amount' },
      { k: 'ecom', t: 'E COM', f: 'amount' },
      { k: 'uom', t: 'UOM' },
      /* not part of the reference workbook - added after E COM/UOM so the
         printed barcode thumbnail (barcodeLabel.imageUrl) shows alongside
         the rest of the label's own data */
      { k: 'imageUrl', t: 'Image', f: 'image' },
    ],
  }],
};