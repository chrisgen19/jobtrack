import "server-only";
import { requireWorkspace } from "@/features/workspace/data";
import type { CsvValue } from "@/lib/csv";
import { formatInTimeZone, toDateOnly, toDateOnlyOrNull } from "@/lib/dates";
import {
  APPLICATION_METHOD_LABEL,
  APPLICATION_OUTCOME_LABEL,
  APPLICATION_STATUS_LABEL,
  EMPLOYMENT_TYPE_LABEL,
  PRIORITY_LABEL,
  WORK_ARRANGEMENT_LABEL,
} from "@/lib/labels";
import { decimalToString } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const APPLICATION_CSV_HEADERS = [
  "Company",
  "Job title",
  "Location",
  "Work arrangement",
  "Employment type",
  "Source",
  "Priority",
  "Salary min",
  "Salary max",
  "Currency",
  "Salary period",
  "Date saved",
  "Attempt",
  "Date applied",
  "Application method",
  "Stage",
  "Status",
  "Outcome",
  "Closed on",
  "Interviews",
  "Offers",
  "Posting URL",
  "Archived",
];

/** One CSV row per application attempt, plus one per never-applied job. */
export async function getApplicationCsvRows(): Promise<CsvValue[][]> {
  const { user, preferences } = await requireWorkspace();
  const jobs = await prisma.jobOpportunity.findMany({
    where: { userId: user.id },
    orderBy: [{ company: { name: "asc" } }, { title: "asc" }],
    select: {
      title: true,
      location: true,
      workArrangement: true,
      employmentType: true,
      source: true,
      priority: true,
      salaryMin: true,
      salaryMax: true,
      currency: true,
      salaryPeriod: true,
      savedOn: true,
      postingUrl: true,
      archivedAt: true,
      company: { select: { name: true } },
      applications: {
        orderBy: { attemptNumber: "asc" },
        select: {
          attemptNumber: true,
          appliedOn: true,
          method: true,
          status: true,
          outcome: true,
          closedAt: true,
          stage: { select: { name: true } },
          _count: { select: { interviews: true } },
          offers: { select: { id: true }, take: 1 },
        },
      },
    },
  });

  const rows: CsvValue[][] = [];
  for (const job of jobs) {
    const base: CsvValue[] = [
      job.company.name,
      job.title,
      job.location,
      job.workArrangement ? WORK_ARRANGEMENT_LABEL[job.workArrangement] : null,
      job.employmentType ? EMPLOYMENT_TYPE_LABEL[job.employmentType] : null,
      job.source,
      PRIORITY_LABEL[job.priority],
      decimalToString(job.salaryMin),
      decimalToString(job.salaryMax),
      job.currency,
      job.salaryPeriod?.toLowerCase() ?? null,
      toDateOnly(job.savedOn),
    ];
    const tail: CsvValue[] = [job.postingUrl, job.archivedAt ? "yes" : "no"];
    if (job.applications.length === 0) {
      rows.push([...base, null, null, null, "Saved (not applied)", null, null, null, 0, "no", ...tail]);
      continue;
    }
    for (const application of job.applications) {
      rows.push([
        ...base,
        application.attemptNumber,
        toDateOnlyOrNull(application.appliedOn),
        application.method ? APPLICATION_METHOD_LABEL[application.method] : null,
        application.stage.name,
        APPLICATION_STATUS_LABEL[application.status],
        application.outcome ? APPLICATION_OUTCOME_LABEL[application.outcome] : null,
        application.closedAt
          ? formatInTimeZone(application.closedAt, preferences.timezone, "yyyy-MM-dd")
          : null,
        application._count.interviews,
        application.offers.length > 0 ? "yes" : "no",
        ...tail,
      ]);
    }
  }
  return rows;
}

/**
 * Full structured backup of the signed-in user's workspace. Contains no
 * password hashes, OAuth tokens or storage keys; document bytes are
 * downloaded separately from the library.
 */
export async function getWorkspaceExport() {
  const { user, preferences } = await requireWorkspace();
  const where = { userId: user.id };
  const [
    pipelines,
    companies,
    contacts,
    tags,
    opportunities,
    applications,
    interviews,
    tasks,
    offers,
    documents,
    activity,
  ] = await Promise.all([
    prisma.pipeline.findMany({ where, include: { stages: { orderBy: { position: "asc" } } } }),
    prisma.company.findMany({ where, omit: { userId: true, normalizedName: true } }),
    prisma.contact.findMany({ where, omit: { userId: true } }),
    prisma.jobTag.findMany({ where, omit: { userId: true } }),
    prisma.jobOpportunity.findMany({
      where,
      omit: { userId: true, normalizedUrl: true },
      include: { tags: { select: { tagId: true } } },
    }),
    prisma.application.findMany({
      where,
      omit: { userId: true },
      include: {
        documents: { select: { documentId: true, purpose: true, wasSubmitted: true, attachedAt: true } },
      },
    }),
    prisma.interview.findMany({
      where,
      omit: { userId: true },
      include: { reschedules: { omit: { userId: true } }, contacts: { select: { contactId: true } } },
    }),
    prisma.task.findMany({ where, omit: { userId: true } }),
    prisma.offer.findMany({ where, omit: { userId: true } }),
    prisma.document.findMany({ where, omit: { userId: true, storageKey: true } }),
    prisma.activityEvent.findMany({ where, omit: { userId: true }, orderBy: { occurredAt: "asc" } }),
  ]);

  return {
    format: "jobtrack-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    account: { name: user.name, email: user.email },
    preferences,
    pipelines: pipelines.map(({ userId: _userId, stages, ...pipeline }) => ({
      ...pipeline,
      stages: stages.map(({ userId: _stageUser, ...stage }) => stage),
    })),
    companies,
    contacts,
    tags,
    opportunities,
    applications,
    interviews,
    tasks,
    offers,
    documents,
    activity,
  };
}
