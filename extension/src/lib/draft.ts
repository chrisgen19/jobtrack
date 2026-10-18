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

/** How much of the page could be read: JobPosting data, page meta only, or nothing. */
export type PageStatus = "found" | "partial" | "unreadable";

/**
 * Values of the review form. Enum fields use "" for "not set". The contact
 * and to-do fields are flat here and nested by toPayload().
 */
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
  salaryBasis: SalaryBasis | "";
  priority: Priority;
  notes: string;
  referenceCode: string;
  requiredSkills: string[];
  tags: string[];
  deadline: string;
  companyWebsite: string;
  alreadyApplied: boolean;
  appliedOn: string;
  stageId: string;
  method: ApplicationMethod | "";
  saveContact: boolean;
  contactName: string;
  contactTitle: string;
  contactEmail: string;
  contactLinkedinUrl: string;
  contactKind: ContactKind;
  addFollowUp: boolean;
  followUpType: FollowUpType;
  followUpDate: string;
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
    salaryBasis: "",
    priority: "MEDIUM",
    notes: "",
    referenceCode: "",
    requiredSkills: [],
    tags: [],
    deadline: "",
    companyWebsite: "",
    alreadyApplied: false,
    appliedOn: "",
    stageId: "",
    method: "",
    saveContact: false,
    contactName: "",
    contactTitle: "",
    contactEmail: "",
    contactLinkedinUrl: "",
    contactKind: "RECRUITER",
    addFollowUp: false,
    followUpType: "APPLY",
    followUpDate: "",
  };
}

/** Why a prefilled value needs a look: guessed from the page text, or suggested by AI. */
export type FieldMark = "check" | "ai";

/** Marked fields of a form; a field's mark goes away once the user edits it. */
export type FieldMarks = Partial<Record<keyof DraftValues, FieldMark>>;
