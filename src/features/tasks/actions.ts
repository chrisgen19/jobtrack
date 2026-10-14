"use server";

import { z } from "zod";
import { runAction, validationFailure, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { revalidateWorkspace } from "@/lib/revalidate";
import { uuid } from "@/lib/validations/common";
import { setTaskCompleted } from "./data";

const toggleSchema = z.object({ taskId: uuid, completed: z.boolean() });

export async function setTaskCompletedAction(input: {
  taskId: string;
  completed: boolean;
}): Promise<ActionResult> {
  await requireUser();
  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const result = await runAction(() => setTaskCompleted(parsed.data.taskId, parsed.data.completed));
  if (result.ok) revalidateWorkspace();
  return result;
}
