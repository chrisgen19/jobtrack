import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { EditOpportunityForm } from "@/features/opportunities/components/edit-opportunity-form";
import { getOpportunityDetail } from "@/features/opportunities/data";
import { listCompanyNames } from "@/features/companies/data";
import { uuid } from "@/lib/validations/common";

export const metadata: Metadata = { title: "Edit job" };

export default function EditJobPage({ params }: PageProps<"/jobs/[id]/edit">) {
  return (
    <>
      <PageHeader
        eyebrow="Edit opportunity"
        title="Update job details"
        description="Only the job title and company are required."
      />
      <Suspense fallback={<Skeleton className="h-[640px] rounded-2xl" />}>
        <EditJob params={params} />
      </Suspense>
    </>
  );
}

async function EditJob({ params }: { params: PageProps<"/jobs/[id]/edit">["params"] }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const [job, companyNames] = await Promise.all([getOpportunityDetail(id), listCompanyNames()]);
  if (!job) notFound();
  return (
    <Panel className="max-w-3xl p-5 sm:p-6">
      <EditOpportunityForm
        opportunityId={job.id}
        companyNames={companyNames}
        defaultValues={{
          title: job.title,
          companyName: job.companyName,
          postingUrl: job.postingUrl ?? "",
          source: job.source ?? "",
          referenceCode: job.referenceCode ?? "",
          description: job.description ?? "",
          location: job.location ?? "",
          workArrangement: job.workArrangement ?? "",
          employmentType: job.employmentType ?? "",
          salaryMin: job.salary.min ?? "",
          salaryMax: job.salary.max ?? "",
          currency: job.salary.currency ?? "",
          salaryPeriod: job.salary.period ?? "",
          salaryBasis: job.salaryBasis,
          priority: job.priority,
          requiredSkills: job.requiredSkills.join(", "),
          tags: job.tags.join(", "),
          notes: job.notes ?? "",
          deadline: job.deadline ?? "",
          savedOn: job.savedOn,
        }}
      />
    </Panel>
  );
}
