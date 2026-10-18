import "server-only";
import type { ExtensionMe } from "@jobtrack/shared/extension-api";
import type { Workspace } from "@/features/workspace/data";
import { todayInTimeZone } from "@/lib/dates";
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
  };
}
