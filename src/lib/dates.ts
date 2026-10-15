import { TZDate } from "@date-fns/tz";
import { addDays, format } from "date-fns";

/**
 * Date and time helpers.
 *
 * Two kinds of values exist in JobTrack:
 * - Calendar dates (applied on, deadlines) are `YYYY-MM-DD` strings in the
 *   app and PostgreSQL DATE in the database. Prisma maps DATE to a JS Date at
 *   UTC midnight, so conversions always use UTC getters to avoid drift.
 * - Instants (interviews, task due times) are UTC `Date`s, entered and shown
 *   in an IANA timezone.
 */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_OF_DAY = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Prisma DATE value -> `YYYY-MM-DD`. */
export function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function toDateOnlyOrNull(value: Date | null | undefined): string | null {
  return value ? toDateOnly(value) : null;
}

/** `YYYY-MM-DD` -> Date at UTC midnight (for Prisma DATE columns). */
export function parseDateOnly(value: string): Date {
  const match = DATE_ONLY.exec(value);
  if (!match) throw new RangeError(`Invalid date: ${value}`);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (toDateOnly(date) !== value) throw new RangeError(`Invalid date: ${value}`);
  return date;
}

export function isValidDateOnly(value: string): boolean {
  try {
    parseDateOnly(value);
    return true;
  } catch {
    return false;
  }
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Today's calendar date in the given timezone, as `YYYY-MM-DD`. */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): string {
  return format(new TZDate(now.getTime(), timeZone), "yyyy-MM-dd");
}

/** Adds days to a `YYYY-MM-DD` date. */
export function addDaysToDateOnly(value: string, days: number): string {
  return toDateOnly(addDays(parseDateOnly(value), days));
}

/**
 * Converts a wall-clock date + time in `timeZone` to a UTC instant.
 * Non-existent local times (DST gaps) resolve forward, matching how
 * calendar apps treat them.
 */
export function zonedToUtc(date: string, time: string, timeZone: string): Date {
  const dateMatch = DATE_ONLY.exec(date);
  const timeMatch = TIME_OF_DAY.exec(time);
  if (!dateMatch || !timeMatch) throw new RangeError(`Invalid date/time: ${date} ${time}`);
  const zoned = new TZDate(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
    timeZone,
  );
  return new Date(zoned.getTime());
}

/** UTC instant -> `{ date: "YYYY-MM-DD", time: "HH:mm" }` in `timeZone`. */
export function utcToZonedParts(instant: Date, timeZone: string): { date: string; time: string } {
  const zoned = new TZDate(instant.getTime(), timeZone);
  return { date: format(zoned, "yyyy-MM-dd"), time: format(zoned, "HH:mm") };
}

/** UTC bounds of a local calendar day in `timeZone` ([start, end)). */
export function dayBoundsUtc(date: string, timeZone: string): { start: Date; end: Date } {
  return {
    start: zonedToUtc(date, "00:00", timeZone),
    end: zonedToUtc(addDaysToDateOnly(date, 1), "00:00", timeZone),
  };
}

/** Formats an instant in a timezone with a date-fns pattern. */
export function formatInTimeZone(instant: Date, timeZone: string, pattern: string): string {
  return format(new TZDate(instant.getTime(), timeZone), pattern);
}

/** Formats a `YYYY-MM-DD` calendar date without any timezone shift. */
export function formatDateOnly(value: string, pattern = "MMM d, yyyy"): string {
  const [year, month, day] = value.split("-").map(Number);
  return format(new Date(year!, month! - 1, day!), pattern);
}

/** Short timezone label such as "GMT+8" for an instant. */
export function timeZoneLabel(timeZone: string, at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" }).formatToParts(at);
  return parts.find((part) => part.type === "timeZoneName")?.value ?? timeZone;
}

/**
 * All IANA timezones supported by the runtime, plus "UTC": Intl leaves it out, but a
 * browser in UTC reports it, and a timezone select without it falls back to its first
 * option (Africa/Abidjan) instead.
 */
export function supportedTimeZones(): string[] {
  const zones = Intl.supportedValuesOf("timeZone");
  return zones.includes("UTC") ? zones : [...zones, "UTC"].sort();
}
