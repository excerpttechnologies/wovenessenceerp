/* Browser-tab title for the Master Stock Report. The page itself is a
   client component (it passes the report spec, functions included, to
   ReportView), and a client page cannot export metadata - so the title
   lives on this server layout instead. */
export const metadata = { title: 'Main Reports' };

export default function MasterStockReportLayout({ children }) {
  return children;
}
