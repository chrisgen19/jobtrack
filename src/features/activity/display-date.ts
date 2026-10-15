import type { ActivityType } from "@/generated/prisma/enums";
import { isValidDateOnly } from "@/lib/dates";

/**
 * The calendar date an event stands for when the user picked a date rather
 * than a time (the employer response). Lists show this date instead of the
 * stored instant, which is a synthetic noon that a later timezone change
 * would move to another day. Null for every other event.
 */
export function activityDisplayDate(type: ActivityType, details: unknown): string | null {
  if (type !== "EMPLOYER_RESPONSE_RECEIVED") return null;
  const respondedOn = (details as { respondedOn?: unknown } | null)?.respondedOn;
  return typeof respondedOn === "string" && isValidDateOnly(respondedOn) ? respondedOn : null;
}
