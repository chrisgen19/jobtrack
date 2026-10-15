import "server-only";
import type { OfferStatus, SalaryBasis, SalaryPeriod } from "@/generated/prisma/enums";
import { recordActivity } from "@/features/activity/record";
import { afterApplicationStatusChange, afterOfferChange } from "@/features/integrations/side-effects";
import { changeStageInTx, suggestTask } from "@/features/applications/service";
import { requireWorkspace } from "@/features/workspace/data";
import { DomainError, NotFoundError } from "@/lib/action-result";
import { addDaysToDateOnly, parseDateOnly, todayInTimeZone, toDateOnly, toDateOnlyOrNull } from "@/lib/dates";
import { decimalToString, formatMoney, PERIOD_SUFFIX } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import type { CreateOfferInput } from "./schemas";

const DECIDED: OfferStatus[] = ["ACCEPTED", "DECLINED"];

function offerSummary(input: {
  baseSalary?: string | null;
  currency: string;
  salaryPeriod: SalaryPeriod;
}): string {
  return input.baseSalary
    ? `${formatMoney(input.baseSalary, input.currency)}${PERIOD_SUFFIX[input.salaryPeriod]}`
    : "amount not recorded";
}

/**
 * Records an offer or a new revision of it. Earlier revisions are never
 * overwritten. The application moves to the pipeline's offer stage (logged)
 * and an editable decision task is suggested.
 */
export async function createOffer(input: CreateOfferInput): Promise<string> {
  const { user, preferences } = await requireWorkspace();
  return prisma.$transaction(async (tx) => {
    const application = await tx.application.findFirst({
      where: { id: input.applicationId, userId: user.id },
      select: {
        id: true,
        status: true,
        opportunityId: true,
        pipelineId: true,
        stage: { select: { category: true } },
      },
    });
    if (!application) throw new NotFoundError("Application");

    const previous = await tx.offer.aggregate({
      where: { userId: user.id, applicationId: application.id },
      _max: { revisionNumber: true },
    });
    const revisionNumber = (previous._max.revisionNumber ?? 0) + 1;
    const offer = await tx.offer.create({
      data: {
        userId: user.id,
        applicationId: application.id,
        revisionNumber,
        positionTitle: input.positionTitle,
        baseSalary: input.baseSalary ?? null,
        currency: input.currency,
        salaryPeriod: input.salaryPeriod,
        salaryBasis: input.salaryBasis,
        bonus: input.bonus ?? null,
        equity: input.equity ?? null,
        benefits: input.benefits ?? null,
        startDate: input.startDate ? parseDateOnly(input.startDate) : null,
        decisionDeadline: input.decisionDeadline ? parseDateOnly(input.decisionDeadline) : null,
        receivedOn: parseDateOnly(input.receivedOn),
        negotiationNotes: input.negotiationNotes ?? null,
        status: revisionNumber > 1 ? "NEGOTIATING" : "RECEIVED",
      },
      select: { id: true },
    });

    await recordActivity(tx, {
      userId: user.id,
      opportunityId: application.opportunityId,
      applicationId: application.id,
      type: revisionNumber > 1 ? "OFFER_REVISED" : "OFFER_RECEIVED",
      summary:
        revisionNumber > 1
          ? `Offer revised (revision ${revisionNumber}): ${offerSummary(input)}`
          : `Offer received: ${offerSummary(input)}`,
      details: { offerId: offer.id, revisionNumber },
    });

    if (application.status !== "CLOSED" && application.stage.category !== "OFFER") {
      const offerStage = await tx.pipelineStage.findFirst({
        where: { userId: user.id, pipelineId: application.pipelineId, category: "OFFER", isActive: true },
        orderBy: { position: "asc" },
        select: { id: true },
      });
      if (offerStage)
        await changeStageInTx(tx, user.id, application.id, offerStage.id, { reason: "Offer recorded" });
    }

    if (preferences.suggestFollowUps && revisionNumber === 1) {
      const today = todayInTimeZone(preferences.timezone);
      await suggestTask(
        tx,
        {
          userId: user.id,
          timezone: preferences.timezone,
          suggestFollowUps: true,
          followUpDays: preferences.followUpDays,
        },
        {
          opportunityId: application.opportunityId,
          applicationId: application.id,
          title: `Decide on the ${input.positionTitle} offer`,
          type: "OFFER_DECISION",
          dueDate: input.decisionDeadline
            ? addDaysToDateOnly(input.decisionDeadline, -1)
            : addDaysToDateOnly(today, 3),
          reason: "offer_received",
        },
      );
    }
    await afterOfferChange(tx, user.id, offer.id);
    return offer.id;
  });
}

/**
 * Accepts or declines an offer and closes its application with the matching
 * outcome in the same transaction. Other applications are never touched.
 */
export async function decideOffer(offerId: string, decision: "ACCEPTED" | "DECLINED"): Promise<void> {
  const { user } = await requireWorkspace();
  await prisma.$transaction(async (tx) => {
    const offer = await tx.offer.findFirst({
      where: { id: offerId, userId: user.id },
      select: {
        id: true,
        status: true,
        revisionNumber: true,
        positionTitle: true,
        application: { select: { id: true, status: true, opportunityId: true } },
      },
    });
    if (!offer) throw new NotFoundError("Offer");
    if (offer.status === "ACCEPTED" || offer.status === "DECLINED")
      throw new DomainError("This offer already has a decision.");
    const newer = await tx.offer.count({
      where: {
        userId: user.id,
        applicationId: offer.application.id,
        revisionNumber: { gt: offer.revisionNumber },
      },
    });
    if (newer > 0)
      throw new DomainError("A newer revision of this offer exists. Decide on the latest revision.");

    // Conditional on still being undecided, so of two concurrent decisions only one wins.
    const decided = await tx.offer.updateMany({
      where: { id: offer.id, userId: user.id, status: { notIn: DECIDED } },
      data: { status: decision, decidedAt: new Date() },
    });
    if (decided.count === 0) throw new DomainError("This offer already has a decision.");
    const { application } = offer;
    await recordActivity(tx, {
      userId: user.id,
      opportunityId: application.opportunityId,
      applicationId: application.id,
      type: decision === "ACCEPTED" ? "OFFER_ACCEPTED" : "OFFER_DECLINED",
      summary: `${decision === "ACCEPTED" ? "Accepted" : "Declined"} the ${offer.positionTitle} offer (revision ${offer.revisionNumber})`,
      details: { offerId: offer.id },
    });

    if (application.status !== "CLOSED") {
      const outcome = decision === "ACCEPTED" ? "ACCEPTED" : "OFFER_DECLINED";
      await tx.application.update({
        where: { id: application.id },
        data: { status: "CLOSED", outcome, closedAt: new Date() },
      });
      await recordActivity(tx, {
        userId: user.id,
        opportunityId: application.opportunityId,
        applicationId: application.id,
        type: "APPLICATION_CLOSED",
        summary: decision === "ACCEPTED" ? "Closed: Accepted" : "Closed: Offer declined",
        details: { outcome, offerId: offer.id },
      });
      await afterApplicationStatusChange(tx, user.id, application.id);
    }
    await afterOfferChange(tx, user.id, offer.id);
  });
}

/**
 * Sets a non-decision status. The update is conditional on the offer still
 * being undecided: PostgreSQL re-checks that condition after waiting for a
 * concurrent decision's row lock, so an accepted or declined offer is never
 * overwritten.
 */
export async function setOfferStatus(
  offerId: string,
  status: "RECEIVED" | "NEGOTIATING" | "EXPIRED" | "RESCINDED",
): Promise<void> {
  const { user } = await requireWorkspace();
  await prisma.$transaction(async (tx) => {
    const updated = await tx.offer.updateMany({
      where: { id: offerId, userId: user.id, status: { notIn: DECIDED } },
      data: { status },
    });
    if (updated.count === 0) {
      const exists = await tx.offer.count({ where: { id: offerId, userId: user.id } });
      if (!exists) throw new NotFoundError("Offer");
      throw new DomainError("This offer already has a decision.");
    }
    await afterOfferChange(tx, user.id, offerId);
  });
}

export type OfferDto = {
  id: string;
  revisionNumber: number;
  positionTitle: string;
  baseSalary: string | null;
  currency: string;
  salaryPeriod: SalaryPeriod;
  salaryBasis: SalaryBasis;
  bonus: string | null;
  equity: string | null;
  benefits: string | null;
  startDate: string | null;
  decisionDeadline: string | null;
  receivedOn: string;
  status: OfferStatus;
  negotiationNotes: string | null;
  decidedAt: Date | null;
};

/** All revisions for an application, newest first. */
export async function listApplicationOffers(applicationId: string): Promise<OfferDto[]> {
  const { user } = await requireWorkspace();
  const rows = await prisma.offer.findMany({
    where: { userId: user.id, applicationId },
    orderBy: { revisionNumber: "desc" },
    select: {
      id: true,
      revisionNumber: true,
      positionTitle: true,
      baseSalary: true,
      currency: true,
      salaryPeriod: true,
      salaryBasis: true,
      bonus: true,
      equity: true,
      benefits: true,
      startDate: true,
      decisionDeadline: true,
      receivedOn: true,
      status: true,
      negotiationNotes: true,
      decidedAt: true,
    },
  });
  return rows.map((row) => ({
    ...row,
    baseSalary: decimalToString(row.baseSalary),
    startDate: toDateOnlyOrNull(row.startDate),
    decisionDeadline: toDateOnlyOrNull(row.decisionDeadline),
    receivedOn: toDateOnly(row.receivedOn),
  }));
}

export type OfferDeadline = {
  offerId: string;
  applicationId: string;
  positionTitle: string;
  company: string;
  deadline: string;
};

/**
 * Decision deadlines of undecided offers within [from, to] (calendar). Only
 * the latest revision per application counts, like reminders and the
 * dashboard: earlier revisions keep their old status and deadline.
 */
export async function listOfferDeadlines(from: string, to: string): Promise<OfferDeadline[]> {
  const { user } = await requireWorkspace();
  const candidates = await prisma.offer.findMany({
    where: {
      userId: user.id,
      status: { in: ["RECEIVED", "NEGOTIATING"] },
      decisionDeadline: { gte: parseDateOnly(from), lte: parseDateOnly(to) },
    },
    select: {
      id: true,
      applicationId: true,
      revisionNumber: true,
      positionTitle: true,
      decisionDeadline: true,
      application: { select: { opportunity: { select: { company: { select: { name: true } } } } } },
    },
  });
  if (candidates.length === 0) return [];
  const latest = await prisma.offer.groupBy({
    by: ["applicationId"],
    where: { userId: user.id, applicationId: { in: candidates.map((row) => row.applicationId) } },
    _max: { revisionNumber: true },
  });
  const latestRevision = new Map(latest.map((group) => [group.applicationId, group._max.revisionNumber]));
  const rows = candidates.filter((row) => latestRevision.get(row.applicationId) === row.revisionNumber);
  return rows.map((row) => ({
    offerId: row.id,
    applicationId: row.applicationId,
    positionTitle: row.positionTitle,
    company: row.application.opportunity.company.name,
    deadline: toDateOnly(row.decisionDeadline!),
  }));
}
