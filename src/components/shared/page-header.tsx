import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

/** Page title block from the mockup: eyebrow, large title, muted subtitle. */
export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-[11px] font-bold tracking-[1.35px] text-[#7a9284] uppercase">{eyebrow}</p>
        <h1 className="mt-2 mb-2 text-[26px] leading-tight font-bold tracking-[-1.2px] text-heading sm:text-[32px]">
          {title}
        </h1>
        {description ? <p className="text-[13px] leading-relaxed text-subtle">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
