"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { deleteContactAction } from "../actions";

export function DeleteContactButton({ contactId, name }: { contactId: string; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="icon-sm" aria-label={`Delete ${name}`} onClick={() => setOpen(true)}>
        <Trash2 aria-hidden />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete ${name}?`}
        destructive
        confirmLabel="Delete contact"
        description="The contact is removed from your workspace and from any interviews they were linked to."
        onConfirm={async () => {
          const result = await deleteContactAction({ contactId });
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Contact deleted");
          setOpen(false);
        }}
      />
    </>
  );
}
