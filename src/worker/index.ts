import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { Logger, run, type LogLevel } from "graphile-worker";
import { databaseEnv, workerEnv } from "@/lib/env";
import { errorMessage, logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { taskList } from "./tasks";

/**
 * JobTrack background worker (separate process / container).
 *
 * Graphile Worker stores jobs in PostgreSQL, so scheduled reminders survive
 * web and worker restarts. It claims jobs with row locks (no duplicate
 * processing across workers), retries failures with exponential backoff and
 * shuts down gracefully on SIGTERM/SIGINT, letting running jobs finish.
 */

const HEARTBEAT_FILE = process.env.WORKER_HEARTBEAT_FILE ?? "/tmp/jobtrack-worker-heartbeat";

const graphileLogger = new Logger(
  (scope) => (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
    const context = {
      scope: scope.label,
      task: scope.taskIdentifier,
      jobId: scope.jobId,
      error: meta?.error ? errorMessage(meta.error) : undefined,
    };
    if (level === "error") logger.error(message, context);
    else if (level === "warning") logger.warn(message, context);
    else if (level === "info") logger.info(message, context);
    else logger.debug(message, context);
  },
);

async function heartbeat(): Promise<void> {
  try {
    await writeFile(HEARTBEAT_FILE, new Date().toISOString());
  } catch (error) {
    logger.warn("worker heartbeat write failed", { error: errorMessage(error) });
  }
}

async function main(): Promise<void> {
  const { DATABASE_URL, DATABASE_POOL_MAX } = databaseEnv();
  const { WORKER_CONCURRENCY } = workerEnv();

  const runner = await run({
    connectionString: DATABASE_URL,
    concurrency: WORKER_CONCURRENCY,
    maxPoolSize: Math.min(DATABASE_POOL_MAX, WORKER_CONCURRENCY + 2),
    pollInterval: 2_000,
    taskList: taskList as Parameters<typeof run>[0]["taskList"],
    logger: graphileLogger,
  });

  await heartbeat();
  const heartbeatTimer = setInterval(() => void heartbeat(), 30_000);
  logger.info("worker started", { concurrency: WORKER_CONCURRENCY, tasks: Object.keys(taskList) });

  try {
    await runner.promise;
  } finally {
    clearInterval(heartbeatTimer);
    await prisma.$disconnect();
    logger.info("worker stopped");
  }
}

main().catch((error: unknown) => {
  logger.error("worker crashed", { error: errorMessage(error) });
  process.exit(1);
});
