import { ArrowUpRight } from "lucide-react";
import type { ApplicationOutcome, Priority, StageCategory } from "@/generated/prisma/enums";
import { APPLICATION_OUTCOME_LABEL, PRIORITY_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

const BADGE_BASE =
  "inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[10px] font-bold whitespace-nowrap leading-none";

const CATEGORY_CLASS: Record<StageCategory, string> = {
  APPLIED: "bg-[#f0f2fc] text-[#6c73ac]",
  SCREENING: "bg-[#fff4e7] text-[#9d7a45]",
  ASSESSMENT: "bg-[#edf5fa] text-[#5e86a7]",
  INTERVIEW: "bg-[#e9f5f6] text-[#3d868b]",
  OFFER: "bg-[#e6f6e9] text-[#2d905b]",
  OTHER: "bg-[#f3eefa] text-[#9069ae]",
};

interface StageBadgeProps {
  name: string;
  category: StageCategory;
  color?: string | null;
  className?: string;
}

/** Current pipeline stage of an application, styled by its stable category. */
export function StageBadge({ name, category, color, className }: StageBadgeProps) {
  return (
    <span className={cn(BADGE_BASE, CATEGORY_CLASS[category], className)}>
      {color ? <i className="size-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden /> : null}
      {name}
    </span>
  );
}

export function SavedBadge({ className }: { className?: string }) {
  return <span className={cn(BADGE_BASE, "bg-[#f0f3ef] text-[#728b79]", className)}>Saved</span>;
}

export function ClosedBadge({
  outcome,
  className,
}: {
  outcome: ApplicationOutcome | null;
  className?: string;
}) {
  return (
    <span className={cn(BADGE_BASE, "bg-[#f0f1f1] text-[#88918c]", className)}>
      {outcome ? APPLICATION_OUTCOME_LABEL[outcome] : "Closed"}
    </span>
  );
}

export function StatusBadge({
  label,
  tone = "neutral",
  className,
}: {
  label: string;
  tone?: "neutral" | "green" | "amber" | "red" | "blue" | "purple";
  className?: string;
}) {
  const tones = {
    neutral: "bg-[#f0f3ef] text-[#728b79]",
    green: "bg-brand-soft text-[#387961]",
    amber: "bg-[#fff4e7] text-[#9d7a45]",
    red: "bg-[#fbeceb] text-[#b4534b]",
    blue: "bg-[#edf5fa] text-[#5e86a7]",
    purple: "bg-[#f3eefa] text-[#9069ae]",
  } as const;
  return <span className={cn(BADGE_BASE, tones[tone], className)}>{label}</span>;
}

const PRIORITY_CLASS: Record<Priority, string> = {
  HIGH: "bg-[#fbf3eb] text-[#bc8550]",
  MEDIUM: "bg-[#edf4f2] text-[#6b9083]",
  LOW: "bg-[#f4f5f2] text-[#98a49b]",
};

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <span className={cn(BADGE_BASE, PRIORITY_CLASS[priority], className)}>
      {priority === "HIGH" ? <ArrowUpRight className="size-3" aria-hidden /> : null}
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

export function TinyTag({ children }: { children: React.ReactNode }) {
  return <span className={cn(BADGE_BASE, "bg-[#eff5ef] text-[#59846b]")}>{children}</span>;
}
