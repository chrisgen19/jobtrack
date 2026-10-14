import { ArrowRight, ListChecks } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { Panel, PanelHeader } from "@/components/shared/panel";

export function FocusTasks({ children, count }: { children: ReactNode; count: number }) {
  return (
    <Panel className="pb-3">
      <PanelHeader
        title="Your focus today"
        description="A few things worth your attention"
        action={
          <Link
            href="/tasks"
            className="flex items-center gap-1 text-[11px] font-bold text-brand hover:underline"
          >
            All tasks <ArrowRight className="size-3" aria-hidden />
          </Link>
        }
      />
      {count === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No open tasks"
          description="Add follow-ups and prep tasks to keep your search moving."
          className="py-8"
        />
      ) : (
        children
      )}
    </Panel>
  );
}
