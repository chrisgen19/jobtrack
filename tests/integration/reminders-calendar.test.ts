import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { closeApplication, reopenApplication } from "@/features/applications/data";
import { syncCalendarEvent } from "@/features/calendar-sync/sync";
import { queueCalendarSync } from "@/features/integrations/side-effects";
import {
  cancelInterview,
  createInterview,
  deleteInterview,
  rescheduleInterview,
} from "@/features/interviews/data";
import { createInterviewSchema, rescheduleInterviewSchema } from "@/features/interviews/schemas";
import { handleEmailBounce } from "@/features/notifications/bounces";
import { updateNotificationPreferences } from "@/features/notifications/data";
import { deliverReminder } from "@/features/notifications/delivery";
import { createOffer } from "@/features/offers/data";
import { createOfferSchema } from "@/features/offers/schemas";
import { createOpportunity } from "@/features/opportunities/data";
import { quickAddSchema } from "@/features/opportunities/schemas";
import { acceptSuggestedTask, createTask, setTaskCompleted } from "@/features/tasks/data";
import { createTaskSchema } from "@/features/tasks/schemas";
import { completeOnboarding, updateRegionalPreferences } from "@/features/workspace/data";
import { encryptSecret } from "@/lib/crypto";
import { addDaysToDateOnly, todayInTimeZone, zonedToUtc } from "@/lib/dates";
import { PermanentEmailError } from "@/lib/integrations/email";
import { GoogleApiError } from "@/lib/integrations/google/client";
import { prisma } from "@/lib/prisma";
import { createTestUser, resetDatabase } from "../support/db";
import { signInAs } from "../support/session";

vi.mock("@/lib/auth/session", async () => (await import("../support/session")).sessionMock);

const emailMock = vi.hoisted(() => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/integrations/email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/integrations/email")>()),
  sendEmail: emailMock.sendEmail,
}));

const google = vi.hoisted(() => ({
  insertEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
  refreshAccessToken: vi.fn(),
}));
vi.mock("@/lib/integrations/google/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/integrations/google/client")>()),
  ...google,
}));

const TZ = "Asia/Manila";
const DEFAULT_PREFS = {
  inAppReminders: true,
  emailReminders: false,
  interviewReminderMinutes: 1440,
  taskReminderMinutes: 60,
  offerDeadlineReminders: true,
  suggestFollowUps: true,
  followUpDays: 7,
  calendarSyncTasks: false,
};

async function setup(name = "Tester") {
  const user = await createTestUser(name);
  signInAs(user);
  await completeOnboarding({ timezone: TZ, currency: "PHP" });
  const { applicationId } = await createOpportunity(
    quickAddSchema.parse({
      title: "Full-Stack Developer",
      companyName: "Acme",
      alreadyApplied: true,
      appliedOn: "2026-10-01",
    }),
  );
  return { user, applicationId: applicationId! };
}

function inDays(days: number) {
  return addDaysToDateOnly(todayInTimeZone(TZ), days);
}

async function scheduleInterview(applicationId: string, days = 3, time = "10:00") {
  return createInterview(
    createInterviewSchema.parse({
      applicationId,
      title: "Technical",
      timezone: TZ,
      date: inDays(days),
      startTime: time,
    }),
  );
}

async function jobKeys(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ key: string | null }[]>`select key from graphile_worker.jobs`;
  return rows.map((row) => row.key ?? "");
}

beforeEach(async () => {
  await resetDatabase();
  vi.clearAllMocks();
  emailMock.sendEmail.mockResolvedValue({ provider: "resend", messageId: "msg_1" });
});

afterEach(() => vi.useRealTimers());

describe("reminder scheduling", () => {
  it("schedules an in-app reminder with a durable job, and replaces it on reschedule", async () => {
    const { applicationId } = await setup();
    const interviewId = await scheduleInterview(applicationId);

    const [first] = await prisma.reminder.findMany({ where: { interviewId } });
    expect(first).toMatchObject({ channel: "IN_APP", status: "PENDING", sourceRevision: 0 });
    expect(await jobKeys()).toContain(`reminder:${first!.id}`);

    await rescheduleInterview(
      rescheduleInterviewSchema.parse({ interviewId, date: inDays(5), startTime: "15:00", timezone: TZ }),
    );
    const reminders = await prisma.reminder.findMany({
      where: { interviewId },
      orderBy: { createdAt: "asc" },
    });
    expect(reminders.map((reminder) => [reminder.status, reminder.sourceRevision])).toEqual([
      ["CANCELLED", 0],
      ["PENDING", 1],
    ]);
    const keys = await jobKeys();
    expect(keys).not.toContain(`reminder:${first!.id}`);
    expect(keys).toContain(`reminder:${reminders[1]!.id}`);

    await cancelInterview(interviewId);
    expect(await prisma.reminder.count({ where: { interviewId, status: "PENDING" } })).toBe(0);
  });

  it("schedules email reminders only after opting in, and cancels them when opting out", async () => {
    const { applicationId } = await setup();
    const interviewId = await scheduleInterview(applicationId);
    await updateNotificationPreferences({ ...DEFAULT_PREFS, emailReminders: true });
    expect(
      (await prisma.reminder.findMany({ where: { interviewId, status: "PENDING" } }))
        .map((r) => r.channel)
        .sort(),
    ).toEqual(["EMAIL", "IN_APP"]);

    await updateNotificationPreferences({ ...DEFAULT_PREFS, inAppReminders: false, emailReminders: false });
    expect(await prisma.reminder.count({ where: { interviewId, status: "PENDING" } })).toBe(0);
  });

  it("restores cancelled reminders when a channel is re-enabled or the application reopens", async () => {
    const { applicationId } = await setup();
    const interviewId = await scheduleInterview(applicationId);
    const original = await prisma.reminder.findFirstOrThrow({ where: { interviewId } });

    const expectRestored = async () => {
      const rows = await prisma.reminder.findMany({ where: { interviewId } });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ id: original.id, status: "PENDING", cancelledAt: null });
      expect(await jobKeys()).toContain(`reminder:${original.id}`);
    };

    await updateNotificationPreferences({ ...DEFAULT_PREFS, inAppReminders: false });
    expect(await prisma.reminder.findUniqueOrThrow({ where: { id: original.id } })).toMatchObject({
      status: "CANCELLED",
    });
    expect(await jobKeys()).not.toContain(`reminder:${original.id}`);
    await updateNotificationPreferences(DEFAULT_PREFS);
    await expectRestored();

    await closeApplication(applicationId, "NO_RESPONSE");
    expect(await prisma.reminder.count({ where: { interviewId, status: "PENDING" } })).toBe(0);
    await reopenApplication(applicationId);
    await expectRestored();
  });

  it("moves offer deadline reminders when the timezone changes", async () => {
    const { applicationId } = await setup();
    const deadline = inDays(5);
    const offerId = await createOffer(
      createOfferSchema.parse({
        applicationId,
        positionTitle: "Dev",
        currency: "PHP",
        receivedOn: inDays(0),
        decisionDeadline: deadline,
      }),
    );
    const before = await prisma.reminder.findFirstOrThrow({ where: { offerId, status: "PENDING" } });
    expect(before.remindAt).toEqual(zonedToUtc(addDaysToDateOnly(deadline, -1), "09:00", TZ));

    const LA = "America/Los_Angeles";
    await updateRegionalPreferences({ timezone: LA, currency: "PHP", weekStartsOn: 1 });
    const pending = await prisma.reminder.findMany({ where: { offerId, status: "PENDING" } });
    expect(pending).toHaveLength(1);
    expect(pending[0]!.remindAt).toEqual(zonedToUtc(addDaysToDateOnly(deadline, -1), "09:00", LA));
    expect(await prisma.reminder.findUniqueOrThrow({ where: { id: before.id } })).toMatchObject({
      status: "CANCELLED",
    });
    const keys = await jobKeys();
    expect(keys).toContain(`reminder:${pending[0]!.id}`);
    expect(keys).not.toContain(`reminder:${before.id}`);
  });

  it("reminds about accepted tasks and stops when completed", async () => {
    const { user } = await setup();
    const suggestion = await prisma.task.findFirstOrThrow({
      where: { userId: user.id, status: "SUGGESTED" },
    });
    expect(await prisma.reminder.count({ where: { taskId: suggestion.id } })).toBe(0);
    await acceptSuggestedTask(suggestion.id);
    expect(await prisma.reminder.count({ where: { taskId: suggestion.id, status: "PENDING" } })).toBe(1);
    await setTaskCompleted(suggestion.id, true);
    expect(await prisma.reminder.count({ where: { taskId: suggestion.id, status: "PENDING" } })).toBe(0);
  });

  it("keeps the offer deadline reminder on the latest revision only", async () => {
    const { applicationId } = await setup();
    const offer = (receivedOn: string) =>
      createOffer(
        createOfferSchema.parse({
          applicationId,
          positionTitle: "Dev",
          currency: "PHP",
          receivedOn,
          decisionDeadline: inDays(5),
        }),
      );
    const first = await offer(inDays(0));
    const second = await offer(inDays(0));
    expect(await prisma.reminder.count({ where: { offerId: first, status: "PENDING" } })).toBe(0);
    expect(await prisma.reminder.count({ where: { offerId: second, status: "PENDING" } })).toBe(1);
  });
});

describe("reminder delivery", () => {
  it("creates exactly one in-app notification even when delivered twice concurrently", async () => {
    const { user, applicationId } = await setup();
    const interviewId = await scheduleInterview(applicationId);
    const reminder = await prisma.reminder.findFirstOrThrow({ where: { interviewId } });

    const outcomes = await Promise.all([
      deliverReminder(reminder.id, { number: 1, max: 8 }),
      deliverReminder(reminder.id, { number: 1, max: 8 }),
    ]);
    expect(outcomes.filter((outcome) => outcome === "sent")).toHaveLength(1);
    expect(await prisma.notification.count({ where: { userId: user.id } })).toBe(1);
    expect(await deliverReminder(reminder.id, { number: 2, max: 8 })).toBe("already-sent");
    expect((await prisma.reminder.findUniqueOrThrow({ where: { id: reminder.id } })).status).toBe("SENT");
  });

  it("keeps delivered notifications and the delivery log when the interview is deleted", async () => {
    const { user, applicationId } = await setup();
    await updateNotificationPreferences({ ...DEFAULT_PREFS, emailReminders: true });
    const interviewId = await scheduleInterview(applicationId);
    const reminders = await prisma.reminder.findMany({ where: { interviewId } });
    expect(reminders.map((reminder) => reminder.channel).sort()).toEqual(["EMAIL", "IN_APP"]);
    for (const reminder of reminders) {
      expect(await deliverReminder(reminder.id, { number: 1, max: 8 })).toBe("sent");
    }

    await deleteInterview(interviewId);
    expect(await prisma.reminder.count({ where: { interviewId } })).toBe(0);
    const notifications = await prisma.notification.findMany({ where: { userId: user.id } });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ userId: user.id, reminderId: null });
    const deliveries = await prisma.notificationDelivery.findMany({ where: { userId: user.id } });
    expect(deliveries.map((delivery) => delivery.channel)).toContain("EMAIL");
    expect(deliveries.every((delivery) => delivery.reminderId === null)).toBe(true);
  });

  it("rejects notification and delivery links to another user's reminder at the database level", async () => {
    const { applicationId } = await setup("Alice");
    const interviewId = await scheduleInterview(applicationId);
    const aliceReminder = await prisma.reminder.findFirstOrThrow({ where: { interviewId } });
    const { user: bob } = await setup("Bob");
    await expect(
      prisma.notification.create({
        data: { userId: bob.id, reminderId: aliceReminder.id, type: "INTERVIEW_REMINDER", title: "Leak" },
      }),
    ).rejects.toThrow(/foreign key/i);
    await expect(
      prisma.notificationDelivery.create({
        data: {
          userId: bob.id,
          reminderId: aliceReminder.id,
          channel: "EMAIL",
          status: "SENT",
          provider: "resend",
          idempotencyKey: "cross-tenant-test",
        },
      }),
    ).rejects.toThrow(/foreign key/i);
  });

  it("skips a reminder whose interview changed without a re-plan (stale worker)", async () => {
    const { applicationId } = await setup();
    const interviewId = await scheduleInterview(applicationId);
    const reminder = await prisma.reminder.findFirstOrThrow({ where: { interviewId } });
    await prisma.interview.update({
      where: { id: interviewId },
      data: { scheduleRevision: { increment: 1 } },
    });
    expect(await deliverReminder(reminder.id, { number: 1, max: 8 })).toBe("skipped");
    expect(await prisma.notification.count()).toBe(0);
  });

  it("sends email once with an idempotency key and records the provider id", async () => {
    const { applicationId } = await setup();
    await updateNotificationPreferences({ ...DEFAULT_PREFS, inAppReminders: false, emailReminders: true });
    const interviewId = await scheduleInterview(applicationId);
    const reminder = await prisma.reminder.findFirstOrThrow({ where: { interviewId, channel: "EMAIL" } });

    expect(await deliverReminder(reminder.id, { number: 1, max: 8 })).toBe("sent");
    expect(await deliverReminder(reminder.id, { number: 2, max: 8 })).toBe("already-sent");
    expect(emailMock.sendEmail).toHaveBeenCalledTimes(1);
    expect(emailMock.sendEmail.mock.calls[0]![0]).toMatchObject({
      idempotencyKey: `reminder:${reminder.id}:email`,
    });
    expect(await prisma.notificationDelivery.findFirst({ where: { reminderId: reminder.id } })).toMatchObject(
      { status: "SENT", providerMessageId: "msg_1" },
    );
  });

  it("retries transient email failures and stops on permanent ones", async () => {
    const { applicationId } = await setup();
    await updateNotificationPreferences({ ...DEFAULT_PREFS, inAppReminders: false, emailReminders: true });
    const interviewId = await scheduleInterview(applicationId);
    const reminder = await prisma.reminder.findFirstOrThrow({ where: { interviewId, channel: "EMAIL" } });

    emailMock.sendEmail.mockRejectedValueOnce(new Error("Resend rate_limit_exceeded"));
    await expect(deliverReminder(reminder.id, { number: 1, max: 8 })).rejects.toThrow(/rate_limit/);
    expect(await prisma.reminder.findUniqueOrThrow({ where: { id: reminder.id } })).toMatchObject({
      status: "PENDING",
      attempts: 1,
    });

    emailMock.sendEmail.mockRejectedValueOnce(
      new PermanentEmailError("Resend validation_error: bad address"),
    );
    expect(await deliverReminder(reminder.id, { number: 2, max: 8 })).toBe("failed");
    expect(await prisma.reminder.findUniqueOrThrow({ where: { id: reminder.id } })).toMatchObject({
      status: "FAILED",
    });
  });

  it("turns email reminders off after a bounce", async () => {
    const { user, applicationId } = await setup();
    await updateNotificationPreferences({ ...DEFAULT_PREFS, emailReminders: true });
    const interviewId = await scheduleInterview(applicationId);
    const email = await prisma.reminder.findFirstOrThrow({ where: { interviewId, channel: "EMAIL" } });
    await deliverReminder(email.id, { number: 1, max: 8 });
    await scheduleInterview(applicationId, 6);

    expect(await handleEmailBounce("msg_1", "bounced")).toBe(true);
    expect(
      (await prisma.userPreferences.findUniqueOrThrow({ where: { userId: user.id } })).emailReminders,
    ).toBe(false);
    expect(
      await prisma.reminder.count({ where: { userId: user.id, channel: "EMAIL", status: "PENDING" } }),
    ).toBe(0);
    expect(await prisma.notification.count({ where: { userId: user.id, type: "SYSTEM" } })).toBe(1);
  });
});

describe("Google Calendar one-way sync", () => {
  async function connect(userId: string) {
    return prisma.calendarConnection.create({
      data: {
        userId,
        encryptedRefreshToken: encryptSecret("refresh-token"),
        encryptedAccessToken: encryptSecret("access-token"),
        accessTokenExpiresAt: new Date(Date.now() + 3600_000),
        calendarId: "primary",
      },
    });
  }

  it("creates one event with a deterministic id, updates it on reschedule and deletes it after the interview is deleted", async () => {
    const { user, applicationId } = await setup();
    await connect(user.id);
    google.insertEvent.mockImplementation(async (_token, _calendar, event: { id: string }) => ({
      id: event.id,
    }));
    google.updateEvent.mockImplementation(async (_token, _calendar, id: string) => ({ id }));

    const interviewId = await scheduleInterview(applicationId);
    const link = await prisma.calendarEventSync.findFirstOrThrow({ where: { interviewId } });
    expect(await jobKeys()).toContain(`calsync:${link.id}`);

    expect(await syncCalendarEvent(link.id)).toBe("synced");
    const synced = await prisma.calendarEventSync.findUniqueOrThrow({ where: { id: link.id } });
    expect(synced.externalEventId).toBe(`jt${link.id.replaceAll("-", "")}`);
    expect(google.insertEvent.mock.calls[0]![2]).toMatchObject({
      summary: "Interview: Technical · Acme",
      start: { timeZone: TZ },
    });

    await rescheduleInterview(
      rescheduleInterviewSchema.parse({ interviewId, date: inDays(4), startTime: "11:00", timezone: TZ }),
    );
    expect(await syncCalendarEvent(link.id)).toBe("synced");
    expect(google.updateEvent).toHaveBeenCalledTimes(1);
    expect(google.insertEvent).toHaveBeenCalledTimes(1);

    await deleteInterview(interviewId);
    const pending = await prisma.calendarEventSync.findUniqueOrThrow({ where: { id: link.id } });
    expect(pending).toMatchObject({ status: "DELETE_PENDING", interviewId: null });
    expect(await syncCalendarEvent(link.id)).toBe("deleted");
    expect(google.deleteEvent).toHaveBeenCalledWith("access-token", "primary", synced.externalEventId);
    expect(await prisma.calendarEventSync.count()).toBe(0);
  });

  it("removes the events of overdue tasks when task publishing is turned off", async () => {
    const { user } = await setup();
    await connect(user.id);
    google.insertEvent.mockImplementation(async (_token, _calendar, event: { id: string }) => ({
      id: event.id,
    }));
    await updateNotificationPreferences({ ...DEFAULT_PREFS, calendarSyncTasks: true });
    const taskId = await createTask(
      createTaskSchema.parse({ title: "Overdue follow-up", dueDate: inDays(-1), dueTime: "09:00" }),
    );
    const link = await prisma.calendarEventSync.findFirstOrThrow({ where: { taskId } });
    expect(await syncCalendarEvent(link.id)).toBe("synced");

    await updateNotificationPreferences({ ...DEFAULT_PREFS, calendarSyncTasks: false });
    expect(await prisma.calendarEventSync.findUniqueOrThrow({ where: { id: link.id } })).toMatchObject({
      status: "PENDING",
    });
    expect(await syncCalendarEvent(link.id)).toBe("deleted");
    expect(google.deleteEvent).toHaveBeenCalledTimes(1);
    expect(await prisma.calendarEventSync.findUnique({ where: { id: link.id } })).toBeNull();
  });

  it("rejects a calendar link to another user's interview at the database level", async () => {
    const { applicationId } = await setup("Alice");
    const aliceInterview = await scheduleInterview(applicationId);
    const { user: bob } = await setup("Bob");
    const connection = await connect(bob.id);
    await expect(
      prisma.calendarEventSync.create({
        data: { userId: bob.id, connectionId: connection.id, interviewId: aliceInterview },
      }),
    ).rejects.toThrow(/foreign key/i);
  });

  it("recovers from a crash after insert (409) without creating a duplicate", async () => {
    const { user, applicationId } = await setup();
    await connect(user.id);
    google.insertEvent.mockRejectedValueOnce(new GoogleApiError(409, "duplicate", "already exists"));
    google.updateEvent.mockImplementation(async (_token, _calendar, id: string) => ({ id }));
    const interviewId = await scheduleInterview(applicationId);
    const link = await prisma.calendarEventSync.findFirstOrThrow({ where: { interviewId } });
    expect(await syncCalendarEvent(link.id)).toBe("synced");
    expect(google.updateEvent).toHaveBeenCalledTimes(1);
  });

  it("marks the connection for reconnection when Google revokes access, without touching interviews", async () => {
    const { user, applicationId } = await setup();
    const connection = await connect(user.id);
    await prisma.calendarConnection.update({
      where: { id: connection.id },
      data: { accessTokenExpiresAt: new Date(0) },
    });
    google.refreshAccessToken.mockRejectedValueOnce(
      new GoogleApiError(400, "invalid_grant", "Token has been expired or revoked."),
    );
    const interviewId = await scheduleInterview(applicationId);
    const link = await prisma.calendarEventSync.findFirstOrThrow({ where: { interviewId } });

    expect(await syncCalendarEvent(link.id)).toBe("needs-reauth");
    expect((await prisma.calendarConnection.findUniqueOrThrow({ where: { id: connection.id } })).status).toBe(
      "NEEDS_REAUTH",
    );
    expect(await prisma.notification.count({ where: { userId: user.id, type: "CALENDAR_SYNC_ERROR" } })).toBe(
      1,
    );
    expect(await prisma.interview.count({ where: { id: interviewId, status: "SCHEDULED" } })).toBe(1);
  });

  it("retries rate limits and does not sync anything for users without a connection", async () => {
    const { user, applicationId } = await setup();
    const interviewId = await scheduleInterview(applicationId);
    expect(await prisma.calendarEventSync.count()).toBe(0);

    await connect(user.id);
    await prisma.$transaction((tx) => queueCalendarSync(tx, user.id, { interviewId }));
    const link = await prisma.calendarEventSync.findFirstOrThrow({ where: { interviewId } });
    google.insertEvent.mockRejectedValueOnce(new GoogleApiError(429, "rateLimitExceeded", "slow down"));
    await expect(syncCalendarEvent(link.id)).rejects.toThrow(/slow down/);
    expect(await prisma.calendarEventSync.findUniqueOrThrow({ where: { id: link.id } })).toMatchObject({
      status: "PENDING",
      attempts: 1,
    });
  });
});
