import { AlertCircle, CalendarClock, Clock, Hourglass } from "lucide-react";
import Link from "next/link";
import { Panel, PanelHeader } from "@/components/shared/panel";
import { formatInTimeZone } from "@/lib/dates";
import type { DashboardData } from "../data";

/**
 * The "act on this next" list: overdue tasks first, then interviews in the
 * next 48 hours, then active applications that have gone quiet.
 */
export function NeedsAttention({ data }: { data: DashboardData }) {
  const { overdueTasks, imminentInterviews, staleApplications } = data.needsAttention;
  const total = overdueTasks.length + imminentInterviews.length + staleApplications.length;

  return (
    <Panel className="mb-5 border-[#f0dfc9] bg-[#fffdf9]">
      <PanelHeader
        title="Needs attention"
        description={
          total === 0 ? "You're all caught up." : `${total} item${total === 1 ? "" : "s"} worth a look today`
        }
        action={
          <span
            className="grid size-[30px] place-items-center rounded-[10px] bg-tone-orange-bg text-tone-orange"
            aria-hidden
          >
            <AlertCircle className="size-[15px]" />
          </span>
        }
      />
      {total === 0 ? (
        <p className="px-4 pb-5 text-xs text-subtle sm:px-6">
          No overdue tasks, no interviews in the next 48 hours and no stalled applications. Nice work.
        </p>
      ) : (
        <ul className="grid gap-px overflow-hidden rounded-b-2xl border-t border-[#f3eadc] bg-[#f3eadc] md:grid-cols-3">
          <AttentionColumn icon={Clock} title="Overdue tasks" empty="Nothing overdue">
            {overdueTasks.map((task) => (
              <AttentionItem
                key={task.id}
                href="/tasks"
                title={task.title}
                meta={`${task.company ?? "General"} · due ${task.dueAt ? formatInTimeZone(task.dueAt, data.timezone, "MMM d") : ""}`}
                tone="red"
              />
            ))}
          </AttentionColumn>
          <AttentionColumn icon={CalendarClock} title="Interviews in 48 hours" empty="None coming up">
            {imminentInterviews.map((interview) => (
              <AttentionItem
                key={interview.id}
                href={`/applications/${interview.applicationId}?tab=interviews`}
                title={interview.title}
                meta={`${interview.company} · ${formatInTimeZone(interview.startsAt, data.timezone, "EEE h:mm a")}`}
              />
            ))}
          </AttentionColumn>
          <AttentionColumn icon={Hourglass} title="May need a follow-up" empty="No quiet applications">
            {staleApplications.map((application) => (
              <AttentionItem
                key={application.id}
                href={`/applications/${application.id}`}
                title={`${application.role} · ${application.company}`}
                meta={`${application.stageName} for ${application.daysSinceUpdate} days`}
              />
            ))}
          </AttentionColumn>
        </ul>
      )}
    </Panel>
  );
}

function AttentionColumn({
  icon: Icon,
  title,
  empty,
  children,
}: {
  icon: typeof Clock;
  title: string;
  empty: string;
  children: React.ReactNode[];
}) {
  return (
    <li className="bg-[#fffdf9] px-4 py-4 sm:px-6">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-bold tracking-[0.6px] text-[#a08562] uppercase">
        <Icon className="size-3.5" aria-hidden /> {title}
      </div>
      {children.length ? (
        <ul className="flex flex-col gap-1">{children}</ul>
      ) : (
        <p className="text-[11px] text-faint">{empty}</p>
      )}
    </li>
  );
}

function AttentionItem({
  href,
  title,
  meta,
  tone,
}: {
  href: string;
  title: string;
  meta: string;
  tone?: "red";
}) {
  return (
    <li>
      <Link href={href} className="-mx-2 block rounded-lg px-2 py-1.5 hover:bg-[#fbf3e6]">
        <span className="block truncate text-xs font-semibold">{title}</span>
        <span
          className={`block truncate text-[10px] ${tone === "red" ? "font-bold text-[#c66659]" : "text-[#a1aba5]"}`}
        >
          {meta}
        </span>
      </Link>
    </li>
  );
}
