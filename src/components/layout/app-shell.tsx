"use client";

import { ArrowRight, ChevronRight, Menu, Search, Sparkles } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Brand, BrandName } from "./brand";
import { activeNavItem, NAV_ITEMS } from "./nav-items";

interface AppShellProps {
  children: ReactNode;
  /** Small server-rendered counters keyed by nav href (e.g. open tasks). */
  navBadges?: Partial<Record<string, ReactNode>>;
  /** Profile block rendered at the bottom of the sidebar. */
  sidebarFooter?: ReactNode;
  /** Notification bell, quick add, etc. */
  topbarActions?: ReactNode;
}

/** Workspace chrome from the mockup: sticky sidebar, blurred top bar, content. */
export function AppShell({ children, navBadges, sidebarFooter, topbarActions }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebar = (onNavigate?: () => void) => (
    <SidebarContent navBadges={navBadges} footer={sidebarFooter} onNavigate={onNavigate} />
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[214px] flex-none flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar px-4 pt-7 pb-5 md:flex lg:w-[228px] xl:w-[250px]">
        {sidebar()}
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[264px] gap-0 bg-sidebar p-0 sm:max-w-[264px]">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Workspace sections</SheetDescription>
          <div className="flex h-full flex-col overflow-y-auto px-4 pt-7 pb-5">
            {sidebar(() => setMobileOpen(false))}
          </div>
        </SheetContent>
      </Sheet>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-line bg-white/75 px-4 backdrop-blur-md md:h-[76px] md:px-8 xl:px-10">
          <div className="flex items-center gap-1 md:hidden">
            <Button variant="ghost" size="icon-lg" aria-label="Open menu" onClick={() => setMobileOpen(true)}>
              <Menu className="size-6" />
            </Button>
            <BrandName className="text-[17px]" />
          </div>
          <nav aria-label="Breadcrumb" className="hidden items-center gap-2.5 text-xs text-[#8e9994] md:flex">
            My workspace <ChevronRight className="size-3.5" aria-hidden />
            <strong className="font-semibold text-[#30423b]">
              <Suspense fallback="Workspace">
                <CurrentSectionName />
              </Suspense>
            </strong>
          </nav>
          <div className="flex items-center gap-1 md:gap-3">
            <Form
              action="/jobs"
              role="search"
              className="hidden h-9 w-[180px] items-center gap-2 rounded-[10px] border border-line bg-white px-3 text-[#97a39e] lg:flex xl:w-[250px]"
            >
              <Search className="size-3.5 flex-none" aria-hidden />
              <input
                name="q"
                type="search"
                placeholder="Search jobs..."
                aria-label="Search jobs"
                className="w-full bg-transparent text-xs text-ink outline-none placeholder:text-[#97a39e]"
              />
            </Form>
            {topbarActions}
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] px-4 pt-6 pb-12 md:px-8 md:pt-8 xl:px-10 xl:pt-9">
          {children}
        </main>
      </div>
    </div>
  );
}

/** Reads the URL, so it renders behind Suspense (dynamic routes stream it). */
function CurrentSectionName() {
  return <>{activeNavItem(usePathname())?.name ?? "Workspace"}</>;
}

function ActiveNavLinks(props: Omit<NavLinksProps, "pathname">) {
  return <NavLinks pathname={usePathname()} {...props} />;
}

interface SidebarContentProps {
  navBadges?: Partial<Record<string, ReactNode>>;
  footer?: ReactNode;
  onNavigate?: () => void;
}

function SidebarContent({ navBadges, footer, onNavigate }: SidebarContentProps) {
  return (
    <>
      <div className="pb-7">
        <Brand />
      </div>
      <Suspense fallback={<NavLinks pathname={null} navBadges={navBadges} onNavigate={onNavigate} />}>
        <ActiveNavLinks navBadges={navBadges} onNavigate={onNavigate} />
      </Suspense>
      <SidebarGuide onNavigate={onNavigate} />
      {footer}
    </>
  );
}

interface NavLinksProps {
  pathname: string | null;
  navBadges?: Partial<Record<string, ReactNode>>;
  onNavigate?: () => void;
}

function NavLinks({ pathname, navBadges, onNavigate }: NavLinksProps) {
  return (
    <nav aria-label="Main" className="flex flex-col">
      {NAV_ITEMS.map((item, index) => {
        const showHeading = index === 0 || NAV_ITEMS[index - 1]?.group !== item.group;
        const active = pathname !== null && activeNavItem(pathname)?.href === item.href;
        const Icon = item.icon;
        return (
          <div key={item.href}>
            {showHeading ? (
              <div className="mt-4 mb-2 px-3.5 text-[10px] font-bold tracking-[1.5px] text-[#a3aaa6] uppercase">
                {item.group}
              </div>
            ) : null}
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-[10px] px-3 py-[11px] text-[13px] font-medium text-[#687772] transition-colors hover:bg-[#f0f4ef] hover:text-ink",
                active && "bg-brand-tint font-bold text-brand hover:bg-brand-tint hover:text-brand",
              )}
            >
              <Icon className={cn("size-[18px] text-[#879691]", active && "text-brand")} aria-hidden />
              <span>{item.name}</span>
              {navBadges?.[item.href] ? <span className="ml-auto">{navBadges[item.href]}</span> : null}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}

function SidebarGuide({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="mt-auto">
      <div className="mx-1 mt-5 mb-4 rounded-[13px] border border-[#e4eee5] bg-[#eff5f0] px-3.5 py-4">
        <div className="mb-3 grid size-7 place-items-center rounded-lg bg-white text-brand" aria-hidden>
          <Sparkles className="size-4" />
        </div>
        <strong className="block text-xs">Your career, organized.</strong>
        <p className="mt-1.5 mb-3 text-[11px] leading-relaxed text-[#718379]">
          Keep everything in one place and make every next move count.
        </p>
        <Link
          href="/pipeline"
          onClick={onNavigate}
          className="flex items-center gap-1.5 text-[11px] font-bold text-brand hover:underline"
        >
          Explore your pipeline <ArrowRight className="size-3" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
