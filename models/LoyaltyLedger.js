import mongoose from 'mongoose';

/* Loyalty Points - the ledger.

   APPEND-ONLY, one row per movement, exactly like models/StockMovement.js is
   for stock. A customer's balance is the sum of their rows, never a number
   held on the customer record.

   That is deliberate. A single `points` field on the contact cannot answer
   "which points expire on Friday", cannot be audited when a figure looks
   wrong, and is the field two tills race each other to overwrite. Rows can
   only be added, so two counters serving the same customer at the same moment
   both write and neither loses.

   points is SIGNED: positive is earned, negative is spent. `kind` says which
   so a balance can be explained without inferring it from an arithmetic sign.

   Collection name pinned lowercase - Mongoose would pluralise it otherwise
   and MongoDB collection names are case-sensitive. */

export const LOYALTY_KIND = {
  EARN: 'EARN',
  REDEEM: 'REDEEM',
  /* points handed back when the sale that earned them is returned */
  REVERSAL: 'REVERSAL',
};

const LoyaltyLedgerSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'business', default: null, index: true },
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'companyLocation', default: null },
    /* Points belong to a NAMED customer. A walk-in has nobody to credit, so
       no row is ever written for one - see lib/loyalty.js. */
    customerId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },

    kind: { type: String, default: LOYALTY_KIND.EARN },
    points: { type: Number, default: 0 },

    /* what the movement was worth in rupees: the bill for an EARN, the
       discount taken for a REDEEM. Stored rather than recomputed because the
       conversion rate in the master can be edited later, and an old row must
       keep saying what actually happened. */
    amount: { type: Number, default: 0 },

    /* EARN only. Null when the master says 0 days, which means no expiry. */
    expiresAt: { type: Date, default: null },

    invoiceId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    invoiceNo: { type: String, default: '' },
    note: { type: String, default: '' },
    createdBy: { type: String, default: '' },
  },
  { timestamps: true }
);

/* The one query this collection exists to answer: everything for this
   customer in this business, oldest first, so lots expire in the order they
   were earned. */
LoyaltyLedgerSchema.index({ businessId: 1, customerId: 1, createdAt: 1 });

export default mongoose.models.loyaltyLedger ||
  mongoose.model('loyaltyLedger', LoyaltyLedgerSchema, 'loyaltyledger');
