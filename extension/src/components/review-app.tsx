import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { ExtensionSaveResult } from "@jobtrack/shared/extension-api";
import { disconnect } from "@/lib/api";
import { flushDraftSave } from "@/lib/drafts";
import type { ReviewView } from "@/lib/load-review";
import { tokenItem } from "@/lib/storage";
import { usePendingSelection } from "@/lib/use-pending-selection";
import { AutoDetectToggle } from "./auto-detect";
import { Button } from "./fields";
import { Header } from "./header";
import { JobForm } from "./job-form";
import { ConnectView, ErrorView, NoAccessView, SavedView } from "./status-views";

export type AppView = ReviewView | { kind: "saved"; result: ExtensionSaveResult; title: string };

type Props = {
  mode: "popup" | "panel";
  /** Builds the next view; gets the current one (the side panel compares jobs across a split-view click). */
  load: (current: AppView) => Promise<ReviewView>;
  /** Changing it loads again (the side panel's tab or job changed). */
  reloadSignal: number;
  /** Extra header buttons, e.g. "Open side panel" in the popup. */
  headerActions?: ReactNode;
  /** Closes the popup; the panel stays open and shows the page again instead. */
  onClose?: () => void;
};

/** Connect screen, review form and saved screen, shared by the popup and the side panel. */
export function ReviewApp({ mode, load, reloadSignal, headerActions, onClose }: Props) {
  const [view, setView] = useState<AppView>({ kind: "loading" });
  const [manual, setManual] = useState(false);
  // Bumped to load again from here: retry, "Done" in the panel, token changes.
  const [localSignal, setLocalSignal] = useState(0);
  const reload = useCallback(() => setLocalSignal((value) => value + 1), []);
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    if (reloadSignal === 0) return;
    let active = true;
    (async () => {
      // Unsaved edits of the job on screen are written before its draft might be read back.
      await flushDraftSave();
      if (!active) return;
      const current = viewRef.current;
      setView({ kind: "loading" });
      setManual(false);
      const next = await load(current);
      if (active) setView(next);
    })();
    return () => {
      active = false;
    };
  }, [load, reloadSignal, localSignal]);

  // Connecting (token delivered in the background) or disconnecting elsewhere.
  useEffect(() => tokenItem.watch(reload), [reload]);

  const tabId = view.kind === "form" ? view.tabId : null;
  const selection = usePendingSelection(mode === "panel" ? tabId : null);

  async function signOut() {
    await disconnect();
    setView({ kind: "connect" });
  }
  const done = onClose ?? reload;

  return (
    <div className="flex min-h-[200px] flex-col">
      <Header
        action={
          view.kind === "form" ? (
            <>
              {headerActions}
              <Button variant="ghost" className="px-1.5 py-1 text-[11px]" onClick={signOut}>
                Disconnect
              </Button>
            </>
          ) : null
        }
      />
      {view.kind === "loading" ? (
        <p className="px-4 py-8 text-center text-xs text-subtle" role="status">
          Reading this page...
        </p>
      ) : null}
      {view.kind === "connect" ? (
        <ConnectView notice={view.notice} onStarted={onClose ?? (() => undefined)} />
      ) : null}
      {view.kind === "error" ? <ErrorView message={view.message} onRetry={reload} /> : null}
      {view.kind === "saved" ? <SavedView result={view.result} title={view.title} onDone={done} /> : null}
      {view.kind === "form" && mode === "panel" && view.status === "unreadable" && !manual ? (
        <NoAccessView onManual={() => setManual(true)} />
      ) : null}
      {view.kind === "form" && (mode === "popup" || view.status !== "unreadable" || manual) ? (
        <JobForm
          key={view.pageUrl ?? "no-page"}
          me={view.me}
          initial={view.initial}
          pageUrl={view.pageUrl}
          status={view.status}
          guessed={view.guessed}
          incomingDescription={selection.text}
          onIncomingApplied={selection.clear}
          onSaved={(result, title) => setView({ kind: "saved", result, title })}
          onUnauthorized={(notice) => setView({ kind: "connect", notice })}
        />
      ) : null}
      {view.kind === "form" ? <AutoDetectToggle /> : null}
    </div>
  );
}
