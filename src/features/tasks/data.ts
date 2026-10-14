import "server-only";
import { NotFoundError } from "@/lib/action-result";
import { requireWorkspace } from "@/features/workspace/data";
import { dayBoundsUtc, todayInTimeZone } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

/** Open tasks due today or earlier (sidebar badge). */
export async function countDueTasks(): Promise<number> {
  const { user, preferences } = await requireWorkspace();
  const { end } = dayBoundsUtc(todayInTimeZone(preferences.timezone), preferences.timezone);
  return prisma.task.count({ where: { userId: user.id, status: "OPEN", dueAt: { lt: end } } });
}

/** Marks a task done or reopens it. */
export async function setTaskCompleted(taskId: string, completed: boolean): Promise<void> {
  const { user } = await requireWorkspace();
  const { count } = await prisma.task.updateMany({
    where: { id: taskId, userId: user.id, status: { in: completed ? ["OPEN", "SUGGESTED"] : ["COMPLETED"] } },
    data: completed
      ? { status: "COMPLETED", completedAt: new Date() }
      : { status: "OPEN", completedAt: null },
  });
  if (count === 0) {
    const exists = await prisma.task.count({ where: { id: taskId, userId: user.id } });
    if (!exists) throw new NotFoundError("Task");
  }
}
