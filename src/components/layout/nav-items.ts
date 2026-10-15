import {
  BarChart3,
  Briefcase,
  CalendarDays,
  Columns3,
  FileText,
  LayoutGrid,
  ListChecks,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  group: "Workspace" | "Insights" | "Account";
};

export const NAV_ITEMS: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutGrid, group: "Workspace" },
  { name: "All Jobs", href: "/jobs", icon: Briefcase, group: "Workspace" },
  { name: "Pipeline", href: "/pipeline", icon: Columns3, group: "Workspace" },
  { name: "Calendar", href: "/calendar", icon: CalendarDays, group: "Workspace" },
  { name: "Tasks", href: "/tasks", icon: ListChecks, group: "Workspace" },
  { name: "Analytics", href: "/analytics", icon: BarChart3, group: "Insights" },
  { name: "Documents", href: "/documents", icon: FileText, group: "Insights" },
  { name: "Contacts", href: "/contacts", icon: Users, group: "Insights" },
  { name: "Settings", href: "/settings", icon: Settings, group: "Account" },
];

/** Routes without their own nav entry, shown under a parent section. */
const ALIASES: Record<string, string> = { "/applications": "/jobs", "/notifications": "/dashboard" };

/**
 * The path the nav treats as current. An intercepted route (the pipeline peek
 * drawer) masks the URL as `/applications/[id]` while the board is still the
 * page underneath; the workspace layout's selected segment names that page, so
 * it wins when it disagrees with the URL's first segment.
 */
export function navPathname(pathname: string, selectedSegment: string | null): string {
  if (!selectedSegment || selectedSegment.startsWith("(")) return pathname;
  return pathname.split("/")[1] === selectedSegment ? pathname : `/${selectedSegment}`;
}

export function activeNavItem(pathname: string): NavItem | undefined {
  const alias = Object.entries(ALIASES).find(([prefix]) => pathname.startsWith(prefix))?.[1];
  const path = alias ?? pathname;
  return NAV_ITEMS.find((item) => path === item.href || path.startsWith(`${item.href}/`));
}
