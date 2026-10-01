// // /* Inter Company Delivery Challan - field spec, line maths and grid columns.

// //    Plain module (no 'use client'), so the API routes import the same rules the
// //    form uses: what you watch while typing is exactly what gets stored. Same
// //    arrangement as app/admin/transport/delivery/fields.js. */

// // /* Header fields, in the deployed screen's reading order. Business and
// //    Location Name are handled by the form itself rather than by <Field>,
// //    because the location list depends on the business selected HERE - not on
// //    the business in the top bar, which is what a plain `ref` field would use. */
// // export const FIELDS = [
// //   { k: 'toBusinessId', label: 'Business', type: 'ref', ref: 'business', req: true },
// //   { k: 'toLocationId', label: 'Location Name', type: 'ref', ref: 'companylocations', req: true },
// //   { k: 'customerWaybill', label: 'Customer Waybill', type: 'file', info: true },
// //   { k: 'customerGstn', label: 'Customer GSTN', type: 'text', readOnly: true },

// //   { k: 'dcDate', label: 'DC Date', type: 'date', req: true, def: 'today' },
// //   { k: 'customerAddress', label: 'Customer Address', type: 'text', readOnly: true },
// //   { k: 'salesPersonId', label: 'Sales Person', type: 'ref', ref: 'agent', placeholder: 'Select...' },
// //   {
// //     k: 'salesTerm', label: 'Sales Term', type: 'select', placeholder: '--Select--',
// //     opts: [{ v: 'After Tax', l: 'After Tax' }, { v: 'Before Tax', l: 'Before Tax' }],
// //   },

// //   { k: 'agentId', label: 'Agent', type: 'ref', ref: 'agent', placeholder: 'Select...' },
// //   { k: 'stockPointId', label: 'Stock Point', type: 'ref', ref: 'stockpoint', req: true },
// //   { k: 'logisticId', label: 'Logistic Details', type: 'ref', ref: 'logistic', placeholder: 'Select...' },
// // ];

// // /* Stored totals. Not header fields, so the API allows them through
// //    explicitly rather than via validate(). */
// // export const TOTAL_KEYS = [
// //   'taxableValue', 'discountPercent', 'roundOffDiscountAmt',
// //   'igstTotal', 'cgstTotal', 'sgstTotal',
// //   'roundOff', 'totalQty', 'netValue',
// // ];

// // export const GRID_COLS = [
// //   '#', 'Item Code', 'Item Name', 'HSN', 'GST Slab', 'UOM', 'QTY', 'Unit Rate',
// //   'Discount', 'R.Off Discount', 'Final Rate', 'Before Tax', 'IGST Amount',
// //   'CGST Amount', 'SGST Amount', 'Net Amount', 'Action',
// // ];

// // export const INFO = [
// //   '<b>Item Code Validation:</b> The item code must exist in the GRC Item list, regardless of whether a purchase invoice has been created for the GRC.',
// //   '<b>Stock Availability Check:</b> The item must be available in stock before proceeding.',
// //   "<b>Unit Price Calculation:</b> The item's unit price is determined based on the selected customer's pricing setup (RSP, WSP, DP or Profit on Sharing).",
// // ];

// // /* ------------------------------------------------------------------ maths */

// // export const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
// // export const r2 = (v) => Math.round(num(v) * 100) / 100;
// // export const money = (v) => r2(v).toFixed(2);

// // /* One line's derived figures. Identical rules to the Purchase Invoice, which
// //    were checked against a posted document on the live system:

// //      Discount   = Unit Rate x Discount%
// //      Final Rate = Unit Rate - Discount - R.Off Discount
// //      Before Tax = Final Rate x QTY
// //      GST        = Before Tax x each slab %
// //      Net Amount = Before Tax + IGST + CGST + SGST                            */
// // export function computeLine(r) {
// //   const rate = num(r.unitRate);
// //   const qty = num(r.qty);
// //   const discount = r2(rate * (num(r.discountPct) / 100));
// //   const finalRate = r2(rate - discount - num(r.roffDiscount));
// //   const beforeTax = r2(finalRate * qty);
// //   const igst = r2(beforeTax * (num(r.igstPct) / 100));
// //   const cgst = r2(beforeTax * (num(r.cgstPct) / 100));
// //   const sgst = r2(beforeTax * (num(r.sgstPct) / 100));
// //   return {
// //     discount, finalRate, beforeTax, igst, cgst, sgst,
// //     netAmount: r2(beforeTax + igst + cgst + sgst),
// //   };
// // }

// // /* Whole-document totals. `roundOff` is the whole-rupee correction on the
// //    final figure, which is how the deployed challan shows -0.46 against a net
// //    of 18030.00. */
// // export function computeTotals(rows, { discountPercent = 0, roundOffDiscountAmt = 0 } = {}) {
// //   const calc = rows.map(computeLine);

// //   const taxableValue = r2(calc.reduce((a, c) => a + c.beforeTax, 0));
// //   const igstTotal = r2(calc.reduce((a, c) => a + c.igst, 0));
// //   const cgstTotal = r2(calc.reduce((a, c) => a + c.cgst, 0));
// //   const sgstTotal = r2(calc.reduce((a, c) => a + c.sgst, 0));
// //   const totalQty = r2(rows.reduce((a, r) => a + num(r.qty), 0));

// //   const headDiscount = r2(taxableValue * (num(discountPercent) / 100));
// //   const gross = r2(
// //     taxableValue - headDiscount - num(roundOffDiscountAmt)
// //     + igstTotal + cgstTotal + sgstTotal
// //   );

// //   const netValue = Math.round(gross);
// //   const roundOff = r2(netValue - gross);

// //   /* the slab percentages to print beside the GST rows */
// //   const cgstPct = rows.find((r) => num(r.cgstPct))?.cgstPct || 0;
// //   const sgstPct = rows.find((r) => num(r.sgstPct))?.sgstPct || 0;
// //   const igstPct = rows.find((r) => num(r.igstPct))?.igstPct || 0;

// //   return {
// //     calc, taxableValue, igstTotal, cgstTotal, sgstTotal, totalQty,
// //     headDiscount, roundOff, netValue: r2(netValue),
// //     cgstPct, sgstPct, igstPct,
// //   };
// // }

// // /* A blank grid row. `availableQty` stays null until something can supply a
// //    stock balance - this project has no stock ledger, so the "(Max: n)" hint
// //    under QTY renders only when the API fills it in. */
// // export const BLANK_ROW = {
// //   itemId: '', itemCode: '', itemName: '', hsn: '', slabName: '',
// //   igstPct: 0, cgstPct: 0, sgstPct: 0,
// //   uom: '', qty: '', availableQty: null,
// //   unitRate: '', discountPct: '', roffDiscount: '',
// // };



// /* Inter Company Delivery Challan - field spec, line maths and grid columns.

//    Plain module (no 'use client'), so the API routes import the same rules the
//    form uses: what you watch while typing is exactly what gets stored. Same
//    arrangement as app/admin/transport/delivery/fields.js. */

// /* Header fields, in the deployed screen's reading order. Business and
//    Location Name are handled by the form itself rather than by <Field>,
//    because the location list depends on the business selected HERE - not on
//    the business in the top bar, which is what a plain `ref` field would use. */
// export const FIELDS = [
//   { k: 'toBusinessId', label: 'Business', type: 'ref', ref: 'business', req: true },
//   { k: 'toLocationId', label: 'Location Name', type: 'ref', ref: 'companylocations', req: true },
//   { k: 'customerWaybill', label: 'Customer Waybill', type: 'file', info: true },
//   { k: 'customerGstn', label: 'Customer GSTN', type: 'text', readOnly: true },

//   { k: 'dcDate', label: 'DC Date', type: 'date', req: true, def: 'today' },
//   { k: 'stockPointId', label: 'Stock Point', type: 'ref', ref: 'stockpoint', req: true },

//   /* `hidden` keeps a field OUT OF THE FORM but IN the spec, which matters
//      because the API routes derive their accepted-field set from this same
//      array. Deleting these entries would make the server drop the values
//      instead of merely stopping the screen from asking for them - and
//      customerAddress is not asked for anyway: the form copies it off the
//      destination business when one is picked. */
//   { k: 'customerAddress', label: 'Customer Address', type: 'text', readOnly: true, hidden: true },
//   { k: 'salesPersonId', label: 'Sales Person', type: 'ref', ref: 'agent', placeholder: 'Select...', hidden: true },
//   {
//     k: 'salesTerm', label: 'Sales Term', type: 'select', placeholder: '--Select--', hidden: true,
//     opts: [{ v: 'After Tax', l: 'After Tax' }, { v: 'Before Tax', l: 'Before Tax' }],
//   },
//   { k: 'agentId', label: 'Agent', type: 'ref', ref: 'agent', placeholder: 'Select...', hidden: true },
//   { k: 'logisticId', label: 'Logistic Details', type: 'ref', ref: 'logistic', placeholder: 'Select...', hidden: true },
// ];

// /* Stored totals. Not header fields, so the API allows them through
//    explicitly rather than via validate(). */
// export const TOTAL_KEYS = [
//   'taxableValue', 'discountPercent', 'roundOffDiscountAmt',
//   'igstTotal', 'cgstTotal', 'sgstTotal',
//   'roundOff', 'totalQty', 'netValue',
// ];

// /* Item Code is deliberately absent: lines are entered BY BARCODE, so the
//    barcode is the identifier on screen. itemCode is still resolved and still
//    stored on every line - the downstream invoice needs it - it is just not a
//    column.

//    This is the FULL grid. Auto Purchases Return re-exports it and still shows
//    every column; the Delivery Challan uses COMPACT_GRID_COLS below. */
// export const GRID_COLS = [
//   '#', 'Barcode No', 'Item Name', 'HSN', 'GST Slab', 'UOM', 'QTY', 'Unit Rate',
//   'Discount', 'R.Off Discount', 'Final Rate', 'Before Tax', 'IGST Amount',
//   'CGST Amount', 'SGST Amount', 'Net Amount', 'Action',
// ];

// /* The Delivery Challan grid, matching the printed challan: Sl No, Barcode,
//    Qty, UOM, HSN, Item Name / Description.

//    The money columns are gone from the SCREEN only. Every line still carries
//    its unit rate, discounts and tax percentages - supplied by the item lookup
//    and stored on save - so the totals block below the grid keeps working and
//    raising a line's quantity still raises the amount. */
// export const COMPACT_GRID_COLS = [
//   'Sl No.', 'Barcode', 'Qty', 'UOM', 'HSN', 'Item Name / Description',
//   'RSP Price', 'Action',
// ];

// export const INFO = [
//   '<b>Item Code Validation:</b> The item code must exist in the GRC Item list, regardless of whether a purchase invoice has been created for the GRC.',
//   '<b>Stock Availability Check:</b> The item must be available in stock before proceeding.',
//   "<b>Unit Price Calculation:</b> The item's unit price is determined based on the selected customer's pricing setup (RSP, WSP, DP or Profit on Sharing).",
// ];

// /* ------------------------------------------------------------------ maths */

// export const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
// export const r2 = (v) => Math.round(num(v) * 100) / 100;
// export const money = (v) => r2(v).toFixed(2);

// /* One line's derived figures. Identical rules to the Purchase Invoice, which
//    were checked against a posted document on the live system:

//      Discount   = Unit Rate x Discount%
//      Final Rate = Unit Rate - Discount - R.Off Discount
//      Before Tax = Final Rate x QTY
//      GST        = Before Tax x each slab %
//      Net Amount = Before Tax + IGST + CGST + SGST                            */
// export function computeLine(r) {
//   const rate = num(r.unitRate);
//   const qty = num(r.qty);
//   const discount = r2(rate * (num(r.discountPct) / 100));
//   const finalRate = r2(rate - discount - num(r.roffDiscount));
//   const beforeTax = r2(finalRate * qty);
//   const igst = r2(beforeTax * (num(r.igstPct) / 100));
//   const cgst = r2(beforeTax * (num(r.cgstPct) / 100));
//   const sgst = r2(beforeTax * (num(r.sgstPct) / 100));
//   return {
//     discount, finalRate, beforeTax, igst, cgst, sgst,
//     netAmount: r2(beforeTax + igst + cgst + sgst),
//   };
// }

// /* Whole-document totals. `roundOff` is the whole-rupee correction on the
//    final figure, which is how the deployed challan shows -0.46 against a net
//    of 18030.00. */
// export function computeTotals(rows, { discountPercent = 0, roundOffDiscountAmt = 0 } = {}) {
//   const calc = rows.map(computeLine);

//   const taxableValue = r2(calc.reduce((a, c) => a + c.beforeTax, 0));
//   const igstTotal = r2(calc.reduce((a, c) => a + c.igst, 0));
//   const cgstTotal = r2(calc.reduce((a, c) => a + c.cgst, 0));
//   const sgstTotal = r2(calc.reduce((a, c) => a + c.sgst, 0));
//   const totalQty = r2(rows.reduce((a, r) => a + num(r.qty), 0));

//   const headDiscount = r2(taxableValue * (num(discountPercent) / 100));
//   const gross = r2(
//     taxableValue - headDiscount - num(roundOffDiscountAmt)
//     + igstTotal + cgstTotal + sgstTotal
//   );

//   const netValue = Math.round(gross);
//   const roundOff = r2(netValue - gross);

//   /* the slab percentages to print beside the GST rows */
//   const cgstPct = rows.find((r) => num(r.cgstPct))?.cgstPct || 0;
//   const sgstPct = rows.find((r) => num(r.sgstPct))?.sgstPct || 0;
//   const igstPct = rows.find((r) => num(r.igstPct))?.igstPct || 0;

//   return {
//     calc, taxableValue, igstTotal, cgstTotal, sgstTotal, totalQty,
//     headDiscount, roundOff, netValue: r2(netValue),
//     cgstPct, sgstPct, igstPct,
//   };
// }

// /* A blank grid row. `availableQty` stays null until something can supply a
//    stock balance - this project has no stock ledger, so the "(Max: n)" hint
//    under QTY renders only when the API fills it in. */
// export const BLANK_ROW = {
//   barcodeNo: '', uomType: '', batchType: '', qtyNum: 0,
//   itemId: '', itemCode: '', itemName: '', hsn: '', slabName: '',
//   igstPct: 0, cgstPct: 0, sgstPct: 0,
//   uom: '', qty: '', availableQty: null,
//   unitRate: '', discountPct: '', roffDiscount: '',
// };



//sagar


/* Inter Company Delivery Challan - field spec, line maths and grid columns.

   Plain module (no 'use client'), so the API routes import the same rules the
   form uses: what you watch while typing is exactly what gets stored. Same
   arrangement as app/admin/transport/delivery/fields.js. */

/* Header fields, in the deployed screen's reading order. Business and
   Location Name are handled by the form itself rather than by <Field>,
   because the location list depends on the business selected HERE - not on
   the business in the top bar, which is what a plain `ref` field would use. */
export const FIELDS = [
  { k: 'toBusinessId', label: 'Business', type: 'ref', ref: 'business', req: true },
  { k: 'toLocationId', label: 'Location Name', type: 'ref', ref: 'companylocations', req: true },
  // { k: 'customerWaybill', label: 'Customer Waybill', type: 'file', info: true },
  { k: 'customerGstn', label: 'Customer GSTN', type: 'text', readOnly: true },

  { k: 'dcDate', label: 'DC Date', type: 'date', req: true, def: 'today' },
  { k: 'stockPointId', label: 'Stock Point', type: 'ref', ref: 'stockpoint', req: true },

  /* `hidden` keeps a field OUT OF THE FORM but IN the spec, which matters
     because the API routes derive their accepted-field set from this same
     array. Deleting these entries would make the server drop the values
     instead of merely stopping the screen from asking for them - and
     customerAddress is not asked for anyway: the form copies it off the
     destination business when one is picked. */
  { k: 'customerAddress', label: 'Customer Address', type: 'text', readOnly: true, hidden: true },
  { k: 'salesPersonId', label: 'Sales Person', type: 'ref', ref: 'agent', placeholder: 'Select...', hidden: true },
  {
    k: 'salesTerm', label: 'Sales Term', type: 'select', placeholder: '--Select--', hidden: true,
    opts: [{ v: 'After Tax', l: 'After Tax' }, { v: 'Before Tax', l: 'Before Tax' }],
  },
  { k: 'agentId', label: 'Agent', type: 'ref', ref: 'agent', placeholder: 'Select...', hidden: true },
  { k: 'logisticId', label: 'Logistic Details', type: 'ref', ref: 'logistic', placeholder: 'Select...', hidden: true },
];

/* Stored totals. Not header fields, so the API allows them through
   explicitly rather than via validate(). */
export const TOTAL_KEYS = [
  'taxableValue', 'discountPercent', 'roundOffDiscountAmt',
  'igstTotal', 'cgstTotal', 'sgstTotal',
  'roundOff', 'totalQty', 'netValue',
];

/* Item Code is deliberately absent: lines are entered BY BARCODE, so the
   barcode is the identifier on screen. itemCode is still resolved and still
   stored on every line - the downstream invoice needs it - it is just not a
   column.

   This is the FULL grid. Auto Purchases Return re-exports it and still shows
   every column; the Delivery Challan uses COMPACT_GRID_COLS below. */
export const GRID_COLS = [
  '#', 'Barcode No', 'Item Name', 'HSN', 'GST Slab', 'UOM', 'QTY', 'Unit Rate',
  'Discount', 'R.Off Discount', 'Final Rate', 'Before Tax', 'IGST Amount',
  'CGST Amount', 'SGST Amount', 'Net Amount', 'Action',
];

/* The Delivery Challan grid, matching the printed challan: Sl No, Barcode,
   Qty, UOM, HSN, Item Name / Description.

   The money columns are gone from the SCREEN only. Every line still carries
   its unit rate, discounts and tax percentages - supplied by the item lookup
   and stored on save - so the totals block below the grid keeps working and
   raising a line's quantity still raises the amount. */
export const COMPACT_GRID_COLS = [
  'Sl No.', 'Barcode', 'Qty', 'UOM', 'HSN', 'Item Name / Description',
  'RSP Price', 'Image', 'Action',
];

export const INFO = [
  '<b>Item Code Validation:</b> The item code must exist in the GRC Item list, regardless of whether a purchase invoice has been created for the GRC.',
  '<b>Stock Availability Check:</b> The item must be available in stock before proceeding.',
  "<b>Unit Price Calculation:</b> The item's unit price is determined based on the selected customer's pricing setup (RSP, WSP, DP or Profit on Sharing).",
];

/* ------------------------------------------------------------------ maths */

export const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
export const r2 = (v) => Math.round(num(v) * 100) / 100;
export const money = (v) => r2(v).toFixed(2);

/* One line's derived figures. Identical rules to the Purchase Invoice, which
   were checked against a posted document on the live system:

     Discount   = Unit Rate x Discount%
     Final Rate = Unit Rate - Discount - R.Off Discount
     Before Tax = Final Rate x QTY
     GST        = Before Tax x each slab %
     Net Amount = Before Tax + IGST + CGST + SGST                            */
export function computeLine(r) {
  const rate = num(r.unitRate);
  const qty = num(r.qty);
  const discount = r2(rate * (num(r.discountPct) / 100));
  const finalRate = r2(rate - discount - num(r.roffDiscount));
  const beforeTax = r2(finalRate * qty);
  const igst = r2(beforeTax * (num(r.igstPct) / 100));
  const cgst = r2(beforeTax * (num(r.cgstPct) / 100));
  const sgst = r2(beforeTax * (num(r.sgstPct) / 100));
  return {
    discount, finalRate, beforeTax, igst, cgst, sgst,
    netAmount: r2(beforeTax + igst + cgst + sgst),
  };
}

/* Whole-document totals. `roundOff` is the whole-rupee correction on the
   final figure, which is how the deployed challan shows -0.46 against a net
   of 18030.00. */
export function computeTotals(rows, { discountPercent = 0, roundOffDiscountAmt = 0 } = {}) {
  const calc = rows.map(computeLine);

  const taxableValue = r2(calc.reduce((a, c) => a + c.beforeTax, 0));
  const igstTotal = r2(calc.reduce((a, c) => a + c.igst, 0));
  const cgstTotal = r2(calc.reduce((a, c) => a + c.cgst, 0));
  const sgstTotal = r2(calc.reduce((a, c) => a + c.sgst, 0));
  const totalQty = r2(rows.reduce((a, r) => a + num(r.qty), 0));

  const headDiscount = r2(taxableValue * (num(discountPercent) / 100));
  const gross = r2(
    taxableValue - headDiscount - num(roundOffDiscountAmt)
    + igstTotal + cgstTotal + sgstTotal
  );

  const netValue = Math.round(gross);
  const roundOff = r2(netValue - gross);

  /* the slab percentages to print beside the GST rows */
  const cgstPct = rows.find((r) => num(r.cgstPct))?.cgstPct || 0;
  const sgstPct = rows.find((r) => num(r.sgstPct))?.sgstPct || 0;
  const igstPct = rows.find((r) => num(r.igstPct))?.igstPct || 0;

  return {
    calc, taxableValue, igstTotal, cgstTotal, sgstTotal, totalQty,
    headDiscount, roundOff, netValue: r2(netValue),
    cgstPct, sgstPct, igstPct,
  };
}

/* A blank grid row. `availableQty` stays null until something can supply a
   stock balance - this project has no stock ledger, so the "(Max: n)" hint
   under QTY renders only when the API fills it in. */
export const BLANK_ROW = {
  barcodeNo: '', uomType: '', batchType: '', qtyNum: 0, image: '',
  itemId: '', itemCode: '', itemName: '', hsn: '', slabName: '',
  igstPct: 0, cgstPct: 0, sgstPct: 0,
  uom: '', qty: '', availableQty: null,
  unitRate: '', discountPct: '', roffDiscount: '',
};
