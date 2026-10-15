import path from "node:path";

export const WORKER_PID_FILE = path.join(process.cwd(), ".data", "e2e-worker.pid");
export const OUTBOX_DIR = path.join(process.cwd(), ".data", "dev-mail");
