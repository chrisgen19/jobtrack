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

export type WorkArrangement = (typeof WORK_ARRANGEMENTS)[number];
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export type SalaryPeriod = (typeof SALARY_PERIODS)[number];
export type Priority = (typeof PRIORITIES)[number];

const text = (max: number) => z.string().trim().max(max).optional();

/** Enum field from a form select, where "" means "not set". */
const optionalChoice = <const T extends readonly [string, ...string[]]>(values: T) =>
  z.union([z.enum(values), z.literal("")]).optional();

/** Job details the extension sends after the user reviewed them. */
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
});

export type ExtensionJobDraft = z.input<typeof extensionJobDraftSchema>;

export const extensionMeSchema = z.object({
  user: z.object({ name: z.string(), email: z.string() }),
  currency: z.string(),
  today: z.string(),
  stages: z.array(z.object({ id: z.string(), name: z.string() })),
});

export type ExtensionMe = z.infer<typeof extensionMeSchema>;

export const extensionSaveResultSchema = z.object({
  id: z.string(),
  applicationId: z.string().nullable(),
  url: z.string(),
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
