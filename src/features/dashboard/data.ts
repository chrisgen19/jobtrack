import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type {
  ActivityType,
  InterviewMode,
  Priority,
  StageCategory,
  TaskType,
} from "@/generated/prisma/enums";
import { requireWorkspace } from "@/features/workspace/data";
import { addDaysToDateOnly, dayBoundsUtc, todayInTimeZone } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

/** Active applications with no stage change for this many days may need a follow-up. */
const STALE_AFTER_DAYS = 10;

export type DashboardInterview = {
  id: string;
  title: string;
  startsAt: Date;
  mode: InterviewMode;
  applicationId: string;
  company: string;
  role: string;
};

export type DashboardTask = {
  id: string;
  title: string;
  type: TaskType;
  dueAt: Date | null;
  company: string | null;
  isOverdue: boolean;
};

export type StaleApplication = {
  id: string;
  role: string;
  company: string;
  stageName: string;
  daysSinceUpdate: number;
};

export type WatchedApplication = {
  id: string;
  role: string;
  company: string;
  stageName: string;
  stageCategory: StageCategory;
  stageColor: string | null;
  priority: Priority;
};

export type ActivityItem = {
  id: string;
  type: ActivityType;
  summary: string;
  occurredAt: Date;
  opportunityId: string;
  applicationId: string | null;
  company: string;
};

export type PipelineOverview = { saved: number; applied: number; interviewing: number; offer: number };

export type DashboardData = {
  timezone: string;
  today: string;
  metrics: {
    activeApplications: number;
    pausedApplications: number;
    savedJobs: number;
    upcomingInterviews: number;
    interviewsThisWeek: number;
    followUpsDue: number;
    overdueTasks: number;
    pendingOffers: number;
    applicationsWithOffers: number;
    suggestedTasks: number;
  };
  pipeline: PipelineOverview;
  upcomingInterviews: DashboardInterview[];
  focusTasks: DashboardTask[];
  needsAttention: {
    overdueTasks: DashboardTask[];
    imminentInterviews: DashboardInterview[];
    staleApplications: StaleApplication[];
  };
  watchList: WatchedApplication[];
  recentActivity: ActivityItem[];
};

const INTERVIEWING: StageCategory[] = ["SCREENING", "ASSESSMENT", "INTERVIEW"];

/** Everything the dashboard renders, scoped to the signed-in user. */
export async function getDashboard(at?: Date): Promise<DashboardData> {
  const { user, preferences } = await requireWorkspace();
  // Read the clock only after the session (request-time data) is resolved.
  const now = at ?? new Date();
  const userId = user.id;
  const timezone = preferences.timezone;
  const today = todayInTimeZone(timezone, now);
  const endOfToday = dayBoundsUtc(today, timezone).end;
  const endOfWeek = dayBoundsUtc(addDaysToDateOnly(today, 6), timezone).end;
  const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const staleBefore = new Date(now.getTime() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000);

  const upcomingWhere = {
    userId,
    status: { in: ["SCHEDULED", "RESCHEDULED"] },
    startsAt: { gte: now },
    application: { status: { not: "CLOSED" } },
  } satisfies Prisma.InterviewWhereInput;

  const [
    statusCounts,
    savedJobs,
    stageCounts,
    upcomingCount,
    weekCount,
    upcoming,
    dueTasks,
    overdueCount,
    suggestedTasks,
    offers,
    stale,
    watch,
    activity,
  ] = await Promise.all([
    prisma.application.groupBy({ by: ["status"], where: { userId }, _count: { _all: true } }),
    prisma.jobOpportunity.count({ where: { userId, archivedAt: null, applications: { none: {} } } }),
    prisma.application.findMany({
      where: { userId, status: { not: "CLOSED" } },
      select: { stage: { select: { category: true } } },
    }),
    prisma.interview.count({ where: upcomingWhere }),
    prisma.interview.count({ where: { ...upcomingWhere, startsAt: { gte: now, lt: endOfWeek } } }),
    prisma.interview.findMany({
      where: upcomingWhere,
      orderBy: { startsAt: "asc" },
      take: 5,
      select: {
        id: true,
        title: true,
        startsAt: true,
        mode: true,
        applicationId: true,
        application: {
          select: { opportunity: { select: { title: true, company: { select: { name: true } } } } },
        },
      },
    }),
    prisma.task.findMany({
      where: { userId, status: "OPEN" },
      orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      take: 8,
      select: {
        id: true,
        title: true,
        type: true,
        dueAt: true,
        opportunity: { select: { company: { select: { name: true } } } },
        application: { select: { opportunity: { select: { company: { select: { name: true } } } } } },
      },
    }),
    prisma.task.count({
      where: { userId, status: "OPEN", dueAt: { lt: dayBoundsUtc(today, timezone).start } },
    }),
    prisma.task.count({ where: { userId, status: "SUGGESTED" } }),
    prisma.offer.findMany({
      where: { userId },
      select: { applicationId: true, revisionNumber: true, status: true },
      orderBy: { revisionNumber: "desc" },
    }),
    prisma.application.findMany({
      where: {
        userId,
        status: "ACTIVE",
        stageChangedAt: { lt: staleBefore },
        stage: { category: { in: ["APPLIED", "SCREENING"] } },
        tasks: { none: { status: { in: ["OPEN", "SUGGESTED"] } } },
      },
      orderBy: { stageChangedAt: "asc" },
      take: 5,
      select: {
        id: true,
        stageChangedAt: true,
        stage: { select: { name: true } },
        opportunity: { select: { title: true, company: { select: { name: true } } } },
      },
    }),
    prisma.application.findMany({
      where: { userId, status: "ACTIVE" },
      orderBy: [{ opportunity: { priority: "desc" } }, { stageChangedAt: "desc" }],
      take: 5,
      select: {
        id: true,
        stage: { select: { name: true, category: true, color: true } },
        opportunity: { select: { title: true, priority: true, company: { select: { name: true } } } },
      },
    }),
    prisma.activityEvent.findMany({
      where: { userId },
      orderBy: { occurredAt: "desc" },
      take: 8,
      select: {
        id: true,
        type: true,
        summary: true,
        occurredAt: true,
        opportunityId: true,
        applicationId: true,
        opportunity: { select: { company: { select: { name: true } } } },
      },
    }),
  ]);

  const countFor = (status: string) => statusCounts.find((row) => row.status === status)?._count._all ?? 0;

  const pipeline: PipelineOverview = { saved: savedJobs, applied: 0, interviewing: 0, offer: 0 };
  for (const { stage } of stageCounts) {
    if (stage.category === "OFFER") pipeline.offer += 1;
    else if (INTERVIEWING.includes(stage.category)) pipeline.interviewing += 1;
    else pipeline.applied += 1;
  }

  // Latest revision per application decides whether an offer is pending.
  const latestOfferByApplication = new Map<string, (typeof offers)[number]>();
  for (const offer of offers) {
    if (!latestOfferByApplication.has(offer.applicationId))
      latestOfferByApplication.set(offer.applicationId, offer);
  }
  const pendingOffers = [...latestOfferByApplication.values()].filter(
    (offer) => offer.status === "RECEIVED" || offer.status === "NEGOTIATING",
  ).length;

  const toInterview = (row: (typeof upcoming)[number]): DashboardInterview => ({
    id: row.id,
    title: row.title,
    startsAt: row.startsAt!,
    mode: row.mode,
    applicationId: row.applicationId,
    company: row.application.opportunity.company.name,
    role: row.application.opportunity.title,
  });

  const toTask = (row: (typeof dueTasks)[number]): DashboardTask => ({
    id: row.id,
    title: row.title,
    type: row.type,
    dueAt: row.dueAt,
    company: row.application?.opportunity.company.name ?? row.opportunity?.company.name ?? null,
    isOverdue: row.dueAt !== null && row.dueAt < dayBoundsUtc(today, timezone).start,
  });

  const upcomingInterviews = upcoming.map(toInterview);
  const focusTasks = dueTasks.map(toTask);

  return {
    timezone,
    today,
    metrics: {
      activeApplications: countFor("ACTIVE"),
      pausedApplications: countFor("PAUSED"),
      savedJobs,
      upcomingInterviews: upcomingCount,
      interviewsThisWeek: weekCount,
      followUpsDue: focusTasks.filter((task) => task.dueAt !== null && task.dueAt < endOfToday).length,
      overdueTasks: overdueCount,
      pendingOffers,
      applicationsWithOffers: latestOfferByApplication.size,
      suggestedTasks,
    },
    pipeline,
    upcomingInterviews,
    focusTasks: focusTasks.slice(0, 5),
    needsAttention: {
      overdueTasks: focusTasks.filter((task) => task.isOverdue),
      imminentInterviews: upcomingInterviews.filter((interview) => interview.startsAt < in48Hours),
      staleApplications: stale.map((row) => ({
        id: row.id,
        role: row.opportunity.title,
        company: row.opportunity.company.name,
        stageName: row.stage.name,
        daysSinceUpdate: Math.floor((now.getTime() - row.stageChangedAt.getTime()) / 86_400_000),
      })),
    },
    watchList: watch.map((row) => ({
      id: row.id,
      role: row.opportunity.title,
      company: row.opportunity.company.name,
      stageName: row.stage.name,
      stageCategory: row.stage.category,
      stageColor: row.stage.color,
      priority: row.opportunity.priority,
    })),
    recentActivity: activity.map((row) => ({
      id: row.id,
      type: row.type,
      summary: row.summary,
      occurredAt: row.occurredAt,
      opportunityId: row.opportunityId,
      applicationId: row.applicationId,
      company: row.opportunity.company.name,
    })),
  };
}
