"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { fieldAria, FormField, SelectInput, TextArea, TextInput } from "@/components/shared/form-controls";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormAlert } from "@/features/auth/components/auth-card";
import { APPLICATION_METHOD_LABEL, enumOptions } from "@/lib/labels";
import { applyAction } from "../actions";
import { applySchema, type ApplyFormValues, type ApplyInput } from "../schemas";

interface ApplyDialogProps {
  opportunityId: string;
  stages: { id: string; name: string }[];
  today: string;
  attemptNumber: number;
  trigger: ReactNode;
}

/** Records an application attempt ("Mark as applied" / "Reapply"). */
export function ApplyDialog({ opportunityId, stages, today, attemptNumber, trigger }: ApplyDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<ApplyFormValues, unknown, ApplyInput>({
    resolver: zodResolver(applySchema),
    defaultValues: { opportunityId, appliedOn: today, stageId: stages[0]?.id },
  });
  const { errors, isSubmitting } = form.formState;

  async function submit(values: ApplyInput) {
    setServerError(null);
    const result = await applyAction(values);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    setOpen(false);
    toast.success(attemptNumber > 1 ? "Reapplication recorded" : "Application recorded");
    router.push(`/applications/${result.data.applicationId}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="rounded-2xl sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {attemptNumber > 1 ? `Reapply (attempt ${attemptNumber})` : "Mark as applied"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {attemptNumber > 1
              ? "Earlier attempts and their interviews stay in the history."
              : "Record when and how you applied. You can attach the resume you sent afterwards."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} noValidate className="grid gap-4 sm:grid-cols-2">
          {serverError ? (
            <div className="sm:col-span-2">
              <FormAlert>{serverError}</FormAlert>
            </div>
          ) : null}
          <FormField id="appliedOn" label="Date applied" required error={errors.appliedOn?.message}>
            <TextInput
              type="date"
              max={today}
              {...fieldAria("appliedOn", errors.appliedOn?.message)}
              {...form.register("appliedOn")}
            />
          </FormField>
          <FormField id="apply-stage" label="Starting stage">
            <SelectInput
              id="apply-stage"
              options={stages.map((stage) => ({ value: stage.id, label: stage.name }))}
              {...form.register("stageId")}
            />
          </FormField>
          <FormField id="apply-method" label="Application method">
            <SelectInput
              id="apply-method"
              placeholder="Not specified"
              options={enumOptions(APPLICATION_METHOD_LABEL)}
              {...form.register("method")}
            />
          </FormField>
          <FormField id="submittedVia" label="Submitted via" hint="e.g. Workday portal, recruiter email">
            <TextInput {...fieldAria("submittedVia", undefined, true)} {...form.register("submittedVia")} />
          </FormField>
          <FormField id="apply-notes" label="Notes" className="sm:col-span-2">
            <TextArea id="apply-notes" className="min-h-[60px]" {...form.register("notes")} />
          </FormField>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <Send aria-hidden /> {isSubmitting ? "Saving..." : "Record application"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
