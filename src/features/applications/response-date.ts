import { toDateOnly, utcToZonedParts } from "@/lib/dates";

/**
 * The recorded employer response date (YYYY-MM-DD). Rows written by the
 * previous release only have the old noon instant, read in the user's
 * timezone as that release did. Remove the fallback together with the
 * first_response_at column (the contract step).
 */
export function recordedResponseOn(
  row: { firstResponseOn: Date | null; firstResponseAt: Date | null },
  timezone: string,
): string | null {
  if (row.firstResponseOn) return toDateOnly(row.firstResponseOn);
  return row.firstResponseAt ? utcToZonedParts(row.firstResponseAt, timezone).date : null;
}
