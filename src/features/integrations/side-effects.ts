import { planReminders, type ReminderSource } from "@/features/notifications/plan";
import { enqueueJob, removeJob } from "@/lib/jobs/queue";
import { toDateOnlyOrNull } from "@/lib/dates";
import type { DbClient, TransactionClient } from "@/lib/prisma";

/**
 * Side effects of interview/task/offer changes, run inside the same
 * transaction as the change (transactional outbox): reminder rows +
 * Graphile jobs, and Google Calendar sync jobs. External APIs are never
 * called here; the worker does that after commit.
 *
 * This module is shared with the worker and tests, so it must not import
 * `server-only` or anything from `next/*`.
 */

type Source = { interviewId: string } | { taskId: string } | { offerId: string };

async function loadPreferences(tx: DbClient, userId: string) {
  const [preferences, user] = await Promise.all([
    tx.userPreferences.findUnique({
      where: { userId },
      select: {
        timezone: true,
        inAppReminders: true,
        emailReminders: true,
        offerDeadlineReminders: true,
        calendarSyncTasks: true,
      },
    }),
    tx.user.findUnique({ where: { id: userId }, select: { emailVerified: true } }),
  ]);
  return {
    timezone: preferences?.timezone ?? "UTC",
    channels: {
      inApp: preferences?.inAppReminders ?? true,
      email: preferences?.emailReminders ?? false,
      emailVerified: user?.emailVerified ?? false,
    },
    offerDeadlineReminders: preferences?.offerDeadlineReminders ?? true,
    calendarSyncTasks: preferences?.calendarSyncTasks ?? false,
  };
}

/** Current state of a reminder source, or null when it no longer exists. */
export async function loadReminderSource(
  tx: DbClient,
  userId: string,
  source: Source,
  timezone: string,
  offerReminders: boolean,
): Promise<ReminderSource | null> {
  if ("interviewId" in source) {
    const interview = await tx.interview.findFirst({
      where: { id: source.interviewId, userId },
      select: {
        id: true,
        status: true,
        startsAt: true,
        reminderMinutesBefore: true,
        scheduleRevision: true,
        application: { select: { status: true } },
      },
    });
    if (!interview) return null;
    return {
      kind: "interview",
      id: interview.id,
      // A closed application's remaining interviews do not need reminders.
      status:
        interview.application.status === "CLOSED" && interview.status !== "COMPLETED"
          ? "CANCELLED"
          : interview.status,
      startsAt: interview.startsAt,
      minutesBefore: interview.reminderMinutesBefore,
      revision: interview.scheduleRevision,
    };
  }
  if ("taskId" in source) {
    const task = await tx.task.findFirst({
      where: { id: source.taskId, userId },
      select: { id: true, status: true, dueAt: true, reminderMinutesBefore: true, scheduleRevision: true },
    });
    return task
      ? {
          kind: "task",
          id: task.id,
          status: task.status,
          dueAt: task.dueAt,
          minutesBefore: task.reminderMinutesBefore,
          revision: task.scheduleRevision,
        }
      : null;
  }
  const offer = await tx.offer.findFirst({
    where: { id: source.offerId, userId },
    select: { id: true, status: true, decisionDeadline: true, applicationId: true, revisionNumber: true },
  });
  if (!offer) return null;
  // Only the latest revision of an offer carries the deadline reminder.
  const newer = await tx.offer.count({
    where: { userId, applicationId: offer.applicationId, revisionNumber: { gt: offer.revisionNumber } },
  });
  return {
    kind: "offer",
    id: offer.id,
    status: offer.status,
    decisionDeadline: toDateOnlyOrNull(offer.decisionDeadline),
    timezone,
    enabled: offerReminders && newer === 0,
  };
}

function sourceWhere(source: Source) {
  if ("interviewId" in source) return { interviewId: source.interviewId };
  if ("taskId" in source) return { taskId: source.taskId };
  return { offerId: source.offerId };
}

/**
 * Makes the reminder rows and jobs for one source match its current state:
 * cancels pending reminders that are no longer wanted (rescheduled,
 * cancelled, completed, preference turned off) and creates missing ones.
 * Sent reminders are never touched, so history is preserved.
 */
export async function syncReminders(
  tx: TransactionClient,
  userId: string,
  source: Source,
  now = new Date(),
): Promise<void> {
  const preferences = await loadPreferences(tx, userId);
  const state = await loadReminderSource(
    tx,
    userId,
    source,
    preferences.timezone,
    preferences.offerDeadlineReminders,
  );
  const desired = state ? planReminders(state, preferences.channels, now) : [];
  const desiredKeys = new Set(desired.map((item) => item.dedupeKey));

  const existing = await tx.reminder.findMany({
    where: { userId, ...sourceWhere(source) },
    select: { id: true, dedupeKey: true, status: true },
  });
  for (const reminder of existing) {
    if (reminder.status === "PENDING" && !desiredKeys.has(reminder.dedupeKey)) {
      await tx.reminder.update({
        where: { id: reminder.id },
        data: { status: "CANCELLED", cancelledAt: now },
      });
      await removeJob(tx, `reminder:${reminder.id}`);
    }
  }

  for (const planned of desired) {
    const reminder = await tx.reminder.upsert({
      where: { dedupeKey: planned.dedupeKey },
      create: {
        userId,
        ...sourceWhere(source),
        channel: planned.channel,
        remindAt: planned.remindAt,
        sourceRevision: planned.sourceRevision,
        dedupeKey: planned.dedupeKey,
      },
      update: {},
      select: { id: true, status: true },
    });
    if (reminder.status === "PENDING") {
      await enqueueJob(
        tx,
        "deliver_reminder",
        { reminderId: reminder.id },
        { runAt: planned.runAt, jobKey: `reminder:${reminder.id}`, maxAttempts: 8 },
      );
    }
  }
}

/**
 * Queues a one-way Google Calendar sync for an interview or task when the
 * user has a connected calendar. The job key coalesces rapid edits.
 */
export async function queueCalendarSync(
  tx: TransactionClient,
  userId: string,
  source: { interviewId: string } | { taskId: string },
): Promise<void> {
  const connection = await tx.calendarConnection.findFirst({
    where: { userId, status: "CONNECTED" },
    select: { id: true },
  });
  if (!connection) return;
  if ("taskId" in source) {
    // Tasks are only published when the user opted in, unless an event
    // already exists and must now be updated or removed.
    const preferences = await tx.userPreferences.findUnique({
      where: { userId },
      select: { calendarSyncTasks: true },
    });
    const existing = await tx.calendarEventSync.count({
      where: { connectionId: connection.id, taskId: source.taskId },
    });
    if (!preferences?.calendarSyncTasks && existing === 0) return;
  }
  const where =
    "interviewId" in source
      ? { connectionId_interviewId: { connectionId: connection.id, interviewId: source.interviewId } }
      : { connectionId_taskId: { connectionId: connection.id, taskId: source.taskId } };
  const link = await tx.calendarEventSync.upsert({
    where,
    create: { userId, connectionId: connection.id, ...source, status: "PENDING" },
    update: { status: "PENDING", syncRevision: { increment: 1 }, attempts: 0, lastError: null },
    select: { id: true },
  });
  await enqueueJob(
    tx,
    "sync_calendar_event",
    { syncId: link.id },
    { jobKey: `calsync:${link.id}`, maxAttempts: 10 },
  );
}

export async function afterInterviewChange(
  tx: TransactionClient,
  userId: string,
  interviewId: string,
): Promise<void> {
  await syncReminders(tx, userId, { interviewId });
  await queueCalendarSync(tx, userId, { interviewId });
}

export async function afterTaskChange(tx: TransactionClient, userId: string, taskId: string): Promise<void> {
  await syncReminders(tx, userId, { taskId });
  await queueCalendarSync(tx, userId, { taskId });
}

/** Re-plans deadline reminders for every revision of the offer's application. */
export async function afterOfferChange(
  tx: TransactionClient,
  userId: string,
  offerId: string,
): Promise<void> {
  const offer = await tx.offer.findFirst({ where: { id: offerId, userId }, select: { applicationId: true } });
  if (!offer) return;
  const revisions = await tx.offer.findMany({
    where: { userId, applicationId: offer.applicationId },
    select: { id: true },
  });
  for (const revision of revisions) await syncReminders(tx, userId, { offerId: revision.id });
}

/** After closing/reopening an application, its interview reminders follow. */
export async function afterApplicationStatusChange(
  tx: TransactionClient,
  userId: string,
  applicationId: string,
): Promise<void> {
  const interviews = await tx.interview.findMany({ where: { userId, applicationId }, select: { id: true } });
  for (const interview of interviews) await syncReminders(tx, userId, { interviewId: interview.id });
}

/**
 * Call BEFORE deleting interviews/tasks (directly or by cascade): pending
 * reminder jobs are removed, and synced calendar events are marked for
 * deletion. The link rows survive the cascade (FK is SET NULL), so the
 * worker can still remove the remote event afterwards.
 */
export async function beforeSourcesDeleted(
  tx: TransactionClient,
  userId: string,
  ids: { interviewIds?: string[]; taskIds?: string[] },
): Promise<void> {
  const interviewIds = ids.interviewIds ?? [];
  const taskIds = ids.taskIds ?? [];
  if (interviewIds.length === 0 && taskIds.length === 0) return;
  const reminders = await tx.reminder.findMany({
    where: {
      userId,
      status: "PENDING",
      OR: [{ interviewId: { in: interviewIds } }, { taskId: { in: taskIds } }],
    },
    select: { id: true },
  });
  for (const reminder of reminders) await removeJob(tx, `reminder:${reminder.id}`);

  const links = await tx.calendarEventSync.findMany({
    where: { userId, OR: [{ interviewId: { in: interviewIds } }, { taskId: { in: taskIds } }] },
    select: { id: true },
  });
  for (const link of links) {
    await tx.calendarEventSync.update({ where: { id: link.id }, data: { status: "DELETE_PENDING" } });
    await enqueueJob(
      tx,
      "sync_calendar_event",
      { syncId: link.id },
      { jobKey: `calsync:${link.id}`, maxAttempts: 10 },
    );
  }
}

/** Interview and task IDs under an opportunity or application (for cascading deletes). */
export async function sourcesUnder(
  tx: DbClient,
  userId: string,
  scope: { opportunityId?: string; applicationId?: string },
) {
  const applicationWhere = scope.applicationId
    ? { id: scope.applicationId }
    : { opportunityId: scope.opportunityId };
  const [interviews, tasks] = await Promise.all([
    tx.interview.findMany({ where: { userId, application: applicationWhere }, select: { id: true } }),
    tx.task.findMany({
      where: {
        userId,
        ...(scope.applicationId
          ? { applicationId: scope.applicationId }
          : { opportunityId: scope.opportunityId }),
      },
      select: { id: true },
    }),
  ]);
  return { interviewIds: interviews.map((row) => row.id), taskIds: tasks.map((row) => row.id) };
}

/**
 * Re-plans every future reminder and (optionally) calendar event for a user,
 * e.g. after notification preferences change or a calendar is connected.
 */
export async function resyncUser(
  tx: TransactionClient,
  userId: string,
  options: { calendar: boolean },
): Promise<void> {
  const now = new Date();
  const [interviews, tasks, offers] = await Promise.all([
    tx.interview.findMany({ where: { userId, startsAt: { gt: now } }, select: { id: true } }),
    tx.task.findMany({
      where: { userId, status: { in: ["OPEN", "SUGGESTED"] }, dueAt: { gt: now } },
      select: { id: true },
    }),
    tx.offer.findMany({
      where: { userId, status: { in: ["RECEIVED", "NEGOTIATING"] } },
      select: { id: true },
    }),
  ]);
  for (const { id } of interviews) {
    await syncReminders(tx, userId, { interviewId: id }, now);
    if (options.calendar) await queueCalendarSync(tx, userId, { interviewId: id });
  }
  for (const { id } of tasks) {
    await syncReminders(tx, userId, { taskId: id }, now);
    if (options.calendar) await queueCalendarSync(tx, userId, { taskId: id });
  }
  for (const { id } of offers) await syncReminders(tx, userId, { offerId: id }, now);
}
