import { emptyDraft, type DraftValues } from "../draft";
import { draftFromJobPosting, findJobPosting } from "./json-ld";
import type { PageSnapshot } from "./snapshot";
import { isJobBoard, sourceFromUrl } from "./source";
import { oneLine } from "./text";

/** Selections shorter than this are treated as accidental. */
const MIN_SELECTION_CHARS = 40;

/** Removes a trailing " | Site" or " - Site" from a page title. */
function stripSiteSuffix(title: string, siteName: string): string {
  const parts = title.split(/\s+[|\-–—]\s+/);
  if (parts.length < 2) return title;
  const last = parts[parts.length - 1]!.toLowerCase();
  return siteName && last.includes(siteName.toLowerCase()) ? parts.slice(0, -1).join(" - ") : title;
}

const httpUrl = (value: string | null | undefined): string =>
  value && /^https?:\/\//.test(value) ? value.slice(0, 2048) : "";

/**
 * Review-form values from a page: schema.org JobPosting first, then meta
 * tags and the page title, then the user's text selection as description.
 * Everything stays editable before saving.
 */
export function buildDraft(snapshot: PageSnapshot): { draft: DraftValues; foundJobPosting: boolean } {
  const posting = findJobPosting(snapshot.jsonLd);
  const fromPosting = posting ? draftFromJobPosting(posting) : {};
  const siteName = oneLine(snapshot.meta["og:site_name"] ?? "");
  const pageUrl = httpUrl(snapshot.canonicalUrl) || httpUrl(snapshot.url);
  const selection = snapshot.selection.trim();
  const fallbackTitle = stripSiteSuffix(
    oneLine(snapshot.meta["og:title"] ?? snapshot.h1 ?? snapshot.title),
    siteName,
  );
  const fallbackDescription = oneLine(snapshot.meta["og:description"] ?? snapshot.meta.description ?? "");

  const draft: DraftValues = {
    ...emptyDraft(),
    ...fromPosting,
    title: fromPosting.title || fallbackTitle.slice(0, 160),
    companyName: fromPosting.companyName || (isJobBoard(snapshot.url) ? "" : siteName.slice(0, 120)),
    postingUrl: pageUrl || fromPosting.postingUrl || "",
    source: sourceFromUrl(snapshot.url),
    description: (selection.length >= MIN_SELECTION_CHARS
      ? selection
      : fromPosting.description || fallbackDescription
    ).slice(0, 20_000),
  };
  return { draft, foundJobPosting: posting !== null };
}
