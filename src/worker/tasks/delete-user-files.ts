import type { Task } from "graphile-worker";
import { z } from "zod";
import { getStorage } from "@/lib/integrations/storage";
import { MAX_STORAGE_KEYS_PER_JOB } from "@/lib/jobs/types";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const payloadSchema = z.object({
  storageKeys: z.array(z.string().regex(/^users\/[^/]+\/[0-9a-f-]{36}$/)).max(MAX_STORAGE_KEYS_PER_JOB),
});

/**
 * Removes private document objects after their metadata was deleted. The
 * `documents_queue_file_cleanup` trigger queues this job in the same
 * transaction as every document delete (single deletes and the account
 * delete cascade), so it only becomes visible once the rows are gone. Objects
 * a document row still references are kept anyway and the job fails, so
 * Graphile retries it later: files the user still owns are never removed.
 * Deleting a missing key succeeds, so retries are safe.
 */
export const deleteUserFilesTask: Task = async (rawPayload, helpers) => {
  const parsed = payloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    logger.error("delete_user_files: invalid payload, dropping job", { jobId: helpers.job.id });
    return;
  }
  const { storageKeys } = parsed.data;
  const stillReferenced = await prisma.document.findMany({
    where: { storageKey: { in: storageKeys } },
    select: { storageKey: true },
  });
  const keep = new Set(stillReferenced.map((document) => document.storageKey));
  const storage = getStorage();
  for (const key of storageKeys) {
    if (!keep.has(key)) await storage.delete(key);
  }
  logger.info("delete_user_files: removed objects", {
    jobId: helpers.job.id,
    count: storageKeys.length - keep.size,
  });
  if (keep.size > 0)
    throw new Error(`${keep.size} objects are still referenced by documents; retrying later`);
};
