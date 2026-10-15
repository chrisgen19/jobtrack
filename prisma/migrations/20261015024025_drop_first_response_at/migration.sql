-- Contract step for 20261015014931_first_response_date_only (docs/DEPLOYMENT_COOLIFY.md,
-- "Deploying schema changes safely"). Ship it only in a release after the one that
-- introduced first_response_on is deployed everywhere: from here on no running code
-- reads or writes first_response_at.
-- Written by hand to reconcile before the drop; see the steps below.

-- Rebuild 1: every recorded response from its latest EMPLOYER_RESPONSE_RECEIVED event.
-- Both releases saved the entered date there, so this also picks up a response the
-- previous release recorded or corrected during the expand deploy (it only updated
-- first_response_at). Only rows that already have a response are touched, so a
-- response is never brought back from an old event.
UPDATE "applications" AS a
SET "first_response_on" = latest."responded_on"
FROM (
  SELECT DISTINCT ON (e."application_id")
    e."application_id",
    (e."details" ->> 'respondedOn')::date AS "responded_on"
  FROM "activity_events" AS e
  WHERE e."type" = 'EMPLOYER_RESPONSE_RECEIVED'
    AND e."application_id" IS NOT NULL
    AND e."details" ->> 'respondedOn' ~ '^\d{4}-\d{2}-\d{2}$'
  ORDER BY e."application_id", e."created_at" DESC
) AS latest
WHERE latest."application_id" = a."id"
  AND (a."first_response_on" IS NOT NULL OR a."first_response_at" IS NOT NULL);

-- Rebuild 2: responses without such an event that only the old column has, as the
-- date they show in the user's current timezone (UTC without a preferences row).
UPDATE "applications" AS a
SET "first_response_on" = (a."first_response_at" AT TIME ZONE p."timezone")::date
FROM "user_preferences" AS p
WHERE p."user_id" = a."user_id" AND a."first_response_at" IS NOT NULL AND a."first_response_on" IS NULL;

UPDATE "applications"
SET "first_response_on" = ("first_response_at" AT TIME ZONE 'UTC')::date
WHERE "first_response_at" IS NOT NULL AND "first_response_on" IS NULL;

-- AlterTable
ALTER TABLE "applications" DROP COLUMN "first_response_at";
