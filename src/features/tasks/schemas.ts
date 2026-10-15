import { z } from "zod";
import { Priority, TaskType } from "@/generated/prisma/enums";
import {
  emptyToUndefined,
  optionalDateOnly,
  optionalInt,
  optionalText,
  optionalTimeOfDay,
  optionalUuid,
  requiredText,
  uuid,
} from "@/lib/validations/common";

const taskShape = {
  title: requiredText("Task title", 200),
  description: optionalText(5_000),
  type: z.preprocess(emptyToUndefined, z.enum(TaskType).default("OTHER")),
  priority: z.preprocess(emptyToUndefined, z.enum(Priority).default("MEDIUM")),
  dueDate: optionalDateOnly,
  dueTime: optionalTimeOfDay,
  applicationId: optionalUuid,
  opportunityId: optionalUuid,
  reminderMinutesBefore: optionalInt(0, 7 * 24 * 60),
};

export const createTaskSchema = z.object(taskShape).superRefine((values, ctx) => {
  if (values.dueTime && !values.dueDate) {
    ctx.addIssue({ code: "custom", path: ["dueDate"], message: "Add a due date for this time." });
  }
});

export const updateTaskSchema = z.object({ taskId: uuid, ...taskShape }).superRefine((values, ctx) => {
  if (values.dueTime && !values.dueDate) {
    ctx.addIssue({ code: "custom", path: ["dueDate"], message: "Add a due date for this time." });
  }
});

export const taskIdSchema = z.object({ taskId: uuid });

export type CreateTaskInput = z.output<typeof createTaskSchema>;
export type UpdateTaskInput = z.output<typeof updateTaskSchema>;
export type TaskFormValues = z.input<typeof createTaskSchema>;

/** Default time of day for date-only due dates (user's timezone). */
export const DEFAULT_DUE_TIME = "09:00";
