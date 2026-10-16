import { CheckCircle2, Link2 } from "lucide-react";
import { browser } from "wxt/browser";
import type { ExtensionSaveResult } from "@jobtrack/shared/extension-api";
import { startConnect } from "@/lib/connect";
import { Button, Notice } from "./fields";

export function ConnectView({ notice }: { notice?: string }) {
  async function connect() {
    await startConnect();
    window.close();
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

export function SavedView({ result, title }: { result: ExtensionSaveResult; title: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
      <CheckCircle2 className="size-9 text-brand" aria-hidden />
      <h1 className="text-[15px] font-bold text-heading">Saved to JobTrack</h1>
      <p className="text-xs leading-relaxed text-subtle">
        &ldquo;{title}&rdquo; is in your jobs{result.applicationId ? " with your application recorded" : ""}.
      </p>
      <div className="flex gap-2">
        <Button onClick={() => browser.tabs.create({ url: result.url })}>Open in JobTrack</Button>
        <Button variant="outline" onClick={() => window.close()}>
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
