import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getMe } from "@/app/api/extension/v1/me/route";
import { issueExtensionToken } from "@/features/extension/tokens";
import { completeOnboarding } from "@/features/workspace/data";
import { getAuth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../support/db";
import { signInAs, signOut } from "../support/session";

vi.mock("@/lib/auth/session", async () => (await import("../support/session")).sessionMock);

const PASSWORD = "correct-horse-battery-staple";
const NEW_PASSWORD = "another-horse-battery-staple";

/** A real Better Auth email/password account, verified and onboarded, with a connected extension. */
async function accountWithExtension() {
  const email = `revoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  await getAuth().api.signUpEmail({ body: { name: "Revoke Tester", email, password: PASSWORD } });
  const user = await prisma.user.update({
    where: { email },
    data: { emailVerified: true },
    select: { id: true, name: true, email: true },
  });
  signInAs(user);
  await completeOnboarding({ timezone: "Asia/Manila", currency: "PHP" });
  signOut();
  const { token } = await issueExtensionToken(user.id, "Chrome extension");
  return { email, token };
}

const meStatus = async (token: string) =>
  (
    await getMe(
      new Request("http://localhost:3100/api/extension/v1/me", {
        headers: { authorization: `Bearer ${token}` },
      }),
    )
  ).status;

/** Signs in through Better Auth and returns the session cookie header. */
async function sessionCookie(email: string): Promise<string> {
  const { headers } = await getAuth().api.signInEmail({
    body: { email, password: PASSWORD },
    returnHeaders: true,
  });
  return headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

describe("extension tokens and password changes", () => {
  beforeEach(resetDatabase);

  it("revokes extension tokens when the password is reset", async () => {
    const { email, token } = await accountWithExtension();
    expect(await meStatus(token)).toBe(200);

    await getAuth().api.requestPasswordReset({ body: { email, redirectTo: "/reset-password" } });
    const verification = await prisma.verification.findFirstOrThrow({
      where: { identifier: { startsWith: "reset-password:" } },
    });
    await getAuth().api.resetPassword({
      body: { newPassword: NEW_PASSWORD, token: verification.identifier.slice("reset-password:".length) },
    });

    expect(await meStatus(token)).toBe(401);
    expect(await prisma.extensionToken.count({ where: { revokedAt: null } })).toBe(0);
  });

  it("revokes extension tokens when the password is changed with other sessions signed out", async () => {
    const { email, token } = await accountWithExtension();
    const headers = new Headers({ cookie: await sessionCookie(email) });

    await expect(
      getAuth().api.changePassword({
        body: { currentPassword: "wrong-password-123", newPassword: NEW_PASSWORD, revokeOtherSessions: true },
        headers,
      }),
    ).rejects.toThrow();
    expect(await meStatus(token)).toBe(200);

    await getAuth().api.changePassword({
      body: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD, revokeOtherSessions: true },
      headers,
    });
    expect(await meStatus(token)).toBe(401);
  });
});
