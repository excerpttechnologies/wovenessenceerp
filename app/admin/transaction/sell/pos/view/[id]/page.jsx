'use client';
import { useParams, useRouter } from 'next/navigation';
import PosInvoiceView from '@/components/PosInvoiceView';

/* View POS - the stand-alone page. The POS list opens the same view in a
   popup; this page stays for direct links and bookmarks. The content lives
   in components/PosInvoiceView.jsx so the two cannot drift. */

export default function ViewPosPage() {
  const { id } = useParams();
  const router = useRouter();
  return (
    <div className="card">
      <PosInvoiceView id={id} onBack={() => router.back()} />
    </div>
  );
}
