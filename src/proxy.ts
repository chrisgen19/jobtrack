import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic auth gate: redirects to /login when no session cookie exists.
 * It never touches the database; every page, Server Action and Route
 * Handler still validates the session through the data layer.
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const loginUrl = new URL("/login", request.url);
    const next = request.nextUrl.pathname + request.nextUrl.search;
    if (next !== "/dashboard") loginUrl.searchParams.set("next", next);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/onboarding",
    "/dashboard/:path*",
    "/jobs/:path*",
    "/applications/:path*",
    "/pipeline/:path*",
    "/calendar/:path*",
    "/tasks/:path*",
    "/analytics/:path*",
    "/documents/:path*",
    "/contacts/:path*",
    "/notifications/:path*",
    "/settings/:path*",
  ],
};
