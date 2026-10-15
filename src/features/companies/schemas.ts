import { z } from "zod";
import { optionalText, optionalUrl, requiredText } from "@/lib/validations/common";

export const companySchema = z.object({
  name: requiredText("Company name", 120),
  website: optionalUrl,
  location: optionalText(120),
  industry: optionalText(80),
  notes: optionalText(5_000),
});

export type CompanyInput = z.output<typeof companySchema>;
