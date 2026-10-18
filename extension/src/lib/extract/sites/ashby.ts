import { dateOf, isNode, str } from "../read";
import { arrangementFromLabel, employmentFromLabel } from "../parse/work";
import { htmlToText, oneLine } from "../text";
import { hostIs, type SiteAdapter } from "./adapter";

/**
 * Reads window.__appData.posting. Ashby's JSON-LD carries the salary, but
 * its jobLocationType says TELECOMMUTE even for hybrid roles, so the
 * posting's own workplaceType wins. Self-contained (runs in the MAIN world).
 */
function ashbyProbe(jobId: string | null): string | null {
  try {
    const data = (window as unknown as { __appData?: Record<string, unknown> }).__appData;
    const posting = data?.posting as Record<string, unknown> | undefined;
    if (!posting || (jobId && String(posting.id) !== jobId)) return null;
    const { title, locationName, workplaceType, employmentType, descriptionHtml, applicationDeadline } =
      posting;
    const organization = (data?.organization as { name?: unknown } | undefined)?.name;
    const json = JSON.stringify({
      title,
      locationName,
      workplaceType,
      employmentType,
      descriptionHtml,
      applicationDeadline,
      organization,
    });
    return json.length > 500_000 ? null : json;
  } catch {
    return null;
  }
}

export const ashby: SiteAdapter = {
  id: "ashby",
  matches: (url) => hostIs(url, "ashbyhq.com"),
  jobRef(url) {
    const id = url.pathname.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)?.[1];
    return id ? { id, inList: false } : null;
  },
  probe: ashbyProbe,
  extract({ main }) {
    if (!isNode(main)) return { source: "site", values: {} };
    return {
      source: "site",
      values: {
        title: oneLine(str(main.title)),
        companyName: oneLine(str(main.organization)),
        location: oneLine(str(main.locationName)).slice(0, 120),
        description: htmlToText(str(main.descriptionHtml)),
        workArrangement: arrangementFromLabel(str(main.workplaceType)),
        employmentType: employmentFromLabel(str(main.employmentType)),
        deadline: dateOf(main.applicationDeadline),
      },
    };
  },
};
