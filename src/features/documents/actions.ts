"use server";

import type { ZodError } from "zod";
import { runAction, validationFailure, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { revalidateWorkspace } from "@/lib/revalidate";
import { attachDocument, deleteDocument, detachDocument } from "./data";
import { attachDocumentSchema, deleteDocumentSchema, detachDocumentSchema } from "./schemas";

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

export async function attachDocumentAction(input: unknown): Promise<ActionResult> {
  return act(attachDocumentSchema, input, attachDocument);
}

export async function detachDocumentAction(input: unknown): Promise<ActionResult> {
  return act(detachDocumentSchema, input, (data) => detachDocument(data.applicationId, data.documentId));
}

export async function deleteDocumentAction(input: unknown): Promise<ActionResult> {
  return act(deleteDocumentSchema, input, (data) => deleteDocument(data.documentId));
}
