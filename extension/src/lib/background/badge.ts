import { browser } from "wxt/browser";
import { jobRefFor } from "../extract/sites/registry";

const BADGE_TEXT = "JOB";
const BADGE_COLOR = "#126d50"; // --color-brand

/** Shows "JOB" on the toolbar button for a tab whose URL is a job posting (or a selected job in a list). */
async function updateBadge(tabId: number, url: string | undefined): Promise<void> {
  const text = url && jobRefFor(url) ? BADGE_TEXT : "";
  await browser.action.setBadgeText({ tabId, text }).catch(() => undefined);
}

async function updateAllBadges(): Promise<void> {
  const tabs = await browser.tabs.query({});
  await Promise.all(tabs.map((tab) => (tab.id === undefined ? null : updateBadge(tab.id, tab.url))));
}

/**
 * Keeps the badge in step with tab URLs. Chrome only shares a tab's URL when
 * the extension has host access to it, so the badge appears once the user
 * turned on auto-detect (the optional job-site permissions); with activeTab
 * alone there is no badge.
 */
export function registerBadge(): void {
  void browser.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url !== undefined) void updateBadge(tabId, changeInfo.url);
  });
  browser.permissions.onAdded.addListener(() => void updateAllBadges());
  browser.permissions.onRemoved.addListener(() => void updateAllBadges());
  browser.runtime.onStartup.addListener(() => void updateAllBadges());
  browser.runtime.onInstalled.addListener(() => void updateAllBadges());
}
