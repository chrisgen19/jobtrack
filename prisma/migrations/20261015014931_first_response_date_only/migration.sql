-- The first employer response is a calendar date the user picks, so it is stored
-- date-only like applied_on. It used to be a noon instant in the timezone at the
-- time, read back in the current timezone, so changing the timezone by 12 hours
-- or more (e.g. Los Angeles to Manila) moved it by a day.
--
-- Expand step only (docs/DEPLOYMENT_COOLIFY.md, "Deploying schema changes
-- safely"): first_response_at stays, because the previous release still reads
-- it while it serves during the deploy. This release writes both columns and
-- falls back to first_response_at; a later release drops it.
-- Written by hand to backfill; see the two steps below.

-- AlterTable
ALTER TABLE "applications" ADD COLUMN "first_response_on" DATE;

-- Backfill 1: the date the user entered. Every recorded response saved it on its
-- EMPLOYER_RESPONSE_RECEIVED event; the latest one matches the current value.
-- This keeps the original date even if the timezone has changed since.
UPDATE "applications" AS a
SET "first_response_on" = (
  SELECT (e."details" ->> 'respondedOn')::date
  FROM "activity_events" AS e
  WHERE e."application_id" = a."id"
    AND e."type" = 'EMPLOYER_RESPONSE_RECEIVED'
    AND e."details" ->> 'respondedOn' ~ '^\d{4}-\d{2}-\d{2}$'
  ORDER BY e."created_at" DESC
  LIMIT 1
)
WHERE a."first_response_at" IS NOT NULL;

-- Backfill 2: responses without such an event (e.g. demo seed data) become the
-- date they currently show, in the user's current timezone (UTC without a
-- preferences row).
UPDATE "applications" AS a
SET "first_response_on" = (a."first_response_at" AT TIME ZONE p."timezone")::date
FROM "user_preferences" AS p
WHERE p."user_id" = a."user_id" AND a."first_response_at" IS NOT NULL AND a."first_response_on" IS NULL;

UPDATE "applications"
SET "first_response_on" = ("first_response_at" AT TIME ZONE 'UTC')::date
WHERE "first_response_at" IS NOT NULL AND "first_response_on" IS NULL;
