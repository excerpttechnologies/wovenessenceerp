import mongoose from 'mongoose';

/* Pos
   Collection name pinned lowercase - Mongoose would pluralise it otherwise
   and MongoDB collection names are case-sensitive. */

export const LABEL_FIELD = 'invoiceNo';

const PosInvoiceSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'business', default: null, index: true },
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'companyLocation', default: null, index: true },
    finYear: { type: String, default: '', index: true },
    date: { type: Date, default: null },
    invoiceNo: { type: String, default: '' },
    counterId: { type: mongoose.Schema.Types.ObjectId, default: null },
    customerId: { type: mongoose.Schema.Types.ObjectId, default: null },
    customerContact: { type: String, default: '' },
    customerSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    exempted: { type: String, default: '' },
    billingType: { type: String, default: '' },
    paymentStatus: { type: String, default: '' },
    /* Shipping charge entered on the till. Part of totalAmount, but kept
       separately too so a bill can say WHY its total exceeds the goods. */
    shipping: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    paid: { type: Number, default: 0 },
    sellDue: { type: Number, default: 0 },
    payments: { type: mongoose.Schema.Types.Mixed, default: [] },

    /* LOYALTY POINTS on this bill. Declared here because Mongoose's strict
       mode silently DROPS anything that is not - documents written by an
       earlier deployment carry these three keys and this schema was throwing
       them away on every save.

       totalAmount is the goods, undiscounted. loyaltyAmount is what the
       redeemed points took off it, and is counted as a payment rather than as
       a discount - so a 1000 bill settled with 300 points stores
       totalAmount 1000, loyaltyAmount 300, and 700 left for the customer.
       The points themselves live in models/LoyaltyLedger.js; these are the
       bill's own record of what happened. */
    loyaltyPointsRedeemed: { type: Number, default: 0 },
    loyaltyPointsEarned: { type: Number, default: 0 },
    loyaltyAmount: { type: Number, default: 0 },
    sellNote: { type: String, default: '' },
    staffNote: { type: String, default: '' },

    /* line items are free-form per document type */
    items: { type: mongoose.Schema.Types.Mixed, default: [] },
  },
  { timestamps: true }
);

export default mongoose.models.posInvoice ||
  mongoose.model('posInvoice', PosInvoiceSchema, 'posinvoice');
