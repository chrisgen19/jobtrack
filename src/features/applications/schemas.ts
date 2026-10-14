import { z } from "zod";
import { ApplicationMethod, ApplicationOutcome } from "@/generated/prisma/enums";
import {
  dateOnly,
  optionalEnum,
  optionalText,
  optionalUuid,
  requiredText,
  uuid,
} from "@/lib/validations/common";

export const applySchema = z.object({
  opportunityId: uuid,
  appliedOn: dateOnly,
  method: optionalEnum(ApplicationMethod),
  submittedVia: optionalText(80),
  stageId: optionalUuid,
  notes: optionalText(2_000),
});

export const changeStageSchema = z.object({ applicationId: uuid, stageId: uuid });

export const closeApplicationSchema = z.object({
  applicationId: uuid,
  outcome: z.enum(ApplicationOutcome, { error: "Choose how this application ended." }),
  note: optionalText(1_000),
});

export const applicationIdSchema = z.object({ applicationId: uuid });

export const applicationDetailsSchema = z.object({
  applicationId: uuid,
  appliedOn: dateOnly,
  method: optionalEnum(ApplicationMethod),
  submittedVia: optionalText(80),
  notes: optionalText(2_000),
});

export const employerResponseSchema = z.object({ applicationId: uuid, respondedOn: dateOnly });

export const applicationNoteSchema = z.object({ applicationId: uuid, note: requiredText("Note", 2_000) });

export type ApplyInput = z.output<typeof applySchema>;
export type ApplyFormValues = z.input<typeof applySchema>;
export type ApplicationDetailsInput = z.output<typeof applicationDetailsSchema>;
