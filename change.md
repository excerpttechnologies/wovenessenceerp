# Changes

## 30-09-2026

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
- lib/barcodeLabel.js
- lib/screenPermission.js
- config/nav.js
- components/MultiplePayDialog.jsx
- app/admin/setting/loyaltypoint/fields.js
- models/LoyaltyPoint.js
- lib/loyalty.js
- app/api/loyalty/route.js

## 29-09-2026

### NEW

- components/PosInvoiceView.jsx
- components/PosPaymentsView.jsx

### EXISTING

- app/admin/pos/add/page.jsx
- app/admin/transaction/sell/pos/page.jsx
- app/admin/transaction/sell/pos/payment/[id]/page.jsx
- app/admin/transaction/sell/pos/print/[id]/page.jsx
- app/admin/transaction/sell/pos/view/[id]/page.jsx
- app/api/sell-pos/route.js
- app/api/sell-pos/[id]/route.js
- app/api/sell-pos-return/lookup/route.js
- components/PosTill.jsx
- components/PosReturnForm.jsx
- components/MultiplePayDialog.jsx
- components/ShareDocDialog.jsx
- components/ListView.jsx
- components/Icon.jsx
- lib/format.js
- lib/inventory.js

## 28-09-2026

### NEW

- models/LoyaltyLedger.js
- lib/loyalty.js
- app/api/loyalty/route.js
- components/StockAdjustmentView.jsx

### EXISTING

- components/PosTill.jsx
- app/api/sell-pos/route.js
- models/PosInvoice.js
- app/admin/transaction/sell/pos/page.jsx
- app/admin/inventory/stock-adjustment/page.jsx
- components/ListView.jsx
- components/Toolbar.jsx
- components/Icon.jsx
- components/SupplierImportPanel.jsx
- lib/format.js

## 26-09-2026

### EXISTING

- app/admin/transaction/intercompanysell/receivedeliverychallan/page.jsx
- app/api/ic-delivery-challan/route.js
- components/IcChallanForm.jsx
- app/admin/transaction/intercompanysell/deliverychallan/page.jsx
- components/ListView.jsx
- components/PosTill.jsx
- app/globals.css
- tailwind.config.js

## 25-09-2026

### EXISTING

- lib/screenPermission.js
- app/api/doc-setup/route.js
- app/api/doc-setup/[id]/route.js
- app/api/purchase-group/route.js
- app/api/purchase-group/[id]/route.js
- app/api/stock-point/route.js
- app/api/stock-point/[id]/route.js
- app/api/pos-counter/route.js
- app/api/pos-counter/[id]/route.js
- app/api/barcode-setting/route.js
- app/api/barcode-setting/[id]/route.js
- app/api/split-barcode-setting/route.js
- app/api/split-barcode-setting/[id]/route.js
- components/BarcodeSettingsView.jsx
- app/api/barcode-label-setting/route.js
- app/api/purchase-rate-code/route.js
- app/api/payment-method/route.js
- app/api/payment-method/[id]/route.js
- components/ChoiceTableView.jsx
- app/admin/setting/purchase-rate-code/page.jsx
- app/api/tax/route.js
- app/api/tax/[id]/route.js
- app/api/hsn/route.js
- app/api/hsn/[id]/route.js
- app/api/city-group/route.js
- app/api/city-group/[id]/route.js
- app/api/purchase-charge/route.js
- app/api/purchase-charge/[id]/route.js
- app/api/purchase-term/route.js
- app/api/purchase-term/[id]/route.js
- app/api/sales-term/route.js
- app/api/sales-term/[id]/route.js
- app/api/loyalty-point/route.js
- app/api/login-security/route.js
- app/api/pos-setting/route.js
- components/SingleFormView.jsx
- app/api/ecom-setting/route.js
- app/api/location-setting/route.js
- app/api/invoice-layout-setting/route.js
- app/api/business-contact/route.js
- components/PosTill.jsx

## 24-09-2026

### NEW

- app/api/my-permissions/route.js

### EXISTING

- components/IcChallanPrintView.jsx
- components/ScopeContext.jsx
- components/ListView.jsx
- components/Toolbar.jsx
- components/TabbedFormView.jsx
- components/FormView.jsx
- lib/screenPermission.js
- app/api/customer/route.js
- app/api/customer/[id]/route.js
- app/api/customer/[id]/history/route.js
- app/admin/contact/customer/page.jsx
- app/admin/staff-management/roles-permissions/page.jsx
- app/api/product-filter/route.js
- app/api/product-filter/[id]/route.js
- app/api/product-group/route.js
- app/api/product-group/[id]/route.js
- app/api/uom/route.js
- app/api/uom/[id]/route.js
- app/api/attribute-addon/route.js
- app/api/attribute-addon/[id]/route.js
- app/api/item/route.js
- app/api/item/[id]/route.js
- app/api/item/[id]/detail/route.js
- app/api/barcode-generation/route.js
- app/api/inventory-barcode-list/route.js
- app/api/sell-deliverychallan/route.js
- app/api/sell-deliverychallan/[id]/route.js
- app/api/sell-pos/route.js
- app/api/sell-pos/[id]/route.js
- app/api/sell-pos/recent/route.js
- app/api/pos-hold/route.js
- app/api/pos-hold/[id]/route.js
- app/api/sell-pos-return/route.js
- app/api/sell-pos-return/[id]/route.js
- app/api/sell-pos-return/lookup/route.js
- app/api/business/route.js
- app/api/business/[id]/route.js
- app/api/company-location/route.js
- app/api/company-location/[id]/route.js
- app/api/transporter/route.js
- app/api/transporter/[id]/route.js
- app/api/ledger-group/route.js
- app/api/ledger-group/[id]/route.js
- app/api/ledger/route.js
- app/api/ledger/[id]/route.js
- app/api/ledger-group-mapping/route.js
- app/api/voucher-setting/route.js
- components/MappingView.jsx
- components/VoucherSettingsView.jsx
- app/api/stock-adjustment/route.js
- app/api/stock-adjustment/[id]/route.js

## 23-09-2026

### NEW

- app/admin/staff-management/roles-permissions/fields.js
- app/admin/staff-management/roles-permissions/page.jsx
- models/RolePermission.js
- app/api/role-permission/route.js
- models/Role.js
- app/api/role/route.js
- app/api/role/[id]/route.js
- lib/screenPermission.js

### EXISTING

- config/nav.js
- app/api/user/route.js
- app/api/user/[id]/route.js
- app/api/ic-delivery-challan/route.js
- app/api/ic-delivery-challan/[id]/route.js
- app/api/ic-receive-delivery-challan/route.js
- app/api/contact-type/route.js
- app/api/contact-type/[id]/route.js
- app/api/supplier/route.js
- app/api/supplier/[id]/route.js
- app/api/agent/route.js
- app/api/agent/[id]/route.js

## 22-09-2026

### NEW

- lib/icReceive.js
- scripts/receivePendingIcChallans.mjs
- change.md

### EXISTING

- app/api/ic-delivery-challan/route.js
- app/api/ic-receive-delivery-challan/route.js
- app/admin/transaction/intercompanysell/receivedeliverychallan/page.jsx
- package.json
