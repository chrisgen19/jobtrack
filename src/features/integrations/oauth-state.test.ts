import { describe, expect, it } from "vitest";
import { createOAuthState, verifyOAuthState } from "./oauth-state";

const secret = "test-secret-test-secret-test-secret-123456";

describe("OAuth state", () => {
  it("accepts the matching user, state and unexpired cookie", () => {
    const { state, cookie } = createOAuthState("user-1", secret, 1_000);
    expect(verifyOAuthState({ cookie, state, userId: "user-1", secret, now: 2_000 })).toBe(true);
  });

  it("rejects another user, a forged state, a tampered cookie or an expired flow", () => {
    const { state, cookie } = createOAuthState("user-1", secret, 1_000);
    expect(verifyOAuthState({ cookie, state, userId: "user-2", secret, now: 2_000 })).toBe(false);
    expect(verifyOAuthState({ cookie, state: "forged", userId: "user-1", secret, now: 2_000 })).toBe(false);
    expect(
      verifyOAuthState({
        cookie: cookie.replace("user-1", "user-2"),
        state,
        userId: "user-2",
        secret,
        now: 2_000,
      }),
    ).toBe(false);
    expect(verifyOAuthState({ cookie, state, userId: "user-1", secret, now: 1_000 + 11 * 60_000 })).toBe(
      false,
    );
    expect(verifyOAuthState({ cookie: undefined, state, userId: "user-1", secret })).toBe(false);
  });
});
