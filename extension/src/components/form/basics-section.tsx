import type { DraftValues } from "@/lib/draft";
import { EMPLOYMENT_TYPE_LABEL, options, PRIORITY_LABEL, WORK_ARRANGEMENT_LABEL } from "@/lib/labels";
import { Field, Select, TextInput } from "../fields";
import type { SectionProps } from "./section-props";

export function BasicsSection({ values, errors, marks, set }: SectionProps) {
  return (
    <>
      <Field id="title" mark={marks.get("title")} label="Job title *" error={errors.title}>
        <TextInput
          id="title"
          required
          maxLength={160}
          value={values.title}
          invalid={!!errors.title}
          onChange={(event) => set("title", event.target.value)}
        />
      </Field>
      <Field id="companyName" label="Company *" error={errors.companyName} mark={marks.get("companyName")}>
        <TextInput
          id="companyName"
          required
          maxLength={120}
          value={values.companyName}
          invalid={!!errors.companyName}
          onChange={(event) => set("companyName", event.target.value)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2.5">
        <Field id="location" mark={marks.get("location")} label="Location" error={errors.location}>
          <TextInput
            id="location"
            maxLength={120}
            value={values.location}
            onChange={(event) => set("location", event.target.value)}
          />
        </Field>
        <Field id="workArrangement" label="Work setup" mark={marks.get("workArrangement")}>
          <Select
            id="workArrangement"
            placeholder="Not set"
            options={options(WORK_ARRANGEMENT_LABEL)}
            value={values.workArrangement}
            onChange={(event) => set("workArrangement", event.target.value as DraftValues["workArrangement"])}
          />
        </Field>
        <Field id="employmentType" label="Type" mark={marks.get("employmentType")}>
          <Select
            id="employmentType"
            placeholder="Not set"
            options={options(EMPLOYMENT_TYPE_LABEL)}
            value={values.employmentType}
            onChange={(event) => set("employmentType", event.target.value as DraftValues["employmentType"])}
          />
        </Field>
        <Field id="priority" label="Priority">
          <Select
            id="priority"
            options={options(PRIORITY_LABEL)}
            value={values.priority}
            onChange={(event) => set("priority", event.target.value as DraftValues["priority"])}
          />
        </Field>
      </div>
    </>
  );
}
