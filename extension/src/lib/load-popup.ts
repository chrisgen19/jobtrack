import type { ExtensionMe } from "@jobtrack/shared/extension-api";
import { ApiError, getMe } from "./api";
import { emptyDraft, type DraftValues, type PageStatus } from "./draft";
import { buildDraft } from "./extract/build-draft";
import { readActivePage } from "./page";
import { loadDraft } from "./drafts";
import { tokenItem } from "./storage";

export type PopupView =
  | { kind: "loading" }
  | { kind: "connect"; notice?: string }
  | { kind: "form"; me: ExtensionMe; initial: DraftValues; pageUrl: string | null; status: PageStatus }
  | { kind: "error"; message: string };

/**
 * Decides what the popup shows: the connect screen without a token, else
 * the review form prefilled from the active page (or the unsaved edits made
 * on that page earlier in this browser session).
 */
export async function loadPopup(): Promise<PopupView> {
  if (!(await tokenItem.getValue())) return { kind: "connect" };
  try {
    const [me, snapshot] = await Promise.all([getMe(), readActivePage()]);
    const built = snapshot ? buildDraft(snapshot) : null;
    const pageUrl = snapshot?.url ?? null;
    const saved = pageUrl ? await loadDraft(pageUrl) : null;
    const defaults: DraftValues = {
      ...(built?.draft ?? emptyDraft()),
      appliedOn: me.today,
      stageId: me.stages[0]?.id ?? "",
    };
    return {
      kind: "form",
      me,
      pageUrl,
      initial: saved ?? defaults,
      status: !built ? "unreadable" : built.foundJobPosting ? "found" : "partial",
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return { kind: "connect", notice: error.message };
    return { kind: "error", message: error instanceof Error ? error.message : "Something went wrong." };
  }
}
