import { SearchX } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <span
        className="mb-4 grid size-12 place-items-center rounded-[14px] bg-brand-soft text-brand"
        aria-hidden
      >
        <SearchX className="size-5" />
      </span>
      <h1 className="text-xl font-bold tracking-[-0.5px]">We couldn&apos;t find that</h1>
      <p className="mt-2 max-w-sm text-sm text-subtle">
        It may have been deleted, or it isn&apos;t part of your workspace.
      </p>
      <Button asChild className="mt-6">
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </main>
  );
}
