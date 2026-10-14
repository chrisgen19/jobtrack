import "server-only";
import type { NotificationType, ReminderChannel, ReminderStatus } from "@/generated/prisma/enums";
import { resyncUser } from "@/features/integrations/side-effects";
import { requireWorkspace } from "@/features/workspace/data";
import { DomainError } from "@/lib/action-result";
import { prisma } from "@/lib/prisma";
import type { NotificationPreferencesInput } from "./schemas";

export type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
};

const notificationSelect = {
  id: true,
  type: true,
  title: true,
  body: true,
  link: true,
  readAt: true,
  createdAt: true,
} as const;

export async function countUnreadNotifications(): Promise<number> {
  const { user } = await requireWorkspace();
  return prisma.notification.count({ where: { userId: user.id, readAt: null } });
}

export async function listNotifications(limit = 50): Promise<NotificationItem[]> {
  const { user } = await requireWorkspace();
  return prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: notificationSelect,
  });
}

export async function markNotificationRead(notificationId: string, read: boolean): Promise<void> {
  const { user } = await requireWorkspace();
  await prisma.notification.updateMany({
    where: { id: notificationId, userId: user.id },
    data: { readAt: read ? new Date() : null },
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  const { user } = await requireWorkspace();
  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
}

export type ReminderLogItem = {
  id: string;
  channel: ReminderChannel;
  status: ReminderStatus;
  remindAt: Date;
  sentAt: Date | null;
  lastError: string | null;
  label: string;
};

/** Recent and upcoming reminders with their delivery state (the reminder log). */
export async function listReminderLog(limit = 40): Promise<ReminderLogItem[]> {
  const { user } = await requireWorkspace();
  const rows = await prisma.reminder.findMany({
    where: { userId: user.id },
    orderBy: { remindAt: "desc" },
    take: limit,
    select: {
      id: true,
      channel: true,
      status: true,
      remindAt: true,
      sentAt: true,
      lastError: true,
      interview: { select: { title: true } },
      task: { select: { title: true } },
      offer: { select: { positionTitle: true } },
    },
  });
  return rows.map(({ interview, task, offer, ...row }) => ({
    ...row,
    label: interview
      ? `Interview: ${interview.title}`
      : task
        ? `Task: ${task.title}`
        : offer
          ? `Offer deadline: ${offer.positionTitle}`
          : "Reminder",
  }));
}

/**
 * Saves reminder preferences and re-plans every future reminder, so turning
 * a channel off cancels pending sends and turning it on schedules them.
 * Email reminders require a verified address.
 */
export async function updateNotificationPreferences(input: NotificationPreferencesInput): Promise<void> {
  const { user, preferences } = await requireWorkspace();
  if (input.emailReminders && !user.emailVerified)
    throw new DomainError("Verify your email address before turning on email reminders.");
  await prisma.$transaction(
    async (tx) => {
      await tx.userPreferences.update({ where: { userId: user.id }, data: input });
      await resyncUser(tx, user.id, { calendar: input.calendarSyncTasks !== preferences.calendarSyncTasks });
    },
    { timeout: 30_000 },
  );
}
