/**
 * Graphile Worker task identifiers and their payloads. Shared by the code
 * that enqueues jobs (web, inside DB transactions) and the worker tasks.
 * Payloads hold IDs only; tasks reload current state from the database.
 */
export type JobPayloads = {
  send_email: {
    to: string;
    subject: string;
    html: string;
    text: string;
    /** Passed to the provider so a retried job never sends twice. */
    idempotencyKey: string;
  };
  deliver_reminder: { reminderId: string };
  sync_calendar_event: { syncId: string };
  delete_user_files: { storageKeys: string[] };
};

export type JobName = keyof JobPayloads;

export type JobSpec = {
  runAt?: Date;
  /** Graphile job_key: a newer job with the same key replaces a pending one. */
  jobKey?: string;
  jobKeyMode?: "replace" | "preserve_run_at" | "unsafe_dedupe";
  maxAttempts?: number;
  queueName?: string;
};
