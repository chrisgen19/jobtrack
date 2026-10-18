import type { DraftValues } from "../../draft";
import { parseSalary, type ParsedSalary } from "../parse/salary";
import { arrangementFromLabel, employmentFromLabel } from "../parse/work";
import { htmlToText, oneLine } from "../text";
import { firstText, hostIs, salaryFields, type SiteAdapter } from "./adapter";

// Logged-out job pages (checked October 2026) first, then the signed-in job
// view and the details pane of /jobs/search and /jobs/collections. LinkedIn
// changes signed-in class names often; misses fall through to JSON-LD and the
// generic reader. Never fetches anything: it only reads the open page.
const TITLE = [
  ".top-card-layout__title",
  ".job-details-jobs-unified-top-card__job-title",
  ".jobs-unified-top-card__job-title",
].join(", ");
const COMPANY = [
  ".topcard__org-name-link",
  ".job-details-jobs-unified-top-card__company-name",
  ".jobs-unified-top-card__company-name",
].join(", ");
const LOCATION = [
  ".topcard__flavor--bullet",
  ".job-details-jobs-unified-top-card__primary-description-container .tvm__text",
  ".jobs-unified-top-card__bullet",
].join(", ");
const CHIPS = [
  ".job-details-fit-level-preferences button",
  ".job-details-preferences-and-skills__pill",
  ".job-details-jobs-unified-top-card__job-insight",
].join(", ");
const DESCRIPTION = [".show-more-less-html__markup", "#job-details", ".jobs-description__content"].join(", ");

/** Work setup, type and pay from the criteria list and the signed-in "chips" ("Remote", "Full-time", "₱50K/month"). */
function fromChips(criteria: string[], chips: string[], host: string) {
  const employmentLine = criteria.find((line) => /^employment type/i.test(line));
  let employment = employmentLine ? employmentFromLabel(employmentLine.replace(/^employment type/i, "")) : "";
  let arrangement: DraftValues["workArrangement"] = "";
  let salary: ParsedSalary | null = null;
  for (const chip of chips) {
    arrangement ||= arrangementFromLabel(chip);
    employment ||= employmentFromLabel(chip);
    if (!salary && /\d/.test(chip) && /[$₱€£]|\b[A-Z]{3}\b|\/(?:yr|mo|hr)/.test(chip)) salary = parseSalary(chip, { host });
  }
  return { employment, arrangement, salary };
}

export const linkedin: SiteAdapter = {
  id: "linkedin",
  matches: (url) => hostIs(url, "linkedin.com"),
  jobRef(url) {
    const path = url.pathname.match(/\/jobs\/view\/(?:[^/]*?-)?(\d{6,})/)?.[1];
    if (path) return { id: path, inList: false };
    const query = url.searchParams.get("currentJobId");
    return query && /^\d+$/.test(query) ? { id: query, inList: true } : null;
  },
  postingUrl: (_url, job) => `https://www.linkedin.com/jobs/view/${job.id}/`,
  plan: {
    text: {
      title: TITLE,
      company: COMPANY,
      location: LOCATION,
      criteria: ".description__job-criteria-item",
      chips: CHIPS,
    },
    html: { description: DESCRIPTION },
  },
  extract({ url, snapshot }) {
    const { employment, arrangement, salary } = fromChips(
      snapshot.text.criteria ?? [],
      snapshot.text.chips ?? [],
      url.hostname,
    );
    const pay = salaryFields(salary);
    return {
      source: "site",
      values: {
        title: oneLine(firstText(snapshot, "title")),
        companyName: oneLine(firstText(snapshot, "company")),
        location: oneLine(firstText(snapshot, "location")),
        description: htmlToText(snapshot.html.description ?? ""),
        employmentType: employment,
        workArrangement: arrangement,
        ...pay.values,
      },
      guessed: pay.guessed,
    };
  },
};
