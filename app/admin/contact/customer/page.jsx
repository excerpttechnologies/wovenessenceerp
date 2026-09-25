'use client';
import ListView from '@/components/ListView';
import { TABS } from './tabs';

/* Customers - list. Columns declared here, not fetched from a registry. */

const CONFIG = {
  title: "Customers",
  basePath: '/admin/contact/',
  slugPath: "customer",
  endpoint: '/api/customer',
  scope: ["business"],
  formMode: "tabs",
  actionPosition: "left",
  actionVariant: "dropdown",
  actionMenu: [
    { label: 'Edit', icon: 'pencil', need: 'update', to: (r) => '/admin/contact/customer/' + r._id },
    { label: 'Delete', icon: 'trash', action: 'delete' },
  ],
  columns: [
    { k: "businessName", t: "Business Name" },
    { k: "contactId", t: "Contact ID" },
    { k: "firstName", t: "Name" },
    { k: "billingMobile", t: "Mobile" },
    { k: "billingEmail", t: "Email" },
    { k: "billingAddressLine1", t: "Address" },
  ],
};

export default function CustomerListPage() {
  return <ListView cfg={CONFIG} />;
}
