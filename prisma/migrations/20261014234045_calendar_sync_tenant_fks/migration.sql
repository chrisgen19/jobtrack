-- Calendar links reference their interview/task through (user_id, id), like every
-- other private relation, so a link can never point at another user's record.
-- Edited by hand: SET NULL only clears the source column (PostgreSQL 15+). Prisma
-- generates a plain SET NULL, which would also try to clear the required user_id.

-- DropForeignKey
ALTER TABLE "calendar_event_syncs" DROP CONSTRAINT "calendar_event_syncs_interview_id_fkey";

-- DropForeignKey
ALTER TABLE "calendar_event_syncs" DROP CONSTRAINT "calendar_event_syncs_task_id_fkey";

-- AddForeignKey
ALTER TABLE "calendar_event_syncs" ADD CONSTRAINT "calendar_event_syncs_user_id_interview_id_fkey" FOREIGN KEY ("user_id", "interview_id") REFERENCES "interviews"("user_id", "id") ON DELETE SET NULL ("interview_id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_syncs" ADD CONSTRAINT "calendar_event_syncs_user_id_task_id_fkey" FOREIGN KEY ("user_id", "task_id") REFERENCES "tasks"("user_id", "id") ON DELETE SET NULL ("task_id") ON UPDATE CASCADE;
