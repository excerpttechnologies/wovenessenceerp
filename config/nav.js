import {
  LuGauge,
  LuSettings,
  LuBuilding2,
  LuMapPin,
  LuLayers3,
  LuBookOpen,
  LuGitBranch,
  LuSlidersHorizontal,
  LuFileCog,
  LuShoppingBag,
  LuWarehouse,
  LuMonitor,
  LuBarcode,
  LuBinary,
  LuSplit,
  LuTag,
  LuCreditCard,
  LuPercent,
  LuReceipt,
  LuMap,
  LuBadgeIndianRupee,
  LuFileText,
  LuHeart,
  LuShieldCheck,
  LuMonitorCog,
  LuShoppingCart,
  LuPanelTop,
  LuMapPinned,
  LuContact,
  LuGrid3X3,
  LuFilter,
  LuPackage,
  LuRuler,
  LuPuzzle,
  LuBox,
  LuPrinter,
  LuScanBarcode,
  LuClipboardList,
  LuUsers,
  LuUserCog,
  LuTruck,
  LuUserRound,
  LuContactRound,
  LuShoppingBasket,
  LuUndo2,
  LuFileMinus,
  LuFilePlus,
  LuShuffle,
  LuHouse,
  LuChartNoAxesColumn,
  LuMail,
  LuWrench,
  LuCircleDollarSign,
  LuFileCheck,
  LuBookMarked,
  LuStore,
  LuShoppingBag as LuEcommerce,
  LuWalletCards,
  LuLogOut,
  LuBus,
  LuIdCard,
  LuRoute,
  LuSend,
  LuPackageCheck,
  LuPackageMinus,
} from 'react-icons/lu';
 
export const NAV = [
 
  {
    label: 'Dashboard',
    icon: LuGauge,
    href: '/admin',
  },
 
  {
    label: 'Masters',
    icon: LuSettings,
    children: [
      /* Accounts, roles and the locations each may work at. This is what
         makes the permission model in lib/rbac.js configurable - without it
         every account stays unrestricted. */
      {
        label: 'Users & Permissions',
        icon: LuUsers,
        href: '/admin/setting/users',
      },
      {
        label: 'Business Masters',
        icon: LuBuilding2,
        href: '/admin/setting/business',
      },
      {
        label: 'Company Locations',
        icon: LuMapPin,
        href: '/admin/setting/companylocations',
      },
      {
        label: 'Transport Master',
        icon: LuTruck,
        href: '/admin/transport/transporter',
      },
      {
        label: 'Ledger Group',
        icon: LuLayers3,
        href: '/admin/setting/ledgergroups',
      },
      {
        label: 'Ledger',
        icon: LuBookOpen,
        href: '/admin/setting/ledger',
      },
      {
        label: 'Ledger Mapping',
        icon: LuGitBranch,
        href: '/admin/setting/ledgergroupmapping',
      },
      {
        label: 'Voucher Settings',
        icon: LuSlidersHorizontal,
        href: '/admin/setting/voucher-setting',
      },
      {
        label: 'Doc Setup',
        icon: LuFileCog,
        href: '/admin/setting/docsetup',
      },
      {
        label: 'Purchase Group Master',
        icon: LuShoppingBag,
        href: '/admin/setting/purchasegroup',
      },
      {
        label: 'Stock Point Master',
        icon: LuWarehouse,
        href: '/admin/setting/stockpoint',
      },
      {
        /* Named to match the POS field it fills ("Select Cash Counter").
           It was "Pos Counter Master", which did not read as the same thing. */
        label: 'Cash Counter Master',
        icon: LuMonitor,
        href: '/admin/setting/poscounter',
      },
      {
        label: 'Barcode Settings',
        icon: LuBarcode,
        href: '/admin/setting/barcodesetting',
      },
      {
        label: 'Split Barcode Settings',
        icon: LuSplit,
        href: '/admin/setting/split-barcode-setting',
      },
      {
        label: 'Barcode Label Settings',
        icon: LuTag,
        href: '/admin/setting/barcode-label-setting',
      },
      /* The digit -> letter code a purchase rate is printed in on a label
         (lib/purchaseRateCode.js). The page was built but had no menu entry,
         so it could only be reached by typing its URL. */
      {
        label: 'Purchase Rate Code Master',
        icon: LuBinary,
        href: '/admin/setting/purchase-rate-code',
      },
      {
        label: 'Payment Method Master',
        icon: LuCreditCard,
        href: '/admin/setting/paymentmethod',
      },
      {
        label: 'Tax Master',
        icon: LuPercent,
        href: '/admin/setting/tax',
      },
      {
        label: 'HSN Master',
        icon: LuReceipt,
        href: '/admin/setting/hsn',
      },
      {
        label: 'City Group Master',
        icon: LuMap,
        href: '/admin/setting/citygroup',
      },
      {
        label: 'Purchase Charge Master',
        icon: LuBadgeIndianRupee,
        href: '/admin/setting/purchase/master/charge',
      },
      {
        label: 'Purchase Term Master',
        icon: LuFileText,
        href: '/admin/setting/purchase/master/term',
      },
      {
        label: 'Sales Term Master',
        icon: LuFileText,
        href: '/admin/setting/sales/master/term',
      },
      {
        label: 'Loyalty Point',
        icon: LuHeart,
        href: '/admin/setting/loyaltypoint',
      },
      {
        label: 'Login Security',
        icon: LuShieldCheck,
        href: '/admin/setting/login-security',
      },
      {
        label: 'Pos Settings',
        icon: LuMonitorCog,
        href: '/admin/setting/pos_setting',
      },
      {
        label: 'Ecom Settings',
        icon: LuShoppingCart,
        href: '/admin/setting/ecom_setting',
      },
      {
        label: 'Invoice Layout Setting',
        icon: LuPanelTop,
        href: '/admin/setting/invoice-layout-setting',
      },
      {
        label: 'General Setting (Location)',
        icon: LuMapPinned,
        href: '/admin/setting/location-setting',
      },
      {
        label: 'Business Contact',
        icon: LuContact,
        href: '/admin/setting/business-contact',
      },
    ],
  },
 
  {
    label: 'Inventory',
    icon: LuGrid3X3,
    children: [
      {
        label: 'Filter',
        icon: LuFilter,
        href: '/admin/inventory/product/filter',
      },
      {
        label: 'Group',
        icon: LuLayers3,
        href: '/admin/inventory/product/group',
      },
      {
        label: 'Unit of Measurement',
        icon: LuRuler,
        href: '/admin/inventory/uom',
      },
      {
        label: 'Attribute Addons',
        icon: LuPuzzle,
        href: '/admin/inventory/attribute-addon',
      },
      {
        label: 'Item',
        icon: LuBox,
        href: '/admin/inventory/item',
      },
      {
        label: 'Print Label',
        icon: LuPrinter,
        href: '/admin/inventory/barcode-print',
      },
      {
        label: 'Barcode Item',
        icon: LuScanBarcode,
        href: '/admin/inventory/barcodeitem',
      },
      {
        label: 'Stock Adjustment',
        icon: LuClipboardList,
        href: '/admin/inventory/stock-adjustment',
      },
    ],
  },
 
  {
    label: 'Contacts',
    icon: LuUsers,
    children: [
      {
        label: 'Contact Types',
        icon: LuContactRound,
        href: '/admin/contact/contact-type',
      },
      {
        label: 'Suppliers',
        icon: LuTruck,
        href: '/admin/contact/supplier',
      },
      {
        label: 'Agents',
        icon: LuUserCog,
        href: '/admin/contact/agent',
      },
      {
        label: 'Customers',
        icon: LuUserRound,
        href: '/admin/contact/customer',
      },
    ],
  },
 
 
  {
    label: 'Logistic',
    icon: LuTruck,
    href: '/admin/logistic',
  },
 
 
  {
    label: 'Transportation',
    icon: LuTruck,
    children: [
      
      
      {
        label: 'Vehicle Master',
        icon: LuBus,
        href: '/admin/transport/vehicle',
      },
      {
        label: 'Driver Master',
        icon: LuIdCard,
        href: '/admin/transport/driver',
      },
      {
        label: 'Route Master',
        icon: LuRoute,
        href: '/admin/transport/route',
      },
      {
        label: 'Dispatch',
        icon: LuSend,
        href: '/admin/transport/dispatch',
      },
    ],
  },
 
  {
    label: 'Purchase',
    icon: LuShoppingBasket,
    children: [
       {
        label: 'Goods Received',
        icon: LuPackageCheck,
        href: '/admin/transport/delivery',
      },
      {
        label: 'Goods Receipt Challan',
        icon: LuFileCheck,
        href: '/admin/transaction/purchase/grc',
      },
      // {
      //   label: 'Purchase Invoice',
      //   icon: LuFileText,
      //   href: '/admin/transaction/purchase/invoice',
      // },
      {
        label: 'Goods Return Note',
        icon: LuUndo2,
        href: '/admin/transaction/purchase/grt',
      },
      // {
      //   label: 'Debit Note',
      //   icon: LuFileMinus,
      //   href: '/admin/transaction/purchase/debitnote',
      // },
     
    ],
  },
 
 
  {
    label: 'Sell',
    icon: LuShoppingBag,
    children: [
      /* Re-enabled: this module now has a printed challan with the
         Qty / PC / MTR summary and the detailed / non-detailed formats.
         It was list-and-edit only before, with no way to print the
         document the goods travel with. */
      {
        label: 'Delivery Challan',
        icon: LuFileCheck,
        href: '/admin/transaction/sell/deliverychallan',
      },
      // {
      //   label: 'Sales Invoice',
      //   icon: LuFileText,
      //   href: '/admin/transaction/sell/salesinvoice',
      // },
      // {
      //   label: 'Sales Return',
      //   icon: LuUndo2,
      //   href: '/admin/transaction/sell/salereturn',
      // },
      // {
      //   label: 'Credit Note',
      //   icon: LuFilePlus,
      //   href: '/admin/transaction/sell/creditnote',
      // },
      {
        label: 'POS',
        icon: LuMonitor,
        href: '/admin/transaction/sell/pos',
      },
      /* Re-enabled: the return/refund flow is implemented end to end and
         puts stock back. It was an empty stub before, which is presumably
         why it was hidden. */
      {
        label: 'POS Return',
        icon: LuUndo2,
        href: '/admin/transaction/sell/pos-return',
      },
      // {
      //   label: 'B2B Invoice',
      //   icon: LuFileText,
      //   href: '/admin/transaction/sell/b2binvoice',
      // },
    ],
  },
 
  {
    label: 'Stock Transfers',
    icon: LuShuffle,
    children: [
      /* The barcode-driven transfer: scan out, receive in, return, bill.
         This is the one that moves stock. The three Packet/Location/Received
         screens below it are the earlier document flow and are kept for the
         records already raised on them. */
      { label: 'Stock Transfer', icon: LuShuffle,
        href: '/admin/transaction/stocktransfers/transfer' },
      { label: 'Incoming Transfers', icon: LuPackageCheck,
        href: '/admin/transaction/stocktransfers/incoming' },

      { label: 'Transfer Stock Packet', icon: LuPackage,
        href: '/admin/transaction/stocktransfers/transferstockpacket' },
      { label: 'Transfer Stock Location', icon: LuMapPinned,
        href: '/admin/transaction/stocktransfers/transferstocklocation' },
      { label: 'Transfer Stock Received', icon: LuPackageCheck,
        href: '/admin/transaction/stocktransfers/transferstockreceiveds' },
    ],
  },
  // {
  //   label: 'Inter Company Sell',
  //   icon: LuHouse,
  //   children: [
  //     { label: 'Delivery Challan', icon: LuFileCheck,
  //       href: '/admin/transaction/intercompanysell/deliverychallan' },
  //     { label: 'Sales Invoice', icon: LuFileText,
  //       href: '/admin/transaction/intercompanysell/salesinvoice' },
  //     { label: 'Auto Purchases Received', icon: LuPackageCheck,
  //       href: '/admin/transaction/intercompanysell/auto-purchases-received' },
  //     { label: 'Auto Purchases Return', icon: LuPackageMinus,
  //       href: '/admin/transaction/intercompanysell/auto-purchases-return' },
  //     { label: 'Sales Return', icon: LuUndo2,
  //       href: '/admin/transaction/intercompanysell/salereturn' },
  //   ],
  // },


   {
    label: 'Inter Company Sell',
    icon: LuHouse,
    children: [
      { label: 'Delivery Challan', icon: LuFileCheck,
        href: '/admin/transaction/intercompanysell/deliverychallan' },
      { label: 'Receive Delivery Challan', icon: LuPackageCheck,
        href: '/admin/transaction/intercompanysell/receivedeliverychallan' },
      // { label: 'Sales Invoice', icon: LuFileText,
      //   href: '/admin/transaction/intercompanysell/salesinvoice' },
      // { label: 'Auto Purchases Received', icon: LuPackageCheck,
      //   href: '/admin/transaction/intercompanysell/auto-purchases-received' },
      // { label: 'Auto Purchases Return', icon: LuPackageMinus,
      //   href: '/admin/transaction/intercompanysell/auto-purchases-return' },
      // { label: 'Sales Return', icon: LuUndo2,
      //   href: '/admin/transaction/intercompanysell/salereturn' },
    ],
  },

  /* A TOP-LEVEL group of its own, between Inter Company Sell and Reports, so
     the hierarchy is exactly:  Main Reports > Master Stock Report  - with no
     intermediate menu. It is deliberately NOT a child of Reports, and the
     entry is not repeated there, so one route has one place in the nav.
     components/Sidebar.jsx expands whichever group owns the current path
     (its useEffect on pathname), so a direct URL or a refresh opens this
     group and highlights the child without any change to that component. */
  {
    label: 'Main Reports',
    icon: LuChartNoAxesColumn,
    children: [
      { label: 'Master Stock Report', icon: LuWarehouse,
        href: '/admin/report/master-stock-report' },
      /* Sits with Master Stock Report rather than in the Reports list below,
         because that is where it is reached from: every barcode number on the
         Master Stock Report links straight into it. The href is unchanged, so
         any permission already saved against it still applies. */
      { label: 'Barcode Report', icon: LuBarcode,
        href: '/admin/reports/barcode-report' },
    ],
  },

  {
    label: 'Reports',
    icon: LuChartNoAxesColumn,
    children: [
      { label: 'Receipt Voucher Report', icon: LuBadgeIndianRupee,
        href: '/admin/reports/receipt-voucher-report' },
      { label: 'Payment Voucher Report', icon: LuWalletCards,
        href: '/admin/reports/payment-voucher-report' },
      { label: 'Sales Analysis', icon: LuChartNoAxesColumn,
        href: '/admin/reports/sales-analysis' },
      { label: 'Sales Report', icon: LuFileText,
        href: '/admin/reports/sales-report' },
      { label: 'Sales Person', icon: LuUserRound,
        href: '/admin/reports/sales-person' },
      { label: 'POS Summary', icon: LuMonitor,
        href: '/admin/reports/pos-summary' },
      { label: 'POS Report', icon: LuStore,
        href: '/admin/reports/pos-report' },
      { label: 'POS Credit Note', icon: LuFileMinus,
        href: '/admin/reports/pos-credit-note' },
      { label: 'Item Stock', icon: LuWarehouse,
        href: '/admin/reports/item-stock' },
      /* Daily stock transactions from the movement ledger - received,
         transferred, returned, sold - by day, type, location, barcode
         and document. */
      { label: 'Stock Movement', icon: LuShuffle,
        href: '/admin/reports/stock-movement' },
      { label: 'Supplier Bill Report', icon: LuReceipt,
        href: '/admin/reports/supplier-bill' },
      { label: 'Supplier Outstanding Report', icon: LuCreditCard,
        href: '/admin/reports/supplier-outstanding' },
      { label: 'Customer Outstanding Report', icon: LuContactRound,
        href: '/admin/reports/customer-outstanding' },
    ],
  },



  {
    label: 'Staff Management',
    icon: LuUsers,
    children: [
      {
        label: 'Roles & Permissions',
        icon: LuShieldCheck,
        href: '/admin/staff-management/roles-permissions',
      },
      /* Staffs still has no screen - kept commented rather than shipped as a
         dead link, the same call the E-commerce block's Orders and Coupons
         entries got. */
      // {
      //   label: 'Staffs',
      //   icon: LuUsers,
      //   href: '/admin/staff-management/staff',
      // },
      {
        label: 'Sales Persons',
        icon: LuUserRound,
        href: '/admin/staff-management/staff/salesperson',
      },
    ],
  },
  
 
  // {
  //   label: 'Stock Transfers',
  //   icon: LuShuffle,
  //   children: [],
  // },
 
  // {
  //   label: 'Inter Company Sell',
  //   icon: LuHouse,
  //   children: [],
  // },
 
  // {
  //   label: 'Communication',
  //   icon: LuMail,
  //   children: [],
  // },
 
  // {
  //   label: 'Tools',
  //   icon: LuWrench,
  //   children: [],
  // },
 
  // {
  //   label: 'Cash Register',
  //   icon: LuCircleDollarSign,
  //   children: [],
  // },
 
  // {
  //   label: 'Voucher',
  //   icon: LuFileCheck,
  //   children: [],
  // },
 
  // {
  //   label: 'Ledger Transaction',
  //   icon: LuBookMarked,
  //   children: [],
  // },
 
  // {
  //   label: 'Accounts',
  //   icon: LuWalletCards,
  //   children: [],
  // },
 
  {
    label: 'Cash Register',
    icon: LuCircleDollarSign,
    children: [
      { label: 'Cash Registers', icon: LuCircleDollarSign, href: '/admin/cashregister' },
      { label: 'Open Register', icon: LuFileCheck, href: '/admin/cashregister/open' },
    ],
  },

  {
    label: 'Voucher',
    icon: LuFileCheck,
    children: [
      { label: 'Receipt Vouchers', icon: LuBadgeIndianRupee, href: '/admin/voucher/receipt-vouchers' },
      { label: 'Contra Vouchers', icon: LuShuffle, href: '/admin/voucher/contra-vouchers' },
      { label: 'Payment Vouchers', icon: LuWalletCards, href: '/admin/voucher/payment-vouchers' },
    ],
  },

  {
    label: 'Ledger Transaction',
    icon: LuBookMarked,
    href: '/admin/ledger-transaction',
  },

  {
    label: 'E-commerce',
    icon: LuShoppingCart,
    children: [
      { label: 'Products', icon: LuTag, href: '/admin/ecommerce/product' },
      /* The same transfer engine as Stock Transfers, raised from the
         e-commerce side - not a separate inventory path. */
      { label: 'Direct Stock Transfer', icon: LuShuffle,
        href: '/admin/ecommerce/direct-stock-transfer' },
      /* Orders and Coupons are on the deployed sidebar but have no screen
         here yet. Left out rather than shipped as dead links - the same call
         Staff Management's three entries got. */
    ],
  },

  {
    label: 'Logout',
    icon: LuLogOut,
    href: '/logout',
  },
 
];