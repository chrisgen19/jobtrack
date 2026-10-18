import type {
  ApplicationMethod,
  ContactKind,
  EmploymentType,
  FollowUpType,
  Priority,
  SalaryBasis,
  SalaryPeriod,
  WorkArrangement,
} from "@jobtrack/shared/extension-api";

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

export const SALARY_BASIS_LABEL: Record<Exclude<SalaryBasis, "UNKNOWN">, string> = {
  GROSS: "Gross",
  NET: "Net",
};

export const APPLICATION_METHOD_LABEL: Record<ApplicationMethod, string> = {
  COMPANY_WEBSITE: "Company website",
  JOB_BOARD: "Job board",
  LINKEDIN_EASY_APPLY: "LinkedIn Easy Apply",
  EMAIL: "Email",
  REFERRAL: "Referral",
  RECRUITER: "Through a recruiter",
  OTHER: "Other",
};

export const CONTACT_KIND_LABEL: Record<ContactKind, string> = {
  RECRUITER: "Recruiter",
  HIRING_MANAGER: "Hiring manager",
  INTERVIEWER: "Interviewer",
  REFERRER: "Referrer",
  OTHER: "Other",
};

/** Extension-only: the to-do added with a saved job. */
export const FOLLOW_UP_TYPE_LABEL: Record<FollowUpType, string> = {
  APPLY: "Apply by",
  FOLLOW_UP: "Follow up on",
};

export const PRIORITY_LABEL: Record<Priority, string> = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };

export function options<T extends string>(labels: Record<T, string>): { value: T; label: string }[] {
  return (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
}
