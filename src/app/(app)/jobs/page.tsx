import { Briefcase, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { JobFilters } from "@/features/opportunities/components/job-filters";
import { JobsTable } from "@/features/opportunities/components/jobs-table";
import { getQuickAddOptions, listOpportunities, listSources } from "@/features/opportunities/data";
import { jobListFiltersSchema } from "@/features/opportunities/schemas";
import { ExportButton } from "@/features/export/components/export-button";

export const metadata: Metadata = { title: "All jobs" };

export default function JobsPage({ searchParams }: PageProps<"/jobs">) {
  return (
    <>
      <PageHeader
        eyebrow="Your opportunities"
        title="All job applications"
        description="Keep every opportunity, application, and follow-up in one place."
        actions={<ExportButton />}
      />
      <Suspense fallback={<Skeleton className="h-[480px] rounded-2xl" />}>
        <Jobs searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Jobs({ searchParams }: { searchParams: PageProps<"/jobs">["searchParams"] }) {
  const raw = await searchParams;
  const filters = jobListFiltersSchema.parse({
    view: raw.view,
    q: raw.q,
    stage: raw.stage,
    priority: raw.priority,
    work: raw.work,
    source: raw.source,
  });
  const [{ rows, total }, options, sources] = await Promise.all([
    listOpportunities(filters),
    getQuickAddOptions(),
    listSources(),
  ]);
  const filtered =
    Boolean(filters.q || filters.stage || filters.priority || filters.work || filters.source) ||
    filters.view !== "all";

  return (
    <>
      <JobFilters
        key={filters.q ?? ""}
        filters={filters}
        total={total}
        stages={options.stages}
        sources={sources}
      />
      <Panel className="overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 text-[11px] text-[#99a69d]">
          <span>
            Showing <b className="text-[#405949]">{rows.length}</b> of {total}{" "}
            {total === 1 ? "opportunity" : "opportunities"}
          </span>
          <span className="hidden sm:inline">Click a column to sort</span>
        </div>
        {rows.length > 0 ? (
          <JobsTable rows={rows} />
        ) : filtered ? (
          <EmptyState
            icon={Search}
            title="No matching jobs"
            description="Try adjusting your filters or search."
            action={
              <Link href="/jobs" className="text-xs font-bold text-brand hover:underline">
                Clear filters
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={Briefcase}
            title="Save your first job"
            description="Use “Add a job” in the top bar. Only the job title and company are required."
          />
        )}
      </Panel>
    </>
  );
}
