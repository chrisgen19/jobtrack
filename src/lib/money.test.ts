import { describe, expect, it } from "vitest";
import { formatSalaryRange, isSupportedCurrency, MONEY_PATTERN, normalizeMoneyInput } from "./money";

describe("money", () => {
  it("normalizes human input without float rounding", () => {
    expect(normalizeMoneyInput("120,000")).toBe("120000");
    expect(normalizeMoneyInput(" 95 000.50 ")).toBe("95000.50");
    expect(MONEY_PATTERN.test("95000.50")).toBe(true);
    expect(MONEY_PATTERN.test("95000.505")).toBe(false);
    expect(MONEY_PATTERN.test("-5")).toBe(false);
  });

  it("formats salary ranges per currency and period", () => {
    expect(formatSalaryRange({ min: "150000", max: "185000", currency: "PHP", period: "MONTHLY" })).toBe(
      "₱150K–185K/mo",
    );
    expect(formatSalaryRange({ min: "110000", max: null, currency: "AUD", period: "ANNUALLY" })).toBe(
      "From A$110K/yr",
    );
    expect(formatSalaryRange({ min: null, max: "42000", currency: "USD", period: "ANNUALLY" })).toBe(
      "Up to $42K/yr",
    );
    expect(formatSalaryRange({ min: null, max: null, currency: "USD", period: null })).toBe(
      "Salary not listed",
    );
  });

  it("validates ISO 4217 codes", () => {
    expect(isSupportedCurrency("PHP")).toBe(true);
    expect(isSupportedCurrency("AUD")).toBe(true);
    expect(isSupportedCurrency("XYZ")).toBe(false);
    expect(isSupportedCurrency("php")).toBe(false);
  });
});
