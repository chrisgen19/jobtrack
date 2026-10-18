import type { SalaryPeriod } from "@jobtrack/shared/extension-api";

export type ParsedSalary = {
  min: string;
  max: string;
  /** ISO code, or "" when the text doesn't say (the server then uses the user's default). */
  currency: string;
  period: SalaryPeriod | "";
  /** The period was inferred from the amount, not stated. */
  periodGuessed: boolean;
};

// Longest tokens first so "S$" wins over "$" and "PHP" over "P".
const CURRENCY_TOKENS: [RegExp, string][] = [
  [/\b(?:a|au)\$|\baud\b/i, "AUD"],
  [/\bnz\$|\bnzd\b/i, "NZD"],
  [/\bs\$|\bsgd\b/i, "SGD"],
  [/\bhk\$|\bhkd\b/i, "HKD"],
  [/\bus\$|\busd\b/i, "USD"],
  [/\bc\$|\bcad\b/i, "CAD"],
  // Case-sensitive: "P40,000" is pesos, a lowercase "p" before a digit is not.
  [/₱|\b[Pp][Hh][Pp]|\bP(?=\s?\d)/, "PHP"],
  [/\brm(?=\s?\d)|\bmyr\b/i, "MYR"],
  [/฿|\bthb\b/i, "THB"],
  [/\bidr\b|\brp\.?(?=\s?\d)/i, "IDR"],
  [/₹|\binr\b/i, "INR"],
  [/€|\beur\b/i, "EUR"],
  [/£|\bgbp\b/i, "GBP"],
];

/** Hostname suffix -> currency of a bare "$" on that site. */
const DOLLAR_BY_HOST: [string, string][] = [
  ["au.seek.com", "AUD"],
  ["seek.com.au", "AUD"],
  ["nz.seek.com", "NZD"],
  ["seek.co.nz", "NZD"],
  ["sg.jobstreet.com", "SGD"],
  ["hk.jobsdb.com", "HKD"],
  ["au.indeed.com", "AUD"],
  ["nz.indeed.com", "NZD"],
  ["sg.indeed.com", "SGD"],
  ["ca.indeed.com", "CAD"],
  ["www.indeed.com", "USD"],
  ["indeed.com", "USD"],
];

const PERIOD_PATTERNS: [RegExp, SalaryPeriod][] = [
  [/\b(?:per|an?|\/)\s*(?:hour|hr)s?\b|\bhourly\b|\bp\/h\b/i, "HOURLY"],
  [/\b(?:per|an?|\/)\s*day\b|\bdaily\b/i, "DAILY"],
  [/\b(?:per|an?|\/)\s*(?:week|wk)\b|\bweekly\b/i, "WEEKLY"],
  [/\b(?:per|an?|\/)\s*(?:month|mo|mth)\b|\bmonthly\b/i, "MONTHLY"],
  [/\b(?:per|an?|\/)\s*(?:year|yr|annum)\b|\bp\.a\.?|\bannual(?:ly)?\b|\byearly\b/i, "ANNUALLY"],
];

/** Highest amount still read as monthly when the text names no period. */
const MONTHLY_CEILING: Record<string, number> = {
  PHP: 300_000,
  MYR: 30_000,
  SGD: 25_000,
  HKD: 150_000,
  THB: 300_000,
  IDR: 100_000_000,
  INR: 500_000,
};

const AMOUNT = /(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s*(k|m)?(?![a-z\d])/gi;

function currencyOf(text: string, host: string): string {
  for (const [pattern, code] of CURRENCY_TOKENS) if (pattern.test(text)) return code;
  if (!text.includes("$")) return "";
  return DOLLAR_BY_HOST.find(([suffix]) => host === suffix || host.endsWith(`.${suffix}`))?.[1] ?? "";
}

function amountsOf(text: string): number[] {
  const found = [...text.matchAll(AMOUNT)].slice(0, 2).map((match) => ({
    value: Number(`${match[1]!.replace(/,/g, "")}${match[2] ?? ""}`),
    unit: match[3]?.toLowerCase(),
  }));
  // "$85-100k": the multiplier on the second amount applies to the first too.
  const unit = found.find((amount) => amount.unit)?.unit;
  const scale = (amount: { value: number; unit?: string }) => {
    const applied = amount.unit ?? (unit && amount.value < 1000 ? unit : undefined);
    return amount.value * (applied === "k" ? 1_000 : applied === "m" ? 1_000_000 : 1);
  };
  return found.map(scale).filter((value) => Number.isFinite(value) && value > 0);
}

/** Pay period for an amount when the text doesn't state one (a guess the user should check). */
function guessPeriod(amount: number, currency: string): SalaryPeriod {
  if (amount <= 500) return "HOURLY";
  const ceiling = MONTHLY_CEILING[currency];
  if (ceiling !== undefined) return amount <= ceiling ? "MONTHLY" : "ANNUALLY";
  return amount < 20_000 ? "MONTHLY" : "ANNUALLY";
}

const asString = (value: number | undefined): string => (value === undefined ? "" : String(value));

/**
 * Reads a salary like "₱40,000 - ₱60,000 per month" (en dash ranges too), "$85k - $100k p.a.",
 * "Up to $95000 Plus Super" or "RM 4,000 - RM 4,400 per month". A bare "$"
 * takes its currency from the site (SEEK AU means AUD). Returns null when
 * the text has no amount.
 */
export function parseSalary(text: string, context: { host?: string } = {}): ParsedSalary | null {
  const normalized = text
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00a0/g, " ")
    .slice(0, 300);
  const amounts = amountsOf(normalized);
  if (!amounts.length) return null;

  const upTo = /\bup\s+to\b|\bmax(?:imum)?\b/i.test(normalized) && amounts.length === 1;
  const [first, second] = amounts as [number, number | undefined];
  const low = upTo ? undefined : first;
  const high = upTo ? first : second !== undefined && second > first ? second : undefined;
  const currency = currencyOf(normalized, context.host?.toLowerCase() ?? "");
  const stated = PERIOD_PATTERNS.find(([pattern]) => pattern.test(normalized))?.[1];
  return {
    min: asString(low),
    max: asString(high),
    currency,
    period: stated ?? guessPeriod(high ?? first, currency),
    periodGuessed: !stated,
  };
}

const SALARY_LINE = /salary|compensation|pay\s*(?:range|rate)?\b|wage|remuneration|package/i;

/**
 * The first salary stated in free text, from a line that mentions pay and
 * names a currency or period ("5+ years" and "$2M funding" lines are
 * skipped). Everything found this way is a guess.
 */
export function findSalaryInText(text: string, context: { host?: string } = {}): ParsedSalary | null {
  for (const line of text.split("\n").slice(0, 400)) {
    if (line.length > 300 || !SALARY_LINE.test(line)) continue;
    const salary = parseSalary(line, context);
    if (!salary) continue;
    if (salary.currency || line.includes("$")) return salary;
    if (!salary.periodGuessed && !/\bhours?\s+(?:per|a)\b/i.test(line)) return salary;
  }
  return null;
}
