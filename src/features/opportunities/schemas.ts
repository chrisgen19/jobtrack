import { z } from "zod";
import {
  ApplicationMethod,
  EmploymentType,
  Priority,
  SalaryBasis,
  SalaryPeriod,
  WorkArrangement,
} from "@/generated/prisma/enums";
import {
  currencyCode,
  emptyToUndefined,
  formBoolean,
  optionalDateOnly,
  optionalEnum,
  optionalMoney,
  optionalText,
  optionalUrl,
  optionalUuid,
  requiredText,
  stringList,
} from "@/lib/validations/common";

const opportunityShape = {
  title: requiredText("Job title", 160),
  companyName: requiredText("Company", 120),
  postingUrl: optionalUrl,
  source: optionalText(60),
  referenceCode: optionalText(80),
  description: optionalText(20_000),
  location: optionalText(120),
  workArrangement: optionalEnum(WorkArrangement),
  employmentType: optionalEnum(EmploymentType),
  salaryMin: optionalMoney,
  salaryMax: optionalMoney,
  currency: z.preprocess(emptyToUndefined, currencyCode.optional()),
  salaryPeriod: optionalEnum(SalaryPeriod),
  salaryBasis: z.preprocess(emptyToUndefined, z.enum(SalaryBasis).default("UNKNOWN")),
  priority: z.preprocess(emptyToUndefined, z.enum(Priority).default("MEDIUM")),
  requiredSkills: stringList(30, 40),
  notes: optionalText(5_000),
  deadline: optionalDateOnly,
  savedOn: optionalDateOnly,
  tags: stringList(10, 30),
};

type SalaryFields = { salaryMin?: string; salaryMax?: string; salaryPeriod?: string };

function checkSalary(values: SalaryFields, ctx: z.RefinementCtx) {
  if (values.salaryMin && values.salaryMax && Number(values.salaryMax) < Number(values.salaryMin)) {
    ctx.addIssue({ code: "custom", path: ["salaryMax"], message: "Maximum must be at least the minimum." });
  }
  if ((values.salaryMin || values.salaryMax) && !values.salaryPeriod) {
    ctx.addIssue({
      code: "custom",
      path: ["salaryPeriod"],
      message: "Choose the pay period for this salary.",
    });
  }
}

export const opportunitySchema = z.object(opportunityShape).superRefine(checkSalary);

/** Quick Add can also record that the job was already applied to. */
export const quickAddShape = {
  ...opportunityShape,
  alreadyApplied: formBoolean,
  appliedOn: optionalDateOnly,
  stageId: optionalUuid,
  method: optionalEnum(ApplicationMethod),
};

/** Cross-field checks of Quick Add (also used by the extension's save schema). */
export function checkQuickAdd(
  values: SalaryFields & { alreadyApplied?: boolean; appliedOn?: string },
  ctx: z.RefinementCtx,
) {
  checkSalary(values, ctx);
  if (values.alreadyApplied && !values.appliedOn) {
    ctx.addIssue({ code: "custom", path: ["appliedOn"], message: "Enter the date you applied." });
  }
}

export const quickAddSchema = z.object(quickAddShape).superRefine(checkQuickAdd);

export type OpportunityInput = z.output<typeof opportunitySchema>;
export type OpportunityFormValues = z.input<typeof opportunitySchema>;
export type QuickAddInput = z.output<typeof quickAddSchema>;
export type QuickAddFormValues = z.input<typeof quickAddSchema>;

/** URL search params for the jobs list. */
export const jobListFiltersSchema = z.object({
  view: z.enum(["all", "active", "saved", "closed", "archived"]).catch("all"),
  q: z.string().trim().max(100).optional().catch(undefined),
  stage: z.uuid().optional().catch(undefined),
  priority: z.enum(Priority).optional().catch(undefined),
  work: z.enum(WorkArrangement).optional().catch(undefined),
  source: z.string().trim().max(60).optional().catch(undefined),
});

export type JobListFilters = z.output<typeof jobListFiltersSchema>;
