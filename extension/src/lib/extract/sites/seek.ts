import { asArray, at, byPrefix, isNode, str } from "../read";
import { parseSalary } from "../parse/salary";
import { arrangementFromLabel, employmentFromLabel } from "../parse/work";
import { htmlToText, oneLine } from "../text";
import { firstText, hostIs, salaryFields, type SiteAdapter } from "./adapter";

/**
 * Reads the job from SEEK's Apollo cache. The live cache follows split-view
 * clicks; SEEK_APOLLO_DATA is only the first page load. Self-contained (runs
 * in the page's MAIN world).
 */
function seekProbe(jobId: string | null): string | null {
  if (!jobId) return null;
  const get = (value: unknown, key: string): unknown =>
    value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined;
  try {
    const cache = get(get(window, "__APOLLO_CLIENT__"), "cache") as { extract?: () => unknown } | undefined;
    const roots = [
      typeof cache?.extract === "function" ? cache.extract() : undefined,
      { ROOT_QUERY: get(get(window, "SEEK_APOLLO_DATA"), "ROOT_QUERY") },
    ];
    for (const root of roots) {
      const details = get(get(root, "ROOT_QUERY"), `jobDetails:{"id":"${jobId}"}`);
      const ref = get(get(details, "job"), "__ref");
      const job = typeof ref === "string" ? get(root, ref) : get(details, "job");
      if (String(get(job, "id")) !== jobId) continue;
      const json = JSON.stringify({ details, job });
      return json.length > 500_000 ? null : json;
    }
  } catch {
    // Page state changed shape; fall back to the DOM.
  }
  return null;
}

/** First arrangement type ("ONSITE", "HYBRID", "REMOTE") from jobDetails.workArrangements(...). */
function arrangementOf(details: unknown): string {
  const arrangements = asArray(at(byPrefix(details, "workArrangements"), "arrangements"));
  const types = arrangements.filter(isNode).map((item) => str(item.type));
  return types[0] ?? "";
}

export const seek: SiteAdapter = {
  id: "seek",
  matches: (url) => hostIs(url, "seek.com", "seek.com.au", "seek.co.nz", "jobstreet.com", "jobsdb.com"),
  jobRef(url) {
    const path = url.pathname.match(/\/job\/(\d+)/)?.[1];
    if (path) return { id: path, inList: false };
    const query = url.searchParams.get("jobId");
    return query && /^\d+$/.test(query) ? { id: query, inList: true } : null;
  },
  postingUrl: (url, job) => `${url.origin}/job/${job.id}`,
  plan: {
    text: {
      title: '[data-automation="job-detail-title"]',
      company: '[data-automation="advertiser-name"]',
      location: '[data-automation="job-detail-location"]',
      workType: '[data-automation="job-detail-work-type"]',
      salary: '[data-automation="job-detail-salary"]',
    },
    html: { description: '[data-automation="jobAdDetails"]' },
  },
  probe: seekProbe,
  extract({ url, snapshot, main }) {
    const job = at(main, "job");
    const salaryText = str(at(job, "salary", "label")) || firstText(snapshot, "salary");
    const salary = salaryFields(parseSalary(salaryText, { host: url.hostname }));
    const workType = str(byPrefix(at(job, "workTypes"), "label")) || firstText(snapshot, "workType");
    const arrangement = arrangementOf(at(main, "details"));
    return {
      source: "site",
      values: {
        title: oneLine(str(at(job, "title")) || firstText(snapshot, "title")),
        companyName: oneLine(str(byPrefix(at(job, "advertiser"), "name")) || firstText(snapshot, "company")),
        location: oneLine(str(byPrefix(at(job, "location"), "label")) || firstText(snapshot, "location")),
        description: htmlToText(str(byPrefix(job, "content2")) || snapshot.html.description || ""),
        employmentType: employmentFromLabel(workType),
        workArrangement: arrangementFromLabel(arrangement),
        ...salary.values,
      },
      guessed: salary.guessed,
    };
  },
};
