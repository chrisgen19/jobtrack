import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Panel } from "./panel";

const TONES = {
  green: "bg-tone-green-bg text-tone-green",
  purple: "bg-tone-purple-bg text-tone-purple",
  orange: "bg-tone-orange-bg text-tone-orange",
  blue: "bg-tone-blue-bg text-tone-blue",
} as const;

interface MetricCardProps {
  label: string;
  value: ReactNode;
  footnote?: ReactNode;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
}

export function MetricCard({ label, value, footnote, icon: Icon, tone = "green" }: MetricCardProps) {
  return (
    <Panel className="min-h-[125px] p-4 sm:min-h-[143px] sm:p-5">
      <div className="flex items-center justify-between text-[11px] font-semibold text-[#788a80] sm:text-xs">
        {label}
        <span className={cn("grid size-[30px] place-items-center rounded-[10px]", TONES[tone])} aria-hidden>
          <Icon className="size-[15px]" />
        </span>
      </div>
      <div className="mt-3 mb-1.5 text-[27px] leading-tight font-extrabold tracking-[-1.45px] sm:text-[32px]">
        {value}
      </div>
      {footnote ? (
        <div className="text-[11px] leading-normal text-[#97a69a] [&_b]:font-bold [&_b]:text-[#208660]">
          {footnote}
        </div>
      ) : null}
    </Panel>
  );
}
