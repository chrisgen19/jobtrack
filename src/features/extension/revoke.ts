import { prisma } from "@/lib/prisma";

/**
 * Revokes every active extension token of a user. Called by Better Auth when
 * the password is reset or changed with "sign out other sessions", so a
 * token connected by someone who had the old password stops working too.
 * Kept free of session imports: `src/lib/auth/auth.ts` imports it.
 */
export async function revokeAllExtensionTokensForUser(userId: string): Promise<number> {
  const { count } = await prisma.extensionToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return count;
}
