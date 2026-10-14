import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { DEFAULT_PIPELINE_NAME, DEFAULT_STAGES } from "@/features/pipelines/defaults";
import { requireUser, type CurrentUser } from "@/lib/auth/session";
import { prisma, type DbClient } from "@/lib/prisma";

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
 * Creates the default pipeline and stages for a user if they have none.
 * Safe to call repeatedly (and concurrently: the partial unique index on
 * pipelines(user_id) WHERE is_default rejects a second default).
 */
export async function ensureDefaultPipeline(db: DbClient, userId: string): Promise<string> {
  const existing = await db.pipeline.findFirst({
    where: { userId, isDefault: true },
    select: { id: true },
  });
  if (existing) return existing.id;

  const pipeline = await db.pipeline.create({
    data: { userId, name: DEFAULT_PIPELINE_NAME, isDefault: true },
    select: { id: true },
  });
  await db.pipelineStage.createMany({
    data: DEFAULT_STAGES.map((stage, index) => ({
      userId,
      pipelineId: pipeline.id,
      name: stage.name,
      category: stage.category,
      color: stage.color,
      position: index,
    })),
  });
  return pipeline.id;
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
