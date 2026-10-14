# JobTrack - Claude Code Instructions

Read and follow **`AGENTS.md`** as the repository's authoritative engineering and implementation guide. Also read `README.md`, `docs/PRD.md`, `docs/BACKLOG.md`, `docs/DATA_MODEL.md`, and inspect `references/job-tracker-demo.html` before changing implementation code.

## Core decisions (do not reinterpret)

- Build a **working multi-user SaaS**, not another static mockup.
- Keep the established mockup's overall visual design, rebuilding it with Next.js 16, React, TypeScript and shadcn/ui.
- Use **Prisma ORM 7 + PostgreSQL**; **do not use Drizzle** even if older documents or prior context mention it.
- Use Better Auth, user-isolated data, customizable pipelines, unlimited interviews, private document versions and activity history.
- Deployment is a **self-hosted VPS with Coolify and Docker Compose**, with a private managed Postgres resource, separate web and Graphile Worker processes, Resend email, Google Calendar one-way sync and private S3-compatible document storage.

## Execution style

- Start with repository inspection and a short implementation plan, then implement incrementally. Keep `docs/IMPLEMENTATION_PROGRESS.md` updated.
- Prioritize the complete working vertical slice: sign-up -> add job -> apply -> change stage -> schedule interview -> follow up -> dashboard.
- Write real persistence, authorization and tests; avoid placeholder flows being reported as finished.
- Use approved environment variables for secrets. Don't perform destructive production operations.
- Run available checks, fix failures, and clearly state unverified integrations or missing credentials.

When directions conflict, the user's latest explicit choice of **Prisma 7 and Coolify** takes precedence over old Drizzle/Vercel references.
