import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type {
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
import { beforeSourcesDeleted, sourcesUnder } from "@/features/integrations/side-effects";
import { submitApplicationInTx } from "@/features/applications/service";
import { findOrCreateCompany } from "@/features/companies/data";
import { normalizeCompanyName } from "@/features/companies/normalize";
import { requireWorkspace, type Workspace } from "@/features/workspace/data";
import { NotFoundError } from "@/lib/action-result";
import { parseDateOnly, todayInTimeZone, toDateOnly, toDateOnlyOrNull } from "@/lib/dates";
import { decimalToString } from "@/lib/money";
import { prisma, type TransactionClient } from "@/lib/prisma";
import { normalizePostingUrl, normalizeTitle } from "./normalize";
import type { JobListFilters, OpportunityInput, QuickAddInput } from "./schemas";

export type SalaryDto = {
  min: string | null;
  max: string | null;
  currency: string | null;
  period: SalaryPeriod | null;
};

export type LatestApplicationDto = {
  id: string;
  status: ApplicationStatus;
  outcome: ApplicationOutcome | null;
  appliedOn: string;
  attemptNumber: number;
  stage: { id: string; name: string; category: StageCategory; color: string | null };
};

export type OpportunityListRow = {
  id: string;
  title: string;
  companyName: string;
  location: string | null;
  priority: Priority;
  workArrangement: WorkArrangement | null;
  source: string | null;
  salary: SalaryDto;
  savedOn: string;
  archived: boolean;
  applicationCount: number;
  latestApplication: LatestApplicationDto | null;
};

function salaryOf(row: {
  salaryMin: Prisma.Decimal | null;
  salaryMax: Prisma.Decimal | null;
  currency: string | null;
  salaryPeriod: SalaryPeriod | null;
}): SalaryDto {
  return {
    min: decimalToString(row.salaryMin),
    max: decimalToString(row.salaryMax),
    currency: row.currency,
    period: row.salaryPeriod,
  };
}

function listWhere(userId: string, filters: JobListFilters): Prisma.JobOpportunityWhereInput {
  const and: Prisma.JobOpportunityWhereInput[] = [{ userId }];
  switch (filters.view) {
    case "archived":
      and.push({ archivedAt: { not: null } });
      break;
    case "saved":
      and.push({ archivedAt: null, applications: { none: {} } });
      break;
    case "active":
      and.push({ archivedAt: null, applications: { some: { status: { in: ["ACTIVE", "PAUSED"] } } } });
      break;
    case "closed":
      and.push({
        archivedAt: null,
        applications: { some: {}, every: { status: "CLOSED" } },
      });
      break;
    default:
      and.push({ archivedAt: null });
  }
  if (filters.q) {
    and.push({
      OR: [
        { title: { contains: filters.q, mode: "insensitive" } },
        { company: { name: { contains: filters.q, mode: "insensitive" } } },
        { location: { contains: filters.q, mode: "insensitive" } },
        { requiredSkills: { has: filters.q } },
      ],
    });
  }
  if (filters.stage)
    and.push({ applications: { some: { stageId: filters.stage, status: { not: "CLOSED" } } } });
  if (filters.priority) and.push({ priority: filters.priority });
  if (filters.work) and.push({ workArrangement: filters.work });
  if (filters.source) and.push({ source: { equals: filters.source, mode: "insensitive" } });
  return { AND: and };
}

/** Jobs table rows for the signed-in user, filtered by URL search params. */
export async function listOpportunities(
  filters: JobListFilters,
): Promise<{ rows: OpportunityListRow[]; total: number }> {
  const { user } = await requireWorkspace();
  const [rows, total] = await Promise.all([
    prisma.jobOpportunity.findMany({
      where: listWhere(user.id, filters),
      orderBy: { createdAt: "desc" },
      take: 1_000,
      select: {
        id: true,
        title: true,
        location: true,
        priority: true,
        workArrangement: true,
        source: true,
        salaryMin: true,
        salaryMax: true,
        currency: true,
        salaryPeriod: true,
        savedOn: true,
        archivedAt: true,
        company: { select: { name: true } },
        _count: { select: { applications: true } },
        applications: {
          orderBy: { attemptNumber: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            outcome: true,
            appliedOn: true,
            attemptNumber: true,
            stage: { select: { id: true, name: true, category: true, color: true } },
          },
        },
      },
    }),
    prisma.jobOpportunity.count({ where: { userId: user.id, archivedAt: null } }),
  ]);

  return {
    total,
    rows: rows.map((row) => {
      const latest = row.applications[0];
      return {
        id: row.id,
        title: row.title,
        companyName: row.company.name,
        location: row.location,
        priority: row.priority,
        workArrangement: row.workArrangement,
        source: row.source,
        salary: salaryOf(row),
        savedOn: toDateOnly(row.savedOn),
        archived: row.archivedAt !== null,
        applicationCount: row._count.applications,
        latestApplication: latest ? { ...latest, appliedOn: toDateOnly(latest.appliedOn) } : null,
      };
    }),
  };
}

/** Distinct job sources the user has used (filter options). */
export async function listSources(): Promise<string[]> {
  const { user } = await requireWorkspace();
  const rows = await prisma.jobOpportunity.findMany({
    where: { userId: user.id, source: { not: null } },
    distinct: ["source"],
    select: { source: true },
    orderBy: { source: "asc" },
  });
  return rows.map((row) => row.source!).filter(Boolean);
}

export type OpportunityDetail = {
  id: string;
  title: string;
  companyId: string;
  companyName: string;
  description: string | null;
  postingUrl: string | null;
  source: string | null;
  referenceCode: string | null;
  salary: SalaryDto;
  salaryBasis: SalaryBasis;
  employmentType: EmploymentType | null;
  workArrangement: WorkArrangement | null;
  location: string | null;
  requiredSkills: string[];
  priority: Priority;
  notes: string | null;
  deadline: string | null;
  savedOn: string;
  archivedAt: Date | null;
  tags: string[];
  applications: (LatestApplicationDto & { interviewCount: number; closedAt: Date | null })[];
};

export async function getOpportunityDetail(opportunityId: string): Promise<OpportunityDetail | null> {
  const { user } = await requireWorkspace();
  const row = await prisma.jobOpportunity.findFirst({
    where: { id: opportunityId, userId: user.id },
    select: {
      id: true,
      title: true,
      description: true,
      postingUrl: true,
      source: true,
      referenceCode: true,
      salaryMin: true,
      salaryMax: true,
      currency: true,
      salaryPeriod: true,
      salaryBasis: true,
      employmentType: true,
      workArrangement: true,
      location: true,
      requiredSkills: true,
      priority: true,
      notes: true,
      deadline: true,
      savedOn: true,
      archivedAt: true,
      company: { select: { id: true, name: true } },
      tags: { select: { tag: { select: { name: true } } } },
      applications: {
        orderBy: { attemptNumber: "desc" },
        select: {
          id: true,
          status: true,
          outcome: true,
          appliedOn: true,
          attemptNumber: true,
          closedAt: true,
          stage: { select: { id: true, name: true, category: true, color: true } },
          _count: { select: { interviews: true } },
        },
      },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    companyId: row.company.id,
    companyName: row.company.name,
    description: row.description,
    postingUrl: row.postingUrl,
    source: row.source,
    referenceCode: row.referenceCode,
    salary: salaryOf(row),
    salaryBasis: row.salaryBasis,
    employmentType: row.employmentType,
    workArrangement: row.workArrangement,
    location: row.location,
    requiredSkills: row.requiredSkills,
    priority: row.priority,
    notes: row.notes,
    deadline: toDateOnlyOrNull(row.deadline),
    savedOn: toDateOnly(row.savedOn),
    archivedAt: row.archivedAt,
    tags: row.tags.map(({ tag }) => tag.name),
    applications: row.applications.map(({ _count, ...application }) => ({
      ...application,
      appliedOn: toDateOnly(application.appliedOn),
      interviewCount: _count.interviews,
    })),
  };
}

/** Maps validated form input to Prisma column values. */
function toColumns(input: OpportunityInput, defaultCurrency: string) {
  const hasSalary = Boolean(input.salaryMin || input.salaryMax);
  return {
    title: input.title,
    description: input.description ?? null,
    postingUrl: input.postingUrl ?? null,
    normalizedUrl: normalizePostingUrl(input.postingUrl),
    source: input.source ?? null,
    referenceCode: input.referenceCode ?? null,
    salaryMin: input.salaryMin ?? null,
    salaryMax: input.salaryMax ?? null,
    currency: input.currency ?? (hasSalary ? defaultCurrency : null),
    salaryPeriod: hasSalary ? (input.salaryPeriod ?? null) : null,
    salaryBasis: input.salaryBasis,
    employmentType: input.employmentType ?? null,
    workArrangement: input.workArrangement ?? null,
    location: input.location ?? null,
    requiredSkills: input.requiredSkills,
    priority: input.priority,
    notes: input.notes ?? null,
    deadline: input.deadline ? parseDateOnly(input.deadline) : null,
  };
}

async function setTags(
  tx: TransactionClient,
  userId: string,
  opportunityId: string,
  names: string[],
): Promise<void> {
  await tx.opportunityTag.deleteMany({ where: { userId, opportunityId } });
  for (const name of names) {
    const tag = await tx.jobTag.upsert({
      where: { userId_name: { userId, name } },
      create: { userId, name },
      update: {},
      select: { id: true },
    });
    await tx.opportunityTag.create({ data: { userId, opportunityId, tagId: tag.id } });
  }
}

/**
 * Saves a job (company is found or created by name). When the user marks it
 * as already applied, the application attempt is created in the same
 * transaction. Returns the opportunity and optional application IDs.
 */
export async function createOpportunity(
  input: QuickAddInput,
): Promise<{ id: string; applicationId: string | null }> {
  return createOpportunityForWorkspace(await requireWorkspace(), input);
}

/** createOpportunity for a workspace the caller already authenticated (extension API). */
export async function createOpportunityForWorkspace(
  { user, preferences }: Workspace,
  input: QuickAddInput,
): Promise<{ id: string; applicationId: string | null }> {
  return prisma.$transaction(async (tx) => {
    const companyId = await findOrCreateCompany(tx, user.id, input.companyName);
    const opportunity = await tx.jobOpportunity.create({
      data: {
        userId: user.id,
        companyId,
        ...toColumns(input, preferences.currency),
        savedOn: parseDateOnly(input.savedOn ?? todayInTimeZone(preferences.timezone)),
      },
      select: { id: true },
    });
    if (input.tags.length) await setTags(tx, user.id, opportunity.id, input.tags);
    await recordActivity(tx, {
      userId: user.id,
      opportunityId: opportunity.id,
      type: "OPPORTUNITY_SAVED",
      summary: `Saved ${input.title} at ${input.companyName.trim()}`,
    });

    let applicationId: string | null = null;
    if (input.alreadyApplied && input.appliedOn) {
      applicationId = await submitApplicationInTx(
        tx,
        {
          userId: user.id,
          timezone: preferences.timezone,
          suggestFollowUps: preferences.suggestFollowUps,
          followUpDays: preferences.followUpDays,
        },
        {
          opportunityId: opportunity.id,
          appliedOn: input.appliedOn,
          stageId: input.stageId,
          method: input.method,
        },
      );
    }
    return { id: opportunity.id, applicationId };
  });
}

export async function updateOpportunity(opportunityId: string, input: OpportunityInput): Promise<void> {
  const { user, preferences } = await requireWorkspace();
  await prisma.$transaction(async (tx) => {
    const existing = await tx.jobOpportunity.findFirst({
      where: { id: opportunityId, userId: user.id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError("Job");
    const companyId = await findOrCreateCompany(tx, user.id, input.companyName);
    await tx.jobOpportunity.update({
      where: { id: existing.id },
      data: {
        companyId,
        ...toColumns(input, preferences.currency),
        ...(input.savedOn ? { savedOn: parseDateOnly(input.savedOn) } : {}),
      },
    });
    await setTags(tx, user.id, existing.id, input.tags);
    await recordActivity(tx, {
      userId: user.id,
      opportunityId: existing.id,
      type: "OPPORTUNITY_UPDATED",
      summary: "Job details updated",
    });
  });
}

export async function setOpportunityArchived(opportunityId: string, archived: boolean): Promise<void> {
  const { user } = await requireWorkspace();
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.jobOpportunity.updateMany({
      where: { id: opportunityId, userId: user.id },
      data: { archivedAt: archived ? new Date() : null },
    });
    if (count === 0) throw new NotFoundError("Job");
    await recordActivity(tx, {
      userId: user.id,
      opportunityId,
      type: archived ? "OPPORTUNITY_ARCHIVED" : "OPPORTUNITY_RESTORED",
      summary: archived ? "Job archived" : "Job restored from archive",
    });
  });
}

/** Permanently deletes a job with all attempts, interviews, tasks and history. */
export async function deleteOpportunity(opportunityId: string): Promise<void> {
  const { user } = await requireWorkspace();
  await prisma.$transaction(async (tx) => {
    const existing = await tx.jobOpportunity.findFirst({
      where: { id: opportunityId, userId: user.id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError("Job");
    // Queue removal of synced calendar events before the cascade deletes their sources.
    await beforeSourcesDeleted(tx, user.id, await sourcesUnder(tx, user.id, { opportunityId: existing.id }));
    await tx.jobOpportunity.delete({ where: { id: existing.id } });
  });
}

export type DuplicateCandidate = {
  id: string;
  title: string;
  companyName: string;
  savedOn: string;
  applicationCount: number;
  reason: "url" | "title";
};

export type DuplicateQuery = {
  title?: string;
  companyName?: string;
  postingUrl?: string;
  excludeId?: string;
};

/**
 * Possible duplicates of a job being saved: same normalized posting URL, or
 * the same company with the same (normalized) title. Advisory only; saving
 * and reapplying are never blocked.
 */
export async function findDuplicateCandidates(params: DuplicateQuery): Promise<DuplicateCandidate[]> {
  return findDuplicateCandidatesForUser((await requireWorkspace()).user.id, params);
}

/** findDuplicateCandidates for a user the caller already authenticated (extension API). */
export async function findDuplicateCandidatesForUser(
  userId: string,
  params: DuplicateQuery,
): Promise<DuplicateCandidate[]> {
  const normalizedUrl = normalizePostingUrl(params.postingUrl);
  const title = params.title ? normalizeTitle(params.title) : "";
  const companyKey = params.companyName ? normalizeCompanyName(params.companyName) : "";

  const or: Prisma.JobOpportunityWhereInput[] = [];
  if (normalizedUrl) or.push({ normalizedUrl });
  if (title && companyKey) or.push({ company: { normalizedName: companyKey } });
  if (or.length === 0) return [];

  const rows = await prisma.jobOpportunity.findMany({
    where: { userId, OR: or, ...(params.excludeId ? { id: { not: params.excludeId } } : {}) },
    take: 20,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      normalizedUrl: true,
      savedOn: true,
      company: { select: { name: true } },
      _count: { select: { applications: true } },
    },
  });

  return rows
    .map((row) => ({
      row,
      reason: (normalizedUrl && row.normalizedUrl === normalizedUrl
        ? "url"
        : normalizeTitle(row.title) === title
          ? "title"
          : null) as DuplicateCandidate["reason"] | null,
    }))
    .filter(
      (item): item is { row: (typeof rows)[number]; reason: DuplicateCandidate["reason"] } =>
        item.reason !== null,
    )
    .slice(0, 5)
    .map(({ row, reason }) => ({
      id: row.id,
      title: row.title,
      companyName: row.company.name,
      savedOn: toDateOnly(row.savedOn),
      applicationCount: row._count.applications,
      reason,
    }));
}

export type QuickAddOptions = {
  stages: { id: string; name: string }[];
  companyNames: string[];
  currency: string;
  today: string;
};

/** Data the Quick Add dialog needs (active stages, companies, defaults). */
export async function getQuickAddOptions(): Promise<QuickAddOptions> {
  const { user, preferences } = await requireWorkspace();
  const [stages, companies] = await Promise.all([
    prisma.pipelineStage.findMany({
      where: { userId: user.id, isActive: true, pipeline: { isDefault: true } },
      orderBy: { position: "asc" },
      select: { id: true, name: true },
    }),
    prisma.company.findMany({ where: { userId: user.id }, orderBy: { name: "asc" }, select: { name: true } }),
  ]);
  return {
    stages,
    companyNames: companies.map((company) => company.name),
    currency: preferences.currency,
    today: todayInTimeZone(preferences.timezone),
  };
}

export type DeadlineItem = { opportunityId: string; title: string; company: string; deadline: string };

/** Application deadlines (DATE) of saved, not-yet-applied jobs within [from, to]. */
export async function listApplicationDeadlines(from: string, to: string): Promise<DeadlineItem[]> {
  const { user } = await requireWorkspace();
  const rows = await prisma.jobOpportunity.findMany({
    where: {
      userId: user.id,
      archivedAt: null,
      applications: { none: {} },
      deadline: { gte: parseDateOnly(from), lte: parseDateOnly(to) },
    },
    orderBy: { deadline: "asc" },
    select: { id: true, title: true, deadline: true, company: { select: { name: true } } },
  });
  return rows.map((row) => ({
    opportunityId: row.id,
    title: row.title,
    company: row.company.name,
    deadline: toDateOnly(row.deadline!),
  }));
}
