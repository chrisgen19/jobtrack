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
- [x] Pipeline peek drawer: application card titles open a read-only summary in a right-hand Sheet via an intercepting route in the `@peek` slot (`/pipeline/@peek/(..)applications/[id]`), with an "Open full page" link; refresh or a shared link renders the full page. The sidebar and breadcrumb keep Pipeline current while the drawer masks the URL
- [x] Saved-card job drawer: Saved column titles open a job summary via `/pipeline/@peek/(..)jobs/[id]`, with "Mark as applied" (replaces the URL with the new application's drawer, so closing returns to the board) and "Open full page"
- [x] Drawer keyboard pass: Enter on a card title opens the drawer (cards are plain articles; keyboard dragging uses a separate handle button, the dnd-kit activator, while mouse and touch still drag the whole card), focus stays inside while open and returns to the card title on close, badges carry screen-reader labels. Checked with keyboard-only Playwright runs and the accessibility tree; not yet with a real screen reader (NVDA/VoiceOver)
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
- [x] Contract step 1 for `applications.first_response_at` (expanded in PR #4; PR #5): data-only migration `20261015024025_rebuild_first_response_on` rebuilds `first_response_on` for every recorded response from its latest `EMPLOYER_RESPONSE_RECEIVED` event's `details.respondedOn` (which also picks up responses recorded or corrected during the expand deploy) and fills the rest from `first_response_at` in the user's timezone; the double write, the read fallback and every client reference are gone, and the schema keeps the field only as `firstResponseAt ... @ignore` so Migrate still matches the database
- [ ] Contract step 2: once the release with step 1 is deployed everywhere, add a migration that first repeats step 1's rebuild (the same `LOCK TABLE` and statements: `first_response_on` from the latest response event, then any still empty from `first_response_at`), then drops `applications.first_response_at`, and remove the `@ignore` field from the schema. Every release saves the entered date on the response event, so the repeated rebuild catches anything an older release recorded during the step 1 deploy (for example if PR #4 and PR #5 shipped together over the release before PR #4). The drop is safe then, because the code still serving during that deploy never selects the column

Verification:

- `pnpm build` with no `.env` present (the Docker build condition) passes.
- Docker: all three images built locally; `migrate` applied migrations to an empty database; `web` served
  `/api/health/ready` = ready, security headers present, sign-up worked; `worker` (as `node`) processed the
  queued email job, refused to send without `RESEND_API_KEY` in production (permanent failure, no retry loop) and
  shut down gracefully on SIGTERM.
- Full Playwright suite (10 specs incl. `definition-of-done.spec.ts`, the 14-step workflow with isolation).
- Coolify production deployment (2026-10-16) at `https://jobs.cgdev.site`: Docker Compose build pack with
  `compose.prod.yml`, `jobtrack` role and database on the shared Coolify PostgreSQL 17 (internal network). `migrate`
  exited 0, `web` and `worker` healthy, `/api/health` = ok, `/api/health/ready` = ready, Let's Encrypt HTTPS with
  http redirect, worker log `worker started`. A redeploy (env change) also succeeded.
- Real Resend: registering an account on production delivered the verification email.
- Resend webhook (2026-10-16): endpoint `https://jobs.cgdev.site/api/webhooks/resend` registered in Resend for
  `email.bounced` and `email.complained`, signing secret set as `RESEND_WEBHOOK_SECRET` (runtime only). After the
  redeploy the endpoint rejected an unsigned request, a wrong signature and a correctly signed request with a
  10-minute-old timestamp (all 401), and accepted a correctly signed `email.bounced` (200, logged
  `handled: false` for the unknown `email_id`, no data changed). A real bounce delivered by Resend has not been
  tested yet. The Resend account is shared with other apps, so their bounce events also arrive here and are
  ignored the same way.
- R2 and Google OAuth credentials are configured in production; a document round trip and a Google Calendar
  connection have not been confirmed yet.
- Not verified: the GitHub Actions workflow.

## Milestone 7: Browser extension (EXT-01)

- [x] pnpm workspace: web app stays at the root; `packages/shared` (`@jobtrack/shared`, source-only TypeScript,
      `transpilePackages`) holds the extension API contract; `extension/` is the WXT project. Docker installs with
      `--filter jobtrack...`, so the images never contain the extension tooling
- [x] `extension_tokens` table (migration `20261016023813_extension_tokens`): SHA-256 hash only, revocable, last used
      time, at most 10 active per user
- [x] Connect flow: `/extension/connect` (approval page) → token for allowlisted IDs (`EXTENSION_IDS`) → handed to
      the extension via `externally_connectable`, checked against the extension's one-time nonce; revoked again if
      delivery fails
- [x] Extension API `/api/extension/v1/{me,opportunities,opportunities/duplicates,token}`: bearer tokens only,
      per-token rate limit, body size limit, drafts validated with the shared contract and then the Quick Add
      schema; `createOpportunityForWorkspace` / `findDuplicateCandidatesForUser` reuse the data layer; the
      duplicate check is a POST with a JSON body so posting URLs stay out of request lines and proxy access logs
- [x] Settings → Browser extension: connected browsers with last use, Disconnect
- [x] Extension popup: connect screen, review form prefilled from schema.org `JobPosting`, meta tags and the text
      selection, duplicate warning, "already applied" with date and stage, saved screen, Disconnect; unsaved edits
      kept per page for the browser session; generated icons from the brand mark
- [x] `extension/README.md`, `extension/CHROMEWEBSTORE.md` (store listing draft, permission justifications)

Verification:

- `tests/integration/extension.test.ts` (9 tests): allowlist, hash-only storage, cookie-only and invalid tokens
  rejected, revoke from Settings and from the extension, cross-user revoke refused, save with activity event, save
  as applied, field errors, another user's stage refused, owner-scoped duplicates, oversized body.
- Extension Vitest (9 tests): JSON-LD extraction (nested `@graph`, entity-encoded HTML, salary, remote), meta
  fallbacks, job boards never used as the company, selection override, connect nonce/origin/once checks.
- `collectPageSnapshot` + `buildDraft` run in real Chromium on a page with JSON-LD and a text selection.
- Manual Playwright run of the built extension against `pnpm dev`: register → connect (approval page, token
  delivered) → save from the popup → duplicate warning → job listed in `/jobs` → disconnect in Settings → popup
  asks to connect again. Connect and settings pages checked at 390 px.
- Not verified: opening the popup from the toolbar on a real job site (Playwright cannot click the toolbar, so the
  `activeTab` grant path was not exercised end to end), Firefox/Edge builds, the CI `extension` job.

## Milestone 7b: Extension v2

Plan: smarter extraction (PR 1), side panel with badge, context menu and shortcut (PR 2), more fields with
recruiter contact and follow-up (PR 3), opt-in "Improve with AI" (PR 4).

PR 1, extraction engine (`feature/extension-extraction-v2`):

- [x] Layered extraction (`extension/src/lib/extract/`). Sources, most trusted first:
  1. Site adapter: page state read in the MAIN world, or known elements.
  2. JSON-LD.
  3. Meta tags and the page's main text block.
  4. Guesses from that text.

  The salary fields move as a group, and inferred fields show a "check" marker in the form.

- [x] Site adapters:
  - LinkedIn
  - JobStreet/SEEK/JobsDB, from the live Apollo cache, so split-view clicks are read correctly
  - Indeed
  - Kalibrr (`__NEXT_DATA__`; respects `salaryShown: false`)
  - OnlineJobs.ph (labelled blocks)
  - Greenhouse (Remix loader data)
  - Ashby (`__appData`; its own workplace type beats JSON-LD's TELECOMMUTE)
  - Lever
  - Workday (legal entity code dropped from the employer)

  Workable needs no adapter: its JSON-LD is complete.

- [x] Selectors and page-state paths ship in the package and reach the page only as `executeScript` args. Probes
      return only the job's fields as JSON (500 KB cap, 1.5 s timeout).
- [x] Split views (LinkedIn `currentJobId`, JobStreet `jobId`, Indeed `vjk`):
  - The posting URL and the draft key are the job's own link.
  - The search page's title and meta are ignored.
  - JSON-LD is trusted only when it names the selected job.
- [x] Salary parser:
  - Currencies: ₱/PHP, RM, S$, A$, NZ$, US$, €, £. A bare `$` is resolved from the site (SEEK AU means AUD).
  - Amounts and ranges: `k` suffix, ranges, "up to".
  - Stated pay periods. Without one, the period is guessed from the amount and flagged.
- [x] Pay lines in free text are only read when they mention pay and a currency or period.
- [x] Work setup and employment type: parsed from labels, and from description phrases (hybrid/remote only, with
      negation guards).
- [x] JSON-LD reading:
  - `value.currency`, a `unitText` on the amount, `estimatedSalary`.
  - http canonical links upgraded to https on https pages.
- [x] The form sections are split into `components/form/*`.

Verification:

- Extension Vitest (76 tests):
  - Parser tables built from real SEEK/JobStreet/LinkedIn salary labels.
  - Per-site drafts on shapes copied from live pages (2026-10-18), including a JobStreet split view with stale
    JSON-LD.
  - happy-dom tests that run the page collector and the MAIN-world probes after `toString()` serialization (as
    Chrome does).
- The minified bundle's collector and probes, run in Chromium on live pages (2026-10-18), then `buildDraft`:
  - JobStreet PH split view, SEEK AU, LinkedIn (signed out), Kalibrr, OnlineJobs.ph, Greenhouse, Ashby, Lever,
    Workday, Workable.
  - Each gave the expected title, company, location, type, work setup and salary.
- Form rendered at 380 px with the "check" markers: no horizontal overflow.
- Not verified:
  - Indeed (it blocks automated browsers; selectors come from public write-ups).
  - LinkedIn signed in, including `/jobs/search` and `/jobs/collections`; those selectors are best-effort.
  - SmartRecruiters (generic path only).
  - The toolbar `activeTab` path, still: CDP `Extensions.triggerAction` closes headless Chromium.

PR 2, side panel (`feature/extension-side-panel`, stacked on PR 1):

- [x] Side panel (`entrypoints/sidepanel`):
  - It shares the review shell (`components/review-app.tsx`) and loader (`lib/load-review.ts`) with the popup.
  - It follows the active tab of its window, and re-reads only when the job changes (`pageKeyFor`), so LinkedIn
    tracking parameters don't reload the form.
  - After a split-view click it reads again while the page still shows the previous job (up to 3 times, 500 ms
    apart).
  - Each job keeps its own unsaved draft.
- [x] URL watcher (`lib/extract/watch-url.ts`): injected while the panel reads a page, reports `pushState` job
      changes, and stops once nothing receives its messages.
- [x] Opening the panel:
  - Context menu: "Save job to JobTrack" and "Use selection as job description".
  - The `open-panel` command, Alt+Shift+J.
  - The popup's panel button.

  `sidePanel.open()` runs first in each handler, while the click or key press counts as a user gesture. A selection
  picked from the menu is applied to the form with its line breaks.

- [x] "Read this page" screen in the panel for tabs it has no access to yet: it shows the user's actual shortcut
      and offers to fill in the details by hand.
- [x] "Auto-detect job sites" toggle (off by default):
  - Requests the `optional_host_permissions` from `lib/extract/sites/hosts.ts`.
  - Enables the **JOB** badge, set from tab URLs on the device.
  - Lets the panel read those sites without a click first.
- [x] Lever and OnlineJobs.ph adapters gained job IDs (for the badge).
- [x] `CHROMEWEBSTORE.md` and `extension/README.md`: new permissions, the side panel and auto-detect.

Verification:

- Extension Vitest (85 tests):
  - Every adapter has a job URL inside the optional host permissions.
  - Page keys for split views.
  - The panel's job-change check.
  - Menu and command handlers open the panel synchronously and store the selection.
  - Badge on and off.
  - URL watcher, serialized: one install, `pushState` reported, stops without a receiver.
- Real Chromium, built extension, JobTrack API mocked with Playwright routes, side panel page opened as a tab:
  - With auto-detect granted: the badge shows "JOB" on a JobStreet split view, the panel follows the tab to the
    selected job, and clicking another card switches the panel to that job (its own link). Layout checked at 360 px.
  - Default build: no badge; the panel shows "Read this page" with ⌥⇧J; "Fill in the details myself" opens the
    form.
  - The context menu items and the command are registered.
  - Popup header with the panel button at 380 px.
- Not verified:
  - The real side panel UI, opened from the toolbar, menu or shortcut: headless Chromium can't open it, and those
    gestures can't be automated.
  - Granting auto-detect through Chrome's permission prompt.
  - Signed-in LinkedIn split views.

PR 3, more fields, contact and to-do (`feature/extension-more-fields`, stacked on PR 2):

- [x] Contract (`packages/shared/src/extension-api.ts`), additive, so v0.1 drafts still save:
  - Fields: `referenceCode`, `salaryBasis`, `requiredSkills`, `tags`, `deadline`, `method`, `companyWebsite`,
    `contact {name, title, email, linkedinUrl, kind}`, `followUp {type: APPLY | FOLLOW_UP, dueDate, title}`.
  - `/me` sends `followUpDays`; the save result has `contactId` and `taskId`.
  - New enum copies are checked against Prisma in `contract.test.ts`.
  - `fieldErrorsFrom()` reports errors by path (`contact.email`), so the extension marks the right field.
- [x] Server: one transaction in `src/features/extension/save.ts`:
  - `createOpportunityInTx` (Quick Add's body; Quick Add unchanged).
  - `setCompanyWebsiteIfEmpty`.
  - `createOrReuseContactInTx`: reuses a contact at the company with the same LinkedIn URL or email, or by name when
    neither is given; fills only empty details.
  - `createTaskInTx` (createTask's body): APPLICATION or FOLLOW_UP task at 09:00 in the user's timezone, with the
    user's task reminder.
  - Validation: `extensionSaveSchema` (Quick Add shape and checks, plus contact and to-do). A to-do on an applied job
    is rejected (applying already suggests a follow-up), and so is a past date.
- [x] Connect page lists the new abilities.
- [x] Extension:
  - "More details" section: skills and tags as chips, deadline, reference, pay basis, company website.
  - Contact section and to-do (in the apply box); "applied via" when applied.
  - The saved screen names the contact and the to-do.
  - The sections are hidden for servers without `followUpDays`.
- [x] Extraction:
  - JSON-LD: skills, `validThrough` as a flagged deadline, `identifier` as reference (not UUIDs), and the employer
    website from `hiringOrganization.sameAs`/`url` (job board pages excluded).
  - Deadlines: Kalibrr `applicationEndDate`, Greenhouse `application_deadline`, Ashby `applicationDeadline`.
  - LinkedIn hiring-team card (signed-in selectors, unverified) and a contact email from the description (guessed,
    no-reply skipped).
  - Gross/net wording.
  - The application method defaults to job board or company website by source.

Verification:

- Web Vitest: 153 tests, 24 files, including `tests/integration/extension-fields.test.ts`:
  - New fields stored; a v0.1 draft still saves; a company website is never overwritten.
  - Contact reused by LinkedIn profile across company-name spellings, not across users; missing details filled.
  - To-do at 09:00 Asia/Manila with a 60-minute reminder.
  - Past to-do (422), to-do on an applied job (400, `followUp`), bad contact email (400, `contact.email`); none of
    these saved anything.
- Extension Vitest: 96 tests (payload nesting, path errors, new JSON-LD fields, site deadlines, LinkedIn contact,
  email guess, gross/net).
- Real Chromium, built extension, side panel page, live LinkedIn job, API mocked:
  - Deadline and reference prefilled, "More details" open.
  - Skills chips, contact and to-do filled in, then saved.
  - The captured payload nests `contact` and `followUp` (apply by the deadline).
  - The saved screen says "with a contact and a to-do". Layout checked at 360 px.
- Not verified:
  - A save against the running dev server: `EXTENSION_IDS` is empty in the local `.env`. The server path is covered by
    the integration tests.
  - LinkedIn's signed-in hiring-team card.

PR 4, opt-in "Improve with AI" (`feature/extension-ai-suggestions`, stacked on PR 3):

- [x] Scope: labelled, opt-in help for filling form fields from text the user already has on screen, reviewed
      before saving. It is not the "speculative AI automation" the PRD rules out, and it follows BACKLOG AI-01
      (opt-in, third-party processing disclosed).
- [x] Provider: Google Gemini, switched from Anthropic before release (2026-10-18). No SDK:
      `src/lib/integrations/gemini/client.ts` calls the Interactions API (`POST /v1beta/interactions`, GA since June 2026) over fetch, like the Google Calendar client:
  - Structured output via `response_format` with the JSON Schema from `z.toJSONSchema(aiExtractionSchema)` (no
    `$schema` key), and the answer re-parsed with the same Zod schema.
  - `store: false`, no tools, `max_output_tokens` 2000, `thinking_level` "minimal" on Flash-Lite and "low" otherwise,
    the timeout from env as one deadline for the whole request. A 429 or 503 is asked once more on
    `gemini-3.5-flash-lite` (`FALLBACK_MODEL`, added 2026-10-20, see below).
  - HTTP errors are sorted into busy (429, 408, 5xx, network), timeout, config (401, 402, 403, 404,
    `failed_precondition`) and rejected. A status other than `completed` (for example `incomplete` at the token
    limit) or output that doesn't match the schema means "no answer". Thinking tokens count as output tokens.
  - The key needs a Google project with billing enabled (paid tier): free-tier prompts are used to improve Google's
    products.
- [x] Env (`aiEnv()`, off without a key): `GEMINI_API_KEY`, `AI_MODEL` (default `gemini-3.8-flash`),
      `AI_DAILY_REQUESTS_PER_USER` (25), `AI_MONTHLY_REQUEST_LIMIT` (3000), `AI_TIMEOUT_MS` (20000). Documented in
      `.env.example` and passed to the `web` service in `compose.prod.yml` (missing before the switch, so the feature
      could not have been turned on in production).
- [x] Migration `extension_ai_suggestions`:
  - `user_preferences.ai_suggestions` and `ai_consent_at`.
  - `ai_usage`: per user and local day, with a CHECK on the counts.
  - `ai_extraction_cache`: validated suggestions only, 7 days, cleaned up on write.
  - Applied to the local dev DB; the test DB gets it through the test global setup.
- [x] `POST /api/extension/v1/extract`, in `src/features/extension/ai/`:
  - Order of checks: the off switch (503), the opt-in (403), the cache (free), the monthly cap (503), then an atomic
    daily reservation (429). The reservation is refunded on a provider error; a refusal counts.
  - Limits: 10 requests a minute per token, 200 KB body, and the call is aborted if the popup closes.
  - Page text is escaped inside `<page_text>`.
  - Each output field is re-validated, and fields the form already has are dropped. The salary fields go as a group.
  - Logs carry IDs, the stop reason and token counts only.
- [x] `/me` sends `features.ai {available, enabled}`.
- [x] Settings → Browser extension: an "Improve with AI" switch with the Google (Gemini) disclosure, disabled when the
      server has no key. The consent time is recorded, and the privacy note is updated.
- [x] Connect page, `CHROMEWEBSTORE.md` (Google as a third party, opt-in), `docs/SECURITY.md` (control and
      residual risk 10), `docs/DATA_MODEL.md`, `extension/README.md`.
- [x] Extension:
  - "Improve with AI" button at the top of the form, or a link to turn it on.
  - It sends the description and the names of the filled fields, not their values.
  - Suggestions fill only empty fields and are marked **AI** (the marks share the "check" mechanism). The notice
    shows how many fields were filled and the requests left today.

Verification:

- Web Vitest: 167 tests, 27 files.
  - `tests/integration/extension-ai.test.ts`:
    - Off without a key, and needs the opt-in (the consent time is stored).
    - Only missing, valid fields come back, and usage is recorded.
    - A cache hit is free and the cache never holds the text.
    - Daily and monthly limits.
    - Refund on a provider error; a refusal counts.
    - Short text is rejected (400), and the posting text never appears in the logs.
  - `ai/suggestions.test.ts`: per-field validation, choice fields, salary group, tag escaping.
  - `gemini/client.test.ts`, with `fetch` mocked: request body (model, `store: false`, thinking level, JSON schema,
    no tools), reading the output step, `incomplete` and unparsable answers, error sorting and caller aborts.
- Extension Vitest: 98 tests.
- The schema `z.toJSONSchema` generates: 18 required fields, nullable ones as `["string", "null"]`,
  `additionalProperties: false`, all within Gemini's supported subset. The choice fields stay plain strings checked
  by the server, so one bad value doesn't discard the whole answer.
- Real Chromium, built extension, side panel page, live LinkedIn job, API mocked:
  - The description and six filled field names were sent.
  - Three empty fields were filled and marked AI; the real title was not replaced; editing a field cleared its mark.
  - Layout checked at 360 px.
- Not verified:
  - A real Gemini call: no API key on this machine. Run one posting end to end after setting `GEMINI_API_KEY`
    locally.
  - The Settings page in a browser: the running dev server needs a restart to load the regenerated Prisma client.

Fix, "The AI service is busy" in production (`bugfix/ai-fallback-and-timeout-message`, 2026-10-20):

- [x] Cause, from the Coolify `web` logs: `gemini-3.8-flash` answered 503 ("high demand") or took longer than the
      20 s `AI_TIMEOUT_MS`, and both showed the same "busy" message.
- [x] Benchmark of the real prompt and schema, 4 postings with known answers, 3 runs each: `gemini-3.8-flash` median
      26 s (3 of 12 within 20 s), `gemini-3.6-flash` 3 s, `gemini-3.5-flash-lite` 2.6 s and no failures. Accuracy was
      near equal; Flash-Lite named the recruitment agency instead of the employer on the agency posting.
- [x] Production env: `AI_MODEL=gemini-3.6-flash`, `AI_TIMEOUT_MS=45000`.
- [x] On a 429 or 503 the client asks `gemini-3.5-flash-lite` once, within the same deadline, and logs the switch.
      A fallback answer isn't cached, since the cache key names the configured model.
- [x] A timeout is its own error kind, shown as "The AI service took too long to answer. Try again in a minute."
- Verification: web Vitest 175 tests, 27 files (`gemini/client.test.ts`: fallback on 429/503 only, the fallback's
  own error, timeout kind and the shared deadline; `extension-ai.test.ts`: both messages, fallback answer not cached).
  Typecheck and lint pass. Not verified: a real fallback call in production.

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
