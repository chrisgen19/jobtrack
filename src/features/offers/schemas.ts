import { z } from "zod";
import { SalaryBasis, SalaryPeriod } from "@/generated/prisma/enums";
import {
  currencyCode,
  dateOnly,
  emptyToUndefined,
  optionalDateOnly,
  optionalMoney,
  optionalText,
  requiredText,
  uuid,
} from "@/lib/validations/common";

export const offerFormSchema = z.object({
  positionTitle: requiredText("Position", 160),
  baseSalary: optionalMoney,
  currency: currencyCode,
  salaryPeriod: z.preprocess(emptyToUndefined, z.enum(SalaryPeriod).default("ANNUALLY")),
  salaryBasis: z.preprocess(emptyToUndefined, z.enum(SalaryBasis).default("GROSS")),
  bonus: optionalText(500),
  equity: optionalText(500),
  benefits: optionalText(5_000),
  startDate: optionalDateOnly,
  decisionDeadline: optionalDateOnly,
  receivedOn: dateOnly,
  negotiationNotes: optionalText(5_000),
});

export const createOfferSchema = offerFormSchema.extend({ applicationId: uuid });

export const decideOfferSchema = z.object({ offerId: uuid, decision: z.enum(["ACCEPTED", "DECLINED"]) });

export const offerStatusSchema = z.object({
  offerId: uuid,
  status: z.enum(["RECEIVED", "NEGOTIATING", "EXPIRED", "RESCINDED"]),
});

export type OfferFormInput = z.input<typeof offerFormSchema>;
export type OfferFormOutput = z.output<typeof offerFormSchema>;
export type CreateOfferInput = z.output<typeof createOfferSchema>;
