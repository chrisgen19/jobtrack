import { z } from "zod";
import { formBoolean } from "@/lib/validations/common";

export const notificationPreferencesSchema = z.object({
  inAppReminders: formBoolean,
  emailReminders: formBoolean,
  interviewReminderMinutes: z.coerce
    .number()
    .int()
    .min(0)
    .max(7 * 24 * 60),
  taskReminderMinutes: z.coerce
    .number()
    .int()
    .min(0)
    .max(7 * 24 * 60),
  offerDeadlineReminders: formBoolean,
  suggestFollowUps: formBoolean,
  followUpDays: z.coerce.number().int().min(1).max(60),
  calendarSyncTasks: formBoolean,
});

export type NotificationPreferencesInput = z.output<typeof notificationPreferencesSchema>;
