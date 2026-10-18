import type { SiteAdapter } from "./adapter";
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
