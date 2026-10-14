"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/settings", label: "Profile & preferences" },
  { href: "/settings/pipeline", label: "Pipeline stages" },
  { href: "/settings/notifications", label: "Notifications" },
  { href: "/settings/integrations", label: "Integrations" },
  { href: "/settings/account", label: "Account & data" },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings sections" className="mb-6 flex gap-2 overflow-x-auto pb-1">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-[9px] border border-[#e4eae3] bg-white px-3 py-2 text-[11px] font-bold whitespace-nowrap text-[#73827a]",
              active && "border-brand bg-brand text-white",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
