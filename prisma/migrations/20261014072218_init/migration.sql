-- CreateEnum
CREATE TYPE "StageCategory" AS ENUM ('APPLIED', 'SCREENING', 'ASSESSMENT', 'INTERVIEW', 'OFFER', 'OTHER');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ApplicationOutcome" AS ENUM ('ACCEPTED', 'REJECTED', 'WITHDRAWN', 'OFFER_DECLINED', 'NO_RESPONSE', 'ROLE_CANCELLED');

-- CreateEnum
CREATE TYPE "ApplicationMethod" AS ENUM ('COMPANY_WEBSITE', 'JOB_BOARD', 'LINKEDIN_EASY_APPLY', 'EMAIL', 'REFERRAL', 'RECRUITER', 'OTHER');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'FREELANCE', 'INTERNSHIP', 'TEMPORARY', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkArrangement" AS ENUM ('REMOTE', 'HYBRID', 'ONSITE');

-- CreateEnum
CREATE TYPE "SalaryPeriod" AS ENUM ('HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'ANNUALLY');

-- CreateEnum
CREATE TYPE "SalaryBasis" AS ENUM ('GROSS', 'NET', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "InterviewType" AS ENUM ('RECRUITER_SCREEN', 'PHONE_SCREEN', 'TECHNICAL', 'CODING_CHALLENGE', 'ASSESSMENT', 'SYSTEM_DESIGN', 'BEHAVIORAL', 'HIRING_MANAGER', 'PANEL', 'CLIENT', 'FINAL', 'OTHER');

-- CreateEnum
CREATE TYPE "InterviewMode" AS ENUM ('VIDEO', 'PHONE', 'ONSITE', 'TAKE_HOME', 'OTHER');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('UNSCHEDULED', 'SCHEDULED', 'RESCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InterviewResult" AS ENUM ('PENDING', 'AWAITING_FEEDBACK', 'PASSED', 'FAILED');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('FOLLOW_UP', 'RECRUITER_FOLLOW_UP', 'INTERVIEW_PREP', 'RESUME_UPDATE', 'ASSESSMENT', 'OFFER_DECISION', 'APPLICATION', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('SUGGESTED', 'OPEN', 'COMPLETED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ContactKind" AS ENUM ('RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER', 'REFERRER', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('RESUME', 'COVER_LETTER', 'PORTFOLIO', 'CERTIFICATE', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADING', 'READY', 'BLOCKED');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('RECEIVED', 'NEGOTIATING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'RESCINDED');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('OPPORTUNITY_SAVED', 'OPPORTUNITY_UPDATED', 'OPPORTUNITY_ARCHIVED', 'OPPORTUNITY_RESTORED', 'APPLICATION_SUBMITTED', 'APPLICATION_UPDATED', 'STAGE_CHANGED', 'APPLICATION_PAUSED', 'APPLICATION_RESUMED', 'APPLICATION_CLOSED', 'APPLICATION_REOPENED', 'EMPLOYER_RESPONSE_RECEIVED', 'INTERVIEW_SCHEDULED', 'INTERVIEW_RESCHEDULED', 'INTERVIEW_UPDATED', 'INTERVIEW_COMPLETED', 'INTERVIEW_CANCELLED', 'INTERVIEW_RESULT_RECORDED', 'TASK_COMPLETED', 'OFFER_RECEIVED', 'OFFER_REVISED', 'OFFER_ACCEPTED', 'OFFER_DECLINED', 'DOCUMENT_ATTACHED', 'DOCUMENT_DETACHED', 'NOTE_ADDED');

-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('IN_APP', 'EMAIL');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'SENT', 'CANCELLED', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INTERVIEW_REMINDER', 'TASK_REMINDER', 'OFFER_DEADLINE', 'CALENDAR_SYNC_ERROR', 'SYSTEM');

-- CreateEnum
CREATE TYPE "CalendarProvider" AS ENUM ('GOOGLE');

-- CreateEnum
CREATE TYPE "CalendarConnectionStatus" AS ENUM ('CONNECTED', 'NEEDS_REAUTH', 'ERROR');

-- CreateEnum
CREATE TYPE "CalendarSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'DELETE_PENDING', 'FAILED');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "rateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "user_id" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "week_starts_on" INTEGER NOT NULL DEFAULT 0,
    "in_app_reminders" BOOLEAN NOT NULL DEFAULT true,
    "email_reminders" BOOLEAN NOT NULL DEFAULT false,
    "interview_reminder_minutes" INTEGER NOT NULL DEFAULT 1440,
    "task_reminder_minutes" INTEGER NOT NULL DEFAULT 60,
    "offer_deadline_reminders" BOOLEAN NOT NULL DEFAULT true,
    "suggest_follow_ups" BOOLEAN NOT NULL DEFAULT true,
    "follow_up_days" INTEGER NOT NULL DEFAULT 7,
    "calendar_sync_tasks" BOOLEAN NOT NULL DEFAULT false,
    "onboarded_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "website" TEXT,
    "location" TEXT,
    "industry" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "kind" "ContactKind" NOT NULL DEFAULT 'RECRUITER',
    "email" TEXT,
    "phone" TEXT,
    "linkedin_url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_tags" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_tags" (
    "user_id" TEXT NOT NULL,
    "opportunity_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "opportunity_tags_pkey" PRIMARY KEY ("user_id","opportunity_id","tag_id")
);

-- CreateTable
CREATE TABLE "job_opportunities" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "posting_url" TEXT,
    "normalized_url" TEXT,
    "source" TEXT,
    "reference_code" TEXT,
    "salary_min" DECIMAL(14,2),
    "salary_max" DECIMAL(14,2),
    "currency" CHAR(3),
    "salary_period" "SalaryPeriod",
    "salary_basis" "SalaryBasis" NOT NULL DEFAULT 'UNKNOWN',
    "employment_type" "EmploymentType",
    "work_arrangement" "WorkArrangement",
    "location" TEXT,
    "required_skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "notes" TEXT,
    "deadline" DATE,
    "saved_on" DATE NOT NULL DEFAULT CURRENT_DATE,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "job_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipelines" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pipelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_stages" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "pipeline_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" "StageCategory" NOT NULL,
    "position" INTEGER NOT NULL,
    "color" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pipeline_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "opportunity_id" UUID NOT NULL,
    "pipeline_id" UUID NOT NULL,
    "stage_id" UUID NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "applied_on" DATE NOT NULL,
    "method" "ApplicationMethod",
    "submitted_via" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'ACTIVE',
    "outcome" "ApplicationOutcome",
    "closed_at" TIMESTAMPTZ(3),
    "stage_changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "first_response_at" TIMESTAMPTZ(3),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_events" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "opportunity_id" UUID NOT NULL,
    "application_id" UUID,
    "type" "ActivityType" NOT NULL,
    "summary" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interviews" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "application_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "type" "InterviewType" NOT NULL DEFAULT 'OTHER',
    "round_number" INTEGER,
    "status" "InterviewStatus" NOT NULL DEFAULT 'SCHEDULED',
    "result" "InterviewResult" NOT NULL DEFAULT 'PENDING',
    "starts_at" TIMESTAMPTZ(3),
    "ends_at" TIMESTAMPTZ(3),
    "timezone" TEXT NOT NULL,
    "mode" "InterviewMode" NOT NULL DEFAULT 'VIDEO',
    "meeting_url" TEXT,
    "location" TEXT,
    "interviewers" TEXT,
    "prep_notes" TEXT,
    "feedback" TEXT,
    "schedule_revision" INTEGER NOT NULL DEFAULT 0,
    "reminder_minutes_before" INTEGER,
    "completed_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_reschedules" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "interview_id" UUID NOT NULL,
    "previous_starts_at" TIMESTAMPTZ(3),
    "previous_ends_at" TIMESTAMPTZ(3),
    "previous_timezone" TEXT NOT NULL,
    "new_starts_at" TIMESTAMPTZ(3),
    "new_ends_at" TIMESTAMPTZ(3),
    "new_timezone" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_reschedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_contacts" (
    "user_id" TEXT NOT NULL,
    "interview_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,

    CONSTRAINT "interview_contacts_pkey" PRIMARY KEY ("user_id","interview_id","contact_id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "opportunity_id" UUID,
    "application_id" UUID,
    "interview_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "TaskType" NOT NULL DEFAULT 'OTHER',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "due_at" TIMESTAMPTZ(3),
    "reminder_minutes_before" INTEGER,
    "schedule_revision" INTEGER NOT NULL DEFAULT 0,
    "suggestion_reason" TEXT,
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "title" TEXT NOT NULL,
    "version_label" TEXT,
    "original_filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" TEXT,
    "storage_key" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADING',
    "notes" TEXT,
    "replaces_id" UUID,
    "superseded_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_documents" (
    "user_id" TEXT NOT NULL,
    "application_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "purpose" "DocumentKind" NOT NULL,
    "was_submitted" BOOLEAN NOT NULL DEFAULT true,
    "attached_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_documents_pkey" PRIMARY KEY ("user_id","application_id","document_id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "application_id" UUID NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "position_title" TEXT NOT NULL,
    "base_salary" DECIMAL(14,2),
    "currency" CHAR(3) NOT NULL,
    "salary_period" "SalaryPeriod" NOT NULL DEFAULT 'ANNUALLY',
    "salary_basis" "SalaryBasis" NOT NULL DEFAULT 'GROSS',
    "bonus" TEXT,
    "equity" TEXT,
    "benefits" TEXT,
    "start_date" DATE,
    "decision_deadline" DATE,
    "received_on" DATE NOT NULL DEFAULT CURRENT_DATE,
    "status" "OfferStatus" NOT NULL DEFAULT 'RECEIVED',
    "negotiation_notes" TEXT,
    "decided_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "interview_id" UUID,
    "task_id" UUID,
    "offer_id" UUID,
    "channel" "ReminderChannel" NOT NULL,
    "remind_at" TIMESTAMPTZ(3) NOT NULL,
    "source_revision" INTEGER NOT NULL DEFAULT 0,
    "dedupe_key" TEXT NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "sent_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "reminder_id" UUID,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "reminder_id" UUID,
    "channel" "ReminderChannel" NOT NULL,
    "status" "DeliveryStatus" NOT NULL,
    "provider" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "provider_message_id" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_connections" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" "CalendarProvider" NOT NULL DEFAULT 'GOOGLE',
    "account_email" TEXT,
    "calendar_id" TEXT NOT NULL DEFAULT 'primary',
    "calendar_name" TEXT,
    "encrypted_refresh_token" TEXT NOT NULL,
    "encrypted_access_token" TEXT,
    "access_token_expires_at" TIMESTAMPTZ(3),
    "scope" TEXT,
    "status" "CalendarConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
    "last_synced_at" TIMESTAMPTZ(3),
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "calendar_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_event_syncs" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "connection_id" UUID NOT NULL,
    "interview_id" UUID,
    "task_id" UUID,
    "external_event_id" TEXT,
    "status" "CalendarSyncStatus" NOT NULL DEFAULT 'PENDING',
    "sync_revision" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "last_synced_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "calendar_event_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "rateLimit_key_key" ON "rateLimit"("key");

-- CreateIndex
CREATE UNIQUE INDEX "companies_user_id_id_key" ON "companies"("user_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "companies_user_id_normalized_name_key" ON "companies"("user_id", "normalized_name");

-- CreateIndex
CREATE INDEX "contacts_user_id_company_id_idx" ON "contacts"("user_id", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_user_id_id_key" ON "contacts"("user_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "job_tags_user_id_id_key" ON "job_tags"("user_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "job_tags_user_id_name_key" ON "job_tags"("user_id", "name");

-- CreateIndex
CREATE INDEX "opportunity_tags_user_id_tag_id_idx" ON "opportunity_tags"("user_id", "tag_id");

-- CreateIndex
CREATE INDEX "job_opportunities_user_id_archived_at_created_at_idx" ON "job_opportunities"("user_id", "archived_at", "created_at");

-- CreateIndex
CREATE INDEX "job_opportunities_user_id_company_id_idx" ON "job_opportunities"("user_id", "company_id");

-- CreateIndex
CREATE INDEX "job_opportunities_user_id_normalized_url_idx" ON "job_opportunities"("user_id", "normalized_url");

-- CreateIndex
CREATE UNIQUE INDEX "job_opportunities_user_id_id_key" ON "job_opportunities"("user_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "pipelines_user_id_id_key" ON "pipelines"("user_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "pipelines_one_default_per_user" ON "pipelines"("user_id") WHERE ("is_default" = true);

-- CreateIndex
CREATE INDEX "pipeline_stages_pipeline_id_position_idx" ON "pipeline_stages"("pipeline_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_stages_user_id_id_key" ON "pipeline_stages"("user_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_stages_user_id_pipeline_id_id_key" ON "pipeline_stages"("user_id", "pipeline_id", "id");

-- CreateIndex
CREATE INDEX "applications_user_id_status_idx" ON "applications"("user_id", "status");

-- CreateIndex
CREATE INDEX "applications_user_id_stage_id_idx" ON "applications"("user_id", "stage_id");

-- CreateIndex
CREATE INDEX "applications_user_id_applied_on_idx" ON "applications"("user_id", "applied_on");

-- CreateIndex
CREATE UNIQUE INDEX "applications_user_id_id_key" ON "applications"("user_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "applications_opportunity_id_attempt_number_key" ON "applications"("opportunity_id", "attempt_number");

-- CreateIndex
CREATE INDEX "activity_events_user_id_occurred_at_idx" ON "activity_events"("user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "activity_events_opportunity_id_occurred_at_idx" ON "activity_events"("opportunity_id", "occurred_at");

-- CreateIndex
CREATE INDEX "activity_events_application_id_occurred_at_idx" ON "activity_events"("application_id", "occurred_at");

-- CreateIndex
CREATE INDEX "interviews_user_id_starts_at_idx" ON "interviews"("user_id", "starts_at");

-- CreateIndex
CREATE INDEX "interviews_application_id_idx" ON "interviews"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "interviews_user_id_id_key" ON "interviews"("user_id", "id");

-- CreateIndex
CREATE INDEX "interview_reschedules_interview_id_created_at_idx" ON "interview_reschedules"("interview_id", "created_at");

-- CreateIndex
CREATE INDEX "interview_contacts_user_id_contact_id_idx" ON "interview_contacts"("user_id", "contact_id");

-- CreateIndex
CREATE INDEX "tasks_user_id_status_due_at_idx" ON "tasks"("user_id", "status", "due_at");

-- CreateIndex
CREATE INDEX "tasks_application_id_idx" ON "tasks"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_user_id_id_key" ON "tasks"("user_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "documents_storage_key_key" ON "documents"("storage_key");

-- CreateIndex
CREATE INDEX "documents_user_id_kind_created_at_idx" ON "documents"("user_id", "kind", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "documents_user_id_id_key" ON "documents"("user_id", "id");

-- CreateIndex
CREATE INDEX "application_documents_user_id_document_id_idx" ON "application_documents"("user_id", "document_id");

-- CreateIndex
CREATE INDEX "offers_user_id_status_idx" ON "offers"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "offers_user_id_id_key" ON "offers"("user_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "offers_application_id_revision_number_key" ON "offers"("application_id", "revision_number");

-- CreateIndex
CREATE UNIQUE INDEX "reminders_dedupe_key_key" ON "reminders"("dedupe_key");

-- CreateIndex
CREATE INDEX "reminders_status_remind_at_idx" ON "reminders"("status", "remind_at");

-- CreateIndex
CREATE INDEX "reminders_user_id_status_idx" ON "reminders"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "reminders_user_id_id_key" ON "reminders"("user_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_reminder_id_key" ON "notifications"("reminder_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_idempotency_key_key" ON "notification_deliveries"("idempotency_key");

-- CreateIndex
CREATE INDEX "notification_deliveries_user_id_created_at_idx" ON "notification_deliveries"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "notification_deliveries_provider_message_id_idx" ON "notification_deliveries"("provider_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_connections_user_id_id_key" ON "calendar_connections"("user_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_connections_user_id_provider_key" ON "calendar_connections"("user_id", "provider");

-- CreateIndex
CREATE INDEX "calendar_event_syncs_user_id_status_idx" ON "calendar_event_syncs"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_event_syncs_connection_id_interview_id_key" ON "calendar_event_syncs"("connection_id", "interview_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_event_syncs_connection_id_task_id_key" ON "calendar_event_syncs"("connection_id", "task_id");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_user_id_company_id_fkey" FOREIGN KEY ("user_id", "company_id") REFERENCES "companies"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_tags" ADD CONSTRAINT "job_tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_tags" ADD CONSTRAINT "opportunity_tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_tags" ADD CONSTRAINT "opportunity_tags_user_id_opportunity_id_fkey" FOREIGN KEY ("user_id", "opportunity_id") REFERENCES "job_opportunities"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_tags" ADD CONSTRAINT "opportunity_tags_user_id_tag_id_fkey" FOREIGN KEY ("user_id", "tag_id") REFERENCES "job_tags"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_opportunities" ADD CONSTRAINT "job_opportunities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_opportunities" ADD CONSTRAINT "job_opportunities_user_id_company_id_fkey" FOREIGN KEY ("user_id", "company_id") REFERENCES "companies"("user_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_user_id_pipeline_id_fkey" FOREIGN KEY ("user_id", "pipeline_id") REFERENCES "pipelines"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_opportunity_id_fkey" FOREIGN KEY ("user_id", "opportunity_id") REFERENCES "job_opportunities"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_pipeline_id_fkey" FOREIGN KEY ("user_id", "pipeline_id") REFERENCES "pipelines"("user_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_pipeline_id_stage_id_fkey" FOREIGN KEY ("user_id", "pipeline_id", "stage_id") REFERENCES "pipeline_stages"("user_id", "pipeline_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_user_id_opportunity_id_fkey" FOREIGN KEY ("user_id", "opportunity_id") REFERENCES "job_opportunities"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_user_id_application_id_fkey" FOREIGN KEY ("user_id", "application_id") REFERENCES "applications"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_user_id_application_id_fkey" FOREIGN KEY ("user_id", "application_id") REFERENCES "applications"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_reschedules" ADD CONSTRAINT "interview_reschedules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_reschedules" ADD CONSTRAINT "interview_reschedules_user_id_interview_id_fkey" FOREIGN KEY ("user_id", "interview_id") REFERENCES "interviews"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_contacts" ADD CONSTRAINT "interview_contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_contacts" ADD CONSTRAINT "interview_contacts_user_id_interview_id_fkey" FOREIGN KEY ("user_id", "interview_id") REFERENCES "interviews"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_contacts" ADD CONSTRAINT "interview_contacts_user_id_contact_id_fkey" FOREIGN KEY ("user_id", "contact_id") REFERENCES "contacts"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_opportunity_id_fkey" FOREIGN KEY ("user_id", "opportunity_id") REFERENCES "job_opportunities"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_application_id_fkey" FOREIGN KEY ("user_id", "application_id") REFERENCES "applications"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_interview_id_fkey" FOREIGN KEY ("user_id", "interview_id") REFERENCES "interviews"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_replaces_id_fkey" FOREIGN KEY ("replaces_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_user_id_application_id_fkey" FOREIGN KEY ("user_id", "application_id") REFERENCES "applications"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_user_id_document_id_fkey" FOREIGN KEY ("user_id", "document_id") REFERENCES "documents"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_user_id_application_id_fkey" FOREIGN KEY ("user_id", "application_id") REFERENCES "applications"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_interview_id_fkey" FOREIGN KEY ("user_id", "interview_id") REFERENCES "interviews"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_task_id_fkey" FOREIGN KEY ("user_id", "task_id") REFERENCES "tasks"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_offer_id_fkey" FOREIGN KEY ("user_id", "offer_id") REFERENCES "offers"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_reminder_id_fkey" FOREIGN KEY ("reminder_id") REFERENCES "reminders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_reminder_id_fkey" FOREIGN KEY ("reminder_id") REFERENCES "reminders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_syncs" ADD CONSTRAINT "calendar_event_syncs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_syncs" ADD CONSTRAINT "calendar_event_syncs_user_id_connection_id_fkey" FOREIGN KEY ("user_id", "connection_id") REFERENCES "calendar_connections"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_syncs" ADD CONSTRAINT "calendar_event_syncs_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "interviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_syncs" ADD CONSTRAINT "calendar_event_syncs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- CHECK constraints (not modelled by Prisma; Prisma Migrate leaves them alone)
-- ---------------------------------------------------------------------------

-- Closed applications always have an outcome and closed_at; active/paused never do.
ALTER TABLE "applications" ADD CONSTRAINT "applications_closed_state_check" CHECK (
  ("status" = 'CLOSED' AND "outcome" IS NOT NULL AND "closed_at" IS NOT NULL)
  OR ("status" <> 'CLOSED' AND "outcome" IS NULL AND "closed_at" IS NULL)
);
ALTER TABLE "applications" ADD CONSTRAINT "applications_attempt_number_check" CHECK ("attempt_number" >= 1);

-- Salary ranges are non-negative and ordered.
ALTER TABLE "job_opportunities" ADD CONSTRAINT "job_opportunities_salary_check" CHECK (
  ("salary_min" IS NULL OR "salary_min" >= 0)
  AND ("salary_max" IS NULL OR "salary_max" >= 0)
  AND ("salary_min" IS NULL OR "salary_max" IS NULL OR "salary_max" >= "salary_min")
);
ALTER TABLE "job_opportunities" ADD CONSTRAINT "job_opportunities_currency_check" CHECK ("currency" IS NULL OR "currency" ~ '^[A-Z]{3}$');
ALTER TABLE "offers" ADD CONSTRAINT "offers_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$');
ALTER TABLE "offers" ADD CONSTRAINT "offers_base_salary_check" CHECK ("base_salary" IS NULL OR "base_salary" >= 0);
ALTER TABLE "offers" ADD CONSTRAINT "offers_revision_number_check" CHECK ("revision_number" >= 1);
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$');

-- Interviews: scheduled ones need a start time; end must follow start.
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_time_order_check" CHECK (
  "ends_at" IS NULL OR "starts_at" IS NULL OR "ends_at" > "starts_at"
);
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_scheduled_start_check" CHECK (
  "status" NOT IN ('SCHEDULED', 'RESCHEDULED') OR "starts_at" IS NOT NULL
);
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_round_number_check" CHECK ("round_number" IS NULL OR "round_number" >= 1);

-- A reminder belongs to exactly one source.
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_single_source_check" CHECK (
  num_nonnulls("interview_id", "task_id", "offer_id") = 1
);

-- A calendar link maps at most one source (zero once the source is deleted
-- and the remote event is waiting to be removed).
ALTER TABLE "calendar_event_syncs" ADD CONSTRAINT "calendar_event_syncs_single_source_check" CHECK (
  num_nonnulls("interview_id", "task_id") <= 1
);

-- Document sizes are positive.
ALTER TABLE "documents" ADD CONSTRAINT "documents_size_check" CHECK ("size_bytes" >= 0);
