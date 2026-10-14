import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { StatusBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCalendarMonth, type CalendarEvent } from "@/features/calendar/data";
import { isValidMonth, monthOf, shiftMonth } from "@/features/calendar/month";
import { RescheduleButton } from "@/features/interviews/components/reschedule-button";
import { requireWorkspace } from "@/features/workspace/data";
import { formatDateOnly, isValidDateOnly, supportedTimeZones, todayInTimeZone } from "@/lib/dates";
import { INTERVIEW_MODE_LABEL, INTERVIEW_STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Calendar" };

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export default function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  return (
    <>
      <PageHeader
        eyebrow="Interview & task schedule"
        title="Your calendar"
        description="A simple view of interviews, deadlines, and follow-ups."
      />
      <Suspense fallback={<Skeleton className="h-[640px] rounded-2xl" />}>
        <Calendar searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function timeLabel(time: string | null): string {
  if (!time) return "All day";
  const [hours, minutes] = time.split(":").map(Number);
  return `${((hours! + 11) % 12) + 1}:${String(minutes).padStart(2, "0")} ${hours! < 12 ? "AM" : "PM"}`;
}

const CHIP: Record<CalendarEvent["kind"], string> = {
  interview: "bg-[#e9f3e9] text-[#3c7d62]",
  task: "bg-[#fef1de] text-[#aa7a35]",
  deadline: "bg-[#edf5fa] text-[#5e86a7]",
};

async function Calendar({ searchParams }: { searchParams: PageProps<"/calendar">["searchParams"] }) {
  const [query, { preferences }] = await Promise.all([searchParams, requireWorkspace()]);
  const today = todayInTimeZone(preferences.timezone);
  const selected = typeof query.day === "string" && isValidDateOnly(query.day) ? query.day : today;
  const month =
    typeof query.month === "string" && isValidMonth(query.month) ? query.month : monthOf(selected);
  const data = await getCalendarMonth(month);
  const weekdays = [...WEEKDAYS.slice(data.weekStartsOn), ...WEEKDAYS.slice(0, data.weekStartsOn)];
  const dayEvents = data.eventsByDate[selected] ?? [];
  const href = (next: { month?: string; day?: string }) =>
    `/calendar?month=${next.month ?? month}${next.day ? `&day=${next.day}` : `&day=${selected}`}`;
  const timeZones = supportedTimeZones();

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
      <Panel className="p-4 sm:p-5">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-bold tracking-[-0.5px]">
            {formatDateOnly(`${month}-01`, "MMMM yyyy")}
          </h2>
          <div className="flex items-center gap-1.5">
            <Button asChild variant="ghost" size="icon" aria-label="Previous month">
              <Link href={href({ month: shiftMonth(month, -1) })} scroll={false}>
                <ChevronLeft aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/calendar?month=${monthOf(today)}&day=${today}`} scroll={false}>
                Today
              </Link>
            </Button>
            <Button asChild variant="ghost" size="icon" aria-label="Next month">
              <Link href={href({ month: shiftMonth(month, 1) })} scroll={false}>
                <ChevronRight aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
        <div className="mb-2 grid grid-cols-7" aria-hidden>
          {weekdays.map((day) => (
            <span key={day} className="p-1.5 text-center text-[10px] font-bold text-[#9eaaa2]">
              {day}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 border-t border-l border-[#edf0ed]">
          {data.cells.map((cell) => {
            const events = data.eventsByDate[cell.date] ?? [];
            return (
              <Link
                key={cell.date}
                href={href({ month, day: cell.date })}
                scroll={false}
                aria-label={`${formatDateOnly(cell.date, "EEEE, MMMM d")}: ${events.length} event${events.length === 1 ? "" : "s"}`}
                aria-current={cell.date === selected ? "date" : undefined}
                className={cn(
                  "flex h-[77px] min-w-0 flex-col gap-1 border-r border-b border-[#edf0ed] bg-white px-1 py-1.5 hover:bg-[#f5faf6] sm:h-[95px] sm:px-1.5 sm:py-2",
                  !cell.inMonth && "bg-[#fbfcfa] text-[#c8cec9]",
                  cell.date === selected && "bg-[#ecf6ee] shadow-[inset_0_0_0_1px_#a1cfb0]",
                )}
              >
                <span
                  className={cn(
                    "grid size-[22px] place-items-center rounded-full text-[10px] font-bold text-[#607267] sm:size-[25px] sm:text-[11px]",
                    !cell.inMonth && "text-[#c8cec9]",
                    cell.date === data.today && "bg-brand text-white",
                  )}
                >
                  {cell.day}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  {events.slice(0, 2).map((event) => (
                    <span
                      key={`${event.kind}-${event.id}`}
                      className={cn(
                        "truncate rounded px-1 py-0.5 text-[8px] font-bold sm:text-[9px]",
                        CHIP[event.kind],
                      )}
                    >
                      {event.kind === "interview"
                        ? event.interview.company
                        : event.kind === "task"
                          ? "Task due"
                          : "Deadline"}
                    </span>
                  ))}
                  {events.length > 2 ? (
                    <span className="text-[9px] text-[#9eafa0]">+{events.length - 2} more</span>
                  ) : null}
                </span>
              </Link>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-subtle">
          <span className="flex items-center gap-1.5">
            <i className="size-2 rounded-sm bg-[#cfe6d3]" /> Interview
          </span>
          <span className="flex items-center gap-1.5">
            <i className="size-2 rounded-sm bg-[#fbe0b8]" /> Task due
          </span>
          <span className="flex items-center gap-1.5">
            <i className="size-2 rounded-sm bg-[#d3e5f2]" /> Application deadline
          </span>
          <span>Times shown in {data.timezone.replaceAll("_", " ")}</span>
        </div>
      </Panel>

      <Panel className="p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-bold">Daily agenda</h2>
            <p className="mt-1 text-xs text-[#8b9d91]">{formatDateOnly(selected, "EEEE, MMMM d, yyyy")}</p>
          </div>
          <StatusBadge label={`${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"}`} tone="green" />
        </div>
        {dayEvents.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Nothing scheduled"
            description="Enjoy a little breathing room or add an interview."
            className="py-10"
          />
        ) : (
          <ul>
            {dayEvents.map((event) => (
              <li
                key={`${event.kind}-${event.id}`}
                className="flex gap-3 border-b border-[#edf1ed] py-4 last:border-0"
              >
                <span
                  className={cn(
                    "w-16 flex-none text-[11px] font-bold",
                    event.kind === "interview" ? "text-brand" : "text-[#ab8b4b]",
                  )}
                >
                  {event.kind === "task" ? "TASK" : event.kind === "deadline" ? "DUE" : timeLabel(event.time)}
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={event.href} className="text-xs font-bold hover:underline">
                    {event.title}
                  </Link>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#9aa59f]">
                    {event.subtitle}
                    {event.kind === "interview"
                      ? ` · ${INTERVIEW_MODE_LABEL[event.mode]} · ${INTERVIEW_STATUS_LABEL[event.status]}`
                      : ""}
                    {event.kind === "task" && event.time !== "09:00" ? ` · ${timeLabel(event.time)}` : ""}
                  </p>
                  {event.kind === "interview" &&
                  (event.status === "SCHEDULED" || event.status === "RESCHEDULED") ? (
                    <div className="mt-2">
                      <RescheduleButton
                        interviewId={event.interview.id}
                        title={event.interview.title}
                        startsAt={event.interview.startsAt}
                        endsAt={event.interview.endsAt}
                        timezone={event.interview.timezone}
                        timeZones={timeZones}
                      />
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 border-t border-[#eef1ed] pt-5">
          <h3 className="mb-3 text-[11px] font-extrabold tracking-[1px] text-[#87998c] uppercase">
            Coming up
          </h3>
          {data.upcoming.length === 0 ? (
            <p className="text-[11px] text-faint">No upcoming interviews.</p>
          ) : (
            <ul>
              {data.upcoming.map((event) => (
                <li key={event.id}>
                  <Link
                    href={href({ month: monthOf(event.date), day: event.date })}
                    scroll={false}
                    className="flex items-center justify-between gap-2 py-2 text-[11px] hover:underline"
                  >
                    <span className="truncate text-[#627a69]">
                      {event.kind === "interview" ? event.interview.company : ""} · {event.title}
                    </span>
                    <span className="text-[10px] whitespace-nowrap text-[#9aa69d]">
                      {formatDateOnly(event.date, "MMM d")} · {timeLabel(event.time)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>
    </div>
  );
}
