import { describe, expect, it } from "vitest";
import { buildDraft } from "../build-draft";
import { snapshotOf } from "../snapshot-fixture";

// Shapes below mirror the live pages checked on 2026-10-18 (trimmed, made-up text).

describe("JobStreet / SEEK", () => {
  const job = {
    id: "95314885",
    title: "Junior Programmer",
    'content2({"zone":"asia-6"})': "<p><strong>About the role</strong></p><p>Build internal tools.</p>",
    salary: { label: "₱25,000 – ₱30,000 per month" },
    workTypes: { 'label({"locale":"en-PH"})': "Full time" },
    advertiser: { 'name({"locale":"en-PH"})': "Mitsuba Philippines Technical Center Corp." },
    location: { 'label({"locale":"en-PH","type":"LONG"})': "Makati City, Metro Manila" },
  };
  const details = {
    'workArrangements({"channel":"JDV"})': { arrangements: [{ type: "ONSITE" }] },
  };
  // JSON-LD of the job the page first loaded, still in the document after a split-view click.
  const staleJsonLd = JSON.stringify({
    "@type": "JobPosting",
    title: "Senior Programmer",
    hiringOrganization: { name: "Other Corp" },
    identifier: { value: "95312761" },
  });

  it("reads the selected job in the split view and ignores the stale page data", () => {
    const built = buildDraft(
      snapshotOf({
        url: "https://ph.jobstreet.com/developer-jobs?jobId=95314885&type=standard",
        title: "Developer Jobs in Philippines - Oct 2026 | Jobstreet",
        meta: { "og:title": "Developer Jobs in Philippines" },
        jsonLd: [staleJsonLd],
      }),
      { details, job },
    );
    expect(built.draft).toMatchObject({
      title: "Junior Programmer",
      companyName: "Mitsuba Philippines Technical Center Corp.",
      location: "Makati City, Metro Manila",
      employmentType: "FULL_TIME",
      workArrangement: "ONSITE",
      salaryMin: "25000",
      salaryMax: "30000",
      currency: "PHP",
      salaryPeriod: "MONTHLY",
      postingUrl: "https://ph.jobstreet.com/job/95314885",
      source: "JobStreet",
    });
    expect(built.draft.description).toBe("About the role\nBuild internal tools.");
    expect(built.pageKey).toBe("https://ph.jobstreet.com/job/95314885");
    expect(built.status).toBe("found");
  });

  it("falls back to the data-automation elements when the probe found nothing", () => {
    const built = buildDraft(
      snapshotOf({
        url: "https://au.seek.com/job/95082866",
        text: {
          title: ["Web Developer (Full Stack)"],
          company: ["Acme Digital"],
          location: ["Northcote, Melbourne VIC"],
          workType: ["Contract/Temp"],
          salary: ["$75,000 – $95,000 per year"],
        },
        html: { description: "<p>Full stack role.</p>" },
      }),
      null,
    );
    expect(built.draft).toMatchObject({
      title: "Web Developer (Full Stack)",
      companyName: "Acme Digital",
      employmentType: "CONTRACT",
      salaryMin: "75000",
      salaryMax: "95000",
      currency: "AUD",
      salaryPeriod: "ANNUALLY",
      description: "Full stack role.",
      source: "Seek",
    });
  });
});

describe("LinkedIn", () => {
  it("reads a signed-out job page and links to the job without tracking", () => {
    const built = buildDraft(
      snapshotOf({
        url: "https://ph.linkedin.com/jobs/view/software-engineer-at-amadeus-4462909410?trk=x",
        canonicalUrl: "https://ph.linkedin.com/jobs/view/software-engineer-at-amadeus-4462909410",
        meta: { "og:site_name": "LinkedIn" },
        text: {
          title: ["Software Development Engineer II"],
          company: ["Amadeus"],
          location: ["Taguig, National Capital Region, Philippines"],
          criteria: ["Seniority level Mid-Senior level", "Employment type Full-time"],
        },
        html: { description: "<p>Java and loyalty solutions.</p>" },
        jsonLd: [
          JSON.stringify({
            "@type": "JobPosting",
            title: "Software Development Engineer II",
            hiringOrganization: { name: "Amadeus" },
            identifier: { value: "R36786" },
            jobLocation: { address: { addressLocality: "Taguig", addressCountry: "PH" } },
          }),
        ],
      }),
    );
    expect(built.draft).toMatchObject({
      companyName: "Amadeus",
      location: "Taguig, National Capital Region, Philippines",
      employmentType: "FULL_TIME",
      postingUrl: "https://www.linkedin.com/jobs/view/4462909410/",
      source: "LinkedIn",
    });
    expect(built.status).toBe("found");
  });

  it("reads the details pane of a collections page and its chips", () => {
    const built = buildDraft(
      snapshotOf({
        url: "https://www.linkedin.com/jobs/collections/recommended/?currentJobId=4400000001",
        title: "Top job picks for you | LinkedIn",
        text: {
          title: ["Frontend Engineer"],
          company: ["Globex"],
          chips: ["₱120K/month - ₱150K/month", "Remote", "Full-time"],
        },
        html: { description: "<p>React work.</p>" },
      }),
    );
    expect(built.draft).toMatchObject({
      title: "Frontend Engineer",
      workArrangement: "REMOTE",
      employmentType: "FULL_TIME",
      salaryMin: "120000",
      salaryMax: "150000",
      currency: "PHP",
      salaryPeriod: "MONTHLY",
      postingUrl: "https://www.linkedin.com/jobs/view/4400000001/",
    });
  });
});

describe("Kalibrr", () => {
  const nextData = (job: Record<string, unknown>) =>
    JSON.stringify({ props: { pageProps: { job: { id: 240698, name: "Web Developer", ...job } } } });

  it("reads __NEXT_DATA__ and respects a hidden salary", () => {
    const base = {
      company: { name: "SEO Hacker" },
      description: "<ul><li>Build WordPress themes</li></ul>",
      qualifications: "<ul><li>PHP</li></ul>",
      tenure: "Full time",
      isHybrid: true,
      googleLocation: { addressComponents: { city: "Parañaque", region: "Metro Manila" } },
      baseSalary: 18000,
      maximumSalary: 23000,
      salaryCurrency: "PHP",
      salaryInterval: "month",
    };
    const url = "https://www.kalibrr.com/c/seo-hacker/jobs/240698/web-developer";
    const shown = buildDraft(snapshotOf({ url, scripts: { __NEXT_DATA__: nextData({ ...base, salaryShown: true }) } }));
    expect(shown.draft).toMatchObject({
      companyName: "SEO Hacker",
      location: "Parañaque, Metro Manila",
      workArrangement: "HYBRID",
      employmentType: "FULL_TIME",
      salaryMin: "18000",
      salaryMax: "23000",
      currency: "PHP",
      salaryPeriod: "MONTHLY",
    });
    expect(shown.draft.description).toBe("• Build WordPress themes\n\nQualifications\n• PHP");

    const hidden = buildDraft(snapshotOf({ url, scripts: { __NEXT_DATA__: nextData({ ...base, salaryShown: false }) } }));
    expect(hidden.draft).toMatchObject({ salaryMin: "", salaryMax: "", salaryPeriod: "" });
  });
});

describe("OnlineJobs.ph", () => {
  it("reads labelled fields and never uses the board as the company", () => {
    const built = buildDraft(
      snapshotOf({
        url: "https://www.onlinejobs.ph/jobseekers/job/virtual-assistant-1745855",
        meta: { "og:site_name": "OnlineJobs.ph" },
        text: { title: ["Virtual Assistant"] },
        html: { description: "<p>Answer emails.</p>" },
        labelled: { "TYPE OF WORK": "Part Time", "WAGE / SALARY": "$5/hr" },
      }),
    );
    expect(built.draft).toMatchObject({
      title: "Virtual Assistant",
      companyName: "",
      employmentType: "PART_TIME",
      workArrangement: "REMOTE",
      salaryMin: "5",
      salaryPeriod: "HOURLY",
    });
  });
});

describe("applicant tracking systems", () => {
  it("Greenhouse: reads the job post and its pay range", () => {
    const built = buildDraft(
      snapshotOf({
        url: "https://job-boards.greenhouse.io/gitlab/jobs/8883003002",
        canonicalUrl: "http://job-boards.greenhouse.io/gitlab/jobs/8883003002",
      }),
      {
        title: "Director, Analytics Engineering ",
        company_name: "GitLab",
        job_post_location: "Remote, United States",
        content: "&lt;h2&gt;An overview of this role&lt;/h2&gt;",
        pay_ranges: [{ min: "$139,200", max: "$285,600", currency_type: "USD" }],
      },
    );
    expect(built.draft).toMatchObject({
      title: "Director, Analytics Engineering",
      companyName: "GitLab",
      workArrangement: "REMOTE",
      salaryMin: "139200",
      salaryMax: "285600",
      currency: "USD",
      salaryPeriod: "ANNUALLY",
      description: "An overview of this role",
      postingUrl: "https://job-boards.greenhouse.io/gitlab/jobs/8883003002",
    });
    expect(built.guessed).toContain("salaryPeriod");
  });

  it("Ashby: the posting's workplace type beats JSON-LD's TELECOMMUTE, JSON-LD gives the salary", () => {
    const built = buildDraft(
      snapshotOf({
        url: "https://jobs.ashbyhq.com/ramp/cc0af88a-2a19-493d-93cf-c5090f986f1f",
        jsonLd: [
          JSON.stringify({
            "@type": "JobPosting",
            title: "AI Partnerships Manager",
            hiringOrganization: { name: "Ramp" },
            jobLocationType: "TELECOMMUTE",
            baseSalary: { currency: "USD", value: { minValue: 220000, maxValue: 330000, unitText: "YEAR" } },
          }),
        ],
      }),
      { title: "AI Partnerships Manager", workplaceType: "Hybrid", employmentType: "FullTime", organization: "Ramp" },
    );
    expect(built.draft).toMatchObject({
      workArrangement: "HYBRID",
      employmentType: "FULL_TIME",
      salaryMin: "220000",
      salaryMax: "330000",
      currency: "USD",
      salaryPeriod: "ANNUALLY",
    });
  });

  it("Workday: drops the legal entity code from the employer", () => {
    const built = buildDraft(
      snapshotOf({
        url: "https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite/job/US-CA-Santa-Clara/Senior-Software-Engineer_JR2026403",
        text: {
          title: ["Senior Software Engineer"],
          location: ["US, CA, Santa Clara", "US, Remote"],
          time: ["Full time"],
        },
        jsonLd: [
          JSON.stringify({
            "@type": "JobPosting",
            hiringOrganization: { name: "2100 NVIDIA USA" },
            identifier: { value: "JR2026403" },
          }),
        ],
      }),
    );
    expect(built.draft).toMatchObject({
      companyName: "NVIDIA USA",
      location: "US, CA, Santa Clara; US, Remote",
      employmentType: "FULL_TIME",
    });
  });

  it("Lever: work setup from the category bar", () => {
    const built = buildDraft(
      snapshotOf({
        url: "https://jobs.lever.co/palantir/ac978161-6f46-4f6b-ad9e-a258e642751c",
        text: { workplace: ["Hybrid"], commitment: ["Full-time /"], location: ["London, United Kingdom"] },
        jsonLd: [
          JSON.stringify({
            "@type": "JobPosting",
            title: "Administrative Business Partner",
            hiringOrganization: { name: "Palantir Technologies" },
            employmentType: "Full-time",
          }),
        ],
      }),
    );
    expect(built.draft).toMatchObject({
      companyName: "Palantir Technologies",
      location: "London, United Kingdom",
      workArrangement: "HYBRID",
      employmentType: "FULL_TIME",
    });
  });
});
