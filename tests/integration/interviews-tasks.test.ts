import { beforeEach, describe, expect, it, vi } from "vitest";
import { getApplicationDetail, listActivity } from "@/features/applications/data";
import { getCalendarMonth } from "@/features/calendar/data";
import { getDashboard } from "@/features/dashboard/data";
import {
  cancelInterview,
  completeInterview,
  createInterview,
  listApplicationInterviews,
  rescheduleInterview,
} from "@/features/interviews/data";
import { createInterviewSchema, rescheduleInterviewSchema } from "@/features/interviews/schemas";
import { createOpportunity } from "@/features/opportunities/data";
import { quickAddSchema } from "@/features/opportunities/schemas";
import {
  acceptSuggestedTask,
  createTask,
  dismissTask,
  getTaskGroups,
  setTaskCompleted,
} from "@/features/tasks/data";
import { createTaskSchema } from "@/features/tasks/schemas";
import { completeOnboarding } from "@/features/workspace/data";
import { addDaysToDateOnly, todayInTimeZone } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { createTestUser, resetDatabase } from "../support/db";
import { signInAs } from "../support/session";

vi.mock("@/lib/auth/session", async () => (await import("../support/session")).sessionMock);

const TZ = "Asia/Manila";

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

function interview(applicationId: string, input: Record<string, unknown>) {
  return createInterviewSchema.parse({ applicationId, timezone: TZ, title: "Round", ...input });
}

describe("interviews", () => {
  beforeEach(resetDatabase);

  it("supports unlimited rounds, including repeats of the same type", async () => {
    const { applicationId } = await setup();
    for (const [index, type] of ["TECHNICAL", "TECHNICAL", "TECHNICAL", "FINAL", "FINAL"].entries()) {
      await createInterview(
        interview(applicationId, {
          title: `${type} ${index + 1}`,
          type,
          date: `2026-11-0${index + 1}`,
          startTime: "10:00",
        }),
      );
    }
    const rounds = await listApplicationInterviews(applicationId);
    expect(rounds).toHaveLength(5);
    expect(rounds.filter((round) => round.type === "TECHNICAL")).toHaveLength(3);
    expect(rounds.map((round) => round.roundNumber)).toEqual([1, 2, 3, 4, 5]);
  });

  it("stores the UTC instant and the IANA timezone of the interview", async () => {
    const { applicationId } = await setup();
    const id = await createInterview(
      interview(applicationId, { date: "2026-10-15", startTime: "14:00", durationMinutes: "60" }),
    );
    const row = await prisma.interview.findUniqueOrThrow({ where: { id } });
    expect(row.startsAt!.toISOString()).toBe("2026-10-15T06:00:00.000Z");
    expect(row.endsAt!.toISOString()).toBe("2026-10-15T07:00:00.000Z");
    expect(row.timezone).toBe(TZ);
    expect(row.status).toBe("SCHEDULED");
  });

  it("allows an interview without a time yet, and validates date/time pairs", async () => {
    const { applicationId } = await setup();
    const id = await createInterview(interview(applicationId, {}));
    expect((await prisma.interview.findUniqueOrThrow({ where: { id } })).status).toBe("UNSCHEDULED");
    expect(
      createInterviewSchema.safeParse({ applicationId, timezone: TZ, title: "x", date: "2026-10-15" })
        .success,
    ).toBe(false);
    expect(
      createInterviewSchema.safeParse({ applicationId, timezone: "Mars/Base", title: "x" }).success,
    ).toBe(false);
  });

  it("reschedules the same record with history, a new revision and an activity event", async () => {
    const { applicationId } = await setup();
    const id = await createInterview(
      interview(applicationId, { title: "Technical", date: "2026-10-15", startTime: "14:00" }),
    );
    await rescheduleInterview(
      rescheduleInterviewSchema.parse({
        interviewId: id,
        date: "2026-10-17",
        startTime: "09:30",
        timezone: "Australia/Perth",
        reason: "Recruiter moved it",
      }),
    );

    const [row] = await listApplicationInterviews(applicationId);
    expect(row!.id).toBe(id);
    expect(row!.status).toBe("RESCHEDULED");
    expect(row!.timezone).toBe("Australia/Perth");
    expect(row!.startsAt!.toISOString()).toBe("2026-10-17T01:30:00.000Z");
    expect(row!.reschedules).toHaveLength(1);
    expect(row!.reschedules[0]).toMatchObject({
      previousTimezone: TZ,
      newTimezone: "Australia/Perth",
      reason: "Recruiter moved it",
    });
    expect((await prisma.interview.findUniqueOrThrow({ where: { id } })).scheduleRevision).toBe(1);

    const events = await listActivity({ applicationId });
    const rescheduled = events.find((event) => event.type === "INTERVIEW_RESCHEDULED")!;
    expect(rescheduled.summary).toContain("Oct 15");
    expect(rescheduled.summary).toContain("Oct 17");
  });

  it("keeps results, cancellations and the application outcome independent", async () => {
    const { user, applicationId } = await setup();
    const first = await createInterview(
      interview(applicationId, { title: "Screen", date: "2026-10-15", startTime: "10:00" }),
    );
    const second = await createInterview(
      interview(applicationId, { title: "Tech", date: "2026-10-20", startTime: "10:00" }),
    );

    await completeInterview(first, "AWAITING_FEEDBACK");
    await cancelInterview(second, "Role on hold");

    const rounds = await listApplicationInterviews(applicationId);
    expect(rounds.map((round) => [round.title, round.status, round.result])).toEqual([
      ["Screen", "COMPLETED", "AWAITING_FEEDBACK"],
      ["Tech", "CANCELLED", "PENDING"],
    ]);
    expect((await getApplicationDetail(applicationId))!.status).toBe("ACTIVE");
    const suggestions = await prisma.task.findMany({
      where: { userId: user.id, suggestionReason: "interview_completed" },
    });
    expect(suggestions).toHaveLength(1);
    await expect(
      rescheduleInterview(
        rescheduleInterviewSchema.parse({
          interviewId: first,
          date: "2026-10-30",
          startTime: "10:00",
          timezone: TZ,
        }),
      ),
    ).rejects.toThrow(/Completed/);
  });

  it("does not let another user touch an interview", async () => {
    const { applicationId } = await setup("Alice");
    const id = await createInterview(interview(applicationId, { date: "2026-10-15", startTime: "10:00" }));
    await setup("Bob");
    await expect(cancelInterview(id)).rejects.toThrow(/not found/i);
    await expect(createInterview(interview(applicationId, {}))).rejects.toThrow(/not found/i);
    expect(await listApplicationInterviews(applicationId)).toHaveLength(0);
  });
});

describe("tasks", () => {
  beforeEach(resetDatabase);

  it("groups tasks into overdue, today, upcoming and completed in the user's timezone", async () => {
    await setup();
    const today = todayInTimeZone(TZ);
    const make = (title: string, dueDate?: string) => createTask(createTaskSchema.parse({ title, dueDate }));
    await make("Yesterday", addDaysToDateOnly(today, -1));
    await make("Today", today);
    await make("Next week", addDaysToDateOnly(today, 7));
    await make("Someday");
    const done = await make("Done", today);
    await setTaskCompleted(done, true);

    const groups = await getTaskGroups();
    expect(groups.overdue.map((task) => task.title)).toEqual(["Yesterday"]);
    expect(groups.dueToday.map((task) => task.title)).toEqual(["Today"]);
    expect(groups.upcoming.map((task) => task.title)).toEqual(["Next week"]);
    expect(groups.someday.map((task) => task.title)).toEqual(["Someday"]);
    expect(groups.completed.map((task) => task.title)).toEqual(["Done"]);
    // The follow-up suggested when applying is separate and not overdue.
    expect(groups.suggested).toHaveLength(1);
  });

  it("accepts and dismisses suggestions; completing a linked task logs activity", async () => {
    const { user, applicationId } = await setup();
    const suggestion = await prisma.task.findFirstOrThrow({
      where: { userId: user.id, status: "SUGGESTED" },
    });
    await acceptSuggestedTask(suggestion.id);
    await setTaskCompleted(suggestion.id, true);
    const events = await listActivity({ applicationId });
    expect(events.some((event) => event.type === "TASK_COMPLETED")).toBe(true);

    const other = await createTask(createTaskSchema.parse({ title: "Prep", applicationId }));
    await dismissTask(other);
    expect((await prisma.task.findUniqueOrThrow({ where: { id: other } })).status).toBe("DISMISSED");
  });

  it("rejects linking to another user's application and editing their tasks", async () => {
    const { applicationId } = await setup("Alice");
    const aliceTask = await createTask(createTaskSchema.parse({ title: "Alice task" }));
    await setup("Bob");
    await expect(createTask(createTaskSchema.parse({ title: "Sneaky", applicationId }))).rejects.toThrow(
      /not found/i,
    );
    await expect(setTaskCompleted(aliceTask, true)).rejects.toThrow(/not found/i);
    await expect(dismissTask(aliceTask)).rejects.toThrow(/not found/i);
  });
});

describe("calendar", () => {
  beforeEach(resetDatabase);

  it("places events on the user's local date", async () => {
    const { applicationId } = await setup();
    // 23:30 in Manila on Nov 3 is Nov 3 15:30 UTC: it must show on Nov 3.
    await createInterview(
      interview(applicationId, { title: "Late call", date: "2026-11-03", startTime: "23:30" }),
    );
    await createTask(createTaskSchema.parse({ title: "Send portfolio", dueDate: "2026-11-04" }));
    const month = await getCalendarMonth("2026-11");
    expect(month.eventsByDate["2026-11-03"]!.map((event) => event.title)).toEqual(["Late call"]);
    expect(month.eventsByDate["2026-11-04"]!.map((event) => event.kind)).toEqual(["task"]);
  });
});

describe("dashboard task metrics", () => {
  beforeEach(resetDatabase);

  it("counts every follow-up due today, not only the ones listed", async () => {
    await setup();
    const today = todayInTimeZone(TZ);
    for (let index = 0; index < 10; index++) {
      await createTask(
        createTaskSchema.parse({
          title: `Follow up ${index}`,
          dueDate: addDaysToDateOnly(today, -(index % 2)),
        }),
      );
    }
    await createTask(createTaskSchema.parse({ title: "Tomorrow", dueDate: addDaysToDateOnly(today, 1) }));

    const dashboard = await getDashboard();
    expect(dashboard.metrics.followUpsDue).toBe(10);
    expect(dashboard.metrics.overdueTasks).toBe(5);
    expect(dashboard.focusTasks).toHaveLength(5);
  });
});
