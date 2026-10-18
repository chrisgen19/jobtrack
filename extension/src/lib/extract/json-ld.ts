import type { EmploymentType, SalaryPeriod, WorkArrangement } from "@jobtrack/shared/extension-api";
import type { DraftValues } from "../draft";
import { asArray, dateOf, isNode, str, type Node } from "./read";
import { isJobBoard } from "./source";
import { htmlToText, oneLine } from "./text";

function hasType(node: Node, type: string): boolean {
  return asArray(node["@type"]).some((value) => value === type);
}

/** Every object in a JSON-LD document (top level, arrays and @graph). */
function* nodesOf(value: unknown, depth = 0): Generator<Node> {
  if (depth > 4) return;
  for (const item of asArray(value)) {
    if (!isNode(item)) continue;
    yield item;
    if (item["@graph"]) yield* nodesOf(item["@graph"], depth + 1);
  }
}

/** The first schema.org JobPosting in the page's JSON-LD scripts, if any. */
export function findJobPosting(scripts: string[]): Node | null {
  for (const script of scripts) {
    try {
      for (const node of nodesOf(JSON.parse(script))) if (hasType(node, "JobPosting")) return node;
    } catch {
      // Malformed JSON-LD is common; ignore that script.
    }
  }
  return null;
}

/**
 * Whether a JobPosting is about the given job. Split views and in-app
 * navigation can leave an earlier job's JSON-LD in the page, so it is only
 * trusted there when its url, identifier or @id mentions the job ID.
 */
export function postingMentions(posting: Node, jobId: string): boolean {
  return JSON.stringify([posting.url, posting.identifier, posting["@id"]]).includes(jobId);
}

const EMPLOYMENT: Record<string, EmploymentType> = {
  FULL_TIME: "FULL_TIME",
  FULLTIME: "FULL_TIME",
  PART_TIME: "PART_TIME",
  PARTTIME: "PART_TIME",
  CONTRACTOR: "CONTRACT",
  CONTRACT: "CONTRACT",
  TEMPORARY: "TEMPORARY",
  PER_DIEM: "TEMPORARY",
  INTERN: "INTERNSHIP",
  INTERNSHIP: "INTERNSHIP",
  FREELANCE: "FREELANCE",
  VOLUNTEER: "OTHER",
  OTHER: "OTHER",
};

const PERIODS: Record<string, SalaryPeriod> = {
  HOUR: "HOURLY",
  DAY: "DAILY",
  WEEK: "WEEKLY",
  MONTH: "MONTHLY",
  YEAR: "ANNUALLY",
};

function locationOf(posting: Node): string {
  const places = asArray(posting.jobLocation).filter(isNode);
  const labels = places.map((place) => {
    const address = isNode(place.address) ? place.address : null;
    if (!address) return oneLine(str(place.name));
    const country = isNode(address.addressCountry)
      ? str(address.addressCountry.name)
      : str(address.addressCountry);
    return [address.addressLocality, address.addressRegion, country].map(str).filter(Boolean).join(", ");
  });
  return [...new Set(labels.filter(Boolean))].slice(0, 3).join("; ").slice(0, 120);
}

const currencyCode = (value: unknown): string =>
  /^[A-Za-z]{3}$/.test(str(value)) ? str(value).toUpperCase() : "";

/** baseSalary (or estimatedSalary): currency and unitText may sit on the amount or its value. */
function salaryOf(posting: Node): Pick<DraftValues, "salaryMin" | "salaryMax" | "currency" | "salaryPeriod"> {
  const salary = [...asArray(posting.baseSalary), ...asArray(posting.estimatedSalary)].find(isNode);
  const value = salary && isNode(salary.value) ? salary.value : null;
  const amount = (raw: unknown) => (str(raw) && Number.isFinite(Number(raw)) ? String(Number(raw)) : "");
  const min = amount(value?.minValue ?? value?.value ?? (salary && !value ? salary.value : undefined));
  const max = amount(value?.maxValue);
  const unit = str(value?.unitText) || str(salary?.unitText);
  return {
    salaryMin: min,
    salaryMax: max && max !== min ? max : "",
    currency: currencyCode(salary?.currency) || currencyCode(value?.currency),
    salaryPeriod: min || max ? (PERIODS[unit.toUpperCase()] ?? "") : "",
  };
}

function workArrangementOf(posting: Node): WorkArrangement | "" {
  return asArray(posting.jobLocationType).some((type) => str(type).toUpperCase() === "TELECOMMUTE")
    ? "REMOTE"
    : "";
}

/** skills as a comma list, an array, or DefinedTerm objects; at most 30 of 40 chars. */
function skillsOf(posting: Node): string[] {
  const items = asArray(posting.skills).flatMap((item) =>
    isNode(item) ? [str(item.name)] : str(item).split(/[,;\n]/),
  );
  const skills = items.map((item) => oneLine(item)).filter((item) => item && item.length <= 40);
  return [...new Set(skills)].slice(0, 30);
}

/** The employer's reference (identifier.value); UUIDs and long IDs aren't useful to type or search. */
function referenceOf(posting: Node): string {
  const value = oneLine(isNode(posting.identifier) ? str(posting.identifier.value) : str(posting.identifier));
  return value.length <= 40 && !/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(value) ? value : "";
}

/**
 * The employer's own site from hiringOrganization: the first http(s) link in
 * sameAs (one URL or a list) or url that isn't a job board company page.
 */
function websiteOf(organization: unknown): string {
  if (!isNode(organization)) return "";
  const url = [...asArray(organization.sameAs), organization.url]
    .map(str)
    .find((value) => /^https?:\/\//.test(value) && !isJobBoard(value));
  return url ? url.slice(0, 2048) : "";
}

/** Draft fields from a JobPosting node; missing data stays empty. */
export function draftFromJobPosting(posting: Node): Partial<DraftValues> {
  const organization = asArray(posting.hiringOrganization)[0];
  const employment = asArray(posting.employmentType)
    .map((type) => EMPLOYMENT[str(type).toUpperCase().replace(/[\s-]/g, "_")])
    .find(Boolean);
  return {
    title: oneLine(str(posting.title)).slice(0, 160),
    companyName: oneLine(isNode(organization) ? str(organization.name) : str(organization)).slice(0, 120),
    location: locationOf(posting),
    description: htmlToText(str(posting.description)).slice(0, 20_000),
    workArrangement: workArrangementOf(posting),
    employmentType: employment ?? "",
    postingUrl: /^https?:\/\//.test(str(posting.url)) ? str(posting.url) : "",
    requiredSkills: skillsOf(posting),
    referenceCode: referenceOf(posting),
    companyWebsite: websiteOf(organization),
    // validThrough is often the listing's expiry, not an application deadline: buildDraft flags it.
    deadline: dateOf(posting.validThrough),
    ...salaryOf(posting),
  };
}
