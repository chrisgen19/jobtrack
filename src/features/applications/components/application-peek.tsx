import { ArrowUpRight } from "lucide-react";
import { ClosedBadge, PriorityBadge, StageBadge, StatusBadge } from "@/components/shared/badges";
import { CompanyLogo } from "@/components/shared/company-logo";
import { DetailFact, SectionLabel } from "@/components/shared/detail-fact";
import { Button } from "@/components/ui/button";
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityTimeline } from "@/features/activity/components/activity-timeline";
import { getApplicationDetail, listActivity, type ApplicationDetail } from "@/features/applications/data";
import { listApplicationInterviews, type InterviewDto } from "@/features/interviews/data";
import { listApplicationTasks, type TaskItem } from "@/features/tasks/data";
import { requireWorkspace } from "@/features/workspace/data";
import { formatDateOnly, formatInTimeZone } from "@/lib/dates";
import { INTERVIEW_TYPE_LABEL, WORK_ARRANGEMENT_LABEL } from "@/lib/labels";
import { formatSalaryRange } from "@/lib/money";
import { uuid } from "@/lib/validations/common";

const RECENT_ACTIVITY = 3;
const OPEN_TASKS = 3;

/** Read-only application summary for the pipeline drawer; editing stays on the full page. */
export async function ApplicationPeek({ id }: { id: string }) {
  if (!uuid.safeParse(id).success) return <PeekNotFound />;
  const [application, { preferences }, interviews, tasks, events] = await Promise.all([
    getApplicationDetail(id),
    requireWorkspace(),
    listApplicationInterviews(id),
    listApplicationTasks(id),
    listActivity({ applicationId: id, take: RECENT_ACTIVITY }),
  ]);
  if (!application) return <PeekNotFound />;
  const timezone = preferences.timezone;
  const now = new Date();
  const nextInterview = interviews.find(
    (interview) =>
      (interview.status === "SCHEDULED" || interview.status === "RESCHEDULED") &&
      interview.startsAt !== null &&
      interview.startsAt >= now,
  );
  const openTasks = tasks.filter((task) => task.status === "OPEN").slice(0, OPEN_TASKS);

  return (
    <>
      <PeekHeader application={application} />
      <div className="flex-1 overflow-y-auto px-5 pb-6 sm:px-7">
        <PeekFacts application={application} timezone={timezone} />
        <SectionLabel>Next interview</SectionLabel>
        {nextInterview ? (
          <NextInterview interview={nextInterview} timezone={timezone} />
        ) : (
          <EmptyLine>No upcoming interview scheduled.</EmptyLine>
        )}
        <SectionLabel>Open tasks</SectionLabel>
        {openTasks.length ? (
          <OpenTasks tasks={openTasks} timezone={timezone} />
        ) : (
          <EmptyLine>No open tasks for this application.</EmptyLine>
        )}
        <SectionLabel>Recent activity</SectionLabel>
        <ActivityTimeline events={events} timezone={timezone} />
      </div>
      <SheetFooter className="border-t border-line px-5 py-4 sm:px-7">
        {/* A plain anchor: a client-side Link to this URL would be intercepted into the drawer again. */}
        <Button asChild>
          <a href={`/applications/${application.id}`}>
            Open full page <ArrowUpRight aria-hidden />
          </a>
        </Button>
      </SheetFooter>
    </>
  );
}

function PeekHeader({ application }: { application: ApplicationDetail }) {
  const { opportunity } = application;
  return (
    <SheetHeader className="gap-0 border-b border-line px-5 pt-6 pr-12 pb-5 sm:px-7 sm:pr-12">
      <p className="mb-4 text-[11px] font-bold tracking-[0.8px] text-[#95a49a] uppercase">
        Application details · Attempt {application.attemptNumber}
      </p>
      <div className="flex min-w-0 items-center gap-3.5">
        <CompanyLogo name={opportunity.companyName} />
        <div className="min-w-0">
          <SheetTitle className="text-lg leading-tight font-bold tracking-[-0.6px] text-ink">
            {opportunity.title}
          </SheetTitle>
          <SheetDescription className="mt-1 text-xs text-[#8e9d92]">
            {opportunity.companyName}
            {opportunity.location ? ` · ${opportunity.location}` : ""} · Applied{" "}
            {formatDateOnly(application.appliedOn)}
          </SheetDescription>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <StageBadge
          name={application.stage.name}
          category={application.stage.category}
          color={application.stage.color}
        />
        {application.status === "CLOSED" ? <ClosedBadge outcome={application.outcome} /> : null}
        {application.status === "PAUSED" ? <StatusBadge label="Paused" tone="amber" /> : null}
        {application.status === "ACTIVE" ? <StatusBadge label="Active" tone="green" /> : null}
        <PriorityBadge priority={opportunity.priority} />
      </div>
    </SheetHeader>
  );
}

function PeekFacts({ application, timezone }: { application: ApplicationDetail; timezone: string }) {
  const { opportunity } = application;
  return (
    <div className="mt-5 grid grid-cols-2 gap-3">
      <DetailFact label="Salary range">
        {formatSalaryRange({
          min: opportunity.salaryMin,
          max: opportunity.salaryMax,
          currency: opportunity.currency,
          period: opportunity.salaryPeriod,
        })}
      </DetailFact>
      <DetailFact label="Work arrangement">
        {opportunity.workArrangement ? WORK_ARRANGEMENT_LABEL[opportunity.workArrangement] : "Not specified"}
      </DetailFact>
      <DetailFact label="Date applied">{formatDateOnly(application.appliedOn)}</DetailFact>
      <DetailFact label="In stage since">
        {formatInTimeZone(application.stageChangedAt, timezone, "MMM d, yyyy")}
      </DetailFact>
    </div>
  );
}

function NextInterview({ interview, timezone }: { interview: InterviewDto; timezone: string }) {
  return (
    <div className="rounded-[10px] border border-[#eff2ee] bg-[#f8faf7] p-3">
      <strong className="block text-xs text-[#365343]">{interview.title}</strong>
      <span className="mt-1 block text-[11px] text-[#829082]">
        {INTERVIEW_TYPE_LABEL[interview.type]}
        {interview.startsAt
          ? ` · ${formatInTimeZone(interview.startsAt, timezone, "EEE, MMM d · h:mm a")}`
          : ""}
      </span>
    </div>
  );
}

function OpenTasks({ tasks, timezone }: { tasks: TaskItem[]; timezone: string }) {
  return (
    <ul className="divide-y divide-line-soft rounded-[10px] border border-[#eff2ee]">
      {tasks.map((task) => (
        <li key={task.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
          <span className="min-w-0 truncate text-xs font-semibold text-[#365343]">{task.title}</span>
          <span className="flex-none text-[10px] text-[#98a49d]">
            {task.dueAt ? `Due ${formatInTimeZone(task.dueAt, timezone, "MMM d")}` : "No due date"}
          </span>
        </li>
      ))}
    </ul>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="rounded-[9px] bg-[#f4f7f2] px-3 py-2.5 text-[11px] text-[#829082]">{children}</p>;
}

function PeekNotFound() {
  return (
    <SheetHeader className="px-5 pt-6 pr-12 sm:px-7">
      <SheetTitle>Application not found</SheetTitle>
      <SheetDescription className="text-xs">
        It may have been deleted. Close this panel to go back.
      </SheetDescription>
    </SheetHeader>
  );
}

/** Loading state; keeps a dialog title so the drawer stays labelled while data streams in. */
export function ApplicationPeekSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-5 pt-6 sm:px-7" aria-busy>
      <SheetTitle className="sr-only">Loading application</SheetTitle>
      <SheetDescription className="sr-only">Fetching the application summary.</SheetDescription>
      <Skeleton className="h-3 w-40" />
      <div className="flex items-center gap-3.5">
        <Skeleton className="size-11 rounded-xl" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-16 rounded-[10px]" />
        ))}
      </div>
      <Skeleton className="h-14 rounded-[10px]" />
    </div>
  );
}
