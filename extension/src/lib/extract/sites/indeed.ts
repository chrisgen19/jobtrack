import { parseSalary } from "../parse/salary";
import { employmentFromLabel } from "../parse/work";
import { htmlToText, oneLine } from "../text";
import { firstText, hostIs, salaryFields, type SiteAdapter } from "./adapter";

// Not checked against a live page: Indeed blocks automated browsers, so
// these selectors come from public scraper write-ups. Misses fall through to
// JSON-LD and the generic reader.
export const indeed: SiteAdapter = {
  id: "indeed",
  matches: (url) => hostIs(url, "indeed.com"),
  jobRef(url) {
    const page = url.searchParams.get("jk");
    if (page && url.pathname.startsWith("/viewjob")) return { id: page, inList: false };
    const pane = url.searchParams.get("vjk");
    return pane ? { id: pane, inList: true } : null;
  },
  postingUrl: (url, job) => `${url.origin}/viewjob?jk=${encodeURIComponent(job.id)}`,
  plan: {
    text: {
      title: "h1.jobsearch-JobInfoHeader-title, [data-testid='jobsearch-JobInfoHeader-title']",
      company: "[data-testid='inlineHeader-companyName'], [data-company-name='true']",
      location: "[data-testid='inlineHeader-companyLocation'], [data-testid='job-location']",
      salary: "#salaryInfoAndJobType span",
    },
    html: { description: "#jobDescriptionText" },
  },
  extract({ url, snapshot }) {
    const details = snapshot.text.salary ?? [];
    const salary = salaryFields(
      parseSalary(details.find((text) => /\d/.test(text)) ?? "", { host: url.hostname }),
    );
    return {
      source: "site",
      values: {
        title: oneLine(firstText(snapshot, "title")).replace(/\s*-\s*job post$/i, ""),
        companyName: oneLine(firstText(snapshot, "company")),
        location: oneLine(firstText(snapshot, "location")).slice(0, 120),
        description: htmlToText(snapshot.html.description ?? ""),
        employmentType: employmentFromLabel(details.join(" ")),
        ...salary.values,
      },
      guessed: salary.guessed,
    };
  },
};
