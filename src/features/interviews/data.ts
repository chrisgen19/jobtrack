import "server-only";
import type {
  InterviewMode,
  InterviewResult,
  InterviewStatus,
  InterviewType,
} from "@/generated/prisma/enums";
import { recordActivity } from "@/features/activity/record";
import { afterInterviewChange, beforeSourcesDeleted } from "@/features/integrations/side-effects";
import { suggestTask } from "@/features/applications/service";
import { requireWorkspace, type Workspace } from "@/features/workspace/data";
import { DomainError, NotFoundError } from "@/lib/action-result";
import { addDaysToDateOnly, formatInTimeZone, todayInTimeZone, zonedToUtc } from "@/lib/dates";
import { INTERVIEW_RESULT_LABEL } from "@/lib/labels";
import { prisma, type TransactionClient } from "@/lib/prisma";
import type { CreateInterviewInput, RescheduleInput, UpdateInterviewInput } from "./schemas";

type ScheduleInput = { date?: string; startTime?: string; durationMinutes?: number; timezone: string };

/** Wall-clock input in the interview's timezone -> UTC instants. */
export function toInstants(input: ScheduleInput): { startsAt: Date | null; endsAt: Date | null } {
  if (!input.date || !input.startTime) return { startsAt: null, endsAt: null };
  const startsAt = zonedToUtc(input.date, input.startTime, input.timezone);
  const endsAt = input.durationMinutes ? new Date(startsAt.getTime() + input.durationMinutes * 60_000) : null;
  return { startsAt, endsAt };
}

function describeTime(instant: Date | null, timezone: string): string {
  return instant ? formatInTimeZone(instant, timezone, "EEE, MMM d 'at' h:mm a") : "an unset time";
}

async function assertContacts(tx: TransactionClient, userId: string, contactIds: string[]): Promise<void> {
  if (contactIds.length === 0) return;
  const owned = await tx.contact.count({ where: { userId, id: { in: contactIds } } });
  if (owned !== new Set(contactIds).size)
    throw new DomainError("One of the selected contacts was not found.");
}

async function setContacts(tx: TransactionClient, userId: string, interviewId: string, contactIds: string[]) {
  await assertContacts(tx, userId, contactIds);
  await tx.interviewContact.deleteMany({ where: { userId, interviewId } });
  if (contactIds.length) {
    await tx.interviewContact.createMany({
      data: [...new Set(contactIds)].map((contactId) => ({ userId, interviewId, contactId })),
    });
  }
}

/** Adds an interview round. Any number of rounds (even of the same type) is allowed. */
export async function createInterview(input: CreateInterviewInput): Promise<string> {
  const { user, preferences } = await requireWorkspace();
  return prisma.$transaction(async (tx) => {
    const application = await tx.application.findFirst({
      where: { id: input.applicationId, userId: user.id },
      select: { id: true, opportunityId: true, _count: { select: { interviews: true } } },
    });
    if (!application) throw new NotFoundError("Application");

    const { startsAt, endsAt } = toInstants(input);
    const interview = await tx.interview.create({
      data: {
        userId: user.id,
        applicationId: application.id,
        title: input.title,
        type: input.type,
        roundNumber: input.roundNumber ?? application._count.interviews + 1,
        status: startsAt ? "SCHEDULED" : "UNSCHEDULED",
        startsAt,
        endsAt,
        timezone: input.timezone,
        mode: input.mode,
        meetingUrl: input.meetingUrl ?? null,
        location: input.location ?? null,
        interviewers: input.interviewers ?? null,
        prepNotes: input.prepNotes ?? null,
        reminderMinutesBefore: input.reminderMinutesBefore ?? preferences.interviewReminderMinutes,
      },
      select: { id: true },
    });
    await setContacts(tx, user.id, interview.id, input.contactIds);
    await recordActivity(tx, {
      userId: user.id,
      opportunityId: application.opportunityId,
      applicationId: application.id,
      type: "INTERVIEW_SCHEDULED",
      summary: startsAt
        ? `Scheduled ${input.title} for ${describeTime(startsAt, preferences.timezone)}`
        : `Added ${input.title} (time not set yet)`,
      details: {
        interviewId: interview.id,
        startsAt: startsAt?.toISOString() ?? null,
        timezone: input.timezone,
      },
    });
    await afterInterviewChange(tx, user.id, interview.id);
    return interview.id;
  });
}

type LoadedInterview = {
  id: string;
  title: string;
  status: InterviewStatus;
  startsAt: Date | null;
  endsAt: Date | null;
  timezone: string;
  scheduleRevision: number;
  applicationId: string;
  application: { opportunityId: string };
};

async function loadInterview(
  tx: TransactionClient,
  userId: string,
  interviewId: string,
): Promise<LoadedInterview> {
  const interview = await tx.interview.findFirst({
    where: { id: interviewId, userId },
    select: {
      id: true,
      title: true,
      status: true,
      startsAt: true,
      endsAt: true,
      timezone: true,
      scheduleRevision: true,
      applicationId: true,
      application: { select: { opportunityId: true } },
    },
  });
  if (!interview) throw new NotFoundError("Interview");
  return interview;
}

/**
 * Moves an interview to a new time, keeping the same record: logs the
 * previous and new schedule (reschedule history + activity event) and bumps
 * `scheduleRevision` so reminders for the old time become obsolete.
 */
async function rescheduleInTx(
  tx: TransactionClient,
  workspace: Workspace,
  interview: LoadedInterview,
  schedule: ScheduleInput,
  reason?: string,
): Promise<void> {
  if (interview.status === "COMPLETED") throw new DomainError("Completed interviews can't be rescheduled.");
  const { startsAt, endsAt } = toInstants(schedule);
  const unchanged =
    startsAt?.getTime() === interview.startsAt?.getTime() &&
    endsAt?.getTime() === interview.endsAt?.getTime() &&
    schedule.timezone === interview.timezone;
  if (unchanged) return;

  const status: InterviewStatus = !startsAt
    ? "UNSCHEDULED"
    : interview.status === "UNSCHEDULED"
      ? "SCHEDULED"
      : "RESCHEDULED";

  await tx.interviewReschedule.create({
    data: {
      userId: workspace.user.id,
      interviewId: interview.id,
      previousStartsAt: interview.startsAt,
      previousEndsAt: interview.endsAt,
      previousTimezone: interview.timezone,
      newStartsAt: startsAt,
      newEndsAt: endsAt,
      newTimezone: schedule.timezone,
      reason: reason ?? null,
    },
  });
  await tx.interview.update({
    where: { id: interview.id },
    data: {
      startsAt,
      endsAt,
      timezone: schedule.timezone,
      status,
      cancelledAt: null,
      scheduleRevision: { increment: 1 },
    },
  });
  const tz = workspace.preferences.timezone;
  await recordActivity(tx, {
    userId: workspace.user.id,
    opportunityId: interview.application.opportunityId,
    applicationId: interview.applicationId,
    type: "INTERVIEW_RESCHEDULED",
    summary: `Rescheduled ${interview.title} from ${describeTime(interview.startsAt, tz)} to ${describeTime(startsAt, tz)}`,
    details: {
      interviewId: interview.id,
      previousStartsAt: interview.startsAt?.toISOString() ?? null,
      previousTimezone: interview.timezone,
      newStartsAt: startsAt?.toISOString() ?? null,
      newTimezone: schedule.timezone,
      ...(reason ? { reason } : {}),
    },
  });
}

export async function rescheduleInterview(input: RescheduleInput): Promise<void> {
  const workspace = await requireWorkspace();
  await prisma.$transaction(async (tx) => {
    const interview = await loadInterview(tx, workspace.user.id, input.interviewId);
    await rescheduleInTx(tx, workspace, interview, input, input.reason);
    await afterInterviewChange(tx, workspace.user.id, interview.id);
  });
}

/** Edits interview details; a changed date/time goes through rescheduling. */
export async function updateInterview(input: UpdateInterviewInput): Promise<void> {
  const workspace = await requireWorkspace();
  const userId = workspace.user.id;
  await prisma.$transaction(async (tx) => {
    const interview = await loadInterview(tx, userId, input.interviewId);
    await tx.interview.update({
      where: { id: interview.id },
      data: {
        title: input.title,
        type: input.type,
        roundNumber: input.roundNumber ?? null,
        mode: input.mode,
        meetingUrl: input.meetingUrl ?? null,
        location: input.location ?? null,
        interviewers: input.interviewers ?? null,
        prepNotes: input.prepNotes ?? null,
        reminderMinutesBefore: input.reminderMinutesBefore ?? null,
      },
    });
    await setContacts(tx, userId, interview.id, input.contactIds);
    if (interview.status !== "COMPLETED") {
      await rescheduleInTx(
        tx,
        workspace,
        { ...interview, title: input.title },
        input,
        input.rescheduleReason,
      );
    }
    await recordActivity(tx, {
      userId,
      opportunityId: interview.application.opportunityId,
      applicationId: interview.applicationId,
      type: "INTERVIEW_UPDATED",
      summary: `Updated ${input.title} details`,
      details: { interviewId: interview.id },
    });
    await afterInterviewChange(tx, userId, interview.id);
  });
}

/**
 * Marks an interview as held. The result can stay pending/awaiting feedback;
 * it is independent of the application's stage and final outcome.
 */
export async function completeInterview(
  interviewId: string,
  result: InterviewResult,
  feedback?: string,
): Promise<void> {
  const workspace = await requireWorkspace();
  const { user, preferences } = workspace;
  await prisma.$transaction(async (tx) => {
    const interview = await loadInterview(tx, user.id, interviewId);
    if (interview.status === "COMPLETED") throw new DomainError("This interview is already completed.");
    await tx.interview.update({
      where: { id: interview.id },
      data: { status: "COMPLETED", completedAt: new Date(), result, feedback: feedback ?? undefined },
    });
    await recordActivity(tx, {
      userId: user.id,
      opportunityId: interview.application.opportunityId,
      applicationId: interview.applicationId,
      type: "INTERVIEW_COMPLETED",
      summary: `Completed ${interview.title} · ${INTERVIEW_RESULT_LABEL[result]}`,
      details: { interviewId: interview.id, result },
    });
    if (preferences.suggestFollowUps) {
      await suggestTask(
        tx,
        {
          userId: user.id,
          timezone: preferences.timezone,
          suggestFollowUps: true,
          followUpDays: preferences.followUpDays,
        },
        {
          opportunityId: interview.application.opportunityId,
          applicationId: interview.applicationId,
          interviewId: interview.id,
          title: `Send a thank-you note after ${interview.title}`,
          type: "FOLLOW_UP",
          dueDate: addDaysToDateOnly(todayInTimeZone(preferences.timezone), 1),
          reason: "interview_completed",
        },
      );
    }
    await afterInterviewChange(tx, user.id, interview.id);
  });
}

/** Records or updates the result (e.g. feedback arrived days later). */
export async function recordInterviewResult(
  interviewId: string,
  result: InterviewResult,
  feedback?: string,
): Promise<void> {
  const { user } = await requireWorkspace();
  await prisma.$transaction(async (tx) => {
    const interview = await loadInterview(tx, user.id, interviewId);
    await tx.interview.update({
      where: { id: interview.id },
      data: { result, feedback: feedback ?? undefined },
    });
    await recordActivity(tx, {
      userId: user.id,
      opportunityId: interview.application.opportunityId,
      applicationId: interview.applicationId,
      type: "INTERVIEW_RESULT_RECORDED",
      summary: `${interview.title}: ${INTERVIEW_RESULT_LABEL[result]}`,
      details: { interviewId: interview.id, result },
    });
    await afterInterviewChange(tx, user.id, interview.id);
  });
}

/** Cancels an interview. Cancellation never implies the candidate was rejected. */
export async function cancelInterview(interviewId: string, reason?: string): Promise<void> {
  const { user } = await requireWorkspace();
  await prisma.$transaction(async (tx) => {
    const interview = await loadInterview(tx, user.id, interviewId);
    if (interview.status === "CANCELLED") return;
    if (interview.status === "COMPLETED") throw new DomainError("Completed interviews can't be cancelled.");
    await tx.interview.update({
      where: { id: interview.id },
      data: { status: "CANCELLED", cancelledAt: new Date(), scheduleRevision: { increment: 1 } },
    });
    await recordActivity(tx, {
      userId: user.id,
      opportunityId: interview.application.opportunityId,
      applicationId: interview.applicationId,
      type: "INTERVIEW_CANCELLED",
      summary: `Cancelled ${interview.title}`,
      details: { interviewId: interview.id, ...(reason ? { reason } : {}) },
    });
    await afterInterviewChange(tx, user.id, interview.id);
  });
}

export async function deleteInterview(interviewId: string): Promise<void> {
  const { user } = await requireWorkspace();
  await prisma.$transaction(async (tx) => {
    const interview = await loadInterview(tx, user.id, interviewId);
    const tasks = await tx.task.findMany({
      where: { userId: user.id, interviewId: interview.id },
      select: { id: true },
    });
    await beforeSourcesDeleted(tx, user.id, {
      interviewIds: [interview.id],
      taskIds: tasks.map((task) => task.id),
    });
    await tx.interview.delete({ where: { id: interview.id } });
  });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export type InterviewDto = {
  id: string;
  applicationId: string;
  title: string;
  type: InterviewType;
  roundNumber: number | null;
  status: InterviewStatus;
  result: InterviewResult;
  startsAt: Date | null;
  endsAt: Date | null;
  timezone: string;
  mode: InterviewMode;
  meetingUrl: string | null;
  location: string | null;
  interviewers: string | null;
  prepNotes: string | null;
  feedback: string | null;
  reminderMinutesBefore: number | null;
  contacts: { id: string; name: string; title: string | null }[];
  reschedules: {
    id: string;
    previousStartsAt: Date | null;
    newStartsAt: Date | null;
    previousTimezone: string;
    newTimezone: string;
    reason: string | null;
    createdAt: Date;
  }[];
};

const interviewSelect = {
  id: true,
  applicationId: true,
  title: true,
  type: true,
  roundNumber: true,
  status: true,
  result: true,
  startsAt: true,
  endsAt: true,
  timezone: true,
  mode: true,
  meetingUrl: true,
  location: true,
  interviewers: true,
  prepNotes: true,
  feedback: true,
  reminderMinutesBefore: true,
  contacts: { select: { contact: { select: { id: true, name: true, title: true } } } },
  reschedules: {
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true,
      previousStartsAt: true,
      newStartsAt: true,
      previousTimezone: true,
      newTimezone: true,
      reason: true,
      createdAt: true,
    },
  },
} as const;

function toDto(
  row: {
    contacts: { contact: { id: string; name: string; title: string | null } }[];
  } & Omit<InterviewDto, "contacts">,
): InterviewDto {
  return { ...row, contacts: row.contacts.map(({ contact }) => contact) };
}

/** All rounds of one application, upcoming first, unscheduled last. */
export async function listApplicationInterviews(applicationId: string): Promise<InterviewDto[]> {
  const { user } = await requireWorkspace();
  const rows = await prisma.interview.findMany({
    where: { userId: user.id, applicationId },
    orderBy: [{ startsAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    select: interviewSelect,
  });
  return rows.map(toDto);
}

export type CalendarInterview = InterviewDto & { company: string; role: string };

/** Interviews starting within [start, end) for the calendar and agenda. */
export async function listInterviewsBetween(start: Date, end: Date): Promise<CalendarInterview[]> {
  const { user } = await requireWorkspace();
  const rows = await prisma.interview.findMany({
    where: { userId: user.id, startsAt: { gte: start, lt: end } },
    orderBy: { startsAt: "asc" },
    select: {
      ...interviewSelect,
      application: {
        select: { opportunity: { select: { title: true, company: { select: { name: true } } } } },
      },
    },
  });
  return rows.map(({ application, ...row }) => ({
    ...toDto(row),
    company: application.opportunity.company.name,
    role: application.opportunity.title,
  }));
}
