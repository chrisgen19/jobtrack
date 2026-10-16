import { browser } from "wxt/browser";
import { extensionConnectMessageSchema } from "@jobtrack/shared/extension-api";
import { JOBTRACK_ORIGIN, jobtrackUrl } from "./config";
import { pendingConnectItem, tokenItem } from "./storage";

/** How long a connect tab may take before its nonce expires. */
export const CONNECT_TTL_MS = 10 * 60 * 1000;

function randomState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Opens the JobTrack connect page with a fresh nonce the token reply must echo. */
export async function startConnect(): Promise<void> {
  const state = randomState();
  await pendingConnectItem.setValue({ state, createdAt: Date.now() });
  const url = new URL(jobtrackUrl("/extension/connect"));
  url.searchParams.set("ext", browser.runtime.id);
  url.searchParams.set("state", state);
  await browser.tabs.create({ url: url.toString() });
}

export type ConnectReply = { ok: true } | { ok: false; error: "origin" | "message" | "state" };

/**
 * Accepts a token from the JobTrack connect page (runtime.onMessageExternal).
 * Only the configured origin may send it, and only in reply to the nonce of
 * a connect attempt this extension started in the last few minutes.
 */
export async function handleConnectMessage(
  message: unknown,
  senderOrigin: string | undefined,
  now = Date.now(),
): Promise<ConnectReply> {
  if (senderOrigin !== JOBTRACK_ORIGIN) return { ok: false, error: "origin" };
  const parsed = extensionConnectMessageSchema.safeParse(message);
  if (!parsed.success) return { ok: false, error: "message" };
  const pending = await pendingConnectItem.getValue();
  if (!pending || pending.state !== parsed.data.state || now - pending.createdAt > CONNECT_TTL_MS) {
    return { ok: false, error: "state" };
  }
  await tokenItem.setValue(parsed.data.token);
  await pendingConnectItem.removeValue();
  return { ok: true };
}
