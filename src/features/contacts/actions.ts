"use server";

import { runAction, validationFailure, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { revalidateWorkspace } from "@/lib/revalidate";
import { createContact, deleteContact, updateContact } from "./data";
import { contactIdSchema, contactSchema, updateContactSchema } from "./schemas";

export async function createContactAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireUser();
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const result = await runAction(async () => ({ id: await createContact(parsed.data) }));
  if (result.ok) revalidateWorkspace();
  return result;
}

export async function updateContactAction(input: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = updateContactSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const { contactId, ...rest } = parsed.data;
  const result = await runAction(() => updateContact(contactId, rest));
  if (result.ok) revalidateWorkspace();
  return result;
}

export async function deleteContactAction(input: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = contactIdSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const result = await runAction(() => deleteContact(parsed.data.contactId));
  if (result.ok) revalidateWorkspace();
  return result;
}
