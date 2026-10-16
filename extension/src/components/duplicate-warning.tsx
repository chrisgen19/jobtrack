import { useEffect, useState } from "react";
import { browser } from "wxt/browser";
import type { ExtensionDuplicates } from "@jobtrack/shared/extension-api";
import { findDuplicates } from "@/lib/api";
import { Notice } from "./fields";

const DEBOUNCE_MS = 600;

/** Advisory "you may have saved this already" hint; saving is never blocked. */
export function DuplicateWarning({ url, title, company }: { url: string; title: string; company: string }) {
  const [candidates, setCandidates] = useState<ExtensionDuplicates["candidates"]>([]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const result = await findDuplicates({ url, title, company });
        if (!cancelled) setCandidates(result.candidates);
      } catch {
        if (!cancelled) setCandidates([]);
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [url, title, company]);

  if (candidates.length === 0) return null;
  return (
    <Notice tone="warning">
      <strong>You may have saved this already:</strong>
      <ul className="mt-1 flex flex-col gap-0.5">
        {candidates.map((candidate) => (
          <li key={candidate.id}>
            <button
              type="button"
              className="text-left underline underline-offset-2"
              onClick={() => browser.tabs.create({ url: candidate.url })}
            >
              {candidate.title} at {candidate.companyName}
            </button>{" "}
            (saved {candidate.savedOn}
            {candidate.reason === "url" ? ", same link" : ""})
          </li>
        ))}
      </ul>
    </Notice>
  );
}
