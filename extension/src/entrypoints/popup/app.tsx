import { useCallback } from "react";
import { PanelRight } from "lucide-react";
import { browser } from "wxt/browser";
import { Button } from "@/components/fields";
import { ReviewApp } from "@/components/review-app";
import { loadReview } from "@/lib/load-review";
import { getActiveTab } from "@/lib/read-page";

/** Moves the review to the side panel, which stays open while browsing (click = user gesture). */
async function openSidePanel() {
  const tab = await getActiveTab();
  if (tab) await browser.sidePanel.open({ tabId: tab.id }).catch(() => undefined);
  window.close();
}

export function App() {
  const load = useCallback(async () => loadReview(await getActiveTab()), []);
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
          onClick={openSidePanel}
        >
          <PanelRight className="size-4" aria-hidden />
        </Button>
      }
    />
  );
}
