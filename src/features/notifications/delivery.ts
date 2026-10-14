import { Prisma } from "@/generated/prisma/client";
import type { NotificationType } from "@/generated/prisma/enums";
import { loadReminderSource } from "@/features/integrations/side-effects";
import { reminderEmail } from "@/lib/email/templates";
import { appEnv } from "@/lib/env";
import { formatDateOnly, formatInTimeZone, toDateOnly } from "@/lib/dates";
import { PermanentEmailError, sendEmail } from "@/lib/integrations/email";
import { errorMessage, logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { planReminders } from "./plan";

/**
 * Worker-side reminder delivery. Runs once per reminder job and is safe to
 * run again (crash, retry, two workers): it re-validates the reminder
 * against the source's current state and the user's current preferences,
 * and every write is guarded by a unique key.
 *
 * Shared with tests; must not import `server-only` or `next/*`.
 */

type Message = { type: NotificationType; title: string; body: string; path: string; emailLines: string[] };

export type DeliveryOutcome = "sent" | "already-sent" | "skipped" | "failed";

async function composeMessage(reminderId: string, timezone: string): Promise<Message | null> {
  const reminder = await prisma.reminder.findUnique({
    where: { id: reminderId },
    select: {
      interview: {
        select: {
          title: true,
          startsAt: true,
          timezone: true,
          meetingUrl: true,
          applicationId: true,
          application: {
            select: { opportunity: { select: { title: true, company: { select: { name: true } } } } },
          },
        },
      },
      task: {
        select: {
          title: true,
          dueAt: true,
          applicationId: true,
          opportunity: { select: { company: { select: { name: true } } } },
        },
      },
      offer: {
        select: {
          positionTitle: true,
          decisionDeadline: true,
          applicationId: true,
          application: { select: { opportunity: { select: { company: { select: { name: true } } } } } },
        },
      },
    },
  });
  if (reminder?.interview?.startsAt) {
    const { interview } = reminder;
    const when = formatInTimeZone(interview.startsAt!, timezone, "EEE, MMM d 'at' h:mm a");
    const company = interview.application.opportunity.company.name;
    return {
      type: "INTERVIEW_REMINDER",
      title: `Upcoming interview: ${interview.title} with ${company}`,
      body: `${when} · ${interview.application.opportunity.title}`,
      path: `/applications/${interview.applicationId}?tab=interviews`,
      emailLines: [
        `${interview.title} for ${interview.application.opportunity.title} at ${company}.`,
        `When: ${when} (${timezone.replaceAll("_", " ")}).`,
        ...(interview.meetingUrl ? [`Meeting link: ${interview.meetingUrl}`] : []),
      ],
    };
  }
  if (reminder?.task?.dueAt) {
    const { task } = reminder;
    const when = formatInTimeZone(task.dueAt!, timezone, "EEE, MMM d 'at' h:mm a");
    return {
      type: "TASK_REMINDER",
      title: `Task due: ${task.title}`,
      body: `${task.opportunity?.company.name ?? "General task"} · due ${when}`,
      path: task.applicationId ? `/applications/${task.applicationId}` : "/tasks",
      emailLines: [`"${task.title}" is due ${when}.`],
    };
  }
  if (reminder?.offer?.decisionDeadline) {
    const { offer } = reminder;
    const deadline = formatDateOnly(toDateOnly(offer.decisionDeadline!), "EEE, MMM d");
    return {
      type: "OFFER_DEADLINE",
      title: `Offer decision due ${deadline}`,
      body: `${offer.positionTitle} · ${offer.application.opportunity.company.name}`,
      path: `/applications/${offer.applicationId}?tab=offers`,
      emailLines: [
        `Your decision on the ${offer.positionTitle} offer from ${offer.application.opportunity.company.name} is due ${deadline}.`,
      ],
    };
  }
  return null;
}

async function markSkipped(reminderId: string, reason: string): Promise<DeliveryOutcome> {
  await prisma.reminder.updateMany({
    where: { id: reminderId, status: "PENDING" },
    data: { status: "SKIPPED", lastError: reason },
  });
  return "skipped";
}

/**
 * Delivers one reminder. Throws only for transient failures that Graphile
 * Worker should retry (with exponential backoff).
 */
export async function deliverReminder(
  reminderId: string,
  attempt: { number: number; max: number },
): Promise<DeliveryOutcome> {
  const reminder = await prisma.reminder.findUnique({
    where: { id: reminderId },
    select: {
      id: true,
      userId: true,
      channel: true,
      status: true,
      dedupeKey: true,
      interviewId: true,
      taskId: true,
      offerId: true,
      user: {
        select: {
          email: true,
          emailVerified: true,
          preferences: {
            select: {
              timezone: true,
              inAppReminders: true,
              emailReminders: true,
              offerDeadlineReminders: true,
            },
          },
        },
      },
    },
  });
  // Deleted (source or account removed) or already handled: nothing to do.
  if (!reminder) return "skipped";
  if (reminder.status === "SENT") return "already-sent";
  if (reminder.status !== "PENDING") return "skipped";

  const preferences = reminder.user.preferences;
  const timezone = preferences?.timezone ?? "UTC";
  const source = reminder.interviewId
    ? { interviewId: reminder.interviewId }
    : reminder.taskId
      ? { taskId: reminder.taskId }
      : { offerId: reminder.offerId! };

  // Re-plan from the current state: a stale reminder (rescheduled,
  // cancelled, preference off) no longer matches a desired dedupe key.
  const state = await loadReminderSource(
    prisma,
    reminder.userId,
    source,
    timezone,
    preferences?.offerDeadlineReminders ?? true,
  );
  const desired = state
    ? planReminders(state, {
        inApp: preferences?.inAppReminders ?? true,
        email: preferences?.emailReminders ?? false,
        emailVerified: reminder.user.emailVerified,
      })
    : [];
  if (!desired.some((planned) => planned.dedupeKey === reminder.dedupeKey))
    return markSkipped(reminder.id, "obsolete");

  const message = await composeMessage(reminder.id, timezone);
  if (!message) return markSkipped(reminder.id, "source unavailable");
  const url = `${appEnv().APP_URL}${message.path}`;

  if (reminder.channel === "IN_APP") {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.notification.create({
          data: {
            userId: reminder.userId,
            reminderId: reminder.id,
            type: message.type,
            title: message.title,
            body: message.body,
            link: message.path,
          },
        });
        await tx.notificationDelivery.create({
          data: {
            userId: reminder.userId,
            reminderId: reminder.id,
            channel: "IN_APP",
            status: "SENT",
            provider: "in_app",
            idempotencyKey: `reminder:${reminder.id}:in_app`,
          },
        });
        await tx.reminder.update({
          where: { id: reminder.id },
          data: { status: "SENT", sentAt: new Date(), attempts: { increment: 1 } },
        });
      });
      return "sent";
    } catch (error) {
      // Unique reminder_id: another run already created the notification.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        await prisma.reminder.updateMany({
          where: { id: reminder.id, status: "PENDING" },
          data: { status: "SENT", sentAt: new Date() },
        });
        return "already-sent";
      }
      throw error;
    }
  }

  // Email: the provider idempotency key makes a retry after a crash safe.
  const idempotencyKey = `reminder:${reminder.id}:email`;
  const previous = await prisma.notificationDelivery.findUnique({
    where: { idempotencyKey },
    select: { status: true },
  });
  if (previous?.status === "SENT") {
    await prisma.reminder.update({
      where: { id: reminder.id },
      data: { status: "SENT", sentAt: new Date() },
    });
    return "already-sent";
  }

  try {
    const email = reminderEmail({ heading: message.title, lines: message.emailLines, url });
    const result = await sendEmail({ to: reminder.user.email, ...email, idempotencyKey });
    await prisma.$transaction([
      prisma.notificationDelivery.upsert({
        where: { idempotencyKey },
        create: {
          userId: reminder.userId,
          reminderId: reminder.id,
          channel: "EMAIL",
          status: "SENT",
          provider: result.provider,
          idempotencyKey,
          providerMessageId: result.messageId,
        },
        update: { status: "SENT", providerMessageId: result.messageId, error: null },
      }),
      prisma.reminder.update({
        where: { id: reminder.id },
        data: { status: "SENT", sentAt: new Date(), attempts: { increment: 1 }, lastError: null },
      }),
    ]);
    return "sent";
  } catch (error) {
    const permanent = error instanceof PermanentEmailError;
    const finalAttempt = permanent || attempt.number >= attempt.max;
    const reason = errorMessage(error);
    await prisma.reminder.update({
      where: { id: reminder.id },
      data: { attempts: { increment: 1 }, lastError: reason, ...(finalAttempt ? { status: "FAILED" } : {}) },
    });
    if (finalAttempt) {
      await prisma.notificationDelivery.upsert({
        where: { idempotencyKey },
        create: {
          userId: reminder.userId,
          reminderId: reminder.id,
          channel: "EMAIL",
          status: "FAILED",
          provider: "resend",
          idempotencyKey,
          error: reason,
        },
        update: { status: "FAILED", error: reason },
      });
      logger.error("reminder email failed permanently", { reminderId: reminder.id, error: reason });
      return "failed";
    }
    throw error;
  }
}
