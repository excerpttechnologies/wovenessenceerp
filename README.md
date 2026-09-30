# Retail ERP (GROO / Orbit ERP clone)

Next.js 15 + MongoDB ERP for a multi-branch textile retail business:
purchase (GRC / barcodes), POS selling, stock transfers, inter company
sell with consignment billing, reports, vouchers.

The day-by-day log of every changed file lives in [change.md](change.md).

## Latest changes - 30-09-2026

### NEW

- lib/shareRoutes.js
- models/IcItemInvoice.js
- app/api/ic-item-invoice/route.js
- app/admin/transaction/intercompanysell/sales-invoice/page.jsx

### EXISTING

- app/admin/transaction/sell/pos/page.jsx
- app/admin/transaction/sell/pos/print/[id]/page.jsx
- app/admin/transaction/sell/pos-return/add/page.jsx
- app/api/sell-pos/[id]/route.js
- app/api/sell-pos/route.js
- components/PosTill.jsx
- components/PosReturnForm.jsx
- components/PosInvoiceView.jsx
- components/ShareDocDialog.jsx
- components/ListView.jsx
- components/Icon.jsx
- components/MultiplePayDialog.jsx
- lib/barcodeLabel.js
- lib/screenPermission.js
- lib/loyalty.js
- config/nav.js
- app/admin/setting/loyaltypoint/fields.js
- models/LoyaltyPoint.js
- app/api/loyalty/route.js
