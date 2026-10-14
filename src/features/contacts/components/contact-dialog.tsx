"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
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
import { CONTACT_KIND_LABEL, enumOptions } from "@/lib/labels";
import { createContactAction, updateContactAction } from "../actions";
import type { ContactDto } from "../data";

interface ContactDialogProps {
  contact?: ContactDto;
  companyNames: string[];
  trigger: ReactNode;
}

export function ContactDialog({ contact, companyNames, trigger }: ContactDialogProps) {
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, setPending] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{contact ? "Edit contact" : "Add a contact"}</DialogTitle>
          <DialogDescription className="text-xs">
            Recruiters, hiring managers and interviewers. Contacts are private to your workspace.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const data = Object.fromEntries(new FormData(event.currentTarget));
            setPending(true);
            const result = contact
              ? await updateContactAction({ ...data, contactId: contact.id })
              : await createContactAction(data);
            setPending(false);
            if (!result.ok) {
              setErrors(result.fieldErrors ?? {});
              toast.error(result.error);
              return;
            }
            setErrors({});
            toast.success(contact ? "Contact updated" : "Contact added");
            setOpen(false);
          }}
        >
          <FormField id="contact-name" label="Name" required error={errors.name?.[0]}>
            <TextInput id="contact-name" name="name" defaultValue={contact?.name} maxLength={120} required />
          </FormField>
          <FormField id="contact-company" label="Company" required error={errors.companyName?.[0]}>
            <TextInput
              id="contact-company"
              name="companyName"
              list="contact-company-names"
              autoComplete="off"
              defaultValue={contact?.companyName}
              maxLength={120}
              required
            />
            <datalist id="contact-company-names">
              {companyNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </FormField>
          <FormField id="contact-title" label="Position / title">
            <TextInput
              id="contact-title"
              name="title"
              defaultValue={contact?.title ?? ""}
              maxLength={120}
              placeholder="e.g. Talent Partner"
            />
          </FormField>
          <FormField id="contact-kind" label="Role in your process">
            <SelectInput
              id="contact-kind"
              name="kind"
              defaultValue={contact?.kind ?? "RECRUITER"}
              options={enumOptions(CONTACT_KIND_LABEL)}
            />
          </FormField>
          <FormField id="contact-email" label="Email" error={errors.email?.[0]}>
            <TextInput id="contact-email" name="email" type="email" defaultValue={contact?.email ?? ""} />
          </FormField>
          <FormField id="contact-phone" label="Phone">
            <TextInput
              id="contact-phone"
              name="phone"
              type="tel"
              defaultValue={contact?.phone ?? ""}
              maxLength={40}
            />
          </FormField>
          <FormField
            id="contact-linkedin"
            label="LinkedIn URL"
            error={errors.linkedinUrl?.[0]}
            className="sm:col-span-2"
          >
            <TextInput
              id="contact-linkedin"
              name="linkedinUrl"
              type="url"
              defaultValue={contact?.linkedinUrl ?? ""}
              placeholder="https://www.linkedin.com/in/..."
            />
          </FormField>
          <FormField id="contact-notes" label="Notes" className="sm:col-span-2">
            <TextArea
              id="contact-notes"
              name="notes"
              defaultValue={contact?.notes ?? ""}
              className="min-h-[60px]"
              maxLength={5000}
            />
          </FormField>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : contact ? "Save changes" : "Add contact"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
