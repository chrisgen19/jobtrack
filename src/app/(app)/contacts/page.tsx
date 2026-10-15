import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { CompaniesPanel } from "@/features/companies/components/companies-panel";
import { listCompanies } from "@/features/companies/data";
import { ContactsPanel } from "@/features/contacts/components/contacts-panel";
import { listContacts } from "@/features/contacts/data";

export const metadata: Metadata = { title: "Companies & contacts" };

export default function ContactsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Your network"
        title="Companies & contacts"
        description="Keep company details and the people you talk to in one place."
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Contacts />
      </Suspense>
    </>
  );
}

async function Contacts() {
  const [companies, contacts] = await Promise.all([listCompanies(), listContacts()]);
  return (
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <ContactsPanel contacts={contacts} companyNames={companies.map((company) => company.name)} />
      <CompaniesPanel companies={companies} />
    </div>
  );
}
