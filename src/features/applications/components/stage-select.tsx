"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import type { StageOption } from "../data";
import { changeStageAction } from "../actions";

interface StageSelectProps {
  applicationId: string;
  stageId: string;
  stages: StageOption[];
  disabled?: boolean;
}

/** Accessible stage picker (keyboard alternative to Kanban drag-and-drop). */
export function StageSelect({ applicationId, stageId, stages, disabled }: StageSelectProps) {
  const [optimisticStage, setOptimisticStage] = useOptimistic(stageId);
  const [pending, startTransition] = useTransition();

  function change(nextStageId: string) {
    startTransition(async () => {
      setOptimisticStage(nextStageId);
      const result = await changeStageAction({ applicationId, stageId: nextStageId });
      if (!result.ok) toast.error(result.error);
      else toast.success(`Moved to ${stages.find((stage) => stage.id === nextStageId)?.name ?? "stage"}`);
    });
  }

  return (
    <label className="flex items-center gap-2 text-[11px] font-bold text-[#657c6b]">
      <span className="sr-only sm:not-sr-only">Stage</span>
      <select
        value={optimisticStage}
        disabled={disabled || pending}
        onChange={(event) => change(event.target.value)}
        className="h-9 rounded-[9px] border border-[#c8dccc] bg-[#f3faf3] px-2.5 text-xs font-bold text-[#2e7651] disabled:opacity-60"
      >
        {stages
          .filter((stage) => stage.isActive || stage.id === stageId)
          .map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
              {stage.isActive ? "" : " (disabled)"}
            </option>
          ))}
      </select>
    </label>
  );
}
