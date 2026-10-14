import { vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/session";

/**
 * Lets integration tests act as a given user. The real session module reads
 * Better Auth cookies from the request; here it returns `currentUser`.
 */
export const sessionState: { user: CurrentUser | null } = { user: null };

export function signInAs(user: { id: string; name: string; email: string }) {
  sessionState.user = { ...user, emailVerified: true, image: null };
}

export function signOut() {
  sessionState.user = null;
}

export const sessionMock = {
  getCurrentUser: vi.fn(async () => sessionState.user),
  requireUser: vi.fn(async () => {
    if (!sessionState.user) throw new Error("NEXT_REDIRECT:/login");
    return sessionState.user;
  }),
};
