'use client';
import ListView from '@/components/ListView';

/* Inter Company Delivery Challans - list.
   Columns declared here, not fetched from a registry.

   TWO SECTIONS, ONE ENDPOINT. A challan raised here does not arrive anywhere
   until somebody standing in the DESTINATION branch approves it on the
   Receive Delivery Challan screen, which is what stamps receivedAt. So the
   screen reads the same way that one does:

     Pending Delivery Challans   receivedAt is null - raised, gone out, and
                                 nobody at the other end has accepted it yet
     Delivery Challans           receivedAt is set - the goods have landed

   A challan moves from the top section to the bottom one the moment it is
   approved; no state is held here, both sections simply ask the endpoint
   which half they want with `received`.

   The summary boxes and the filter card belong to the WHOLE screen, so they
   stay where they have always been - at the top, above both sections, still
   counting every challan the filter matches rather than either half. See the
   `received` block in app/api/ic-delivery-challan/route.js. */

/* Everything the two sections share. Declared once so a column added to the
   screen cannot appear in one section and not the other. */
const COLUMNS = [
  { k: 'toBusinessId', t: 'Customer Name', f: 'ref' },
  { k: 'dcNo', t: 'DC No' },
  { k: 'dcDate', t: 'DC Date', f: 'date' },
  { k: 'toLocationId', t: 'To Location', f: 'ref' },
  { k: 'stockPointId', t: 'Stock Point', f: 'ref' },
  { k: 'totalQty', t: 'Total Qty', f: 'amount' },
  { k: 'createdAt', t: 'Creadted On', f: 'date' },
  { k: 'netValue', t: 'Total Value', f: 'amount' },
  /* WHAT THE RECEIVER HAS DONE WITH IT.

     receivedAt is stamped by lib/icReceive.js the moment somebody standing in
     the destination branch approves the challan on the Receive Delivery
     Challan screen - so null means it is still sitting there waiting, and a
     date means the goods have landed. The sending branch could not see that
     before; it raised a challan and heard nothing back.

     `value` derives the word from the whole row because the column is about a
     state, not about the timestamp itself - showing the date would leave a
     blank cell for everything still pending, which reads as missing data
     rather than as work outstanding. */
  {
    k: 'receivedAt',
    t: 'Status',
    f: 'badges',
    value: (r) => (r.receivedAt ? 'Accepted' : 'Pending'),
    tone: (v) => (v === 'Accepted' ? 'green' : 'yellow'),
  },
];

const SHARED = {
  basePath: '/admin/transaction/intercompanysell/',
  slugPath: 'deliverychallan',
  endpoint: '/api/ic-delivery-challan',
  scope: ['business', 'location', 'finYear'],
  addTitle: 'Inter Company Delivery Challan',
  /* view + edit + print, matching the deployed row actions */
  actionIcons: ['view', 'edit', 'print'],
  /* the print icon opens the challan's own print page - see
     components/IcChallanPrintView.jsx for why it cannot print the list */
  printHref: (r) => '/admin/transaction/intercompanysell/deliverychallan/print/' + r._id,
  columns: COLUMNS,
};

/* WAITING ON THE OTHER BRANCH.

   No Add button and no export buttons: there is one of each on the screen
   already, on the section below, and this is a short working list rather than
   a book to take away. It carries its own search so a long wait can still be
   looked through. */
const PENDING = {
  ...SHARED,
  title: 'Pending Delivery Challans',
  fixedQuery: { received: 'no' },
  showAdd: false,
  showCsv: false,
};

const CONFIG = {
  ...SHARED,
  title: 'Inter Company Delivery Challans',
  fixedQuery: { received: 'yes' },
  /* boxes above the list - filled from the endpoint's `summary`, so they
     cover every challan the filter matches, not the page on screen, and not
     just the section they sit above */
  summaryCards: [
    { k: 'count', label: 'Total DC No' },
    { k: 'totalQty', label: 'Total Qty', f: 'amount' },
  ],
  filters: [
    { k: 'toBusinessId', label: 'To Business', type: 'ref', ref: 'business', placeholder: 'Select Business' },
    { k: 'startDate', label: 'Start Date', type: 'date' },
    { k: 'endDate', label: 'End Date', type: 'date' },
  ],
  /* slotted in below the boxes and the filter, above this section's own
     table - see the `beforeTable` note in components/ListView.jsx */
  beforeTable: <ListView cfg={PENDING} />,
};

export default function IcDeliveryChallanListPage() {
  return <ListView cfg={CONFIG} />;
}
