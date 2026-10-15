import { appEnv } from "@/lib/env";

/**
 * CSRF defence in depth for cookie-authenticated POST Route Handlers
 * (Server Actions already check Origin). Session cookies are SameSite=Lax,
 * and this additionally rejects cross-site requests that carry an Origin.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") !== "cross-site";
  try {
    return new URL(origin).origin === new URL(appEnv().APP_URL).origin;
  } catch {
    return false;
  }
}
