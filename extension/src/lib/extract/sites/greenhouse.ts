import { asArray, dateOf, isNode, str } from "../read";
import { parseSalary } from "../parse/salary";
import { arrangementFromLabel } from "../parse/work";
import { htmlToText, oneLine } from "../text";
import { hostIs, salaryFields, type SiteAdapter } from "./adapter";

/**
 * Reads the job post from the Remix loader data of job-boards.greenhouse.io
 * (these pages have no JSON-LD). Self-contained (runs in the MAIN world).
 */
function greenhouseProbe(): string | null {
  try {
    const context = (window as unknown as { __remixContext?: { state?: { loaderData?: unknown } } })
      .__remixContext;
    const loaderData = context?.state?.loaderData as Record<string, { jobPost?: Record<string, unknown> }>;
    const key = Object.keys(loaderData ?? {}).find((name) => name.includes("job_post_id"));
    const post = key ? loaderData[key]?.jobPost : undefined;
    if (!post) return null;
    const { title, company_name, job_post_location, content, pay_ranges, public_url, application_deadline } =
      post;
    const json = JSON.stringify({
      title,
      company_name,
      job_post_location,
      content,
      pay_ranges,
      public_url,
      application_deadline,
    });
    return json.length > 500_000 ? null : json;
  } catch {
    return null;
  }
}

export const greenhouse: SiteAdapter = {
  id: "greenhouse",
  matches: (url) => hostIs(url, "greenhouse.io"),
  jobRef(url) {
    const id = url.pathname.match(/\/jobs\/(\d+)/)?.[1];
    return id ? { id, inList: false } : null;
  },
  probe: greenhouseProbe,
  extract({ url, main }) {
    if (!isNode(main)) return { source: "site", values: {} };
    const range = asArray(main.pay_ranges).find(isNode);
    const payText = range ? `${str(range.min)} - ${str(range.max)} ${str(range.currency_type)}` : "";
    const salary = salaryFields(parseSalary(payText, { host: url.hostname }));
    const location = oneLine(str(main.job_post_location));
    return {
      source: "site",
      values: {
        title: oneLine(str(main.title)),
        companyName: oneLine(str(main.company_name)),
        location: location.slice(0, 120),
        // Older boards HTML-escape the content; htmlToText decodes it first.
        description: htmlToText(str(main.content)),
        workArrangement: arrangementFromLabel(location),
        deadline: dateOf(main.application_deadline),
        ...salary.values,
      },
      guessed: salary.guessed,
    };
  },
};
