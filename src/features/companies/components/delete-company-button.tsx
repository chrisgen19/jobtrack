"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { deleteCompanyAction } from "../actions";

export function DeleteCompanyButton({
  companyId,
  name,
  jobCount,
}: {
  companyId: string;
  name: string;
  jobCount: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete ${name}`}
        disabled={jobCount > 0}
        title={jobCount > 0 ? "Companies with saved jobs can't be deleted" : undefined}
        onClick={() => setOpen(true)}
      >
        <Trash2 aria-hidden />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete ${name}?`}
        destructive
        confirmLabel="Delete company"
        description="The company and its contacts will be deleted. This cannot be undone."
        onConfirm={async () => {
          const result = await deleteCompanyAction(companyId);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Company deleted");
          setOpen(false);
        }}
      />
    </>
  );
}
