import { decryptSecret } from "@/lib/crypto";
import { revokeToken } from "@/lib/integrations/google/client";
import { enqueueJob } from "@/lib/jobs/queue";
import { errorMessage, logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

/**
 * Account deletion hooks for Better Auth. Deleting the `user` row cascades
 * to every owned table; private files live outside the database, so their
 * keys are collected before the delete and queued for removal only after it
 * succeeded (a failed delete never orphans data the user still owns).
 */
const pendingKeys = new Map<string, string[]>();

export async function beforeAccountDelete(userId: string): Promise<void> {
  const documents = await prisma.document.findMany({ where: { userId }, select: { storageKey: true } });
  pendingKeys.set(
    userId,
    documents.map((document) => document.storageKey),
  );

  // Revoke Google Calendar access; the encrypted tokens are deleted with the account.
  const connections = await prisma.calendarConnection.findMany({
    where: { userId },
    select: { encryptedRefreshToken: true },
  });
  for (const connection of connections) {
    try {
      await revokeToken(decryptSecret(connection.encryptedRefreshToken));
    } catch (error) {
      logger.warn("google revoke failed during account deletion", { userId, error: errorMessage(error) });
    }
  }
}

export async function afterAccountDelete(userId: string): Promise<void> {
  const storageKeys = pendingKeys.get(userId) ?? [];
  pendingKeys.delete(userId);
  logger.info("account deleted", { userId, files: storageKeys.length });
  if (storageKeys.length === 0) return;
  try {
    await enqueueJob(prisma, "delete_user_files", { storageKeys }, { maxAttempts: 25 });
  } catch (error) {
    logger.error("failed to queue file cleanup after account deletion", {
      userId,
      error: errorMessage(error),
    });
  }
}
