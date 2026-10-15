# JobTrack Implementation Progress

Living checklist for the build described in `docs/PRD.md`, `docs/BACKLOG.md` and `docs/DATA_MODEL.md`.
A box is ticked only when the feature works end to end against PostgreSQL and the checks listed under
"Verification" ran. Anything not verified (for example, integrations without credentials) says so.

## Decisions and defaults

| Topic           | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework       | Next.js 16.4 App Router, React 19.3, TypeScript strict, Turbopack. `cacheComponents` + `partialPrefetching` stay on (scaffold default; required in the next major). Session reads sit behind `<Suspense>`.                                                                                                                                                                                                                                                                                                                                              |
| Styling         | Tailwind CSS v4 (CSS-first tokens in `globals.css`) + shadcn/ui (Radix, "nova" preset). Palette, radii and spacing come from `references/job-tracker-demo.html`.                                                                                                                                                                                                                                                                                                                                                                                        |
| Lint / format   | ESLint 9 (`eslint-config-next`) + Prettier, as the project prompt requires (not Biome).                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Database        | PostgreSQL 18, Prisma ORM 7.10 pinned to major 7 (npm `latest` is an 8.0 RC). Client output `src/generated/prisma`, `@prisma/adapter-pg` with a bounded pool per process.                                                                                                                                                                                                                                                                                                                                                                               |
| Tenancy         | Every private table has `user_id`; child rows use composite FKs on `(user_id, id)` so the DB rejects cross-user links. `NoAction` instead of `Restrict` so cascading account deletion works. Optional links that must survive a delete (document versions, reminder links, calendar links) use `ON DELETE SET NULL (<link column>)`, hand-edited in the migration SQL because Prisma generates a plain `SET NULL` that would also clear `user_id`; re-check the SQL of any migration that recreates these FKs. CHECK constraints live in migration SQL. |
| IDs             | Better Auth text IDs for auth tables; UUIDv7 for domain rows.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Auth            | Better Auth 1.7.7 (email + password, required verification, reset, DB-backed rate limiting). Auth emails go through the job queue (constant-time responses, retried delivery).                                                                                                                                                                                                                                                                                                                                                                          |
| Background jobs | Graphile Worker 0.18 in a separate process. Jobs are enqueued with `graphile_worker.add_job()` **inside** the Prisma transaction (transactional outbox). Document file cleanup is queued by the `documents_queue_file_cleanup` trigger (hand-written migration SQL), so every delete path, including cascades, is covered.                                                                                                                                                                                                                              |
| Mutations       | Server Actions validate with Zod, authorize through the data layer (`src/features/*/data.ts`, `server-only`), then `revalidatePath("/", "layout")`.                                                                                                                                                                                                                                                                                                                                                                                                     |
| Priority        | `LOW / MEDIUM / HIGH` (matches the mockup) instead of the PRD's 1-5 scale.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Job source      | Free text with suggestions (LinkedIn, JobStreet, ...), so analytics group by what the user typed.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Dev email       | Without `RESEND_API_KEY` outside production, emails are written to `.data/dev-mail/*.json` and logged as `[dev-mail]`. Production refuses to run without a key.                                                                                                                                                                                                                                                                                                                                                                                         |
| Worker runtime  | The worker runs TypeScript through `tsx` (a runtime dependency) so `@/` path aliases work without a separate bundler.                                                                                                                                                                                                                                                                                                                                                                                                                                   |

## Milestone 1: Project foundation

- [x] Next.js 16 scaffold, strict TS, Tailwind v4, shadcn/ui, ESLint + Prettier, pnpm 11
- [x] Docker Compose dev database (`compose.dev.yml`, port 5436) plus `jobtrack_test` database
- [x] Prisma 7 schema for the full domain model (auth, preferences, companies, contacts, tags, opportunities, pipelines, stages, applications, activity, interviews, reschedules, tasks, documents, offers, reminders, notifications, deliveries, calendar connections and event syncs)
- [x] Better Auth models generated with the official CLI (`pnpm auth:generate`) and merged into the schema
- [x] Initial migration with CHECK constraints and a partial unique index (one default pipeline per user); `prisma migrate diff` reports no drift
- [x] Graphile Worker schema installed by `pnpm db:deploy`
- [x] Better Auth: register, login/logout, email verification, forgot/reset password, sessions, rate limiting, secure cookies in production
- [x] Proxy (optimistic cookie check) + server-side session checks in every data-layer call
- [x] Onboarding (timezone, currency, default 6-stage pipeline in one idempotent transaction)
- [x] App shell from the mockup (sidebar, top bar, mobile sheet navigation, user menu)
- [x] Dashboard backed by real queries with empty states, including Needs Attention
- [x] Settings: profile name, timezone/currency/week start, password change
- [x] Worker process with `send_email` task, heartbeat file and graceful shutdown
- [x] Health endpoints: `/api/health` (liveness) and `/api/health/ready` (database)
- [x] Vitest (unit + DB integration) and Playwright (production build + real worker) set up

Verification: `pnpm typecheck`, `pnpm lint`, `pnpm test` (20 tests), `pnpm build` without any env vars,
`pnpm test:e2e` (register → verify → onboard → dashboard, unverified login blocked, anonymous redirect,
sign out + password reset, mobile navigation).

## Milestone 2: Core job tracker

- [x] Company CRUD (`/contacts`) with find-or-create by normalized name from job forms; deleting a company with jobs is refused
- [x] Opportunity CRUD: Quick Add dialog (title + company required), full edit page, archive/restore, permanent delete with confirmation, tags and required skills
- [x] Duplicate warnings (same normalized posting URL, or same company + title) via an owner-scoped GET route; never blocks saving
- [x] Applications: mark as applied (date, method, submitted via, starting stage), reapply with numbered attempts, history of every attempt
- [x] Status vs outcome: pause/resume, close with an explicit outcome (no auto-rejection), reopen clears outcome; DB CHECK enforces it
- [x] Employer response date (for response-time analytics) and timeline notes; stored date-only like the application date, so a timezone change never shifts it (the timeline and recent activity show that date too); the server keeps it between the application date and today, and rejects an application date after a recorded response or in the future
- [x] Custom pipeline stages (`/settings/pipeline`): add, rename, recolour, reorder, disable, delete with a required move target when in use (closed applications move too, with a logged stage change); category fixed for analytics
- [x] Stage changes in a transaction with `STAGE_CHANGED` activity events storing name snapshots (renames never rewrite history)
- [x] Suggested follow-up task after applying (editable/dismissible `SUGGESTED` task, never an outgoing email)
- [x] Jobs table (TanStack Table v9, client sorting) with view/search/stage/priority/work/source filters in the URL
- [x] Kanban board (dnd-kit): virtual Saved column, optimistic moves, keyboard dragging between columns, live announcements, "Move to" menu on every card, drop a saved job on a stage to record an application
- [x] Job detail page, application detail page (overview + timeline)
- [x] CSV export of jobs and attempts (RFC 4180, formula-injection safe)

Verification: `pnpm typecheck`, `pnpm lint`, `pnpm test` (34 tests incl. cross-user isolation, stage-delete moves,
duplicate hints, filters), E2E `tracker.spec.ts` (Quick Add, duplicate hint, apply, stage select, timeline, custom
stage, Kanban menu move and real mouse drag-and-drop).

Known gaps carried forward: settings tabs for Notifications, Integrations and Account link to pages built in
Milestones 4-5; deleting a job/interview does not yet queue Google Calendar event removal (Milestone 5).

## Milestone 3: Interviews and productivity

- [x] Unlimited interview rounds per application (same type repeated freely), with title, type, round number, date/time, duration, IANA timezone, format, meeting link, location, interviewers, prep notes, feedback, reminder lead time
- [x] Scheduling status (unscheduled, scheduled, rescheduled, completed, cancelled) kept separate from the result (pending, awaiting feedback, passed, not passed) and from the application outcome
- [x] Timezone-safe storage: wall-clock + IANA zone converted to a UTC instant; shown in the user's timezone with the interview's own zone alongside when different
- [x] Rescheduling keeps the same record, stores history rows (`interview_reschedules`), bumps `schedule_revision` (for reminder dedupe) and logs before/after in the timeline; completed interviews keep their time (the edit form shows it read-only and the server rejects a changed schedule instead of dropping it)
- [x] Completing an interview suggests an editable thank-you follow-up; cancelling never rejects the application
- [x] Tasks: create/edit/complete/reopen/dismiss/delete, linked to an application or standalone, due date + optional time in the user's timezone, priority, reminder lead time
- [x] Task groups: Suggested, Overdue, Today, Upcoming, No due date, Completed; suggestions can be accepted, edited or dismissed
- [x] Calendar: month grid in the user's timezone (week start preference), interviews, task due dates and application deadlines, daily agenda with reschedule, "coming up" list
- [x] Application page: interviews tab, next-steps tasks, timeline with interview events
- [x] Dashboard metrics and Needs Attention now driven by interviews and tasks

Verification: `pnpm typecheck`, `pnpm lint`, `pnpm test` (46 tests: 5 rounds incl. repeated types, UTC +
timezone storage, reschedule history/revision/activity, result vs outcome independence, task grouping in
Asia/Manila, cross-user interview/task access, calendar local-date placement), E2E `interviews.spec.ts`
(3 rounds, reschedule with reason, complete, timeline, accept suggestion, create + complete task, calendar).

Note: Next 16 keeps recently visited routes mounted but hidden (React Activity). E2E locators for in-page
links use `.filter({ visible: true })` so they never target the hidden copy.

## Milestone 4: Documents, contacts and offers

- [x] Private storage abstraction: R2/S3 driver (presigned 60 s downloads, `requestChecksumCalculation: WHEN_REQUIRED` for R2) and a dev-only local driver under `.data/uploads` (refused in production unless the test-only `UNSAFE_ALLOW_LOCAL_STORAGE` is set, which logs a warning)
- [x] Upload route: auth, per-user rate limit, size limit, extension + MIME + magic-byte checks (PDF/DOCX), SHA-256, opaque `users/<id>/<uuid>` keys. No antivirus scanner is configured; the `BLOCKED` status is reserved for one
- [x] Owner-only download route (404 for other users), versions via "upload new version" (older versions stay attached), every document delete queues object removal in the same transaction through the `documents_queue_file_cleanup` trigger (a crash or storage outage afterwards cannot orphan the file)
- [x] Attach exact versions to applications with a "submitted" flag; library page; application Documents tab
- [x] Contacts: CRUD under companies (find-or-create), email/phone/LinkedIn, interview attendee picker limited to the company's contacts
- [x] Offers: immutable revisions, first offer moves the application to the offer stage (logged), decision task suggestion, accept/decline closes only that application (on an already closed attempt the decision replaces a contradicting outcome, logged), decisions and status changes are conditional updates (concurrent tabs never overwrite a decision), offer deadlines on the calendar (latest revision only); a closed application's offer no longer counts as pending on the dashboard, calendar or deadline reminders
- [x] Analytics (`/analytics`): date-range presets/custom range, week/month trend, interview and offer rates over distinct applications, funnel using stage history snapshots, source effectiveness, open stages, outcomes, median recorded response time, cohort caveats
- [x] Exports: CSV (attempts) and full JSON backup without password hashes, tokens or storage keys
- [x] Account deletion (Settings → Account & data): email + password confirmation via Better Auth `deleteUser`; cascades all rows, and the documents trigger queues private file removal in that same transaction (covers uploads that commit while the deletion runs; the worker skips files still referenced)

Verification: `pnpm typecheck`, `pnpm lint`, `pnpm test` (65 tests: opaque keys, disguised-file rejection, version
history, cross-user download/attach/delete denial, delete retry job, contact isolation, offer revisions and
decisions, distinct-application analytics, export privacy), E2E `documents-offers.spec.ts` (upload, fake PDF
rejected, owner download 200, attach, record + accept offer, other user 404 + not-found page, account deletion).
Full E2E suite: 8/8 passing.

## Milestone 5: Notifications and integrations

- [x] Reminder planning as a pure function (`features/notifications/plan.ts`): interviews (lead time), open tasks (lead time), offer decision deadlines (9:00 local the day before, latest revision only); in-app on by default, email only after opt-in with a verified address
- [x] Transactional outbox: every interview/task/offer/application change re-plans its reminders and enqueues Graphile jobs inside the same DB transaction; rescheduling or cancelling cancels pending reminders and removes their jobs; sent history is never touched
- [x] Dedupe keys include the source revision and the computed reminder time, so re-planning never duplicates and stale jobs detect they are obsolete
- [x] Worker `deliver_reminder`: re-validates source + preferences right before sending; in-app delivery guarded by a unique `notifications.reminder_id`; email via Resend with an idempotency key, delivery log (`notification_deliveries`), bounded retries with backoff, permanent failures recorded
- [x] In-app notifications: top-bar bell with unread state and mark-all-read, `/notifications` inbox with read/unread toggles and a reminder log (scheduled/sent/cancelled/skipped/failed)
- [x] Notification settings: channels, default lead times, offer deadline reminders, follow-up suggestions, task publishing
- [x] Resend webhook (`/api/webhooks/resend`, Svix signature verified): bounces/complaints mark the delivery failed, switch email reminders off and notify the user
- [x] Google Calendar: explicit OAuth connect with HMAC-signed, user-bound, 10-minute state cookie; narrow scopes (`calendar.events`, `calendar.calendarlist.readonly`, `openid email`); refresh/access tokens AES-256-GCM encrypted; token refresh; destination calendar picker
- [x] One-way sync worker (`sync_calendar_event`): deterministic event IDs (a retried insert after a crash hits 409 and updates instead of duplicating), updates on reschedule, deletes on cancel/delete (link rows survive cascades via SET NULL), moves events when the destination changes, 401/`invalid_grant` -> "Reconnect needed" + in-app alert, 429/5xx retried, other errors visible with a retry button
- [x] Integrations page: not-configured state, connect/reconnect, sync counts, last error, retry failed, remove JobTrack events, disconnect (revokes Google grant and deletes credentials; if Google doesn't confirm the revoke, nothing is deleted and the user can retry); account deletion also revokes the grant (best effort)

Verification: `pnpm test` (92 tests incl. reschedule replacing reminders and jobs, opt-in/opt-out, concurrent
delivery producing one notification, stale-worker skip, email idempotency + transient/permanent failures,
bounce handling, calendar insert/update/delete with a mocked Google API, 409 recovery, revoked grant, rate-limit
retry, OAuth state forgery/expiry, Svix signatures, token encryption), E2E `notifications.spec.ts` (real worker
delivers an in-app reminder to the inbox and bell; integrations page shows "not configured").

Not verified against real providers: no Resend API key or Google OAuth client was available in this environment.
Email sending and Google Calendar calls are covered by unit/integration tests with mocked HTTP clients and the
development outbox only. Verify both after adding credentials (see docs/DEPLOYMENT_COOLIFY.md).

## Milestone 6: Production deployment

- [x] `next.config.ts`: standalone output, security headers (CSP, HSTS in production, frame/nosniff/referrer/permissions), no `X-Powered-By`
- [x] Multi-stage `Dockerfile` with `web` (standalone, non-root, health check), `worker` (non-root, heartbeat health check, graceful SIGTERM) and `migrate` (one-off `prisma migrate deploy` + Graphile schema) targets; `.dockerignore` keeps secrets and local data out of the build context
- [x] `compose.prod.yml` for Coolify: migrate must succeed before web/worker start, no published ports, required-variable guards, bounded pools per process
- [x] Health endpoints `/api/health` (liveness) and `/api/health/ready` (database)
- [x] Demo seed (`pnpm db:seed`): two fictional users, 16 jobs in PHP/AUD/USD, every stage, a reapplication, rejected and withdrawn attempts, upcoming/completed/rescheduled interviews, tasks, an offer, resume versions with placeholder PDFs, contacts, timelines; refuses production unless `ALLOW_DEMO_SEED=true`
- [x] Mock data for your own account (`pnpm db:mock <email> [--reset]`, `scripts/mock-account.ts`): fills a registered, onboarded local account with every stage (custom and disabled ones too), status, outcome, method, employment type, salary period/basis, interview type/mode/status/result, offer status, task type/status, contact kind, document kind/status, notification type, reminder-log state and all 26 timeline event types; refuses non-local databases and accounts that already have jobs unless `--reset`
- [x] Error boundaries without internal details; Origin check on the upload POST; `Content-Length` required for uploads; existing-account sign-up notifies the owner instead of revealing the account
- [x] CI workflow (`.github/workflows/ci.yml`): typecheck, lint, format, migration drift check, Vitest, build, Playwright, Docker builds
- [x] Docs: `docs/DEPLOYMENT_COOLIFY.md`, `docs/BACKUP_AND_RECOVERY.md`, `docs/SECURITY.md`, README
- [x] Contract step for `applications.first_response_at` (expanded in PR #4): migration `20261015024025_drop_first_response_at` rebuilds `first_response_on` for every recorded response from its latest `EMPLOYER_RESPONSE_RECEIVED` event's `details.respondedOn` (which also picks up responses the previous release recorded or corrected during the expand deploy), fills the rest from `first_response_at` in the user's timezone and drops the column; the double write, the read fallback and the deprecated `firstResponseAt` field are gone. Deploy it only after the expand release is live everywhere (or together with it on a first deploy)

Verification:

- `pnpm build` with no `.env` present (the Docker build condition) passes.
- Docker: all three images built locally; `migrate` applied migrations to an empty database; `web` served
  `/api/health/ready` = ready, security headers present, sign-up worked; `worker` (as `node`) processed the
  queued email job, refused to send without `RESEND_API_KEY` in production (permanent failure, no retry loop) and
  shut down gracefully on SIGTERM.
- Full Playwright suite (10 specs incl. `definition-of-done.spec.ts`, the 14-step workflow with isolation).
- Not verified: an actual Coolify deployment, real R2, Resend and Google credentials (none available here), and the
  GitHub Actions workflow (not pushed).

## Definition of Done status

| #   | Step                                                        | Status                                                                   |
| --- | ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1-2 | Register, verify, sign in                                   | Done (E2E)                                                               |
| 3-4 | Save Full-Stack Developer with company, salary, description | Done (E2E)                                                               |
| 5   | Mark as applied                                             | Done (E2E)                                                               |
| 6   | Attach a resume                                             | Done (E2E, local storage driver; R2 driver untested without credentials) |
| 7   | Update hiring stage                                         | Done (E2E)                                                               |
| 8-9 | Multiple interviews, reschedule                             | Done (E2E)                                                               |
| 10  | Reminder when configured                                    | Done in-app (E2E, real worker); email path tested with a mocked provider |
| 11  | Create and complete follow-up task                          | Done (E2E)                                                               |
| 12  | Record job offer                                            | Done (E2E)                                                               |
| 13  | Updated analytics                                           | Done (E2E)                                                               |
| 14  | Another user cannot access the data                         | Done (E2E + integration tests)                                           |
