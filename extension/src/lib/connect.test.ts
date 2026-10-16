import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { CONNECT_TTL_MS, handleConnectMessage } from "./connect";
import { JOBTRACK_ORIGIN } from "./config";
import { pendingConnectItem, tokenItem } from "./storage";

const STATE = "state-nonce-0123456789";
const message = { type: "jobtrack:connect", token: `jt_ext_${"a".repeat(43)}`, state: STATE };

describe("handleConnectMessage", () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    await pendingConnectItem.setValue({ state: STATE, createdAt: Date.now() });
  });

  it("stores the token when the JobTrack origin echoes the pending nonce", async () => {
    expect(await handleConnectMessage(message, JOBTRACK_ORIGIN)).toEqual({ ok: true });
    expect(await tokenItem.getValue()).toBe(message.token);
    expect(await pendingConnectItem.getValue()).toBeNull();
  });

  it("ignores other origins, malformed messages and unknown or stale nonces", async () => {
    expect(await handleConnectMessage(message, "https://evil.example")).toEqual({
      ok: false,
      error: "origin",
    });
    expect(await handleConnectMessage(message, undefined)).toEqual({ ok: false, error: "origin" });
    expect(await handleConnectMessage({ ...message, token: "nope" }, JOBTRACK_ORIGIN)).toMatchObject({
      error: "message",
    });
    expect(
      await handleConnectMessage({ ...message, state: "other-nonce-0123456789" }, JOBTRACK_ORIGIN),
    ).toMatchObject({
      error: "state",
    });
    expect(
      await handleConnectMessage(message, JOBTRACK_ORIGIN, Date.now() + CONNECT_TTL_MS + 1),
    ).toMatchObject({
      error: "state",
    });
    expect(await tokenItem.getValue()).toBeNull();
  });

  it("accepts a nonce only once", async () => {
    expect((await handleConnectMessage(message, JOBTRACK_ORIGIN)).ok).toBe(true);
    expect(
      await handleConnectMessage({ ...message, token: `jt_ext_${"b".repeat(43)}` }, JOBTRACK_ORIGIN),
    ).toMatchObject({
      error: "state",
    });
    expect(await tokenItem.getValue()).toBe(message.token);
  });
});
