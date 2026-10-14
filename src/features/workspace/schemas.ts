import { z } from "zod";
import { currencyCode, timeZone } from "@/lib/validations/common";

export const onboardingSchema = z.object({ timezone: timeZone, currency: currencyCode });

export const regionalPreferencesSchema = z.object({
  timezone: timeZone,
  currency: currencyCode,
  weekStartsOn: z.coerce.number().int().min(0).max(1),
});

export type RegionalPreferencesInput = z.infer<typeof regionalPreferencesSchema>;
