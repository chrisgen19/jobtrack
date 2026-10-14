"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, Check } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { fieldAria, FormField, SelectInput, TextArea, TextInput } from "@/components/shared/form-controls";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FormAlert } from "@/features/auth/components/auth-card";
import type { ActionResult } from "@/lib/action-result";
import {
  APPLICATION_METHOD_LABEL,
  EMPLOYMENT_TYPE_LABEL,
  enumOptions,
  JOB_SOURCES,
  PRIORITY_LABEL,
  SALARY_BASIS_LABEL,
  WORK_ARRANGEMENT_LABEL,
} from "@/lib/labels";
import { COMMON_CURRENCIES, PERIOD_LABEL } from "@/lib/money";
import { cn } from "@/lib/utils";
import { quickAddSchema, type QuickAddFormValues, type QuickAddInput } from "../schemas";
import { DuplicateWarning } from "./duplicate-warning";

export type StageChoice = { id: string; name: string };

interface OpportunityFormProps {
  mode: "create" | "edit";
  opportunityId?: string;
  defaultValues: Partial<QuickAddFormValues>;
  companyNames: string[];
  stages?: StageChoice[];
  submitLabel: string;
  onSubmit: (values: QuickAddInput) => Promise<ActionResult | ActionResult<unknown>>;
  onCancel?: () => void;
  /** Start with the advanced section open (full edit page). */
  expanded?: boolean;
}

const PERIOD_OPTIONS = Object.entries(PERIOD_LABEL).map(([value, label]) => ({ value, label }));

/**
 * Job form shared by Quick Add (dialog) and the edit page. Only title and
 * company are required; everything else is optional.
 */
export function OpportunityForm({
  mode,
  opportunityId,
  defaultValues,
  companyNames,
  stages = [],
  submitLabel,
  onSubmit,
  onCancel,
  expanded = false,
}: OpportunityFormProps) {
  const [showMore, setShowMore] = useState(expanded);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<QuickAddFormValues, unknown, QuickAddInput>({
    resolver: zodResolver(quickAddSchema),
    defaultValues: { priority: "MEDIUM", salaryBasis: "UNKNOWN", alreadyApplied: false, ...defaultValues },
  });
  const { errors, isSubmitting } = form.formState;
  const [title, companyName, postingUrl, alreadyApplied] = useWatch({
    control: form.control,
    name: ["title", "companyName", "postingUrl", "alreadyApplied"],
  });
  const err = (name: keyof QuickAddFormValues) => errors[name]?.message as string | undefined;

  async function submit(values: QuickAddInput) {
    setServerError(null);
    const result = await onSubmit(values);
    if (!result.ok) {
      setServerError(result.error);
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages?.[0]) form.setError(field as keyof QuickAddFormValues, { message: messages[0] });
      }
    }
  }

  const currencies = [...COMMON_CURRENCIES];

  return (
    <form onSubmit={form.handleSubmit(submit)} noValidate className="flex flex-col gap-4">
      {serverError ? <FormAlert>{serverError}</FormAlert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="title" label="Job title" required error={err("title")}>
          <TextInput
            placeholder="e.g. Full-Stack Developer"
            {...fieldAria("title", err("title"))}
            {...form.register("title")}
          />
        </FormField>
        <FormField id="companyName" label="Company" required error={err("companyName")}>
          <TextInput
            placeholder="e.g. Acme Studio"
            list="company-names"
            autoComplete="off"
            {...fieldAria("companyName", err("companyName"))}
            {...form.register("companyName")}
          />
          <datalist id="company-names">
            {companyNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </FormField>

        <div className="sm:col-span-2">
          <DuplicateWarning
            title={String(title ?? "")}
            companyName={String(companyName ?? "")}
            postingUrl={String(postingUrl ?? "")}
            excludeId={opportunityId}
          />
        </div>

        <FormField id="salaryMin" label="Minimum salary" error={err("salaryMin")}>
          <TextInput
            inputMode="decimal"
            placeholder="120000"
            {...fieldAria("salaryMin", err("salaryMin"))}
            {...form.register("salaryMin")}
          />
        </FormField>
        <FormField id="salaryMax" label="Maximum salary" error={err("salaryMax")}>
          <TextInput
            inputMode="decimal"
            placeholder="150000"
            {...fieldAria("salaryMax", err("salaryMax"))}
            {...form.register("salaryMax")}
          />
        </FormField>
        <FormField
          id="currency"
          label="Currency"
          error={err("currency")}
          hint="Any ISO 4217 code (PHP, AUD, USD...)."
        >
          <TextInput
            list="currency-codes"
            maxLength={3}
            className="uppercase"
            {...fieldAria("currency", err("currency"), true)}
            {...form.register("currency")}
          />
          <datalist id="currency-codes">
            {currencies.map((code) => (
              <option key={code} value={code} />
            ))}
          </datalist>
        </FormField>
        <FormField id="salaryPeriod" label="Salary period" error={err("salaryPeriod")}>
          <SelectInput
            id="salaryPeriod"
            placeholder="Not specified"
            options={PERIOD_OPTIONS}
            {...form.register("salaryPeriod")}
          />
        </FormField>
        <FormField id="priority" label="Priority">
          <SelectInput
            id="priority"
            options={enumOptions(PRIORITY_LABEL).reverse()}
            {...form.register("priority")}
          />
        </FormField>
        <FormField id="workArrangement" label="Work arrangement">
          <SelectInput
            id="workArrangement"
            placeholder="Not specified"
            options={enumOptions(WORK_ARRANGEMENT_LABEL)}
            {...form.register("workArrangement")}
          />
        </FormField>
        <FormField id="location" label="Location">
          <TextInput
            placeholder="e.g. Manila, PH"
            {...fieldAria("location")}
            {...form.register("location")}
          />
        </FormField>
        <FormField id="source" label="Job source">
          <TextInput
            list="job-sources"
            placeholder="e.g. LinkedIn"
            {...fieldAria("source")}
            {...form.register("source")}
          />
          <datalist id="job-sources">
            {JOB_SOURCES.map((source) => (
              <option key={source} value={source} />
            ))}
          </datalist>
        </FormField>
        <FormField
          id="postingUrl"
          label="Job posting URL"
          error={err("postingUrl")}
          className="sm:col-span-2"
        >
          <TextInput
            type="url"
            placeholder="https://..."
            {...fieldAria("postingUrl", err("postingUrl"))}
            {...form.register("postingUrl")}
          />
        </FormField>

        {mode === "create" && stages.length > 0 ? (
          <div className="rounded-xl border border-line bg-surface-2 p-3.5 sm:col-span-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="alreadyApplied"
                checked={Boolean(alreadyApplied)}
                onCheckedChange={(checked) => form.setValue("alreadyApplied", checked === true)}
              />
              <Label htmlFor="alreadyApplied" className="text-xs font-semibold">
                I&apos;ve already applied to this job
              </Label>
            </div>
            {alreadyApplied ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <FormField id="appliedOn" label="Date applied" error={err("appliedOn")}>
                  <TextInput
                    type="date"
                    {...fieldAria("appliedOn", err("appliedOn"))}
                    {...form.register("appliedOn")}
                  />
                </FormField>
                <FormField id="stageId" label="Hiring stage">
                  <SelectInput
                    id="stageId"
                    options={stages.map((stage) => ({ value: stage.id, label: stage.name }))}
                    {...form.register("stageId")}
                  />
                </FormField>
                <FormField id="method" label="Applied via">
                  <SelectInput
                    id="method"
                    placeholder="Not specified"
                    options={enumOptions(APPLICATION_METHOD_LABEL)}
                    {...form.register("method")}
                  />
                </FormField>
              </div>
            ) : null}
          </div>
        ) : null}

        <FormField id="description" label="Job description" className="sm:col-span-2">
          <TextArea
            placeholder="Paste the job description here..."
            {...fieldAria("description")}
            {...form.register("description")}
          />
        </FormField>
        <FormField id="notes" label="Personal notes" className="sm:col-span-2">
          <TextArea
            className="min-h-[60px]"
            placeholder="What makes this opportunity interesting?"
            {...fieldAria("notes")}
            {...form.register("notes")}
          />
        </FormField>
      </div>

      <button
        type="button"
        onClick={() => setShowMore((open) => !open)}
        aria-expanded={showMore}
        className="flex items-center gap-1.5 self-start text-xs font-bold text-brand"
      >
        <ChevronDown className={cn("size-3.5 transition-transform", showMore && "rotate-180")} aria-hidden />
        {showMore ? "Fewer details" : "More details (skills, tags, deadline...)"}
      </button>

      {showMore ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="employmentType" label="Employment type">
            <SelectInput
              id="employmentType"
              placeholder="Not specified"
              options={enumOptions(EMPLOYMENT_TYPE_LABEL)}
              {...form.register("employmentType")}
            />
          </FormField>
          <FormField id="salaryBasis" label="Salary basis">
            <SelectInput
              id="salaryBasis"
              options={enumOptions(SALARY_BASIS_LABEL)}
              {...form.register("salaryBasis")}
            />
          </FormField>
          <FormField
            id="requiredSkills"
            label="Required skills"
            hint="Comma separated, e.g. React, TypeScript"
            error={err("requiredSkills")}
            className="sm:col-span-2"
          >
            <TextInput
              {...fieldAria("requiredSkills", err("requiredSkills"), true)}
              {...form.register("requiredSkills")}
            />
          </FormField>
          <FormField id="tags" label="Tags" hint="Your own labels, comma separated" error={err("tags")}>
            <TextInput {...fieldAria("tags", err("tags"), true)} {...form.register("tags")} />
          </FormField>
          <FormField id="referenceCode" label="Reference / requisition code">
            <TextInput {...fieldAria("referenceCode")} {...form.register("referenceCode")} />
          </FormField>
          <FormField id="deadline" label="Application deadline" error={err("deadline")}>
            <TextInput
              type="date"
              {...fieldAria("deadline", err("deadline"))}
              {...form.register("deadline")}
            />
          </FormField>
          <FormField id="savedOn" label="Date saved" error={err("savedOn")}>
            <TextInput type="date" {...fieldAria("savedOn", err("savedOn"))} {...form.register("savedOn")} />
          </FormField>
        </div>
      ) : null}

      <div className="flex justify-end gap-2 border-t border-[#edf1ed] pt-4">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting}>
          <Check aria-hidden /> {isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
