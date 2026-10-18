import { storage } from "wxt/utils/storage";
import type { DraftValues } from "./draft";

/** Extension token from the connect handshake (local: survives browser restarts). */
export const tokenItem = storage.defineItem<string | null>("local:jobtrackToken", { fallback: null });

/** Nonce of a connect attempt in progress (session: cleared when the browser closes). */
export const pendingConnectItem = storage.defineItem<{ state: string; createdAt: number } | null>(
  "session:pendingConnect",
  { fallback: null },
);

/**
 * Unsaved review forms by page URL (session: cleared when the browser closes). See drafts.ts.
 * `guessed` lists the prefilled fields not reviewed yet; drafts stored before it existed lack it.
 */
export const draftsItem = storage.defineItem<
  Record<string, { values: DraftValues; guessed?: (keyof DraftValues)[]; updatedAt: number }>
>("session:drafts", { fallback: {} });
