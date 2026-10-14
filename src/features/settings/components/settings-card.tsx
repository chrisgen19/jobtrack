import type { ReactNode } from "react";
import { Panel } from "@/components/shared/panel";

export function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Panel className="p-5 sm:p-6">
      <h2 className="mb-1.5 text-[15px] font-bold">{title}</h2>
      {description ? <p className="mb-5 text-xs leading-relaxed text-[#91a096]">{description}</p> : null}
      {children}
    </Panel>
  );
}

export function SettingsRow({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-[#edf0eb] py-4">
      <div className="min-w-0">
        <strong className="text-xs">{title}</strong>
        {description ? <span className="mt-1 block text-[11px] text-[#98a69c]">{description}</span> : null}
      </div>
      {action}
    </div>
  );
}
