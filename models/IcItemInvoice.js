import mongoose from 'mongoose';

/* Inter Company SALES INVOICE, per SOLD ITEM (consignment billing).

   The flow it records: the sender ships goods on an IC Delivery Challan, the
   receiver approves them into stock and sells them at its POS, and only THEN
   does the sender invoice - for exactly the units the receiver has sold.
   Raised from Inter Company Sell > Sales Invoice, where the sender ticks
   sold-but-unbilled units on the Not Billed tab and saves.

   One invoice is sender -> ONE receiver. Each line is one sold barcode unit,
   priced from the challan line it shipped on, and the receiver-side barcode
   row is stamped icBilledId/icBilledNo (lib/barcodeLabel.js) so it moves to
   the Billed tab and can never be invoiced twice.

   NOT models/IcSalesInvoice.js: that older, hidden flow bills whole challans
   the moment they are raised, sold or not. The two shapes do not mix, so
   this one has its own collection.

   Collection name pinned lowercase - Mongoose would pluralise it otherwise
   and MongoDB collection names are case-sensitive. */

export const LABEL_FIELD = 'invoiceNo';

const IcItemInvoiceSchema = new mongoose.Schema(
  {
    /* the SENDER - the branch that shipped the goods and is now billing */
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'business', default: null, index: true },
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'companyLocation', default: null, index: true },
    finYear: { type: String, default: '', index: true },

    /* the RECEIVER being invoiced */
    toBusinessId: { type: mongoose.Schema.Types.ObjectId, ref: 'business', default: null, index: true },
    toLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'companyLocation', default: null },
    toBusinessName: { type: String, default: '' },

    invoiceNo: { type: String, default: '', index: true },
    invoiceDate: { type: Date, default: null },

    /* one line per sold unit:
       { barcodeId (receiver row), sourceBarcodeId, barcodeNo, dcId, dcNo,
         itemCode, itemName, hsn, uom, qty, unitRate, discountPct,
         roffDiscount, finalRate, beforeTax, igstPct, cgstPct, sgstPct,
         igstAmount, cgstAmount, sgstAmount, netAmount,
         posInvoiceNo, soldAt } */
    items: { type: mongoose.Schema.Types.Mixed, default: [] },

    totalQty: { type: Number, default: 0 },
    taxableValue: { type: Number, default: 0 },
    igstTotal: { type: Number, default: 0 },
    cgstTotal: { type: Number, default: 0 },
    sgstTotal: { type: Number, default: 0 },
    roundOff: { type: Number, default: 0 },
    netValue: { type: Number, default: 0 },

    createdBy: { type: String, default: '' },
  },
  { timestamps: true }
);

IcItemInvoiceSchema.index({ businessId: 1, createdAt: -1 });

export default mongoose.models.icItemInvoice ||
  mongoose.model('icItemInvoice', IcItemInvoiceSchema, 'iciteminvoice');
