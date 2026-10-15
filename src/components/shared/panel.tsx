import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** White rounded surface used for every card in the mockup. */
export function Panel({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn("min-w-0 rounded-2xl border border-line bg-card shadow-panel", className)}
      {...props}
    />
  );
}

interface PanelHeaderProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function PanelHeader({ title, description, action, className }: PanelHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-4 px-5 pt-5 pb-4 sm:px-6 sm:pt-6", className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-bold tracking-[-0.4px]">{title}</h2>
        {description ? <div className="mt-1 text-[11px] leading-normal text-faint">{description}</div> : null}
      </div>
      {action}
    </div>
  );
}
