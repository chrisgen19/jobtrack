-- Document versions and reminder links reference their target through (user_id, id),
-- like every other private relation, so a row can never point at another user's
-- document or reminder. Edited by hand: SET NULL only clears the link column
-- (PostgreSQL 15+). Prisma generates a plain SET NULL, which would also try to
-- clear the required user_id. The (user_id, reminder_id) unique index is required
-- by Prisma for the one-to-one notification relation.

-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_replaces_id_fkey";

-- DropForeignKey
ALTER TABLE "notification_deliveries" DROP CONSTRAINT "notification_deliveries_reminder_id_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_reminder_id_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "notifications_user_id_reminder_id_key" ON "notifications"("user_id", "reminder_id");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_replaces_id_fkey" FOREIGN KEY ("user_id", "replaces_id") REFERENCES "documents"("user_id", "id") ON DELETE SET NULL ("replaces_id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_reminder_id_fkey" FOREIGN KEY ("user_id", "reminder_id") REFERENCES "reminders"("user_id", "id") ON DELETE SET NULL ("reminder_id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_user_id_reminder_id_fkey" FOREIGN KEY ("user_id", "reminder_id") REFERENCES "reminders"("user_id", "id") ON DELETE SET NULL ("reminder_id") ON UPDATE CASCADE;

