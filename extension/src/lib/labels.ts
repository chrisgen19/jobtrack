import type { EmploymentType, Priority, SalaryPeriod, WorkArrangement } from "@jobtrack/shared/extension-api";

// Same wording as the web app (src/lib/labels.ts).
export const WORK_ARRANGEMENT_LABEL: Record<WorkArrangement, string> = {
  REMOTE: "Remote",
  HYBRID: "Hybrid",
  ONSITE: "Onsite",
};

export const EMPLOYMENT_TYPE_LABEL: Record<EmploymentType, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
  FREELANCE: "Freelance",
  INTERNSHIP: "Internship",
  TEMPORARY: "Temporary",
  OTHER: "Other",
};

export const SALARY_PERIOD_LABEL: Record<SalaryPeriod, string> = {
  HOURLY: "per hour",
  DAILY: "per day",
  WEEKLY: "per week",
  MONTHLY: "per month",
  ANNUALLY: "per year",
};

export const PRIORITY_LABEL: Record<Priority, string> = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };

export function options<T extends string>(labels: Record<T, string>): { value: T; label: string }[] {
  return (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
}
