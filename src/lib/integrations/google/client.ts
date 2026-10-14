import { googleEnv } from "@/lib/env";

/**
 * Minimal Google OAuth 2.0 + Calendar v3 client over fetch. Shared by the
 * web app (connect, calendar list) and the worker (event sync).
 */

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  // Create/update/delete events only (no reading of personal events).
  "https://www.googleapis.com/auth/calendar.events",
  // List calendars so the user can pick a destination.
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
];

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export class GoogleApiError extends Error {
  override name = "GoogleApiError";
  constructor(
    readonly status: number,
    readonly reason: string,
    message: string,
  ) {
    super(message);
  }
  /** Token revoked/expired beyond refresh: the user must reconnect. */
  get needsReauth(): boolean {
    return this.reason === "invalid_grant" || this.status === 401;
  }
  /** Worth retrying later (rate limit or Google outage). */
  get retryable(): boolean {
    return (
      this.status === 429 ||
      this.status >= 500 ||
      this.reason === "rateLimitExceeded" ||
      this.reason === "userRateLimitExceeded"
    );
  }
}

function credentials() {
  const env = googleEnv();
  if (!env) throw new Error("Google Calendar is not configured.");
  return env;
}

export function isGoogleConfigured(): boolean {
  return googleEnv() !== null;
}

export function buildAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: credentials().clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
    state,
  });
  return `${AUTH_URL}?${params}`;
}

export type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
};

async function readError(response: Response): Promise<GoogleApiError> {
  const body = (await response.json().catch(() => ({}))) as {
    error?: string | { message?: string; errors?: { reason?: string }[]; status?: string };
    error_description?: string;
  };
  if (typeof body.error === "string")
    return new GoogleApiError(response.status, body.error, body.error_description ?? body.error);
  const reason = body.error?.errors?.[0]?.reason ?? body.error?.status ?? `http_${response.status}`;
  return new GoogleApiError(
    response.status,
    reason,
    body.error?.message ?? `Google API error ${response.status}`,
  );
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const { clientId, clientSecret } = credentials();
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...params }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as TokenResponse;
}

export function exchangeCode(code: string, redirectUri: string): Promise<TokenResponse> {
  return tokenRequest({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
}

export function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  return tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" });
}

/** Best-effort token revocation (disconnect / account deletion). */
export async function revokeToken(token: string): Promise<void> {
  await fetch(REVOKE_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
    signal: AbortSignal.timeout(10_000),
  });
}

/** Email claim from the ID token Google returned on the token endpoint (TLS, not user input). */
export function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString("utf8")) as {
      email?: string;
    };
    return payload.email ?? null;
  } catch {
    return null;
  }
}

async function calendarFetch<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<T | null> {
  const response = await fetch(`${CALENDAR_API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 204) return null;
  if (!response.ok) throw await readError(response);
  return (await response.json()) as T;
}

export type GoogleCalendar = { id: string; summary: string; primary?: boolean; accessRole: string };

export async function listCalendars(accessToken: string): Promise<GoogleCalendar[]> {
  const result = await calendarFetch<{ items?: GoogleCalendar[] }>(
    accessToken,
    "/users/me/calendarList?minAccessRole=writer",
  );
  return result?.items ?? [];
}

export type GoogleEventInput = {
  id?: string;
  summary: string;
  description: string;
  location?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
};

export async function insertEvent(
  accessToken: string,
  calendarId: string,
  event: GoogleEventInput,
): Promise<{ id: string }> {
  return (await calendarFetch<{ id: string }>(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=none`,
    {
      method: "POST",
      body: JSON.stringify(event),
    },
  ))!;
}

export async function updateEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  event: GoogleEventInput,
): Promise<{ id: string }> {
  const { id: _id, ...body } = event;
  return (await calendarFetch<{ id: string }>(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`,
    { method: "PUT", body: JSON.stringify(body) },
  ))!;
}

/** Deletes an event; an already-deleted event (404/410) counts as success. */
export async function deleteEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
  try {
    await calendarFetch(
      accessToken,
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`,
      {
        method: "DELETE",
      },
    );
  } catch (error) {
    if (error instanceof GoogleApiError && (error.status === 404 || error.status === 410)) return;
    throw error;
  }
}

/**
 * Deterministic Google event ID for a sync link, so a retried insert after
 * a crash hits 409 instead of creating a duplicate event. Google allows
 * base32hex characters (0-9, a-v); hex digits are a subset.
 */
export function eventIdFor(syncId: string): string {
  return `jt${syncId.replaceAll("-", "").toLowerCase()}`;
}
