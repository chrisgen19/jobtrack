import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { emptyDraft } from "./draft";
import {
  DRAFT_SAVE_DELAY_MS,
  flushDraftSave,
  loadDraft,
  MAX_DRAFTS,
  removeDraft,
  saveDraft,
  scheduleDraftSave,
  type SavedDraft,
} from "./drafts";
import { draftsItem } from "./storage";

const A = "https://jobs.example.com/a";
const B = "https://jobs.example.com/b";
const draft = (title: string, marks: SavedDraft["marks"] = {}): SavedDraft => ({
  values: { ...emptyDraft(), title },
  marks,
});

describe("per-page drafts", () => {
  beforeEach(() => fakeBrowser.reset());

  it("keeps page A's edits after a draft is stored for page B (A → B → A)", async () => {
    await saveDraft(A, draft("Edited on A"));
    // Opening and editing the popup on B must not touch A's draft.
    expect(await loadDraft(B)).toBeNull();
    await saveDraft(B, draft("Edited on B"));
    expect((await loadDraft(A))?.values.title).toBe("Edited on A");
    expect((await loadDraft(B))?.values.title).toBe("Edited on B");
  });

  it("removes only the draft of the page that was saved", async () => {
    await saveDraft(A, draft("A"));
    await saveDraft(B, draft("B"));
    await removeDraft(B);
    expect(await loadDraft(B)).toBeNull();
    expect((await loadDraft(A))?.values.title).toBe("A");
  });

  it(`keeps the ${MAX_DRAFTS} most recently edited drafts`, async () => {
    for (let i = 0; i <= MAX_DRAFTS; i++)
      await saveDraft(`https://jobs.example.com/${i}`, draft(`${i}`), 1_000 + i);
    expect(await loadDraft("https://jobs.example.com/0")).toBeNull();
    expect((await loadDraft("https://jobs.example.com/1"))?.values.title).toBe("1");
    expect((await loadDraft(`https://jobs.example.com/${MAX_DRAFTS}`))?.values.title).toBe(`${MAX_DRAFTS}`);
  });
});

describe("marked fields in drafts", () => {
  beforeEach(() => fakeBrowser.reset());

  it("keeps the fields still marked (guesses and AI suggestions) with the draft", async () => {
    await saveDraft(A, draft("Edited title", { salaryMin: "check", workArrangement: "ai" }));
    expect((await loadDraft(A))?.marks).toEqual({ salaryMin: "check", workArrangement: "ai" });
  });

  it("reads older drafts: guessed keys become check marks, none means no marks", async () => {
    await draftsItem.setValue({
      [A]: { values: draft("Old").values, guessed: ["salaryMin"], updatedAt: 1_000 },
      [B]: { values: draft("Older").values, updatedAt: 1_000 },
    });
    expect((await loadDraft(A))?.marks).toEqual({ salaryMin: "check" });
    expect(await loadDraft(B)).toEqual({ values: draft("Older").values, marks: {} });
  });
});

describe("draft write ordering", () => {
  beforeEach(() => fakeBrowser.reset());

  it("applies interleaved, unawaited saves and removes in call order", async () => {
    await Promise.all([saveDraft(A, draft("A")), saveDraft(B, draft("B")), removeDraft(A)]);
    expect(await loadDraft(A)).toBeNull();
    expect((await loadDraft(B))?.values.title).toBe("B");
  });
});

describe("batched draft writes", () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    await flushDraftSave(); // drop anything a previous test left scheduled
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it(`writes once, ${DRAFT_SAVE_DELAY_MS} ms after the last edit, with the latest values`, async () => {
    const writes = vi.spyOn(draftsItem, "setValue");
    scheduleDraftSave(A, draft("A1"));
    scheduleDraftSave(A, draft("A12"));
    await vi.advanceTimersByTimeAsync(DRAFT_SAVE_DELAY_MS - 1);
    scheduleDraftSave(A, draft("A123"));
    await vi.advanceTimersByTimeAsync(DRAFT_SAVE_DELAY_MS - 1);
    expect(writes).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect((await loadDraft(A))?.values.title).toBe("A123");
    expect(writes).toHaveBeenCalledTimes(1);
    writes.mockRestore();
  });

  it("cancels a scheduled write when that page's draft is removed after saving", async () => {
    scheduleDraftSave(A, draft("A"));
    await removeDraft(A);
    await vi.advanceTimersByTimeAsync(DRAFT_SAVE_DELAY_MS * 2);
    expect(await loadDraft(A)).toBeNull();
  });

  it("writes a scheduled draft immediately when flushed", async () => {
    scheduleDraftSave(A, draft("A"));
    await flushDraftSave();
    expect((await loadDraft(A))?.values.title).toBe("A");
  });
});
