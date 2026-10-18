import { arrangementFromLabel, employmentFromLabel } from "../parse/work";
import { firstText, hostIs, type SiteAdapter } from "./adapter";

/** Lever's JSON-LD covers most fields; the work setup only shows in the category bar. */
export const lever: SiteAdapter = {
  id: "lever",
  matches: (url) => hostIs(url, "lever.co"),
  jobRef(url) {
    const id = url.pathname.match(/^\/[^/]+\/([0-9a-f]{8}-[0-9a-f-]{27})/i)?.[1];
    return id ? { id, inList: false } : null;
  },
  plan: {
    text: {
      workplace: ".posting-categories .workplaceTypes",
      commitment: ".posting-categories .commitment",
      location: ".posting-categories .location",
    },
  },
  extract({ snapshot }) {
    return {
      source: "site",
      values: {
        location: firstText(snapshot, "location")
          .replace(/\s*\/\s*$/, "")
          .slice(0, 120),
        workArrangement: arrangementFromLabel(firstText(snapshot, "workplace")),
        employmentType: employmentFromLabel(firstText(snapshot, "commitment")),
      },
    };
  },
};
