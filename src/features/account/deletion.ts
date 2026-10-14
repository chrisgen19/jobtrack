import { decryptSecret } from "@/lib/crypto";
import { revokeToken } from "@/lib/integrations/google/client";
import { enqueueJob } from "@/lib/jobs/queue";
import { MAX_STORAGE_KEYS_PER_JOB } from "@/lib/jobs/types";
import { errorMessage, logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

/** Delay before file cleanup runs, so it normally starts after the account delete committed. */
const FILE_CLEANUP_DELAY_MS = 60_000;

/**
 * Account deletion hooks for Better Auth. Deleting the `user` row cascades
 * to every owned table; private files live outside the database.
 *
 * Better Auth runs these hooks and the delete as separate steps, so file
 * cleanup is queued durably BEFORE the delete: a crash afterwards cannot lose
 * the storage keys. The worker only removes objects that no document row
 * references any more, so if the delete fails the user keeps their files.
 */
export async function beforeAccountDelete(userId: string): Promise<void> {
  const documents = await prisma.document.findMany({ where: { userId }, select: { storageKey: true } });
  const storageKeys = documents.map((document) => document.storageKey);
  const runAt = new Date(Date.now() + FILE_CLEANUP_DELAY_MS);
  // All batches or none; an error here aborts the account deletion.
  await prisma.$transaction(async (tx) => {
    for (let start = 0; start < storageKeys.length; start += MAX_STORAGE_KEYS_PER_JOB) {
      const batch = storageKeys.slice(start, start + MAX_STORAGE_KEYS_PER_JOB);
      await enqueueJob(tx, "delete_user_files", { storageKeys: batch }, { runAt, maxAttempts: 25 });
    }
  });

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
  logger.info("account deleted", { userId });
}
