import { beforeEach, describe, expect, it, vi } from "vitest";
import * as duplicatesRoute from "@/app/api/opportunities/duplicates/route";
import { createOpportunity } from "@/features/opportunities/data";
import { quickAddSchema } from "@/features/opportunities/schemas";
import { completeOnboarding } from "@/features/workspace/data";
import { createTestUser, resetDatabase } from "../support/db";
import { signInAs, signOut } from "../support/session";

vi.mock("@/lib/auth/session", async () => (await import("../support/session")).sessionMock);

const APP_URL = "http://localhost:3100";

function duplicatesRequest(body: unknown, origin = APP_URL) {
  return new Request(`${APP_URL}/api/opportunities/duplicates`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body),
  });
}

async function onboardedUser(name: string) {
  const user = await createTestUser(name);
  signInAs(user);
  await completeOnboarding({ timezone: "Asia/Manila", currency: "PHP" });
  return user;
}

type Body = { candidates: { id: string; reason: string }[] };

describe("POST /api/opportunities/duplicates", () => {
  beforeEach(resetDatabase);

  it("finds the signed-in user's duplicates from a JSON body", async () => {
    await onboardedUser("Owner");
    const { id } = await createOpportunity(
      quickAddSchema.parse({
        title: "Data Analyst",
        companyName: "Umbrella",
        postingUrl: "https://example.com/jobs/7",
      }),
    );

    const response = await duplicatesRoute.POST(
      duplicatesRequest({ url: "https://example.com/jobs/7?ref=feed" }),
    );
    expect(response.status).toBe(200);
    expect(((await response.json()) as Body).candidates).toEqual([
      expect.objectContaining({ id, reason: "url" }),
    ]);

    const excluded = await duplicatesRoute.POST(
      duplicatesRequest({ url: "https://example.com/jobs/7", exclude: id }),
    );
    expect(((await excluded.json()) as Body).candidates).toHaveLength(0);
  });

  it("keeps results owner-scoped", async () => {
    await onboardedUser("Owner");
    await createOpportunity(quickAddSchema.parse({ title: "Data Analyst", companyName: "Umbrella" }));
    await onboardedUser("Other");
    const response = await duplicatesRoute.POST(
      duplicatesRequest({ title: "Data Analyst", company: "Umbrella" }),
    );
    expect(((await response.json()) as Body).candidates).toHaveLength(0);
  });

  it("rejects cross-site, signed-out, invalid and oversized requests", async () => {
    await onboardedUser("Owner");
    expect((await duplicatesRoute.POST(duplicatesRequest({}, "https://evil.example"))).status).toBe(403);
    expect((await duplicatesRoute.POST(duplicatesRequest({ exclude: "not-a-uuid" }))).status).toBe(400);
    expect((await duplicatesRoute.POST(duplicatesRequest({ url: "x".repeat(20_000) }))).status).toBe(413);
    signOut();
    expect((await duplicatesRoute.POST(duplicatesRequest({}))).status).toBe(401);
  });

  it("has no GET handler, so posting URLs never travel in the query string", () => {
    expect("GET" in duplicatesRoute).toBe(false);
  });
});
