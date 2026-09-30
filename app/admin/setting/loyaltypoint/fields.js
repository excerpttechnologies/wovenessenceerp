/* Form fields for Loyalty Point.
   Lives beside the pages that use it - not in a global registry.

   CUT DOWN TO SIX FIELDS on 30-09-2026, to the client's mock: Active, the
   scheme's name, what a point is worth, how much purchase earns one point,
   when points expire, and whether redemption wants an OTP. The earlier
   percentage / min / max / ledger fields are gone from the SCREEN; values
   already saved under them stay on the document untouched, and
   lib/loyalty.js still honours a percentage-era config that has never been
   re-saved.

   EARNING under this model: one point for every full "purchase amount for
   1 point" rupees on the bill - 25 here means a 100 bill earns 4 points.
   0 = the scheme redeems old points but earns none. */

const MONTH_OPTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24]
  .map((m) => ({ v: String(m), l: m + (m === 1 ? ' Month' : ' Months') }));

export const SECTIONS = [
  {
    title: "",
    fields: [
      { k: "active", label: "Active :", type: "radio", def: "Yes", opts: [{ v: "Yes", l: "Yes" }, { v: "No", l: "No" }] },
      { k: "loyaltyPointName", label: "Loyalty point name", type: "text", req: true },
      { k: "pointsToInr", label: "Points to INR (1 Point = ? INR)", type: "number", req: true, def: 0 },
      { k: "purchaseAmountForOnePoint", label: "Purchase amount for 1 point [0 = No Points]", type: "number", req: true, def: 0 },
      { k: "pointsExpireAfter", label: "Points expire after", type: "select", req: true, def: "12", opts: MONTH_OPTS },
      { k: "otpRequired", label: "OTP required for redemption", type: "select", req: true, def: "No", opts: [{ v: "Yes", l: "Yes" }, { v: "No", l: "No" }] },
    ],
  },
];

/* What /api/loyalty-point validates and stores - every field across the
   sections, flattened. Derived rather than declared so the two can never
   drift: this page renders SECTIONS, and anything rendered has to be
   saveable. */
export const FIELDS = SECTIONS.flatMap((s) => s.fields || []);
