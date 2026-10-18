import { describe, expect, it } from "vitest";
import { buildDraft } from "./build-draft";
import { parseSalary } from "./parse/salary";
import { snapshotOf } from "./snapshot-fixture";

const posting = (extra: Record<string, unknown>) =>
  JSON.stringify({
    "@type": "JobPosting",
    title: "Engineer",
    hiringOrganization: { name: "Ramp" },
    ...extra,
  });

describe("v0.2 fields from JSON-LD", () => {
  it("reads skills, reference, the employer's website and flags validThrough as a deadline guess", () => {
    const { draft, guessed } = buildDraft(
      snapshotOf({
        url: "https://careers.ramp.test/jobs/1",
        jsonLd: [
          posting({
            skills: "React, TypeScript; GraphQL",
            identifier: { value: "R36786" },
            hiringOrganization: { name: "Ramp", sameAs: "https://ramp.com" },
            validThrough: "2026-11-15T12:59:59.999Z",
          }),
        ],
      }),
    );
    expect(draft).toMatchObject({
      requiredSkills: ["React", "TypeScript", "GraphQL"],
      referenceCode: "R36786",
      companyWebsite: "https://ramp.com",
      deadline: "2026-11-15",
      method: "COMPANY_WEBSITE",
    });
    expect(guessed).toContain("deadline");
  });

  it("skips job board company pages, UUID identifiers and DefinedTerm noise", () => {
    const { draft } = buildDraft(
      snapshotOf({
        url: "https://careers.acme.test/jobs/2",
        jsonLd: [
          posting({
            skills: [{ "@type": "DefinedTerm", name: "SQL" }, "Python"],
            identifier: { value: "cc0af88a-2a19-493d-93cf-c5090f986f1f" },
            hiringOrganization: { name: "Acme", sameAs: "https://www.linkedin.com/company/acme" },
          }),
        ],
      }),
    );
    expect(draft).toMatchObject({ requiredSkills: ["SQL", "Python"], referenceCode: "", companyWebsite: "" });
  });
});

describe("contact and defaults", () => {
  it("guesses a contact email from the description, skipping no-reply addresses", () => {
    const description = `<p>${"We build payroll tools for small teams. ".repeat(6)}</p><p>Questions: noreply@acme.test or hiring.team@acme.test</p>`;
    const { draft, guessed } = buildDraft(
      snapshotOf({ url: "https://ph.jobstreet.com/job/1", h1: "Analyst", mainHtml: description }),
    );
    expect(draft).toMatchObject({
      contactEmail: "hiring.team@acme.test",
      saveContact: false,
      method: "JOB_BOARD",
    });
    expect(guessed).toContain("contactEmail");
  });

  it("reads LinkedIn's hiring team and turns on saving the contact", () => {
    const { draft } = buildDraft(
      snapshotOf({
        url: "https://www.linkedin.com/jobs/view/4462909410/",
        text: {
          title: ["Engineer"],
          company: ["Amadeus"],
          contactName: ["Maria Santos"],
          contactTitle: ["Talent Partner"],
        },
        links: { contactProfile: "https://ph.linkedin.com/in/maria-santos-123?trk=public_jobs" },
      }),
    );
    expect(draft).toMatchObject({
      contactName: "Maria Santos",
      contactTitle: "Talent Partner",
      contactLinkedinUrl: "https://ph.linkedin.com/in/maria-santos-123/",
      saveContact: true,
    });
  });

  it("takes explicit deadlines from Kalibrr and Greenhouse without flagging them", () => {
    const kalibrr = buildDraft(
      snapshotOf({
        url: "https://www.kalibrr.com/c/acme/jobs/240698/dev",
        scripts: {
          __NEXT_DATA__: JSON.stringify({
            props: {
              pageProps: {
                job: { id: 240698, name: "Dev", applicationEndDate: "2026-11-29T16:00:00+00:00" },
              },
            },
          }),
        },
      }),
    );
    expect(kalibrr.draft.deadline).toBe("2026-11-29");
    expect(kalibrr.guessed).not.toContain("deadline");

    const greenhouse = buildDraft(snapshotOf({ url: "https://job-boards.greenhouse.io/acme/jobs/1" }), {
      title: "SRE",
      company_name: "Acme",
      application_deadline: "2026-12-01",
    });
    expect(greenhouse.draft.deadline).toBe("2026-12-01");
  });
});

describe("salary basis", () => {
  it("reads gross and net wording", () => {
    expect(parseSalary("PHP 30,000 gross per month")?.basis).toBe("GROSS");
    expect(parseSalary("RM 4,000 take-home monthly")?.basis).toBe("NET");
    expect(parseSalary("$80,000 per year")?.basis).toBe("");
  });
});
