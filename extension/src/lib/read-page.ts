import { browser } from "wxt/browser";
import { parseJson } from "./extract/read";
import type { SiteAdapter } from "./extract/sites/adapter";
import { adapterFor, jobRefFor } from "./extract/sites/registry";
import { collectPageSnapshot, type PageSnapshot } from "./extract/snapshot";
import { watchUrlChanges } from "./extract/watch-url";
import { URL_CHANGED } from "./messages";

/** A probe that hangs (a busy page) is abandoned after this long; the DOM read still counts. */
const PROBE_TIMEOUT_MS = 1_500;
/** How often the injected watcher checks the page URL. */
const WATCH_INTERVAL_MS = 750;

export type PageRead = { snapshot: PageSnapshot; main: unknown };
export type TabRef = { id: number; url?: string };

/** Runs the adapter's probe in the page's own JS world; null on any failure or timeout. */
async function runProbe(tab: TabRef, adapter: SiteAdapter): Promise<unknown> {
  const probe = adapter.probe;
  if (!probe) return null;
  const jobId = tab.url ? (jobRefFor(tab.url)?.id ?? null) : null;
  const injection = browser.scripting
    .executeScript({ target: { tabId: tab.id }, world: "MAIN", func: probe, args: [jobId] })
    .then(([result]) => (typeof result?.result === "string" ? parseJson(result.result) : null))
    .catch(() => null);
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), PROBE_TIMEOUT_MS));
  return Promise.race([injection, timeout]);
}

/** The active tab of a window (the popup's or the side panel's own window by default). */
export async function getActiveTab(windowId?: number): Promise<TabRef | null> {
  const [tab] = await browser.tabs.query(
    windowId === undefined ? { active: true, currentWindow: true } : { active: true, windowId },
  );
  return tab?.id === undefined ? null : { id: tab.id, url: tab.url };
}

/**
 * Reads a tab. Needs access to it: activeTab (granted by the toolbar button,
 * the context menu or the shortcut) or the optional job-site host
 * permissions. Without access, and on browser pages (chrome://, the Web
 * Store), it returns null. The DOM read runs in the isolated world; a site's
 * probe (its own page state) runs in the page's world and returns only the
 * job as JSON. `watch` also installs the URL watcher for the side panel.
 */
export async function readTab(tab: TabRef, { watch = false } = {}): Promise<PageRead | null> {
  const adapter = tab.url ? adapterFor(tab.url) : null;
  try {
    const [injections, main] = await Promise.all([
      browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: collectPageSnapshot,
        args: [adapter?.plan ?? {}],
      }),
      adapter ? runProbe(tab, adapter) : null,
    ]);
    const snapshot = injections[0]?.result;
    if (!snapshot) return null;
    if (watch) {
      void browser.scripting
        .executeScript({
          target: { tabId: tab.id },
          func: watchUrlChanges,
          args: [URL_CHANGED, WATCH_INTERVAL_MS],
        })
        .catch(() => undefined);
    }
    return { snapshot, main };
  } catch {
    return null;
  }
}

/**
 * The tab's current text selection with its line breaks (the context menu's
 * selectionText collapses them), or null without access.
 */
export async function readSelection(tabId: number): Promise<string | null> {
  try {
    const [injection] = await browser.scripting.executeScript({
      target: { tabId },
      func: () => String(window.getSelection() ?? ""),
    });
    return typeof injection?.result === "string" ? injection.result : null;
  } catch {
    return null;
  }
}
