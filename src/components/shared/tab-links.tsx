import Link from "next/link";
import { cn } from "@/lib/utils";

export type TabLink = { id: string; label: string; count?: number };

/** Underlined tab strip from the mockup drawer; each tab is a URL. */
export function TabLinks({
  tabs,
  active,
  hrefFor,
  label,
}: {
  tabs: TabLink[];
  active: string;
  hrefFor: (id: string) => string;
  label: string;
}) {
  return (
    <nav aria-label={label} className="mb-5 flex gap-5 overflow-x-auto border-b border-line">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={hrefFor(tab.id)}
          scroll={false}
          replace
          aria-current={tab.id === active ? "page" : undefined}
          className={cn(
            "relative pb-3 text-xs font-bold whitespace-nowrap text-[#96a59a] hover:text-ink",
            tab.id === active &&
              "text-brand after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-brand",
          )}
        >
          {tab.label}
          {tab.count !== undefined ? <span className="ml-1 text-[10px] text-faint">{tab.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
