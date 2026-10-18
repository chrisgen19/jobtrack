import { arrangementFromLabel, employmentFromLabel } from "../parse/work";
import { firstText, hostIs, type SiteAdapter } from "./adapter";

/** Lever's JSON-LD covers most fields; the work setup only shows in the category bar. */
export const lever: SiteAdapter = {
  id: "lever",
  matches: (url) => hostIs(url, "lever.co"),
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
        location: firstText(snapshot, "location").replace(/\s*\/\s*$/, "").slice(0, 120),
        workArrangement: arrangementFromLabel(firstText(snapshot, "workplace")),
        employmentType: employmentFromLabel(firstText(snapshot, "commitment")),
      },
    };
  },
};
