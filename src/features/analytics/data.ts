import "server-only";
import { StageCategory } from "@/generated/prisma/enums";
import { requireWorkspace } from "@/features/workspace/data";
import { parseDateOnly, toDateOnly, utcToZonedParts } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import {
  summarize,
  trendBuckets,
  type AnalyticsApplication,
  type AnalyticsSummary,
  type TrendBucket,
} from "./compute";

export type AnalyticsReport = AnalyticsSummary & {
  from: string;
  to: string;
  granularity: "week" | "month";
  trend: TrendBucket[];
  savedNotApplied: number;
};

const CATEGORIES = new Set<string>(Object.values(StageCategory));

/** Analytics for applications submitted between `from` and `to` (inclusive). */
export async function getAnalytics(
  from: string,
  to: string,
  granularity: "week" | "month",
): Promise<AnalyticsReport> {
  const { user, preferences } = await requireWorkspace();
  const [rows, savedNotApplied] = await Promise.all([
    prisma.application.findMany({
      where: { userId: user.id, appliedOn: { gte: parseDateOnly(from), lte: parseDateOnly(to) } },
      select: {
        id: true,
        appliedOn: true,
        status: true,
        outcome: true,
        firstResponseAt: true,
        stage: { select: { name: true, category: true } },
        opportunity: { select: { source: true } },
        _count: { select: { interviews: true, offers: true } },
        activities: { where: { type: "STAGE_CHANGED" }, select: { details: true } },
      },
    }),
    prisma.jobOpportunity.count({ where: { userId: user.id, archivedAt: null, applications: { none: {} } } }),
  ]);

  const applications: AnalyticsApplication[] = rows.map((row) => ({
    id: row.id,
    appliedOn: toDateOnly(row.appliedOn),
    status: row.status,
    outcome: row.outcome,
    stageName: row.stage.name,
    stageCategory: row.stage.category,
    source: row.opportunity.source,
    respondedOn: row.firstResponseAt ? utcToZonedParts(row.firstResponseAt, preferences.timezone).date : null,
    interviewCount: row._count.interviews,
    offerCount: row._count.offers,
    historyCategories: row.activities
      .map((event) => (event.details as { toStageCategory?: unknown } | null)?.toStageCategory)
      .filter(
        (category): category is StageCategory => typeof category === "string" && CATEGORIES.has(category),
      ),
  }));

  return {
    ...summarize(applications),
    from,
    to,
    granularity,
    trend: trendBuckets(applications, from, to, granularity, preferences.weekStartsOn),
    savedNotApplied,
  };
}

/** Earliest application date, for the "All time" range. */
export async function firstApplicationDate(): Promise<string | null> {
  const { user } = await requireWorkspace();
  const first = await prisma.application.findFirst({
    where: { userId: user.id },
    orderBy: { appliedOn: "asc" },
    select: { appliedOn: true },
  });
  return first ? toDateOnly(first.appliedOn) : null;
}
