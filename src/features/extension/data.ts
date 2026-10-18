import "server-only";
import type { ExtensionMe } from "@jobtrack/shared/extension-api";
import { requireWorkspace, type Workspace } from "@/features/workspace/data";
import { todayInTimeZone } from "@/lib/dates";
import { isAiConfigured } from "@/lib/integrations/gemini/client";
import { prisma } from "@/lib/prisma";

/** Profile, defaults and active default-pipeline stages for the extension popup. */
export async function getExtensionProfile({ user, preferences }: Workspace): Promise<ExtensionMe> {
  const stages = await prisma.pipelineStage.findMany({
    where: { userId: user.id, isActive: true, pipeline: { isDefault: true } },
    orderBy: { position: "asc" },
    select: { id: true, name: true },
  });
  return {
    user: { name: user.name, email: user.email },
    currency: preferences.currency,
    today: todayInTimeZone(preferences.timezone),
    stages,
    followUpDays: preferences.followUpDays,
    features: { ai: { available: isAiConfigured(), enabled: isAiConfigured() && preferences.aiSuggestions } },
  };
}

/**
 * Turns "Improve with AI" on or off for the signed-in user. Turning it on
 * records when they consented to sending posting text to Google (Gemini).
 */
export async function setAiSuggestions(enabled: boolean): Promise<void> {
  const { user } = await requireWorkspace();
  await prisma.userPreferences.update({
    where: { userId: user.id },
    data: { aiSuggestions: enabled, ...(enabled ? { aiConsentAt: new Date() } : {}) },
  });
}
