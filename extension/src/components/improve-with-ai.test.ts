import { describe, expect, it } from "vitest";
import { emptyDraft } from "@/lib/draft";
import { suggestionPatch } from "./improve-with-ai";

describe("suggestionPatch", () => {
  it("fills only empty fields and switches on saving a suggested contact", () => {
    const values = { ...emptyDraft(), title: "Typed by me", requiredSkills: ["Go"] };
    expect(
      suggestionPatch(values, {
        title: "From AI",
        location: "Pasig",
        requiredSkills: ["Rust"],
        employmentType: "FULL_TIME",
        contactName: "Maria Santos",
      }),
    ).toEqual({
      location: "Pasig",
      employmentType: "FULL_TIME",
      contactName: "Maria Santos",
      saveContact: true,
    });
  });

  it("returns nothing new when the form already has everything", () => {
    expect(suggestionPatch({ ...emptyDraft(), location: "Makati" }, { location: "Pasig" })).toEqual({});
  });
});
