import { describe, expect, it } from "vitest";
import { JOB_SITE_DOMAINS } from "./hosts";
import { adapterFor, jobRefFor, pageKeyFor, SITE_ADAPTERS } from "./registry";

// One job URL per adapter, as the badge and the side panel see them.
const JOB_URLS: Record<string, string> = {
  linkedin: "https://www.linkedin.com/jobs/collections/recommended/?currentJobId=4400000001",
  seek: "https://ph.jobstreet.com/developer-jobs?jobId=95314885&type=standard",
  indeed: "https://ph.indeed.com/jobs?q=developer&vjk=abc123",
  kalibrr: "https://www.kalibrr.com/c/seo-hacker/jobs/240698/web-developer",
  onlinejobs: "https://www.onlinejobs.ph/jobseekers/job/virtual-assistant-1745855",
  greenhouse: "https://job-boards.greenhouse.io/gitlab/jobs/8883003002",
  ashby: "https://jobs.ashbyhq.com/ramp/cc0af88a-2a19-493d-93cf-c5090f986f1f",
  lever: "https://jobs.lever.co/palantir/ac978161-6f46-4f6b-ad9e-a258e642751c",
  workday: "https://nvidia.wd5.myworkdayjobs.com/en-US/External/job/US-CA-Santa-Clara/Engineer_JR2026403",
};

const covered = (url: string) => {
  const host = new URL(url).hostname;
  return JOB_SITE_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
};

describe("job site hosts", () => {
  it("has a job URL for every adapter, inside the optional host permissions", () => {
    expect(Object.keys(JOB_URLS).sort()).toEqual(SITE_ADAPTERS.map((adapter) => adapter.id).sort());
    for (const [id, url] of Object.entries(JOB_URLS)) {
      expect(adapterFor(url)?.id, url).toBe(id);
      expect(jobRefFor(url), url).not.toBeNull();
      expect(covered(url), url).toBe(true);
    }
  });

  it("finds no job on search pages without a selection or other sites", () => {
    expect(jobRefFor("https://ph.jobstreet.com/developer-jobs")).toBeNull();
    expect(jobRefFor("https://www.linkedin.com/feed/")).toBeNull();
    expect(jobRefFor("https://example.com/careers/1")).toBeNull();
  });
});

describe("pageKeyFor", () => {
  it("keys split views by the selected job, ignoring tracking parameters", () => {
    expect(pageKeyFor("https://www.linkedin.com/jobs/search/?currentJobId=123456789&keywords=dev")).toBe(
      "https://www.linkedin.com/jobs/view/123456789/",
    );
    expect(
      pageKeyFor("https://www.linkedin.com/jobs/collections/recommended/?currentJobId=123456789&trk=x"),
    ).toBe("https://www.linkedin.com/jobs/view/123456789/");
    expect(pageKeyFor("https://ph.jobstreet.com/developer-jobs?jobId=95314885&type=standard")).toBe(
      "https://ph.jobstreet.com/job/95314885",
    );
    expect(pageKeyFor("https://careers.acme.test/roles/42")).toBe("https://careers.acme.test/roles/42");
  });

  it("ignores same-page anchors but keeps hash routes", () => {
    const posting = "https://careers.acme.test/roles/42";
    expect(pageKeyFor(`${posting}#description`)).toBe(posting);
    expect(pageKeyFor(`${posting}?ref=x#apply`)).toBe(`${posting}?ref=x`);
    expect(pageKeyFor(`${posting}#`)).toBe(posting);
    expect(pageKeyFor("https://jobs.acme.test/#/jobs/7")).toBe("https://jobs.acme.test/#/jobs/7");
    expect(pageKeyFor("https://jobs.acme.test/#!/jobs/7")).toBe("https://jobs.acme.test/#!/jobs/7");
    expect(pageKeyFor("https://www.linkedin.com/jobs/search/?currentJobId=123456789#main")).toBe(
      "https://www.linkedin.com/jobs/view/123456789/",
    );
  });
});
