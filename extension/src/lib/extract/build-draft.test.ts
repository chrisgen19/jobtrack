import { describe, expect, it } from "vitest";
import { buildDraft } from "./build-draft";
import type { PageSnapshot } from "./snapshot";
import { sourceFromUrl } from "./source";
import { htmlToText } from "./text";

function snapshot(overrides: Partial<PageSnapshot>): PageSnapshot {
  return {
    url: "https://example.com/job",
    canonicalUrl: null,
    title: "",
    h1: null,
    meta: {},
    jsonLd: [],
    selection: "",
    ...overrides,
  };
}

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
    const { draft, foundJobPosting } = buildDraft(
      snapshot({
        url: "https://www.linkedin.com/jobs/view/123?trk=feed",
        canonicalUrl: "https://www.linkedin.com/jobs/view/123",
        meta: { "og:site_name": "LinkedIn" },
        jsonLd: ["{not json", JSON.stringify({ "@graph": [{ "@type": "WebPage" }, posting] })],
      }),
    );
    expect(foundJobPosting).toBe(true);
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
      source: "LinkedIn",
      postingUrl: "https://www.linkedin.com/jobs/view/123",
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
    expect(board.foundJobPosting).toBe(false);
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
            baseSalary: { currency: "USD", value: { value: 25, unitText: "HOUR" } },
          }),
        ],
      }),
    );
    expect(draft).toMatchObject({
      companyName: "Initech",
      employmentType: "",
      salaryMin: "25",
      salaryMax: "",
      salaryPeriod: "HOURLY",
    });
  });
});

describe("helpers", () => {
  it("maps hosts to sources", () => {
    expect(sourceFromUrl("https://boards.greenhouse.io/acme/jobs/1")).toBe("Company website");
    expect(sourceFromUrl("https://au.indeed.com/viewjob?jk=1")).toBe("Indeed");
    expect(sourceFromUrl("not a url")).toBe("");
  });

  it("strips scripts and decodes numeric entities", () => {
    expect(htmlToText("<p>Caf&#233; &#x26; bar</p><script>alert(1)</script>")).toBe("Café & bar");
  });
});
