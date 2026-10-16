import type { EmploymentType, SalaryPeriod, WorkArrangement } from "@jobtrack/shared/extension-api";
import type { DraftValues } from "../draft";
import { htmlToText, oneLine } from "./text";

type Node = Record<string, unknown>;

const isNode = (value: unknown): value is Node =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value === undefined ? [] : [value];
const str = (value: unknown): string =>
  typeof value === "string" || typeof value === "number" ? String(value) : "";

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

function salaryOf(posting: Node): Pick<DraftValues, "salaryMin" | "salaryMax" | "currency" | "salaryPeriod"> {
  const salary = asArray(posting.baseSalary).find(isNode);
  const value = salary && isNode(salary.value) ? salary.value : null;
  const amount = (raw: unknown) => (str(raw) && Number.isFinite(Number(raw)) ? String(Number(raw)) : "");
  const min = amount(value?.minValue ?? value?.value ?? (salary && !value ? salary.value : undefined));
  const max = amount(value?.maxValue);
  return {
    salaryMin: min,
    salaryMax: max && max !== min ? max : "",
    currency: /^[A-Za-z]{3}$/.test(str(salary?.currency)) ? str(salary?.currency).toUpperCase() : "",
    salaryPeriod: min || max ? (PERIODS[str(value?.unitText).toUpperCase()] ?? "") : "",
  };
}

function workArrangementOf(posting: Node): WorkArrangement | "" {
  return asArray(posting.jobLocationType).some((type) => str(type).toUpperCase() === "TELECOMMUTE")
    ? "REMOTE"
    : "";
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
    ...salaryOf(posting),
  };
}
