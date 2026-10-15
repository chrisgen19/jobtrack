import "server-only";
import type {
  ActivityType,
  ApplicationMethod,
  ApplicationOutcome,
  ApplicationStatus,
  EmploymentType,
  Priority,
  SalaryBasis,
  SalaryPeriod,
  StageCategory,
  WorkArrangement,
} from "@/generated/prisma/enums";
import { recordActivity } from "@/features/activity/record";
import {
  afterApplicationStatusChange,
  beforeSourcesDeleted,
  sourcesUnder,
} from "@/features/integrations/side-effects";
import { requireWorkspace, type Workspace } from "@/features/workspace/data";
import { DomainError, NotFoundError } from "@/lib/action-result";
import {
  formatDateOnly,
  parseDateOnly,
  todayInTimeZone,
  toDateOnly,
  toDateOnlyOrNull,
  zonedToUtc,
} from "@/lib/dates";
import { APPLICATION_OUTCOME_LABEL } from "@/lib/labels";
import { decimalToString } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import type { ApplicationDetailsInput, ApplyInput } from "./schemas";
import {
  assertNotFutureApplicationDate,
  changeStageInTx,
  submitApplicationInTx,
  type WorkspaceContext,
} from "./service";

function contextOf({ user, preferences }: Workspace): WorkspaceContext {
  return {
    userId: user.id,
    timezone: preferences.timezone,
    suggestFollowUps: preferences.suggestFollowUps,
    followUpDays: preferences.followUpDays,
  };
}

/** Applies (or reapplies) to a saved job. Returns the new application ID. */
export async function applyToOpportunity(input: ApplyInput): Promise<string> {
  const workspace = await requireWorkspace();
  return prisma.$transaction((tx) => submitApplicationInTx(tx, contextOf(workspace), input));
}

/** Moves an application to another stage of its pipeline (Kanban, select). */
export async function changeApplicationStage(applicationId: string, stageId: string): Promise<boolean> {
  const { user } = await requireWorkspace();
  return prisma.$transaction((tx) => changeStageInTx(tx, user.id, applicationId, stageId));
}

async function loadOwnedApplication(userId: string, applicationId: string) {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId },
    select: {
      id: true,
      status: true,
      outcome: true,
      opportunityId: true,
      appliedOn: true,
      firstResponseOn: true,
    },
  });
  if (!application) throw new NotFoundError("Application");
  return application;
}

export async function pauseApplication(applicationId: string): Promise<void> {
  const { user } = await requireWorkspace();
  const application = await loadOwnedApplication(user.id, applicationId);
  if (application.status !== "ACTIVE") throw new DomainError("Only active applications can be paused.");
  await prisma.$transaction(async (tx) => {
    await tx.application.update({ where: { id: application.id }, data: { status: "PAUSED" } });
    await recordActivity(tx, {
      userId: user.id,
      opportunityId: application.opportunityId,
      applicationId: application.id,
      type: "APPLICATION_PAUSED",
      summary: "Application paused",
    });
  });
}

export async function resumeApplication(applicationId: string): Promise<void> {
  const { user } = await requireWorkspace();
  const application = await loadOwnedApplication(user.id, applicationId);
  if (application.status !== "PAUSED") throw new DomainError("Only paused applications can be resumed.");
  await prisma.$transaction(async (tx) => {
    await tx.application.update({ where: { id: application.id }, data: { status: "ACTIVE" } });
    await recordActivity(tx, {
      userId: user.id,
      opportunityId: application.opportunityId,
      applicationId: application.id,
      type: "APPLICATION_RESUMED",
      summary: "Application resumed",
    });
  });
}

/**
 * Closes an application with an explicit outcome. Never called
 * automatically: "no response" is always the user's decision.
 */
export async function closeApplication(
  applicationId: string,
  outcome: ApplicationOutcome,
  note?: string,
): Promise<void> {
  const { user } = await requireWorkspace();
  const application = await loadOwnedApplication(user.id, applicationId);
  if (application.status === "CLOSED") throw new DomainError("This application is already closed.");
  await prisma.$transaction(async (tx) => {
    await tx.application.update({
      where: { id: application.id },
      data: { status: "CLOSED", outcome, closedAt: new Date() },
    });
    await recordActivity(tx, {
      userId: user.id,
      opportunityId: application.opportunityId,
      applicationId: application.id,
      type: "APPLICATION_CLOSED",
      summary: `Closed: ${APPLICATION_OUTCOME_LABEL[outcome]}`,
      details: { outcome, ...(note ? { note } : {}) },
    });
    await afterApplicationStatusChange(tx, user.id, application.id);
  });
}

/** Reopens a closed application, clearing its outcome and closed date. */
export async function reopenApplication(applicationId: string): Promise<void> {
  const { user } = await requireWorkspace();
  const application = await loadOwnedApplication(user.id, applicationId);
  if (application.status !== "CLOSED") throw new DomainError("Only closed applications can be reopened.");
  await prisma.$transaction(async (tx) => {
    await tx.application.update({
      where: { id: application.id },
      data: { status: "ACTIVE", outcome: null, closedAt: null },
    });
    await recordActivity(tx, {
      userId: user.id,
      opportunityId: application.opportunityId,
      applicationId: application.id,
      type: "APPLICATION_REOPENED",
      summary: "Application reopened",
      details: { previousOutcome: application.outcome },
    });
    await afterApplicationStatusChange(tx, user.id, application.id);
  });
}

/**
 * Records the first genuine employer response (used for response-time
 * analytics). The date must fall between the application date and today in
 * the user's timezone, so response times are never negative.
 */
export async function recordEmployerResponse(applicationId: string, respondedOn: string): Promise<void> {
  const { user, preferences } = await requireWorkspace();
  const application = await loadOwnedApplication(user.id, applicationId);
  const appliedOn = toDateOnly(application.appliedOn);
  if (respondedOn < appliedOn)
    throw new DomainError(
      `The response date can't be before the application date (${formatDateOnly(appliedOn)}).`,
    );
  if (respondedOn > todayInTimeZone(preferences.timezone))
    throw new DomainError("The response date can't be in the future.");
  // The timeline needs an instant: noon local keeps it on the chosen day.
  const respondedAt = zonedToUtc(respondedOn, "12:00", preferences.timezone);
  await prisma.$transaction(async (tx) => {
    await tx.application.update({
      where: { id: application.id },
      data: { firstResponseOn: parseDateOnly(respondedOn) },
    });
    await recordActivity(tx, {
      userId: user.id,
      opportunityId: application.opportunityId,
      applicationId: application.id,
      type: "EMPLOYER_RESPONSE_RECEIVED",
      summary: "Employer responded",
      details: { respondedOn },
      occurredAt: respondedAt,
    });
  });
}

export async function updateApplicationDetails(input: ApplicationDetailsInput): Promise<void> {
  const { user, preferences } = await requireWorkspace();
  const application = await loadOwnedApplication(user.id, input.applicationId);
  assertNotFutureApplicationDate(input.appliedOn, preferences.timezone);
  if (application.firstResponseOn) {
    const respondedOn = toDateOnly(application.firstResponseOn);
    if (input.appliedOn > respondedOn)
      throw new DomainError(
        `The application date can't be after the employer's response (${formatDateOnly(respondedOn)}).`,
      );
  }
  await prisma.$transaction(async (tx) => {
    await tx.application.update({
      where: { id: application.id },
      data: {
        appliedOn: parseDateOnly(input.appliedOn),
        method: input.method ?? null,
        submittedVia: input.submittedVia ?? null,
        notes: input.notes ?? null,
      },
    });
    await recordActivity(tx, {
      userId: user.id,
      opportunityId: application.opportunityId,
      applicationId: application.id,
      type: "APPLICATION_UPDATED",
      summary: "Application details updated",
    });
  });
}

export async function addApplicationNote(applicationId: string, note: string): Promise<void> {
  const { user } = await requireWorkspace();
  const application = await loadOwnedApplication(user.id, applicationId);
  await prisma.$transaction((tx) =>
    recordActivity(tx, {
      userId: user.id,
      opportunityId: application.opportunityId,
      applicationId: application.id,
      type: "NOTE_ADDED",
      summary: note.length > 140 ? `${note.slice(0, 137)}...` : note,
      details: { note },
    }),
  );
}

/** Deletes one attempt with its interviews, tasks, offers and document links. */
export async function deleteApplication(applicationId: string): Promise<string> {
  const { user } = await requireWorkspace();
  const application = await loadOwnedApplication(user.id, applicationId);
  await prisma.$transaction(async (tx) => {
    await beforeSourcesDeleted(
      tx,
      user.id,
      await sourcesUnder(tx, user.id, { applicationId: application.id }),
    );
    await tx.application.deleteMany({ where: { id: application.id, userId: user.id } });
  });
  return application.opportunityId;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export type StageOption = {
  id: string;
  name: string;
  category: StageCategory;
  color: string | null;
  isActive: boolean;
};

export type ApplicationDetail = {
  id: string;
  attemptNumber: number;
  appliedOn: string;
  method: ApplicationMethod | null;
  submittedVia: string | null;
  status: ApplicationStatus;
  outcome: ApplicationOutcome | null;
  closedAt: Date | null;
  stageChangedAt: Date;
  firstResponseOn: string | null;
  notes: string | null;
  stage: StageOption;
  stages: StageOption[];
  opportunity: {
    id: string;
    title: string;
    companyId: string;
    companyName: string;
    location: string | null;
    workArrangement: WorkArrangement | null;
    employmentType: EmploymentType | null;
    salaryMin: string | null;
    salaryMax: string | null;
    currency: string | null;
    salaryPeriod: SalaryPeriod | null;
    salaryBasis: SalaryBasis;
    source: string | null;
    postingUrl: string | null;
    priority: Priority;
    description: string | null;
    requiredSkills: string[];
    notes: string | null;
  };
  attempts: {
    id: string;
    attemptNumber: number;
    appliedOn: string;
    status: ApplicationStatus;
    outcome: ApplicationOutcome | null;
  }[];
};

const stageSelect = { id: true, name: true, category: true, color: true, isActive: true } as const;

export async function getApplicationDetail(applicationId: string): Promise<ApplicationDetail | null> {
  const { user } = await requireWorkspace();
  const row = await prisma.application.findFirst({
    where: { id: applicationId, userId: user.id },
    select: {
      id: true,
      attemptNumber: true,
      appliedOn: true,
      method: true,
      submittedVia: true,
      status: true,
      outcome: true,
      closedAt: true,
      stageChangedAt: true,
      firstResponseOn: true,
      notes: true,
      stage: { select: stageSelect },
      pipeline: { select: { stages: { orderBy: { position: "asc" }, select: stageSelect } } },
      opportunity: {
        select: {
          id: true,
          title: true,
          location: true,
          workArrangement: true,
          employmentType: true,
          salaryMin: true,
          salaryMax: true,
          currency: true,
          salaryPeriod: true,
          salaryBasis: true,
          source: true,
          postingUrl: true,
          priority: true,
          description: true,
          requiredSkills: true,
          notes: true,
          company: { select: { id: true, name: true } },
          applications: {
            orderBy: { attemptNumber: "desc" },
            select: { id: true, attemptNumber: true, appliedOn: true, status: true, outcome: true },
          },
        },
      },
    },
  });
  if (!row) return null;
  const { opportunity } = row;
  return {
    id: row.id,
    attemptNumber: row.attemptNumber,
    appliedOn: toDateOnly(row.appliedOn),
    method: row.method,
    submittedVia: row.submittedVia,
    status: row.status,
    outcome: row.outcome,
    closedAt: row.closedAt,
    stageChangedAt: row.stageChangedAt,
    firstResponseOn: toDateOnlyOrNull(row.firstResponseOn),
    notes: row.notes,
    stage: row.stage,
    stages: row.pipeline.stages,
    opportunity: {
      id: opportunity.id,
      title: opportunity.title,
      companyId: opportunity.company.id,
      companyName: opportunity.company.name,
      location: opportunity.location,
      workArrangement: opportunity.workArrangement,
      employmentType: opportunity.employmentType,
      salaryMin: decimalToString(opportunity.salaryMin),
      salaryMax: decimalToString(opportunity.salaryMax),
      currency: opportunity.currency,
      salaryPeriod: opportunity.salaryPeriod,
      salaryBasis: opportunity.salaryBasis,
      source: opportunity.source,
      postingUrl: opportunity.postingUrl,
      priority: opportunity.priority,
      description: opportunity.description,
      requiredSkills: opportunity.requiredSkills,
      notes: opportunity.notes,
    },
    attempts: opportunity.applications.map((attempt) => ({
      ...attempt,
      appliedOn: toDateOnly(attempt.appliedOn),
    })),
  };
}

export type TimelineEvent = {
  id: string;
  type: ActivityType;
  summary: string;
  occurredAt: Date;
  applicationId: string | null;
  attemptNumber: number | null;
};

/** Activity for one application, or for every attempt of an opportunity. */
export async function listActivity(scope: {
  applicationId?: string;
  opportunityId?: string;
}): Promise<TimelineEvent[]> {
  const { user } = await requireWorkspace();
  if (!scope.applicationId && !scope.opportunityId) return [];
  const rows = await prisma.activityEvent.findMany({
    where: {
      userId: user.id,
      ...(scope.applicationId
        ? { applicationId: scope.applicationId }
        : { opportunityId: scope.opportunityId }),
    },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      type: true,
      summary: true,
      occurredAt: true,
      applicationId: true,
      application: { select: { attemptNumber: true } },
    },
  });
  return rows.map(({ application, ...event }) => ({
    ...event,
    attemptNumber: application?.attemptNumber ?? null,
  }));
}

export type BoardCard = {
  applicationId: string;
  opportunityId: string;
  title: string;
  company: string;
  salaryMin: string | null;
  salaryMax: string | null;
  currency: string | null;
  salaryPeriod: SalaryPeriod | null;
  workArrangement: WorkArrangement | null;
  priority: Priority;
  appliedOn: string;
  attemptNumber: number;
  status: ApplicationStatus;
  stageId: string;
};

export type SavedCard = Omit<
  BoardCard,
  "applicationId" | "appliedOn" | "attemptNumber" | "status" | "stageId"
> & {
  savedOn: string;
};

export type BoardColumn = StageOption & { cards: BoardCard[] };

/**
 * Kanban data: the virtual "Saved" column (opportunities without an
 * application) plus one column per stage with its open applications.
 * Disabled stages only appear while applications still sit in them.
 */
export async function getBoard(): Promise<{ saved: SavedCard[]; columns: BoardColumn[] }> {
  const { user } = await requireWorkspace();
  const [pipeline, applications, saved] = await Promise.all([
    prisma.pipeline.findFirst({
      where: { userId: user.id, isDefault: true },
      select: { stages: { orderBy: { position: "asc" }, select: stageSelect } },
    }),
    prisma.application.findMany({
      where: { userId: user.id, status: { not: "CLOSED" }, pipeline: { isDefault: true } },
      orderBy: [{ opportunity: { priority: "desc" } }, { stageChangedAt: "desc" }],
      select: {
        id: true,
        stageId: true,
        status: true,
        appliedOn: true,
        attemptNumber: true,
        opportunity: {
          select: {
            id: true,
            title: true,
            salaryMin: true,
            salaryMax: true,
            currency: true,
            salaryPeriod: true,
            workArrangement: true,
            priority: true,
            company: { select: { name: true } },
          },
        },
      },
    }),
    prisma.jobOpportunity.findMany({
      where: { userId: user.id, archivedAt: null, applications: { none: {} } },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        salaryMin: true,
        salaryMax: true,
        currency: true,
        salaryPeriod: true,
        workArrangement: true,
        priority: true,
        savedOn: true,
        company: { select: { name: true } },
      },
    }),
  ]);

  const cardsByStage = new Map<string, BoardCard[]>();
  for (const application of applications) {
    const { opportunity } = application;
    const card: BoardCard = {
      applicationId: application.id,
      opportunityId: opportunity.id,
      title: opportunity.title,
      company: opportunity.company.name,
      salaryMin: decimalToString(opportunity.salaryMin),
      salaryMax: decimalToString(opportunity.salaryMax),
      currency: opportunity.currency,
      salaryPeriod: opportunity.salaryPeriod,
      workArrangement: opportunity.workArrangement,
      priority: opportunity.priority,
      appliedOn: toDateOnly(application.appliedOn),
      attemptNumber: application.attemptNumber,
      status: application.status,
      stageId: application.stageId,
    };
    cardsByStage.set(application.stageId, [...(cardsByStage.get(application.stageId) ?? []), card]);
  }

  const columns = (pipeline?.stages ?? [])
    .filter((stage) => stage.isActive || cardsByStage.has(stage.id))
    .map((stage) => ({ ...stage, cards: cardsByStage.get(stage.id) ?? [] }));

  return {
    saved: saved.map((job) => ({
      opportunityId: job.id,
      title: job.title,
      company: job.company.name,
      salaryMin: decimalToString(job.salaryMin),
      salaryMax: decimalToString(job.salaryMax),
      currency: job.currency,
      salaryPeriod: job.salaryPeriod,
      workArrangement: job.workArrangement,
      priority: job.priority,
      savedOn: toDateOnlyOrNull(job.savedOn) ?? "",
    })),
    columns,
  };
}
