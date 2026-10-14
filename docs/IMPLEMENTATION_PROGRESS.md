# JobTrack Implementation Progress

Living checklist for the build described in `docs/PRD.md`, `docs/BACKLOG.md` and `docs/DATA_MODEL.md`.
A box is ticked only when the feature works end to end against PostgreSQL and the checks listed under
"Verification" ran. Anything not verified (for example, integrations without credentials) says so.

## Decisions and defaults

| Topic           | Decision                                                                                                                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework       | Next.js 16.4 App Router, React 19.3, TypeScript strict, Turbopack. `cacheComponents` + `partialPrefetching` stay on (scaffold default; required in the next major). Session reads sit behind `<Suspense>`.                            |
| Styling         | Tailwind CSS v4 (CSS-first tokens in `globals.css`) + shadcn/ui (Radix, "nova" preset). Palette, radii and spacing come from `references/job-tracker-demo.html`.                                                                      |
| Lint / format   | ESLint 9 (`eslint-config-next`) + Prettier, as the project prompt requires (not Biome).                                                                                                                                               |
| Database        | PostgreSQL 18, Prisma ORM 7.10 pinned to major 7 (npm `latest` is an 8.0 RC). Client output `src/generated/prisma`, `@prisma/adapter-pg` with a bounded pool per process.                                                             |
| Tenancy         | Every private table has `user_id`; child rows use composite FKs on `(user_id, id)` so the DB rejects cross-user links. `NoAction` instead of `Restrict` so cascading account deletion works. CHECK constraints live in migration SQL. |
| IDs             | Better Auth text IDs for auth tables; UUIDv7 for domain rows.                                                                                                                                                                         |
| Auth            | Better Auth 1.7.7 (email + password, required verification, reset, DB-backed rate limiting). Auth emails go through the job queue (constant-time responses, retried delivery).                                                        |
| Background jobs | Graphile Worker 0.18 in a separate process. Jobs are enqueued with `graphile_worker.add_job()` **inside** the Prisma transaction (transactional outbox).                                                                              |
| Mutations       | Server Actions validate with Zod, authorize through the data layer (`src/features/*/data.ts`, `server-only`), then `revalidatePath("/", "layout")`.                                                                                   |
| Priority        | `LOW / MEDIUM / HIGH` (matches the mockup) instead of the PRD's 1-5 scale.                                                                                                                                                            |
| Job source      | Free text with suggestions (LinkedIn, JobStreet, ...), so analytics group by what the user typed.                                                                                                                                     |
| Dev email       | Without `RESEND_API_KEY` outside production, emails are written to `.data/dev-mail/*.json` and logged as `[dev-mail]`. Production refuses to run without a key.                                                                       |
| Worker runtime  | The worker runs TypeScript through `tsx` (a runtime dependency) so `@/` path aliases work without a separate bundler.                                                                                                                 |

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
- [x] Employer response date (for response-time analytics) and timeline notes
- [x] Custom pipeline stages (`/settings/pipeline`): add, rename, recolour, reorder, disable, delete with a required move target when in use; category fixed for analytics
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
- [x] Rescheduling keeps the same record, stores history rows (`interview_reschedules`), bumps `schedule_revision` (for reminder dedupe) and logs before/after in the timeline
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
- [x] Owner-only download route (404 for other users), versions via "upload new version" (older versions stay attached), delete with worker retry for object removal
- [x] Attach exact versions to applications with a "submitted" flag; library page; application Documents tab
- [x] Contacts: CRUD under companies (find-or-create), email/phone/LinkedIn, interview attendee picker limited to the company's contacts
- [x] Offers: immutable revisions, first offer moves the application to the offer stage (logged), decision task suggestion, accept/decline closes only that application, offer deadlines on the calendar
- [x] Analytics (`/analytics`): date-range presets/custom range, week/month trend, interview and offer rates over distinct applications, funnel using stage history snapshots, source effectiveness, open stages, outcomes, median recorded response time, cohort caveats
- [x] Exports: CSV (attempts) and full JSON backup without password hashes, tokens or storage keys
- [x] Account deletion (Settings → Account & data): email + password confirmation via Better Auth `deleteUser`; cascades all rows, then queues private file removal

Verification: `pnpm typecheck`, `pnpm lint`, `pnpm test` (65 tests: opaque keys, disguised-file rejection, version
history, cross-user download/attach/delete denial, delete retry job, contact isolation, offer revisions and
decisions, distinct-application analytics, export privacy), E2E `documents-offers.spec.ts` (upload, fake PDF
rejected, owner download 200, attach, record + accept offer, other user 404 + not-found page, account deletion).
Full E2E suite: 8/8 passing.

## Milestone 5: Notifications and integrations

- [ ] Reminder scheduling/cancellation from interviews, tasks and offers
- [ ] In-app notifications (bell, list, read state)
- [ ] Resend email delivery with idempotency keys and delivery log
- [ ] Google Calendar OAuth, encrypted tokens, one-way sync with retries

## Milestone 6: Production deployment

- [ ] Multi-stage Dockerfile, `.dockerignore`, `compose.prod.yml`
- [ ] Migration job ordering, Coolify guide, backup and recovery guide
- [ ] Security review and full E2E definition-of-done run
