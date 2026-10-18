import { browser } from "wxt/browser";
import { parseJson } from "./extract/read";
import type { SiteAdapter } from "./extract/sites/adapter";
import { adapterFor } from "./extract/sites/registry";
import { collectPageSnapshot, type PageSnapshot } from "./extract/snapshot";

/** A probe that hangs (a busy page) is abandoned after this long; the DOM read still counts. */
const PROBE_TIMEOUT_MS = 1_500;

export type PageRead = { snapshot: PageSnapshot; main: unknown };

/** Runs the adapter's probe in the page's own JS world; null on any failure or timeout. */
async function runProbe(tabId: number, adapter: SiteAdapter, url: string): Promise<unknown> {
  const probe = adapter.probe;
  if (!probe) return null;
  let jobId: string | null = null;
  try {
    jobId = adapter.jobRef?.(new URL(url))?.id ?? null;
  } catch {
    // Unparsable URL: probe without a job ID.
  }
  const injection = browser.scripting
    .executeScript({ target: { tabId }, world: "MAIN", func: probe, args: [jobId] })
    .then(([result]) => (typeof result?.result === "string" ? parseJson(result.result) : null))
    .catch(() => null);
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), PROBE_TIMEOUT_MS));
  return Promise.race([injection, timeout]);
}

/**
 * Reads the active tab. Works through activeTab, which Chrome grants when the
 * user opens the popup; browser pages (chrome://, the Web Store) refuse
 * scripting, so this returns null there and the form starts empty. The DOM
 * read runs in the isolated world; a site's probe (its own page state) runs
 * in the page's world and returns only the job as JSON.
 */
export async function readActivePage(): Promise<PageRead | null> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) return null;
  const adapter = tab.url ? adapterFor(tab.url) : null;
  try {
    const [injections, main] = await Promise.all([
      browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: collectPageSnapshot,
        args: [adapter?.plan ?? {}],
      }),
      adapter && tab.url ? runProbe(tab.id, adapter, tab.url) : null,
    ]);
    const snapshot = injections[0]?.result;
    return snapshot ? { snapshot, main } : null;
  } catch {
    return null;
  }
}
