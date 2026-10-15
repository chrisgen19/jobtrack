"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/badges";
import { FormField, SelectInput, TextInput } from "@/components/shared/form-controls";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { StageCategory } from "@/generated/prisma/enums";
import {
  addStageAction,
  deleteStageAction,
  reorderStagesAction,
  setStageActiveAction,
  updateStageAction,
} from "../actions";
import type { StageSettingsRow } from "../data";
import { CATEGORY_COLOR, STAGE_CATEGORY_LABEL } from "../defaults";

const CATEGORY_OPTIONS = (Object.keys(StageCategory) as StageCategory[]).map((value) => ({
  value,
  label: STAGE_CATEGORY_LABEL[value],
}));

export function StageManager({ stages }: { stages: StageSettingsRow[] }) {
  const [, startTransition] = useTransition();
  const [ordered, reorder] = useOptimistic(
    stages,
    (_state: StageSettingsRow[], next: StageSettingsRow[]) => next,
  );
  const [deleting, setDeleting] = useState<StageSettingsRow | null>(null);

  function move(index: number, delta: -1 | 1) {
    const next = [...ordered];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item!);
    startTransition(async () => {
      reorder(next);
      const result = await reorderStagesAction({ stageIds: next.map((stage) => stage.id) });
      if (!result.ok) toast.error(result.error);
    });
  }

  function saveStage(stage: StageSettingsRow, patch: { name?: string; color?: string }) {
    const name = (patch.name ?? stage.name).trim();
    const color = patch.color ?? stage.color ?? CATEGORY_COLOR[stage.category];
    if (!name || (name === stage.name && color === stage.color)) return;
    startTransition(async () => {
      const result = await updateStageAction({ stageId: stage.id, name, color });
      if (result.ok) toast.success("Stage updated");
      else toast.error(result.fieldErrors?.name?.[0] ?? result.error);
    });
  }

  function toggleActive(stage: StageSettingsRow, isActive: boolean) {
    startTransition(async () => {
      const result = await setStageActiveAction({ stageId: stage.id, isActive });
      if (result.ok) toast.success(isActive ? "Stage enabled" : "Stage disabled");
      else toast.error(result.error);
    });
  }

  return (
    <div>
      <ul className="flex flex-col">
        {ordered.map((stage, index) => (
          <li
            key={stage.id}
            className="flex flex-wrap items-center gap-2 border-t border-[#edf0eb] py-3 sm:flex-nowrap"
          >
            <input
              type="color"
              aria-label={`Colour for ${stage.name}`}
              defaultValue={stage.color ?? CATEGORY_COLOR[stage.category]}
              onBlur={(event) => saveStage(stage, { color: event.target.value })}
              className="size-8 flex-none cursor-pointer rounded-md border border-line bg-white p-0.5"
            />
            <TextInput
              aria-label="Stage name"
              defaultValue={stage.name}
              maxLength={40}
              className="h-9 min-w-0 flex-1"
              onBlur={(event) => saveStage(stage, { name: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
              }}
            />
            <div className="flex items-center gap-1.5">
              <span className="w-[84px]">
                <StatusBadge label={STAGE_CATEGORY_LABEL[stage.category]} tone="blue" />
              </span>
              <span className="w-14 text-[10px] whitespace-nowrap text-faint">
                {stage.openApplications} open
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Move ${stage.name} up`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Move ${stage.name} down`}
                disabled={index === ordered.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown aria-hidden />
              </Button>
              <Switch
                checked={stage.isActive}
                onCheckedChange={(checked) => toggleActive(stage, checked)}
                aria-label={`${stage.isActive ? "Disable" : "Enable"} ${stage.name}`}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete ${stage.name}`}
                onClick={() => setDeleting(stage)}
              >
                <Trash2 aria-hidden />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <AddStageForm />
      <DeleteStageDialog stage={deleting} stages={ordered} onClose={() => setDeleting(null)} />
    </div>
  );
}

function AddStageForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-2 grid gap-3 border-t border-[#edf0eb] pt-4 sm:grid-cols-[1fr_180px_auto] sm:items-start"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        setPending(true);
        const result = await addStageAction({ name: data.get("name"), category: data.get("category") });
        setPending(false);
        if (!result.ok) {
          setError(result.fieldErrors?.name?.[0] ?? result.fieldErrors?.category?.[0] ?? result.error);
          return;
        }
        setError(null);
        form.reset();
        toast.success("Stage added");
      }}
    >
      <FormField id="new-stage-name" label="New stage" error={error ?? undefined}>
        <TextInput
          id="new-stage-name"
          name="name"
          placeholder="e.g. Coding Challenge"
          maxLength={40}
          required
        />
      </FormField>
      <FormField id="new-stage-category" label="Counts as">
        <SelectInput
          id="new-stage-category"
          name="category"
          defaultValue="INTERVIEW"
          options={CATEGORY_OPTIONS}
        />
      </FormField>
      <Button type="submit" disabled={pending} className="h-10 sm:mt-[22px]">
        <Plus aria-hidden /> Add stage
      </Button>
      <p className="text-[10px] text-[#99a69d] sm:col-span-3">
        &ldquo;Counts as&rdquo; is fixed once the stage is created, so analytics stay consistent after
        renames.
      </p>
    </form>
  );
}

function DeleteStageDialog({
  stage,
  stages,
  onClose,
}: {
  stage: StageSettingsRow | null;
  stages: StageSettingsRow[];
  onClose: () => void;
}) {
  const [pending, setPending] = useState(false);
  const targets = stages.filter((item) => item.isActive && item.id !== stage?.id);
  return (
    <Dialog open={stage !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="rounded-2xl sm:max-w-[440px]">
        {stage ? (
          <>
            <DialogHeader>
              <DialogTitle>Delete “{stage.name}”?</DialogTitle>
              <DialogDescription className="text-xs">
                {stage.totalApplications > 0
                  ? `${stage.totalApplications} application(s) use this stage. They will be moved to the stage you choose, and the move is logged. Past timeline entries keep the old name.`
                  : "No applications use this stage. Disabling it instead keeps it out of the way without deleting it."}
              </DialogDescription>
            </DialogHeader>
            <form
              className="flex flex-col gap-4"
              onSubmit={async (event) => {
                event.preventDefault();
                const moveToStageId = new FormData(event.currentTarget).get("moveTo");
                setPending(true);
                const result = await deleteStageAction({ stageId: stage.id, moveToStageId });
                setPending(false);
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Stage deleted");
                onClose();
              }}
            >
              {stage.totalApplications > 0 ? (
                <FormField id="moveTo" label="Move applications to">
                  <SelectInput
                    id="moveTo"
                    name="moveTo"
                    options={targets.map((item) => ({ value: item.id, label: item.name }))}
                    required
                  />
                </FormField>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" variant="destructive" disabled={pending}>
                  {pending ? "Deleting..." : "Delete stage"}
                </Button>
              </div>
            </form>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
