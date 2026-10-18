import { describe, expect, it } from "vitest";
import { findSalaryInText, parseSalary } from "./salary";

// Labels as shown on SEEK, JobStreet and LinkedIn job cards (October 2026).
const CASES: [string, string, Partial<ReturnType<typeof parseSalary>>][] = [
  ["ph.jobstreet.com", "₱40,000 – ₱60,000 per month", { min: "40000", max: "60000", currency: "PHP", period: "MONTHLY" }],
  ["ph.jobstreet.com", "Php80k - Php90k", { min: "80000", max: "90000", currency: "PHP", period: "MONTHLY", periodGuessed: true }],
  ["ph.jobstreet.com", "PHP 25,000 - 30,000 monthly", { min: "25000", max: "30000", currency: "PHP", period: "MONTHLY" }],
  ["my.jobstreet.com", "RM 4,000 – RM 4,400 per month", { min: "4000", max: "4400", currency: "MYR", period: "MONTHLY" }],
  ["sg.jobstreet.com", "$3,500 – $5,000 per month", { min: "3500", max: "5000", currency: "SGD", period: "MONTHLY" }],
  ["sg.jobstreet.com", "SGD 6500 - 11000 per month", { min: "6500", max: "11000", currency: "SGD", period: "MONTHLY" }],
  ["au.seek.com", "$75,000 – $95,000 per year", { min: "75000", max: "95000", currency: "AUD", period: "ANNUALLY" }],
  ["au.seek.com", "$80,000 per year", { min: "80000", max: "", currency: "AUD", period: "ANNUALLY" }],
  ["au.seek.com", "$40 – $55 per hour", { min: "40", max: "55", period: "HOURLY", periodGuessed: false }],
  ["au.seek.com", "Salary starting from $ 116,981.00 to $129,492.00", { min: "116981", max: "129492", period: "ANNUALLY", periodGuessed: true }],
  ["au.seek.com", "Up to $95000 Plus Super", { min: "", max: "95000", currency: "AUD", period: "ANNUALLY" }],
  ["nz.seek.com", "$110,000 per annum", { min: "110000", currency: "NZD", period: "ANNUALLY" }],
  ["nz.seek.com", "NZD 100,000–120,000 per year", { min: "100000", max: "120000", currency: "NZD" }],
  ["nz.seek.com", "$85k - $100k p.a.", { min: "85000", max: "100000", period: "ANNUALLY", periodGuessed: false }],
  ["nz.seek.com", "$84,027-$113,683+ kiwisaver", { min: "84027", max: "113683", currency: "NZD" }],
  ["nz.seek.com", "$75 – $100 per hour depending on experience", { min: "75", max: "100", period: "HOURLY" }],
  ["www.linkedin.com", "$120K/yr - $150K/yr", { min: "120000", max: "150000", currency: "", period: "ANNUALLY" }],
  ["www.linkedin.com", "$85-100k", { min: "85000", max: "100000", period: "ANNUALLY", periodGuessed: true }],
  ["www.onlinejobs.ph", "$5/hr", { min: "5", currency: "", period: "HOURLY", periodGuessed: false }],
  ["www.onlinejobs.ph", "5", { min: "5", period: "HOURLY", periodGuessed: true }],
  ["boards.greenhouse.io", "€60,000 - €75,000", { min: "60000", max: "75000", currency: "EUR", period: "ANNUALLY" }],
  ["example.com", "£400 a day", { min: "400", currency: "GBP", period: "DAILY" }],
  ["example.com", "P35,000 per month", { currency: "PHP", min: "35000" }],
];

describe("parseSalary", () => {
  it.each(CASES)("%s: %s", (host, text, expected) => {
    expect(parseSalary(text, { host })).toMatchObject(expected!);
  });

  it("returns null without an amount", () => {
    expect(parseSalary("Salary + Super", { host: "au.seek.com" })).toBeNull();
    expect(parseSalary("Top $'s Paid !  Contract Extensions likely !")).toBeNull();
    expect(parseSalary("Free Parking + Annual Bonus + Global Organisation!")).toBeNull();
  });

  it("keeps a lowercase p before a number out of the currency", () => {
    expect(parseSalary("up to 5 p 40,000")?.currency).toBe("");
  });
});

describe("findSalaryInText", () => {
  it("reads the pay line and skips other numbers", () => {
    const text = [
      "We raised $20M in funding and have 5+ years of growth.",
      "Requirements: 3 years per year of hiring experience",
      "Salary: ₱50,000 - ₱65,000 per month plus HMO",
    ].join("\n");
    expect(findSalaryInText(text)).toMatchObject({ min: "50000", max: "65000", currency: "PHP" });
  });

  it("ignores hours lines and text without pay wording", () => {
    expect(findSalaryInText("Pay attention: 40 hours per week")).toBeNull();
    expect(findSalaryInText("We have 120 engineers in 3 offices.")).toBeNull();
  });
});
