import { Suspense } from "react";
import { PeekSheet, PeekSkeleton } from "@/components/shared/peek-sheet";
import { JobPeek } from "@/features/opportunities/components/job-peek";

/** `/jobs/[id]` opened from the board's Saved column: a summary drawer instead of the full page. */
export default function JobPeekPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    // The sheet reads the pathname, which is request-time data under Cache Components.
    <Suspense fallback={null}>
      <PeekSheet pathPrefix="/jobs/">
        <Suspense fallback={<PeekSkeleton label="job" />}>
          <PeekContent params={params} />
        </Suspense>
      </PeekSheet>
    </Suspense>
  );
}

async function PeekContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JobPeek id={id} />;
}
