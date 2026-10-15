import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ClosedBadge, PriorityBadge, StatusBadge } from "@/components/shared/badges";
import { CompanyLogo } from "@/components/shared/company-logo";
import { DetailFact, SectionLabel } from "@/components/shared/detail-fact";
import { Panel } from "@/components/shared/panel";
import { TabLinks } from "@/components/shared/tab-links";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityTimeline } from "@/features/activity/components/activity-timeline";
import { ApplicationDetailsDialog } from "@/features/applications/components/application-details-dialog";
import { NoteForm } from "@/features/applications/components/note-form";
import { StageSelect } from "@/features/applications/components/stage-select";
import { StatusControls } from "@/features/applications/components/status-controls";
import { getApplicationDetail, listActivity, type ApplicationDetail } from "@/features/applications/data";
import { listCompanyContacts } from "@/features/contacts/data";
import { ApplicationDocuments } from "@/features/documents/components/application-documents";
import { listApplicationDocuments, listDocumentChoices } from "@/features/documents/data";
import { InterviewList } from "@/features/interviews/components/interview-list";
import { OfferList } from "@/features/offers/components/offer-list";
import { listApplicationOffers } from "@/features/offers/data";
import { listApplicationInterviews } from "@/features/interviews/data";
import { NewTaskButton } from "@/features/tasks/components/new-task-button";
import { TaskList } from "@/features/tasks/components/task-list";
import { listApplicationTasks, listTaskTargets } from "@/features/tasks/data";
import { requireWorkspace, type WorkspacePreferences } from "@/features/workspace/data";
import { formatDateOnly, formatInTimeZone, supportedTimeZones, todayInTimeZone } from "@/lib/dates";
import { APPLICATION_METHOD_LABEL, WORK_ARRANGEMENT_LABEL } from "@/lib/labels";
import { formatSalaryRange } from "@/lib/money";
import { uuid } from "@/lib/validations/common";

export const metadata: Metadata = { title: "Application" };

const TABS = ["overview", "interviews", "documents", "offers", "timeline"] as const;
type Tab = (typeof TABS)[number];

export default function ApplicationPage({ params, searchParams }: PageProps<"/applications/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[560px] rounded-2xl" />}>
      <ApplicationView params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ApplicationView({
  params,
  searchParams,
}: {
  params: PageProps<"/applications/[id]">["params"];
  searchParams: PageProps<"/applications/[id]">["searchParams"];
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!uuid.safeParse(id).success) notFound();
  const tab: Tab = TABS.includes(query.tab as Tab) ? (query.tab as Tab) : "overview";
  const [application, { preferences }] = await Promise.all([getApplicationDetail(id), requireWorkspace()]);
  if (!application) notFound();
  const today = todayInTimeZone(preferences.timezone);
  const { opportunity } = application;

  return (
    <>
      <Link
        href={`/jobs/${opportunity.id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-brand hover:underline"
      >
        <ArrowLeft className="size-3.5" aria-hidden /> {opportunity.title}
      </Link>
      <Panel className="mb-4 p-5 sm:p-6">
        <p className="mb-4 text-[11px] font-bold tracking-[0.8px] text-[#95a49a] uppercase">
          Application details · Attempt {application.attemptNumber}
        </p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-center gap-3.5">
            <CompanyLogo name={opportunity.companyName} />
            <div className="min-w-0">
              <h1 className="text-xl leading-tight font-bold tracking-[-0.8px] sm:text-[22px]">
                {opportunity.title}
              </h1>
              <p className="mt-1 text-xs text-[#8e9d92]">
                {opportunity.companyName}
                {opportunity.location ? ` · ${opportunity.location}` : ""} · Applied{" "}
                {formatDateOnly(application.appliedOn)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StageSelect
              applicationId={application.id}
              stageId={application.stage.id}
              stages={application.stages}
              disabled={application.status === "CLOSED"}
            />
            <StatusControls
              applicationId={application.id}
              status={application.status}
              attemptNumber={application.attemptNumber}
              today={today}
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {application.status === "CLOSED" ? <ClosedBadge outcome={application.outcome} /> : null}
          {application.status === "PAUSED" ? <StatusBadge label="Paused" tone="amber" /> : null}
          {application.status === "ACTIVE" ? <StatusBadge label="Active" tone="green" /> : null}
          <PriorityBadge priority={opportunity.priority} />
          {application.attempts.length > 1 ? (
            <span className="text-[11px] text-faint">
              Other attempts:{" "}
              {application.attempts
                .filter((attempt) => attempt.id !== application.id)
                .map((attempt, index) => (
                  <span key={attempt.id}>
                    {index > 0 ? ", " : ""}
                    <Link
                      href={`/applications/${attempt.id}`}
                      className="font-semibold text-brand hover:underline"
                    >
                      #{attempt.attemptNumber} ({formatDateOnly(attempt.appliedOn, "MMM yyyy")})
                    </Link>
                  </span>
                ))}
            </span>
          ) : null}
        </div>
      </Panel>

      <Panel className="p-5 sm:p-6">
        <TabLinks
          label="Application sections"
          active={tab}
          hrefFor={(next) => `/applications/${application.id}${next === "overview" ? "" : `?tab=${next}`}`}
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "interviews", label: "Interviews" },
            { id: "documents", label: "Documents" },
            { id: "offers", label: "Offers" },
            { id: "timeline", label: "Timeline" },
          ]}
        />
        {tab === "overview" ? (
          <>
            <Overview application={application} timezone={preferences.timezone} today={today} />
            <NextSteps applicationId={application.id} preferences={preferences} today={today} />
          </>
        ) : null}
        {tab === "interviews" ? (
          <Interviews
            applicationId={application.id}
            companyId={application.opportunity.companyId}
            preferences={preferences}
          />
        ) : null}
        {tab === "documents" ? <Documents applicationId={application.id} /> : null}
        {tab === "offers" ? (
          <Offers
            applicationId={application.id}
            positionTitle={application.opportunity.title}
            preferences={preferences}
            today={today}
            closed={application.status === "CLOSED"}
          />
        ) : null}
        {tab === "timeline" ? (
          <Timeline applicationId={application.id} timezone={preferences.timezone} />
        ) : null}
      </Panel>
    </>
  );
}

function Overview({
  application,
  timezone,
  today,
}: {
  application: ApplicationDetail;
  timezone: string;
  today: string;
}) {
  const { opportunity } = application;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <SectionLabel>Application facts</SectionLabel>
        <ApplicationDetailsDialog
          applicationId={application.id}
          appliedOn={application.appliedOn}
          method={application.method}
          submittedVia={application.submittedVia}
          notes={application.notes}
          today={today}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <DetailFact label="Salary range">
          {formatSalaryRange({
            min: opportunity.salaryMin,
            max: opportunity.salaryMax,
            currency: opportunity.currency,
            period: opportunity.salaryPeriod,
          })}
        </DetailFact>
        <DetailFact label="Work arrangement">
          {opportunity.workArrangement
            ? WORK_ARRANGEMENT_LABEL[opportunity.workArrangement]
            : "Not specified"}
        </DetailFact>
        <DetailFact label="Date applied">{formatDateOnly(application.appliedOn)}</DetailFact>
        <DetailFact label="Method">
          {application.method ? APPLICATION_METHOD_LABEL[application.method] : "Not specified"}
        </DetailFact>
        <DetailFact label="Submitted via">{application.submittedVia ?? "Not specified"}</DetailFact>
        <DetailFact label="Job source">{opportunity.source ?? "Not specified"}</DetailFact>
        <DetailFact label="In stage since">
          {formatInTimeZone(application.stageChangedAt, timezone, "MMM d, yyyy")}
        </DetailFact>
        <DetailFact label="First response">
          {application.firstResponseOn ? formatDateOnly(application.firstResponseOn) : "Not recorded"}
        </DetailFact>
        <DetailFact label="Closed">
          {application.closedAt
            ? formatInTimeZone(application.closedAt, timezone, "MMM d, yyyy")
            : "Still open"}
        </DetailFact>
      </div>
      {opportunity.postingUrl ? (
        <a
          href={opportunity.postingUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-brand hover:underline"
        >
          Open job posting <ExternalLink className="size-3" aria-hidden />
        </a>
      ) : null}
      <SectionLabel>Application notes</SectionLabel>
      <p className="rounded-[10px] bg-[#f8faf7] p-3 text-xs leading-[1.75] whitespace-pre-wrap text-[#74877a]">
        {application.notes ?? "No notes for this attempt yet."}
      </p>
      <SectionLabel>About this role</SectionLabel>
      <p className="line-clamp-[12] text-xs leading-[1.75] whitespace-pre-wrap text-[#74877a]">
        {opportunity.description ?? "No description saved."}
      </p>
    </div>
  );
}

async function NextSteps({
  applicationId,
  preferences,
  today,
}: {
  applicationId: string;
  preferences: WorkspacePreferences;
  today: string;
}) {
  const [tasks, targets] = await Promise.all([listApplicationTasks(applicationId), listTaskTargets()]);
  return (
    <section aria-label="Next steps">
      <div className="flex items-center justify-between gap-3">
        <SectionLabel>Next steps</SectionLabel>
        <NewTaskButton
          targets={targets}
          applicationId={applicationId}
          defaultDueDate={today}
          defaultReminderMinutes={preferences.taskReminderMinutes}
          label="Add follow-up"
        />
      </div>
      {tasks.length ? (
        <div className="-mx-5 sm:-mx-6">
          <TaskList tasks={tasks} timezone={preferences.timezone} today={today} targets={targets} />
        </div>
      ) : (
        <p className="rounded-[9px] bg-[#f4f7f2] px-3 py-2.5 text-[11px] text-[#829082]">
          No open tasks for this application.
        </p>
      )}
    </section>
  );
}

async function Documents({ applicationId }: { applicationId: string }) {
  const [attached, choices] = await Promise.all([
    listApplicationDocuments(applicationId),
    listDocumentChoices(),
  ]);
  return <ApplicationDocuments applicationId={applicationId} attached={attached} choices={choices} />;
}

async function Offers({
  applicationId,
  positionTitle,
  preferences,
  today,
  closed,
}: {
  applicationId: string;
  positionTitle: string;
  preferences: WorkspacePreferences;
  today: string;
  closed: boolean;
}) {
  const offers = await listApplicationOffers(applicationId);
  return (
    <OfferList
      applicationId={applicationId}
      offers={offers}
      defaults={{ positionTitle, currency: preferences.currency, today }}
      applicationClosed={closed}
    />
  );
}

async function Interviews({
  applicationId,
  companyId,
  preferences,
}: {
  applicationId: string;
  companyId: string;
  preferences: WorkspacePreferences;
}) {
  const [interviews, contacts] = await Promise.all([
    listApplicationInterviews(applicationId),
    listCompanyContacts(companyId),
  ]);
  return (
    <InterviewList
      applicationId={applicationId}
      interviews={interviews}
      timezone={preferences.timezone}
      defaultReminderMinutes={preferences.interviewReminderMinutes}
      timeZones={supportedTimeZones()}
      contacts={contacts}
    />
  );
}

async function Timeline({ applicationId, timezone }: { applicationId: string; timezone: string }) {
  const events = await listActivity({ applicationId });
  return (
    <div className="max-w-2xl">
      <NoteForm applicationId={applicationId} />
      <ActivityTimeline events={events} timezone={timezone} />
    </div>
  );
}
