import { describe, expect, it } from "vitest";
import { isStaleRead } from "./load-review";

const jobA = { pageUrl: "https://www.linkedin.com/jobs/view/1/", pageTitle: "Frontend Developer" };

describe("isStaleRead", () => {
  it("is stale while a new job's URL still shows the previous job's title", () => {
    const read = { pageKey: "https://www.linkedin.com/jobs/view/2/", title: "Frontend Developer" };
    expect(isStaleRead(read, jobA)).toBe(true);
  });

  it("is fresh once the title changes, or for the same job", () => {
    expect(
      isStaleRead({ pageKey: "https://www.linkedin.com/jobs/view/2/", title: "Data Analyst" }, jobA),
    ).toBe(false);
    expect(isStaleRead({ pageKey: jobA.pageUrl, title: jobA.pageTitle }, jobA)).toBe(false);
  });

  it("compares the title read from the page, not the edited draft title", () => {
    // Job A's form was restored from a draft with an edited title; the stale page still shows the original.
    const restored = { ...jobA, initial: { title: "Senior Frontend Developer" } };
    const read = { pageKey: "https://www.linkedin.com/jobs/view/2/", title: "Frontend Developer" };
    expect(isStaleRead(read, restored)).toBe(true);
  });

  it("is never stale without a read or a previous page title", () => {
    expect(isStaleRead(null, jobA)).toBe(false);
    expect(isStaleRead({ pageKey: "https://x.test/2", title: "" }, undefined)).toBe(false);
    expect(isStaleRead({ pageKey: "https://x.test/2", title: "" }, { pageUrl: null, pageTitle: null })).toBe(
      false,
    );
  });
});
