/**
 * Runtime messages between the page watcher, the background worker and the
 * side panel. No imports: wxt.config.ts reads OPEN_PANEL_COMMAND.
 */

/** Manifest command (Alt+Shift+J by default) that opens the side panel on the current tab. */
export const OPEN_PANEL_COMMAND = "open-panel";

/** The watched tab's URL changed without a page load (split views, history.pushState). */
export const URL_CHANGED = "jobtrack:url-changed";
/** The background got access to a tab (shortcut or menu click); an open panel should read it again. */
export const PANEL_REFRESH = "jobtrack:panel-refresh";

export type PanelMessage =
  { type: typeof URL_CHANGED; url: string } | { type: typeof PANEL_REFRESH; tabId: number };

export function isPanelMessage(message: unknown): message is PanelMessage {
  if (typeof message !== "object" || message === null) return false;
  const type = (message as { type?: unknown }).type;
  return type === URL_CHANGED || type === PANEL_REFRESH;
}
