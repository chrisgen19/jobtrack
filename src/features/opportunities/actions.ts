"use server";

import { z } from "zod";
import { runAction, validationFailure, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { revalidateWorkspace } from "@/lib/revalidate";
import { uuid } from "@/lib/validations/common";
import { createOpportunity, deleteOpportunity, setOpportunityArchived, updateOpportunity } from "./data";
import { opportunitySchema, quickAddSchema } from "./schemas";

export async function createOpportunityAction(
  input: unknown,
): Promise<ActionResult<{ id: string; applicationId: string | null }>> {
  await requireUser();
  const parsed = quickAddSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const result = await runAction(() => createOpportunity(parsed.data));
  if (result.ok) revalidateWorkspace();
  return result;
}

export async function updateOpportunityAction(opportunityId: string, input: unknown): Promise<ActionResult> {
  await requireUser();
  const id = uuid.safeParse(opportunityId);
  const parsed = opportunitySchema.safeParse(input);
  if (!id.success) return validationFailure(id.error);
  if (!parsed.success) return validationFailure(parsed.error);
  const result = await runAction(() => updateOpportunity(id.data, parsed.data));
  if (result.ok) revalidateWorkspace();
  return result;
}

const archiveSchema = z.object({ opportunityId: uuid, archived: z.boolean() });

export async function setOpportunityArchivedAction(input: {
  opportunityId: string;
  archived: boolean;
}): Promise<ActionResult> {
  await requireUser();
  const parsed = archiveSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const result = await runAction(() =>
    setOpportunityArchived(parsed.data.opportunityId, parsed.data.archived),
  );
  if (result.ok) revalidateWorkspace();
  return result;
}

export async function deleteOpportunityAction(opportunityId: string): Promise<ActionResult> {
  await requireUser();
  const id = uuid.safeParse(opportunityId);
  if (!id.success) return validationFailure(id.error);
  const result = await runAction(() => deleteOpportunity(id.data));
  if (result.ok) revalidateWorkspace();
  return result;
}
