import type { DraftValues } from "../../draft";
import type { ParsedSalary } from "../parse/salary";
import type { PageSnapshot } from "../snapshot";
import type { DomPlan, Layer } from "../types";

/**
 * The job a page shows. `inList` is set when it is the selected job of a
 * search or list page (LinkedIn ?currentJobId=, JobStreet ?jobId=): the
 * page's title and meta tags then describe the search, and JSON-LD left in
 * the page can describe an earlier job.
 */
export type JobRef = { id: string; inList: boolean };

export type SiteInput = {
  url: URL;
  job: JobRef | null;
  snapshot: PageSnapshot;
  /** What `probe` returned (already JSON-parsed), or null. */
  main: unknown;
};

/** Extraction rules for one job site. Everything ships in the package (no remote config). */
export type SiteAdapter = {
  id: string;
  matches: (url: URL) => boolean;
  jobRef?: (url: URL) => JobRef | null;
  /** Link to the job itself, for pages that show it inside a search or list view. */
  postingUrl?: (url: URL, job: JobRef) => string;
  plan?: DomPlan;
  /**
   * Reads the page's own state (window globals) in the MAIN world. Chrome
   * serializes it, so it must be self-contained, and it returns a JSON string
   * of the job only (or null) so nothing else of the page crosses over.
   */
  probe?: (jobId: string | null) => string | null;
  extract: (input: SiteInput) => Layer;
};

export const hostIs = (url: URL, ...domains: string[]): boolean =>
  domains.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`));

/** First text the plan read under `name`, or "". */
export const firstText = (snapshot: PageSnapshot, name: string): string => snapshot.text[name]?.[0] ?? "";

/** Draft salary fields from a parsed salary; a guessed period is flagged. */
export function salaryFields(salary: ParsedSalary | null): Pick<Layer, "values" | "guessed"> {
  if (!salary) return { values: {}, guessed: [] };
  const values: Partial<DraftValues> = {
    salaryMin: salary.min,
    salaryMax: salary.max,
    currency: salary.currency,
    salaryPeriod: salary.period,
  };
  return { values, guessed: salary.periodGuessed ? ["salaryPeriod"] : [] };
}
