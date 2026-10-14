"use server";

import { redirect } from "next/navigation";
import { fail, ok, validationFailure, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { errorMessage, logger } from "@/lib/logger";
import { revalidateWorkspace } from "@/lib/revalidate";
import { completeOnboarding, updateRegionalPreferences } from "./data";
import { onboardingSchema, regionalPreferencesSchema } from "./schemas";

export async function completeOnboardingAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const parsed = onboardingSchema.safeParse({
    timezone: formData.get("timezone"),
    currency: formData.get("currency"),
  });
  if (!parsed.success) return validationFailure(parsed.error);

  try {
    await completeOnboarding(parsed.data);
  } catch (error) {
    logger.error("onboarding failed", { error: errorMessage(error) });
    return fail("We could not finish setting up your workspace. Please try again.");
  }
  revalidateWorkspace();
  redirect("/dashboard");
}

export async function updateRegionalPreferencesAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const parsed = regionalPreferencesSchema.safeParse({
    timezone: formData.get("timezone"),
    currency: formData.get("currency"),
    weekStartsOn: formData.get("weekStartsOn"),
  });
  if (!parsed.success) return validationFailure(parsed.error);
  await updateRegionalPreferences(parsed.data);
  revalidateWorkspace();
  return ok();
}
