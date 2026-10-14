# JobTrack - Implementation Starter for Claude Code / Codex

This is a **reference/specification starter**, not a running Next.js application. It contains the existing clickable mockup and product documentation in the paths expected by the JobTrack implementation prompt.

## Confirmed architecture

- **Product:** Public-registration, multi-user job application tracking SaaS
- **UI:** Next.js 16 App Router, TypeScript, Tailwind CSS v4, shadcn/ui
- **Database:** PostgreSQL with **Prisma ORM 7**, **not Drizzle**
- **Auth:** Better Auth with Prisma adapter
- **Features:** Saved job opportunities, application attempts, custom pipeline stages, unlimited interviews, tasks, application-linked resumes/cover letters, offers, analytics
- **Integrations:** Resend email reminders; one-way Google Calendar sync; private Cloudflare R2/S3-compatible document storage
- **Background processing:** Graphile Worker using PostgreSQL; separate worker container
- **Production:** Self-hosted Ubuntu VPS, **Coolify** with Docker Compose and a separate Coolify-managed PostgreSQL resource

## Files

```
.
├── AGENTS.md                   # Codex/project-agent guidance
├── CLAUDE.md                   # Claude Code guidance
├── README.md                   # This guide
├── docs/
│   ├── PRD.md                  # Requirements, UX and acceptance criteria
│   ├── BACKLOG.md              # Development milestones and priorities
│   └── DATA_MODEL.md           # Data invariants and Prisma/Postgres design
└── references/
    └── job-tracker-demo.html   # Self-contained visual prototype (mock data)
```

## How to use this starter

1. Extract all files **preserving the directory structure** into a new Git repository (or an empty project folder).
2. Open `references/job-tracker-demo.html` in your browser to see the existing look and workflow.
3. Open a terminal in the repository and start `claude` or `codex`.
4. Paste your full JobTrack master implementation prompt and ask the coding agent to read `AGENTS.md` or `CLAUDE.md`, the PRD, backlog, data model and mockup before coding.
5. Implement and test in milestones. Generate **Prisma** schema/migrations and Better Auth models from the installed versions; these do **not** exist yet in the starter.
6. For production, deploy with Coolify Docker Compose. Keep PostgreSQL private, run migrations once per deployment, and configure external backups and object storage.

## Important constraints

- The HTML page uses fictional, in-memory demo data and **does not** have a backend, real login or persistent storage.
- The documentation is a product design baseline, not a compile-tested Prisma schema.
- Do **not** bring the old Drizzle starter code into the new implementation. Code agents must create a clean Prisma database layer.
- Server-side authorization must protect every user-owned resource, including nested records and documents.
- External-provider credentials are not included. Development must work with integrations disabled or in clearly labeled test mode.

## First verified end-to-end flow to implement

Register -> save a job -> submit application -> change custom stage -> schedule interview -> create follow-up task -> view dashboard. Add documents, reminders, calendar sync and analytics after that core flow works.
