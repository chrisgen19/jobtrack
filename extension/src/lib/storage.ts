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
 * Text picked with the "Use selection as job description" menu item, for the
 * side panel to apply to that tab's form (session; consumed once).
 */
export const pendingSelectionItem = storage.defineItem<{ tabId: number; text: string; at: number } | null>(
  "session:pendingSelection",
  { fallback: null },
);

/** Unsaved review forms by page URL (session: cleared when the browser closes). See drafts.ts. */
export const draftsItem = storage.defineItem<Record<string, { values: DraftValues; updatedAt: number }>>(
  "session:drafts",
  { fallback: {} },
);
