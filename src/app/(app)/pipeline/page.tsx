import { SlidersHorizontal } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { KanbanBoard } from "@/features/applications/components/kanban-board";
import { getBoard } from "@/features/applications/data";
import { getQuickAddOptions } from "@/features/opportunities/data";

export const metadata: Metadata = { title: "Pipeline" };

export default function PipelinePage() {
  return (
    <>
      <PageHeader
        eyebrow="Visual workflow"
        title="Your hiring pipeline"
        description="Drag cards between stages to keep your applications up to date."
        actions={
          <Button asChild variant="outline">
            <Link href="/settings/pipeline">
              <SlidersHorizontal aria-hidden /> Customize stages
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<BoardSkeleton />}>
        <Board />
      </Suspense>
    </>
  );
}

async function Board() {
  const [board, options] = await Promise.all([getBoard(), getQuickAddOptions()]);
  return <KanbanBoard saved={board.saved} columns={board.columns} options={options} />;
}

function BoardSkeleton() {
  return (
    <div className="flex gap-3.5 overflow-hidden">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-[510px] w-[265px] flex-none rounded-[13px]" />
      ))}
    </div>
  );
}
