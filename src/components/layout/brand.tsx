import Link from "next/link";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid size-[37px] flex-none place-items-center rounded-xl bg-brand text-white shadow-[0_5px_10px_#126d5024]",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 30 30" fill="none" width="23" height="23">
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

export function BrandName({ className }: { className?: string }) {
  return (
    <span className={cn("text-[19px] font-bold tracking-[-0.8px] text-ink", className)}>
      job<span className="text-brand">track.</span>
    </span>
  );
}

export function Brand({ href = "/dashboard", withTagline = true }: { href?: string; withTagline?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-lg px-2 py-1">
      <BrandMark />
      <span>
        <BrandName className="block" />
        {withTagline ? (
          <span className="mt-0.5 block text-[10px] font-extrabold tracking-[1.45px] text-[#92a09b]">
            YOUR CAREER HQ
          </span>
        ) : null}
      </span>
    </Link>
  );
}
