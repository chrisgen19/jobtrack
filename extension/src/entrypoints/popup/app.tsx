import { useCallback, useRef } from "react";
import { PanelRight } from "lucide-react";
import { browser } from "wxt/browser";
import { Button } from "@/components/fields";
import { ReviewApp } from "@/components/review-app";
import { loadReview } from "@/lib/load-review";
import { PANEL_REFRESH, type PanelMessage } from "@/lib/messages";
import { getActiveTab } from "@/lib/read-page";

/**
 * Moves the review to the side panel, which stays open while browsing. Must
 * run before any `await` in the click handler: Chrome only allows
 * sidePanel.open() during a user gesture. Opening the popup granted
 * activeTab, so an already-open panel is told to read the tab again.
 */
function openSidePanel(tabId: number): void {
  const opened = browser.sidePanel.open({ tabId }).catch(() => undefined);
  const message: PanelMessage = { type: PANEL_REFRESH, tabId };
  // Rejects when no panel is open yet; the panel reads the tab when it loads.
  const sent = browser.runtime.sendMessage(message).catch(() => undefined);
  void Promise.all([opened, sent]).then(() => window.close());
}

export function App() {
  // Known before the button shows (it needs the form), so the click can open the panel right away.
  const tabId = useRef<number | null>(null);
  const load = useCallback(async () => {
    const tab = await getActiveTab();
    tabId.current = tab?.id ?? null;
    return loadReview(tab);
  }, []);
  const onOpenPanel = () => {
    if (tabId.current !== null) openSidePanel(tabId.current);
    else window.close();
  };
  return (
    <ReviewApp
      mode="popup"
      load={load}
      reloadSignal={1}
      onClose={() => window.close()}
      headerActions={
        <Button
          variant="ghost"
          className="px-1.5 py-1"
          title="Open in side panel"
          aria-label="Open in side panel"
          onClick={onOpenPanel}
        >
          <PanelRight className="size-4" aria-hidden />
        </Button>
      }
    />
  );
}
