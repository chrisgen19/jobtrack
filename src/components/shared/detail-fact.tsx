import type { ReactNode } from "react";

export function DetailFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-[10px] border border-[#eff2ee] bg-[#f8faf7] p-3">
      <span className="mb-1.5 block text-[10px] font-semibold tracking-[0.4px] text-[#9caaa0] uppercase">
        {label}
      </span>
      <strong className="block truncate text-xs font-bold text-[#365343]">{children}</strong>
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-6 mb-3 text-[11px] font-extrabold tracking-[1px] text-[#87998c] uppercase">
      {children}
    </h3>
  );
}
