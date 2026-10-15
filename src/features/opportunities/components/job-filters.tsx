"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { SelectInput } from "@/components/shared/form-controls";
import { Button } from "@/components/ui/button";
import { enumOptions, PRIORITY_LABEL, WORK_ARRANGEMENT_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { JobListFilters } from "../schemas";

const VIEWS = [
  { id: "all", label: "All jobs" },
  { id: "active", label: "Active" },
  { id: "saved", label: "Saved" },
  { id: "closed", label: "Closed" },
  { id: "archived", label: "Archived" },
] as const;

interface JobFiltersProps {
  filters: JobListFilters;
  total: number;
  stages: { id: string; name: string }[];
  sources: string[];
}

function toQuery(filters: Partial<JobListFilters>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value && !(key === "view" && value === "all")) params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** Filter bar for the jobs list. All state lives in the URL search params. */
export function JobFilters({ filters, total, stages, sources }: JobFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(filters.q ?? "");
  const first = useRef(true);

  function update(patch: Partial<JobListFilters>) {
    startTransition(() =>
      router.replace(`${pathname}${toQuery({ ...filters, ...patch })}`, { scroll: false }),
    );
  }

  // Debounced search-as-you-type.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(() => {
      if ((filters.q ?? "") !== query.trim()) update({ q: query.trim() || undefined });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the typed text should trigger
  }, [query]);

  const hasFilters = Boolean(
    filters.q || filters.stage || filters.priority || filters.work || filters.source,
  );

  return (
    <div className={cn("mb-4 flex flex-col gap-3", pending && "opacity-70")}>
      <nav aria-label="Job views" className="flex flex-wrap gap-2">
        {VIEWS.map((view) => (
          <Link
            key={view.id}
            href={`${pathname}${toQuery({ ...filters, view: view.id })}`}
            replace
            scroll={false}
            aria-current={filters.view === view.id ? "page" : undefined}
            className={cn(
              "rounded-[9px] border border-[#e4eae3] bg-white px-3 py-2 text-[11px] font-bold text-[#73827a]",
              filters.view === view.id && "border-brand bg-brand text-white",
            )}
          >
            {view.label}
            {view.id === "all" ? ` · ${total}` : ""}
          </Link>
        ))}
      </nav>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-10 w-full items-center gap-2 rounded-[9px] border border-line bg-white px-3 text-[#9ca8a0] sm:w-[240px]">
          <Search className="size-3.5 flex-none" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, company, skill..."
            aria-label="Search jobs"
            className="w-full bg-transparent text-xs text-ink outline-none"
          />
        </label>
        <SelectInput
          aria-label="Filter by stage"
          wrapperClassName="w-[calc(50%-4px)] sm:w-[160px]"
          value={filters.stage ?? ""}
          onChange={(event) => update({ stage: event.target.value || undefined })}
          placeholder="All stages"
          options={stages.map((stage) => ({ value: stage.id, label: stage.name }))}
        />
        <SelectInput
          aria-label="Filter by priority"
          wrapperClassName="w-[calc(50%-4px)] sm:w-[140px]"
          value={filters.priority ?? ""}
          onChange={(event) =>
            update({ priority: (event.target.value || undefined) as JobListFilters["priority"] })
          }
          placeholder="All priorities"
          options={enumOptions(PRIORITY_LABEL).reverse()}
        />
        <SelectInput
          aria-label="Filter by work arrangement"
          wrapperClassName="w-[calc(50%-4px)] sm:w-[150px]"
          value={filters.work ?? ""}
          onChange={(event) => update({ work: (event.target.value || undefined) as JobListFilters["work"] })}
          placeholder="Any work type"
          options={enumOptions(WORK_ARRANGEMENT_LABEL)}
        />
        {sources.length > 0 ? (
          <SelectInput
            aria-label="Filter by source"
            wrapperClassName="w-[calc(50%-4px)] sm:w-[150px]"
            value={filters.source ?? ""}
            onChange={(event) => update({ source: event.target.value || undefined })}
            placeholder="All sources"
            options={sources.map((source) => ({ value: source, label: source }))}
          />
        ) : null}
        {hasFilters ? (
          <Button
            variant="ghost"
            onClick={() => {
              setQuery("");
              update({
                q: undefined,
                stage: undefined,
                priority: undefined,
                work: undefined,
                source: undefined,
              });
            }}
          >
            <X aria-hidden /> Clear filters
          </Button>
        ) : null}
      </div>
    </div>
  );
}
