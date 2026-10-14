import { z } from "zod";
import { StageCategory } from "@/generated/prisma/enums";
import { optionalUuid, requiredText, uuid } from "@/lib/validations/common";

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: "Pick a colour." });

export const addStageSchema = z.object({
  name: requiredText("Stage name", 40),
  category: z.enum(StageCategory, { error: "Choose what kind of stage this is." }),
  color: color.optional(),
});

export const updateStageSchema = z.object({ stageId: uuid, name: requiredText("Stage name", 40), color });

export const reorderStagesSchema = z.object({ stageIds: z.array(uuid).min(1).max(50) });

export const stageActiveSchema = z.object({ stageId: uuid, isActive: z.boolean() });

export const deleteStageSchema = z.object({ stageId: uuid, moveToStageId: optionalUuid });

export type AddStageInput = z.output<typeof addStageSchema>;
