import { describe, expect, it } from "vitest";
import { rateLimit } from "./rate-limit";

describe("rateLimit", () => {
  it("allows up to the limit within the window, then blocks until it slides", () => {
    const key = `test-${Math.random()}`;
    expect(rateLimit(key, 2, 1_000, 0).allowed).toBe(true);
    expect(rateLimit(key, 2, 1_000, 100).allowed).toBe(true);
    expect(rateLimit(key, 2, 1_000, 200)).toEqual({ allowed: false, retryAfterSeconds: 1 });
    expect(rateLimit(key, 2, 1_000, 1_050).allowed).toBe(true);
  });
});
