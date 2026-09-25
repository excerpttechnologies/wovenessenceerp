'use client';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ReportView from '@/components/ReportView';
import BarcodeDetailView from '@/components/BarcodeDetailView';
import { REPORT } from './fields';

/* Reports -> Barcode Report

   TWO SCREENS BEHIND ONE ROUTE, chosen by the query string:

     no barcodeNo  -> the report as it was: every barcode for an item code
     ?barcodeNo=x  -> that one barcode in full, which is where the Master Stock
                      Report's barcode links land

   One route rather than two because it is one idea - "tell me about barcodes"
   - and because a link is easier to follow than a second sidebar entry that
   only ever makes sense when something else sent you to it.

   useSearchParams needs a Suspense boundary in the app router, the same way
   the POS add page wraps its form. */

function BarcodeReportScreens() {
  const params = useSearchParams();
  const router = useRouter();
  const barcodeNo = (params.get('barcodeNo') || '').trim();

  if (barcodeNo) {
    return (
      <BarcodeDetailView
        barcodeNo={barcodeNo}
        /* back to the list form of this same report, not into browser history
           - the operator may have arrived here straight from a link */
        onBack={() => router.push('/admin/reports/barcode-report')}
      />
    );
  }

  return <ReportView spec={REPORT} />;
}

export default function BarcodeReportPage() {
  return (
    <Suspense fallback={<div className="card"><div className="card-body text-inkmuted">Loading...</div></div>}>
      <BarcodeReportScreens />
    </Suspense>
  );
}
