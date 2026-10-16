import { describe, expect, it } from "vitest";
import { activeNavItem, navPathname } from "./nav-items";

describe("nav items", () => {
  it("keeps the URL when the selected segment matches it", () => {
    expect(navPathname("/pipeline", "pipeline")).toBe("/pipeline");
    expect(navPathname("/jobs/123/edit", "jobs")).toBe("/jobs/123/edit");
    expect(navPathname("/settings/pipeline", "settings")).toBe("/settings/pipeline");
    expect(navPathname("/applications/abc", "applications")).toBe("/applications/abc");
  });

  it("uses the page underneath an intercepted route", () => {
    expect(navPathname("/applications/abc", "pipeline")).toBe("/pipeline");
    expect(activeNavItem(navPathname("/applications/abc", "pipeline"))?.name).toBe("Pipeline");
  });

  it("falls back to the URL without a usable segment", () => {
    expect(navPathname("/dashboard", null)).toBe("/dashboard");
    expect(navPathname("/dashboard", "(app)")).toBe("/dashboard");
  });

  it("maps routes without their own entry to a parent section", () => {
    expect(activeNavItem("/applications/abc")?.name).toBe("All Jobs");
    expect(activeNavItem("/notifications")?.name).toBe("Dashboard");
    expect(activeNavItem("/settings/pipeline")?.name).toBe("Settings");
    expect(activeNavItem("/extension/connect")?.name).toBe("Settings");
  });
});
