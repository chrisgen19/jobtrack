import { z } from "zod";
import { contactSchema } from "@/features/contacts/schemas";
import { checkQuickAdd, quickAddShape } from "@/features/opportunities/schemas";
import { dateOnly, optionalText, optionalUrl } from "@/lib/validations/common";

/**
 * What the extension may save: everything Quick Add accepts, plus the
 * company's website, a contact named on the posting and a to-do (apply by,
 * or follow up) for a job not applied to yet.
 */
export const extensionSaveSchema = z
  .object({
    ...quickAddShape,
    companyWebsite: optionalUrl,
    contact: contactSchema.omit({ companyName: true }).optional(),
    followUp: z
      .object({
        type: z.enum(["APPLY", "FOLLOW_UP"]),
        dueDate: dateOnly,
        title: optionalText(200),
      })
      .optional(),
  })
  .superRefine((values, ctx) => {
    checkQuickAdd(values, ctx);
    // Applying already adds the follow-up suggestion from Settings.
    if (values.followUp && values.alreadyApplied) {
      ctx.addIssue({
        code: "custom",
        path: ["followUp"],
        message: "A to-do can only be added to a job you haven't applied to yet.",
      });
    }
  });

export type ExtensionSaveInput = z.output<typeof extensionSaveSchema>;
