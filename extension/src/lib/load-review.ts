import type { ExtensionMe } from "@jobtrack/shared/extension-api";
import { ApiError, getMe } from "./api";
import { emptyDraft, type DraftValues, type PageStatus } from "./draft";
import { buildDraft, type BuiltDraft } from "./extract/build-draft";
import { readTab, type TabRef } from "./read-page";
import { loadDraft } from "./drafts";
import { tokenItem } from "./storage";

/** Split views update the job details a moment after the URL; re-read this often while they show the old job. */
const STALE_RETRY_MS = 500;
const STALE_RETRIES = 3;

export type ReviewView =
  | { kind: "loading" }
  | { kind: "connect"; notice?: string }
  | {
      kind: "form";
      me: ExtensionMe;
      tabId: number | null;
      initial: DraftValues;
      /** The title read from the page, before a saved draft's edits; null when unreadable. */
      pageTitle: string | null;
      /** Draft key: the job's own link in list views, else the page URL. */
      pageUrl: string | null;
      status: PageStatus;
      guessed: (keyof DraftValues)[];
    }
  | { kind: "error"; message: string };

export type FormView = Extract<ReviewView, { kind: "form" }>;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type LoadOptions = {
  /** Install the URL watcher in the page (side panel). */
  watch?: boolean;
  /**
   * The job shown before a split-view click: while the page still shows that
   * job's title under a new URL, the details pane hasn't caught up, so the
   * page is read again a few times.
   */
  previous?: FormView;
};

/**
 * Whether a read still shows the previous job under a new job's URL (a split
 * view's details pane lags behind the URL). Compares the titles read from the
 * page: the form's title may hold edits restored from a saved draft.
 */
export function isStaleRead(
  read: { pageKey: string; title: string } | null,
  previous: Pick<FormView, "pageUrl" | "pageTitle"> | undefined,
): boolean {
  if (!read || !previous || previous.pageTitle === null) return false;
  return read.pageKey !== previous.pageUrl && read.title === previous.pageTitle;
}

/** Reads a tab and builds its draft. */
async function readDraft(tab: TabRef | null, { watch, previous }: LoadOptions): Promise<BuiltDraft | null> {
  if (!tab) return null;
  for (let attempt = 0; ; attempt++) {
    const page = await readTab(tab, { watch });
    const built = page ? buildDraft(page.snapshot, page.main) : null;
    const stale = isStaleRead(built && { pageKey: built.pageKey, title: built.draft.title }, previous);
    if (!stale || attempt >= STALE_RETRIES) return built;
    await wait(STALE_RETRY_MS);
  }
}

/**
 * What the popup or side panel shows: the connect screen without a token,
 * else the review form prefilled from the tab (or the unsaved edits made on
 * that job earlier in this browser session).
 */
export async function loadReview(tab: TabRef | null, options: LoadOptions = {}): Promise<ReviewView> {
  if (!(await tokenItem.getValue())) return { kind: "connect" };
  try {
    const [me, built] = await Promise.all([getMe(), readDraft(tab, options)]);
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
      tabId: tab?.id ?? null,
      pageUrl,
      initial: saved ? { ...defaults, ...saved.values } : defaults,
      pageTitle: built?.draft.title ?? null,
      status: built?.status ?? "unreadable",
      // A draft keeps flagging only the prefilled fields the user hasn't edited.
      guessed: saved ? saved.guessed : (built?.guessed ?? []),
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return { kind: "connect", notice: error.message };
    return { kind: "error", message: error instanceof Error ? error.message : "Something went wrong." };
  }
}
