import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { DraftValues } from "@/lib/draft";
import { options, SALARY_BASIS_LABEL } from "@/lib/labels";
import { ChipsInput } from "../chips-input";
import { Field, Select, TextInput } from "../fields";
import type { SectionProps } from "./section-props";

/** Skills, tags, deadline, reference, pay basis and company website; open when the page filled any of them. */
export function MoreSection({ values, errors, marks, set }: SectionProps) {
  const [open, setOpen] = useState(
    () =>
      values.requiredSkills.length > 0 ||
      Boolean(values.deadline || values.referenceCode || values.companyWebsite || values.salaryBasis),
  );
  return (
    <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)} className="group">
      <summary className="flex cursor-pointer list-none items-center gap-1 text-[11px] font-bold text-subtle select-none hover:text-ink">
        <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" aria-hidden />
        More details
      </summary>
      <div className="mt-2.5 flex flex-col gap-2.5">
        <Field
          id="requiredSkills"
          mark={marks.get("requiredSkills")}
          label="Skills"
          error={errors.requiredSkills}
        >
          <ChipsInput
            id="requiredSkills"
            values={values.requiredSkills}
            maxItems={30}
            maxLength={40}
            placeholder="React, SQL..."
            onChange={(next) => set("requiredSkills", next)}
          />
        </Field>
        <Field id="tags" label="Tags" error={errors.tags}>
          <ChipsInput
            id="tags"
            values={values.tags}
            maxItems={10}
            maxLength={30}
            placeholder="dream-job, remote..."
            onChange={(next) => set("tags", next)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2.5">
          <Field id="deadline" label="Deadline" error={errors.deadline} mark={marks.get("deadline")}>
            <TextInput
              id="deadline"
              type="date"
              value={values.deadline}
              invalid={!!errors.deadline}
              onChange={(event) => set("deadline", event.target.value)}
            />
          </Field>
          <Field id="salaryBasis" label="Pay basis" mark={marks.get("salaryBasis")}>
            <Select
              id="salaryBasis"
              placeholder="Not stated"
              options={options(SALARY_BASIS_LABEL)}
              value={values.salaryBasis === "UNKNOWN" ? "" : values.salaryBasis}
              onChange={(event) => set("salaryBasis", event.target.value as DraftValues["salaryBasis"])}
            />
          </Field>
          <Field
            id="referenceCode"
            mark={marks.get("referenceCode")}
            label="Reference"
            error={errors.referenceCode}
          >
            <TextInput
              id="referenceCode"
              maxLength={80}
              value={values.referenceCode}
              onChange={(event) => set("referenceCode", event.target.value)}
            />
          </Field>
          <Field
            id="companyWebsite"
            mark={marks.get("companyWebsite")}
            label="Company website"
            error={errors.companyWebsite}
          >
            <TextInput
              id="companyWebsite"
              type="url"
              placeholder="https://"
              value={values.companyWebsite}
              invalid={!!errors.companyWebsite}
              onChange={(event) => set("companyWebsite", event.target.value)}
            />
          </Field>
        </div>
      </div>
    </details>
  );
}
