import { cn } from "@/lib/utils";

const LOGO_COLORS = [
  "#e2ebf5",
  "#f5e8d5",
  "#f1e6f2",
  "#e7eddf",
  "#fbe9dc",
  "#ebe8f9",
  "#e5e9f9",
  "#dceef2",
  "#e9f0df",
  "#e0ecec",
  "#eef0db",
  "#f8e4e5",
  "#f4e8dd",
  "#f4e4e7",
  "#e5ecf2",
  "#eee2f0",
];

function hash(value: string): number {
  let result = 0;
  for (const char of value) result = (result * 31 + char.charCodeAt(0)) >>> 0;
  return result;
}

export function companyInitials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s&]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 1).toUpperCase();
  return (words[0]!.slice(0, 1) + words[1]!.slice(0, 1)).toUpperCase();
}

interface CompanyLogoProps {
  name: string;
  size?: "sm" | "md";
  className?: string;
}

/** Initials tile with a stable pastel colour per company name. */
export function CompanyLogo({ name, size = "md", className }: CompanyLogoProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid flex-none place-items-center font-extrabold tracking-[-0.5px] text-[#47584e]",
        size === "md" ? "size-[37px] rounded-[11px] text-[13px]" : "size-[30px] rounded-lg text-[10px]",
        className,
      )}
      style={{ backgroundColor: LOGO_COLORS[hash(name.toLowerCase()) % LOGO_COLORS.length] }}
    >
      {companyInitials(name)}
    </span>
  );
}
