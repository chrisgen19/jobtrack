import type { InterviewStatus, OfferStatus, ReminderChannel, TaskStatus } from "@/generated/prisma/enums";
import { addDaysToDateOnly, dayBoundsUtc, zonedToUtc } from "@/lib/dates";

/**
 * Pure reminder planning: given the current state of a source (interview,
 * task or offer) and the user's channel preferences, which reminders should
 * exist. Shared by the web app (scheduling on change) and the worker
 * (re-validation right before delivery).
 *
 * The dedupe key includes the source revision and the *computed* reminder
 * time, so:
 * - rescheduling produces new keys and old pending reminders are cancelled;
 * - re-planning the same state yields the same keys (no duplicate sends),
 *   even when an overdue reminder time is clamped to "now" for delivery.
 */

export type ReminderSource =
  | {
      kind: "interview";
      id: string;
      status: InterviewStatus;
      startsAt: Date | null;
      minutesBefore: number | null;
      revision: number;
    }
  | {
      kind: "task";
      id: string;
      status: TaskStatus;
      dueAt: Date | null;
      minutesBefore: number | null;
      revision: number;
    }
  | {
      kind: "offer";
      id: string;
      status: OfferStatus;
      decisionDeadline: string | null;
      timezone: string;
      enabled: boolean;
    };

export type ChannelPreferences = { inApp: boolean; email: boolean; emailVerified: boolean };

export type PlannedReminder = {
  channel: ReminderChannel;
  /** When the reminder is due according to the schedule. */
  remindAt: Date;
  /** When the job should run (remindAt, or now if that already passed). */
  runAt: Date;
  sourceRevision: number;
  dedupeKey: string;
};

function scheduleFor(
  source: ReminderSource,
  now: Date,
): { remindAt: Date; deadline: Date; revision: number } | null {
  switch (source.kind) {
    case "interview": {
      if (source.status !== "SCHEDULED" && source.status !== "RESCHEDULED") return null;
      if (!source.startsAt || source.minutesBefore === null || source.startsAt <= now) return null;
      return {
        remindAt: new Date(source.startsAt.getTime() - source.minutesBefore * 60_000),
        deadline: source.startsAt,
        revision: source.revision,
      };
    }
    case "task": {
      if (source.status !== "OPEN" || !source.dueAt || source.minutesBefore === null || source.dueAt <= now)
        return null;
      return {
        remindAt: new Date(source.dueAt.getTime() - source.minutesBefore * 60_000),
        deadline: source.dueAt,
        revision: source.revision,
      };
    }
    case "offer": {
      if (!source.enabled || !source.decisionDeadline) return null;
      if (source.status !== "RECEIVED" && source.status !== "NEGOTIATING") return null;
      const deadlineEnd = dayBoundsUtc(source.decisionDeadline, source.timezone).end;
      if (deadlineEnd <= now) return null;
      const remindAt = zonedToUtc(addDaysToDateOnly(source.decisionDeadline, -1), "09:00", source.timezone);
      return { remindAt, deadline: deadlineEnd, revision: 0 };
    }
  }
}

export function planReminders(
  source: ReminderSource,
  preferences: ChannelPreferences,
  now: Date = new Date(),
): PlannedReminder[] {
  const schedule = scheduleFor(source, now);
  if (!schedule) return [];
  const channels: ReminderChannel[] = [];
  if (preferences.inApp) channels.push("IN_APP");
  if (preferences.email && preferences.emailVerified) channels.push("EMAIL");
  const runAt = schedule.remindAt < now ? now : schedule.remindAt;
  return channels.map((channel) => ({
    channel,
    remindAt: schedule.remindAt,
    runAt,
    sourceRevision: schedule.revision,
    dedupeKey: `${source.kind}:${source.id}:r${schedule.revision}:${channel}:${schedule.remindAt.toISOString()}`,
  }));
}
