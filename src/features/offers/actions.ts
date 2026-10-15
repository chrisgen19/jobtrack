"use server";

import { runAction, validationFailure, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { revalidateWorkspace } from "@/lib/revalidate";
import { createOffer, decideOffer, setOfferStatus } from "./data";
import { createOfferSchema, decideOfferSchema, offerStatusSchema } from "./schemas";

export async function createOfferAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireUser();
  const parsed = createOfferSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const result = await runAction(async () => ({ id: await createOffer(parsed.data) }));
  if (result.ok) revalidateWorkspace();
  return result;
}

export async function decideOfferAction(input: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = decideOfferSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const result = await runAction(() => decideOffer(parsed.data.offerId, parsed.data.decision));
  if (result.ok) revalidateWorkspace();
  return result;
}

export async function setOfferStatusAction(input: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = offerStatusSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const result = await runAction(() => setOfferStatus(parsed.data.offerId, parsed.data.status));
  if (result.ok) revalidateWorkspace();
  return result;
}
