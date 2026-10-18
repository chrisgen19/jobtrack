import { useEffect, useState } from "react";
import { CheckCircle2, Keyboard, Link2 } from "lucide-react";
import { browser } from "wxt/browser";
import type { ExtensionSaveResult } from "@jobtrack/shared/extension-api";
import { OPEN_PANEL_COMMAND } from "@/lib/messages";
import { startConnect } from "@/lib/connect";
import { Button, Notice } from "./fields";

export function ConnectView({ notice, onStarted }: { notice?: string; onStarted: () => void }) {
  async function connect() {
    await startConnect();
    onStarted();
  }
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
      <Link2 className="size-9 text-brand" aria-hidden />
      <h1 className="text-[15px] font-bold text-heading">Connect to JobTrack</h1>
      <p className="text-xs leading-relaxed text-subtle">
        Save job postings from any site after reviewing the details. You&apos;ll approve the connection in
        JobTrack, and can disconnect it any time in Settings.
      </p>
      {notice ? <Notice tone="warning">{notice}</Notice> : null}
      <Button onClick={connect}>Connect to JobTrack</Button>
    </div>
  );
}

/** " with your application recorded, a contact and a to-do", for what the save added. */
function savedExtras(result: ExtensionSaveResult): string {
  const parts = [
    result.applicationId ? "your application recorded" : "",
    result.contactId ? "a contact" : "",
    result.taskId ? "a to-do" : "",
  ].filter(Boolean);
  if (!parts.length) return "";
  const last = parts.pop()!;
  return ` with ${parts.length ? `${parts.join(", ")} and ${last}` : last}`;
}

export function SavedView({
  result,
  title,
  onDone,
}: {
  result: ExtensionSaveResult;
  title: string;
  onDone: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
      <CheckCircle2 className="size-9 text-brand" aria-hidden />
      <h1 className="text-[15px] font-bold text-heading">Saved to JobTrack</h1>
      <p className="text-xs leading-relaxed text-subtle">
        &ldquo;{title}&rdquo; is in your jobs{savedExtras(result)}.
      </p>
      <div className="flex gap-2">
        <Button onClick={() => browser.tabs.create({ url: result.url })}>Open in JobTrack</Button>
        <Button variant="outline" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col gap-3 px-4 py-6">
      <Notice tone="error">{message}</Notice>
      <Button variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

/** The user's key for the "open-panel" command (they can change it at chrome://extensions/shortcuts). */
function useShortcut(): string {
  const [shortcut, setShortcut] = useState("");
  useEffect(() => {
    browser.commands
      .getAll()
      .then((commands) => setShortcut(commands.find((c) => c.name === OPEN_PANEL_COMMAND)?.shortcut ?? ""))
      .catch(() => undefined);
  }, []);
  return shortcut;
}

/**
 * Side panel on a tab the extension may not read yet: opening the panel by
 * itself grants no access, only the shortcut, the context menu or the
 * toolbar button do (or auto-detect on job sites).
 */
export function NoAccessView({ onManual }: { onManual: () => void }) {
  const shortcut = useShortcut();
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
      <Keyboard className="size-9 text-brand" aria-hidden />
      <h1 className="text-[15px] font-bold text-heading">Read this page</h1>
      <p className="text-xs leading-relaxed text-subtle">
        {shortcut ? (
          <>
            Press <kbd className="rounded border border-line bg-surface-2 px-1 font-sans">{shortcut}</kbd>, or
          </>
        ) : (
          "Set a shortcut at chrome://extensions/shortcuts, or"
        )}{" "}
        right-click the page and choose <strong>Save job to JobTrack</strong>. Browser pages and some sites
        can&apos;t be read at all.
      </p>
      <Button variant="outline" onClick={onManual}>
        Fill in the details myself
      </Button>
    </div>
  );
}
