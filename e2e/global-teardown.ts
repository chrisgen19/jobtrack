import { existsSync, readFileSync, rmSync } from "node:fs";
import { WORKER_PID_FILE } from "./helpers/paths";

export default async function globalTeardown(): Promise<void> {
  if (!existsSync(WORKER_PID_FILE)) return;
  const pid = Number(readFileSync(WORKER_PID_FILE, "utf8"));
  try {
    // Negative PID: signal the whole process group started by global setup.
    process.kill(-pid, "SIGTERM");
  } catch {
    // Already stopped.
  }
  rmSync(WORKER_PID_FILE, { force: true });
}
