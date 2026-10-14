"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Workspace error boundary: never shows stack traces or internal messages. */
export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <span
        className="mb-4 grid size-12 place-items-center rounded-[14px] bg-[#fff4e7] text-[#9d7a45]"
        aria-hidden
      >
        <AlertTriangle className="size-5" />
      </span>
      <h1 className="text-xl font-bold tracking-[-0.5px]">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-sm text-subtle">
        Your data is safe. Try again, and if it keeps happening, share this reference with support:{" "}
        <code className="text-xs">{error.digest ?? "n/a"}</code>
      </p>
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
