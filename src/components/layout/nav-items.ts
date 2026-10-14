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

export function activeNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}
