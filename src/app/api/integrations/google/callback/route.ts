import { connection, NextResponse, type NextRequest } from "next/server";
import { saveGoogleConnection } from "@/features/integrations/data";
import { OAUTH_COOKIE, OAUTH_COOKIE_PATH, verifyOAuthState } from "@/features/integrations/oauth-state";
import { DomainError } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth/session";
import { appEnv, authEnv } from "@/lib/env";
import { exchangeCode, isGoogleConfigured } from "@/lib/integrations/google/client";
import { errorMessage, logger } from "@/lib/logger";
import { revalidateWorkspace } from "@/lib/revalidate";

/** Google redirects here after consent. Verifies state, stores encrypted tokens. */
export async function GET(request: NextRequest) {
  await connection();
  const { APP_URL } = appEnv();
  const back = (query: string) => {
    const response = NextResponse.redirect(new URL(`/settings/integrations?${query}`, APP_URL));
    response.cookies.set(OAUTH_COOKIE, "", { path: OAUTH_COOKIE_PATH, maxAge: 0 });
    return response;
  };

  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", APP_URL));
  if (!isGoogleConfigured()) return back("error=not_configured");

  const params = request.nextUrl.searchParams;
  const validState = verifyOAuthState({
    cookie: request.cookies.get(OAUTH_COOKIE)?.value,
    state: params.get("state"),
    userId: user.id,
    secret: authEnv().BETTER_AUTH_SECRET,
  });
  if (!validState) return back("error=invalid_state");
  if (params.get("error"))
    return back(params.get("error") === "access_denied" ? "error=denied" : "error=google");

  const code = params.get("code");
  if (!code) return back("error=google");
  try {
    const tokens = await exchangeCode(code, `${APP_URL}/api/integrations/google/callback`);
    await saveGoogleConnection(user.id, tokens);
  } catch (error) {
    if (error instanceof DomainError) return back("error=no_refresh_token");
    logger.error("google oauth callback failed", { userId: user.id, error: errorMessage(error) });
    return back("error=google");
  }
  revalidateWorkspace();
  return back("connected=1");
}
