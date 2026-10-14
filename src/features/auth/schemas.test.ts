import { describe, expect, it } from "vitest";
import { registerSchema, safeRedirectPath } from "./schemas";

describe("safeRedirectPath", () => {
  it("allows same-origin relative paths", () => {
    expect(safeRedirectPath("/jobs?view=board")).toBe("/jobs?view=board");
  });

  it("blocks open redirects", () => {
    expect(safeRedirectPath("//evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("https://evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("/\\evil.example")).toBe("/dashboard");
    expect(safeRedirectPath(null)).toBe("/dashboard");
  });
});

describe("registerSchema", () => {
  it("requires matching passwords of at least 10 characters", () => {
    const base = { name: "Ada", email: "ada@example.com" };
    expect(registerSchema.safeParse({ ...base, password: "short", confirmPassword: "short" }).success).toBe(
      false,
    );
    expect(
      registerSchema.safeParse({ ...base, password: "long-enough-1", confirmPassword: "different-1" })
        .success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({ ...base, password: "long-enough-1", confirmPassword: "long-enough-1" })
        .success,
    ).toBe(true);
  });
});
