"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { ApplicationMethod } from "@/generated/prisma/enums";
import { FormField, SelectInput, TextArea, TextInput } from "@/components/shared/form-controls";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { APPLICATION_METHOD_LABEL, enumOptions } from "@/lib/labels";
import { updateApplicationDetailsAction } from "../actions";

interface ApplicationDetailsDialogProps {
  applicationId: string;
  appliedOn: string;
  method: ApplicationMethod | null;
  submittedVia: string | null;
  notes: string | null;
  today: string;
}

export function ApplicationDetailsDialog({
  applicationId,
  appliedOn,
  method,
  submittedVia,
  notes,
  today,
}: ApplicationDetailsDialogProps) {
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, setPending] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil aria-hidden /> Edit details
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Application details</DialogTitle>
          <DialogDescription className="text-xs">
            Back-dated entries are fine. The date is stored exactly as entered.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            setPending(true);
            const result = await updateApplicationDetailsAction({
              applicationId,
              appliedOn: data.get("appliedOn"),
              method: data.get("method"),
              submittedVia: data.get("submittedVia"),
              notes: data.get("notes"),
            });
            setPending(false);
            if (!result.ok) {
              setErrors(result.fieldErrors ?? {});
              toast.error(result.error);
              return;
            }
            toast.success("Application updated");
            setOpen(false);
          }}
        >
          <FormField id="details-appliedOn" label="Date applied" error={errors.appliedOn?.[0]}>
            <TextInput
              id="details-appliedOn"
              name="appliedOn"
              type="date"
              defaultValue={appliedOn}
              max={today}
              required
            />
          </FormField>
          <FormField id="details-method" label="Application method">
            <SelectInput
              id="details-method"
              name="method"
              defaultValue={method ?? ""}
              placeholder="Not specified"
              options={enumOptions(APPLICATION_METHOD_LABEL)}
            />
          </FormField>
          <FormField id="details-via" label="Submitted via" className="sm:col-span-2">
            <TextInput
              id="details-via"
              name="submittedVia"
              defaultValue={submittedVia ?? ""}
              maxLength={80}
            />
          </FormField>
          <FormField id="details-notes" label="Notes" className="sm:col-span-2">
            <TextArea id="details-notes" name="notes" defaultValue={notes ?? ""} maxLength={2000} />
          </FormField>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
