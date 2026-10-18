"use client";

import { CheckCircle2, Puzzle } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { EXTENSION_CONNECT_MESSAGE, type ExtensionConnectMessage } from "@jobtrack/shared/extension-api";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/features/auth/components/auth-card";
import { approveExtensionConnectAction, revokeExtensionTokenAction } from "../actions";

/** Only the piece of `chrome.runtime` a web page sees when an extension lists it as externally_connectable. */
type ExternalRuntime = { sendMessage: (extensionId: string, message: unknown) => Promise<unknown> };

const DELIVERY_TIMEOUT_MS = 5_000;

function extensionRuntime(): ExternalRuntime | null {
  const runtime = (globalThis as { chrome?: { runtime?: Partial<ExternalRuntime> } }).chrome?.runtime;
  return typeof runtime?.sendMessage === "function" ? (runtime as ExternalRuntime) : null;
}

/** Hands the token to the extension; resolves true when it confirmed it was stored. */
async function deliverToken(extensionId: string, message: ExtensionConnectMessage): Promise<boolean> {
  const runtime = extensionRuntime();
  if (!runtime) return false;
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), DELIVERY_TIMEOUT_MS));
  try {
    const reply = await Promise.race([runtime.sendMessage(extensionId, message), timeout]);
    return (reply as { ok?: unknown } | null)?.ok === true;
  } catch {
    return false;
  }
}

export function ConnectExtension({ ext, state }: { ext: string; state: string }) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  function approve() {
    setError(null);
    startTransition(async () => {
      const result = await approveExtensionConnectAction({ ext, state });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const delivered = await deliverToken(ext, {
        type: EXTENSION_CONNECT_MESSAGE,
        token: result.data.token,
        state,
      });
      if (delivered) {
        setStatus("done");
        return;
      }
      // Never leave a token behind that no extension received.
      await revokeExtensionTokenAction(result.data.tokenId);
      setError(
        "Couldn't reach the extension. Make sure it's installed and enabled, then click Connect in the extension again.",
      );
    });
  }

  if (status === "done") {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CheckCircle2 className="size-10 text-brand" aria-hidden />
        <h2 className="text-[15px] font-bold">Extension connected</h2>
        <p className="max-w-sm text-xs leading-relaxed text-[#91a096]">
          You can close this tab. Open the JobTrack extension on any job posting to save it here.
        </p>
        <Button asChild variant="outline">
          <Link href="/settings/extension">Manage connections</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? <FormAlert>{error}</FormAlert> : null}
      <div className="flex items-start gap-3">
        <span
          className="grid size-[37px] flex-none place-items-center rounded-[10px] bg-[#e6f0f9] text-[#568ab5]"
          aria-hidden
        >
          <Puzzle className="size-5" />
        </span>
        <div className="min-w-0 text-xs leading-relaxed">
          <p className="font-bold">The JobTrack browser extension is asking to connect to your account.</p>
          <p className="mt-1 text-[#91a096]">It will be able to:</p>
          <ul className="mt-1 list-disc pl-4 text-[#73827a]">
            <li>save jobs you review in the extension, with a contact and a to-do if you add them</li>
            <li>check whether you already saved a job</li>
            <li>read your name, email, default currency, follow-up days and pipeline stages</li>
          </ul>
          <p className="mt-2 text-[#91a096]">
            It can&apos;t read or change anything else. You can disconnect it any time in Settings.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={approve} disabled={pending}>
          {pending ? "Connecting..." : "Connect extension"}
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Cancel</Link>
        </Button>
      </div>
    </div>
  );
}
