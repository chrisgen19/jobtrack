import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifySvixSignature } from "./svix";

const secret = `whsec_${Buffer.from("super-secret-key").toString("base64")}`;
const body = JSON.stringify({ type: "email.bounced", data: { email_id: "abc" } });
const now = 1_800_000_000_000;
const timestamp = String(now / 1000);
const signature = createHmac("sha256", Buffer.from("super-secret-key"))
  .update(`msg_1.${timestamp}.${body}`)
  .digest("base64");

describe("verifySvixSignature", () => {
  it("accepts a valid signature among several", () => {
    expect(
      verifySvixSignature({
        secret,
        id: "msg_1",
        timestamp,
        signature: `v1,bogus v1,${signature}`,
        body,
        now,
      }),
    ).toBe(true);
  });

  it("rejects tampered bodies, wrong ids, stale timestamps and missing headers", () => {
    expect(
      verifySvixSignature({
        secret,
        id: "msg_1",
        timestamp,
        signature: `v1,${signature}`,
        body: `${body} `,
        now,
      }),
    ).toBe(false);
    expect(
      verifySvixSignature({ secret, id: "msg_2", timestamp, signature: `v1,${signature}`, body, now }),
    ).toBe(false);
    expect(
      verifySvixSignature({
        secret,
        id: "msg_1",
        timestamp,
        signature: `v1,${signature}`,
        body,
        now: now + 10 * 60_000,
      }),
    ).toBe(false);
    expect(verifySvixSignature({ secret, id: null, timestamp, signature, body, now })).toBe(false);
  });
});
