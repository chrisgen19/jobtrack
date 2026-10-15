import "server-only";
import type { InterviewMode, InterviewStatus } from "@/generated/prisma/enums";
import { listInterviewsBetween, type CalendarInterview } from "@/features/interviews/data";
import { listOfferDeadlines } from "@/features/offers/data";
import { listApplicationDeadlines } from "@/features/opportunities/data";
import { listTasksBetween } from "@/features/tasks/data";
import { requireWorkspace } from "@/features/workspace/data";
import { addDaysToDateOnly, dayBoundsUtc, todayInTimeZone, utcToZonedParts } from "@/lib/dates";
import { monthGrid, type MonthCell } from "./month";

export type CalendarEvent =
  | {
      kind: "interview";
      id: string;
      date: string;
      time: string;
      title: string;
      subtitle: string;
      status: InterviewStatus;
      mode: InterviewMode;
      href: string;
      interview: CalendarInterview;
    }
  | { kind: "task"; id: string; date: string; time: string; title: string; subtitle: string; href: string }
  | { kind: "deadline"; id: string; date: string; time: null; title: string; subtitle: string; href: string };

export type CalendarMonth = {
  timezone: string;
  today: string;
  weekStartsOn: number;
  cells: MonthCell[];
  eventsByDate: Record<string, CalendarEvent[]>;
  upcoming: CalendarEvent[];
};

/** Everything dated in the visible 6-week grid, grouped by local date. */
export async function getCalendarMonth(month: string): Promise<CalendarMonth> {
  const { preferences } = await requireWorkspace();
  const timezone = preferences.timezone;
  const today = todayInTimeZone(timezone);
  const cells = monthGrid(month, preferences.weekStartsOn);
  const first = cells[0]!.date;
  const last = cells.at(-1)!.date;
  const start = dayBoundsUtc(first, timezone).start;
  const end = dayBoundsUtc(last, timezone).end;
  const todayStart = dayBoundsUtc(today, timezone).start;
  const horizon = dayBoundsUtc(addDaysToDateOnly(today, 60), timezone).end;

  const [interviews, tasks, deadlines, offerDeadlines, upcomingInterviews] = await Promise.all([
    listInterviewsBetween(start, end),
    listTasksBetween(start, end),
    listApplicationDeadlines(first, last),
    listOfferDeadlines(first, last),
    listInterviewsBetween(todayStart, horizon),
  ]);

  const toInterviewEvent = (interview: CalendarInterview): CalendarEvent => {
    const parts = utcToZonedParts(interview.startsAt!, timezone);
    return {
      kind: "interview",
      id: interview.id,
      date: parts.date,
      time: parts.time,
      title: interview.title,
      subtitle: `${interview.company} · ${interview.role}`,
      status: interview.status,
      mode: interview.mode,
      href: `/applications/${interview.applicationId}?tab=interviews`,
      interview,
    };
  };

  const events: CalendarEvent[] = [
    ...interviews.map(toInterviewEvent),
    ...tasks.map((task): CalendarEvent => {
      const parts = utcToZonedParts(task.dueAt!, timezone);
      return {
        kind: "task",
        id: task.id,
        date: parts.date,
        time: parts.time,
        title: task.title,
        subtitle: task.company ?? "General task",
        href: task.applicationId ? `/applications/${task.applicationId}` : "/tasks",
      };
    }),
    ...deadlines.map((deadline): CalendarEvent => ({
      kind: "deadline",
      id: deadline.opportunityId,
      date: deadline.deadline,
      time: null,
      title: `Apply by: ${deadline.title}`,
      subtitle: deadline.company,
      href: `/jobs/${deadline.opportunityId}`,
    })),
    ...offerDeadlines.map((deadline): CalendarEvent => ({
      kind: "deadline",
      id: deadline.offerId,
      date: deadline.deadline,
      time: null,
      title: `Offer decision due: ${deadline.positionTitle}`,
      subtitle: deadline.company,
      href: `/applications/${deadline.applicationId}?tab=offers`,
    })),
  ];

  const eventsByDate: Record<string, CalendarEvent[]> = {};
  for (const event of events.sort((a, b) => (a.time ?? "00:00").localeCompare(b.time ?? "00:00"))) {
    (eventsByDate[event.date] ??= []).push(event);
  }

  return {
    timezone,
    today,
    weekStartsOn: preferences.weekStartsOn,
    cells,
    eventsByDate,
    upcoming: upcomingInterviews
      .filter((interview) => interview.status === "SCHEDULED" || interview.status === "RESCHEDULED")
      .slice(0, 5)
      .map(toInterviewEvent),
  };
}
