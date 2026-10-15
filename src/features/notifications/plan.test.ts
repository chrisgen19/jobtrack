import { describe, expect, it } from "vitest";
import { planReminders, type ReminderSource } from "./plan";

const now = new Date("2026-10-14T00:00:00Z");
const both = { inApp: true, email: true, emailVerified: true };

function interview(overrides: Partial<Extract<ReminderSource, { kind: "interview" }>> = {}): ReminderSource {
  return {
    kind: "interview",
    id: "i1",
    status: "SCHEDULED",
    startsAt: new Date("2026-10-16T06:00:00Z"),
    minutesBefore: 1440,
    revision: 0,
    ...overrides,
  };
}

describe("planReminders", () => {
  it("plans one reminder per enabled channel, a day before the interview", () => {
    const planned = planReminders(interview(), both, now);
    expect(planned.map((item) => item.channel)).toEqual(["IN_APP", "EMAIL"]);
    expect(planned[0]!.remindAt.toISOString()).toBe("2026-10-15T06:00:00.000Z");
    expect(planned[0]!.dedupeKey).toBe("interview:i1:r0:IN_APP:2026-10-15T06:00:00.000Z");
  });

  it("never emails unverified or opted-out users", () => {
    expect(
      planReminders(interview(), { inApp: true, email: true, emailVerified: false }, now).map(
        (item) => item.channel,
      ),
    ).toEqual(["IN_APP"]);
    expect(planReminders(interview(), { inApp: false, email: false, emailVerified: true }, now)).toEqual([]);
  });

  it("changes the dedupe key when rescheduled, so old reminders become obsolete", () => {
    const before = planReminders(interview(), both, now)[0]!;
    const after = planReminders(
      interview({ startsAt: new Date("2026-10-17T06:00:00Z"), revision: 1 }),
      both,
      now,
    )[0]!;
    expect(after.dedupeKey).not.toBe(before.dedupeKey);
  });

  it("plans nothing for cancelled, completed, past or reminder-less interviews", () => {
    expect(planReminders(interview({ status: "CANCELLED" }), both, now)).toEqual([]);
    expect(planReminders(interview({ status: "COMPLETED" }), both, now)).toEqual([]);
    expect(planReminders(interview({ startsAt: new Date("2026-10-13T00:00:00Z") }), both, now)).toEqual([]);
    expect(planReminders(interview({ minutesBefore: null }), both, now)).toEqual([]);
  });

  it("delivers an overdue reminder now but keeps a stable key across re-plans", () => {
    const soon = interview({ startsAt: new Date("2026-10-14T02:00:00Z") });
    const first = planReminders(soon, both, now)[0]!;
    const later = planReminders(soon, both, new Date("2026-10-14T00:30:00Z"))[0]!;
    expect(first.runAt).toEqual(now);
    expect(first.dedupeKey).toBe(later.dedupeKey);
  });

  it("reminds about offer deadlines at 9:00 local time the day before", () => {
    const planned = planReminders(
      {
        kind: "offer",
        id: "o1",
        status: "RECEIVED",
        decisionDeadline: "2026-10-20",
        timezone: "Asia/Manila",
        enabled: true,
      },
      { inApp: true, email: false, emailVerified: true },
      now,
    );
    expect(planned[0]!.remindAt.toISOString()).toBe("2026-10-19T01:00:00.000Z");
  });

  it("only reminds about open tasks with a due date", () => {
    const task = {
      kind: "task" as const,
      id: "t1",
      dueAt: new Date("2026-10-15T01:00:00Z"),
      minutesBefore: 60,
      revision: 2,
    };
    expect(planReminders({ ...task, status: "OPEN" }, both, now)).toHaveLength(2);
    expect(planReminders({ ...task, status: "SUGGESTED" }, both, now)).toEqual([]);
    expect(planReminders({ ...task, status: "COMPLETED" }, both, now)).toEqual([]);
  });
});
