/** Raw data read from the job page; parsed into a draft by buildDraft(). */
export type PageSnapshot = {
  url: string;
  canonicalUrl: string | null;
  title: string;
  h1: string | null;
  meta: Record<string, string>;
  jsonLd: string[];
  selection: string;
};

/**
 * Runs inside the job page through scripting.executeScript. Chrome serializes
 * the function, so it must stay self-contained: no imports or outer variables.
 */
export function collectPageSnapshot(): PageSnapshot {
  const wanted = ["og:title", "og:site_name", "og:url", "og:description", "description"];
  const meta: Record<string, string> = {};
  for (const element of document.querySelectorAll<HTMLMetaElement>("meta[property], meta[name]")) {
    const key = (element.getAttribute("property") ?? element.getAttribute("name") ?? "").toLowerCase();
    if (wanted.includes(key) && element.content && !(key in meta))
      meta[key] = element.content.slice(0, 2_000);
  }
  const jsonLd = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
    .map((script) => (script.textContent ?? "").slice(0, 300_000))
    .filter(Boolean)
    .slice(0, 20);
  return {
    url: location.href,
    canonicalUrl: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? null,
    title: document.title.slice(0, 500),
    h1: document.querySelector("h1")?.textContent?.trim().slice(0, 300) ?? null,
    meta,
    jsonLd,
    selection: String(window.getSelection() ?? "").slice(0, 20_000),
  };
}
