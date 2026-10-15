import type { JobName, JobPayloads, JobSpec } from "@/lib/jobs/types";

/** Anything that can run raw SQL: the Prisma client or a transaction client. */
type SqlExecutor = {
  $executeRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<number>;
};

/**
 * Enqueues a Graphile Worker job through its `add_job` SQL function.
 *
 * Pass the Prisma transaction client to make the job part of the same
 * transaction as the domain change (transactional outbox): if the
 * transaction rolls back, the job never exists.
 */
export async function enqueueJob<Name extends JobName>(
  db: SqlExecutor,
  identifier: Name,
  payload: JobPayloads[Name],
  spec: JobSpec = {},
): Promise<void> {
  await db.$executeRaw`
    select graphile_worker.add_job(
      identifier => ${identifier}::text,
      payload => ${JSON.stringify(payload)}::json,
      queue_name => ${spec.queueName ?? null}::text,
      run_at => ${spec.runAt ?? null}::timestamptz,
      max_attempts => ${spec.maxAttempts ?? null}::int,
      job_key => ${spec.jobKey ?? null}::text,
      priority => null::int,
      flags => null::text[],
      job_key_mode => ${spec.jobKeyMode ?? null}::text
    )`;
}

/** Removes a pending (not yet locked) job by its job key. */
export async function removeJob(db: SqlExecutor, jobKey: string): Promise<void> {
  await db.$executeRaw`select graphile_worker.remove_job(${jobKey}::text)`;
}
