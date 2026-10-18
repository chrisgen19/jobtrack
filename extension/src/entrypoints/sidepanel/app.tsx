import { useCallback } from "react";
import { ReviewApp, type AppView } from "@/components/review-app";
import { loadReview } from "@/lib/load-review";
import { usePanelTab } from "@/lib/use-panel-tab";

/**
 * Side panel: the review form for the active tab, following tab switches and
 * job clicks in split views (LinkedIn, JobStreet, Indeed search pages).
 */
export function App() {
  const { tab, signal } = usePanelTab();
  const load = useCallback(
    (current: AppView) =>
      loadReview(tab ?? null, {
        watch: true,
        // Same tab, new job: lets the loader wait for a split view's details pane to catch up.
        previous: current.kind === "form" && current.tabId === tab?.id ? current : undefined,
      }),
    [tab],
  );
  return <ReviewApp mode="panel" load={load} reloadSignal={tab === undefined ? 0 : signal} />;
}
