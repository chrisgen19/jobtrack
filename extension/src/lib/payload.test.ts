import { describe, expect, it } from "vitest";
import { emptyDraft } from "./draft";
import { addDays } from "./load-review";
import { firstErrors, toPayload, validateDraft } from "./payload";

const job = { ...emptyDraft(), title: "Engineer", companyName: "Acme" };

describe("toPayload", () => {
  it("nests the contact and the to-do, and sends each only when switched on", () => {
    const values = {
      ...job,
      saveContact: true,
      contactName: "Maria Santos",
      contactEmail: "maria@acme.example",
      addFollowUp: true,
      followUpType: "APPLY" as const,
      followUpDate: "2099-01-05",
    };
    expect(toPayload(values)).toMatchObject({
      contact: { name: "Maria Santos", email: "maria@acme.example", kind: "RECRUITER" },
      followUp: { type: "APPLY", dueDate: "2099-01-05" },
    });
    const plain = toPayload({ ...values, saveContact: false, addFollowUp: false });
    expect(plain).not.toHaveProperty("contact");
    expect(plain).not.toHaveProperty("followUp");
    expect(plain).not.toHaveProperty("contactName");
  });

  it("drops the to-do and keeps the method once the job is marked applied", () => {
    const payload = toPayload({
      ...job,
      alreadyApplied: true,
      appliedOn: "2026-10-01",
      method: "JOB_BOARD",
      addFollowUp: true,
      followUpDate: "2099-01-05",
    });
    expect(payload).toMatchObject({ alreadyApplied: true, method: "JOB_BOARD" });
    expect(payload).not.toHaveProperty("followUp");
    expect(toPayload({ ...job, method: "JOB_BOARD" })).not.toHaveProperty("method");
  });
});

describe("field errors", () => {
  it("maps nested and list paths to the form fields", () => {
    expect(
      firstErrors({
        "contact.email": ["Enter a valid email."],
        "followUp.dueDate": ["Choose a date."],
        "requiredSkills.2": ["Too long."],
        followUp: ["Not on applied jobs."],
      }),
    ).toEqual({
      contactEmail: "Enter a valid email.",
      followUpDate: "Choose a date.",
      requiredSkills: "Too long.",
    });
  });

  it("checks the contact name on the client", () => {
    expect(validateDraft({ ...job, saveContact: true, contactName: " " })).toHaveProperty("contactName");
    expect(validateDraft({ ...job, saveContact: true, contactName: "Jo" })).toEqual({});
  });
});

describe("addDays", () => {
  it("adds calendar days across month and year ends", () => {
    expect(addDays("2026-10-28", 7)).toBe("2026-11-04");
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });
});
