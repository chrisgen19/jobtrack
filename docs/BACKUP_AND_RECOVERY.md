# Backup and Recovery

JobTrack keeps state in two places. **Both need their own backups**; a Coolify configuration backup contains
neither.

| Data                                                                                                  | Where                                  | Backup method                                                         |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------- |
| Accounts, jobs, applications, interviews, tasks, offers, reminders, encrypted OAuth tokens, job queue | PostgreSQL (Coolify database resource) | Scheduled `pg_dump` to off-server S3-compatible storage               |
| Uploaded resumes and cover letters                                                                    | Private Cloudflare R2 bucket           | R2 bucket replication or scheduled `rclone sync` to a second provider |
| Configuration (env vars, domains)                                                                     | Coolify                                | Coolify backup + a password-manager copy of every secret              |

Without `TOKEN_ENCRYPTION_KEY` a restored database cannot decrypt Google tokens (users simply reconnect).
Without `BETTER_AUTH_SECRET` all sessions are invalidated (users sign in again). Store both in a password manager.

## 1. PostgreSQL backups

### Scheduled backups in Coolify

1. Database resource → **Backups** → add a schedule, e.g. `0 2 * * *` (daily 02:00) and keep 14 daily backups.
2. Configure an **S3 destination** (Coolify → Storages) on a _different_ provider or account than the VPS, e.g. a
   separate R2 bucket or Backblaze B2 with object lock / versioning enabled. Enable "Save to S3" for the schedule.
3. Check the first run: the backup log shows success and the object appears in the bucket.

Coolify backups use `pg_dump` (logical, custom format), which is consistent and includes the `graphile_worker`
schema. Target: **RPO ≤ 24 hours** with daily backups; take an extra manual backup before risky releases.

### Manual backup

```bash
# On the VPS (database container name from Coolify)
docker exec <postgres-container> pg_dump -U postgres -d jobtrack -Fc -f /tmp/jobtrack-$(date +%F).dump
docker cp <postgres-container>:/tmp/jobtrack-$(date +%F).dump ./
# Copy it off the server (rclone, scp...) and delete the local copy afterwards.
```

## 2. Restoring PostgreSQL

Restore into a **new, empty** database first, verify it, then switch over.

```bash
# 1. Create an empty database (new Coolify Postgres resource, or a new DB in the same server)
docker exec -it <postgres-container> psql -U postgres -c "CREATE DATABASE jobtrack_restore OWNER jobtrack;"

# 2. Restore the dump
docker cp jobtrack-2026-10-14.dump <postgres-container>:/tmp/restore.dump
docker exec <postgres-container> pg_restore -U postgres -d jobtrack_restore --no-owner --role=jobtrack /tmp/restore.dump

# 3. Verify
docker exec <postgres-container> psql -U postgres -d jobtrack_restore -c \
  "select count(*) from \"user\"; select max(finished_at) from _prisma_migrations;"
```

4. Point `DATABASE_URL` at `jobtrack_restore` in Coolify and redeploy. The `migrate` step applies any migrations
   newer than the backup.
5. Reminders and calendar syncs that were scheduled after the backup are lost; users' upcoming interviews still
   exist, and editing them re-schedules reminders. Jobs in `graphile_worker` from the backup will run again; the
   delivery code is idempotent, so already-sent reminders are not duplicated (their `notification_deliveries` rows
   are restored too).

Target: **RTO ≤ 1 hour** for a full restore.

## 3. Document storage (R2)

- Keep the primary bucket private. Enable a second copy:
  - R2 → bucket → **Settings → Object lifecycle / replication** if available on your plan, or
  - a nightly job on another machine: `rclone sync r2:jobtrack-documents b2:jobtrack-documents-backup` with
    versioning enabled on the destination.
- Object keys are opaque (`users/<userId>/<uuid>`); the database maps them to users and filenames, so restore the
  database and the bucket from backups taken around the same time.
- Documents deleted in the app are removed from R2 (and retried by the worker if R2 is down). Copies in backups
  expire with the backup retention below.

### Restoring documents

```bash
rclone sync b2:jobtrack-documents-backup r2:jobtrack-documents
```

Missing objects only affect downloads of those versions; metadata and application history remain intact.

## 4. Retention and account deletion

- Database backups: 14 daily copies (adjust to your privacy policy). Document backups: 30 days of versions.
- When a user deletes their account, their rows and files are deleted immediately from the live system. Copies
  inside backups disappear when those backups expire; state this period in the privacy policy. If a backup is ever
  restored, re-run deletions recorded since that backup (keep a log of deleted user IDs outside the database for
  this purpose, e.g. from the `account deleted` log lines).

## 5. Recovery testing (do this regularly)

Quarterly, and after major schema changes:

1. Restore the latest database backup into a scratch database (section 2, steps 1-3).
2. Start a staging copy of the app (Coolify preview or a second resource) against it with a _separate_ R2 bucket
   restored from the document backup.
3. Sign in with a test account, open a job with documents, download one, check the dashboard and calendar.
4. Record the date, backup age (RPO), time taken (RTO) and any problems in your runbook. Delete the scratch data.

A backup that has never been restored is not a backup.
