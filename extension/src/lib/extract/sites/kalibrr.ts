import type { SalaryPeriod } from "@jobtrack/shared/extension-api";
import { at, dateOf, isNode, parseJson, str } from "../read";
import { employmentFromLabel } from "../parse/work";
import { htmlToText, oneLine } from "../text";
import { hostIs, type SiteAdapter } from "./adapter";

const PERIODS: Record<string, SalaryPeriod> = {
  hour: "HOURLY",
  day: "DAILY",
  week: "WEEKLY",
  month: "MONTHLY",
  year: "ANNUALLY",
};

const amount = (value: unknown): string => {
  const number = Number(value);
  return value !== null && value !== "" && Number.isFinite(number) && number > 0 ? String(number) : "";
};

/** Kalibrr job pages are Next.js; the job is in __NEXT_DATA__ (props.pageProps.job). */
export const kalibrr: SiteAdapter = {
  id: "kalibrr",
  matches: (url) => hostIs(url, "kalibrr.com", "kalibrr.id"),
  jobRef(url) {
    const id = url.pathname.match(/\/jobs\/(\d+)/)?.[1];
    return id ? { id, inList: false } : null;
  },
  plan: { scriptIds: ["__NEXT_DATA__"] },
  extract({ job: ref, snapshot }) {
    const job = at(parseJson(snapshot.scripts.__NEXT_DATA__), "props", "pageProps", "job");
    if (!isNode(job) || (ref && str(job.id) !== ref.id)) return { source: "site", values: {} };

    const address = at(job, "googleLocation", "addressComponents");
    const location = [str(at(address, "city")), str(at(address, "region"))].filter(Boolean).join(", ");
    const qualifications = htmlToText(str(job.qualifications));
    // Employers can hide the pay; it is still in the page data, but we respect the choice.
    const showSalary = job.salaryShown !== false;
    const min = showSalary ? amount(job.baseSalary) : "";
    const max = showSalary ? amount(job.maximumSalary) : "";
    const workFromHome = job.isWorkFromHome === true;
    return {
      source: "site",
      values: {
        title: oneLine(str(job.name)),
        companyName: oneLine(str(at(job, "company", "name")) || str(at(job, "companyInfo", "name"))),
        location: location.slice(0, 120),
        description: [htmlToText(str(job.description)), qualifications && `Qualifications\n${qualifications}`]
          .filter(Boolean)
          .join("\n\n"),
        employmentType: employmentFromLabel(str(job.tenure)),
        workArrangement: workFromHome ? "REMOTE" : job.isHybrid === true ? "HYBRID" : "",
        salaryMin: min,
        salaryMax: max && max !== min ? max : "",
        currency: min || max ? str(job.salaryCurrency).toUpperCase().slice(0, 3) : "",
        salaryPeriod: min || max ? (PERIODS[str(job.salaryInterval).toLowerCase()] ?? "") : "",
        deadline: dateOf(job.applicationEndDate),
      },
    };
  },
};
