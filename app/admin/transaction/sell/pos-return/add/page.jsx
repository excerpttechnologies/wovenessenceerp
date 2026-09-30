import { Suspense } from 'react';
import PosReturnForm from '@/components/PosReturnForm';

/* Customer return / refund. Reads ?business=&location= with useSearchParams,
   which needs a Suspense boundary - the till links here with the counter's
   scope so the operator does not have to re-pick it.

   A server component (no 'use client') so it can name its own browser tab:
   the till opens this screen in a tab of its own. PosReturnForm is the client
   part. */
export const metadata = { title: 'Return / Refund' };

export default function AddPosReturnPage() {
  return (
    <Suspense fallback={<div className="card"><div className="card-body text-inkmuted">Loading...</div></div>}>
      <PosReturnForm />
    </Suspense>
  );
}
