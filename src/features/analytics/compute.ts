import type { ApplicationOutcome, ApplicationStatus, StageCategory } from "@/generated/prisma/enums";
import { addDaysToDateOnly, parseDateOnly, toDateOnly } from "@/lib/dates";

/**
 * Pure analytics over one cohort of application attempts (those submitted in
 * the selected date range). Every rate uses DISTINCT applications as the
 * denominator and numerator, so an application with five interviews or three
 * offer revisions still counts once.
 */

export type AnalyticsApplication = {
  id: string;
  appliedOn: string;
  status: ApplicationStatus;
  outcome: ApplicationOutcome | null;
  stageName: string;
  stageCategory: StageCategory;
  source: string | null;
  firstResponseAt: Date | null;
  interviewCount: number;
  offerCount: number;
  /** Stage categories reached earlier (from stage-change history). */
  historyCategories: StageCategory[];
};

const CATEGORY_RANK: Record<StageCategory, number> = {
  OTHER: 0,
  APPLIED: 1,
  SCREENING: 2,
  ASSESSMENT: 3,
  INTERVIEW: 4,
  OFFER: 5,
};

/** Furthest point an application reached, from its stage history, interviews and offers. */
export function furthestRank(application: AnalyticsApplication): number {
  const ranks = [application.stageCategory, ...application.historyCategories].map(
    (category) => CATEGORY_RANK[category],
  );
  if (application.interviewCount > 0) ranks.push(CATEGORY_RANK.INTERVIEW);
  if (application.offerCount > 0) ranks.push(CATEGORY_RANK.OFFER);
  return Math.max(CATEGORY_RANK.APPLIED, ...ranks);
}

export function rate(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/** Whole days from the application date to the first recorded response. */
export function responseDays(application: AnalyticsApplication): number | null {
  if (!application.firstResponseAt) return null;
  const applied = parseDateOnly(application.appliedOn).getTime();
  return Math.max(0, Math.round((application.firstResponseAt.getTime() - applied) / 86_400_000));
}

export type TrendBucket = { start: string; label: string; count: number };

/** Week starts (by `weekStartsOn`) or month starts covering [from, to]. */
export function trendBuckets(
  applications: AnalyticsApplication[],
  from: string,
  to: string,
  granularity: "week" | "month",
  weekStartsOn: number,
): TrendBucket[] {
  const startOf = (date: string): string => {
    if (granularity === "month") return `${date.slice(0, 7)}-01`;
    const day = parseDateOnly(date).getUTCDay();
    return addDaysToDateOnly(date, -((day - weekStartsOn + 7) % 7));
  };
  const next = (start: string): string => {
    if (granularity === "week") return addDaysToDateOnly(start, 7);
    const date = parseDateOnly(start);
    return toDateOnly(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)));
  };
  const buckets: TrendBucket[] = [];
  for (let start = startOf(from); start <= to && buckets.length < 400; start = next(start)) {
    const date = parseDateOnly(start);
    const label =
      granularity === "month"
        ? date.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" })
        : date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    buckets.push({ start, label, count: 0 });
  }
  for (const application of applications) {
    const bucket = buckets.findLast((item) => item.start <= application.appliedOn);
    if (bucket) bucket.count += 1;
  }
  return buckets;
}

export type SourceRow = {
  source: string;
  submitted: number;
  interviewed: number;
  offers: number;
  interviewRate: number | null;
  offerRate: number | null;
};

export type AnalyticsSummary = {
  submitted: number;
  active: number;
  closed: number;
  interviewed: number;
  offered: number;
  interviewRate: number | null;
  offerRate: number | null;
  responsesRecorded: number;
  medianResponseDays: number | null;
  funnel: { label: string; count: number }[];
  byStage: { name: string; category: StageCategory; count: number }[];
  outcomes: { outcome: ApplicationOutcome; count: number }[];
  sources: SourceRow[];
};

export function summarize(applications: AnalyticsApplication[]): AnalyticsSummary {
  const submitted = applications.length;
  const interviewed = applications.filter((application) => application.interviewCount > 0).length;
  const offered = applications.filter((application) => application.offerCount > 0).length;
  const responses = applications.map(responseDays).filter((days): days is number => days !== null);
  const ranks = applications.map(furthestRank);

  const stageCounts = new Map<string, { name: string; category: StageCategory; count: number }>();
  for (const application of applications.filter((item) => item.status !== "CLOSED")) {
    const key = `${application.stageCategory}:${application.stageName}`;
    const entry = stageCounts.get(key) ?? {
      name: application.stageName,
      category: application.stageCategory,
      count: 0,
    };
    entry.count += 1;
    stageCounts.set(key, entry);
  }

  const outcomeCounts = new Map<ApplicationOutcome, number>();
  for (const application of applications) {
    if (application.outcome)
      outcomeCounts.set(application.outcome, (outcomeCounts.get(application.outcome) ?? 0) + 1);
  }

  const sourceMap = new Map<string, { submitted: number; interviewed: number; offers: number }>();
  for (const application of applications) {
    const key = application.source?.trim() || "Unknown";
    const entry = sourceMap.get(key) ?? { submitted: 0, interviewed: 0, offers: 0 };
    entry.submitted += 1;
    if (application.interviewCount > 0) entry.interviewed += 1;
    if (application.offerCount > 0) entry.offers += 1;
    sourceMap.set(key, entry);
  }

  return {
    submitted,
    active: applications.filter((application) => application.status !== "CLOSED").length,
    closed: applications.filter((application) => application.status === "CLOSED").length,
    interviewed,
    offered,
    interviewRate: rate(interviewed, submitted),
    offerRate: rate(offered, submitted),
    responsesRecorded: responses.length,
    medianResponseDays: median(responses),
    funnel: [
      { label: "Applied", count: submitted },
      { label: "Screening or later", count: ranks.filter((rank) => rank >= CATEGORY_RANK.SCREENING).length },
      { label: "Interviewing", count: ranks.filter((rank) => rank >= CATEGORY_RANK.INTERVIEW).length },
      { label: "Offer", count: ranks.filter((rank) => rank >= CATEGORY_RANK.OFFER).length },
    ],
    byStage: [...stageCounts.values()].sort(
      (a, b) => CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category] || b.count - a.count,
    ),
    outcomes: [...outcomeCounts.entries()]
      .map(([outcome, count]) => ({ outcome, count }))
      .sort((a, b) => b.count - a.count),
    sources: [...sourceMap.entries()]
      .map(([source, entry]) => ({
        source,
        ...entry,
        interviewRate: rate(entry.interviewed, entry.submitted),
        offerRate: rate(entry.offers, entry.submitted),
      }))
      .sort((a, b) => b.submitted - a.submitted || a.source.localeCompare(b.source)),
  };
}
