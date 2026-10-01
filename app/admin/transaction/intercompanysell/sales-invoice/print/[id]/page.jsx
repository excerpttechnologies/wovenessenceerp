'use client';
import { use } from 'react';
import IcTaxInvoiceView from '@/components/IcTaxInvoiceView';

/* Print a consignment Sales Invoice - reached from the Print button on the
   Billed list. The document is the same Tax Invoice layout the older IC
   invoice prints; only the endpoint feeding it differs. */

export default function IcItemInvoicePrintPage({ params, searchParams }) {
  const { id } = use(params);
  /* ?einv=1 prints the same document under the e-Invoice heading */
  const sp = use(searchParams);
  return (
    <IcTaxInvoiceView
      id={id}
      endpoint={'/api/ic-item-invoice/' + id + '/print'}
      backHref="/admin/transaction/intercompanysell/sales-invoice"
      einvoice={sp?.einv === '1'}
    />
  );
}
