import "server-only";
import type { ExtensionAiSuggestions } from "@jobtrack/shared/extension-api";
import { parseDateOnly } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

/** How long a posting's suggestions are reused (postings rarely change within a week). */
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Requests the user made on their local day. */
export async function requestsOn(userId: string, day: string): Promise<number> {
  const row = await prisma.aiUsage.findUnique({
    where: { userId_day: { userId, day: parseDateOnly(day) } },
    select: { requests: true },
  });
  return row?.requests ?? 0;
}

/**
 * Counts one request against the user's daily limit, atomically: the row is
 * only incremented while under the limit, so parallel requests can't
 * overshoot it. Returns the new count, or null when the limit is reached.
 */
export async function reserveRequest(userId: string, day: string, limit: number): Promise<number | null> {
  if (limit <= 0) return null;
  const rows = await prisma.$queryRaw<{ requests: number }[]>`
    INSERT INTO ai_usage (user_id, day, requests, updated_at)
    VALUES (${userId}, ${day}::date, 1, now())
    ON CONFLICT (user_id, day) DO UPDATE
      SET requests = ai_usage.requests + 1, updated_at = now()
      WHERE ai_usage.requests < ${limit}
    RETURNING requests`;
  return rows[0]?.requests ?? null;
}

/** Gives a reserved request back (the provider failed, nothing was answered). */
export async function refundRequest(userId: string, day: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE ai_usage SET requests = GREATEST(requests - 1, 0), updated_at = now()
    WHERE user_id = ${userId} AND day = ${day}::date`;
}

export async function recordTokens(
  userId: string,
  day: string,
  input: number,
  output: number,
): Promise<void> {
  await prisma.aiUsage.update({
    where: { userId_day: { userId, day: parseDateOnly(day) } },
    data: { inputTokens: { increment: input }, outputTokens: { increment: output } },
  });
}

/**
 * Requests by all users since the first of the month (the server-wide cap).
 * Checked before reserving, so parallel requests can pass it by a few; the
 * per-user limit still applies to each.
 */
export async function requestsThisMonth(today: string): Promise<number> {
  const result = await prisma.aiUsage.aggregate({
    where: { day: { gte: parseDateOnly(`${today.slice(0, 7)}-01`) } },
    _sum: { requests: true },
  });
  return result._sum.requests ?? 0;
}

export async function readCachedSuggestions(
  userId: string,
  cacheKey: string,
): Promise<ExtensionAiSuggestions | null> {
  const row = await prisma.aiExtractionCache.findUnique({
    where: { userId_cacheKey: { userId, cacheKey } },
    select: { result: true, expiresAt: true },
  });
  return row && row.expiresAt > new Date() ? (row.result as ExtensionAiSuggestions) : null;
}

/**
 * Stores validated suggestions (never the page text) and removes the user's
 * expired entries; the worker has no cron, so cleanup happens on write.
 */
export async function cacheSuggestions(
  userId: string,
  cacheKey: string,
  suggestions: ExtensionAiSuggestions,
): Promise<void> {
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
  await prisma.$transaction([
    prisma.aiExtractionCache.deleteMany({ where: { userId, expiresAt: { lte: new Date() } } }),
    prisma.aiExtractionCache.upsert({
      where: { userId_cacheKey: { userId, cacheKey } },
      create: { userId, cacheKey, result: suggestions, expiresAt },
      update: { result: suggestions, expiresAt },
    }),
  ]);
}
