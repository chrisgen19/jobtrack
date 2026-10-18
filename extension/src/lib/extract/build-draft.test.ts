import { describe, expect, it } from "vitest";
import { buildDraft } from "./build-draft";
import { mergeLayers } from "./merge";
import { snapshotOf as snapshot } from "./snapshot-fixture";
import { sourceFromUrl } from "./source";
import { htmlToText } from "./text";

const posting = {
  "@context": "https://schema.org",
  "@type": "JobPosting",
  title: "Senior Frontend Engineer",
  hiringOrganization: { "@type": "Organization", name: "Globex &amp; Co" },
  description:
    "&lt;p&gt;Build things.&lt;/p&gt;&lt;ul&gt;&lt;li&gt;React&lt;/li&gt;&lt;li&gt;TypeScript&lt;/li&gt;&lt;/ul&gt;",
  employmentType: ["FULL_TIME"],
  jobLocationType: "TELECOMMUTE",
  jobLocation: {
    "@type": "Place",
    address: { addressLocality: "Makati", addressRegion: "Metro Manila", addressCountry: { name: "PH" } },
  },
  baseSalary: {
    "@type": "MonetaryAmount",
    currency: "php",
    value: { "@type": "QuantitativeValue", minValue: 90000, maxValue: 120000, unitText: "MONTH" },
  },
};

describe("buildDraft", () => {
  it("reads a JobPosting nested in @graph", () => {
    const { draft, status } = buildDraft(
      snapshot({
        url: "https://careers.globex.test/jobs/123?trk=feed",
        canonicalUrl: "https://careers.globex.test/jobs/123",
        jsonLd: ["{not json", JSON.stringify({ "@graph": [{ "@type": "WebPage" }, posting] })],
      }),
    );
    expect(status).toBe("found");
    expect(draft).toMatchObject({
      title: "Senior Frontend Engineer",
      companyName: "Globex & Co",
      location: "Makati, Metro Manila, PH",
      workArrangement: "REMOTE",
      employmentType: "FULL_TIME",
      salaryMin: "90000",
      salaryMax: "120000",
      currency: "PHP",
      salaryPeriod: "MONTHLY",
      source: "Company website",
      postingUrl: "https://careers.globex.test/jobs/123",
    });
    expect(draft.description).toBe("Build things.\n\n• React\n• TypeScript");
  });

  it("falls back to meta tags and never uses a job board as the company", () => {
    const board = buildDraft(
      snapshot({
        url: "https://ph.jobstreet.com/job/1",
        title: "Data Analyst - JobStreet",
        meta: { "og:site_name": "JobStreet" },
      }),
    );
    expect(board.status).toBe("partial");
    expect(board.draft).toMatchObject({ title: "Data Analyst", companyName: "", source: "JobStreet" });

    const careers = buildDraft(
      snapshot({
        url: "https://careers.acme.test/roles/42",
        meta: {
          "og:title": "Platform Engineer | Acme",
          "og:site_name": "Acme",
          "og:description": "Join  our   team.",
        },
      }),
    );
    expect(careers.draft).toMatchObject({
      title: "Platform Engineer",
      companyName: "Acme",
      source: "Company website",
      description: "Join our team.",
    });
    expect(careers.guessed).toContain("companyName");
  });

  it("prefers a meaningful text selection as the description", () => {
    const selection = "Responsibilities: own the design system and mentor two engineers.";
    const { draft } = buildDraft(snapshot({ jsonLd: [JSON.stringify(posting)], selection }));
    expect(draft.description).toBe(selection);
    expect(
      buildDraft(snapshot({ jsonLd: [JSON.stringify(posting)], selection: "React" })).draft.description,
    ).toContain("Build things.");
  });

  it("handles a single numeric salary and unknown employment types", () => {
    const { draft } = buildDraft(
      snapshot({
        jsonLd: [
          JSON.stringify({
            "@type": ["JobPosting"],
            title: "Support",
            hiringOrganization: "Initech",
            employmentType: "SEASONAL",
            baseSalary: { value: { value: 25, unitText: "HOUR", currency: "usd" } },
          }),
        ],
      }),
    );
    expect(draft).toMatchObject({
      companyName: "Initech",
      employmentType: "",
      salaryMin: "25",
      salaryMax: "",
      currency: "USD",
      salaryPeriod: "HOURLY",
    });
  });

  it("guesses pay and work setup from a generic page's text and flags them", () => {
    const body = [
      "<p>We are hiring a backend developer to own our billing services and APIs.</p>",
      "<p>You will work with product and finance on invoicing, payment retries and reporting.</p>",
      "<p>This is a hybrid work setup with two office days in Ortigas each week.</p>",
      "<p>Salary: ₱50,000 - ₱65,000 per month plus HMO.</p>",
    ].join("");
    const { draft, guessed } = buildDraft(
      snapshot({ url: "https://careers.acme.test/backend", h1: "Backend Developer", mainHtml: body }),
    );
    expect(draft).toMatchObject({
      title: "Backend Developer",
      workArrangement: "HYBRID",
      salaryMin: "50000",
      salaryMax: "65000",
      currency: "PHP",
      salaryPeriod: "MONTHLY",
    });
    expect(guessed).toEqual(expect.arrayContaining(["workArrangement", "salaryMin", "salaryPeriod"]));
  });
});

describe("mergeLayers", () => {
  it("takes the salary fields from one layer together", () => {
    const merged = mergeLayers([
      { source: "site", values: { title: "A", currency: "AUD" } },
      { source: "json-ld", values: { title: "B", salaryMin: "100", salaryPeriod: "HOURLY", currency: "USD" } },
    ]);
    expect(merged.values).toMatchObject({ title: "A", salaryMin: "100", salaryPeriod: "HOURLY", currency: "USD" });
    expect(merged.sources).toMatchObject({ title: "site", salaryMin: "json-ld" });
  });
});

describe("helpers", () => {
  it("maps hosts to sources", () => {
    expect(sourceFromUrl("https://boards.greenhouse.io/acme/jobs/1")).toBe("Company website");
    expect(sourceFromUrl("https://au.indeed.com/viewjob?jk=1")).toBe("Indeed");
    expect(sourceFromUrl("https://au.seek.com/job/1")).toBe("Seek");
    expect(sourceFromUrl("not a url")).toBe("");
  });

  it("strips scripts and decodes numeric entities", () => {
    expect(htmlToText("<p>Caf&#233; &#x26; bar</p><script>alert(1)</script>")).toBe("Café & bar");
  });
});
