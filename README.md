# JobTrack

A private, multi-user job search tracker: save opportunities, track every application attempt through your own
hiring pipeline, schedule unlimited interview rounds, keep the exact resume version you sent, get reminders, and see
honest analytics. Each account is an isolated workspace.

The UI is rebuilt from the original prototype in `references/job-tracker-demo.html`. Product requirements live in
`docs/PRD.md`, `docs/BACKLOG.md` and `docs/DATA_MODEL.md`; build status and decisions in
`docs/IMPLEMENTATION_PROGRESS.md`.

## Stack

- **App:** Next.js 16 (App Router, Cache Components, Server Actions), React 19, TypeScript strict, Tailwind CSS v4,
  shadcn/ui (Radix), Lucide, React Hook Form + Zod 4, TanStack Table v9, dnd-kit, date-fns + @date-fns/tz
- **Data:** PostgreSQL + Prisma ORM 7 (`@prisma/adapter-pg`), owner-scoped data layer, composite foreign keys for tenancy
- **Auth:** Better Auth (email + password, verification, reset, rate limiting) with the Prisma adapter
- **Background jobs:** Graphile Worker in a separate process (reminders, email, calendar sync, file cleanup)
- **Integrations:** Resend (email), Cloudflare R2 / S3 (private documents), Google Calendar (one-way sync)
- **Tooling:** pnpm, ESLint, Prettier, Vitest, Playwright, Docker, Coolify

## Local development

Requirements: Node 24, pnpm 11, Docker.

```bash
pnpm install
cp .env.example .env            # then fill BETTER_AUTH_SECRET and TOKEN_ENCRYPTION_KEY:
                                #   openssl rand -base64 32
docker compose -f compose.dev.yml up -d   # PostgreSQL on localhost:5436 (+ jobtrack_test DB)
pnpm db:deploy                  # apply migrations + Graphile Worker schema
pnpm db:seed                    # optional demo data (demo@jobtrack.local / jobtrack-demo-2026)

pnpm dev                        # http://localhost:3000
pnpm worker:dev                 # second terminal: background worker
```

Without `RESEND_API_KEY`, emails (verification, reset, reminders) are written to `.data/dev-mail/*.json`; open the
newest file to follow the verification link. Without R2 credentials documents are stored under `.data/uploads`
(development only). Without Google credentials the Integrations page shows "not configured".

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` / `pnpm worker:dev` | Next.js dev server / worker with reload |
| `pnpm build` / `pnpm start` | Production build / server |
| `pnpm typecheck` | `next typegen` + `tsc --noEmit` |
| `pnpm lint` / `pnpm format` | ESLint / Prettier |
| `pnpm test` | Vitest unit + integration tests (uses the `jobtrack_test` database) |
| `pnpm test:e2e` | Playwright: builds, starts the app on :3100 and a real worker |
| `pnpm db:migrate` | Create and apply a migration in development (`prisma migrate dev`) |
| `pnpm db:deploy` | Production-style: `prisma migrate deploy` + Graphile Worker schema |
| `pnpm db:seed` | Demo data (refuses in production unless `ALLOW_DEMO_SEED=true`) |
| `pnpm auth:generate` | Regenerate Better Auth models with the official CLI |

## Project structure

```text
src/
  app/                  routes: (auth) pages, (app) workspace pages, api/ route handlers
  components/           ui/ (shadcn), layout/ (shell, nav), shared/ (badges, panels, forms)
  features/<domain>/    data.ts (server-only data layer), actions.ts (Server Actions),
                        schemas.ts (Zod), components/ — for opportunities, applications,
                        pipelines, interviews, tasks, documents, contacts, offers, calendar,
                        analytics, notifications, integrations, export, account
  lib/                  prisma, env, auth/, dates, money, crypto, jobs/ (queue), integrations/
  worker/               Graphile Worker entry + tasks
prisma/                 schema.prisma, migrations/, seed.ts
e2e/                    Playwright specs     tests/   Vitest integration tests + helpers
```

Key rules: every Prisma call goes through a feature's `data.ts`, which takes the user from the session and scopes
every query; Server Actions validate with Zod and never accept owner IDs; side effects (reminders, calendar sync)
are enqueued inside the same transaction as the change.

## Deployment

Production runs on a VPS with Coolify: `compose.prod.yml` builds `web`, `worker` and a one-off `migrate` from the
`Dockerfile`, against a separate Coolify PostgreSQL resource and a private R2 bucket. See
`docs/DEPLOYMENT_COOLIFY.md` and `docs/BACKUP_AND_RECOVERY.md`.
