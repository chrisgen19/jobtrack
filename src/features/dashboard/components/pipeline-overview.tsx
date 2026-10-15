import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Panel, PanelHeader } from "@/components/shared/panel";
import type { PipelineOverview } from "../data";

const CATEGORIES = [
  { key: "saved", label: "Saved", color: "#a1b5a5" },
  { key: "applied", label: "Applied", color: "#8c96c8" },
  { key: "interviewing", label: "Interviewing", color: "#5bafa0" },
  { key: "offer", label: "Offer", color: "#61ae7a" },
] as const;

export function PipelineOverviewPanel({ pipeline }: { pipeline: PipelineOverview }) {
  const total = CATEGORIES.reduce((sum, category) => sum + pipeline[category.key], 0);
  return (
    <Panel className="pb-5">
      <PanelHeader
        title="Your application pipeline"
        description={`${total} ${total === 1 ? "opportunity" : "opportunities"} organized by stage`}
        action={
          <Link
            href="/pipeline"
            className="flex items-center gap-1 text-[11px] font-bold text-brand hover:underline"
          >
            View board <ArrowRight className="size-3" aria-hidden />
          </Link>
        }
      />
      <div className="grid grid-cols-4 gap-2 px-4 pb-4 sm:gap-3 sm:px-6">
        {CATEGORIES.map((category) => (
          <div
            key={category.key}
            className="min-w-0 rounded-xl border border-[#eef0ec] bg-[#fbfcfa] px-2 py-2.5 sm:px-3 sm:py-3.5"
          >
            <div className="text-xl font-extrabold tracking-[-1px] sm:text-[23px]">
              {pipeline[category.key]}
            </div>
            <div className="mt-0.5 text-[10px] text-[#87948d] sm:text-[11px]">{category.label}</div>
          </div>
        ))}
      </div>
      <div
        className="mx-4 flex h-[7px] gap-1 overflow-hidden rounded-full bg-[#f1f4f1] sm:mx-6"
        role="img"
        aria-label={CATEGORIES.map((category) => `${category.label}: ${pipeline[category.key]}`).join(", ")}
      >
        {total > 0
          ? CATEGORIES.filter((category) => pipeline[category.key] > 0).map((category) => (
              <div
                key={category.key}
                className="min-w-[5px] rounded"
                style={{
                  width: `${(100 * pipeline[category.key]) / total}%`,
                  backgroundColor: category.color,
                }}
              />
            ))
          : null}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 px-4 pt-4 text-[11px] text-[#87958d] sm:px-6">
        {CATEGORIES.map((category) => (
          <span key={category.key} className="flex items-center">
            <i
              className="mr-1.5 inline-block size-[7px] rounded-full"
              style={{ backgroundColor: category.color }}
              aria-hidden
            />
            {category.label}{" "}
            <b className="ml-1 text-[#51675b]">
              {total ? Math.round((100 * pipeline[category.key]) / total) : 0}%
            </b>
          </span>
        ))}
      </div>
    </Panel>
  );
}
