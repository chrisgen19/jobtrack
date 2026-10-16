import { browser } from "wxt/browser";
import { collectPageSnapshot, type PageSnapshot } from "./extract/snapshot";

/**
 * Reads the active tab. Works through activeTab, which Chrome grants when the
 * user opens the popup; browser pages (chrome://, the Web Store) refuse
 * scripting, so this returns null there and the form starts empty.
 */
export async function readActivePage(): Promise<PageSnapshot | null> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) return null;
  try {
    const [injection] = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: collectPageSnapshot,
    });
    return injection?.result ?? null;
  } catch {
    return null;
  }
}
