import "server-only";
import type { ExtensionError } from "@jobtrack/shared/extension-api";
import { rateLimit } from "@/lib/rate-limit";
import { authenticateExtensionRequest, type ExtensionAuth } from "./tokens";

/** Requests per token per minute on the extension API. */
const REQUESTS_PER_MINUTE = 60;

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
 * Authenticates the extension token and applies the per-token rate limit
 * before running the handler. Session cookies are never accepted here.
 */
export async function withExtensionAuth(request: Request, handler: AuthorizedHandler): Promise<Response> {
  const auth = await authenticateExtensionRequest(request);
  if (auth.status === "unauthorized") {
    return extensionError(401, "This extension is not connected. Connect it to JobTrack again.");
  }
  if (auth.status === "not_onboarded") {
    return extensionError(403, "Finish setting up your JobTrack workspace first.");
  }
  const limit = rateLimit(`extension:${auth.tokenId}`, REQUESTS_PER_MINUTE, 60_000);
  if (!limit.allowed) {
    return extensionJson(
      { error: "Too many requests. Try again in a moment." } satisfies ExtensionError,
      429,
      {
        "retry-after": String(limit.retryAfterSeconds),
      },
    );
  }
  return handler(auth);
}

/** Reads a JSON body up to MAX_EXTENSION_BODY_BYTES; null when too large or not JSON. */
export async function readJsonBody(request: Request): Promise<{ value: unknown } | { error: Response }> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_EXTENSION_BODY_BYTES)
    return { error: extensionError(413, "That job is too large to save.") };
  const text = await request.text();
  if (Buffer.byteLength(text) > MAX_EXTENSION_BODY_BYTES) {
    return { error: extensionError(413, "That job is too large to save.") };
  }
  try {
    return { value: JSON.parse(text) };
  } catch {
    return { error: extensionError(400, "Invalid JSON body.") };
  }
}
