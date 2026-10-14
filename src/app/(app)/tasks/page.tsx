import { CalendarDays, ListChecks, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { StatusBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Panel, PanelHeader } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NewTaskButton } from "@/features/tasks/components/new-task-button";
import { TaskList } from "@/features/tasks/components/task-list";
import { getTaskGroups, listTaskTargets, type TaskItem } from "@/features/tasks/data";
import { requireWorkspace } from "@/features/workspace/data";

export const metadata: Metadata = { title: "Tasks" };

export default function TasksPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[520px] rounded-2xl" />}>
      <Tasks />
    </Suspense>
  );
}

const TIPS = [
  ["After applying", "Create a follow-up for the following week."],
  ["Before an interview", "Prepare questions, examples, and your meeting link."],
  ["After an interview", "Write down what happened and set the next action."],
] as const;

async function Tasks() {
  const [groups, targets, { preferences }] = await Promise.all([
    getTaskGroups(),
    listTaskTargets(),
    requireWorkspace(),
  ]);
  const remaining =
    groups.overdue.length + groups.dueToday.length + groups.upcoming.length + groups.someday.length;
  const total = remaining + groups.completed.length;
  const sections: [string, TaskItem[]][] = [
    ["Suggested for you", groups.suggested],
    ["Overdue", groups.overdue],
    ["Today", groups.dueToday],
    ["Upcoming", groups.upcoming],
    ["No due date", groups.someday],
    ["Completed recently", groups.completed],
  ];

  return (
    <>
      <PageHeader
        eyebrow="Stay on top of things"
        title="Tasks & follow-ups"
        description="Small actions that keep your job search moving forward."
        actions={
          <NewTaskButton
            targets={targets}
            defaultDueDate={groups.today}
            defaultReminderMinutes={preferences.taskReminderMinutes}
          />
        }
      />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,1fr)]">
        <Panel className="pb-3">
          <PanelHeader
            title="Your action list"
            description={`${remaining} remaining · ${groups.completed.length} completed recently`}
            action={
              total > 0 ? (
                <StatusBadge
                  label={`${Math.round((100 * groups.completed.length) / total)}% complete`}
                  tone="green"
                />
              ) : null
            }
          />
          {total + groups.suggested.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="No tasks yet"
              description="Add follow-ups, interview prep and other next steps."
            />
          ) : (
            sections.map(([label, tasks]) =>
              tasks.length ? (
                <section key={label} aria-label={label}>
                  <h2 className="px-4 pt-5 pb-2 text-[11px] font-extrabold tracking-[1px] text-[#9aa89f] uppercase sm:px-6">
                    {label} <span className="text-[#bcc8be]">· {tasks.length}</span>
                  </h2>
                  <TaskList tasks={tasks} timezone={groups.timezone} today={groups.today} targets={targets} />
                </section>
              ) : null,
            )
          )}
        </Panel>
        <Panel className="p-6">
          <span className="grid size-10 place-items-center rounded-xl bg-[#edf7ef] text-brand" aria-hidden>
            <Sparkles className="size-5" />
          </span>
          <h2 className="mt-4 mb-2 text-base font-bold">Stay in motion.</h2>
          <p className="text-xs leading-relaxed text-[#8e9d92]">
            Job hunting is easier when you know exactly what to do next. A few minutes of planning can save
            hours of uncertainty.
          </p>
          <ol className="mt-5 flex flex-col gap-4">
            {TIPS.map(([title, text], index) => (
              <li key={title} className="flex items-start gap-2.5">
                <span className="grid size-6 flex-none place-items-center rounded-lg bg-[#e9f3eb] text-[11px] font-extrabold text-[#37805c]">
                  {index + 1}
                </span>
                <span>
                  <strong className="text-xs">{title}</strong>
                  <span className="mt-1 block text-[11px] text-[#8e9d92]">{text}</span>
                </span>
              </li>
            ))}
          </ol>
          <Button asChild variant="outline" className="mt-6 w-full">
            <Link href="/calendar">
              <CalendarDays aria-hidden /> Check your calendar
            </Link>
          </Button>
        </Panel>
      </div>
    </>
  );
}
