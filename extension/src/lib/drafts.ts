import type { DraftValues } from "./draft";
import { draftsItem } from "./storage";

/** Unsaved drafts kept per browser session; the least recently edited go first. */
export const MAX_DRAFTS = 20;

/** The unsaved edits for a page, if any, so closing the popup by accident loses nothing. */
export async function loadDraft(pageUrl: string): Promise<DraftValues | null> {
  return (await draftsItem.getValue())[pageUrl]?.values ?? null;
}

/** Stores the edits for one page without touching other pages' drafts. */
export async function saveDraft(pageUrl: string, values: DraftValues, now = Date.now()): Promise<void> {
  const drafts = { ...(await draftsItem.getValue()), [pageUrl]: { values, updatedAt: now } };
  const kept = Object.entries(drafts)
    .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_DRAFTS);
  await draftsItem.setValue(Object.fromEntries(kept));
}

/** Forgets one page's draft (after it was saved). */
export async function removeDraft(pageUrl: string): Promise<void> {
  const { [pageUrl]: _removed, ...rest } = await draftsItem.getValue();
  await draftsItem.setValue(rest);
}
