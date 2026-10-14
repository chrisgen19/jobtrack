import { describe, expect, it } from "vitest";
import {
  furthestRank,
  median,
  responseDays,
  summarize,
  trendBuckets,
  type AnalyticsApplication,
} from "./compute";

function app(overrides: Partial<AnalyticsApplication>): AnalyticsApplication {
  return {
    id: Math.random().toString(36),
    appliedOn: "2026-10-01",
    status: "ACTIVE",
    outcome: null,
    stageName: "Applied",
    stageCategory: "APPLIED",
    source: "LinkedIn",
    respondedOn: null,
    interviewCount: 0,
    offerCount: 0,
    historyCategories: [],
    ...overrides,
  };
}

describe("analytics", () => {
  it("counts distinct applications, not interviews or offer revisions", () => {
    const summary = summarize([
      app({ interviewCount: 5, offerCount: 3, stageCategory: "OFFER", stageName: "Job Offer" }),
      app({ interviewCount: 2 }),
      app({}),
      app({}),
    ]);
    expect(summary.submitted).toBe(4);
    expect(summary.interviewed).toBe(2);
    expect(summary.offered).toBe(1);
    expect(summary.interviewRate).toBe(0.5);
    expect(summary.offerRate).toBe(0.25);
  });

  it("uses stage history so rejected-after-interview applications still count as interviewing", () => {
    const rejected = app({
      status: "CLOSED",
      outcome: "REJECTED",
      historyCategories: ["SCREENING", "INTERVIEW"],
    });
    expect(furthestRank(rejected)).toBe(4);
    const summary = summarize([rejected, app({})]);
    expect(summary.funnel.map((step) => step.count)).toEqual([2, 1, 1, 0]);
    expect(summary.outcomes).toEqual([{ outcome: "REJECTED", count: 1 }]);
    expect(summary.byStage).toEqual([{ name: "Applied", category: "APPLIED", count: 1 }]);
  });

  it("reports response time only for recorded responses (never invented)", () => {
    const responded = app({ appliedOn: "2026-10-01", respondedOn: "2026-10-05" });
    expect(responseDays(responded)).toBe(4);
    expect(responseDays(app({}))).toBeNull();
    const summary = summarize([
      responded,
      app({ appliedOn: "2026-10-01", respondedOn: "2026-10-11" }),
      app({}),
    ]);
    expect(summary.responsesRecorded).toBe(2);
    expect(summary.medianResponseDays).toBe(7);
    expect(median([])).toBeNull();
  });

  it("returns null rates for an empty cohort instead of dividing by zero", () => {
    const summary = summarize([]);
    expect(summary.interviewRate).toBeNull();
    expect(summary.offerRate).toBeNull();
  });

  it("groups sources with their own rates", () => {
    const summary = summarize([
      app({ source: "Referral", interviewCount: 1 }),
      app({ source: "Referral" }),
      app({ source: null }),
    ]);
    expect(summary.sources).toEqual([
      { source: "Referral", submitted: 2, interviewed: 1, offers: 0, interviewRate: 0.5, offerRate: 0 },
      { source: "Unknown", submitted: 1, interviewed: 0, offers: 0, interviewRate: 0, offerRate: 0 },
    ]);
  });

  it("buckets applications by week and by month", () => {
    const apps = [
      app({ appliedOn: "2026-10-01" }),
      app({ appliedOn: "2026-10-03" }),
      app({ appliedOn: "2026-10-05" }),
    ];
    const weeks = trendBuckets(apps, "2026-09-27", "2026-10-10", "week", 0);
    expect(weeks.map((bucket) => [bucket.start, bucket.count])).toEqual([
      ["2026-09-27", 2],
      ["2026-10-04", 1],
    ]);
    const months = trendBuckets(apps, "2026-09-15", "2026-10-31", "month", 0);
    expect(months.map((bucket) => [bucket.start, bucket.count])).toEqual([
      ["2026-09-01", 0],
      ["2026-10-01", 3],
    ]);
  });
});
