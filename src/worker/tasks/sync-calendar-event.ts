import type { Task } from "graphile-worker";
import { z } from "zod";
import { syncCalendarEvent } from "@/features/calendar-sync/sync";
import { logger } from "@/lib/logger";

const payloadSchema = z.object({ syncId: z.uuid() });

/** One-way Google Calendar sync for one interview/task link. */
export const syncCalendarEventTask: Task = async (rawPayload, helpers) => {
  const parsed = payloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    logger.error("sync_calendar_event: invalid payload, dropping job", { jobId: helpers.job.id });
    return;
  }
  const outcome = await syncCalendarEvent(parsed.data.syncId);
  logger.info("sync_calendar_event: done", { jobId: helpers.job.id, syncId: parsed.data.syncId, outcome });
};
