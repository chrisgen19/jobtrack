"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Right-hand drawer for an intercepted route. It only opens through a soft
 * navigation from the page underneath, so closing it goes back to that page.
 * `open` follows the URL rather than internal state: Next.js restores a
 * route's preserved state when it is revisited, so an uncontrolled sheet
 * would come back closed the second time the same card is opened.
 */
export function PeekSheet({ pathPrefix, children }: { pathPrefix: string; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const open = pathname.startsWith(pathPrefix);
  const openPath = useRef(pathname);
  useEffect(() => {
    if (open) openPath.current = pathname;
  }, [open, pathname]);
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) router.back();
      }}
    >
      <SheetContent
        side="right"
        className="gap-0 bg-white p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[550px]"
        onCloseAutoFocus={(event) => {
          // Radix returns focus to a trigger, but this drawer opens by navigation and has none,
          // so focus would fall to <body>. Return it to the page link for the drawer's URL
          // instead (the card title that opened it, or the card it became after applying).
          const link = findPageLink(openPath.current);
          if (!link) return;
          event.preventDefault();
          link.focus();
        }}
      >
        {children}
      </SheetContent>
    </Sheet>
  );
}

/** First link to `href` on the page itself, skipping dialogs (the drawer's own "Open full page"). */
function findPageLink(href: string): HTMLElement | null {
  const links = document.querySelectorAll<HTMLElement>(`a[href="${CSS.escape(href)}"]`);
  return [...links].find((link) => !link.closest('[role="dialog"]')) ?? null;
}

/** Shown when the record behind the drawer is missing or belongs to someone else. */
export function PeekNotFound({ title }: { title: string }) {
  return (
    <SheetHeader className="px-5 pt-6 pr-12 sm:px-7">
      <SheetTitle>{title}</SheetTitle>
      <SheetDescription className="text-xs">
        It may have been deleted. Close this panel to go back.
      </SheetDescription>
    </SheetHeader>
  );
}

/** Loading state; keeps a dialog title so the drawer stays labelled while data streams in. */
export function PeekSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-4 px-5 pt-6 sm:px-7" aria-busy>
      <SheetTitle className="sr-only">Loading {label}</SheetTitle>
      <SheetDescription className="sr-only">Fetching the {label} summary.</SheetDescription>
      <Skeleton className="h-3 w-40" />
      <div className="flex items-center gap-3.5">
        <Skeleton className="size-11 rounded-xl" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-16 rounded-[10px]" />
        ))}
      </div>
      <Skeleton className="h-14 rounded-[10px]" />
    </div>
  );
}
