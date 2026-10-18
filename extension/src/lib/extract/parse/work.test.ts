import { describe, expect, it } from "vitest";
import { arrangementFromLabel, arrangementFromText, employmentFromLabel } from "./work";

describe("arrangementFromLabel", () => {
  it.each([
    ["Hybrid", "HYBRID"],
    ["On-site", "ONSITE"],
    ["OnSite", "ONSITE"],
    ["Remote, United States", "REMOTE"],
    ["Hybrid remote", "HYBRID"],
    ["Work from home", "REMOTE"],
    ["Makati City", ""],
  ])("%s", (label, expected) => expect(arrangementFromLabel(label)).toBe(expected));
});

describe("arrangementFromText", () => {
  it("only counts phrases about the job", () => {
    expect(arrangementFromText("This is a hybrid work setup, 3 days in office.")).toBe("HYBRID");
    expect(arrangementFromText("Fully remote within the Philippines.")).toBe("REMOTE");
    expect(arrangementFromText("Experience with hybrid cloud and remote monitoring tools.")).toBe("");
    expect(arrangementFromText("This is a remote role? No: this is not a remote role.")).toBe("");
  });
});

describe("employmentFromLabel", () => {
  it.each([
    ["Full time", "FULL_TIME"],
    ["FullTime", "FULL_TIME"],
    ["Full-time /", "FULL_TIME"],
    ["Part time", "PART_TIME"],
    ["Contract/Temp", "CONTRACT"],
    ["Casual/Vacation", "TEMPORARY"],
    ["Internship / OJT", "INTERNSHIP"],
    ["Gig", "FREELANCE"],
    ["Mid-Senior level", ""],
  ])("%s", (label, expected) => expect(employmentFromLabel(label)).toBe(expected));
});
