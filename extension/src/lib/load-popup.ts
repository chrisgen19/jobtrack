import type { ExtensionMe } from "@jobtrack/shared/extension-api";
import { ApiError, getMe } from "./api";
import { emptyDraft, type DraftValues, type PageStatus } from "./draft";
import { buildDraft } from "./extract/build-draft";
import { readActivePage } from "./read-page";
import { loadDraft } from "./drafts";
import { tokenItem } from "./storage";

export type PopupView =
  | { kind: "loading" }
  | { kind: "connect"; notice?: string }
  | {
      kind: "form";
      me: ExtensionMe;
      initial: DraftValues;
      /** Draft key: the job's own link in list views, else the page URL. */
      pageUrl: string | null;
      status: PageStatus;
      guessed: (keyof DraftValues)[];
    }
  | { kind: "error"; message: string };

/**
 * Decides what the popup shows: the connect screen without a token, else
 * the review form prefilled from the active page (or the unsaved edits made
 * on that page earlier in this browser session).
 */
export async function loadPopup(): Promise<PopupView> {
  if (!(await tokenItem.getValue())) return { kind: "connect" };
  try {
    const [me, page] = await Promise.all([getMe(), readActivePage()]);
    const built = page ? buildDraft(page.snapshot, page.main) : null;
    const pageUrl = built?.pageKey ?? null;
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
      initial: saved ? { ...defaults, ...saved.values } : defaults,
      status: built?.status ?? "unreadable",
      // A draft keeps flagging only the prefilled fields the user hasn't edited.
      guessed: saved ? saved.guessed : (built?.guessed ?? []),
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return { kind: "connect", notice: error.message };
    return { kind: "error", message: error instanceof Error ? error.message : "Something went wrong." };
  }
}
