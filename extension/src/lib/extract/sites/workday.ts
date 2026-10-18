import { employmentFromLabel } from "../parse/work";
import { findJobPosting } from "../json-ld";
import { asArray, isNode, str } from "../read";
import { htmlToText, oneLine } from "../text";
import { firstText, hostIs, type SiteAdapter } from "./adapter";

/**
 * Employer name: Workday's JSON-LD names the legal entity ("2100 NVIDIA USA"),
 * so drop a leading entity code; without JSON-LD use the tenant subdomain.
 */
function companyOf(url: URL, jsonLd: string[]): { name: string; guessed: boolean } {
  const organization = asArray(findJobPosting(jsonLd)?.hiringOrganization)[0];
  const fromJsonLd = oneLine(isNode(organization) ? str(organization.name) : str(organization)).replace(/^\d+\s+/, "");
  if (fromJsonLd) return { name: fromJsonLd, guessed: false };
  const tenant = url.hostname.split(".")[0] ?? "";
  const name = tenant.length <= 4 ? tenant.toUpperCase() : tenant.charAt(0).toUpperCase() + tenant.slice(1);
  return { name, guessed: Boolean(name) };
}

/**
 * Workday job pages. JSON-LD exists only on a full page load of /job/...;
 * after an in-app click (/details/...) the page has none, so the
 * data-automation-id fields are read too.
 */
export const workday: SiteAdapter = {
  id: "workday",
  matches: (url) => hostIs(url, "myworkdayjobs.com", "myworkdaysite.com"),
  jobRef(url) {
    // Paths end in "<slug>_<requisition id>", e.g. ..._JR2026403.
    const id = url.pathname.match(/\/(?:job|details)\/(?:.+\/)?[^/]*_([A-Za-z0-9-]+)\/?$/)?.[1];
    return id ? { id, inList: false } : null;
  },
  plan: {
    text: {
      title: '[data-automation-id="jobPostingHeader"]',
      location: '[data-automation-id="locations"] dd',
      time: '[data-automation-id="time"] dd',
    },
    html: { description: '[data-automation-id="jobPostingDescription"]' },
  },
  extract({ url, snapshot }) {
    const company = companyOf(url, snapshot.jsonLd);
    return {
      source: "site",
      values: {
        title: oneLine(firstText(snapshot, "title")),
        companyName: company.name.slice(0, 120),
        location: (snapshot.text.location ?? []).slice(0, 3).join("; ").slice(0, 120),
        description: htmlToText(snapshot.html.description ?? ""),
        employmentType: employmentFromLabel(firstText(snapshot, "time")),
      },
      guessed: company.guessed ? ["companyName"] : [],
    };
  },
};
