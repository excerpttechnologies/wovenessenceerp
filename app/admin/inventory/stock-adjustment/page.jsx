'use client';
import ListView from '@/components/ListView';
import StockAdjustmentView from '@/components/StockAdjustmentView';

/* Stock Adjustments - list. Columns declared here, not fetched from a registry. */

const CONFIG = {
  title: "Stock Adjustments",
  basePath: '/admin/inventory/',
  slugPath: "stock-adjustment",
  endpoint: '/api/stock-adjustment',
  scope: ["business","location","finYear"],
  addTitle: "Stock Adjustment",
  actionIcons: ["view"],
  /* The eye opens a popup instead of navigating to the [id] page - an
     adjustment is read, not edited, and the list is where the operator is
     working. See the viewModalRender note in components/ListView.jsx. */
  viewModalRender: (row, labels, close) => (
    <StockAdjustmentView row={row} labels={labels} onClose={close} />
  ),
  columns: [
    { k: "adjustmentNo", t: "Adjustment No" },
    { k: "type", t: "Type" },
    { k: "createdAt", t: "Creadted On", f: "date" },
    { k: "adjustmentReason", t: "Reason" },
    { k: "createdBy", t: "Created By" },
  ],
};

export default function StockadjustmentListPage() {
  return <ListView cfg={CONFIG} />;
}
