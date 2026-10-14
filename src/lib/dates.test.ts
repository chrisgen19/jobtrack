import { describe, expect, it } from "vitest";
import {
  addDaysToDateOnly,
  dayBoundsUtc,
  formatInTimeZone,
  parseDateOnly,
  todayInTimeZone,
  toDateOnly,
  utcToZonedParts,
  zonedToUtc,
} from "./dates";

describe("calendar dates", () => {
  it("round-trips YYYY-MM-DD through Prisma DATE values without drift", () => {
    const date = parseDateOnly("2026-10-14");
    expect(date.toISOString()).toBe("2026-10-14T00:00:00.000Z");
    expect(toDateOnly(date)).toBe("2026-10-14");
  });

  it("rejects impossible dates", () => {
    expect(() => parseDateOnly("2026-02-30")).toThrow(RangeError);
    expect(() => parseDateOnly("14/10/2026")).toThrow(RangeError);
  });

  it("adds days across month boundaries", () => {
    expect(addDaysToDateOnly("2026-10-30", 7)).toBe("2026-11-06");
  });
});

describe("timezone conversion", () => {
  it("converts Manila wall-clock time to UTC", () => {
    expect(zonedToUtc("2026-10-15", "14:00", "Asia/Manila").toISOString()).toBe("2026-10-15T06:00:00.000Z");
  });

  it("shows a Manila interview at the same instant in Perth (both UTC+8)", () => {
    const instant = zonedToUtc("2026-10-15", "14:00", "Asia/Manila");
    expect(utcToZonedParts(instant, "Australia/Perth")).toEqual({ date: "2026-10-15", time: "14:00" });
    expect(utcToZonedParts(instant, "Australia/Sydney")).toEqual({ date: "2026-10-15", time: "17:00" });
  });

  it("handles daylight-saving transitions (Sydney starts DST on 2026-10-04)", () => {
    const before = zonedToUtc("2026-10-03", "09:00", "Australia/Sydney");
    const after = zonedToUtc("2026-10-05", "09:00", "Australia/Sydney");
    expect(before.toISOString()).toBe("2026-10-02T23:00:00.000Z");
    expect(after.toISOString()).toBe("2026-10-04T22:00:00.000Z");
  });

  it("returns the local calendar day for an instant", () => {
    const lateUtc = new Date("2026-10-14T20:30:00.000Z");
    expect(todayInTimeZone("Asia/Manila", lateUtc)).toBe("2026-10-15");
    expect(todayInTimeZone("America/New_York", lateUtc)).toBe("2026-10-14");
  });

  it("computes UTC bounds of a local day", () => {
    const { start, end } = dayBoundsUtc("2026-10-14", "Asia/Manila");
    expect(start.toISOString()).toBe("2026-10-13T16:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-14T16:00:00.000Z");
  });

  it("formats in the requested timezone", () => {
    expect(formatInTimeZone(new Date("2026-10-15T06:00:00Z"), "Asia/Manila", "h:mm a")).toBe("2:00 PM");
  });
});
