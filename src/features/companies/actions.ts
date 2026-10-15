"use server";

import { runAction, validationFailure, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { revalidateWorkspace } from "@/lib/revalidate";
import { uuid } from "@/lib/validations/common";
import { createCompany, deleteCompany, updateCompany } from "./data";
import { companySchema } from "./schemas";

export async function createCompanyAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireUser();
  const parsed = companySchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const result = await runAction(async () => ({ id: await createCompany(parsed.data) }));
  if (result.ok) revalidateWorkspace();
  return result;
}

export async function updateCompanyAction(companyId: string, input: unknown): Promise<ActionResult> {
  await requireUser();
  const id = uuid.safeParse(companyId);
  const parsed = companySchema.safeParse(input);
  if (!id.success) return validationFailure(id.error);
  if (!parsed.success) return validationFailure(parsed.error);
  const result = await runAction(() => updateCompany(id.data, parsed.data));
  if (result.ok) revalidateWorkspace();
  return result;
}

export async function deleteCompanyAction(companyId: string): Promise<ActionResult> {
  await requireUser();
  const id = uuid.safeParse(companyId);
  if (!id.success) return validationFailure(id.error);
  const result = await runAction(() => deleteCompany(id.data));
  if (result.ok) revalidateWorkspace();
  return result;
}
