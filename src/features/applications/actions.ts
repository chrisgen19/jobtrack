"use server";

import { runAction, validationFailure, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { revalidateWorkspace } from "@/lib/revalidate";
import {
  addApplicationNote,
  applyToOpportunity,
  changeApplicationStage,
  closeApplication,
  deleteApplication,
  pauseApplication,
  recordEmployerResponse,
  reopenApplication,
  resumeApplication,
  updateApplicationDetails,
} from "./data";
import {
  applicationDetailsSchema,
  applicationIdSchema,
  applicationNoteSchema,
  applySchema,
  changeStageSchema,
  closeApplicationSchema,
  employerResponseSchema,
} from "./schemas";

/** Shared shape: authenticate, validate, run, refresh. */
async function act<T>(
  schema: {
    safeParse: (
      input: unknown,
    ) => { success: true; data: T } | { success: false; error: import("zod").ZodError };
  },
  input: unknown,
  run: (data: T) => Promise<unknown>,
): Promise<ActionResult> {
  await requireUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const result = await runAction(async () => {
    await run(parsed.data);
  });
  if (result.ok) revalidateWorkspace();
  return result;
}

export async function applyAction(input: unknown): Promise<ActionResult<{ applicationId: string }>> {
  await requireUser();
  const parsed = applySchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const result = await runAction(async () => ({ applicationId: await applyToOpportunity(parsed.data) }));
  if (result.ok) revalidateWorkspace();
  return result;
}

export async function changeStageAction(input: {
  applicationId: string;
  stageId: string;
}): Promise<ActionResult> {
  return act(changeStageSchema, input, (data) => changeApplicationStage(data.applicationId, data.stageId));
}

export async function pauseApplicationAction(input: { applicationId: string }): Promise<ActionResult> {
  return act(applicationIdSchema, input, (data) => pauseApplication(data.applicationId));
}

export async function resumeApplicationAction(input: { applicationId: string }): Promise<ActionResult> {
  return act(applicationIdSchema, input, (data) => resumeApplication(data.applicationId));
}

export async function closeApplicationAction(input: unknown): Promise<ActionResult> {
  return act(closeApplicationSchema, input, (data) =>
    closeApplication(data.applicationId, data.outcome, data.note),
  );
}

export async function reopenApplicationAction(input: { applicationId: string }): Promise<ActionResult> {
  return act(applicationIdSchema, input, (data) => reopenApplication(data.applicationId));
}

export async function recordEmployerResponseAction(input: unknown): Promise<ActionResult> {
  return act(employerResponseSchema, input, (data) =>
    recordEmployerResponse(data.applicationId, data.respondedOn),
  );
}

export async function updateApplicationDetailsAction(input: unknown): Promise<ActionResult> {
  return act(applicationDetailsSchema, input, (data) => updateApplicationDetails(data));
}

export async function addApplicationNoteAction(input: unknown): Promise<ActionResult> {
  return act(applicationNoteSchema, input, (data) => addApplicationNote(data.applicationId, data.note));
}

export async function deleteApplicationAction(input: {
  applicationId: string;
}): Promise<ActionResult<{ opportunityId: string }>> {
  await requireUser();
  const parsed = applicationIdSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const result = await runAction(async () => ({
    opportunityId: await deleteApplication(parsed.data.applicationId),
  }));
  if (result.ok) revalidateWorkspace();
  return result;
}
