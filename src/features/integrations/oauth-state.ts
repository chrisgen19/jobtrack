import { randomBytes } from "node:crypto";
import { safeEqual, sign } from "@/lib/crypto";

/**
 * CSRF protection for the Google OAuth flow: a random nonce travels in the
 * `state` parameter, and an HMAC-signed cookie binds it to the user who
 * started the flow and to a 10-minute expiry.
 */

export const OAUTH_COOKIE = "jt_google_oauth";
export const OAUTH_COOKIE_PATH = "/api/integrations/google";
const TTL_MS = 10 * 60_000;

export function createOAuthState(
  userId: string,
  secret: string,
  now = Date.now(),
): { state: string; cookie: string } {
  const nonce = randomBytes(24).toString("base64url");
  const payload = `${nonce}.${userId}.${now + TTL_MS}`;
  return { state: nonce, cookie: `${payload}.${sign(payload, secret)}` };
}

export function verifyOAuthState(params: {
  cookie: string | undefined;
  state: string | null;
  userId: string;
  secret: string;
  now?: number;
}): boolean {
  const { cookie, state, userId, secret, now = Date.now() } = params;
  if (!cookie || !state) return false;
  const parts = cookie.split(".");
  if (parts.length !== 4) return false;
  const [nonce, cookieUser, expiresAt, signature] = parts as [string, string, string, string];
  if (!safeEqual(signature, sign(`${nonce}.${cookieUser}.${expiresAt}`, secret))) return false;
  return safeEqual(nonce, state) && cookieUser === userId && Number(expiresAt) > now;
}
