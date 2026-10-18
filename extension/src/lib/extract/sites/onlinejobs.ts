import { parseSalary } from "../parse/salary";
import { employmentFromLabel } from "../parse/work";
import { htmlToText, oneLine } from "../text";
import { firstText, hostIs, salaryFields, type SiteAdapter } from "./adapter";

const TYPE = "TYPE OF WORK";
const WAGE = "WAGE / SALARY";

/**
 * OnlineJobs.ph is server-rendered with labelled blocks. It lists remote
 * work only, and hides the employer from signed-out visitors (the company
 * then stays empty).
 */
export const onlinejobs: SiteAdapter = {
  id: "onlinejobs",
  matches: (url) => hostIs(url, "onlinejobs.ph"),
  jobRef(url) {
    const id = url.pathname.match(/\/jobseekers\/job\/(?:[^/]*-)?(\d+)$/)?.[1];
    return id ? { id, inList: false } : null;
  },
  plan: {
    text: { title: "h1" },
    html: { description: "#job-description" },
    labels: [TYPE, WAGE],
  },
  extract({ url, snapshot }) {
    const salary = salaryFields(parseSalary(snapshot.labelled[WAGE] ?? "", { host: url.hostname }));
    return {
      source: "site",
      values: {
        title: oneLine(firstText(snapshot, "title")),
        description: htmlToText(snapshot.html.description ?? ""),
        employmentType: employmentFromLabel(snapshot.labelled[TYPE] ?? ""),
        workArrangement: "REMOTE",
        ...salary.values,
      },
      guessed: salary.guessed,
    };
  },
};
