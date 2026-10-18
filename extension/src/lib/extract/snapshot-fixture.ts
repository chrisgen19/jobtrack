import type { PageSnapshot } from "./snapshot";

/** A PageSnapshot for tests: empty except for the overrides. */
export function snapshotOf(overrides: Partial<PageSnapshot>): PageSnapshot {
  return {
    url: "https://example.com/job",
    canonicalUrl: null,
    title: "",
    h1: null,
    meta: {},
    jsonLd: [],
    selection: "",
    text: {},
    html: {},
    links: {},
    labelled: {},
    scripts: {},
    mainHtml: "",
    ...overrides,
  };
}
