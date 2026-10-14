import { z } from "zod";
import { isValidDateOnly, isValidTimeZone } from "@/lib/dates";
import { isSupportedCurrency, MONEY_PATTERN, normalizeMoneyInput } from "@/lib/money";

/**
 * Shared Zod building blocks for forms and Server Actions. Form values
 * arrive as strings; empty strings mean "not provided".
 */

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

/** Trimmed text that is optional; "" becomes undefined. */
export const optionalText = (max: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

export const requiredText = (label: string, max: number) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, { error: `${label} is required.` })
    .max(max, { error: `${label} must be at most ${max} characters.` });

export const uuid = z.uuid({ error: "Invalid identifier." });
export const optionalUuid = z.preprocess(emptyToUndefined, z.uuid().optional());

export const dateOnly = z.string().refine(isValidDateOnly, { error: "Use a valid date (YYYY-MM-DD)." });
export const optionalDateOnly = z.preprocess(emptyToUndefined, dateOnly.optional());

export const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: "Use a valid time (HH:mm)." });
export const optionalTimeOfDay = z.preprocess(emptyToUndefined, timeOfDay.optional());

export const timeZone = z.string().refine(isValidTimeZone, { error: "Choose a valid timezone." });

export const currencyCode = z
  .string()
  .trim()
  .toUpperCase()
  .refine(isSupportedCurrency, { error: "Choose a valid ISO 4217 currency." });

/** Decimal amount kept as a string (never a float). */
export const optionalMoney = z.preprocess(
  (value) => (typeof value === "string" ? emptyToUndefined(normalizeMoneyInput(value)) : value),
  z.string().regex(MONEY_PATTERN, { error: "Enter an amount like 120000 or 95000.50." }).optional(),
);

export const optionalUrl = z.preprocess(
  emptyToUndefined,
  z
    .url({ protocol: /^https?$/, error: "Enter a full http(s) URL." })
    .max(2048)
    .optional(),
);

export const optionalEmail = z.preprocess(
  emptyToUndefined,
  z.email({ error: "Enter a valid email." }).optional(),
);

/** Checkbox/switch values from FormData ("on", "true") -> boolean. */
export const formBoolean = z.preprocess(
  (value) => value === true || value === "on" || value === "true" || value === "1",
  z.boolean(),
);

export const optionalInt = (min: number, max: number) =>
  z.preprocess(emptyToUndefined, z.coerce.number().int().min(min).max(max).optional());

/** Comma or newline separated list -> unique trimmed strings. */
export const stringList = (maxItems: number, maxLength: number) =>
  z.preprocess(
    (value) => {
      if (Array.isArray(value)) return value;
      if (typeof value !== "string") return [];
      return value.split(/[,\n]/);
    },
    z
      .array(z.string().trim().max(maxLength))
      .transform((items) => [...new Set(items.filter(Boolean))])
      .refine((items) => items.length <= maxItems, { error: `At most ${maxItems} items.` }),
  );
