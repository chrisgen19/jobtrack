import { History } from "lucide-react";
import type { ActivityType } from "@/generated/prisma/enums";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDateOnly, formatInTimeZone } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type TimelineItem = {
  id: string;
  type: ActivityType;
  summary: string;
  occurredAt: Date;
  /** Date-only events (employer response): shown as this date, without a time. */
  displayDate?: string | null;
  attemptNumber?: number | null;
};

const DOT_COLOR: Partial<Record<ActivityType, string>> = {
  APPLICATION_SUBMITTED: "bg-[#8c96c8]",
  STAGE_CHANGED: "bg-[#5bafa0]",
  INTERVIEW_SCHEDULED: "bg-[#a884bc]",
  INTERVIEW_RESCHEDULED: "bg-[#d0a16d]",
  INTERVIEW_CANCELLED: "bg-[#c9a19a]",
  OFFER_RECEIVED: "bg-[#4ba374]",
  OFFER_ACCEPTED: "bg-[#2d905b]",
  APPLICATION_CLOSED: "bg-[#a2aaa4]",
  EMPLOYER_RESPONSE_RECEIVED: "bg-[#6184b4]",
};

/** Vertical history list from the mockup's "Timeline" tab. */
export function ActivityTimeline({
  events,
  timezone,
  showAttempt,
}: {
  events: TimelineItem[];
  timezone: string;
  showAttempt?: boolean;
}) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No activity yet"
        description="Changes to this job will be recorded here."
        className="py-8"
      />
    );
  }
  return (
    <ol className="ml-1.5 border-l-[1.5px] border-[#dfe9df] pl-5">
      {events.map((event) => (
        <li key={event.id} className="relative mb-5 last:mb-0">
          <span
            className={cn(
              "absolute top-1 -left-[26px] size-2.5 rounded-full border-[3px] border-white outline outline-1 outline-[#deede0]",
              DOT_COLOR[event.type] ?? "bg-[#94c2a8]",
            )}
            aria-hidden
          />
          <strong className="text-xs">{event.summary}</strong>
          <span className="mt-1 block text-[10px] text-[#9ba79d]">
            {event.displayDate
              ? formatDateOnly(event.displayDate)
              : formatInTimeZone(event.occurredAt, timezone, "MMM d, yyyy · h:mm a")}
            {showAttempt && event.attemptNumber ? ` · Attempt ${event.attemptNumber}` : ""}
          </span>
        </li>
      ))}
    </ol>
  );
}
