import "server-only";
import type { ExtensionError } from "@jobtrack/shared/extension-api";
import { clientIp } from "@/lib/client-ip";
import { rateLimit } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/read-json-body";
import { authenticateExtensionRequest, type ExtensionAuth } from "./tokens";

/** Requests per token per minute on the extension API. */
const REQUESTS_PER_MINUTE = 60;

/**
 * Requests per client IP per minute, checked before the token lookup so
 * bogus tokens cannot reach the database without limit. Generous enough for
 * several users behind one NAT.
 */
export const IP_REQUESTS_PER_MINUTE = 300;

/** Largest accepted JSON body (a 20k-character description plus fields). */
export const MAX_EXTENSION_BODY_BYTES = 100_000;

type AuthorizedHandler = (auth: Extract<ExtensionAuth, { status: "ok" }>) => Promise<Response>;

/** JSON response that is never cached (all extension API data is private). */
export function extensionJson(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { "cache-control": "private, no-store", ...headers } });
}

export function extensionError(
  status: number,
  error: string,
  fieldErrors?: ExtensionError["fieldErrors"],
): Response {
  return extensionJson({ error, ...(fieldErrors ? { fieldErrors } : {}) } satisfies ExtensionError, status);
}

/**
 * Applies the per-IP rate limit, authenticates the extension token and
 * applies the per-token rate limit before running the handler. Session cookies are never accepted here.
 */
export async function withExtensionAuth(request: Request, handler: AuthorizedHandler): Promise<Response> {
  const ipLimit = rateLimit(`extension-ip:${clientIp(request)}`, IP_REQUESTS_PER_MINUTE, 60_000);
  if (!ipLimit.allowed) return tooManyRequests(ipLimit.retryAfterSeconds);
  const auth = await authenticateExtensionRequest(request);
  if (auth.status === "unauthorized") {
    return extensionError(401, "This extension is not connected. Connect it to JobTrack again.");
  }
  if (auth.status === "not_onboarded") {
    return extensionError(403, "Finish setting up your JobTrack workspace first.");
  }
  const limit = rateLimit(`extension:${auth.tokenId}`, REQUESTS_PER_MINUTE, 60_000);
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);
  return handler(auth);
}

function tooManyRequests(retryAfterSeconds: number): Response {
  return extensionJson({ error: "Too many requests. Try again in a moment." } satisfies ExtensionError, 429, {
    "retry-after": String(retryAfterSeconds),
  });
}

/** The request's JSON body (up to MAX_EXTENSION_BODY_BYTES by default), or the error response to return. */
export async function readExtensionJson(
  request: Request,
  maxBytes = MAX_EXTENSION_BODY_BYTES,
): Promise<{ value: unknown } | { error: Response }> {
  const body = await readJsonBody(request, maxBytes);
  if (body.ok) return { value: body.value };
  return {
    error:
      body.status === 413
        ? extensionError(413, "That job is too large to save.")
        : extensionError(400, "Invalid JSON body."),
  };
}
