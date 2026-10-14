import "server-only";
import type { ApplicationMethod } from "@/generated/prisma/enums";
import { recordActivity } from "@/features/activity/record";
import { DomainError, NotFoundError } from "@/lib/action-result";
import { addDaysToDateOnly, parseDateOnly, todayInTimeZone, zonedToUtc } from "@/lib/dates";
import type { TransactionClient } from "@/lib/prisma";

/** What transaction-level helpers need to know about the signed-in user. */
export type WorkspaceContext = {
  userId: string;
  timezone: string;
  suggestFollowUps: boolean;
  followUpDays: number;
};

export type SubmitApplicationInput = {
  opportunityId: string;
  appliedOn: string;
  method?: ApplicationMethod;
  submittedVia?: string;
  stageId?: string;
  notes?: string;
};

/**
 * Creates an application attempt inside an existing transaction: verifies
 * the opportunity and stage belong to the user (and the stage to their
 * default pipeline), numbers the attempt, logs the activity event and, when
 * enabled, adds an editable follow-up suggestion.
 */
export async function submitApplicationInTx(
  tx: TransactionClient,
  ctx: WorkspaceContext,
  input: SubmitApplicationInput,
): Promise<string> {
  const opportunity = await tx.jobOpportunity.findFirst({
    where: { id: input.opportunityId, userId: ctx.userId },
    select: { id: true, title: true, archivedAt: true, company: { select: { name: true } } },
  });
  if (!opportunity) throw new NotFoundError("Job");

  const pipeline = await tx.pipeline.findFirst({
    where: { userId: ctx.userId, isDefault: true },
    select: {
      id: true,
      stages: { where: { isActive: true }, orderBy: { position: "asc" }, select: { id: true, name: true } },
    },
  });
  if (!pipeline || pipeline.stages.length === 0) {
    throw new DomainError("Your pipeline has no active stages. Add one in Settings → Pipeline stages.");
  }
  const stage = input.stageId
    ? pipeline.stages.find((item) => item.id === input.stageId)
    : pipeline.stages[0];
  if (!stage) throw new DomainError("Choose an active stage from your pipeline.");

  const previous = await tx.application.aggregate({
    where: { userId: ctx.userId, opportunityId: opportunity.id },
    _max: { attemptNumber: true },
  });
  const attemptNumber = (previous._max.attemptNumber ?? 0) + 1;

  const application = await tx.application.create({
    data: {
      userId: ctx.userId,
      opportunityId: opportunity.id,
      pipelineId: pipeline.id,
      stageId: stage.id,
      attemptNumber,
      appliedOn: parseDateOnly(input.appliedOn),
      method: input.method ?? null,
      submittedVia: input.submittedVia ?? null,
      notes: input.notes ?? null,
    },
    select: { id: true },
  });

  if (opportunity.archivedAt) {
    await tx.jobOpportunity.update({ where: { id: opportunity.id }, data: { archivedAt: null } });
  }

  await recordActivity(tx, {
    userId: ctx.userId,
    opportunityId: opportunity.id,
    applicationId: application.id,
    type: "APPLICATION_SUBMITTED",
    summary: attemptNumber > 1 ? `Reapplied (attempt ${attemptNumber})` : "Application submitted",
    details: {
      attemptNumber,
      appliedOn: input.appliedOn,
      stageId: stage.id,
      stageName: stage.name,
      method: input.method ?? null,
    },
  });

  if (ctx.suggestFollowUps) {
    await suggestTask(tx, ctx, {
      opportunityId: opportunity.id,
      applicationId: application.id,
      title: `Follow up on ${opportunity.title} application`,
      type: "FOLLOW_UP",
      dueDate: addDaysToDateOnly(input.appliedOn, ctx.followUpDays),
      reason: "application_submitted",
    });
  }

  return application.id;
}

/**
 * Adds a SUGGESTED task (never an outgoing email). Suggestions stay editable
 * and dismissible and do not count as overdue until accepted. Due dates in
 * the past (back-dated applications) move to tomorrow.
 */
export async function suggestTask(
  tx: TransactionClient,
  ctx: WorkspaceContext,
  input: {
    opportunityId: string;
    applicationId: string;
    interviewId?: string;
    title: string;
    type: "FOLLOW_UP" | "RECRUITER_FOLLOW_UP" | "OFFER_DECISION";
    dueDate: string;
    reason: string;
  },
): Promise<void> {
  const tomorrow = addDaysToDateOnly(todayInTimeZone(ctx.timezone), 1);
  const dueDate = input.dueDate < tomorrow ? tomorrow : input.dueDate;
  await tx.task.create({
    data: {
      userId: ctx.userId,
      opportunityId: input.opportunityId,
      applicationId: input.applicationId,
      interviewId: input.interviewId ?? null,
      title: input.title.slice(0, 200),
      type: input.type,
      status: "SUGGESTED",
      dueAt: zonedToUtc(dueDate, "09:00", ctx.timezone),
      suggestionReason: input.reason,
    },
  });
}

/**
 * Moves an application to another stage of the same pipeline and logs a
 * STAGE_CHANGED event with name snapshots. Returns false when nothing moved.
 */
export async function changeStageInTx(
  tx: TransactionClient,
  userId: string,
  applicationId: string,
  stageId: string,
  options: { reason?: string; allowInactiveTarget?: boolean } = {},
): Promise<boolean> {
  const application = await tx.application.findFirst({
    where: { id: applicationId, userId },
    select: {
      id: true,
      status: true,
      pipelineId: true,
      opportunityId: true,
      stage: { select: { id: true, name: true } },
    },
  });
  if (!application) throw new NotFoundError("Application");
  if (application.status === "CLOSED")
    throw new DomainError("Reopen this application before changing its stage.");
  if (application.stage.id === stageId) return false;

  const target = await tx.pipelineStage.findFirst({
    where: { id: stageId, userId, pipelineId: application.pipelineId },
    select: { id: true, name: true, isActive: true },
  });
  if (!target) throw new DomainError("That stage is not part of this application's pipeline.");
  if (!target.isActive && !options.allowInactiveTarget) throw new DomainError("That stage is disabled.");

  await tx.application.update({
    where: { id: application.id },
    data: { stageId: target.id, stageChangedAt: new Date() },
  });
  await recordActivity(tx, {
    userId,
    opportunityId: application.opportunityId,
    applicationId: application.id,
    type: "STAGE_CHANGED",
    summary: `Moved from ${application.stage.name} to ${target.name}`,
    details: {
      fromStageId: application.stage.id,
      fromStageName: application.stage.name,
      toStageId: target.id,
      toStageName: target.name,
      ...(options.reason ? { reason: options.reason } : {}),
    },
  });
  return true;
}
