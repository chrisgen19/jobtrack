import type { DomPlan } from "./types";

/** Raw data read from the job page; parsed into a draft by buildDraft(). */
export type PageSnapshot = {
  url: string;
  canonicalUrl: string | null;
  title: string;
  h1: string | null;
  meta: Record<string, string>;
  jsonLd: string[];
  selection: string;
  /** DomPlan.text results: every match's text per name. */
  text: Record<string, string[]>;
  /** DomPlan.html results: the first match's HTML per name. */
  html: Record<string, string>;
  /** DomPlan.links results: the first match's http(s) href per name. */
  links: Record<string, string>;
  /** DomPlan.labels results: label (as given) -> value text. */
  labelled: Record<string, string>;
  /** DomPlan.scriptIds results: id -> script text. */
  scripts: Record<string, string>;
  /** HTML of the block that most looks like the job description, or "". */
  mainHtml: string;
};

/**
 * Runs inside the job page through scripting.executeScript. Chrome serializes
 * the function, so it must stay self-contained (no imports or outer
 * variables, which is why the helpers are inner functions). Site selectors
 * arrive as plain data in `plan`.
 */
export function collectPageSnapshot(plan: DomPlan): PageSnapshot {
  const clean = (value: string | null | undefined, max: number) =>
    (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

  function readMeta(): Record<string, string> {
    const wanted = ["og:title", "og:site_name", "og:url", "og:description", "description"];
    const meta: Record<string, string> = {};
    for (const element of document.querySelectorAll<HTMLMetaElement>("meta[property], meta[name]")) {
      const key = (element.getAttribute("property") ?? element.getAttribute("name") ?? "").toLowerCase();
      if (wanted.includes(key) && element.content && !(key in meta))
        meta[key] = element.content.slice(0, 2_000);
    }
    return meta;
  }

  function readSelectors<T>(selectors: Record<string, string> | undefined, read: (selector: string) => T) {
    const output: Record<string, T> = {};
    for (const [name, selector] of Object.entries(selectors ?? {})) {
      try {
        output[name] = read(selector);
      } catch {
        // An invalid selector reads as missing.
      }
    }
    return output;
  }

  // A label element (exact text, any case) followed by its value, e.g. <h3>TYPE OF WORK</h3><p>Full Time</p>.
  function readLabels(labels: string[]): Record<string, string> {
    const output: Record<string, string> = {};
    if (!labels.length) return output;
    const wanted = new Map(labels.map((label) => [label.toLowerCase(), label]));
    for (const element of document.querySelectorAll("h2, h3, h4, h5, dt, th, strong, b, span, p, div")) {
      if (element.children.length) continue;
      const label = wanted.get(clean(element.textContent, 80).toLowerCase());
      if (label && !(label in output)) output[label] = clean(element.nextElementSibling?.textContent, 300);
    }
    return output;
  }

  // Generic fallback: the description-like block with the most text that isn't links.
  function findMainHtml(): string {
    const groups = [
      '[itemprop="description"], [id*="description" i], [class*="description" i], [id*="job-details" i], [class*="job-details" i], [class*="jobdetails" i]',
      "article, main, [role='main']",
    ];
    for (const selector of groups) {
      let best: Element | null = null;
      let bestScore = 0;
      for (const element of document.querySelectorAll(selector)) {
        const length = (element.textContent ?? "").trim().length;
        if (length < 200) continue;
        let linkText = 0;
        for (const link of element.querySelectorAll("a")) linkText += (link.textContent ?? "").length;
        const score = length * (1 - Math.min(1, linkText / length));
        if (score > bestScore) [best, bestScore] = [element, score];
      }
      if (best) return best.innerHTML.slice(0, 100_000);
    }
    return "";
  }

  const scripts: Record<string, string> = {};
  for (const id of plan.scriptIds ?? []) {
    const script = document.getElementById(id);
    if (script?.tagName === "SCRIPT") scripts[id] = (script.textContent ?? "").slice(0, 1_000_000);
  }

  return {
    url: location.href,
    canonicalUrl: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? null,
    title: document.title.slice(0, 500),
    h1: clean(document.querySelector("h1")?.textContent, 300) || null,
    meta: readMeta(),
    jsonLd: Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
      .map((script) => (script.textContent ?? "").slice(0, 300_000))
      .filter(Boolean)
      .slice(0, 20),
    selection: String(window.getSelection() ?? "").slice(0, 20_000),
    text: readSelectors(plan.text, (selector) =>
      Array.from(document.querySelectorAll(selector))
        .slice(0, 20)
        .map((element) => clean(element.textContent, 2_000))
        .filter(Boolean),
    ),
    html: readSelectors(plan.html, (selector) =>
      (document.querySelector(selector)?.innerHTML ?? "").slice(0, 100_000),
    ),
    links: readSelectors(plan.links, (selector) => {
      const href = (document.querySelector(selector) as HTMLAnchorElement | null)?.href ?? "";
      return /^https?:\/\//.test(href) ? href.slice(0, 2_048) : "";
    }),
    labelled: readLabels(plan.labels ?? []),
    scripts,
    mainHtml: findMainHtml(),
  };
}
