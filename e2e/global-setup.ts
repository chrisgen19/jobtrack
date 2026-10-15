import { execFileSync, execSync, spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { testEnv } from "../tests/support/test-env";
import { WORKER_PID_FILE } from "./helpers/paths";

const WORKER_COMMAND = ["pnpm", "exec", "tsx", "src/worker/index.ts"] as const;
const WORKER_START_TIMEOUT_MS = 60_000;
const WORKER_STOP_TIMEOUT_MS = 10_000;
const DATA_DIR = path.dirname(WORKER_PID_FILE);
const HEARTBEAT_PATTERN = /^e2e-worker-.+\.heartbeat$/;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function groupAlive(pid: number): boolean {
  try {
    process.kill(-pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Only our worker's process group is signalled: a PID from an old run may belong to something else now. */
function isOurWorker(pid: number): boolean {
  try {
    // `ps` works on Linux and macOS (unlike /proc); -ww keeps long command lines whole.
    const args = execFileSync("ps", ["-ww", "-o", "args=", "-p", String(pid)], { encoding: "utf8" });
    return args.split(/\s+/).includes(WORKER_COMMAND[3]);
  } catch {
    return false;
  }
}

/** Stops a worker that an interrupted earlier run left behind, so tests never run jobs through it. */
async function stopLeftoverWorker(): Promise<void> {
  if (!existsSync(WORKER_PID_FILE)) return;
  const pid = Number(readFileSync(WORKER_PID_FILE, "utf8"));
  rmSync(WORKER_PID_FILE, { force: true });
  if (!Number.isInteger(pid) || pid <= 0 || !groupAlive(pid) || !isOurWorker(pid)) return;
  process.kill(-pid, "SIGTERM");
  const deadline = Date.now() + WORKER_STOP_TIMEOUT_MS;
  while (groupAlive(pid) && Date.now() < deadline) await sleep(200);
  if (groupAlive(pid)) process.kill(-pid, "SIGKILL");
}

/** Resolves once this run's worker writes its heartbeat; fails fast if it exits first. */
function waitForWorkerHeartbeat(worker: ChildProcess, heartbeatFile: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + WORKER_START_TIMEOUT_MS;
    const finish = (error?: Error) => {
      clearInterval(timer);
      worker.off("exit", onExit);
      if (error) reject(error);
      else resolve();
    };
    const onExit = (code: number | null, signal: NodeJS.Signals | null) =>
      finish(new Error(`The E2E worker exited before it started (code ${code}, signal ${signal}).`));
    worker.once("exit", onExit);
    const timer = setInterval(() => {
      if (existsSync(heartbeatFile)) finish();
      else if (Date.now() > deadline)
        finish(new Error(`The E2E worker did not start within ${WORKER_START_TIMEOUT_MS / 1000} s.`));
    }, 250);
  });
}

/** Prepares the test database and starts a real background worker, ready before any test runs. */
export default async function globalSetup(): Promise<void> {
  const env = { ...process.env, ...testEnv };
  await stopLeftoverWorker();
  execSync("pnpm exec prisma migrate deploy", { env, stdio: "inherit" });
  execSync("pnpm exec graphile-worker --schema-only", { env, stdio: "inherit" });
  execSync("pnpm exec tsx e2e/helpers/reset-db.ts", { env, stdio: "inherit" });

  // A heartbeat file unique to this run, so no other worker can make this one look ready.
  mkdirSync(DATA_DIR, { recursive: true });
  for (const file of readdirSync(DATA_DIR))
    if (HEARTBEAT_PATTERN.test(file)) rmSync(path.join(DATA_DIR, file), { force: true });
  const heartbeatFile = path.join(DATA_DIR, `e2e-worker-${randomUUID()}.heartbeat`);

  const [command, ...args] = WORKER_COMMAND;
  const worker = spawn(command, args, {
    env: { ...env, WORKER_HEARTBEAT_FILE: heartbeatFile },
    stdio: "ignore",
    detached: true,
  });
  worker.unref();
  writeFileSync(WORKER_PID_FILE, String(worker.pid));
  await waitForWorkerHeartbeat(worker, heartbeatFile);
}
