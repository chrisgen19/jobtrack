import { z } from "zod";
import { ContactKind } from "@/generated/prisma/enums";
import {
  emptyToUndefined,
  optionalEmail,
  optionalText,
  optionalUrl,
  requiredText,
  uuid,
} from "@/lib/validations/common";

export const contactSchema = z.object({
  companyName: requiredText("Company", 120),
  name: requiredText("Name", 120),
  title: optionalText(120),
  kind: z.preprocess(emptyToUndefined, z.enum(ContactKind).default("RECRUITER")),
  email: optionalEmail,
  phone: optionalText(40),
  linkedinUrl: optionalUrl,
  notes: optionalText(5_000),
});

export const updateContactSchema = contactSchema.extend({ contactId: uuid });
export const contactIdSchema = z.object({ contactId: uuid });

export type ContactInput = z.output<typeof contactSchema>;
