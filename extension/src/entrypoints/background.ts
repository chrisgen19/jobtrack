import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";
import { registerBadge } from "@/lib/background/badge";
import { registerPanelTriggers } from "@/lib/background/panel-triggers";
import { handleConnectMessage } from "@/lib/connect";

export default defineBackground(() => {
  // The JobTrack connect page hands over the token here (externally_connectable).
  browser.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    (async () => {
      sendResponse(await handleConnectMessage(message, sender.origin));
    })();
    return true;
  });
  // No runtime.onMessage listener here on purpose: the page URL watcher stops
  // once nothing receives its messages, i.e. when no side panel is open.
  registerPanelTriggers();
  registerBadge();
});
