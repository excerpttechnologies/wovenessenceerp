import mongoose from 'mongoose';

/* Loyalty Point
   Collection name is pinned lowercase: Mongoose would pluralise it
   otherwise, and MongoDB collection names are case-sensitive. */

export const LABEL_FIELD = 'name';

const LoyaltyPointSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'business', default: null, index: true },
    active: { type: String, default: "Yes" },
    loyaltyPointName: { type: String, default: '' },
    pointsToInr: { type: Number, default: 0 },
    /* THE EARNING MODEL since 30-09-2026: one point per every this-many
       rupees of purchase (25 -> a 100 bill earns 4). 0 = earns nothing.
       Replaces earningPercentage on the screen; that field stays below so a
       config saved before the change keeps working until re-saved. */
    purchaseAmountForOnePoint: { type: Number, default: 0 },
    /* months - the master's "Points expire after" dropdown */
    pointsExpireAfter: { type: Number, default: 0 },
    earningPercentage: { type: Number, default: 0 },
    minPurchaseAmount: { type: Number, default: 0 },
    maxRewardPoint: { type: Number, default: 0 },
    expiryPeriod: { type: Number, default: 0 },
    ledgerId: { type: mongoose.Schema.Types.ObjectId, ref: 'ledger', default: null },
    minRedemptionPoints: { type: Number, default: 0 },
    maxRedemptionPoints: { type: Number, default: 0 },
    minAmountForRedemption: { type: Number, default: 0 },
    redemptionType: { type: String, default: "Gateway" },
    otpRequired: { type: String, default: "No" },
  },
  { timestamps: true }
);

export default mongoose.models.loyaltyPoint ||
  mongoose.model('loyaltyPoint', LoyaltyPointSchema, 'loyaltypoint');
