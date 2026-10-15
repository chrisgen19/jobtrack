import { ArrowUpRight, ExternalLink, Send } from "lucide-react";
import {
  ClosedBadge,
  PriorityBadge,
  SavedBadge,
  StageBadge,
  StatusBadge,
  TinyTag,
} from "@/components/shared/badges";
import { CompanyLogo } from "@/components/shared/company-logo";
import { DetailFact, SectionLabel } from "@/components/shared/detail-fact";
import { PeekNotFound } from "@/components/shared/peek-sheet";
import { Button } from "@/components/ui/button";
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ApplyDialog } from "@/features/applications/components/apply-dialog";
import {
  getOpportunityDetail,
  getQuickAddOptions,
  type OpportunityDetail,
} from "@/features/opportunities/data";
import { formatDateOnly } from "@/lib/dates";
import { EMPLOYMENT_TYPE_LABEL, WORK_ARRANGEMENT_LABEL } from "@/lib/labels";
import { formatSalaryRange } from "@/lib/money";
import { uuid } from "@/lib/validations/common";

/** Read-only job summary for the pipeline drawer, with a shortcut to record the application. */
export async function JobPeek({ id }: { id: string }) {
  if (!uuid.safeParse(id).success) return <PeekNotFound title="Job not found" />;
  const [job, options] = await Promise.all([getOpportunityDetail(id), getQuickAddOptions()]);
  if (!job) return <PeekNotFound title="Job not found" />;
  const latest = job.applications[0];

  return (
    <>
      <JobPeekHeader job={job} />
      <div className="flex-1 overflow-y-auto px-5 pb-6 sm:px-7">
        <JobPeekFacts job={job} />
        {job.postingUrl ? (
          <a
            href={job.postingUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-brand hover:underline"
          >
            Open job posting <ExternalLink className="size-3" aria-hidden />
          </a>
        ) : null}
        <SectionLabel>About this role</SectionLabel>
        <p className="line-clamp-6 text-xs leading-[1.75] whitespace-pre-wrap text-[#74877a]">
          {job.description ?? "No description saved yet."}
        </p>
        {job.requiredSkills.length > 0 ? (
          <>
            <SectionLabel>Required skills</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {job.requiredSkills.map((skill) => (
                <TinyTag key={skill}>{skill}</TinyTag>
              ))}
            </div>
          </>
        ) : null}
      </div>
      <SheetFooter className="flex-row flex-wrap border-t border-line px-5 py-4 sm:px-7">
        <ApplyDialog
          opportunityId={job.id}
          stages={options.stages}
          today={options.today}
          attemptNumber={(latest?.attemptNumber ?? 0) + 1}
          navigate="replace"
          trigger={
            <Button className="flex-1">
              <Send aria-hidden /> {latest ? "Reapply" : "Mark as applied"}
            </Button>
          }
        />
        {/* A plain anchor: a client-side Link to this URL would be intercepted into the drawer again. */}
        <Button asChild variant="outline" className="flex-1">
          <a href={`/jobs/${job.id}`}>
            Open full page <ArrowUpRight aria-hidden />
          </a>
        </Button>
      </SheetFooter>
    </>
  );
}

function JobPeekHeader({ job }: { job: OpportunityDetail }) {
  const latest = job.applications[0];
  return (
    <SheetHeader className="gap-0 border-b border-line px-5 pt-6 pr-12 pb-5 sm:px-7 sm:pr-12">
      <p className="mb-4 text-[11px] font-bold tracking-[0.8px] text-[#95a49a] uppercase">
        {latest ? "Job details" : "Saved job"}
      </p>
      <div className="flex min-w-0 items-center gap-3.5">
        <CompanyLogo name={job.companyName} />
        <div className="min-w-0">
          <SheetTitle className="text-lg leading-tight font-bold tracking-[-0.6px] text-ink">
            {job.title}
          </SheetTitle>
          <SheetDescription className="mt-1 text-xs text-[#8e9d92]">
            {job.companyName}
            {job.location ? ` · ${job.location}` : ""} · Saved {formatDateOnly(job.savedOn)}
          </SheetDescription>
        </div>
      </div>
      {/* The sr-only labels give each badge its meaning ("Priority: Medium", not just "Medium"). */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className="sr-only">{latest && latest.status !== "CLOSED" ? "Stage:" : "Status:"}</span>
        {!latest ? (
          <SavedBadge />
        ) : latest.status === "CLOSED" ? (
          <ClosedBadge outcome={latest.outcome} />
        ) : (
          <StageBadge name={latest.stage.name} category={latest.stage.category} color={latest.stage.color} />
        )}
        <span className="sr-only">Priority:</span>
        <PriorityBadge priority={job.priority} />
        {job.archivedAt ? <StatusBadge label="Archived" /> : null}
      </div>
    </SheetHeader>
  );
}

function JobPeekFacts({ job }: { job: OpportunityDetail }) {
  return (
    <div className="mt-5 grid grid-cols-2 gap-3">
      <DetailFact label="Salary range">{formatSalaryRange(job.salary)}</DetailFact>
      <DetailFact label="Work arrangement">
        {job.workArrangement ? WORK_ARRANGEMENT_LABEL[job.workArrangement] : "Not specified"}
      </DetailFact>
      <DetailFact label="Employment type">
        {job.employmentType ? EMPLOYMENT_TYPE_LABEL[job.employmentType] : "Not specified"}
      </DetailFact>
      <DetailFact label="Job source">{job.source ?? "Not specified"}</DetailFact>
      <DetailFact label="Date saved">{formatDateOnly(job.savedOn)}</DetailFact>
      <DetailFact label="Deadline">{job.deadline ? formatDateOnly(job.deadline) : "None"}</DetailFact>
    </div>
  );
}
