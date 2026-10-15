import type { Task } from "graphile-worker";
import { z } from "zod";
import { PermanentEmailError, sendEmail } from "@/lib/integrations/email";
import { errorMessage, logger } from "@/lib/logger";

const payloadSchema = z.object({
  to: z.email(),
  subject: z.string().min(1).max(300),
  html: z.string().min(1),
  text: z.string().min(1),
  idempotencyKey: z.string().min(1).max(256),
});

/**
 * Sends one transactional email (verification, password reset). Transient
 * provider errors throw so Graphile Worker retries with backoff; permanent
 * ones are logged and the job completes so it is not retried forever.
 */
export const sendEmailTask: Task = async (rawPayload, helpers) => {
  const parsed = payloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    logger.error("send_email: invalid payload, dropping job", { jobId: helpers.job.id });
    return;
  }
  try {
    const result = await sendEmail(parsed.data);
    logger.info("send_email: delivered", { jobId: helpers.job.id, provider: result.provider });
  } catch (error) {
    if (error instanceof PermanentEmailError) {
      logger.error("send_email: permanent failure, not retrying", {
        jobId: helpers.job.id,
        error: errorMessage(error),
      });
      return;
    }
    logger.warn("send_email: transient failure, will retry", {
      jobId: helpers.job.id,
      attempt: helpers.job.attempts,
      error: errorMessage(error),
    });
    throw error;
  }
};
