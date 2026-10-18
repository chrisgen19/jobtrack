import { useEffect, useRef, useState } from "react";
import { browser } from "wxt/browser";
import { pageKeyFor } from "./extract/sites/registry";
import { isPanelMessage, PANEL_REFRESH, URL_CHANGED } from "./messages";
import { getActiveTab, type TabRef } from "./read-page";

/** Events often come in pairs (tabs.onUpdated and the page watcher); wait for the burst to end. */
const SETTLE_MS = 400;

export type PanelTab = {
  /** The active tab of the panel's window; undefined until known. */
  tab: TabRef | null | undefined;
  /** Increases whenever the tab or the job it shows changed, or the tab became readable. */
  signal: number;
};

type Shown = { tabId: number | null; key: string | null };

/**
 * Whether the panel should read again: another tab, or another job in the same
 * tab. An unknown URL (no access to the tab) always counts, since the job
 * can't be compared.
 */
export function showsNewJob(before: Shown, after: Shown): boolean {
  return after.tabId !== before.tabId || after.key === null || after.key !== before.key;
}

/**
 * Follows the active tab of the side panel's window. A URL change only
 * counts when it changes the job (pageKeyFor): LinkedIn adding tracking
 * parameters doesn't reload the form, clicking another job in a split view
 * does. PANEL_REFRESH (shortcut or menu click on this tab) always counts.
 */
export function usePanelTab(): PanelTab {
  const [state, setState] = useState<PanelTab>({ tab: undefined, signal: 0 });
  const current = useRef<{ windowId?: number; tab: TabRef | null; key: string | null }>({
    tab: null,
    key: null,
  });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    let active = true;
    const show = (tab: TabRef | null, force: boolean) => {
      const key = tab?.url ? pageKeyFor(tab.url) : null;
      const before = { tabId: current.current.tab?.id ?? null, key: current.current.key };
      current.current = { ...current.current, tab, key };
      if (!force && !showsNewJob(before, { tabId: tab?.id ?? null, key })) return;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (active) setState((previous) => ({ tab: current.current.tab, signal: previous.signal + 1 }));
      }, SETTLE_MS);
    };
    const refreshTab = async (tabId: number, force: boolean) => {
      const tab = await browser.tabs.get(tabId).catch(() => null);
      if (tab?.id !== undefined) show({ id: tab.id, url: tab.url }, force);
    };

    const onActivated = ({ tabId, windowId }: { tabId: number; windowId: number }) => {
      if (windowId === current.current.windowId) void refreshTab(tabId, true);
    };
    const onUpdated = (tabId: number, changeInfo: { url?: string; status?: string }) => {
      if (tabId !== current.current.tab?.id) return;
      if (changeInfo.url !== undefined || changeInfo.status === "complete") void refreshTab(tabId, false);
    };
    const onMessage = (message: unknown, sender: { tab?: { id?: number } }) => {
      if (!isPanelMessage(message)) return;
      const tabId = current.current.tab?.id;
      if (message.type === PANEL_REFRESH && message.tabId === tabId) void refreshTab(tabId, true);
      if (message.type === URL_CHANGED && sender.tab?.id === tabId && tabId !== undefined) {
        show({ id: tabId, url: message.url }, false);
      }
    };

    (async () => {
      const window = await browser.windows.getCurrent();
      const tab = await getActiveTab(window.id);
      if (!active) return;
      current.current = { windowId: window.id, tab, key: tab?.url ? pageKeyFor(tab.url) : null };
      setState({ tab, signal: 1 });
    })();
    browser.tabs.onActivated.addListener(onActivated);
    browser.tabs.onUpdated.addListener(onUpdated);
    browser.runtime.onMessage.addListener(onMessage);
    return () => {
      active = false;
      clearTimeout(timer.current);
      browser.tabs.onActivated.removeListener(onActivated);
      browser.tabs.onUpdated.removeListener(onUpdated);
      browser.runtime.onMessage.removeListener(onMessage);
    };
  }, []);

  return state;
}
