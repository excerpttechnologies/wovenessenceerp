// /* Card spec for the Add Goods Receipt Challan entry screen.
//    Each source card carries the upstream resource's own endpoint. */

// export const FORM = {
//     "cards": [
//       {
//         "type": "source",
//         "endpoint": "/api/delivery",
//         "availableLr": true,
//         "label": "LR / Transaction Number",
//         "req": true,
//         "sourceKey": "lrTransactionId",
//         "sourceLabel": "transactionNo",
//         "width": "full",
//         /* LR dropdown loads ALL available LR/Delivery records without requiring 
//            vendor selection first. The dropdown shows transaction number with 
//            supplier info for context: "LR/26/011 | G524 | KARNATAKA Saree Centre" */
//         "sourceSubLabel": ["supplier.contactId", "supplier.businessName"],
//         /* Everything from the selected LR/Delivery is auto-populated onto the GRC.
//            This includes the supplier, invoice details, freight, and transaction info. */
//         "populate": {
//           "supplierId": "supplierId",
//           "vendorGstNo": "supplierGstNo",
//           "vendorDocNo": "invPmNumber",
//           "lrTransactionNo": "transactionNo",
//           "freightAmount": "freightAmount"
//         }
//       },
//       {
//         "type": "fields",
//         "gridClass": "grc-header-fields-grid",
//         "fields": [
//           {
//             "k": "supplierId",
//             "label": "Vendor Name",
//             "type": "ref",
//             "ref": "supplier",
//             "req": true,
//             "width": "full",
//             "readOnly": true,
//             /* A supplier carries its own agent - models/contactSchema.js
//                declares `agentId: { ref: 'agent' }` with the comment "a
//                supplier's agent", and the supplier master asks for it under
//                Agent Setup -> Agent Name. So settling the vendor settles the
//                Agent too, and the operator is not asked again for something
//                the database already records.

//                `fillFrom` reads it off the supplier record through set(), which
//                already carries the request token that stops a slow lookup for a
//                vendor chosen two changes ago from landing on the current one.
//                A supplier with no agent yields '' (doc.agentId is null), which
//                EMPTIES the box rather than leaving the previous vendor's agent
//                standing - the only two states this field has.

//                agentId is the single GRC header field the supplier master also
//                holds; purchase group, occasion, freight and stock point have no
//                supplier-level equivalent, and Vendor GST No already arrives on
//                the LR row as supplierGstNo. */
//             "fillFrom": {
//               "endpoint": "/api/supplier",
//               "map": { "agentId": "agentId" }
//             }
//           },
//           {
//             "k": "vendorGstNo",
//             "label": "Vendor GST No",
//             "type": "text",
//             "readOnly": true,
//             "width": "full"
//           },
//           {
//             "k": "grcDate",
//             "label": "Transaction Date",
//             "type": "date",
//             "req": true,
//             "def": "today",
//             "width": "full"
//           },
//           {
//             /* NOT req. The invoice number is copied off the selected LR by
//                the server, and marking it required here made validate() reject
//                the form BEFORE the LR was ever read - so a GRC could not be
//                saved at all unless the operator retyped a number the system
//                already had, which is exactly what "Auto fetched from LR"
//                promises it will not ask for.

//                It is still mandatory, just enforced where the answer is known:
//                the POST fills it from the delivery and only complains if the
//                LR itself carries no invoice number. */
//             "k": "vendorDocNo",
//             "label": "Invoice Number",
//             "type": "text",
//             "width": "full"
//           },
//           {
//             "k": "vendorDocDate",
//             "label": "Invoice Date",
//             "type": "date",
//             "width": "full"
//           },
//           {
//             "k": "purchaseGroupId",
//             "label": "Purchase Group",
//             "type": "ref",
//             "ref": "purchasegroup"
//           },
//           {
//             "k": "occasion",
//             "label": "Occasion",
//             "type": "select",
//             "placeholder": "--Select--",
//             "opts": [
//               {
//                 "v": "Wedding",
//                 "l": "Wedding"
//               },
//               {
//                 "v": "Festival",
//                 "l": "Festival"
//               },
//               {
//                 "v": "Regular",
//                 "l": "Regular"
//               },
//               {
//                 "v": "Clearance",
//                 "l": "Clearance"
//               }
//             ]
//           },
//           {
//             "k": "agentId",
//             "label": "Agent",
//             "type": "ref",
//             "ref": "agent"
//           },
//           {
//             "k": "freightMode",
//             "layoutClass": "grc-bottom-freight",
//             "label": "Freight",
//             "type": "select",
//             "opts": [
//               { "v": "Before Tax", "l": "Before Tax" },
//               { "v": "After Tax", "l": "After Tax" },
//               { "v": "N/A", "l": "N/A" }
//             ],
//             "disabledWhen": { "freightMode": "N/A" },
//             "unlockable": true
//           },
//           {
//             "k": "stockPointId",
//             "layoutClass": "grc-bottom-stock-point",
//             "label": "Stock Point",
//             "type": "ref",
//             "ref": "stockpoint",
//             "defaultOptionLabel": "Warehouse",
//             "req": true
//           },
//           {
//             "k": "vendorInvoiceCopy",
//             "layoutClass": "grc-bottom-invoice-copy",
//             "label": "Vendor Invoice Copy",
//             "type": "file",
//             "info": true
//           },
//           {
//             "k": "vendorWaybill",
//             "layoutClass": "grc-bottom-waybill",
//             "label": "Vendor Waybill",
//             "type": "text",
//             "placeholder": "Enter waybill number or scan barcode"
//           },
//         ]
//       },
//       {
//         "type": "voucher",
//         "title": "Voucher Section",
//         "fields": [
//           { "k": "hsnCode", "label": "Enter HSN Code", "type": "text" },
//           { "k": "invoiceQty", "label": "Enter Invoice Qty", "type": "number" },
//           { "k": "taxableValue", "label": "Enter Taxable", "type": "number" },
//           { "k": "taxAmount", "label": "Tax Amount", "type": "number" },
//           { "k": "freightAmount", "label": "Freight", "type": "number" },
//           /* Round Off - the operator's signed adjustment to the final amount.
//              `header: true` marks it as one of the few Voucher Section columns
//              that is ALSO a GRC header path: the Edit screen's Net Purchases
//              Value reads data.roundOff off the header, so the save routes let
//              it through validate(). Every other column here is stored inside
//              voucherRows and deliberately dropped by them. */
//           { "k": "roundOff", "label": "Round Off", "type": "number", "header": true },
//           { "k": "totalAmount", "label": "Enter Total Amount", "type": "number" }
//         ]
//       }
//     ]
//   };

// export const SUPPLIER_QUICK_FIELDS = [
//   { "k": "typeId", "label": "Type", "type": "ref", "ref": "contact-type-supplier", "req": true },
//   { "k": "businessName", "label": "Business Name", "type": "text" },
//   { "k": "firstName", "label": "First Name", "type": "text", "req": true },
//   { "k": "billingMobile", "label": "Mobile", "type": "text", "req": true },
//   { "k": "gstNo", "label": "GST No", "type": "text" }
// ];


















/////suhas 


/* Card spec for the Add Goods Receipt Challan entry screen.
   Each source card carries the upstream resource's own endpoint. */

export const FORM = {
    "cards": [
      {
        "type": "source",
        "endpoint": "/api/delivery",
        "availableLr": true,
        "label": "LR / Transaction Number",
        "req": true,
        "sourceKey": "lrTransactionId",
        "sourceLabel": "transactionNo",
        "width": "full",
        /* LR dropdown loads ALL available LR/Delivery records without requiring 
           vendor selection first. The dropdown shows transaction number with 
           supplier info for context: "LR/26/011 | G524 | KARNATAKA Saree Centre" */
        "sourceSubLabel": ["supplier.contactId", "supplier.businessName"],
        /* Everything from the selected LR/Delivery is auto-populated onto the GRC.
           This includes the supplier, invoice details, freight, and transaction info. */
        "populate": {
          "supplierId": "supplierId",
          "vendorGstNo": "supplierGstNo",
          "vendorDocNo": "invPmNumber",
          "lrTransactionNo": "transactionNo",
          "freightAmount": "freightAmount"
        }
      },
      {
        "type": "fields",
        "gridClass": "grc-header-fields-grid",
        "fields": [
          {
            "k": "supplierId",
            "label": "Vendor Name",
            "type": "ref",
            "ref": "supplier",
            "req": true,
            "width": "full",
            "readOnly": true,
            /* A supplier carries its own agent - models/contactSchema.js
               declares `agentId: { ref: 'agent' }` with the comment "a
               supplier's agent", and the supplier master asks for it under
               Agent Setup -> Agent Name. So settling the vendor settles the
               Agent too, and the operator is not asked again for something
               the database already records.

               `fillFrom` reads it off the supplier record through set(), which
               already carries the request token that stops a slow lookup for a
               vendor chosen two changes ago from landing on the current one.
               A supplier with no agent yields '' (doc.agentId is null), which
               EMPTIES the box rather than leaving the previous vendor's agent
               standing - the only two states this field has.

               agentId is the single GRC header field the supplier master also
               holds; purchase group, occasion, freight and stock point have no
               supplier-level equivalent, and Vendor GST No already arrives on
               the LR row as supplierGstNo. */
            "fillFrom": {
              "endpoint": "/api/supplier",
              "map": { "agentId": "agentId" }
            }
          },
          {
            "k": "vendorGstNo",
            "label": "Vendor GST No",
            "type": "text",
            "readOnly": true,
            "width": "full"
          },
          {
            "k": "grcDate",
            "label": "Transaction Date",
            "type": "date",
            "req": true,
            "def": "today",
            "width": "full"
          },
          {
            /* NOT req. The invoice number is copied off the selected LR by
               the server, and marking it required here made validate() reject
               the form BEFORE the LR was ever read - so a GRC could not be
               saved at all unless the operator retyped a number the system
               already had, which is exactly what "Auto fetched from LR"
               promises it will not ask for.

               It is still mandatory, just enforced where the answer is known:
               the POST fills it from the delivery and only complains if the
               LR itself carries no invoice number. */
            "k": "vendorDocNo",
            "label": "Invoice Number",
            "type": "text",
            "width": "full"
          },
          {
            "k": "vendorDocDate",
            "label": "Invoice Date",
            "type": "date",
            "width": "full"
          },
          {
            "k": "purchaseGroupId",
            "label": "Purchase Group",
            "type": "ref",
            "ref": "purchasegroup"
          },
          {
            "k": "occasion",
            "label": "Occasion",
            "type": "select",
            "placeholder": "--Select--",
            "opts": [
              {
                "v": "Wedding",
                "l": "Wedding"
              },
              {
                "v": "Festival",
                "l": "Festival"
              },
              {
                "v": "Regular",
                "l": "Regular"
              },
              {
                "v": "Clearance",
                "l": "Clearance"
              }
            ]
          },
          {
            "k": "agentId",
            "label": "Agent",
            "type": "ref",
            "ref": "agent"
          },
          {
            "k": "freightMode",
            "layoutClass": "grc-bottom-freight",
            "label": "Freight",
            "type": "select",
            "opts": [
              { "v": "Before Tax", "l": "Before Tax" },
              { "v": "After Tax", "l": "After Tax" },
              { "v": "N/A", "l": "N/A" }
            ],
            "disabledWhen": { "freightMode": "N/A" },
            "unlockable": true
          },
          {
            "k": "stockPointId",
            "layoutClass": "grc-bottom-stock-point",
            "label": "Stock Point",
            "type": "ref",
            "ref": "stockpoint",
            "defaultOptionLabel": "Warehouse",
            /* Goods are received at the header LOCATION, so the stock point
               follows it: TransactionFormView selects the stock point whose
               locationId is the selected location, on load and on every
               header change. The dropdown stays open for picking another
               stock point of the same location. */
            "syncWithLocation": true,
            "req": true
          },
          {
            "k": "vendorInvoiceCopy",
            "layoutClass": "grc-bottom-invoice-copy",
            "label": "Vendor Invoice Copy",
            "type": "file",
            "info": true
          },
          {
            "k": "vendorWaybill",
            "layoutClass": "grc-bottom-waybill",
            "label": "Vendor Waybill",
            "type": "text",
            "placeholder": "Enter waybill number or scan barcode"
          },
        ]
      },
      {
        "type": "voucher",
        "title": "Voucher Section",
        "fields": [
          { "k": "hsnCode", "label": "Enter HSN Code", "type": "text" },
          { "k": "invoiceQty", "label": "Enter Invoice Qty", "type": "number" },
          { "k": "taxableValue", "label": "Enter Taxable", "type": "number" },
          { "k": "taxAmount", "label": "Tax Amount", "type": "number" },
          { "k": "freightAmount", "label": "Freight", "type": "number" },
          /* Round Off - the operator's signed adjustment to the final amount.
             `header: true` marks it as one of the few Voucher Section columns
             that is ALSO a GRC header path: the Edit screen's Net Purchases
             Value reads data.roundOff off the header, so the save routes let
             it through validate(). Every other column here is stored inside
             voucherRows and deliberately dropped by them. */
          { "k": "roundOff", "label": "Round Off", "type": "number", "header": true },
          { "k": "totalAmount", "label": "Enter Total Amount", "type": "number" }
        ]
      }
    ]
  };

export const SUPPLIER_QUICK_FIELDS = [
  { "k": "typeId", "label": "Type", "type": "ref", "ref": "contact-type-supplier", "req": true },
  { "k": "businessName", "label": "Business Name", "type": "text" },
  { "k": "firstName", "label": "First Name", "type": "text", "req": true },
  { "k": "billingMobile", "label": "Mobile", "type": "text", "req": true },
  { "k": "gstNo", "label": "GST No", "type": "text" }
];
