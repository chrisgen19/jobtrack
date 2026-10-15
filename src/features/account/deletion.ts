import { decryptSecret } from "@/lib/crypto";
import { revokeToken } from "@/lib/integrations/google/client";
import { errorMessage, logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

/**
 * Account deletion hooks for Better Auth. Deleting the `user` row cascades
 * to every owned table; private files live outside the database.
 *
 * File cleanup needs no hook: the `documents_queue_file_cleanup` trigger
 * queues it in the same transaction as the cascading delete, for every
 * document row the delete removes. That includes uploads that commit while
 * these hooks run, and nothing is queued if the delete fails.
 */
export async function beforeAccountDelete(userId: string): Promise<void> {
  // Revoke Google Calendar access (best effort: never blocks the deletion);
  // the encrypted tokens are deleted with the account.
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
