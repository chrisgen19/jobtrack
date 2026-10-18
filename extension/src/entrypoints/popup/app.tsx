import { useEffect, useState } from "react";
import type { ExtensionSaveResult } from "@jobtrack/shared/extension-api";
import { Button } from "@/components/fields";
import { Header } from "@/components/header";
import { JobForm } from "@/components/job-form";
import { ConnectView, ErrorView, SavedView } from "@/components/status-views";
import { disconnect } from "@/lib/api";
import { loadPopup, type PopupView } from "@/lib/load-popup";

type View = PopupView | { kind: "saved"; result: ExtensionSaveResult; title: string };

export function App() {
  const [view, setView] = useState<View>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    (async () => {
      const next = await loadPopup();
      if (active) setView(next);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function retry() {
    setView({ kind: "loading" });
    setView(await loadPopup());
  }

  async function signOut() {
    await disconnect();
    setView({ kind: "connect" });
  }

  return (
    <div className="flex min-h-[200px] flex-col">
      <Header
        action={
          view.kind === "form" ? (
            <Button variant="ghost" className="px-1.5 py-1 text-[11px]" onClick={signOut}>
              Disconnect
            </Button>
          ) : null
        }
      />
      {view.kind === "loading" ? (
        <p className="px-4 py-8 text-center text-xs text-subtle" role="status">
          Reading this page...
        </p>
      ) : null}
      {view.kind === "connect" ? <ConnectView notice={view.notice} /> : null}
      {view.kind === "error" ? <ErrorView message={view.message} onRetry={retry} /> : null}
      {view.kind === "saved" ? <SavedView result={view.result} title={view.title} /> : null}
      {view.kind === "form" ? (
        <JobForm
          me={view.me}
          initial={view.initial}
          pageUrl={view.pageUrl}
          status={view.status}
          guessed={view.guessed}
          onSaved={(result, title) => setView({ kind: "saved", result, title })}
          onUnauthorized={(notice) => setView({ kind: "connect", notice })}
        />
      ) : null}
    </div>
  );
}
