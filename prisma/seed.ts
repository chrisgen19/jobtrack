/**
 * Development / demo seed. Creates two fictional users with realistic data:
 *   demo@jobtrack.local  (rich workspace)  and  sam@jobtrack.local (small one)
 * Password for both: DEMO_PASSWORD env var, default "jobtrack-demo-2026".
 *
 * Never runs against production unless ALLOW_DEMO_SEED=true, and never adds
 * data to real accounts: it only (re)creates these two demo users.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import type {
  ActivityType,
  ApplicationOutcome,
  InterviewType,
  Priority,
  SalaryPeriod,
  StageCategory,
  TaskType,
  WorkArrangement,
} from "@/generated/prisma/enums";
import { ensureDefaultPipeline } from "@/features/pipelines/create-default";
import { syncReminders } from "@/features/integrations/side-effects";
import { normalizeCompanyName } from "@/features/companies/normalize";
import { normalizePostingUrl } from "@/features/opportunities/normalize";
import { addDaysToDateOnly, parseDateOnly, todayInTimeZone, zonedToUtc } from "@/lib/dates";
import { seedEnv } from "@/lib/env";
import { getStorage } from "@/lib/integrations/storage";
import { prisma, type TransactionClient } from "@/lib/prisma";

const TZ = "Asia/Manila";
const PASSWORD = process.env.DEMO_PASSWORD ?? "jobtrack-demo-2026";
const today = todayInTimeZone(TZ);
const day = (offset: number) => addDaysToDateOnly(today, offset);
const at = (offset: number, time: string) => zonedToUtc(day(offset), time, TZ);

type StageKey = "applied" | "screening" | "assessment" | "technical" | "final" | "offer";
const STAGE_ORDER: StageKey[] = ["applied", "screening", "assessment", "technical", "final", "offer"];

type JobSeed = {
  company: string;
  title: string;
  stage: StageKey | "saved";
  priority: Priority;
  currency: string;
  min: number;
  max: number;
  period: SalaryPeriod;
  appliedDaysAgo?: number;
  work: WorkArrangement;
  location: string;
  source: string;
  skills: string[];
  notes?: string;
  outcome?: ApplicationOutcome;
  closedAtStage?: StageKey;
};

const JOBS: JobSeed[] = [
  {
    company: "Northstar Labs",
    title: "Senior Frontend Engineer",
    stage: "technical",
    priority: "HIGH",
    currency: "PHP",
    min: 150000,
    max: 185000,
    period: "MONTHLY",
    appliedDaysAgo: 12,
    work: "REMOTE",
    location: "Manila, PH",
    source: "LinkedIn",
    skills: ["React", "TypeScript", "Next.js"],
    notes: "Strong fit for React and design systems. Prepare component architecture examples.",
  },
  {
    company: "Atlas Digital",
    title: "Full-Stack Developer",
    stage: "offer",
    priority: "HIGH",
    currency: "AUD",
    min: 110000,
    max: 135000,
    period: "ANNUALLY",
    appliedDaysAgo: 20,
    work: "REMOTE",
    location: "Perth, AU",
    source: "Company website",
    skills: ["Next.js", "PostgreSQL", "Docker"],
    notes: "Offer received, compare salary and time-zone overlap.",
  },
  {
    company: "Lumen Commerce",
    title: "WordPress Engineer",
    stage: "screening",
    priority: "HIGH",
    currency: "AUD",
    min: 95000,
    max: 115000,
    period: "ANNUALLY",
    appliedDaysAgo: 8,
    work: "REMOTE",
    location: "Melbourne, AU",
    source: "LinkedIn",
    skills: ["WordPress", "PHP", "WooCommerce"],
  },
  {
    company: "Cedar Systems",
    title: "Software Engineer",
    stage: "final",
    priority: "HIGH",
    currency: "PHP",
    min: 135000,
    max: 165000,
    period: "MONTHLY",
    appliedDaysAgo: 23,
    work: "HYBRID",
    location: "Makati, PH",
    source: "Referral",
    skills: ["Next.js", "API", "PostgreSQL"],
  },
  {
    company: "Brightside Studio",
    title: "Frontend Developer",
    stage: "applied",
    priority: "MEDIUM",
    currency: "PHP",
    min: 105000,
    max: 135000,
    period: "MONTHLY",
    appliedDaysAgo: 4,
    work: "REMOTE",
    location: "Manila, PH",
    source: "JobStreet",
    skills: ["React", "CSS", "TypeScript"],
  },
  {
    company: "Monograph Works",
    title: "Headless CMS Developer",
    stage: "saved",
    priority: "MEDIUM",
    currency: "AUD",
    min: 105000,
    max: 125000,
    period: "ANNUALLY",
    work: "REMOTE",
    location: "Sydney, AU",
    source: "Company website",
    skills: ["Builder.io", "Next.js", "GraphQL"],
  },
  {
    company: "Gather Labs",
    title: "Full Stack Engineer",
    stage: "assessment",
    priority: "HIGH",
    currency: "PHP",
    min: 145000,
    max: 175000,
    period: "MONTHLY",
    appliedDaysAgo: 13,
    work: "REMOTE",
    location: "Manila, PH",
    source: "LinkedIn",
    skills: ["React", "Node.js", "PostgreSQL"],
  },
  {
    company: "Harbor Cloud",
    title: "Backend Developer",
    stage: "applied",
    priority: "MEDIUM",
    currency: "USD",
    min: 33000,
    max: 42000,
    period: "ANNUALLY",
    appliedDaysAgo: 10,
    work: "REMOTE",
    location: "Global",
    source: "RemoteOK",
    skills: ["Node.js", "Docker", "APIs"],
  },
  {
    company: "Pine & Pixel",
    title: "Senior Web Developer",
    stage: "screening",
    priority: "MEDIUM",
    currency: "PHP",
    min: 115000,
    max: 145000,
    period: "MONTHLY",
    appliedDaysAgo: 15,
    work: "HYBRID",
    location: "BGC, PH",
    source: "JobStreet",
    skills: ["PHP", "WordPress", "JavaScript"],
  },
  {
    company: "NovaStack",
    title: "Next.js Developer",
    stage: "applied",
    priority: "HIGH",
    currency: "PHP",
    min: 130000,
    max: 160000,
    period: "MONTHLY",
    appliedDaysAgo: 3,
    work: "REMOTE",
    location: "Manila, PH",
    source: "LinkedIn",
    skills: ["Next.js", "TypeScript", "Tailwind"],
  },
  {
    company: "Clover Creative",
    title: "Web Platform Engineer",
    stage: "saved",
    priority: "LOW",
    currency: "PHP",
    min: 100000,
    max: 125000,
    period: "MONTHLY",
    work: "HYBRID",
    location: "Pasig, PH",
    source: "Company website",
    skills: ["React", "Node.js"],
  },
  {
    company: "Reframe Digital",
    title: "Senior React Developer",
    stage: "technical",
    priority: "MEDIUM",
    currency: "PHP",
    min: 140000,
    max: 180000,
    period: "MONTHLY",
    appliedDaysAgo: 18,
    work: "REMOTE",
    location: "Manila, PH",
    source: "Referral",
    skills: ["React", "Jest", "TypeScript"],
  },
  {
    company: "Paperplane Co.",
    title: "WordPress Developer",
    stage: "saved",
    priority: "MEDIUM",
    currency: "PHP",
    min: 90000,
    max: 115000,
    period: "MONTHLY",
    work: "REMOTE",
    location: "Cebu, PH",
    source: "LinkedIn",
    skills: ["WordPress", "PHP", "Elementor"],
  },
  {
    company: "Rivet Health",
    title: "Senior PHP Developer",
    stage: "applied",
    priority: "LOW",
    currency: "PHP",
    min: 125000,
    max: 145000,
    period: "MONTHLY",
    appliedDaysAgo: 33,
    work: "ONSITE",
    location: "Makati, PH",
    source: "JobStreet",
    skills: ["PHP", "Laravel", "MySQL"],
    outcome: "REJECTED",
    closedAtStage: "technical",
  },
  {
    company: "Clearpath Tech",
    title: "Full Stack Engineer",
    stage: "applied",
    priority: "MEDIUM",
    currency: "PHP",
    min: 120000,
    max: 155000,
    period: "MONTHLY",
    appliedDaysAgo: 5,
    work: "REMOTE",
    location: "Global",
    source: "Referral",
    skills: ["React", "Node.js", "AWS"],
  },
  {
    company: "Ventureline",
    title: "UI Engineer",
    stage: "applied",
    priority: "MEDIUM",
    currency: "PHP",
    min: 115000,
    max: 145000,
    period: "MONTHLY",
    appliedDaysAgo: 48,
    work: "REMOTE",
    location: "Manila, PH",
    source: "LinkedIn",
    skills: ["React", "Design systems"],
    outcome: "WITHDRAWN",
    closedAtStage: "screening",
  },
];

const DESCRIPTION = (company: string) =>
  `Join the ${company} team to design, build, and maintain thoughtful digital products. Collaborate with engineers and designers, ship reliable interfaces, improve performance, and help deliver polished customer experiences.\n\n(Fictional demo data.)`;

const MINIMAL_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);

async function createUser(name: string, email: string) {
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) await prisma.user.delete({ where: { id: existing.id } });
  const id = randomUUID().replaceAll("-", "");
  await prisma.user.create({
    data: {
      id,
      name,
      email,
      emailVerified: true,
      accounts: {
        create: {
          id: randomUUID().replaceAll("-", ""),
          accountId: id,
          providerId: "credential",
          password: await hashPassword(PASSWORD),
        },
      },
      preferences: { create: { timezone: TZ, currency: "PHP", onboardedAt: new Date() } },
    },
  });
  return id;
}

async function addActivity(
  tx: TransactionClient,
  data: {
    userId: string;
    opportunityId: string;
    applicationId?: string;
    type: ActivityType;
    summary: string;
    occurredAt: Date;
    details?: object;
  },
) {
  await tx.activityEvent.create({
    data: { ...data, applicationId: data.applicationId ?? null, details: data.details ?? {} },
  });
}

async function seedDemo(userId: string) {
  const stageIds = { pipelineId: await ensureDefaultPipeline(prisma, userId) };
  const stageList = await prisma.pipelineStage.findMany({ where: { userId }, orderBy: { position: "asc" } });
  const byKey: Record<StageKey, { id: string; name: string; category: StageCategory }> = Object.fromEntries(
    STAGE_ORDER.map((key, index) => [key, stageList[index]!]),
  ) as never;
  // A custom stage, inserted after Assessment.
  await prisma.pipelineStage.updateMany({
    where: { userId, position: { gte: 3 } },
    data: { position: { increment: 1 } },
  });
  await prisma.pipelineStage.create({
    data: {
      userId,
      pipelineId: stageIds.pipelineId,
      name: "Coding Challenge",
      category: "ASSESSMENT",
      color: "#78a0bc",
      position: 3,
    },
  });

  const applications: Record<string, string> = {};
  await prisma.$transaction(
    async (tx) => {
      for (const job of JOBS) {
        const company = await tx.company.upsert({
          where: { userId_normalizedName: { userId, normalizedName: normalizeCompanyName(job.company) } },
          create: {
            userId,
            name: job.company,
            normalizedName: normalizeCompanyName(job.company),
            website: `https://${job.company.toLowerCase().replace(/[^a-z]/g, "")}.example`,
            location: job.location,
          },
          update: {},
        });
        const postingUrl = `https://${job.company.toLowerCase().replace(/[^a-z]/g, "")}.example/careers/${job.title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
        const savedDaysAgo = (job.appliedDaysAgo ?? 6) + 3;
        const opportunity = await tx.jobOpportunity.create({
          data: {
            userId,
            companyId: company.id,
            title: job.title,
            description: DESCRIPTION(job.company),
            postingUrl,
            normalizedUrl: normalizePostingUrl(postingUrl),
            source: job.source,
            salaryMin: String(job.min),
            salaryMax: String(job.max),
            currency: job.currency,
            salaryPeriod: job.period,
            employmentType: "FULL_TIME",
            workArrangement: job.work,
            location: job.location,
            requiredSkills: job.skills,
            priority: job.priority,
            notes: job.notes ?? null,
            deadline: job.stage === "saved" ? parseDateOnly(day(10)) : null,
            savedOn: parseDateOnly(day(-savedDaysAgo)),
            createdAt: at(-savedDaysAgo, "09:00"),
          },
        });
        await addActivity(tx, {
          userId,
          opportunityId: opportunity.id,
          type: "OPPORTUNITY_SAVED",
          summary: `Saved ${job.title} at ${job.company}`,
          occurredAt: at(-savedDaysAgo, "09:00"),
        });
        if (job.stage === "saved" || job.appliedDaysAgo === undefined) continue;

        const finalStage = job.closedAtStage ?? job.stage;
        const application = await tx.application.create({
          data: {
            userId,
            opportunityId: opportunity.id,
            pipelineId: stageIds.pipelineId,
            stageId: byKey[finalStage].id,
            attemptNumber: 1,
            appliedOn: parseDateOnly(day(-job.appliedDaysAgo)),
            method:
              job.source === "Referral"
                ? "REFERRAL"
                : job.source === "Company website"
                  ? "COMPANY_WEBSITE"
                  : "JOB_BOARD",
            submittedVia: job.source,
            status: job.outcome ? "CLOSED" : "ACTIVE",
            outcome: job.outcome ?? null,
            closedAt: job.outcome ? at(-2, "17:00") : null,
            stageChangedAt: at(-Math.max(1, Math.floor(job.appliedDaysAgo / 3)), "10:00"),
            firstResponseAt: finalStage !== "applied" ? at(-job.appliedDaysAgo + 3, "11:00") : null,
          },
        });
        applications[job.company] = application.id;
        await addActivity(tx, {
          userId,
          opportunityId: opportunity.id,
          applicationId: application.id,
          type: "APPLICATION_SUBMITTED",
          summary: "Application submitted",
          occurredAt: at(-job.appliedDaysAgo, "10:00"),
        });
        // Walk the stage history so the timeline and funnel analytics are realistic.
        const steps = STAGE_ORDER.slice(1, STAGE_ORDER.indexOf(finalStage) + 1);
        for (const [index, key] of steps.entries()) {
          const previous = STAGE_ORDER[STAGE_ORDER.indexOf(key) - 1]!;
          const daysAgo =
            job.appliedDaysAgo - Math.round(((index + 1) * job.appliedDaysAgo) / (steps.length + 1));
          await addActivity(tx, {
            userId,
            opportunityId: opportunity.id,
            applicationId: application.id,
            type: "STAGE_CHANGED",
            summary: `Moved from ${byKey[previous].name} to ${byKey[key].name}`,
            occurredAt: at(-daysAgo, "14:00"),
            details: {
              fromStageName: byKey[previous].name,
              fromStageCategory: byKey[previous].category,
              toStageName: byKey[key].name,
              toStageCategory: byKey[key].category,
            },
          });
        }
        if (job.outcome) {
          await addActivity(tx, {
            userId,
            opportunityId: opportunity.id,
            applicationId: application.id,
            type: "APPLICATION_CLOSED",
            summary: `Closed: ${job.outcome === "REJECTED" ? "Rejected" : "Withdrawn"}`,
            occurredAt: at(-2, "17:00"),
            details: { outcome: job.outcome },
          });
        }
      }

      // A reapplication: an earlier, rejected attempt at Northstar Labs.
      const northstar = await tx.application.findUniqueOrThrow({
        where: { id: applications["Northstar Labs"]! },
        select: { opportunityId: true },
      });
      await tx.application.updateMany({
        where: { id: applications["Northstar Labs"]! },
        data: { attemptNumber: 2 },
      });
      const earlier = await tx.application.create({
        data: {
          userId,
          opportunityId: northstar.opportunityId,
          pipelineId: stageIds.pipelineId,
          stageId: byKey.screening.id,
          attemptNumber: 1,
          appliedOn: parseDateOnly(day(-210)),
          method: "JOB_BOARD",
          status: "CLOSED",
          outcome: "REJECTED",
          closedAt: at(-190, "12:00"),
          stageChangedAt: at(-200, "12:00"),
        },
      });
      await addActivity(tx, {
        userId,
        opportunityId: northstar.opportunityId,
        applicationId: earlier.id,
        type: "APPLICATION_SUBMITTED",
        summary: "Application submitted",
        occurredAt: at(-210, "10:00"),
      });
      await addActivity(tx, {
        userId,
        opportunityId: northstar.opportunityId,
        applicationId: earlier.id,
        type: "APPLICATION_CLOSED",
        summary: "Closed: Rejected",
        occurredAt: at(-190, "12:00"),
        details: { outcome: "REJECTED" },
      });
      await addActivity(tx, {
        userId,
        opportunityId: northstar.opportunityId,
        applicationId: applications["Northstar Labs"]!,
        type: "APPLICATION_SUBMITTED",
        summary: "Reapplied (attempt 2)",
        occurredAt: at(-12, "10:00"),
      });
    },
    { timeout: 60_000 },
  );

  // Interviews (upcoming, completed and one rescheduled).
  const interviews: {
    company: string;
    title: string;
    type: InterviewType;
    offset: number;
    time: string;
    minutes: number;
    status?: "COMPLETED";
    result?: "PASSED" | "AWAITING_FEEDBACK" | "FAILED";
    interviewers: string;
    rescheduledFrom?: number;
  }[] = [
    {
      company: "Northstar Labs",
      title: "Recruiter Call",
      type: "RECRUITER_SCREEN",
      offset: -8,
      time: "14:00",
      minutes: 30,
      status: "COMPLETED",
      result: "PASSED",
      interviewers: "Maya Chen",
    },
    {
      company: "Northstar Labs",
      title: "Technical Interview",
      type: "TECHNICAL",
      offset: 1,
      time: "14:00",
      minutes: 60,
      interviewers: "Maya Chen, Engineering Manager",
      rescheduledFrom: 0,
    },
    {
      company: "Lumen Commerce",
      title: "Recruiter Call",
      type: "RECRUITER_SCREEN",
      offset: 2,
      time: "10:30",
      minutes: 30,
      interviewers: "Jordan Lee",
    },
    {
      company: "Cedar Systems",
      title: "Technical Round 1",
      type: "TECHNICAL",
      offset: -12,
      time: "15:00",
      minutes: 60,
      status: "COMPLETED",
      result: "PASSED",
      interviewers: "Platform team",
    },
    {
      company: "Cedar Systems",
      title: "Final Interview",
      type: "FINAL",
      offset: 5,
      time: "15:00",
      minutes: 60,
      interviewers: "Hiring panel",
    },
    {
      company: "Reframe Digital",
      title: "Technical Interview · Round 2",
      type: "TECHNICAL",
      offset: 6,
      time: "11:00",
      minutes: 90,
      interviewers: "Engineering Manager",
    },
    {
      company: "Gather Labs",
      title: "Take-home Review",
      type: "CODING_CHALLENGE",
      offset: 8,
      time: "13:30",
      minutes: 45,
      interviewers: "Tech Lead",
    },
    {
      company: "Atlas Digital",
      title: "Final Interview",
      type: "FINAL",
      offset: -5,
      time: "09:00",
      minutes: 60,
      status: "COMPLETED",
      result: "PASSED",
      interviewers: "Sophie Reed",
    },
    {
      company: "Rivet Health",
      title: "Technical Interview",
      type: "TECHNICAL",
      offset: -6,
      time: "10:00",
      minutes: 60,
      status: "COMPLETED",
      result: "FAILED",
      interviewers: "CTO",
    },
  ];
  for (const [index, interview] of interviews.entries()) {
    const applicationId = applications[interview.company]!;
    const app = await prisma.application.findUniqueOrThrow({
      where: { id: applicationId },
      select: { opportunityId: true },
    });
    const startsAt = at(interview.offset, interview.time);
    await prisma.$transaction(async (tx) => {
      const created = await tx.interview.create({
        data: {
          userId,
          applicationId,
          title: interview.title,
          type: interview.type,
          roundNumber: index + 1,
          status: interview.status ?? (interview.rescheduledFrom !== undefined ? "RESCHEDULED" : "SCHEDULED"),
          result: interview.result ?? "PENDING",
          startsAt,
          endsAt: new Date(startsAt.getTime() + interview.minutes * 60_000),
          timezone: TZ,
          mode: "VIDEO",
          meetingUrl: "https://meet.google.com/demo-link",
          interviewers: interview.interviewers,
          prepNotes: "Review the job description, prepare two project stories and three questions for them.",
          feedback:
            interview.status === "COMPLETED"
              ? "Good conversation; they asked about system design trade-offs."
              : null,
          reminderMinutesBefore: 1440,
          completedAt:
            interview.status === "COMPLETED"
              ? new Date(startsAt.getTime() + interview.minutes * 60_000)
              : null,
          scheduleRevision: interview.rescheduledFrom !== undefined ? 1 : 0,
        },
      });
      await addActivity(tx, {
        userId,
        opportunityId: app.opportunityId,
        applicationId,
        type: "INTERVIEW_SCHEDULED",
        summary: `Scheduled ${interview.title}`,
        occurredAt: at(Math.min(interview.offset, 0) - 3, "09:00"),
        details: { interviewId: created.id },
      });
      if (interview.rescheduledFrom !== undefined) {
        const previous = at(interview.rescheduledFrom, interview.time);
        await tx.interviewReschedule.create({
          data: {
            userId,
            interviewId: created.id,
            previousStartsAt: previous,
            previousTimezone: TZ,
            newStartsAt: startsAt,
            newTimezone: TZ,
            reason: "Interviewer conflict",
          },
        });
        await addActivity(tx, {
          userId,
          opportunityId: app.opportunityId,
          applicationId,
          type: "INTERVIEW_RESCHEDULED",
          summary: `Rescheduled ${interview.title} by one day (interviewer conflict)`,
          occurredAt: at(-1, "16:00"),
          details: { interviewId: created.id },
        });
      }
      if (interview.status === "COMPLETED") {
        await addActivity(tx, {
          userId,
          opportunityId: app.opportunityId,
          applicationId,
          type: "INTERVIEW_COMPLETED",
          summary: `Completed ${interview.title}`,
          occurredAt: startsAt,
          details: { interviewId: created.id },
        });
      }
      await syncReminders(tx, userId, { interviewId: created.id });
    });
  }

  // Offer for Atlas Digital.
  const atlas = applications["Atlas Digital"]!;
  const atlasOpp = await prisma.application.findUniqueOrThrow({
    where: { id: atlas },
    select: { opportunityId: true },
  });
  await prisma.$transaction(async (tx) => {
    const offer = await tx.offer.create({
      data: {
        userId,
        applicationId: atlas,
        revisionNumber: 1,
        positionTitle: "Full-Stack Developer",
        baseSalary: "128000",
        currency: "AUD",
        salaryPeriod: "ANNUALLY",
        salaryBasis: "GROSS",
        bonus: "10% annual performance bonus",
        benefits: "Superannuation, 20 days leave, equipment allowance",
        startDate: parseDateOnly(day(30)),
        decisionDeadline: parseDateOnly(day(4)),
        receivedOn: parseDateOnly(day(-2)),
        status: "NEGOTIATING",
        negotiationNotes: "Asked for AUD 135k; recruiter is checking with the hiring manager.",
      },
    });
    await addActivity(tx, {
      userId,
      opportunityId: atlasOpp.opportunityId,
      applicationId: atlas,
      type: "OFFER_RECEIVED",
      summary: "Offer received: A$128,000/yr",
      occurredAt: at(-2, "16:00"),
      details: { offerId: offer.id },
    });
    await syncReminders(tx, userId, { offerId: offer.id });
  });

  // Tasks (overdue, today, upcoming, completed, one suggestion).
  const tasks: {
    title: string;
    company?: string;
    type: TaskType;
    offset: number;
    done?: boolean;
    suggested?: boolean;
    priority?: Priority;
  }[] = [
    { title: "Send follow-up email", company: "Brightside Studio", type: "FOLLOW_UP", offset: -1 },
    {
      title: "Prepare system design examples",
      company: "Northstar Labs",
      type: "INTERVIEW_PREP",
      offset: 0,
      priority: "HIGH",
    },
    {
      title: "Compare compensation and benefits",
      company: "Atlas Digital",
      type: "OFFER_DECISION",
      offset: 0,
      priority: "HIGH",
    },
    {
      title: "Review PHP and WordPress portfolio",
      company: "Lumen Commerce",
      type: "INTERVIEW_PREP",
      offset: 1,
    },
    { title: "Check back on application", company: "Harbor Cloud", type: "RECRUITER_FOLLOW_UP", offset: 6 },
    {
      title: "Complete take-home assessment",
      company: "Gather Labs",
      type: "ASSESSMENT",
      offset: 7,
      priority: "HIGH",
    },
    { title: "Update CV project highlights", type: "RESUME_UPDATE", offset: -3, done: true },
    { title: "Send thank-you note", company: "Atlas Digital", type: "FOLLOW_UP", offset: -4, done: true },
    {
      title: "Follow up on Next.js Developer application",
      company: "NovaStack",
      type: "FOLLOW_UP",
      offset: 4,
      suggested: true,
    },
  ];
  for (const task of tasks) {
    const applicationId = task.company ? applications[task.company] : undefined;
    const opportunityId = applicationId
      ? (
          await prisma.application.findUniqueOrThrow({
            where: { id: applicationId },
            select: { opportunityId: true },
          })
        ).opportunityId
      : undefined;
    await prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          userId,
          applicationId: applicationId ?? null,
          opportunityId: opportunityId ?? null,
          title: task.title,
          type: task.type,
          priority: task.priority ?? "MEDIUM",
          status: task.done ? "COMPLETED" : task.suggested ? "SUGGESTED" : "OPEN",
          dueAt: at(task.offset, "09:00"),
          completedAt: task.done ? at(task.offset, "15:00") : null,
          reminderMinutesBefore: task.suggested || task.done ? null : 60,
          suggestionReason: task.suggested ? "application_submitted" : null,
        },
      });
      await syncReminders(tx, userId, { taskId: created.id });
    });
  }

  // Contacts.
  for (const [companyName, name, title, email] of [
    ["Northstar Labs", "Maya Chen", "Senior Talent Partner", "maya.chen@northstar.example"],
    ["Atlas Digital", "Sophie Reed", "Engineering Manager", "sophie@atlas.example"],
    ["Lumen Commerce", "Jordan Lee", "Recruiter", "jordan@lumen.example"],
  ] as const) {
    const company = await prisma.company.findUniqueOrThrow({
      where: { userId_normalizedName: { userId, normalizedName: normalizeCompanyName(companyName) } },
    });
    await prisma.contact.create({
      data: {
        userId,
        companyId: company.id,
        name,
        title,
        email,
        kind: title === "Engineering Manager" ? "HIRING_MANAGER" : "RECRUITER",
      },
    });
  }

  // Documents with versions, linked to the applications they were sent with.
  const storage = getStorage();
  const documents: {
    title: string;
    label: string;
    kind: "RESUME" | "COVER_LETTER" | "PORTFOLIO";
    usedIn: string[];
    replaces?: string;
  }[] = [
    {
      title: "Full-Stack Developer Resume",
      label: "v2",
      kind: "RESUME",
      usedIn: ["Cedar Systems", "Reframe Digital"],
    },
    {
      title: "Full-Stack Developer Resume",
      label: "v3",
      kind: "RESUME",
      usedIn: ["Northstar Labs", "NovaStack", "Gather Labs"],
      replaces: "v2",
    },
    {
      title: "WordPress Specialist Resume",
      label: "v1",
      kind: "RESUME",
      usedIn: ["Lumen Commerce", "Pine & Pixel"],
    },
    { title: "Atlas Digital Cover Letter", label: "v1", kind: "COVER_LETTER", usedIn: ["Atlas Digital"] },
    {
      title: "Portfolio & Selected Projects",
      label: "v1",
      kind: "PORTFOLIO",
      usedIn: ["Northstar Labs", "Atlas Digital"],
    },
  ];
  const createdDocs: Record<string, string> = {};
  for (const doc of documents) {
    const storageKey = `users/${userId}/${randomUUID()}`;
    await storage.put(storageKey, MINIMAL_PDF, "application/pdf");
    const replacesId = doc.replaces ? createdDocs[`${doc.title}:${doc.replaces}`] : undefined;
    const created = await prisma.document.create({
      data: {
        userId,
        kind: doc.kind,
        title: doc.title,
        versionLabel: doc.label,
        originalFilename: `${doc.title} ${doc.label}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: MINIMAL_PDF.length,
        storageKey,
        status: "READY",
        replacesId: replacesId ?? null,
      },
    });
    if (replacesId)
      await prisma.document.update({ where: { id: replacesId }, data: { supersededAt: new Date() } });
    createdDocs[`${doc.title}:${doc.label}`] = created.id;
    for (const company of doc.usedIn) {
      if (!applications[company]) continue;
      await prisma.applicationDocument.create({
        data: {
          userId,
          applicationId: applications[company]!,
          documentId: created.id,
          purpose: doc.kind,
          wasSubmitted: true,
        },
      });
    }
  }

  // A few read and unread in-app notifications.
  await prisma.notification.createMany({
    data: [
      {
        userId,
        type: "INTERVIEW_REMINDER",
        title: "Upcoming interview: Technical Interview with Northstar Labs",
        body: "Tomorrow at 2:00 PM",
        link: `/applications/${applications["Northstar Labs"]}?tab=interviews`,
      },
      {
        userId,
        type: "TASK_REMINDER",
        title: "Task due: Send follow-up email",
        body: "Brightside Studio",
        link: "/tasks",
        readAt: new Date(),
      },
    ],
  });
}

async function seedSecondUser(userId: string) {
  const pipelineId = await ensureDefaultPipeline(prisma, userId);
  const stage = await prisma.pipelineStage.findFirstOrThrow({
    where: { pipelineId },
    orderBy: { position: "asc" },
  });
  for (const [companyName, title] of [
    ["Orbit Analytics", "Data Engineer"],
    ["Kestrel Games", "Gameplay Programmer"],
  ] as const) {
    const company = await prisma.company.create({
      data: { userId, name: companyName, normalizedName: normalizeCompanyName(companyName) },
    });
    const opportunity = await prisma.jobOpportunity.create({
      data: {
        userId,
        companyId: company.id,
        title,
        currency: "USD",
        priority: "MEDIUM",
        savedOn: parseDateOnly(day(-4)),
      },
    });
    await prisma.application.create({
      data: {
        userId,
        opportunityId: opportunity.id,
        pipelineId,
        stageId: stage.id,
        attemptNumber: 1,
        appliedOn: parseDateOnly(day(-2)),
      },
    });
  }
}

async function main() {
  if (process.env.NODE_ENV === "production" && !seedEnv().ALLOW_DEMO_SEED) {
    throw new Error(
      "Refusing to seed demo data in production. Set ALLOW_DEMO_SEED=true for an explicit demo environment.",
    );
  }
  const demo = await createUser("Demo Candidate", "demo@jobtrack.local");
  await seedDemo(demo);
  const sam = await createUser("Sam Rivera", "sam@jobtrack.local");
  await seedSecondUser(sam);
  process.stdout.write(
    `Seeded demo@jobtrack.local and sam@jobtrack.local (password: ${process.env.DEMO_PASSWORD ? "from DEMO_PASSWORD" : PASSWORD}).\n`,
  );
}

main()
  .catch((error: unknown) => {
    process.stderr.write(
      `Seed failed: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
