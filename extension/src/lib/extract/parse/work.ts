import type { EmploymentType, WorkArrangement } from "@jobtrack/shared/extension-api";

/**
 * Work setup from a short label a site shows ("Hybrid", "On-site",
 * "Remote, United States", Ashby's "OnSite"). Hybrid wins because labels
 * like "Hybrid remote" mention both.
 */
export function arrangementFromLabel(label: string): WorkArrangement | "" {
  const text = label.toLowerCase();
  if (/\bhybrid\b/.test(text)) return "HYBRID";
  if (/\bremote\b|work\s*from\s*home|\bwfh\b|telecommut|anywhere/.test(text)) return "REMOTE";
  if (/\bon-?\s?site\b|\bin[- ]office\b|\boffice[- ]based\b/.test(text)) return "ONSITE";
  return "";
}

const HYBRID_TEXT = /\bhybrid\s+(?:work|set-?up|arrangement|role|schedule|model|position)\b|\b(?:work|set-?up|arrangement)\s*:\s*hybrid\b/i;
const REMOTE_TEXT =
  /\b(?:fully|100%|permanent(?:ly)?)\s+remote\b|\bremote\s+(?:work|role|position|job|set-?up|first|opportunity)\b|\bwork\s+from\s+home\b|\bwfh\b/i;
const NOT_REMOTE = /\b(?:not|no|non)[- ]remote\b|\bnot\s+(?:a\s+)?(?:fully\s+)?remote\b/i;

/**
 * Work setup implied by a description (a guess). Only phrases about the job
 * count: "hybrid cloud" or "remote monitoring" don't make a role hybrid or
 * remote, and on-site is never guessed from prose.
 */
export function arrangementFromText(text: string): WorkArrangement | "" {
  if (HYBRID_TEXT.test(text)) return "HYBRID";
  if (REMOTE_TEXT.test(text) && !NOT_REMOTE.test(text)) return "REMOTE";
  return "";
}

// Checked in order: "Internship / OJT" and "Contract" before "full time" wording.
const EMPLOYMENT_LABELS: [RegExp, EmploymentType][] = [
  [/\bintern(?:ship)?\b|\bojt\b|\btrainee\b/, "INTERNSHIP"],
  [/\bfreelance\b|\bgig\b/, "FREELANCE"],
  [/\bcontract(?:or)?\b|\bfixed[- ]term\b|\bproject[- ]based\b/, "CONTRACT"],
  [/\bpart[- ]?time\b/, "PART_TIME"],
  [/\bcasual\b|\btemp(?:orary)?\b|\bvacation\b|\bseasonal\b/, "TEMPORARY"],
  [/\bfull[- ]?time\b|\bpermanent\b|\bregular\b/, "FULL_TIME"],
];

/** Employment type from a label like "Full time", "Contract/Temp", "FullTime" or "Internship / OJT". */
export function employmentFromLabel(label: string): EmploymentType | "" {
  const text = label.toLowerCase().replace(/fulltime/g, "full time").replace(/parttime/g, "part time");
  return EMPLOYMENT_LABELS.find(([pattern]) => pattern.test(text))?.[1] ?? "";
}
