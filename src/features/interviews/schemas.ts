import { z } from "zod";
import { InterviewMode, InterviewResult, InterviewType } from "@/generated/prisma/enums";
import {
  emptyToUndefined,
  optionalDateOnly,
  optionalInt,
  optionalText,
  optionalTimeOfDay,
  optionalUrl,
  requiredText,
  timeZone,
  uuid,
} from "@/lib/validations/common";

/** Date + start time + duration in an IANA timezone. All optional = time not set yet. */
const scheduleShape = {
  date: optionalDateOnly,
  startTime: optionalTimeOfDay,
  durationMinutes: optionalInt(5, 24 * 60),
  timezone: timeZone,
};

type ScheduleFields = { date?: string; startTime?: string };

function checkSchedule(values: ScheduleFields, ctx: z.RefinementCtx) {
  if (values.date && !values.startTime) {
    ctx.addIssue({ code: "custom", path: ["startTime"], message: "Add a start time, or clear the date." });
  }
  if (values.startTime && !values.date) {
    ctx.addIssue({ code: "custom", path: ["date"], message: "Add the interview date." });
  }
}

const detailShape = {
  title: requiredText("Interview title", 120),
  type: z.preprocess(emptyToUndefined, z.enum(InterviewType).default("OTHER")),
  roundNumber: optionalInt(1, 50),
  mode: z.preprocess(emptyToUndefined, z.enum(InterviewMode).default("VIDEO")),
  meetingUrl: optionalUrl,
  location: optionalText(200),
  interviewers: optionalText(300),
  prepNotes: optionalText(10_000),
  reminderMinutesBefore: optionalInt(0, 7 * 24 * 60),
  contactIds: z.array(uuid).max(20).default([]),
};

export const createInterviewSchema = z
  .object({ applicationId: uuid, ...detailShape, ...scheduleShape })
  .superRefine(checkSchedule);

export const updateInterviewSchema = z
  .object({ interviewId: uuid, ...detailShape, ...scheduleShape, rescheduleReason: optionalText(300) })
  .superRefine(checkSchedule);

export const rescheduleInterviewSchema = z
  .object({ interviewId: uuid, ...scheduleShape, reason: optionalText(300) })
  .superRefine((values, ctx) => {
    checkSchedule(values, ctx);
    if (!values.date) ctx.addIssue({ code: "custom", path: ["date"], message: "Choose the new date." });
  });

export const completeInterviewSchema = z.object({
  interviewId: uuid,
  result: z.enum(InterviewResult),
  feedback: optionalText(10_000),
});

export const recordResultSchema = completeInterviewSchema;

export const cancelInterviewSchema = z.object({ interviewId: uuid, reason: optionalText(300) });

export const interviewIdSchema = z.object({ interviewId: uuid });

export type CreateInterviewInput = z.output<typeof createInterviewSchema>;
export type UpdateInterviewInput = z.output<typeof updateInterviewSchema>;
export type RescheduleInput = z.output<typeof rescheduleInterviewSchema>;

/** Client form schema (IDs are added when calling the action). */
export const interviewFormSchema = z
  .object({ ...detailShape, ...scheduleShape, rescheduleReason: optionalText(300) })
  .superRefine(checkSchedule);

export type InterviewFormInput = z.input<typeof interviewFormSchema>;
export type InterviewFormOutput = z.output<typeof interviewFormSchema>;

export const REMINDER_OPTIONS = [
  { value: "", label: "No reminder" },
  { value: "15", label: "15 minutes before" },
  { value: "30", label: "30 minutes before" },
  { value: "60", label: "1 hour before" },
  { value: "120", label: "2 hours before" },
  { value: "1440", label: "1 day before" },
  { value: "2880", label: "2 days before" },
];

export const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 240].map((minutes) => ({
  value: String(minutes),
  label: minutes < 60 ? `${minutes} minutes` : `${minutes / 60} hour${minutes === 60 ? "" : "s"}`,
}));
