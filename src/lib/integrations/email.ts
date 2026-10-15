import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Resend } from "resend";
import { appEnv, emailEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Stable per logical message; Resend drops duplicates with the same key. */
  idempotencyKey: string;
};

export type SendEmailResult = {
  provider: "resend" | "dev-outbox";
  messageId: string | null;
};

/** A failure that retrying cannot fix (bad address, missing config). */
export class PermanentEmailError extends Error {
  override name = "PermanentEmailError";
}

const PERMANENT_RESEND_ERRORS = new Set([
  "validation_error",
  "invalid_from_address",
  "invalid_parameter",
  "missing_required_field",
  "missing_api_key",
  "invalid_api_key",
  "restricted_api_key",
  "invalid_idempotent_request",
  "invalid_idempotency_key",
]);

let resendClient: Resend | undefined;

export function isEmailConfigured(): boolean {
  return Boolean(emailEnv().RESEND_API_KEY);
}

/** Directory used by the development outbox (never used in production). */
export const DEV_OUTBOX_DIR = path.join(process.cwd(), ".data", "dev-mail");

/**
 * Sends a transactional email through Resend. Without an API key in
 * development or test, the message is written to `.data/dev-mail/` instead
 * so flows like email verification can be completed locally.
 */
export async function sendEmail(email: OutgoingEmail): Promise<SendEmailResult> {
  const { RESEND_API_KEY, EMAIL_FROM } = emailEnv();

  if (!RESEND_API_KEY) {
    if (appEnv().NODE_ENV === "production") {
      throw new PermanentEmailError("Email is not configured (RESEND_API_KEY is missing).");
    }
    return writeDevOutbox(email);
  }

  resendClient ??= new Resend(RESEND_API_KEY);
  const { data, error } = await resendClient.emails.send(
    { from: EMAIL_FROM, to: email.to, subject: email.subject, html: email.html, text: email.text },
    { idempotencyKey: email.idempotencyKey },
  );

  if (error) {
    const message = `Resend ${error.name}: ${error.message}`;
    throw PERMANENT_RESEND_ERRORS.has(error.name) ? new PermanentEmailError(message) : new Error(message);
  }
  return { provider: "resend", messageId: data?.id ?? null };
}

async function writeDevOutbox(email: OutgoingEmail): Promise<SendEmailResult> {
  await mkdir(DEV_OUTBOX_DIR, { recursive: true });
  const safeKey = email.idempotencyKey.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  const file = path.join(DEV_OUTBOX_DIR, `${Date.now()}-${safeKey}.json`);
  await writeFile(file, JSON.stringify({ ...email, sentAt: new Date().toISOString() }, null, 2));
  logger.info("[dev-mail] email written to local outbox instead of being sent", {
    subject: email.subject,
    file: path.relative(process.cwd(), file),
  });
  return { provider: "dev-outbox", messageId: null };
}
