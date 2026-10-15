"use client";

import { usePathname, useRouter } from "next/navigation";
import { Sheet, SheetContent } from "@/components/ui/sheet";

/**
 * Right-hand drawer for an intercepted route. It only opens through a soft
 * navigation from the page underneath, so closing it goes back to that page.
 * `open` follows the URL rather than internal state: Next.js restores a
 * route's preserved state when it is revisited, so an uncontrolled sheet
 * would come back closed the second time the same card is opened.
 */
export function PeekSheet({ pathPrefix, children }: { pathPrefix: string; children: React.ReactNode }) {
  const router = useRouter();
  const open = usePathname().startsWith(pathPrefix);
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
      >
        {children}
      </SheetContent>
    </Sheet>
  );
}
