import type { DraftValues, FieldMarks } from "./draft";
import { draftsItem } from "./storage";

/** Unsaved drafts kept per browser session; the least recently edited go first. */
export const MAX_DRAFTS = 20;

/** Edits are written this long after the last change, not on every keystroke. */
export const DRAFT_SAVE_DELAY_MS = 300;

/** A page's unsaved edits plus the prefilled fields the user hasn't touched yet (still marked). */
export type SavedDraft = { values: DraftValues; marks: FieldMarks };

// Every draft read and write runs here, one at a time, so each one sees the
// result of the previous one (they read, change and write the whole map).
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

/** The unsaved edits for a page, if any, so closing the popup by accident loses nothing. */
export function loadDraft(pageUrl: string): Promise<SavedDraft | null> {
  return enqueue(async () => {
    const stored = (await draftsItem.getValue())[pageUrl];
    if (!stored) return null;
    // Drafts written before marks were stored kept only the guessed keys.
    const marks = stored.marks ?? Object.fromEntries((stored.guessed ?? []).map((key) => [key, "check"]));
    return { values: stored.values, marks };
  });
}

/** Stores the edits for one page without touching other pages' drafts. */
export function saveDraft(pageUrl: string, draft: SavedDraft, now = Date.now()): Promise<void> {
  return enqueue(async () => {
    const drafts = { ...(await draftsItem.getValue()), [pageUrl]: { ...draft, updatedAt: now } };
    const kept = Object.entries(drafts)
      .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_DRAFTS);
    await draftsItem.setValue(Object.fromEntries(kept));
  });
}

let pending: { pageUrl: string; draft: SavedDraft; timer: ReturnType<typeof setTimeout> } | null = null;

/** Writes the latest edits DRAFT_SAVE_DELAY_MS after the last change (one write per pause). */
export function scheduleDraftSave(pageUrl: string, draft: SavedDraft): void {
  if (pending && pending.pageUrl !== pageUrl) void flushDraftSave();
  if (pending) clearTimeout(pending.timer);
  pending = { pageUrl, draft, timer: setTimeout(() => void flushDraftSave(), DRAFT_SAVE_DELAY_MS) };
}

/** Writes a scheduled draft right away (the popup is closing or unmounting). */
export function flushDraftSave(): Promise<void> {
  if (!pending) return enqueue(async () => undefined);
  const { pageUrl, draft, timer } = pending;
  clearTimeout(timer);
  pending = null;
  return saveDraft(pageUrl, draft);
}

/** Forgets one page's draft (after it was saved), including a write still waiting to run. */
export function removeDraft(pageUrl: string): Promise<void> {
  if (pending?.pageUrl === pageUrl) {
    clearTimeout(pending.timer);
    pending = null;
  }
  return enqueue(async () => {
    const { [pageUrl]: _removed, ...rest } = await draftsItem.getValue();
    await draftsItem.setValue(rest);
  });
}
