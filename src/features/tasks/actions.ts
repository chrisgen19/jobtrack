"use server";

import { z, type ZodError } from "zod";
import { runAction, validationFailure, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { revalidateWorkspace } from "@/lib/revalidate";
import { uuid } from "@/lib/validations/common";
import {
  acceptSuggestedTask,
  createTask,
  deleteTask,
  dismissTask,
  setTaskCompleted,
  updateTask,
} from "./data";
import { createTaskSchema, taskIdSchema, updateTaskSchema } from "./schemas";

async function act<T, R = void>(
  schema: { safeParse: (input: unknown) => { success: true; data: T } | { success: false; error: ZodError } },
  input: unknown,
  run: (data: T) => Promise<R>,
): Promise<ActionResult<R>> {
  await requireUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const result = await runAction(() => run(parsed.data));
  if (result.ok) revalidateWorkspace();
  return result;
}

const toggleSchema = z.object({ taskId: uuid, completed: z.boolean() });

export async function setTaskCompletedAction(input: {
  taskId: string;
  completed: boolean;
}): Promise<ActionResult> {
  return act(toggleSchema, input, (data) => setTaskCompleted(data.taskId, data.completed));
}

export async function createTaskAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return act(createTaskSchema, input, async (data) => ({ id: await createTask(data) }));
}

export async function updateTaskAction(input: unknown): Promise<ActionResult> {
  return act(updateTaskSchema, input, updateTask);
}

export async function acceptSuggestedTaskAction(input: unknown): Promise<ActionResult> {
  return act(taskIdSchema, input, (data) => acceptSuggestedTask(data.taskId));
}

export async function dismissTaskAction(input: unknown): Promise<ActionResult> {
  return act(taskIdSchema, input, (data) => dismissTask(data.taskId));
}

export async function deleteTaskAction(input: unknown): Promise<ActionResult> {
  return act(taskIdSchema, input, (data) => deleteTask(data.taskId));
}
