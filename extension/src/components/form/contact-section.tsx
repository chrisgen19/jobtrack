import type { DraftValues } from "@/lib/draft";
import { CONTACT_KIND_LABEL, options } from "@/lib/labels";
import { Field, Select, TextInput } from "../fields";
import type { SectionProps } from "./section-props";

/** Recruiter or hiring manager from the posting, saved as a contact of the company. */
export function ContactSection({ values, errors, guessed, set }: SectionProps) {
  return (
    <div className="flex flex-col gap-2.5 rounded-[10px] bg-surface-2 p-3">
      <label className="flex items-center gap-2 text-xs font-bold text-ink">
        <input
          type="checkbox"
          className="size-4 accent-brand"
          checked={values.saveContact}
          onChange={(event) => set("saveContact", event.target.checked)}
        />
        Save a contact for this company
      </label>
      {values.saveContact ? (
        <div className="grid grid-cols-2 gap-2.5">
          <Field id="contactName" label="Name *" error={errors.contactName}>
            <TextInput
              id="contactName"
              maxLength={120}
              value={values.contactName}
              invalid={!!errors.contactName}
              onChange={(event) => set("contactName", event.target.value)}
            />
          </Field>
          <Field id="contactKind" label="Role" error={errors.contactKind}>
            <Select
              id="contactKind"
              options={options(CONTACT_KIND_LABEL)}
              value={values.contactKind}
              invalid={!!errors.contactKind}
              onChange={(event) => set("contactKind", event.target.value as DraftValues["contactKind"])}
            />
          </Field>
          <Field id="contactTitle" label="Job title" error={errors.contactTitle} className="col-span-2">
            <TextInput
              id="contactTitle"
              maxLength={120}
              value={values.contactTitle}
              invalid={!!errors.contactTitle}
              onChange={(event) => set("contactTitle", event.target.value)}
            />
          </Field>
          <Field
            id="contactEmail"
            label="Email"
            error={errors.contactEmail}
            guessed={guessed.has("contactEmail")}
          >
            <TextInput
              id="contactEmail"
              type="email"
              value={values.contactEmail}
              invalid={!!errors.contactEmail}
              onChange={(event) => set("contactEmail", event.target.value)}
            />
          </Field>
          <Field id="contactLinkedinUrl" label="LinkedIn" error={errors.contactLinkedinUrl}>
            <TextInput
              id="contactLinkedinUrl"
              type="url"
              placeholder="https://www.linkedin.com/in/..."
              value={values.contactLinkedinUrl}
              invalid={!!errors.contactLinkedinUrl}
              onChange={(event) => set("contactLinkedinUrl", event.target.value)}
            />
          </Field>
        </div>
      ) : null}
    </div>
  );
}
