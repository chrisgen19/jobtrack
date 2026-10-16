"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDateOnly } from "@/lib/dates";
import type { DuplicateCandidate } from "../data";

interface DuplicateWarningProps {
  title: string;
  companyName: string;
  postingUrl: string;
  excludeId?: string;
}

/**
 * Non-blocking hint when a similar job is already saved. Saving the same
 * role again (or reapplying) is still allowed.
 */
export function DuplicateWarning({ title, companyName, postingUrl, excludeId }: DuplicateWarningProps) {
  const [result, setResult] = useState<{ key: string; candidates: DuplicateCandidate[] }>({
    key: "",
    candidates: [],
  });
  const hasUrl = /^https?:\/\/\S+\.\S+/.test(postingUrl.trim());
  const hasTitle = title.trim().length >= 2 && companyName.trim().length >= 2;
  const key =
    hasUrl || hasTitle
      ? JSON.stringify([title.trim(), companyName.trim(), hasUrl ? postingUrl.trim() : ""])
      : "";

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      // POST, not GET: the posting URL stays out of request lines and access logs.
      const query = {
        ...(hasTitle ? { title: title.trim(), company: companyName.trim() } : {}),
        ...(hasUrl ? { url: postingUrl.trim() } : {}),
        ...(excludeId ? { exclude: excludeId } : {}),
      };
      try {
        const response = await fetch("/api/opportunities/duplicates", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(query),
          signal: controller.signal,
        });
        if (!response.ok) return;
        const body = (await response.json()) as { candidates: DuplicateCandidate[] };
        setResult({ key, candidates: body.candidates });
      } catch {
        // Aborted or offline: the hint is optional.
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, hasTitle, hasUrl, title, companyName, postingUrl, excludeId]);

  const candidates = key && result.key === key ? result.candidates : [];
  if (candidates.length === 0) return null;

  return (
    <div
      role="status"
      className="rounded-xl border border-[#f0dfc9] bg-[#fffaf2] px-3.5 py-3 text-xs text-[#8a6a3c]"
    >
      <p className="flex items-center gap-1.5 font-bold">
        <AlertTriangle className="size-3.5" aria-hidden /> You may have saved this job already
      </p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {candidates.map((candidate) => (
          <li key={candidate.id}>
            <Link href={`/jobs/${candidate.id}`} target="_blank" className="font-semibold underline">
              {candidate.title} · {candidate.companyName}
            </Link>{" "}
            <span className="text-[#a58a63]">
              ({candidate.reason === "url" ? "same posting URL" : "same title"}, saved{" "}
              {formatDateOnly(candidate.savedOn, "MMM d")}, {candidate.applicationCount} application
              {candidate.applicationCount === 1 ? "" : "s"})
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[11px] text-[#a58a63]">
        You can still save it, for example to track a reapplication.
      </p>
    </div>
  );
}
