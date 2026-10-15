"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { FormField, TextInput } from "@/components/shared/form-controls";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { applyAction } from "../actions";
import type { BoardColumn, SavedCard } from "../data";

interface SavedDropDialogProps {
  drop: { card: SavedCard; stage: BoardColumn } | null;
  today: string;
  onClose: () => void;
}

/** Confirms creating an application when a saved job is dropped on a stage. */
export function SavedDropDialog({ drop, today, onClose }: SavedDropDialogProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Dialog open={drop !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="rounded-2xl sm:max-w-[420px]">
        {drop ? (
          <>
            <DialogHeader>
              <DialogTitle>Record application?</DialogTitle>
              <DialogDescription className="text-xs">
                {drop.card.title} at {drop.card.company} will start in <b>{drop.stage.name}</b>.
              </DialogDescription>
            </DialogHeader>
            <form
              className="flex flex-col gap-4"
              onSubmit={async (event) => {
                event.preventDefault();
                const appliedOn = new FormData(event.currentTarget).get("appliedOn");
                setPending(true);
                const result = await applyAction({
                  opportunityId: drop.card.opportunityId,
                  appliedOn,
                  stageId: drop.stage.id,
                });
                setPending(false);
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Application recorded", {
                  action: {
                    label: "Open",
                    onClick: () => router.push(`/applications/${result.data.applicationId}`),
                  },
                });
                onClose();
              }}
            >
              <FormField id="drop-appliedOn" label="Date applied">
                <TextInput
                  id="drop-appliedOn"
                  name="appliedOn"
                  type="date"
                  defaultValue={today}
                  max={today}
                  required
                />
              </FormField>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Saving..." : "Record application"}
                </Button>
              </div>
            </form>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
