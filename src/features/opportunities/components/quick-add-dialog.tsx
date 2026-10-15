"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createOpportunityAction } from "../actions";
import type { QuickAddOptions } from "../data";
import { OpportunityForm } from "./opportunity-form";

interface QuickAddDialogProps {
  options: QuickAddOptions;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-select "already applied" at this stage (Kanban column "Add job"). */
  stageId?: string;
}

export function QuickAddDialog({ options, open, onOpenChange, stageId }: QuickAddDialogProps) {
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl p-0 sm:max-w-[640px]">
        <DialogHeader className="border-b border-[#edf1ed] px-5 py-5 sm:px-6">
          <DialogTitle className="text-xl tracking-[-0.65px]">Add a new opportunity</DialogTitle>
          <DialogDescription className="text-xs">
            Save a job in seconds. You can fill out the rest later.
          </DialogDescription>
        </DialogHeader>
        <div className="px-5 pb-5 sm:px-6">
          {open ? (
            <OpportunityForm
              key={stageId ?? "new"}
              mode="create"
              companyNames={options.companyNames}
              stages={options.stages}
              today={options.today}
              defaultValues={{
                currency: options.currency,
                alreadyApplied: Boolean(stageId),
                appliedOn: options.today,
                stageId: stageId ?? options.stages[0]?.id,
              }}
              submitLabel="Save job"
              onCancel={() => onOpenChange(false)}
              onSubmit={async (values) => {
                const result = await createOpportunityAction(values);
                if (result.ok) {
                  onOpenChange(false);
                  toast.success(
                    result.data.applicationId ? "Job saved and application recorded" : "Job saved",
                    {
                      action: { label: "View", onClick: () => router.push(`/jobs/${result.data.id}`) },
                    },
                  );
                }
                return result;
              }}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
