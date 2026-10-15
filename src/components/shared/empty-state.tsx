import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("px-5 py-12 text-center text-[#94a299]", className)}>
      <div
        className="mx-auto grid size-12 place-items-center rounded-[14px] bg-[#eff5f1] text-brand"
        aria-hidden
      >
        <Icon className="size-5" />
      </div>
      <p className="mt-3 mb-1 text-[15px] font-bold text-[#3c5446]">{title}</p>
      {description ? <p className="mx-auto max-w-sm text-xs leading-relaxed">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
