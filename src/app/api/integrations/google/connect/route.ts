import { connection, NextResponse } from "next/server";
import { createOAuthState, OAUTH_COOKIE, OAUTH_COOKIE_PATH } from "@/features/integrations/oauth-state";
import { getCurrentUser } from "@/lib/auth/session";
import { appEnv, authEnv } from "@/lib/env";
import { buildAuthUrl, isGoogleConfigured } from "@/lib/integrations/google/client";

/** Starts the explicit "Connect Google Calendar" consent flow. */
export async function GET() {
  await connection();
  const user = await getCurrentUser();
  const { APP_URL, NODE_ENV } = appEnv();
  if (!user) return NextResponse.redirect(new URL("/login", APP_URL));
  if (!isGoogleConfigured())
    return NextResponse.redirect(new URL("/settings/integrations?error=not_configured", APP_URL));

  const { state, cookie } = createOAuthState(user.id, authEnv().BETTER_AUTH_SECRET);
  const response = NextResponse.redirect(buildAuthUrl(`${APP_URL}/api/integrations/google/callback`, state));
  response.cookies.set(OAUTH_COOKIE, cookie, {
    httpOnly: true,
    secure: NODE_ENV === "production",
    sameSite: "lax",
    path: OAUTH_COOKIE_PATH,
    maxAge: 600,
  });
  return response;
}
