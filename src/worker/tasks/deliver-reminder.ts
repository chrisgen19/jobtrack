import type { Task } from "graphile-worker";
import { z } from "zod";
import { deliverReminder } from "@/features/notifications/delivery";
import { logger } from "@/lib/logger";

const payloadSchema = z.object({ reminderId: z.uuid() });

/** Delivers one scheduled reminder (in-app or email). See delivery.ts. */
export const deliverReminderTask: Task = async (rawPayload, helpers) => {
  const parsed = payloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    logger.error("deliver_reminder: invalid payload, dropping job", { jobId: helpers.job.id });
    return;
  }
  const outcome = await deliverReminder(parsed.data.reminderId, {
    number: helpers.job.attempts,
    max: helpers.job.max_attempts,
  });
  logger.info("deliver_reminder: done", {
    jobId: helpers.job.id,
    reminderId: parsed.data.reminderId,
    outcome,
  });
};
