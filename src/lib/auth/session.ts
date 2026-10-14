import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getAuth } from "@/lib/auth/auth";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
};

/** Validated Better Auth session for this request, or null (memoized per request). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Read the request first: during prerendering this suspends, so the auth
  // instance (which needs runtime secrets) is never built at build time.
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) return null;
  const { id, name, email, emailVerified, image } = session.user;
  return { id, name, email, emailVerified, image: image ?? null };
});

/**
 * The signed-in user; redirects to /login when there is none. Every data
 * layer function and Server Action starts here, so ownership always comes
 * from the session, never from request input.
 */
export const requireUser = cache(async (): Promise<CurrentUser> => {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
});
