import { createHmac } from "node:crypto";
import { safeEqual } from "@/lib/crypto";

/**
 * Verifies a Svix-signed webhook (used by Resend): HMAC-SHA256 over
 * `${id}.${timestamp}.${body}` with the base64 secret after "whsec_",
 * any `v1,<signature>` entry may match, timestamp within 5 minutes.
 */
export function verifySvixSignature(params: {
  secret: string;
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  body: string;
  now?: number;
}): boolean {
  const { secret, id, timestamp, signature, body, now = Date.now() } = params;
  if (!id || !timestamp || !signature) return false;
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(now / 1000 - seconds) > 300) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
  return signature
    .split(" ")
    .map((entry) => entry.split(","))
    .some(([version, value]) => version === "v1" && value !== undefined && safeEqual(value, expected));
}
