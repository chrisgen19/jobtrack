# JobTrack - Agent Instructions (Codex and Other Coding Agents)

## Before coding

1. Read `README.md`, `docs/PRD.md`, `docs/BACKLOG.md`, `docs/DATA_MODEL.md`, and inspect `references/job-tracker-demo.html`.
2. Inspect current files, package manager setup and Git status. Preserve existing work.
3. Create `docs/IMPLEMENTATION_PROGRESS.md` and maintain a milestone/task checklist as work is verified.
4. The HTML prototype is the design reference; rebuild it as React components, preserving its visual identity while improving accessibility.
5. Resolve unspecified details using small, documented defaults; do not stop at documentation or fake-only screens.

## Non-negotiable architecture

- Next.js 16 App Router, React, strict TypeScript, Tailwind CSS v4, shadcn/ui, React Hook Form + Zod, TanStack Table.
- PostgreSQL and **Prisma ORM 7** with `@prisma/adapter-pg`. **No Drizzle.** Generate Prisma Client with an explicit output directory and commit real migrations.
- Better Auth's official Prisma adapter and generated auth models, following the installed version's documentation.
- Public registration, private per-user data; robust server-side owner-scoped data access and permission checks.
- Self-hosted Ubuntu VPS through Coolify using Docker Compose: `web` and separate `worker` containers; Coolify-managed PostgreSQL database on private networking.
- Graphile Worker for durable notification and calendar jobs; Resend for email; one-way Google Calendar; private S3-compatible/R2 documents.
- pnpm, Vitest, Playwright, lint/typecheck/build verification.

## Domain invariants

- Save a `JobOpportunity` before an `Application`; one opportunity may have several application attempts.
- Stages are user-customizable database rows; stage category/analytics semantics must be stable even after renames.
- Final application outcome is separate from current pipeline stage and interview result.
- An application may have unlimited interviews and repeat the same round type.
- Record stage changes, interview reschedules and status decisions as durable activity events.
- Use Prisma Decimal/PostgreSQL NUMERIC for salaries; preserve currency and pay period.
- Store instants and IANA timezones correctly; avoid local-date drift on date-only fields.
- Documents are private and linked to the submitted application version; no public bucket or container filesystem storage in production.
- Enforce user ownership in mutations, reads and foreign-key relations. Use transactions for stage changes and logs.
- Avoid automatic rejection for unanswered applications and avoid silently sending recruiter emails.

## Implementation sequence

1. Scaffold, Prisma migrations, Better Auth, protected routes, onboarding and user isolation tests.
2. Companies, job opportunities, application attempts, table, Kanban and customizable stages.
3. Interviews, tasks, activity timeline, dashboard, internal calendar and E2E vertical slice.
4. Private documents, contacts, offers, CSV export and analytics.
5. Graphile Worker, in-app and Resend reminders, Google OAuth and one-way event synchronization.
6. Coolify Docker files, migration job, health checks, security, backup/restore documentation and deployment verification.

## Quality and operational rules

- Prefer named exports, feature-oriented modules, strong types, Zod validation and least privilege.
- Validate authorization server-side. Never accept ownership IDs from an untrusted request.
- Provide accessible alternatives to drag/drop; responsive and keyboard-friendly UI.
- For reminder retries, use a durable queue, idempotency keys and a delivery log. Do not assume exactly-once external APIs.
- Never put tokens/PII/resume content in logs; encrypt refresh tokens; don't commit secrets.
- Never reset production DB or run `prisma db push` in production. Use a one-off `prisma migrate deploy` step.
- Keep worker and database private; expose web via Coolify HTTPS only.
- If external credentials are missing, implement truthful unconfigured/test states and document remaining verification.
- Run tests/typecheck/build after each milestone when possible; report what was actually verified rather than claiming unsupported success.
