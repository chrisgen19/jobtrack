import { emptyDraft, type DraftValues } from "../draft";
import { draftFromJobPosting, findJobPosting, postingMentions } from "./json-ld";
import { mergeLayers } from "./merge";
import { findSalaryInText } from "./parse/salary";
import { arrangementFromLabel, arrangementFromText, employmentFromLabel } from "./parse/work";
import { salaryFields, type JobRef } from "./sites/adapter";
import { adapterFor, jobLinkFor, pageKeyFor } from "./sites/registry";
import type { PageSnapshot } from "./snapshot";
import { isJobBoard, sourceFromUrl } from "./source";
import { htmlToText, oneLine } from "./text";
import type { Layer } from "./types";

/** Selections shorter than this are treated as accidental. */
const MIN_SELECTION_CHARS = 40;
/** Generic page text shorter than this is not used as the description. */
const MIN_MAIN_TEXT_CHARS = 200;

/** Removes a trailing " | Site" or " - Site" from a page title. */
function stripSiteSuffix(title: string, siteName: string): string {
  const parts = title.split(/\s+[|\-–—]\s+/);
  if (parts.length < 2) return title;
  const last = parts[parts.length - 1]!.toLowerCase();
  return siteName && last.includes(siteName.toLowerCase()) ? parts.slice(0, -1).join(" - ") : title;
}

const httpUrl = (value: string | null | undefined): string =>
  value && /^https?:\/\//.test(value) ? value.slice(0, 2048) : "";

const parseUrl = (value: string): URL | null => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

/** Title, company and description from the page itself: meta tags, title, the main text block. */
function pageLayer(snapshot: PageSnapshot): Layer {
  const siteName = oneLine(snapshot.meta["og:site_name"] ?? "");
  const company = isJobBoard(snapshot.url) ? "" : siteName.slice(0, 120);
  const mainText = htmlToText(snapshot.mainHtml);
  return {
    source: "page",
    values: {
      title: stripSiteSuffix(
        oneLine(snapshot.meta["og:title"] ?? snapshot.h1 ?? snapshot.title),
        siteName,
      ).slice(0, 160),
      companyName: company,
      description:
        mainText.length >= MIN_MAIN_TEXT_CHARS
          ? mainText
          : oneLine(snapshot.meta["og:description"] ?? snapshot.meta.description ?? ""),
    },
    guessed: company ? ["companyName"] : [],
  };
}

/** The first email address in a description that looks like a person to contact (not a no-reply box). */
function contactEmailIn(text: string): string {
  const emails = text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? [];
  const email = emails.find((item) => !/^(?:no-?reply|donotreply|privacy|support)@/i.test(item));
  return email?.slice(0, 254) ?? "";
}

/** Pay, work setup, type and a contact email implied by the text read so far (all guesses). */
function textLayer(values: Partial<DraftValues>, host: string): Layer {
  const out: Partial<DraftValues> = {};
  if (!values.salaryMin && !values.salaryMax) {
    Object.assign(out, salaryFields(findSalaryInText(values.description ?? "", { host })).values);
  }
  if (!values.contactEmail) out.contactEmail = contactEmailIn(values.description ?? "");
  if (!values.workArrangement) {
    out.workArrangement =
      arrangementFromLabel(values.location ?? "") || arrangementFromText(values.description ?? "");
  }
  if (!values.employmentType) out.employmentType = employmentFromLabel(values.title ?? "");
  return { source: "text", values: out, guessed: Object.keys(out) as (keyof DraftValues)[] };
}

/**
 * Page-level values and defaults on top of the merged layers: the posting
 * link, source, a meaningful selection as the description, the contact
 * switch and the application method (used only if the job is marked applied).
 */
function finishDraft(draft: DraftValues, snapshot: PageSnapshot): DraftValues {
  const url = parseUrl(snapshot.url);
  // Some sites still declare an http:// canonical link on https pages.
  const canonical =
    url?.protocol === "https:"
      ? snapshot.canonicalUrl?.replace(/^http:\/\//, "https://")
      : snapshot.canonicalUrl;
  const pageUrl = jobLinkFor(snapshot.url) || httpUrl(canonical) || httpUrl(snapshot.url);
  const selection = snapshot.selection.trim();
  return {
    ...draft,
    postingUrl: pageUrl || draft.postingUrl,
    source: sourceFromUrl(snapshot.url),
    title: draft.title.slice(0, 160),
    companyName: draft.companyName.slice(0, 120),
    location: draft.location.slice(0, 120),
    description: (selection.length >= MIN_SELECTION_CHARS ? selection : draft.description).slice(0, 20_000),
    saveContact: draft.contactName !== "",
    method: draft.method || (isJobBoard(snapshot.url) ? "JOB_BOARD" : "COMPANY_WEBSITE"),
  };
}

export type BuiltDraft = {
  draft: DraftValues;
  /** Fields that were inferred; the form asks the user to check them. */
  guessed: (keyof DraftValues)[];
  /** "found" when the title and company came from the site's own data or JSON-LD. */
  status: "found" | "partial";
  /** Key for this job's unsaved draft: the job's own link in list views, else the page URL. */
  pageKey: string;
};

/**
 * Review-form values for a page. Sources, most trusted first: the site
 * adapter (page state or known elements), JSON-LD JobPosting, the page's
 * meta tags and main text, then guesses from that text. A text selection
 * replaces the description. Everything stays editable before saving.
 */
export function buildDraft(snapshot: PageSnapshot, main: unknown = null): BuiltDraft {
  const url = parseUrl(snapshot.url);
  const adapter = adapterFor(snapshot.url);
  const job: JobRef | null = (url && adapter?.jobRef?.(url)) || null;
  const posting = findJobPosting(snapshot.jsonLd);
  const trustPosting = posting && (!job?.inList || postingMentions(posting, job.id));

  const layers: Layer[] = [];
  if (adapter && url) layers.push(adapter.extract({ url, job, snapshot, main }));
  if (posting && trustPosting) {
    const values = draftFromJobPosting(posting);
    layers.push({ source: "json-ld", values, guessed: values.deadline ? ["deadline"] : [] });
  }
  // In a search page's split view the page title and meta describe the search, not the job.
  if (!job?.inList) layers.push(pageLayer(snapshot));
  const base = mergeLayers(layers);
  const merged = mergeLayers([...layers, textLayer(base.values, url?.hostname ?? "")]);

  const draft = finishDraft({ ...emptyDraft(), ...merged.values }, snapshot);
  const trusted = (key: "title" | "companyName") => ["site", "json-ld"].includes(merged.sources[key] ?? "");
  return {
    draft,
    guessed: merged.guessed,
    status: trusted("title") && trusted("companyName") ? "found" : "partial",
    pageKey: pageKeyFor(snapshot.url),
  };
}
