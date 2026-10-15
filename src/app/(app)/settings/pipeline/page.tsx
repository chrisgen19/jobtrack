import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { StageManager } from "@/features/pipelines/components/stage-manager";
import { getPipelineStages } from "@/features/pipelines/data";
import { SettingsCard } from "@/features/settings/components/settings-card";

export const metadata: Metadata = { title: "Pipeline stages" };

export default function PipelineSettingsPage() {
  return (
    <SettingsCard
      title="Hiring pipeline"
      description="Create stages that match how companies actually interview. Rename, recolour or reorder them any time. Each stage counts as a fixed category (applied, screening, interview...) so analytics stay accurate after renames."
    >
      <Suspense fallback={<Skeleton className="h-72 rounded-xl" />}>
        <Stages />
      </Suspense>
    </SettingsCard>
  );
}

async function Stages() {
  return <StageManager stages={await getPipelineStages()} />;
}
