/**
 * Small in-memory sliding-window limiter for app endpoints that Better
 * Auth's limiter does not cover (uploads, exports). Per process: with
 * several web replicas each enforces its own window, which is acceptable
 * for abuse protection on a single-VPS deployment.
 */

const hits = new Map<string, number[]>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): { allowed: boolean; retryAfterSeconds: number } {
  const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return { allowed: false, retryAfterSeconds: Math.ceil((windowMs - (now - recent[0]!)) / 1000) };
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 10_000) {
    for (const [entry, times] of hits) if (times.every((time) => now - time >= windowMs)) hits.delete(entry);
  }
  return { allowed: true, retryAfterSeconds: 0 };
}
