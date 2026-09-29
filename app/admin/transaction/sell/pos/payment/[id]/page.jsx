'use client';
import { useParams, useRouter } from 'next/navigation';
import PosPaymentsView from '@/components/PosPaymentsView';

/* POS Payments - the stand-alone page. The POS list opens the same view in a
   popup; this page stays for direct links and bookmarks. The content lives in
   components/PosPaymentsView.jsx so the two cannot drift. */

export default function PosPaymentsPage() {
  const { id } = useParams();
  const router = useRouter();
  return (
    <div className="min-h-screen">
      <PosPaymentsView id={id} onBack={() => router.back()} />
    </div>
  );
}
