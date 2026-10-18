// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { ashby } from "./sites/ashby";
import { greenhouse } from "./sites/greenhouse";
import { seek } from "./sites/seek";
import { collectPageSnapshot } from "./snapshot";

/**
 * Chrome serializes injected functions with toString(), so run them the same
 * way: a function that leans on an import or outer variable fails here.
 */
function serialized<T extends (...args: never[]) => unknown>(fn: T): T {
  return new Function(`return (${fn.toString()})`)() as T;
}

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  for (const key of ["__APOLLO_CLIENT__", "SEEK_APOLLO_DATA", "__remixContext", "__appData"]) {
    delete (window as unknown as Record<string, unknown>)[key];
  }
});

describe("collectPageSnapshot", () => {
  it("reads planned selectors, labels and scripts", () => {
    document.head.innerHTML = '<meta property="og:site_name" content="OnlineJobs.ph">';
    document.body.innerHTML = `
      <h1> Virtual  Assistant </h1>
      <dl><dd><h3>TYPE OF WORK</h3><p>Full Time</p></dd><dd><h3>WAGE / SALARY</h3><p>$5/hr</p></dd></dl>
      <ul><li class="chip">Remote</li><li class="chip">Full-time</li></ul>
      <div id="job-description"><p>Answer emails.</p></div>
      <script id="__NEXT_DATA__" type="application/json">{"props":{}}</script>`;
    const snapshot = serialized(collectPageSnapshot)({
      text: { chips: ".chip", bad: "::not-a-selector" },
      html: { description: "#job-description" },
      labels: ["TYPE OF WORK", "WAGE / SALARY"],
      scriptIds: ["__NEXT_DATA__"],
    });
    expect(snapshot.h1).toBe("Virtual Assistant");
    expect(snapshot.meta["og:site_name"]).toBe("OnlineJobs.ph");
    expect(snapshot.text.chips).toEqual(["Remote", "Full-time"]);
    expect(snapshot.text.bad ?? []).toEqual([]); // an invalid selector reads as missing
    expect(snapshot.html.description).toBe("<p>Answer emails.</p>");
    expect(snapshot.labelled).toEqual({ "TYPE OF WORK": "Full Time", "WAGE / SALARY": "$5/hr" });
    expect(snapshot.scripts.__NEXT_DATA__).toBe('{"props":{}}');
  });

  it("picks the description block over navigation-heavy containers", () => {
    const links = Array.from({ length: 40 }, (_, i) => `<a href="/j/${i}">Similar job number ${i}</a>`).join("");
    const body = "We build payroll software for small businesses. ".repeat(10);
    document.body.innerHTML = `<main><nav>${links}</nav><section class="job-description"><p>${body}</p></section></main>`;
    const snapshot = serialized(collectPageSnapshot)({});
    expect(snapshot.mainHtml).toContain("payroll software");
    expect(snapshot.mainHtml).not.toContain("Similar job");
  });
});

describe("MAIN-world probes", () => {
  const page = window as unknown as Record<string, unknown>;

  it("SEEK: reads the selected job from the live Apollo cache, not the first page load", () => {
    const job = (id: string, title: string) => ({ id, title, __typename: "Job" });
    page.SEEK_APOLLO_DATA = { ROOT_QUERY: { 'jobDetails:{"id":"1"}': { job: job("1", "First") } } };
    page.__APOLLO_CLIENT__ = {
      cache: {
        extract: () => ({
          ROOT_QUERY: { 'jobDetails:{"id":"2"}': { job: { __ref: "Job:2" } } },
          "Job:2": job("2", "Selected"),
        }),
      },
    };
    const probe = serialized(seek.probe!);
    expect(JSON.parse(probe("2")!).job.title).toBe("Selected");
    expect(JSON.parse(probe("1")!).job.title).toBe("First");
    expect(probe("3")).toBeNull();
    expect(probe(null)).toBeNull();
  });

  it("Greenhouse and Ashby: return only the job fields", () => {
    page.__remixContext = {
      state: {
        loaderData: {
          root: { user: "secret" },
          "routes/$url_token_.jobs_.$job_post_id": { jobPost: { title: "SRE", questions: ["q"], company_name: "Acme" } },
        },
      },
    };
    expect(JSON.parse(serialized(greenhouse.probe!)(null)!)).toEqual({ title: "SRE", company_name: "Acme" });

    page.__appData = { posting: { id: "abc", title: "PM", workplaceType: "Hybrid", secret: 1 }, organization: { name: "Ramp" } };
    expect(JSON.parse(serialized(ashby.probe!)("abc")!)).toEqual({
      title: "PM",
      workplaceType: "Hybrid",
      organization: "Ramp",
    });
    expect(serialized(ashby.probe!)("other")).toBeNull();
  });
});
