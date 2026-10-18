import { describe, expect, it } from "vitest";
import { emptyDraft } from "@/lib/draft";
import { patchedFields, suggestionPatch } from "./improve-with-ai";

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

  it("keeps a field the user filled while the request ran", () => {
    const suggestions = { location: "Pasig", companyName: "Acme", requiredSkills: ["Go"] };
    const asked = emptyDraft();
    const answered = { ...asked, location: "Makati", requiredSkills: ["Rust"] };
    expect(patchedFields(suggestionPatch(asked, suggestions))).toHaveLength(3);
    const patch = suggestionPatch(answered, suggestions);
    expect(patch).toEqual({ companyName: "Acme" });
    expect({ ...answered, ...patch }).toMatchObject({ location: "Makati", requiredSkills: ["Rust"] });
  });

  it("returns nothing new when the form already has everything", () => {
    expect(suggestionPatch({ ...emptyDraft(), location: "Makati" }, { location: "Pasig" })).toEqual({});
  });
});

describe("patchedFields", () => {
  it("counts the filled fields, not the save-contact switch", () => {
    expect(patchedFields({ contactName: "Maria", saveContact: true, location: "Pasig" })).toEqual([
      "contactName",
      "location",
    ]);
  });
});
