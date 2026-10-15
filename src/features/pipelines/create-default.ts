import type { DbClient } from "@/lib/prisma";
import { DEFAULT_PIPELINE_NAME, DEFAULT_STAGES } from "./defaults";

/**
 * Creates the default pipeline and stages for a user if they have none.
 * Safe to call repeatedly (and concurrently: the partial unique index on
 * pipelines(user_id) WHERE is_default rejects a second default). Shared by
 * onboarding and the demo seed, so it must not import `server-only`.
 */
export async function ensureDefaultPipeline(db: DbClient, userId: string): Promise<string> {
  const existing = await db.pipeline.findFirst({ where: { userId, isDefault: true }, select: { id: true } });
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
