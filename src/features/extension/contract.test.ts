import { describe, expect, it } from "vitest";
import {
  EMPLOYMENT_TYPES,
  PRIORITIES,
  SALARY_PERIODS,
  WORK_ARRANGEMENTS,
} from "@jobtrack/shared/extension-api";
import { EmploymentType, Priority, SalaryPeriod, WorkArrangement } from "@/generated/prisma/enums";

describe("extension API contract", () => {
  it("keeps the shared enum copies in sync with Prisma", () => {
    expect([...WORK_ARRANGEMENTS].sort()).toEqual(Object.values(WorkArrangement).sort());
    expect([...EMPLOYMENT_TYPES].sort()).toEqual(Object.values(EmploymentType).sort());
    expect([...SALARY_PERIODS].sort()).toEqual(Object.values(SalaryPeriod).sort());
    expect([...PRIORITIES].sort()).toEqual(Object.values(Priority).sort());
  });
});
