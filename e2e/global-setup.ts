import { execSync, spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { testEnv } from "../tests/support/test-env";
import { WORKER_PID_FILE } from "./helpers/paths";

/** Prepares the test database and starts a real background worker. */
export default async function globalSetup(): Promise<void> {
  const env = { ...process.env, ...testEnv };
  execSync("pnpm exec prisma migrate deploy", { env, stdio: "inherit" });
  execSync("pnpm exec graphile-worker --schema-only", { env, stdio: "inherit" });
  execSync("pnpm exec tsx e2e/helpers/reset-db.ts", { env, stdio: "inherit" });

  const worker = spawn("pnpm", ["exec", "tsx", "src/worker/index.ts"], {
    env: { ...env, WORKER_HEARTBEAT_FILE: "/tmp/jobtrack-e2e-worker-heartbeat" },
    stdio: "ignore",
    detached: true,
  });
  worker.unref();
  mkdirSync(path.dirname(WORKER_PID_FILE), { recursive: true });
  writeFileSync(WORKER_PID_FILE, String(worker.pid));
}
