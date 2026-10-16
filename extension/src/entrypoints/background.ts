import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";
import { handleConnectMessage } from "@/lib/connect";

export default defineBackground(() => {
  // The JobTrack connect page hands over the token here (externally_connectable).
  browser.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    (async () => {
      sendResponse(await handleConnectMessage(message, sender.origin));
    })();
    return true;
  });
});
