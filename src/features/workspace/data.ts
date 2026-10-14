import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { ensureDefaultPipeline } from "@/features/pipelines/create-default";
import { requireUser, type CurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export type WorkspacePreferences = {
  timezone: string;
  currency: string;
  weekStartsOn: number;
  inAppReminders: boolean;
  emailReminders: boolean;
  interviewReminderMinutes: number;
  taskReminderMinutes: number;
  offerDeadlineReminders: boolean;
  suggestFollowUps: boolean;
  followUpDays: number;
  calendarSyncTasks: boolean;
};

export type Workspace = { user: CurrentUser; preferences: WorkspacePreferences };

const preferenceSelect = {
  timezone: true,
  currency: true,
  weekStartsOn: true,
  inAppReminders: true,
  emailReminders: true,
  interviewReminderMinutes: true,
  taskReminderMinutes: true,
  offerDeadlineReminders: true,
  suggestFollowUps: true,
  followUpDays: true,
  calendarSyncTasks: true,
  onboardedAt: true,
} as const;

/**
 * Signed-in, onboarded user plus their preferences. Redirects to /login or
 * /onboarding when either is missing. Memoized per request.
 */
export const requireWorkspace = cache(async (): Promise<Workspace> => {
  const user = await requireUser();
  const preferences = await prisma.userPreferences.findUnique({
    where: { userId: user.id },
    select: preferenceSelect,
  });
  if (!preferences?.onboardedAt) redirect("/onboarding");
  const { onboardedAt: _onboardedAt, ...rest } = preferences;
  return { user, preferences: rest };
});

/** Whether the current user has finished onboarding (no redirect). */
export async function getOnboardingState(): Promise<{ user: CurrentUser; onboarded: boolean }> {
  const user = await requireUser();
  const preferences = await prisma.userPreferences.findUnique({
    where: { userId: user.id },
    select: { onboardedAt: true },
  });
  return { user, onboarded: Boolean(preferences?.onboardedAt) };
}

/**
 * Onboarding: saves timezone/currency and creates the default pipeline in
 * one transaction. Idempotent, so a failed or repeated submit can be retried.
 */
export async function completeOnboarding(input: { timezone: string; currency: string }): Promise<void> {
  const user = await requireUser();
  await prisma.$transaction(async (tx) => {
    await tx.userPreferences.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        timezone: input.timezone,
        currency: input.currency,
        onboardedAt: new Date(),
      },
      update: { timezone: input.timezone, currency: input.currency, onboardedAt: new Date() },
    });
    await ensureDefaultPipeline(tx, user.id);
  });
}

/** Updates timezone, currency and week start for the signed-in user. */
export async function updateRegionalPreferences(input: {
  timezone: string;
  currency: string;
  weekStartsOn: number;
}): Promise<void> {
  const { user } = await requireWorkspace();
  await prisma.userPreferences.update({ where: { userId: user.id }, data: input });
}
