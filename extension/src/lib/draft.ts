import type { EmploymentType, Priority, SalaryPeriod, WorkArrangement } from "@jobtrack/shared/extension-api";

/** How much of the page could be read: JobPosting data, page meta only, or nothing. */
export type PageStatus = "found" | "partial" | "unreadable";

/** Values of the review form. Enum fields use "" for "not set". */
export type DraftValues = {
  title: string;
  companyName: string;
  postingUrl: string;
  source: string;
  location: string;
  description: string;
  workArrangement: WorkArrangement | "";
  employmentType: EmploymentType | "";
  salaryMin: string;
  salaryMax: string;
  currency: string;
  salaryPeriod: SalaryPeriod | "";
  priority: Priority;
  notes: string;
  alreadyApplied: boolean;
  appliedOn: string;
  stageId: string;
};

export function emptyDraft(): DraftValues {
  return {
    title: "",
    companyName: "",
    postingUrl: "",
    source: "",
    location: "",
    description: "",
    workArrangement: "",
    employmentType: "",
    salaryMin: "",
    salaryMax: "",
    currency: "",
    salaryPeriod: "",
    priority: "MEDIUM",
    notes: "",
    alreadyApplied: false,
    appliedOn: "",
    stageId: "",
  };
}
