-- The first employer response is a calendar date the user picks, so it is stored
-- date-only like applied_on. It used to be a noon instant in the timezone at the
-- time, read back in the current timezone, so changing the timezone by 12 hours
-- or more (e.g. Los Angeles to Manila) moved it by a day.
-- Written by hand to backfill: each value becomes the date it currently shows,
-- in the user's current timezone (UTC if a user has no preferences row).

-- AlterTable
ALTER TABLE "applications" ADD COLUMN "first_response_on" DATE;

-- Backfill
UPDATE "applications" AS a
SET "first_response_on" = (a."first_response_at" AT TIME ZONE p."timezone")::date
FROM "user_preferences" AS p
WHERE p."user_id" = a."user_id" AND a."first_response_at" IS NOT NULL;

UPDATE "applications"
SET "first_response_on" = ("first_response_at" AT TIME ZONE 'UTC')::date
WHERE "first_response_at" IS NOT NULL AND "first_response_on" IS NULL;

-- AlterTable
ALTER TABLE "applications" DROP COLUMN "first_response_at";
