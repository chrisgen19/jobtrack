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

- [ ] Company CRUD with find-or-create from Quick Add
- [ ] Opportunity CRUD, archive/restore, duplicate warnings
- [ ] Applications: apply, reapply, attempt history
- [ ] Custom pipeline stages: add, rename, reorder, recolor, disable, safe delete
- [ ] Stage changes in a transaction with activity events
- [ ] Jobs table (TanStack Table) with search/filters in the URL
- [ ] Kanban board (dnd-kit) with an accessible stage menu
- [ ] Job detail and application detail pages

## Milestone 3: Interviews and productivity

- [ ] Unlimited interview rounds, timezone-aware scheduling
- [ ] Rescheduling with history and activity events
- [ ] Tasks: CRUD, Today/Upcoming/Overdue/Completed, suggested follow-ups
- [ ] Calendar month view + agenda
- [ ] Activity timeline, dashboard metrics complete

## Milestone 4: Documents, contacts and offers

- [ ] Private document storage (R2/S3 driver, local dev driver), magic-byte validation, signed downloads
- [ ] Resume versions and application document links
- [ ] Contacts per company, interview attendees
- [ ] Offers with revisions, accept/decline closes the application
- [ ] Analytics with distinct-application denominators
- [ ] CSV and JSON export

## Milestone 5: Notifications and integrations

- [ ] Reminder scheduling/cancellation from interviews, tasks and offers
- [ ] In-app notifications (bell, list, read state)
- [ ] Resend email delivery with idempotency keys and delivery log
- [ ] Google Calendar OAuth, encrypted tokens, one-way sync with retries

## Milestone 6: Production deployment

- [ ] Multi-stage Dockerfile, `.dockerignore`, `compose.prod.yml`
- [ ] Migration job ordering, Coolify guide, backup and recovery guide
- [ ] Security review and full E2E definition-of-done run
