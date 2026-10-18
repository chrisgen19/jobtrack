import type { JobRef, SiteAdapter } from "./adapter";
import { ashby } from "./ashby";
import { greenhouse } from "./greenhouse";
import { indeed } from "./indeed";
import { kalibrr } from "./kalibrr";
import { lever } from "./lever";
import { linkedin } from "./linkedin";
import { onlinejobs } from "./onlinejobs";
import { seek } from "./seek";
import { workday } from "./workday";

// Workable publishes complete JSON-LD (checked), so it needs no adapter;
// SmartRecruiters and every other site use JSON-LD and the generic reader.
export const SITE_ADAPTERS: SiteAdapter[] = [
  linkedin,
  seek,
  indeed,
  kalibrr,
  onlinejobs,
  greenhouse,
  ashby,
  lever,
  workday,
];

/** The adapter for a page URL, if any. */
export function adapterFor(url: string): SiteAdapter | null {
  try {
    const parsed = new URL(url);
    return SITE_ADAPTERS.find((adapter) => adapter.matches(parsed)) ?? null;
  } catch {
    return null;
  }
}

/** The job a URL shows, per its site adapter (null on search pages without a selected job). */
export function jobRefFor(url: string): JobRef | null {
  try {
    return adapterFor(url)?.jobRef?.(new URL(url)) ?? null;
  } catch {
    return null;
  }
}

/** The job's own link for list and split views (LinkedIn ?currentJobId=...), else "". */
export function jobLinkFor(url: string): string {
  const adapter = adapterFor(url);
  const job = jobRefFor(url);
  return adapter?.postingUrl && job ? adapter.postingUrl(new URL(url), job) : "";
}

/**
 * Key for a page's unsaved draft: the job's own link where there is one, so
 * clicking between jobs in a split view keeps one draft per job.
 */
export const pageKeyFor = (url: string): string => jobLinkFor(url) || url;
