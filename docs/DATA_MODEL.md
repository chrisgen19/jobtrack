# Database Model, Data Dictionary and Design Invariants

**Database:** PostgreSQL with **Prisma ORM 7** and `@prisma/adapter-pg`. Implement domain models in `prisma/schema.prisma` (not yet generated).  
**Auth:** Generate Better Auth `user`, `session`, `account`, `verification` (and optional plugin) Prisma models using its official CLI for the installed version. No pre-generated auth models are supplied in this starter.

## 1. Table groups and relationships

| Group | Table | Keys and purpose |
|---|---|---|
| Identity | `user` (Better Auth) | TEXT `id`; owns private resources |
| Settings | `user_settings` | PK/FK `user_id` -> user, IANA timezone, preferred currency, opt-in settings |
| Companies | `companies` | UUID PK, owner `user_id`, company name/website/notes |
| Pipelines | `pipelines` | UUID PK; per-user default via partial unique index; future extra pipelines |
| Pipeline stages | `pipeline_stages` | UUID PK, `(user_id,pipeline_id)` FK, name, category, position, active flag |
| Opportunities | `opportunities` | UUID PK, company FK, title, description, salary, location, source, priority; may have 0 applications |
| Applications | `applications` | UUID PK; opportunity + pipeline + **stage in that pipeline**, applied_on, status and outcome |
| Interviews | `interviews` | UUID PK, application FK, unlimited interview rounds with dates/status/results |
| Contacts | `contacts` | UUID PK, company FK, recruiter/interviewer details |
| Interview attendees | `interview_contacts` | PK `(user_id, interview_id, contact_id)` |
| Tasks | `tasks` | UUID PK, optional opportunity/application FKs, task due/completed timestamps |
| Activity feed | `activity_events` | UUID PK, immutable snapshots, opportunity FK, optional application FK |
| Tags | `tags` | UUID PK, private tag labels |
| Opportunity tags | `opportunity_tags` | PK `(user_id, opportunity_id, tag_id)` |
| Documents | `documents` | UUID PK, *metadata only*, private object-store key, scanning state |
| Submitted documents | `application_documents` | PK `(user_id,application_id,document_id)`, purpose, was_submitted |
| Offers | `offers` | UUID PK, application FK, revision number, salary/benefits/deadline/decision |
| Calendar tokens | `calendar_connections` | UUID PK, encrypted OAuth credentials, selected calendar, account, status |
| Calendar sync | `calendar_event_links` | UUID PK, connection plus exactly one interview/task, external event ID, retry state |
| Pending deliveries | `reminders` | UUID PK, exactly one interview/task, one channel, stable dedupe key and lease |
| User inbox | `notifications` | UUID PK, optional reminder, unread/read record |

## 2. Ownership and cross-tenant constraints

Every private table contains a `user_id` (TEXT to match Better Auth's generated user ID) except the join tables which also include `user_id` as part of their composite primary key. Each row is additionally protected at application level: **never query only by untrusted record id; include `user_id` from the server-authenticated session**.

Composite foreign keys defend against _same-ID wrong-user_ references:

```
(opportunities.user_id, opportunities.company_id)
  -> (companies.user_id, companies.id)

(applications.user_id, applications.opportunity_id)
  -> (opportunities.user_id, opportunities.id)

(applications.user_id, applications.pipeline_id, applications.stage_id)
  -> (pipeline_stages.user_id, pipeline_stages.pipeline_id, pipeline_stages.id)

(interviews.user_id, interviews.application_id)
  -> (applications.user_id, applications.id)
```

The referenced tables have corresponding composite UNIQUE indexes, even though their UUID PKs alone are unique. In this design, the database itself rejects a user A resource linked to user B's application. Equivalent owner-scoped composite FKs are used for tasks, contacts, documents, reminders and calendar links.

If more collaboration is required later, introduce explicit workspace/organization membership and revise tenancy consciously; do **not** just strip `user_id` filters.

## 3. Opportunity vs application vs interview

```
Company (Acme)
  |-- Opportunity (Full-Stack Developer, posting #123)
  |     |-- Application attempt 1 (2026-01-10; rejected)
  |     |      |-- Interview: screening
  |     |      |-- Interview: technical 1
  |     |
  |     |-- Application attempt 2 (2026-09-02; active)
  |            |-- Interview: technical 1
  |            |-- Interview: technical 2
  |            |-- Interview: final
  |
  |-- Opportunity (Senior Engineer, posting #456)
        |-- Application attempt 1 (saved then applied)
```

A saved opportunity with no applications is displayed as `Saved` in the UI. The application's `status` is `active|paused|closed`, and its `stage_id` points to the user-defined current stage. Rejection/acceptance/withdrawal is represented by `outcome` only when `status='closed'`.

## 4. Date and money conventions

- `applied_on`, `closing_on` = PostgreSQL `DATE`, returned as `YYYY-MM-DD` strings; local calendar date must not drift across time zones.
- Interview start/end, task deadlines, reminder schedule, event timestamps = `TIMESTAMPTZ`. Store the submitted IANA timezone separately on interviews and users.
- Always convert UI form local time + timezone to a UTC instant on submission. Use a timezone-capable date/time library or Temporal polyfill with daylight-saving ambiguity handling.
- Currency = 3-character ISO 4217 code (`PHP`, `AUD`, `USD`, etc.), never user-untrusted JS floating point amount.
- Exact money = PostgreSQL `NUMERIC(14,2)` / Prisma `Decimal` (serialize amounts losslessly). Store salary period (`hourly`, `monthly`, `annually`, etc.) and basis (`gross`, `net`, `unknown`).
- Do not compare salaries until pay periods, work hours, taxation basis and FX date have been intentionally normalized.

## 5. Event and state-transition transactional rules

### Create application

1. Authenticate and resolve session `user.id`.
2. Verify opportunity and selected default pipeline belong to user.
3. Verify first stage is active, belongs to same pipeline and user.
4. `INSERT applications(...)` with `applied_on`.
5. In the **same transaction**, add `activity_events(event_type='application_submitted')` with snapshot fields.
6. Return application; optionally prompt to create a follow-up task.

### Change pipeline stage

1. Check current application belongs to session user.
2. Check new stage belongs to same pipeline, owner and is active.
3. Start a transaction; update current stage + updated time; insert `application_stage_changed` activity with previous/new **stage names snapshot** and IDs in JSON details.
4. If a stage transition requires prompted task/reminder changes, write work queue entries within the transaction or into a durable outbox (don't call external APIs inside a DB transaction).
5. Commit and refresh UI.

### Close/reopen

`closed` requires both `outcome` and `closed_at`; `active` or `paused` require neither. SQL `CHECK` enforces the invariant. Reopen clears the two closing columns. Every change produces an activity event.

### Reschedule interview

1. Validate new start and end times; update the **same** interview row.
2. Insert activity event with old and new times and timezone.
3. Cancel/reschedule pending reminders; do not delete delivered history.
4. Queue calendar event update for every connected account/event link.
5. Commit internal transaction. Retry external Google and email work independently.

## 6. Reminder worker and idempotency

**Implementation decision:** use **Graphile Worker** for durable scheduling, locking and retries in PostgreSQL. Keep `reminders` as the application's business record (what should be delivered and its current schedule), and `notification_deliveries` as the idempotency/audit record. Do **not** reimplement Graphile Worker's full database job-claiming engine.

`reminders` is the business schedule and dedupe store, not a free-form notification preferences table. A task can have one in-app reminder and one email reminder at the same time (two rows with distinct `channel` and `dedupe_key`).

Recommended durable delivery flow (Graphile Worker owns queue claiming and retries):

1. Enqueue a Graphile Worker job with stable identity; let Graphile Worker perform queue claims, leases and retries. Revalidate the source event and recipient settings before delivery.
2. For in-app: insert a `notifications` row referencing `reminder_id`; partial UNIQUE index blocks a duplicate. Mark reminder sent in one DB transaction.
3. For email: pass an idempotency key to provider (e.g. Resend) to prevent duplicate emails if worker crashes after provider acceptance. Mark sent and store provider message ID.
4. For transient failures: use Graphile Worker retry/backoff behavior, record delivery attempts and surface terminal failures for inspection.
5. Suppress email when user unverified, opted out, deleted, or reminder obsolete; always re-check preferences before final send.
6. When an interview/task is rescheduled, invalidate old pending dedupe keys and insert new reminders with a new schedule revision ID in the dedupe key. A stale worker must check current source version before sending.

**Important:** The schema alone cannot make third-party delivery exactly-once. Provider idempotency, unique constraints, transaction boundaries and tests must cooperate.

## 7. Calendar one-way sync and recovery

`calendar_connections` belongs to the user and stores **encrypted** refresh token and optional encrypted access token. `calendar_event_links` maps to **exactly one** interview or task per link; partial UNIQUE indexes prevent duplicate source mappings for a connection.

- On edit: internal record saves successfully even if Google is offline; mark link `pending` and worker syncs it.
- On reschedule: update existing event by `provider_event_id`. On cancellation: queue deletion; don't erase mapping before remote cleanup can be attempted.
- Google OAuth: request narrow scopes; persist consent state, reauthorize when revoked. Treat 401/403/429 separately (reauthorize, forbidden, retry/backoff).
- A user deleting an interview may remove link before remote cleanup due to cascading delete; **service must first queue a durable delete job containing external event identity**, or perform cancellation/sync before hard delete. A schema-only link row is insufficient for that edge case.
- R2 does not import external calendar edits; avoid two-way sync until conflict and deletion rules are agreed.

## 8. Document lifecycle

- Upload from server-authorized presigned URL to private object storage under `user/<userId>/<uuid>`-style key (avoid actual personal identifying data in object names).
- Row begins `uploading`, becomes `ready` only after server confirms size/MIME/magic signature and malware scan; blocks unsafe files using `blocked` state.
- Download uses an owner-authorized operation to issue a short TTL signed URL, not a stored public URL.
- Document deletion also removes storage blob and application associations; consider soft-delete metadata + cleanup jobs in production if you want more resilient recovery.
- Store a *copy/immutable object version* for submitted resumes if file content replacement would otherwise change history.
- Object deletion from backups follows the advertised retention policy; never promise instantaneous deletion from immutable backups.

## 9. Additional production migrations to consider

Implement the Prisma models from the documented invariants. Before launch, consider these additional database safeguards:

- An **outbox** table for durable integration delete/upsert tasks (especially calendar deletes after source record deletion); the existing calendar link queue covers normal upsert but not hard-delete-after-cascade.
- An **app event version** or unique `source_revision` on reminders to atomically invalidate old schedules during concurrent rescheduling.
- Admin-safe observability audit records separate from user-visible activity if you process support access.
- Database RLS as defense in depth only if your deployment and service/admin roles are well understood; composite FKs do not replace authorization.
- Partial-index and GIN/trigram search optimization only after profiling query volume.
- A phone number or localized reminder template if users opt into SMS/push later.

## 10. Queries: owner-scoped examples

```ts
// Illustrative Prisma calls: adjust field/model names to the finalized schema.
// userId MUST come from the authenticated server session, not request JSON.
const jobs = await prisma.jobOpportunity.findMany({
  where: { userId, archivedAt: null },
});

const activeAttempts = await prisma.application.findMany({
  where: { userId, status: "active" },
});
```

## 11. Migration order

1. Generate Better Auth tables (`user`, `session`, `account`, `verification`, optional plugins) using the installed CLI version; inspect files.
2. User settings and companies.
3. Pipelines and pipeline stages.
4. Opportunities and applications.
5. Interviews, contacts, tasks, activity events, tags.
6. Documents and application attachment join table.
7. Offers.
8. Calendar connections/event links and reminders/notifications.
9. Unique constraints, indexes, checks and any follow-up data correction migrations.

Use **Prisma Migrate** to generate and review version-controlled SQL migrations. This list is a _feature implementation order_, not manual SQL ordering. Use `prisma migrate dev` in development and a one-off `prisma migrate deploy` in production; review destructive migrations and database-specific checks before applying them.
