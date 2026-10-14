import "server-only";
import type { Priority, TaskStatus, TaskType } from "@/generated/prisma/enums";
import { recordActivity } from "@/features/activity/record";
import { afterTaskChange, beforeSourcesDeleted } from "@/features/integrations/side-effects";
import { requireWorkspace } from "@/features/workspace/data";
import { DomainError, NotFoundError } from "@/lib/action-result";
import { dayBoundsUtc, todayInTimeZone, zonedToUtc } from "@/lib/dates";
import { prisma, type TransactionClient } from "@/lib/prisma";
import { DEFAULT_DUE_TIME, type CreateTaskInput, type UpdateTaskInput } from "./schemas";

/** Open tasks due today or earlier (sidebar badge). */
export async function countDueTasks(): Promise<number> {
  const { user, preferences } = await requireWorkspace();
  const { end } = dayBoundsUtc(todayInTimeZone(preferences.timezone), preferences.timezone);
  return prisma.task.count({ where: { userId: user.id, status: "OPEN", dueAt: { lt: end } } });
}

/** Resolves and verifies the optional application/opportunity link. */
async function resolveLinks(
  tx: TransactionClient,
  userId: string,
  input: { applicationId?: string; opportunityId?: string },
): Promise<{ applicationId: string | null; opportunityId: string | null }> {
  if (input.applicationId) {
    const application = await tx.application.findFirst({
      where: { id: input.applicationId, userId },
      select: { id: true, opportunityId: true },
    });
    if (!application) throw new NotFoundError("Application");
    return { applicationId: application.id, opportunityId: application.opportunityId };
  }
  if (input.opportunityId) {
    const opportunity = await tx.jobOpportunity.findFirst({
      where: { id: input.opportunityId, userId },
      select: { id: true },
    });
    if (!opportunity) throw new NotFoundError("Job");
    return { applicationId: null, opportunityId: opportunity.id };
  }
  return { applicationId: null, opportunityId: null };
}

function dueAtFrom(input: { dueDate?: string; dueTime?: string }, timezone: string): Date | null {
  return input.dueDate ? zonedToUtc(input.dueDate, input.dueTime ?? DEFAULT_DUE_TIME, timezone) : null;
}

export async function createTask(input: CreateTaskInput): Promise<string> {
  const { user, preferences } = await requireWorkspace();
  return prisma.$transaction(async (tx) => {
    const links = await resolveLinks(tx, user.id, input);
    const dueAt = dueAtFrom(input, preferences.timezone);
    const task = await tx.task.create({
      data: {
        userId: user.id,
        ...links,
        title: input.title,
        description: input.description ?? null,
        type: input.type,
        priority: input.priority,
        dueAt,
        reminderMinutesBefore: dueAt ? (input.reminderMinutesBefore ?? null) : null,
      },
      select: { id: true },
    });
    await afterTaskChange(tx, user.id, task.id);
    return task.id;
  });
}

export async function updateTask(input: UpdateTaskInput): Promise<void> {
  const { user, preferences } = await requireWorkspace();
  await prisma.$transaction(async (tx) => {
    const existing = await tx.task.findFirst({
      where: { id: input.taskId, userId: user.id },
      select: { id: true, dueAt: true },
    });
    if (!existing) throw new NotFoundError("Task");
    const links = await resolveLinks(tx, user.id, input);
    const dueAt = dueAtFrom(input, preferences.timezone);
    const dueChanged = dueAt?.getTime() !== existing.dueAt?.getTime();
    await tx.task.update({
      where: { id: existing.id },
      data: {
        ...links,
        title: input.title,
        description: input.description ?? null,
        type: input.type,
        priority: input.priority,
        dueAt,
        reminderMinutesBefore: dueAt ? (input.reminderMinutesBefore ?? null) : null,
        ...(dueChanged ? { scheduleRevision: { increment: 1 } } : {}),
      },
    });
    await afterTaskChange(tx, user.id, existing.id);
  });
}

/** Marks a task done (logging it on the job's timeline) or reopens it. */
export async function setTaskCompleted(taskId: string, completed: boolean): Promise<void> {
  const { user } = await requireWorkspace();
  await prisma.$transaction(async (tx) => {
    const task = await tx.task.findFirst({
      where: { id: taskId, userId: user.id },
      select: { id: true, title: true, status: true, opportunityId: true, applicationId: true },
    });
    if (!task) throw new NotFoundError("Task");
    if (completed === (task.status === "COMPLETED")) return;
    await tx.task.update({
      where: { id: task.id },
      data: completed
        ? { status: "COMPLETED", completedAt: new Date() }
        : { status: "OPEN", completedAt: null },
    });
    if (completed && task.opportunityId) {
      await recordActivity(tx, {
        userId: user.id,
        opportunityId: task.opportunityId,
        applicationId: task.applicationId,
        type: "TASK_COMPLETED",
        summary: `Completed task: ${task.title}`,
        details: { taskId: task.id },
      });
    }
    await afterTaskChange(tx, user.id, task.id);
  });
}

/**
 * Accepts a system-suggested task so it behaves like any open task, with
 * the user's default reminder lead time.
 */
export async function acceptSuggestedTask(taskId: string): Promise<void> {
  const { user, preferences } = await requireWorkspace();
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.task.updateMany({
      where: { id: taskId, userId: user.id, status: "SUGGESTED" },
      data: { status: "OPEN", reminderMinutesBefore: preferences.taskReminderMinutes },
    });
    if (count === 0) throw new DomainError("This suggestion is no longer available.");
    await afterTaskChange(tx, user.id, taskId);
  });
}

/** Dismisses a task (suggested or open) without deleting it. */
export async function dismissTask(taskId: string): Promise<void> {
  const { user } = await requireWorkspace();
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.task.updateMany({
      where: { id: taskId, userId: user.id, status: { in: ["SUGGESTED", "OPEN"] } },
      data: { status: "DISMISSED" },
    });
    if (count === 0) throw new NotFoundError("Task");
    await afterTaskChange(tx, user.id, taskId);
  });
}

export async function deleteTask(taskId: string): Promise<void> {
  const { user } = await requireWorkspace();
  await prisma.$transaction(async (tx) => {
    await beforeSourcesDeleted(tx, user.id, { taskIds: [taskId] });
    const { count } = await tx.task.deleteMany({ where: { id: taskId, userId: user.id } });
    if (count === 0) throw new NotFoundError("Task");
  });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export type TaskItem = {
  id: string;
  title: string;
  description: string | null;
  type: TaskType;
  priority: Priority;
  status: TaskStatus;
  dueAt: Date | null;
  completedAt: Date | null;
  reminderMinutesBefore: number | null;
  applicationId: string | null;
  opportunityId: string | null;
  company: string | null;
  role: string | null;
  suggestionReason: string | null;
};

const taskSelect = {
  id: true,
  title: true,
  description: true,
  type: true,
  priority: true,
  status: true,
  dueAt: true,
  completedAt: true,
  reminderMinutesBefore: true,
  applicationId: true,
  opportunityId: true,
  suggestionReason: true,
  opportunity: { select: { title: true, company: { select: { name: true } } } },
} as const;

function toItem(
  row: {
    opportunity: { title: string; company: { name: string } } | null;
  } & Omit<TaskItem, "company" | "role">,
): TaskItem {
  const { opportunity, ...task } = row;
  return { ...task, company: opportunity?.company.name ?? null, role: opportunity?.title ?? null };
}

export type TaskGroups = {
  timezone: string;
  today: string;
  suggested: TaskItem[];
  overdue: TaskItem[];
  dueToday: TaskItem[];
  upcoming: TaskItem[];
  someday: TaskItem[];
  completed: TaskItem[];
};

/** Tasks grouped into Overdue / Today / Upcoming / No date / Completed in the user's timezone. */
export async function getTaskGroups(): Promise<TaskGroups> {
  const { user, preferences } = await requireWorkspace();
  const today = todayInTimeZone(preferences.timezone);
  const { start, end } = dayBoundsUtc(today, preferences.timezone);
  const [active, completed] = await Promise.all([
    prisma.task.findMany({
      where: { userId: user.id, status: { in: ["OPEN", "SUGGESTED"] } },
      orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { priority: "desc" }, { createdAt: "asc" }],
      take: 500,
      select: taskSelect,
    }),
    prisma.task.findMany({
      where: { userId: user.id, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      take: 30,
      select: taskSelect,
    }),
  ]);
  const items = active.map(toItem);
  const open = items.filter((task) => task.status === "OPEN");
  return {
    timezone: preferences.timezone,
    today,
    suggested: items.filter((task) => task.status === "SUGGESTED"),
    overdue: open.filter((task) => task.dueAt !== null && task.dueAt < start),
    dueToday: open.filter((task) => task.dueAt !== null && task.dueAt >= start && task.dueAt < end),
    upcoming: open.filter((task) => task.dueAt !== null && task.dueAt >= end),
    someday: open.filter((task) => task.dueAt === null),
    completed: completed.map(toItem),
  };
}

/** Open, suggested and recently completed tasks for one application. */
export async function listApplicationTasks(applicationId: string): Promise<TaskItem[]> {
  const { user } = await requireWorkspace();
  const rows = await prisma.task.findMany({
    where: { userId: user.id, applicationId, status: { not: "DISMISSED" } },
    orderBy: [{ status: "asc" }, { dueAt: { sort: "asc", nulls: "last" } }],
    select: taskSelect,
  });
  return rows.map(toItem);
}

/** Open tasks due within [start, end) for the calendar. */
export async function listTasksBetween(start: Date, end: Date): Promise<TaskItem[]> {
  const { user } = await requireWorkspace();
  const rows = await prisma.task.findMany({
    where: { userId: user.id, status: "OPEN", dueAt: { gte: start, lt: end } },
    orderBy: { dueAt: "asc" },
    select: taskSelect,
  });
  return rows.map(toItem);
}

export type TaskTarget = { applicationId: string; label: string };

/** Applications a task can be linked to (open ones first). */
export async function listTaskTargets(): Promise<TaskTarget[]> {
  const { user } = await requireWorkspace();
  const rows = await prisma.application.findMany({
    where: { userId: user.id },
    orderBy: [{ status: "asc" }, { appliedOn: "desc" }],
    take: 300,
    select: {
      id: true,
      attemptNumber: true,
      status: true,
      opportunity: { select: { title: true, company: { select: { name: true } } } },
    },
  });
  return rows.map((row) => ({
    applicationId: row.id,
    label: `${row.opportunity.title} · ${row.opportunity.company.name}${row.attemptNumber > 1 ? ` (attempt ${row.attemptNumber})` : ""}${row.status === "CLOSED" ? " · closed" : ""}`,
  }));
}
