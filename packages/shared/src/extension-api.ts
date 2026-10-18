import { z } from "zod";

/**
 * Contract between the JobTrack web app and the browser extension
 * (`/api/extension/v1/*` and the connect handshake). The web app validates
 * every draft again with its own form schema, so the limits here only give
 * the extension early feedback.
 */

export const EXTENSION_TOKEN_PREFIX = "jt_ext_";
export const EXTENSION_CONNECT_MESSAGE = "jobtrack:connect";

// Plain copies of the Prisma enums; a web test fails CI if they drift.
export const WORK_ARRANGEMENTS = ["REMOTE", "HYBRID", "ONSITE"] as const;
export const EMPLOYMENT_TYPES = [
  "FULL_TIME",
  "PART_TIME",
  "CONTRACT",
  "FREELANCE",
  "INTERNSHIP",
  "TEMPORARY",
  "OTHER",
] as const;
export const SALARY_PERIODS = ["HOURLY", "DAILY", "WEEKLY", "MONTHLY", "ANNUALLY"] as const;
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export const SALARY_BASES = ["GROSS", "NET", "UNKNOWN"] as const;
export const APPLICATION_METHODS = [
  "COMPANY_WEBSITE",
  "JOB_BOARD",
  "LINKEDIN_EASY_APPLY",
  "EMAIL",
  "REFERRAL",
  "RECRUITER",
  "OTHER",
] as const;
export const CONTACT_KINDS = ["RECRUITER", "HIRING_MANAGER", "INTERVIEWER", "REFERRER", "OTHER"] as const;
/** To-do created with a saved job: apply by a date, or follow up on it. */
export const FOLLOW_UP_TYPES = ["APPLY", "FOLLOW_UP"] as const;

export type WorkArrangement = (typeof WORK_ARRANGEMENTS)[number];
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export type SalaryPeriod = (typeof SALARY_PERIODS)[number];
export type Priority = (typeof PRIORITIES)[number];
export type SalaryBasis = (typeof SALARY_BASES)[number];
export type ApplicationMethod = (typeof APPLICATION_METHODS)[number];
export type ContactKind = (typeof CONTACT_KINDS)[number];
export type FollowUpType = (typeof FOLLOW_UP_TYPES)[number];

const text = (max: number) => z.string().trim().max(max).optional();

/** Enum field from a form select, where "" means "not set". */
const optionalChoice = <const T extends readonly [string, ...string[]]>(values: T) =>
  z.union([z.enum(values), z.literal("")]).optional();

const list = (maxItems: number, maxLength: number) =>
  z
    .array(z.string().trim().max(maxLength))
    .max(maxItems, { error: `At most ${maxItems} items.` })
    .optional();

/** Recruiter or hiring manager named on the posting, saved as a contact of the company. */
export const extensionContactSchema = z.object({
  name: z.string().trim().min(1, { error: "Enter the contact's name." }).max(120),
  title: text(120),
  email: text(254),
  linkedinUrl: text(2048),
  kind: optionalChoice(CONTACT_KINDS),
});

/** To-do for a job saved but not applied to yet. */
export const extensionFollowUpSchema = z.object({
  type: z.enum(FOLLOW_UP_TYPES),
  dueDate: z.string().length(10, { error: "Choose a date." }),
  title: text(200),
});

/**
 * Job details the extension sends after the user reviewed them. Fields after
 * stageId were added in extension v0.2; older extensions omit them.
 */
export const extensionJobDraftSchema = z.object({
  title: z.string().trim().min(1, { error: "Job title is required." }).max(160),
  companyName: z.string().trim().min(1, { error: "Company is required." }).max(120),
  postingUrl: text(2048),
  source: text(60),
  location: text(120),
  description: text(20_000),
  workArrangement: optionalChoice(WORK_ARRANGEMENTS),
  employmentType: optionalChoice(EMPLOYMENT_TYPES),
  salaryMin: text(24),
  salaryMax: text(24),
  currency: text(3),
  salaryPeriod: optionalChoice(SALARY_PERIODS),
  priority: optionalChoice(PRIORITIES),
  notes: text(5_000),
  alreadyApplied: z.boolean().optional(),
  appliedOn: text(10),
  stageId: text(36),
  referenceCode: text(80),
  salaryBasis: optionalChoice(SALARY_BASES),
  requiredSkills: list(30, 40),
  tags: list(10, 30),
  deadline: text(10),
  method: optionalChoice(APPLICATION_METHODS),
  companyWebsite: text(2048),
  contact: extensionContactSchema.optional(),
  followUp: extensionFollowUpSchema.optional(),
});

export type ExtensionJobDraft = z.input<typeof extensionJobDraftSchema>;

export const extensionMeSchema = z.object({
  user: z.object({ name: z.string(), email: z.string() }),
  currency: z.string(),
  today: z.string(),
  stages: z.array(z.object({ id: z.string(), name: z.string() })),
  /** Default days until a follow-up (Settings). Missing on servers older than v0.2 of this contract. */
  followUpDays: z.number().int().optional(),
  /**
   * "Improve with AI": `available` when the server has an AI key, `enabled`
   * when the user also turned it on in Settings. Missing before contract v0.3.
   */
  features: z.object({ ai: z.object({ available: z.boolean(), enabled: z.boolean() }) }).optional(),
});

export type ExtensionMe = z.infer<typeof extensionMeSchema>;

export const extensionSaveResultSchema = z.object({
  id: z.string(),
  applicationId: z.string().nullable(),
  url: z.string(),
  contactId: z.string().nullable().optional(),
  taskId: z.string().nullable().optional(),
});

export type ExtensionSaveResult = z.infer<typeof extensionSaveResultSchema>;

/**
 * Body of POST /opportunities/duplicates. A JSON body rather than query
 * parameters keeps the posting URL out of proxy access logs.
 */
export const extensionDuplicateQuerySchema = z.object({
  url: z.string().max(2048).optional(),
  title: z.string().max(160).optional(),
  company: z.string().max(120).optional(),
});

export type ExtensionDuplicateQuery = z.input<typeof extensionDuplicateQuerySchema>;

export const extensionDuplicatesSchema = z.object({
  candidates: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      companyName: z.string(),
      savedOn: z.string(),
      applicationCount: z.number(),
      reason: z.enum(["url", "title"]),
      url: z.string(),
    }),
  ),
});

export type ExtensionDuplicates = z.infer<typeof extensionDuplicatesSchema>;

/**
 * Field errors keyed by path, e.g. "title" or "contact.email" (Zod's
 * flattenError only keeps the top-level key, which loses which nested field
 * is wrong). Issues without a path are left out.
 */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string[]> {
  const output: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".");
    if (key) (output[key] ??= []).push(issue.message);
  }
  return output;
}

/** Fields "Improve with AI" can suggest (the contact fields are the form's flat ones). */
export const AI_SUGGESTABLE_FIELDS = [
  "title",
  "companyName",
  "location",
  "workArrangement",
  "employmentType",
  "salaryMin",
  "salaryMax",
  "currency",
  "salaryPeriod",
  "salaryBasis",
  "requiredSkills",
  "deadline",
  "referenceCode",
  "companyWebsite",
  "contactName",
  "contactTitle",
  "contactEmail",
  "contactLinkedinUrl",
] as const;

export type AiSuggestableField = (typeof AI_SUGGESTABLE_FIELDS)[number];

/**
 * Body of POST /extract. The extension sends the posting's text and the names
 * of the fields it already filled (never their values); the server suggests
 * only the others.
 */
export const extensionExtractRequestSchema = z.object({
  postingUrl: text(2048),
  pageTitle: text(300),
  text: z
    .string()
    .trim()
    .min(200, { error: "The description is too short to suggest anything from." })
    .max(30_000),
  filledFields: z.array(z.enum(AI_SUGGESTABLE_FIELDS)).max(AI_SUGGESTABLE_FIELDS.length).default([]),
});

export type ExtensionExtractRequest = z.input<typeof extensionExtractRequestSchema>;

/** Suggested values, already checked by the server; any field may be missing. */
export const extensionAiSuggestionsSchema = z.object({
  title: z.string().optional(),
  companyName: z.string().optional(),
  location: z.string().optional(),
  workArrangement: z.enum(WORK_ARRANGEMENTS).optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
  salaryMin: z.string().optional(),
  salaryMax: z.string().optional(),
  currency: z.string().optional(),
  salaryPeriod: z.enum(SALARY_PERIODS).optional(),
  salaryBasis: z.enum(["GROSS", "NET"]).optional(),
  requiredSkills: z.array(z.string()).optional(),
  deadline: z.string().optional(),
  referenceCode: z.string().optional(),
  companyWebsite: z.string().optional(),
  contactName: z.string().optional(),
  contactTitle: z.string().optional(),
  contactEmail: z.string().optional(),
  contactLinkedinUrl: z.string().optional(),
});

export type ExtensionAiSuggestions = z.infer<typeof extensionAiSuggestionsSchema>;

export const extensionExtractResultSchema = z.object({
  suggestions: extensionAiSuggestionsSchema,
  /** Served from the cache (no quota used). */
  cached: z.boolean(),
  remainingToday: z.number().int(),
});

export type ExtensionExtractResult = z.infer<typeof extensionExtractResultSchema>;

/** Error body of every non-2xx extension API response. */
export const extensionErrorSchema = z.object({
  error: z.string(),
  fieldErrors: z.record(z.string(), z.array(z.string()).optional()).optional(),
});

export type ExtensionError = z.infer<typeof extensionErrorSchema>;

/**
 * Sent by the JobTrack connect page to the extension (externally_connectable).
 * `state` is the nonce the extension generated when it opened the page.
 */
export const extensionConnectMessageSchema = z.object({
  type: z.literal(EXTENSION_CONNECT_MESSAGE),
  token: z.string().startsWith(EXTENSION_TOKEN_PREFIX).max(128),
  state: z.string().min(16).max(128),
});

export type ExtensionConnectMessage = z.infer<typeof extensionConnectMessageSchema>;

/** Extension ID (32 chars a-p) and connect nonce passed to the connect page. */
export const extensionConnectParamsSchema = z.object({
  ext: z.string().regex(/^[a-p]{32}$/),
  state: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
});
