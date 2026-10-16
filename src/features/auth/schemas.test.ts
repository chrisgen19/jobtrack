import { describe, expect, it } from "vitest";
import { registerSchema, safeRedirectPath } from "./schemas";

describe("safeRedirectPath", () => {
  it("allows same-origin relative paths", () => {
    expect(safeRedirectPath("/jobs?view=board")).toBe("/jobs?view=board");
    expect(safeRedirectPath("/applications/0199?tab=interviews#next")).toBe(
      "/applications/0199?tab=interviews#next",
    );
    expect(safeRedirectPath("/jobs?q=full%20stack")).toBe("/jobs?q=full%20stack");
  });

  it("blocks open redirects", () => {
    expect(safeRedirectPath("//evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("https://evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("/\\evil.example")).toBe("/dashboard");
    expect(safeRedirectPath(null)).toBe("/dashboard");
  });

  it("blocks tab, newline and carriage return tricks that browsers strip", () => {
    expect(safeRedirectPath("/\t/evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("/\n/evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("/\r/evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("/\r\n/evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("/\r\\evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("/jobs\\..\\..\\evil.example")).toBe("/dashboard");
  });

  it("never returns a value that resolves to another origin", () => {
    const attempts = ["/\t/evil.example", "/\n\n/evil.example", "/ /evil.example", "/%2F/evil.example"];
    for (const attempt of attempts) {
      const result = safeRedirectPath(attempt);
      expect(new URL(result, "https://jobs.cgdev.site").origin).toBe("https://jobs.cgdev.site");
    }
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
