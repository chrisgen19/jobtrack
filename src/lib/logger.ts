/**
 * Minimal structured logger shared by the web app and the worker.
 *
 * Log lines are JSON so Coolify / Docker log drivers can parse them. Callers
 * pass IDs and short reasons only: never tokens, passwords, email bodies,
 * job descriptions or resume content. Keys that look sensitive are redacted
 * as a second line of defence.
 */

type Level = "debug" | "info" | "warn" | "error";
type Context = Record<string, unknown>;

const SENSITIVE_KEY = /token|secret|password|authorization|cookie|api[-_]?key|html|body/i;

function redact(context: Context): Context {
  const output: Context = {};
  for (const [key, value] of Object.entries(context)) {
    if (SENSITIVE_KEY.test(key)) {
      output[key] = "[redacted]";
    } else if (value instanceof Error) {
      output[key] = { name: value.name, message: value.message };
    } else {
      output[key] = value;
    }
  }
  return output;
}

function write(level: Level, message: string, context: Context = {}) {
  if (level === "debug" && process.env.NODE_ENV === "production") return;
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    msg: message,
    ...redact(context),
  });
  if (level === "error" || level === "warn") {
    process.stderr.write(`${line}\n`);
  } else {
    process.stdout.write(`${line}\n`);
  }
}

export const logger = {
  debug: (message: string, context?: Context) => write("debug", message, context),
  info: (message: string, context?: Context) => write("info", message, context),
  warn: (message: string, context?: Context) => write("warn", message, context),
  error: (message: string, context?: Context) => write("error", message, context),
};

/** Short, log-safe description of an unknown thrown value. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 500);
  return String(error).slice(0, 500);
}
