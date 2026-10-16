import type { ReactNode } from "react";

export function BrandMark() {
  return (
    <span className="grid size-7 flex-none place-items-center rounded-[9px] bg-brand text-white" aria-hidden>
      <svg viewBox="0 0 30 30" fill="none" width="18" height="18">
        <path
          d="M6 19 13 8l5 9 5-7"
          stroke="white"
          strokeWidth="3.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M6 25h17" stroke="#9ad7b5" strokeWidth="3.1" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function Header({ action }: { action?: ReactNode }) {
  return (
    <header className="flex items-center gap-2 border-b border-line-soft px-4 py-3">
      <BrandMark />
      <span className="flex-1 text-[15px] font-bold tracking-[-0.6px] text-ink">
        job<span className="text-brand">track.</span>
      </span>
      {action}
    </header>
  );
}
