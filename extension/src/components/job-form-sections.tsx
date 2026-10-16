import type { ExtensionMe } from "@jobtrack/shared/extension-api";
import type { DraftValues } from "@/lib/draft";
import {
  EMPLOYMENT_TYPE_LABEL,
  options,
  PRIORITY_LABEL,
  SALARY_PERIOD_LABEL,
  WORK_ARRANGEMENT_LABEL,
} from "@/lib/labels";
import { Field, Select, TextArea, TextInput } from "./fields";

export type SectionProps = {
  values: DraftValues;
  errors: Partial<Record<keyof DraftValues, string>>;
  set: <K extends keyof DraftValues>(key: K, value: DraftValues[K]) => void;
};

export function BasicsSection({ values, errors, set }: SectionProps) {
  return (
    <>
      <Field id="title" label="Job title *" error={errors.title}>
        <TextInput
          id="title"
          required
          maxLength={160}
          value={values.title}
          invalid={!!errors.title}
          onChange={(event) => set("title", event.target.value)}
        />
      </Field>
      <Field id="companyName" label="Company *" error={errors.companyName}>
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
        <Field id="location" label="Location" error={errors.location}>
          <TextInput
            id="location"
            maxLength={120}
            value={values.location}
            onChange={(event) => set("location", event.target.value)}
          />
        </Field>
        <Field id="workArrangement" label="Work setup">
          <Select
            id="workArrangement"
            placeholder="Not set"
            options={options(WORK_ARRANGEMENT_LABEL)}
            value={values.workArrangement}
            onChange={(event) => set("workArrangement", event.target.value as DraftValues["workArrangement"])}
          />
        </Field>
        <Field id="employmentType" label="Type">
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

export function SalarySection({
  values,
  errors,
  set,
  defaultCurrency,
}: SectionProps & { defaultCurrency: string }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <Field id="salaryMin" label="Salary min" error={errors.salaryMin}>
        <TextInput
          id="salaryMin"
          inputMode="decimal"
          value={values.salaryMin}
          invalid={!!errors.salaryMin}
          onChange={(event) => set("salaryMin", event.target.value)}
        />
      </Field>
      <Field id="salaryMax" label="Salary max" error={errors.salaryMax}>
        <TextInput
          id="salaryMax"
          inputMode="decimal"
          value={values.salaryMax}
          invalid={!!errors.salaryMax}
          onChange={(event) => set("salaryMax", event.target.value)}
        />
      </Field>
      <Field id="currency" label="Currency" error={errors.currency}>
        <TextInput
          id="currency"
          maxLength={3}
          placeholder={defaultCurrency}
          value={values.currency}
          invalid={!!errors.currency}
          onChange={(event) => set("currency", event.target.value.toUpperCase())}
        />
      </Field>
      <Field id="salaryPeriod" label="Pay period" error={errors.salaryPeriod}>
        <Select
          id="salaryPeriod"
          placeholder="Not set"
          options={options(SALARY_PERIOD_LABEL)}
          value={values.salaryPeriod}
          invalid={!!errors.salaryPeriod}
          onChange={(event) => set("salaryPeriod", event.target.value as DraftValues["salaryPeriod"])}
        />
      </Field>
    </div>
  );
}

export function DetailsSection({ values, errors, set }: SectionProps) {
  return (
    <>
      <div className="grid grid-cols-[1fr_120px] gap-2.5">
        <Field id="postingUrl" label="Posting URL" error={errors.postingUrl}>
          <TextInput
            id="postingUrl"
            type="url"
            value={values.postingUrl}
            invalid={!!errors.postingUrl}
            onChange={(event) => set("postingUrl", event.target.value)}
          />
        </Field>
        <Field id="source" label="Source">
          <TextInput
            id="source"
            maxLength={60}
            value={values.source}
            onChange={(event) => set("source", event.target.value)}
          />
        </Field>
      </div>
      <Field id="description" label="Description" error={errors.description}>
        <TextArea
          id="description"
          rows={5}
          maxLength={20_000}
          value={values.description}
          onChange={(event) => set("description", event.target.value)}
        />
      </Field>
      <Field id="notes" label="Notes" error={errors.notes}>
        <TextArea
          id="notes"
          rows={2}
          maxLength={5_000}
          value={values.notes}
          onChange={(event) => set("notes", event.target.value)}
        />
      </Field>
    </>
  );
}

export function ApplySection({
  values,
  errors,
  set,
  stages,
}: SectionProps & { stages: ExtensionMe["stages"] }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-[10px] bg-surface-2 p-3">
      <label className="flex items-center gap-2 text-xs font-bold text-ink">
        <input
          type="checkbox"
          className="size-4 accent-brand"
          checked={values.alreadyApplied}
          onChange={(event) => set("alreadyApplied", event.target.checked)}
        />
        I already applied
      </label>
      {values.alreadyApplied ? (
        <div className="grid grid-cols-2 gap-2.5">
          <Field id="appliedOn" label="Applied on" error={errors.appliedOn}>
            <TextInput
              id="appliedOn"
              type="date"
              value={values.appliedOn}
              invalid={!!errors.appliedOn}
              onChange={(event) => set("appliedOn", event.target.value)}
            />
          </Field>
          <Field id="stageId" label="Stage" error={errors.stageId}>
            <Select
              id="stageId"
              options={stages.map((stage) => ({ value: stage.id, label: stage.name }))}
              value={values.stageId}
              onChange={(event) => set("stageId", event.target.value)}
            />
          </Field>
        </div>
      ) : null}
    </div>
  );
}
