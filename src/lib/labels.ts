import type {
  ApplicationMethod,
  ApplicationOutcome,
  ApplicationStatus,
  ContactKind,
  DocumentKind,
  EmploymentType,
  InterviewMode,
  InterviewResult,
  InterviewStatus,
  InterviewType,
  OfferStatus,
  Priority,
  SalaryBasis,
  TaskStatus,
  TaskType,
  WorkArrangement,
} from "@/generated/prisma/enums";

/** Human labels for enum values. Client-safe (no Prisma runtime import). */

export const PRIORITY_LABEL: Record<Priority, string> = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };

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

export const SALARY_BASIS_LABEL: Record<SalaryBasis, string> = {
  GROSS: "Gross",
  NET: "Net",
  UNKNOWN: "Unspecified",
};

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  CLOSED: "Closed",
};

export const APPLICATION_OUTCOME_LABEL: Record<ApplicationOutcome, string> = {
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  OFFER_DECLINED: "Offer declined",
  NO_RESPONSE: "No response",
  ROLE_CANCELLED: "Role cancelled",
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

export const INTERVIEW_TYPE_LABEL: Record<InterviewType, string> = {
  RECRUITER_SCREEN: "Recruiter screen",
  PHONE_SCREEN: "Phone screen",
  TECHNICAL: "Technical",
  CODING_CHALLENGE: "Coding challenge",
  ASSESSMENT: "Assessment",
  SYSTEM_DESIGN: "System design",
  BEHAVIORAL: "Behavioral",
  HIRING_MANAGER: "Hiring manager",
  PANEL: "Panel",
  CLIENT: "Client interview",
  FINAL: "Final",
  OTHER: "Other",
};

export const INTERVIEW_MODE_LABEL: Record<InterviewMode, string> = {
  VIDEO: "Video call",
  PHONE: "Phone",
  ONSITE: "Onsite",
  TAKE_HOME: "Take-home",
  OTHER: "Other",
};

export const INTERVIEW_STATUS_LABEL: Record<InterviewStatus, string> = {
  UNSCHEDULED: "Time not set",
  SCHEDULED: "Scheduled",
  RESCHEDULED: "Rescheduled",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const INTERVIEW_RESULT_LABEL: Record<InterviewResult, string> = {
  PENDING: "Pending",
  AWAITING_FEEDBACK: "Awaiting feedback",
  PASSED: "Passed",
  FAILED: "Not passed",
};

export const TASK_TYPE_LABEL: Record<TaskType, string> = {
  FOLLOW_UP: "Follow-up",
  RECRUITER_FOLLOW_UP: "Recruiter follow-up",
  INTERVIEW_PREP: "Interview prep",
  RESUME_UPDATE: "Resume update",
  ASSESSMENT: "Assessment",
  OFFER_DECISION: "Offer decision",
  APPLICATION: "Application",
  OTHER: "Other",
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  SUGGESTED: "Suggested",
  OPEN: "Open",
  COMPLETED: "Completed",
  DISMISSED: "Dismissed",
};

export const CONTACT_KIND_LABEL: Record<ContactKind, string> = {
  RECRUITER: "Recruiter",
  HIRING_MANAGER: "Hiring manager",
  INTERVIEWER: "Interviewer",
  REFERRER: "Referrer",
  OTHER: "Other",
};

export const DOCUMENT_KIND_LABEL: Record<DocumentKind, string> = {
  RESUME: "Resume",
  COVER_LETTER: "Cover letter",
  PORTFOLIO: "Portfolio",
  CERTIFICATE: "Certificate",
  OTHER: "Other",
};

export const OFFER_STATUS_LABEL: Record<OfferStatus, string> = {
  RECEIVED: "Received",
  NEGOTIATING: "Negotiating",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  EXPIRED: "Expired",
  RESCINDED: "Rescinded",
};

/** Job source suggestions (free text is still allowed). */
export const JOB_SOURCES = [
  "LinkedIn",
  "JobStreet",
  "Indeed",
  "Company website",
  "Referral",
  "Recruiter",
  "RemoteOK",
  "Seek",
  "Other",
];

export function enumOptions<T extends string>(labels: Record<T, string>): { value: T; label: string }[] {
  return (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
}
