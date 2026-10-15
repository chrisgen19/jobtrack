import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, safeEqual, sign } from "./crypto";

describe("secret encryption", () => {
  it("round-trips and never stores plaintext", () => {
    const token = "1//0refresh-token-value";
    const encrypted = encryptSecret(token);
    expect(encrypted.startsWith("v1.")).toBe(true);
    expect(encrypted).not.toContain(token);
    expect(decryptSecret(encrypted)).toBe(token);
    expect(encryptSecret(token)).not.toBe(encrypted);
  });

  it("rejects tampered ciphertext", () => {
    const encrypted = encryptSecret("secret");
    const parts = encrypted.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptSecret(parts.join("."))).toThrow();
  });

  it("signs and compares in constant time", () => {
    expect(safeEqual(sign("a", "k"), sign("a", "k"))).toBe(true);
    expect(safeEqual(sign("a", "k"), sign("b", "k"))).toBe(false);
  });
});
