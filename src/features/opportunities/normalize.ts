/**
 * Normalizes a job posting URL for duplicate detection: lowercase host
 * without "www.", no query string, fragment or trailing slash.
 * Returns null for anything that is not an http(s) URL.
 */
export function normalizePostingUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const path = url.pathname.replace(/\/+$/, "");
    return `${host}${path}`.toLowerCase();
  } catch {
    return null;
  }
}

/** Lowercase, punctuation-free title for loose duplicate matching. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
