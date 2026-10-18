import {
  EMPLOYMENT_TYPES,
  SALARY_PERIODS,
  WORK_ARRANGEMENTS,
  type AiSuggestableField,
  type ExtensionAiSuggestions,
} from "@jobtrack/shared/extension-api";
import { addDaysToDateOnly, isValidDateOnly } from "@/lib/dates";
import { currencyCode, optionalEmail, optionalUrl } from "@/lib/validations/common";
import type { AiExtraction } from "./prompt";

/** Amounts outside this range are dropped as nonsense. */
const MAX_SALARY = 100_000_000;
/** A deadline further out than this is more likely a misread date than a real one. */
const MAX_DEADLINE_DAYS = 365;

const SALARY_FIELDS = ["salaryMin", "salaryMax", "currency", "salaryPeriod", "salaryBasis"] as const;

const line = (value: string | null, max: number): string | undefined => {
  const text = value?.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : undefined;
};

/** The value when it is one of the allowed choices, else undefined. */
const choice = <T extends string>(choices: readonly T[], value: string | null): T | undefined =>
  choices.find((item) => item === value?.trim().toUpperCase());

const amount = (value: number | null): number | undefined =>
  value !== null && Number.isFinite(value) && value > 0 && value < MAX_SALARY
    ? Math.round(value * 100) / 100
    : undefined;

const parsed = <T>(
  schema: { safeParse: (value: unknown) => { success: boolean; data?: T } },
  value: unknown,
) => {
  const result = schema.safeParse(value);
  return result.success ? result.data : undefined;
};

function salaryOf(output: AiExtraction): Partial<ExtensionAiSuggestions> {
  const min = amount(output.salaryMin);
  const max = amount(output.salaryMax);
  if (min === undefined && max === undefined) return {};
  if (min !== undefined && max !== undefined && min > max) return {};
  return {
    salaryMin: min?.toString(),
    salaryMax: max?.toString(),
    currency: output.currency ? parsed<string>(currencyCode, output.currency) : undefined,
    salaryPeriod: choice(SALARY_PERIODS, output.salaryPeriod),
    salaryBasis: choice(["GROSS", "NET"] as const, output.salaryBasis),
  };
}

function deadlineOf(value: string | null, today: string): string | undefined {
  if (!value || !isValidDateOnly(value)) return undefined;
  return value >= today && value <= addDaysToDateOnly(today, MAX_DEADLINE_DAYS) ? value : undefined;
}

function linkedinOf(value: string | null): string | undefined {
  const url = parsed<string | undefined>(optionalUrl, value ?? "");
  if (!url) return undefined;
  const { hostname, pathname } = new URL(url);
  return /(^|\.)linkedin\.com$/.test(hostname) && pathname.startsWith("/in/") ? url : undefined;
}

/**
 * Model output -> suggestions the extension may show. Every field is checked
 * on its own (an invalid one is dropped, the rest kept) with the same limits
 * as a manual save; text is single-line and length-capped, URLs are http(s).
 */
export function toSuggestions(output: AiExtraction, today: string): ExtensionAiSuggestions {
  // A "skill" longer than 40 characters is a sentence, not a skill name: dropped rather than cut.
  const skills = [
    ...new Set(
      output.requiredSkills
        .map((skill) => line(skill, 1_000))
        .filter((skill): skill is string => skill !== undefined && skill.length <= 40),
    ),
  ].slice(0, 30);
  const suggestions: ExtensionAiSuggestions = {
    title: line(output.title, 160),
    companyName: line(output.companyName, 120),
    location: line(output.location, 120),
    workArrangement: choice(WORK_ARRANGEMENTS, output.workArrangement),
    employmentType: choice(EMPLOYMENT_TYPES, output.employmentType),
    ...salaryOf(output),
    requiredSkills: skills.length ? skills : undefined,
    deadline: deadlineOf(output.deadline, today),
    referenceCode: line(output.referenceCode, 80),
    companyWebsite: parsed<string | undefined>(optionalUrl, output.companyWebsite ?? ""),
    contactName: line(output.contactName, 120),
    contactTitle: line(output.contactTitle, 120),
    contactEmail: parsed<string | undefined>(optionalEmail, output.contactEmail ?? ""),
    contactLinkedinUrl: linkedinOf(output.contactLinkedinUrl),
  };
  return Object.fromEntries(
    Object.entries(suggestions).filter(([, value]) => value !== undefined),
  ) as ExtensionAiSuggestions;
}

/**
 * Leaves out what the user's form already has. The salary fields go
 * together: a filled amount means none of the AI's salary is used.
 */
export function withoutFilled(
  suggestions: ExtensionAiSuggestions,
  filled: readonly AiSuggestableField[],
): ExtensionAiSuggestions {
  const skip = new Set<string>(filled);
  if (skip.has("salaryMin") || skip.has("salaryMax")) for (const field of SALARY_FIELDS) skip.add(field);
  return Object.fromEntries(
    Object.entries(suggestions).filter(([key]) => !skip.has(key)),
  ) as ExtensionAiSuggestions;
}

/**
 * A cached answer as of today: a deadline that has passed since it was cached
 * (say "apply by tomorrow", asked again a few days later) is left out.
 */
export function stillCurrent(suggestions: ExtensionAiSuggestions, today: string): ExtensionAiSuggestions {
  if (!suggestions.deadline || suggestions.deadline >= today) return suggestions;
  const current = { ...suggestions };
  delete current.deadline;
  return current;
}
