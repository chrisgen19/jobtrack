import { Suspense } from "react";
import { PeekSheet, PeekSkeleton } from "@/components/shared/peek-sheet";
import { ApplicationPeek } from "@/features/applications/components/application-peek";

/** `/applications/[id]` opened from the board: a summary drawer instead of the full page. */
export default function ApplicationPeekPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    // The sheet reads the pathname, which is request-time data under Cache Components.
    <Suspense fallback={null}>
      <PeekSheet pathPrefix="/applications/">
        <Suspense fallback={<PeekSkeleton label="application" />}>
          <PeekContent params={params} />
        </Suspense>
      </PeekSheet>
    </Suspense>
  );
}

async function PeekContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ApplicationPeek id={id} />;
}
