import type { Task } from "graphile-worker";
import { z } from "zod";
import { getStorage } from "@/lib/integrations/storage";
import { logger } from "@/lib/logger";

const payloadSchema = z.object({
  storageKeys: z.array(z.string().regex(/^users\/[^/]+\/[0-9a-f-]{36}$/)).max(5_000),
});

/**
 * Removes private document objects after their metadata was deleted (single
 * document deletes that failed, and account deletion). Deleting a missing
 * key succeeds, so retries are safe.
 */
export const deleteUserFilesTask: Task = async (rawPayload, helpers) => {
  const parsed = payloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    logger.error("delete_user_files: invalid payload, dropping job", { jobId: helpers.job.id });
    return;
  }
  const storage = getStorage();
  for (const key of parsed.data.storageKeys) {
    await storage.delete(key);
  }
  logger.info("delete_user_files: removed objects", {
    jobId: helpers.job.id,
    count: parsed.data.storageKeys.length,
  });
};
