"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { FormField, TextArea, TextInput } from "@/components/shared/form-controls";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createCompanyAction, updateCompanyAction } from "../actions";
import type { CompanySummary } from "../data";

interface CompanyDialogProps {
  company?: CompanySummary;
  trigger: ReactNode;
}

export function CompanyDialog({ company, trigger }: CompanyDialogProps) {
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, setPending] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="rounded-2xl sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{company ? "Edit company" : "Add a company"}</DialogTitle>
          <DialogDescription className="text-xs">
            Companies group your jobs and recruiter contacts.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const data = Object.fromEntries(new FormData(event.currentTarget));
            setPending(true);
            const result = company
              ? await updateCompanyAction(company.id, data)
              : await createCompanyAction(data);
            setPending(false);
            if (!result.ok) {
              setErrors(result.fieldErrors ?? {});
              toast.error(result.error);
              return;
            }
            setErrors({});
            toast.success(company ? "Company updated" : "Company added");
            setOpen(false);
          }}
        >
          <FormField
            id="company-name"
            label="Name"
            required
            error={errors.name?.[0]}
            className="sm:col-span-2"
          >
            <TextInput id="company-name" name="name" defaultValue={company?.name} maxLength={120} required />
          </FormField>
          <FormField id="company-website" label="Website" error={errors.website?.[0]}>
            <TextInput
              id="company-website"
              name="website"
              type="url"
              placeholder="https://"
              defaultValue={company?.website ?? ""}
            />
          </FormField>
          <FormField id="company-location" label="Location">
            <TextInput
              id="company-location"
              name="location"
              defaultValue={company?.location ?? ""}
              maxLength={120}
            />
          </FormField>
          <FormField id="company-industry" label="Industry" className="sm:col-span-2">
            <TextInput
              id="company-industry"
              name="industry"
              defaultValue={company?.industry ?? ""}
              maxLength={80}
            />
          </FormField>
          <FormField id="company-notes" label="Notes" className="sm:col-span-2">
            <TextArea id="company-notes" name="notes" defaultValue={company?.notes ?? ""} maxLength={5000} />
          </FormField>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : company ? "Save changes" : "Add company"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
