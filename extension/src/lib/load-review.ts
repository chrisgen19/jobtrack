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
      /** Draft key: the job's own link in list views, else the page URL. */
      pageUrl: string | null;
      status: PageStatus;
      guessed: (keyof DraftValues)[];
    }
  | { kind: "error"; message: string };

export type FormView = Extract<ReviewView, { kind: "form" }>;

/** Servers older than contract v0.2 don't send followUpDays; JobTrack's own default. */
const DEFAULT_FOLLOW_UP_DAYS = 7;

/** A YYYY-MM-DD date plus whole days (calendar arithmetic, no timezone). */
export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

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

/** Reads a tab and builds its draft. */
async function readDraft(tab: TabRef | null, { watch, previous }: LoadOptions): Promise<BuiltDraft | null> {
  if (!tab) return null;
  for (let attempt = 0; ; attempt++) {
    const page = await readTab(tab, { watch });
    const built = page ? buildDraft(page.snapshot, page.main) : null;
    const stale =
      built && previous && built.pageKey !== previous.pageUrl && built.draft.title === previous.initial.title;
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
    const draft = built?.draft ?? emptyDraft();
    const defaults: DraftValues = {
      ...draft,
      appliedOn: me.today,
      stageId: me.stages[0]?.id ?? "",
      // Apply by the deadline when it's still ahead, else after the user's follow-up days.
      followUpDate:
        draft.deadline >= me.today
          ? draft.deadline
          : addDays(me.today, me.followUpDays ?? DEFAULT_FOLLOW_UP_DAYS),
    };
    return {
      kind: "form",
      me,
      tabId: tab?.id ?? null,
      pageUrl,
      initial: saved ? { ...defaults, ...saved } : defaults,
      status: built?.status ?? "unreadable",
      // An edited draft was reviewed already; only fresh prefills are flagged.
      guessed: saved ? [] : (built?.guessed ?? []),
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return { kind: "connect", notice: error.message };
    return { kind: "error", message: error instanceof Error ? error.message : "Something went wrong." };
  }
}
