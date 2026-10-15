"use server";

import type { ZodError } from "zod";
import { runAction, validationFailure, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { revalidateWorkspace } from "@/lib/revalidate";
import { addStage, deleteStage, reorderStages, setStageActive, updateStage } from "./data";
import {
  addStageSchema,
  deleteStageSchema,
  reorderStagesSchema,
  stageActiveSchema,
  updateStageSchema,
} from "./schemas";

async function act<T>(
  schema: { safeParse: (input: unknown) => { success: true; data: T } | { success: false; error: ZodError } },
  input: unknown,
  run: (data: T) => Promise<void>,
): Promise<ActionResult> {
  await requireUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const result = await runAction(() => run(parsed.data));
  if (result.ok) revalidateWorkspace();
  return result;
}

export async function addStageAction(input: unknown): Promise<ActionResult> {
  return act(addStageSchema, input, addStage);
}

export async function updateStageAction(input: unknown): Promise<ActionResult> {
  return act(updateStageSchema, input, (data) => updateStage(data.stageId, data.name, data.color));
}

export async function reorderStagesAction(input: unknown): Promise<ActionResult> {
  return act(reorderStagesSchema, input, (data) => reorderStages(data.stageIds));
}

export async function setStageActiveAction(input: unknown): Promise<ActionResult> {
  return act(stageActiveSchema, input, (data) => setStageActive(data.stageId, data.isActive));
}

export async function deleteStageAction(input: unknown): Promise<ActionResult> {
  return act(deleteStageSchema, input, (data) => deleteStage(data.stageId, data.moveToStageId));
}
