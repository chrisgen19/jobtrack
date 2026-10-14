import "server-only";
import type { StageCategory } from "@/generated/prisma/enums";
import { changeStageInTx } from "@/features/applications/service";
import { requireWorkspace } from "@/features/workspace/data";
import { DomainError, NotFoundError } from "@/lib/action-result";
import { prisma } from "@/lib/prisma";
import { CATEGORY_COLOR } from "./defaults";
import type { AddStageInput } from "./schemas";

export type StageSettingsRow = {
  id: string;
  name: string;
  category: StageCategory;
  color: string | null;
  isActive: boolean;
  position: number;
  openApplications: number;
  totalApplications: number;
};

async function defaultPipelineId(userId: string): Promise<string> {
  const pipeline = await prisma.pipeline.findFirst({
    where: { userId, isDefault: true },
    select: { id: true },
  });
  if (!pipeline) throw new NotFoundError("Pipeline");
  return pipeline.id;
}

/** Stages of the default pipeline with how many applications use each. */
export async function getPipelineStages(): Promise<StageSettingsRow[]> {
  const { user } = await requireWorkspace();
  const pipelineId = await defaultPipelineId(user.id);
  const [stages, open] = await Promise.all([
    prisma.pipelineStage.findMany({
      where: { userId: user.id, pipelineId },
      orderBy: { position: "asc" },
      select: {
        id: true,
        name: true,
        category: true,
        color: true,
        isActive: true,
        position: true,
        _count: { select: { applications: true } },
      },
    }),
    prisma.application.groupBy({
      by: ["stageId"],
      where: { userId: user.id, pipelineId, status: { not: "CLOSED" } },
      _count: { _all: true },
    }),
  ]);
  return stages.map(({ _count, ...stage }) => ({
    ...stage,
    totalApplications: _count.applications,
    openApplications: open.find((row) => row.stageId === stage.id)?._count._all ?? 0,
  }));
}

export async function addStage(input: AddStageInput): Promise<void> {
  const { user } = await requireWorkspace();
  const pipelineId = await defaultPipelineId(user.id);
  const last = await prisma.pipelineStage.aggregate({
    where: { userId: user.id, pipelineId },
    _max: { position: true },
    _count: true,
  });
  if (last._count >= 30) throw new DomainError("A pipeline can have at most 30 stages.");
  await prisma.pipelineStage.create({
    data: {
      userId: user.id,
      pipelineId,
      name: input.name,
      category: input.category,
      color: input.color ?? CATEGORY_COLOR[input.category],
      position: (last._max.position ?? -1) + 1,
    },
  });
}

/** Renames/recolours a stage. Its category never changes (stable analytics). */
export async function updateStage(stageId: string, name: string, color: string): Promise<void> {
  const { user } = await requireWorkspace();
  const { count } = await prisma.pipelineStage.updateMany({
    where: { id: stageId, userId: user.id },
    data: { name, color },
  });
  if (count === 0) throw new NotFoundError("Stage");
}

/** Persists a new order. `stageIds` must list exactly the pipeline's stages. */
export async function reorderStages(stageIds: string[]): Promise<void> {
  const { user } = await requireWorkspace();
  const pipelineId = await defaultPipelineId(user.id);
  const existing = await prisma.pipelineStage.findMany({
    where: { userId: user.id, pipelineId },
    select: { id: true },
  });
  const known = new Set(existing.map((stage) => stage.id));
  if (
    stageIds.length !== known.size ||
    new Set(stageIds).size !== stageIds.length ||
    !stageIds.every((id) => known.has(id))
  ) {
    throw new DomainError("The stage list changed. Refresh and try again.");
  }
  await prisma.$transaction(
    stageIds.map((id, position) =>
      prisma.pipelineStage.updateMany({ where: { id, userId: user.id }, data: { position } }),
    ),
  );
}

/** Disables or re-enables a stage. Disabled stages keep their history. */
export async function setStageActive(stageId: string, isActive: boolean): Promise<void> {
  const { user } = await requireWorkspace();
  const stage = await prisma.pipelineStage.findFirst({
    where: { id: stageId, userId: user.id },
    select: { pipelineId: true },
  });
  if (!stage) throw new NotFoundError("Stage");
  if (!isActive) {
    const activeCount = await prisma.pipelineStage.count({
      where: { userId: user.id, pipelineId: stage.pipelineId, isActive: true },
    });
    if (activeCount <= 1) throw new DomainError("Keep at least one active stage.");
  }
  await prisma.pipelineStage.updateMany({ where: { id: stageId, userId: user.id }, data: { isActive } });
}

/**
 * Deletes a stage. When applications (open or closed) still reference it,
 * `moveToStageId` is required: open ones are moved with a logged stage
 * change, closed ones are re-pointed so history stays consistent. Activity
 * events keep the old stage name because they store snapshots.
 */
export async function deleteStage(stageId: string, moveToStageId?: string): Promise<void> {
  const { user } = await requireWorkspace();
  await prisma.$transaction(async (tx) => {
    const stage = await tx.pipelineStage.findFirst({
      where: { id: stageId, userId: user.id },
      select: { id: true, name: true, pipelineId: true, isActive: true },
    });
    if (!stage) throw new NotFoundError("Stage");

    const remainingActive = await tx.pipelineStage.count({
      where: { userId: user.id, pipelineId: stage.pipelineId, isActive: true, id: { not: stage.id } },
    });
    if (remainingActive === 0) throw new DomainError("Keep at least one active stage.");

    const inUse = await tx.application.findMany({
      where: { userId: user.id, stageId: stage.id },
      select: { id: true, status: true },
    });
    if (inUse.length > 0) {
      if (!moveToStageId || moveToStageId === stage.id) {
        throw new DomainError(
          `${inUse.length} application(s) use this stage. Choose a stage to move them to.`,
        );
      }
      const target = await tx.pipelineStage.findFirst({
        where: { id: moveToStageId, userId: user.id, pipelineId: stage.pipelineId, isActive: true },
        select: { id: true },
      });
      if (!target) throw new DomainError("Choose an active stage from the same pipeline.");
      for (const application of inUse) {
        if (application.status === "CLOSED") {
          await tx.application.update({ where: { id: application.id }, data: { stageId: target.id } });
        } else {
          await changeStageInTx(tx, user.id, application.id, target.id, {
            reason: `Stage "${stage.name}" was deleted`,
          });
        }
      }
    }
    await tx.pipelineStage.delete({ where: { id: stage.id } });

    const rest = await tx.pipelineStage.findMany({
      where: { userId: user.id, pipelineId: stage.pipelineId },
      orderBy: { position: "asc" },
      select: { id: true },
    });
    for (const [position, item] of rest.entries()) {
      await tx.pipelineStage.update({ where: { id: item.id }, data: { position } });
    }
  });
}
