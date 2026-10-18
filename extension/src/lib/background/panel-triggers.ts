import { browser } from "wxt/browser";
import { OPEN_PANEL_COMMAND, PANEL_REFRESH, type PanelMessage } from "../messages";
import { pendingSelectionItem } from "../storage";

const SAVE_PAGE_MENU = "save-page";
const USE_SELECTION_MENU = "use-selection";

/**
 * Opens the side panel for a tab. Must run before any `await` in the event
 * handler: Chrome only allows sidePanel.open() while the click or key press
 * still counts as a user gesture. The same gesture grants activeTab, so an
 * already-open panel is told to read the tab again.
 */
function openPanel(tabId: number): void {
  void browser.sidePanel.open({ tabId }).catch(() => undefined);
  const message: PanelMessage = { type: PANEL_REFRESH, tabId };
  // Rejects when no panel is open yet; the panel reads the tab when it loads.
  void browser.runtime.sendMessage(message).catch(() => undefined);
}

function createMenus(): void {
  const documentUrlPatterns = ["https://*/*", "http://*/*"];
  void browser.contextMenus.removeAll().then(() => {
    browser.contextMenus.create({
      id: SAVE_PAGE_MENU,
      title: "Save job to JobTrack",
      contexts: ["page", "selection"],
      documentUrlPatterns,
    });
    browser.contextMenus.create({
      id: USE_SELECTION_MENU,
      title: "Use selection as job description",
      contexts: ["selection"],
      documentUrlPatterns,
    });
  });
}

/** Context menu items and the Alt+Shift+J command, both opening the review side panel. */
export function registerPanelTriggers(): void {
  browser.runtime.onInstalled.addListener(createMenus);

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (tab?.id === undefined || tab.id < 0) return;
    openPanel(tab.id);
    if (info.menuItemId === USE_SELECTION_MENU && info.selectionText) {
      void pendingSelectionItem.setValue({ tabId: tab.id, text: info.selectionText, at: Date.now() });
    }
  });

  browser.commands.onCommand.addListener((command, tab) => {
    if (command === OPEN_PANEL_COMMAND && tab?.id !== undefined && tab.id >= 0) openPanel(tab.id);
  });
}
