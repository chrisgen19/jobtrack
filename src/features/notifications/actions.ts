"use server";

import { z } from "zod";
import { runAction, validationFailure, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { revalidateWorkspace } from "@/lib/revalidate";
import { uuid } from "@/lib/validations/common";
import { markAllNotificationsRead, markNotificationRead, updateNotificationPreferences } from "./data";
import { notificationPreferencesSchema } from "./schemas";

const readSchema = z.object({ notificationId: uuid, read: z.boolean() });

export async function markNotificationReadAction(input: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = readSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  await markNotificationRead(parsed.data.notificationId, parsed.data.read);
  revalidateWorkspace();
  return { ok: true };
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  await requireUser();
  await markAllNotificationsRead();
  revalidateWorkspace();
  return { ok: true };
}

export async function updateNotificationPreferencesAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const parsed = notificationPreferencesSchema.safeParse({
    inAppReminders: formData.get("inAppReminders"),
    emailReminders: formData.get("emailReminders"),
    interviewReminderMinutes: formData.get("interviewReminderMinutes"),
    taskReminderMinutes: formData.get("taskReminderMinutes"),
    offerDeadlineReminders: formData.get("offerDeadlineReminders"),
    suggestFollowUps: formData.get("suggestFollowUps"),
    followUpDays: formData.get("followUpDays"),
    calendarSyncTasks: formData.get("calendarSyncTasks"),
  });
  if (!parsed.success) return validationFailure(parsed.error);
  const result = await runAction(() => updateNotificationPreferences(parsed.data));
  if (result.ok) revalidateWorkspace();
  return result;
}
