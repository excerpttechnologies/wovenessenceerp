'use client';
import ListView from '@/components/Listviewgrt';
import { fmt } from '@/lib/format';

/* Goods Return Notes - list. Columns declared here, not fetched from a registry. */

const CONFIG = {
  title: "Goods Return Notes",
  basePath: '/admin/',
  slugPath: "transaction/purchase/grt",
  endpoint: '/api/purchase-grt',
  scope: ["business","location","finYear"],
  actionIcons: ["view", "edit", "upload", "share"],
  viewModal: true,
  /* Share -> WhatsApp / Email / Download / Print, for the row the button sits
     on. Every value below is read off THAT row: nothing is hardcoded, and the
     labels map resolves the vendor the same way the list's own column does. */
  share: {
    heading: "Share GRT",
    fileName: (row) => "GRT-" + (row.grtNo || row._id),
    recordLabel: (row) => "GRT No: " + (row.grtNo || "-"),
    subject: (row) => "GRT - " + (row.grtNo || ""),
    /* Every figure goes through lib/format.js fmt - the SAME formatter the
       list's own columns use - so the shared message reads exactly like the
       screen it came from: dd-mm-yyyy dates and two-decimal money, never a
       raw float or a second date convention. */
    lines: (row, labels) => {
      const date = fmt("date", row.grtDate);
      return [
        "GRT No: " + (row.grtNo || "-"),
        date ? "GRT Date: " + date : "",
        "Vendor: " + ((labels || {})[String(row.supplierId)] || row.supplierName || "-"),
        "GRC No: " + (row.grcNumber || "-"),
        "Total Qty: " + fmt("amount", row.qty ?? 0),
        "Items: " + (row.itemCount ?? (Array.isArray(row.items) ? row.items.length : 0)),
        "Net Amount: " + fmt("amount", row.netAmount ?? 0),
      ].filter(Boolean);
    },
  },
  /* Upload button -> documents and photos attached to THIS GRT.
     attachKind is the record type /api/attachments stores them against; the
     id it uses is the row's own _id. */
  attachKind: "grt",
  attachTitle: (row) => (row.grtNo ? "GRT " + row.grtNo : "this GRT"),
  filters: [
    { k: "startDate", label: "Start Date", type: "date" },
    { k: "endDate", label: "End Date", type: "date" },
  ],
  columns: [
    { k: "grtNo", t: "GRT No" },
    { k: "grtDate", t: "GRT Date", f: "date" },
    { k: "supplierId", t: "Supplier Name", f: "ref" },
    { k: "grcNumber", t: "GRC NO" },
    { k: "qty", t: "Qty", f: "amount" },
    { k: "itemCount", t: "Items", f: "amount" },
    { k: "taxable", t: "Taxable", f: "amount" },
    { k: "gst", t: "GST", f: "amount" },
    { k: "netAmount", t: "Net Amount", f: "amount" },
  ],
};

export default function TransactionPurchaseGrtListPage() {
  return <ListView cfg={CONFIG} />;
}
