import { storage } from "wxt/utils/storage";
import type { DraftValues } from "./draft";

/** Extension token from the connect handshake (local: survives browser restarts). */
export const tokenItem = storage.defineItem<string | null>("local:jobtrackToken", { fallback: null });

/** Nonce of a connect attempt in progress (session: cleared when the browser closes). */
export const pendingConnectItem = storage.defineItem<{ state: string; createdAt: number } | null>(
  "session:pendingConnect",
  { fallback: null },
);

/** Unsaved review form, so closing the popup by accident keeps the edits for that page. */
export const draftItem = storage.defineItem<{ pageUrl: string; values: DraftValues } | null>(
  "session:draft",
  {
    fallback: null,
  },
);
