import { ArrowLeft, ExternalLink, Plus, Send } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  ClosedBadge,
  SavedBadge,
  StageBadge,
  StatusBadge,
  TinyTag,
  PriorityBadge,
} from "@/components/shared/badges";
import { CompanyLogo } from "@/components/shared/company-logo";
import { DetailFact, SectionLabel } from "@/components/shared/detail-fact";
import { Panel, PanelHeader } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityTimeline } from "@/features/activity/components/activity-timeline";
import { ApplyDialog } from "@/features/applications/components/apply-dialog";
import { listActivity } from "@/features/applications/data";
import { JobActions } from "@/features/opportunities/components/job-actions";
import { getOpportunityDetail, getQuickAddOptions } from "@/features/opportunities/data";
import { requireWorkspace } from "@/features/workspace/data";
import { formatDateOnly } from "@/lib/dates";
import { EMPLOYMENT_TYPE_LABEL, SALARY_BASIS_LABEL, WORK_ARRANGEMENT_LABEL } from "@/lib/labels";
import { formatSalaryRange } from "@/lib/money";
import { uuid } from "@/lib/validations/common";

export const metadata: Metadata = { title: "Job details" };

export default function JobDetailPage({ params }: PageProps<"/jobs/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[560px] rounded-2xl" />}>
      <JobDetail params={params} />
    </Suspense>
  );
}

async function JobDetail({ params }: { params: PageProps<"/jobs/[id]">["params"] }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const [job, options, activity, { preferences }] = await Promise.all([
    getOpportunityDetail(id),
    getQuickAddOptions(),
    listActivity({ opportunityId: id }),
    requireWorkspace(),
  ]);
  if (!job) notFound();
  const latest = job.applications[0];
  const nextAttempt = (latest?.attemptNumber ?? 0) + 1;

  return (
    <>
      <Link
        href="/jobs"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-brand hover:underline"
      >
        <ArrowLeft className="size-3.5" aria-hidden /> All jobs
      </Link>
      <Panel className="mb-4 p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-center gap-3.5">
            <CompanyLogo name={job.companyName} />
            <div className="min-w-0">
              <h1 className="text-xl leading-tight font-bold tracking-[-0.8px] sm:text-[22px]">
                {job.title}
              </h1>
              <p className="mt-1 text-xs text-[#8e9d92]">
                {job.companyName}
                {job.location ? ` · ${job.location}` : ""}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {!latest ? (
                  <SavedBadge />
                ) : latest.status === "CLOSED" ? (
                  <ClosedBadge outcome={latest.outcome} />
                ) : (
                  <StageBadge
                    name={latest.stage.name}
                    category={latest.stage.category}
                    color={latest.stage.color}
                  />
                )}
                <PriorityBadge priority={job.priority} />
                {job.archivedAt ? <StatusBadge label="Archived" /> : null}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ApplyDialog
              opportunityId={job.id}
              stages={options.stages}
              today={options.today}
              attemptNumber={nextAttempt}
              trigger={
                <Button>
                  <Send aria-hidden /> {latest ? "Reapply" : "Mark as applied"}
                </Button>
              }
            />
            <JobActions
              opportunityId={job.id}
              title={job.title}
              archived={Boolean(job.archivedAt)}
              applicationCount={job.applications.length}
            />
          </div>
        </div>
      </Panel>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
        <Panel className="p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <DetailFact label="Salary range">{formatSalaryRange(job.salary)}</DetailFact>
            <DetailFact label="Salary basis">{SALARY_BASIS_LABEL[job.salaryBasis]}</DetailFact>
            <DetailFact label="Work arrangement">
              {job.workArrangement ? WORK_ARRANGEMENT_LABEL[job.workArrangement] : "Not specified"}
            </DetailFact>
            <DetailFact label="Employment type">
              {job.employmentType ? EMPLOYMENT_TYPE_LABEL[job.employmentType] : "Not specified"}
            </DetailFact>
            <DetailFact label="Job source">{job.source ?? "Not specified"}</DetailFact>
            <DetailFact label="Date saved">{formatDateOnly(job.savedOn)}</DetailFact>
            <DetailFact label="Deadline">{job.deadline ? formatDateOnly(job.deadline) : "None"}</DetailFact>
            <DetailFact label="Reference">{job.referenceCode ?? "None"}</DetailFact>
            <DetailFact label="Currency">{job.salary.currency ?? "Not specified"}</DetailFact>
          </div>
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
          <p className="text-xs leading-[1.75] whitespace-pre-wrap text-[#74877a]">
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
          {job.tags.length > 0 ? (
            <>
              <SectionLabel>Tags</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {job.tags.map((tag) => (
                  <StatusBadge key={tag} label={tag} tone="blue" />
                ))}
              </div>
            </>
          ) : null}
          <SectionLabel>Your notes</SectionLabel>
          <p className="rounded-[10px] bg-[#f8faf7] p-3 text-xs leading-[1.75] whitespace-pre-wrap text-[#74877a]">
            {job.notes ?? "No notes yet. Use Edit to add your thoughts."}
          </p>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel className="pb-4">
            <PanelHeader
              title="Application attempts"
              description={
                job.applications.length
                  ? `${job.applications.length} attempt${job.applications.length === 1 ? "" : "s"}`
                  : "Not applied yet"
              }
            />
            {job.applications.length === 0 ? (
              <div className="px-5 pb-1 text-xs text-subtle sm:px-6">
                <p>
                  This job is saved. When you apply, record it here to track stages, interviews and offers.
                </p>
                <ApplyDialog
                  opportunityId={job.id}
                  stages={options.stages}
                  today={options.today}
                  attemptNumber={1}
                  trigger={
                    <Button variant="outline" className="mt-3">
                      <Plus aria-hidden /> Record application
                    </Button>
                  }
                />
              </div>
            ) : (
              <ul className="flex flex-col gap-2 px-4 sm:px-5">
                {job.applications.map((application) => (
                  <li key={application.id}>
                    <Link
                      href={`/applications/${application.id}`}
                      className="flex items-center justify-between gap-3 rounded-[11px] border border-[#e8eee6] p-3 hover:border-[#a1c8b1]"
                    >
                      <span className="min-w-0">
                        <strong className="block text-xs">Attempt {application.attemptNumber}</strong>
                        <span className="mt-1 block text-[10px] text-[#8b9f92]">
                          Applied {formatDateOnly(application.appliedOn)} · {application.interviewCount}{" "}
                          interview
                          {application.interviewCount === 1 ? "" : "s"}
                        </span>
                      </span>
                      {application.status === "CLOSED" ? (
                        <ClosedBadge outcome={application.outcome} />
                      ) : (
                        <StageBadge name={application.stage.name} category={application.stage.category} />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel className="pb-5">
            <PanelHeader title="History" description="Everything that happened with this job" />
            <div className="px-5 sm:px-6">
              <ActivityTimeline
                events={activity}
                timezone={preferences.timezone}
                showAttempt={job.applications.length > 1}
              />
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
