"use client";

import { Check, MoreHorizontal, Sparkles } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import type { Priority, TaskStatus, TaskType } from "@/generated/prisma/enums";
import { PriorityBadge } from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatInTimeZone, todayInTimeZone, utcToZonedParts } from "@/lib/dates";
import { TASK_TYPE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import {
  acceptSuggestedTaskAction,
  deleteTaskAction,
  dismissTaskAction,
  setTaskCompletedAction,
} from "../actions";
import type { TaskTarget } from "../data";
import { TaskDialog } from "./task-dialog";

export type TaskListItem = {
  id: string;
  title: string;
  type: TaskType;
  dueAt: Date | null;
  company: string | null;
  status?: TaskStatus;
  priority?: Priority;
  description?: string | null;
  applicationId?: string | null;
  reminderMinutesBefore?: number | null;
};

interface TaskListProps {
  tasks: TaskListItem[];
  timezone: string;
  today: string;
  compact?: boolean;
  /** Pass targets to enable the edit/delete menu. */
  targets?: TaskTarget[];
}

export function TaskList({ tasks, timezone, today, compact, targets }: TaskListProps) {
  return (
    <ul>
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          timezone={timezone}
          today={today}
          compact={compact}
          targets={targets}
        />
      ))}
    </ul>
  );
}

function run(action: () => Promise<{ ok: boolean; error?: string }>, success?: string) {
  return action().then((result) => {
    if (!result.ok) toast.error(result.error ?? "Something went wrong.");
    else if (success) toast.success(success);
  });
}

function TaskRow({
  task,
  timezone,
  today,
  compact,
  targets,
}: {
  task: TaskListItem;
  timezone: string;
  today: string;
  compact?: boolean;
  targets?: TaskTarget[];
}) {
  const [completed, setOptimisticCompleted] = useOptimistic(task.status === "COMPLETED");
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const suggested = task.status === "SUGGESTED";
  const dueDay = task.dueAt ? todayInTimeZone(timezone, task.dueAt) : null;
  const overdue = !completed && !suggested && dueDay !== null && dueDay < today;
  const dueParts = task.dueAt ? utcToZonedParts(task.dueAt, timezone) : null;

  function toggle() {
    startTransition(async () => {
      setOptimisticCompleted(!completed);
      await run(
        () => setTaskCompletedAction({ taskId: task.id, completed: !completed }),
        completed ? undefined : "Task completed",
      );
    });
  }

  return (
    <li
      className={cn(
        "flex items-start gap-2.5 border-t border-[#f1f3f0] px-4 sm:px-6",
        compact ? "py-3" : "py-3.5",
        suggested && "bg-[#fbfdf8]",
      )}
    >
      {suggested ? (
        <span
          className="mt-px grid size-[18px] flex-none place-items-center rounded-md bg-brand-soft text-brand"
          aria-hidden
        >
          <Sparkles className="size-3" />
        </span>
      ) : (
        <button
          type="button"
          onClick={toggle}
          aria-pressed={completed}
          aria-label={`${completed ? "Mark incomplete" : "Mark complete"}: ${task.title}`}
          className={cn(
            "mt-px grid size-[18px] flex-none place-items-center rounded-md border-[1.5px] border-[#cfd9d1] bg-white text-white hover:border-brand",
            completed && "border-brand bg-brand",
          )}
        >
          {completed ? <Check className="size-3" aria-hidden /> : null}
        </button>
      )}
      <div className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-xs leading-tight font-semibold",
            !compact && "text-[13px]",
            completed && "text-[#a1aaa2] line-through",
          )}
        >
          {task.title}
        </span>
        <div className="mt-1 flex flex-wrap items-center gap-x-1 text-[10px] text-[#a1aba5]">
          {suggested ? <span className="font-bold text-brand">Suggested ·</span> : null}
          {task.company ?? "General"} · {TASK_TYPE_LABEL[task.type]}
          {!compact && task.priority === "HIGH" ? (
            <PriorityBadge priority="HIGH" className="ml-1 py-0.5" />
          ) : null}
        </div>
        {suggested ? (
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              onClick={() =>
                startTransition(() =>
                  run(() => acceptSuggestedTaskAction({ taskId: task.id }), "Added to your tasks"),
                )
              }
            >
              Accept
            </Button>
            {targets ? (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                Edit
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                startTransition(() =>
                  run(() => dismissTaskAction({ taskId: task.id }), "Suggestion dismissed"),
                )
              }
            >
              Dismiss
            </Button>
          </div>
        ) : null}
      </div>
      {task.dueAt ? (
        <span
          className={cn(
            "ml-auto text-[10px] whitespace-nowrap text-[#a0aaa4]",
            overdue && "font-bold text-[#c66659]",
          )}
        >
          {overdue ? "Overdue · " : ""}
          {formatInTimeZone(task.dueAt, timezone, dueParts?.time === "09:00" ? "MMM d" : "MMM d, h:mm a")}
        </span>
      ) : null}
      {targets && !suggested ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" aria-label={`Actions for ${task.title}`}>
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditing(true)}>Edit</DropdownMenuItem>
            {!completed ? (
              <DropdownMenuItem
                onSelect={() =>
                  startTransition(() => run(() => dismissTaskAction({ taskId: task.id }), "Task dismissed"))
                }
              >
                Dismiss
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() =>
                startTransition(() => run(() => deleteTaskAction({ taskId: task.id }), "Task deleted"))
              }
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {targets ? (
        <TaskDialog
          open={editing}
          onOpenChange={setEditing}
          targets={targets}
          taskId={task.id}
          title={suggested ? "Edit suggested task" : undefined}
          defaultValues={{
            title: task.title,
            description: task.description ?? "",
            type: task.type,
            priority: task.priority ?? "MEDIUM",
            dueDate: dueParts?.date ?? "",
            dueTime: dueParts && dueParts.time !== "09:00" ? dueParts.time : "",
            applicationId: task.applicationId ?? "",
            reminderMinutesBefore:
              task.reminderMinutesBefore == null ? "" : String(task.reminderMinutesBefore),
          }}
        />
      ) : null}
    </li>
  );
}
