/**
 * Money helpers. Amounts travel as decimal strings ("125000.00") between the
 * database (NUMERIC via Prisma Decimal), server and client, so no value is
 * ever rounded through a JS float before it is stored.
 */

export type SalaryPeriodValue = "HOURLY" | "DAILY" | "WEEKLY" | "MONTHLY" | "ANNUALLY";

export const PERIOD_SUFFIX: Record<SalaryPeriodValue, string> = {
  HOURLY: "/hr",
  DAILY: "/day",
  WEEKLY: "/wk",
  MONTHLY: "/mo",
  ANNUALLY: "/yr",
};

export const PERIOD_LABEL: Record<SalaryPeriodValue, string> = {
  HOURLY: "Per hour",
  DAILY: "Per day",
  WEEKLY: "Per week",
  MONTHLY: "Per month",
  ANNUALLY: "Per year",
};

/** Matches a non-negative amount with up to 12 integer and 2 decimal digits. */
export const MONEY_PATTERN = /^\d{1,12}(\.\d{1,2})?$/;

/** Normalizes user input like "120,000" or " 95000.5 " to "120000" / "95000.5". */
export function normalizeMoneyInput(value: string): string {
  return value.replace(/[,\s_]/g, "");
}

/** Prisma Decimal (or anything with toString) -> decimal string, or null. */
export function decimalToString(value: { toString(): string } | null | undefined): string | null {
  return value == null ? null : value.toString();
}

function currencySymbolFormatter(currency: string, compact: boolean): Intl.NumberFormat {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "symbol",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
    minimumFractionDigits: 0,
  });
}

/** Formats a decimal string as currency. Display only: never parse it back. */
export function formatMoney(amount: string, currency: string, options: { compact?: boolean } = {}): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return `${currency} ${amount}`;
  try {
    return currencySymbolFormatter(currency, options.compact ?? false).format(value);
  } catch {
    return `${currency} ${amount}`;
  }
}

/**
 * Human salary range such as "₱150K–185K/mo", "From A$110K/yr" or
 * "Salary not listed". Never compares or converts across currencies.
 */
export function formatSalaryRange(params: {
  min: string | null;
  max: string | null;
  currency: string | null;
  period: SalaryPeriodValue | null;
}): string {
  const { min, max, currency, period } = params;
  if (!min && !max) return "Salary not listed";
  const code = currency ?? "USD";
  const suffix = period ? PERIOD_SUFFIX[period] : "";
  const compact = (amount: string) => formatMoney(amount, code, { compact: true });
  if (min && max) {
    if (min === max) return `${compact(min)}${suffix}`;
    const maxLabel = compact(max).replace(/^[^\d]+/, "");
    return `${compact(min)}–${maxLabel}${suffix}`;
  }
  if (min) return `From ${compact(min)}${suffix}`;
  return `Up to ${compact(max!)}${suffix}`;
}

/** Common currencies offered first in pickers; any ISO 4217 code is accepted. */
export const COMMON_CURRENCIES = ["PHP", "AUD", "USD", "EUR", "GBP", "SGD", "CAD", "NZD", "JPY", "INR"];

export function supportedCurrencies(): string[] {
  return Intl.supportedValuesOf("currency");
}

export function isSupportedCurrency(code: string): boolean {
  return /^[A-Z]{3}$/.test(code) && supportedCurrencies().includes(code);
}
