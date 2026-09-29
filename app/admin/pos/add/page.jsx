import { Suspense } from 'react';
import PosTill from '@/components/PosTill';

/* the browser tab reads POS rather than the app name - the till opens in a
   tab of its own from the POS list */
export const metadata = { title: 'POS' };

/* The till reads ?business=&location= with useSearchParams(), which needs a
   Suspense boundary, and it renders as a fixed overlay so the admin sidebar
   and top bar are not visible - matching the original. */

export default function CreatePosPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 z-50 bg-white p-8 text-inkmuted">Loading POS...</div>}>
      <PosTill />
    </Suspense>
  );
}
