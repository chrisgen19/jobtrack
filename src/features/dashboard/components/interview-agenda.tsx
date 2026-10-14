import { ArrowRight, CalendarDays } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { Panel, PanelHeader } from "@/components/shared/panel";
import { formatInTimeZone } from "@/lib/dates";
import { INTERVIEW_MODE_LABEL } from "@/lib/labels";
import type { DashboardInterview } from "../data";

export function DateChip({ date, timezone }: { date: Date; timezone: string }) {
  return (
    <div className="flex h-[46px] w-[43px] flex-none flex-col items-center justify-center rounded-[10px] bg-[#f0f5f0] text-brand">
      <span className="text-[9px] font-bold tracking-[0.6px] uppercase">
        {formatInTimeZone(date, timezone, "MMM")}
      </span>
      <b className="text-[17px] leading-tight">{formatInTimeZone(date, timezone, "d")}</b>
    </div>
  );
}

export function InterviewAgenda({
  interviews,
  timezone,
}: {
  interviews: DashboardInterview[];
  timezone: string;
}) {
  return (
    <Panel className="pb-3">
      <PanelHeader
        title="Upcoming interviews"
        description="Your next conversations"
        action={
          <Link
            href="/calendar"
            className="flex items-center gap-1 text-[11px] font-bold text-brand hover:underline"
          >
            Calendar <ArrowRight className="size-3" aria-hidden />
          </Link>
        }
      />
      {interviews.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No interviews scheduled"
          description="Schedule interview rounds from an application to see them here."
          className="py-8"
        />
      ) : (
        <ul>
          {interviews.slice(0, 4).map((interview) => (
            <li key={interview.id} className="border-t border-[#f1f3f0]">
              <Link
                href={`/applications/${interview.applicationId}?tab=interviews`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[#fbfdfa] sm:px-6"
              >
                <DateChip date={interview.startsAt} timezone={timezone} />
                <div className="min-w-0 flex-1">
                  <strong className="block truncate text-xs">{interview.title}</strong>
                  <span className="mt-1 block truncate text-[10px] text-[#9aa59e]">
                    {interview.company} · {INTERVIEW_MODE_LABEL[interview.mode]}
                  </span>
                </div>
                <span className="text-[10px] whitespace-nowrap text-[#687a70]">
                  {formatInTimeZone(interview.startsAt, timezone, "h:mm a")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
