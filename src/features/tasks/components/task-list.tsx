"use client";

import { Check } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import type { TaskType } from "@/generated/prisma/enums";
import { formatInTimeZone, todayInTimeZone } from "@/lib/dates";
import { TASK_TYPE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { setTaskCompletedAction } from "../actions";

export type TaskListItem = {
  id: string;
  title: string;
  type: TaskType;
  dueAt: Date | null;
  company: string | null;
  completed?: boolean;
};

interface TaskListProps {
  tasks: TaskListItem[];
  timezone: string;
  today: string;
  compact?: boolean;
}

export function TaskList({ tasks, timezone, today, compact }: TaskListProps) {
  return (
    <ul>
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} timezone={timezone} today={today} compact={compact} />
      ))}
    </ul>
  );
}

function TaskRow({
  task,
  timezone,
  today,
  compact,
}: {
  task: TaskListItem;
  timezone: string;
  today: string;
  compact?: boolean;
}) {
  const [completed, setOptimisticCompleted] = useOptimistic(task.completed ?? false);
  const [, startTransition] = useTransition();
  const dueDay = task.dueAt ? todayInTimeZone(timezone, task.dueAt) : null;
  const overdue = !completed && dueDay !== null && dueDay < today;

  function toggle() {
    startTransition(async () => {
      setOptimisticCompleted(!completed);
      const result = await setTaskCompletedAction({ taskId: task.id, completed: !completed });
      if (!result.ok) toast.error(result.error);
      else if (!completed) toast.success("Task completed");
    });
  }

  return (
    <li
      className={cn(
        "flex items-start gap-2.5 border-t border-[#f1f3f0] px-4 sm:px-6",
        compact ? "py-3" : "py-3.5",
      )}
    >
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
        <div className="mt-1 text-[10px] text-[#a1aba5]">
          {task.company ?? "General"} · {TASK_TYPE_LABEL[task.type]}
        </div>
      </div>
      {task.dueAt ? (
        <span
          className={cn(
            "ml-auto text-[10px] whitespace-nowrap text-[#a0aaa4]",
            overdue && "font-bold text-[#c66659]",
          )}
        >
          {overdue ? "Overdue · " : ""}
          {formatInTimeZone(task.dueAt, timezone, "MMM d")}
        </span>
      ) : null}
    </li>
  );
}
