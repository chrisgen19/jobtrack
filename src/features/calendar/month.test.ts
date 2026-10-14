import { describe, expect, it } from "vitest";
import { monthGrid, shiftMonth } from "./month";

describe("calendar month grid", () => {
  it("starts on the configured weekday and covers six weeks", () => {
    const sunday = monthGrid("2026-10", 0);
    expect(sunday).toHaveLength(42);
    expect(sunday[0]).toEqual({ date: "2026-09-27", day: 27, inMonth: false });
    expect(sunday.find((cell) => cell.date === "2026-10-01")).toMatchObject({ inMonth: true });

    const monday = monthGrid("2026-10", 1);
    expect(monday[0]!.date).toBe("2026-09-28");
  });

  it("shifts months across years", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});
