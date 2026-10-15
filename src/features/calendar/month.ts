import { addDaysToDateOnly } from "@/lib/dates";

export type MonthCell = { date: string; day: number; inMonth: boolean };

/** `YYYY-MM` for a `YYYY-MM-DD` date. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [year, value] = month.split("-").map(Number);
  const index = year! * 12 + (value! - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/**
 * The 6x7 grid of calendar dates for a month (pure date arithmetic, no
 * timezone involved). `weekStartsOn` is 0 for Sunday, 1 for Monday.
 */
export function monthGrid(month: string, weekStartsOn: number): MonthCell[] {
  const [year, value] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year!, value! - 1, 1));
  const offset = (first.getUTCDay() - weekStartsOn + 7) % 7;
  const start = addDaysToDateOnly(`${month}-01`, -offset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = addDaysToDateOnly(start, index);
    return { date, day: Number(date.slice(8, 10)), inMonth: date.startsWith(month) };
  });
}

export function isValidMonth(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value));
}
