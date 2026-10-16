import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { emptyDraft } from "./draft";
import { loadDraft, MAX_DRAFTS, removeDraft, saveDraft } from "./drafts";

const A = "https://jobs.example.com/a";
const B = "https://jobs.example.com/b";
const draft = (title: string) => ({ ...emptyDraft(), title });

describe("per-page drafts", () => {
  beforeEach(() => fakeBrowser.reset());

  it("keeps page A's edits after a draft is stored for page B (A → B → A)", async () => {
    await saveDraft(A, draft("Edited on A"));
    // Opening and editing the popup on B must not touch A's draft.
    expect(await loadDraft(B)).toBeNull();
    await saveDraft(B, draft("Edited on B"));
    expect((await loadDraft(A))?.title).toBe("Edited on A");
    expect((await loadDraft(B))?.title).toBe("Edited on B");
  });

  it("removes only the draft of the page that was saved", async () => {
    await saveDraft(A, draft("A"));
    await saveDraft(B, draft("B"));
    await removeDraft(B);
    expect(await loadDraft(B)).toBeNull();
    expect((await loadDraft(A))?.title).toBe("A");
  });

  it(`keeps the ${MAX_DRAFTS} most recently edited drafts`, async () => {
    for (let i = 0; i <= MAX_DRAFTS; i++)
      await saveDraft(`https://jobs.example.com/${i}`, draft(`${i}`), 1_000 + i);
    expect(await loadDraft("https://jobs.example.com/0")).toBeNull();
    expect((await loadDraft("https://jobs.example.com/1"))?.title).toBe("1");
    expect((await loadDraft(`https://jobs.example.com/${MAX_DRAFTS}`))?.title).toBe(`${MAX_DRAFTS}`);
  });
});
