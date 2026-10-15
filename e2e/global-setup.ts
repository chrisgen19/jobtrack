import { execSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { testEnv } from "../tests/support/test-env";
import { WORKER_PID_FILE } from "./helpers/paths";

const WORKER_HEARTBEAT_FILE = "/tmp/jobtrack-e2e-worker-heartbeat";
const WORKER_START_TIMEOUT_MS = 60_000;

/** The worker writes its heartbeat once the job runner has started. */
async function waitForWorkerHeartbeat(): Promise<void> {
  const deadline = Date.now() + WORKER_START_TIMEOUT_MS;
  while (!existsSync(WORKER_HEARTBEAT_FILE)) {
    if (Date.now() > deadline)
      throw new Error(`The E2E worker did not start within ${WORKER_START_TIMEOUT_MS / 1000} s.`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

/** Prepares the test database and starts a real background worker, ready before any test runs. */
export default async function globalSetup(): Promise<void> {
  const env = { ...process.env, ...testEnv };
  execSync("pnpm exec prisma migrate deploy", { env, stdio: "inherit" });
  execSync("pnpm exec graphile-worker --schema-only", { env, stdio: "inherit" });
  execSync("pnpm exec tsx e2e/helpers/reset-db.ts", { env, stdio: "inherit" });

  // A heartbeat left by an earlier run would look like a ready worker.
  rmSync(WORKER_HEARTBEAT_FILE, { force: true });
  const worker = spawn("pnpm", ["exec", "tsx", "src/worker/index.ts"], {
    env: { ...env, WORKER_HEARTBEAT_FILE },
    stdio: "ignore",
    detached: true,
  });
  worker.unref();
  mkdirSync(path.dirname(WORKER_PID_FILE), { recursive: true });
  writeFileSync(WORKER_PID_FILE, String(worker.pid));
  await waitForWorkerHeartbeat();
}
