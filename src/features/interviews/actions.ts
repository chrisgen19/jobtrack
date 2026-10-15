"use server";

import type { ZodError } from "zod";
import { runAction, validationFailure, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { revalidateWorkspace } from "@/lib/revalidate";
import {
  cancelInterview,
  completeInterview,
  createInterview,
  deleteInterview,
  recordInterviewResult,
  rescheduleInterview,
  updateInterview,
} from "./data";
import {
  cancelInterviewSchema,
  completeInterviewSchema,
  createInterviewSchema,
  interviewIdSchema,
  recordResultSchema,
  rescheduleInterviewSchema,
  updateInterviewSchema,
} from "./schemas";

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

export async function createInterviewAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return act(createInterviewSchema, input, async (data) => ({ id: await createInterview(data) }));
}

export async function updateInterviewAction(input: unknown): Promise<ActionResult> {
  return act(updateInterviewSchema, input, updateInterview);
}

export async function rescheduleInterviewAction(input: unknown): Promise<ActionResult> {
  return act(rescheduleInterviewSchema, input, rescheduleInterview);
}

export async function completeInterviewAction(input: unknown): Promise<ActionResult> {
  return act(completeInterviewSchema, input, (data) =>
    completeInterview(data.interviewId, data.result, data.feedback),
  );
}

export async function recordInterviewResultAction(input: unknown): Promise<ActionResult> {
  return act(recordResultSchema, input, (data) =>
    recordInterviewResult(data.interviewId, data.result, data.feedback),
  );
}

export async function cancelInterviewAction(input: unknown): Promise<ActionResult> {
  return act(cancelInterviewSchema, input, (data) => cancelInterview(data.interviewId, data.reason));
}

export async function deleteInterviewAction(input: unknown): Promise<ActionResult> {
  return act(interviewIdSchema, input, (data) => deleteInterview(data.interviewId));
}
