import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as postExtract } from "@/app/api/extension/v1/extract/route";
import { GET as getMe } from "@/app/api/extension/v1/me/route";
import type { AiExtraction } from "@/features/extension/ai/prompt";
import { updateAiSuggestionsAction } from "@/features/extension/actions";
import { issueExtensionToken } from "@/features/extension/tokens";
import { completeOnboarding } from "@/features/workspace/data";
import * as ai from "@/lib/integrations/anthropic/client";
import { prisma } from "@/lib/prisma";
import { createTestUser, resetDatabase } from "../support/db";
import { signInAs, signOut } from "../support/session";

vi.mock("@/lib/auth/session", async () => (await import("../support/session")).sessionMock);
vi.mock("@/lib/revalidate", () => ({ revalidateWorkspace: vi.fn() }));
vi.mock("@/lib/integrations/anthropic/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/integrations/anthropic/client")>();
  return { ...actual, aiSettings: vi.fn(), isAiConfigured: vi.fn(), requestJobExtraction: vi.fn() };
});

const API = "http://localhost:3100/api/extension/v1";
const SECRET_PHRASE = "unicorn-payroll-confidential";
const POSTING = `We are hiring a backend developer (${SECRET_PHRASE}). ${"Own our billing APIs and reporting. ".repeat(8)}`;

const settings = {
  apiKey: "test-key",
  model: "claude-haiku-5-5",
  dailyRequestsPerUser: 3,
  monthlyRequestLimit: 100,
  timeoutMs: 20_000,
};
const answer: AiExtraction = {
  title: "Backend Developer",
  companyName: "Acme",
  location: "Pasig, Metro Manila",
  workArrangement: "HYBRID",
  employmentType: "FULL_TIME",
  salaryMin: 50000,
  salaryMax: 65000,
  currency: "PHP",
  salaryPeriod: "MONTHLY",
  salaryBasis: null,
  requiredSkills: ["Go", "PostgreSQL"],
  deadline: null,
  referenceCode: null,
  companyWebsite: null,
  contactName: "Maria Santos",
  contactTitle: null,
  contactEmail: "not-an-email",
  contactLinkedinUrl: null,
};

async function connectedUser({ optIn = true } = {}) {
  const user = await createTestUser("Tester");
  signInAs(user);
  await completeOnboarding({ timezone: "Asia/Manila", currency: "PHP" });
  if (optIn) {
    const form = new FormData();
    form.set("aiSuggestions", "on");
    expect((await updateAiSuggestionsAction(null, form)).ok).toBe(true);
  }
  const { token } = await issueExtensionToken(user.id, "Chrome extension");
  signOut();
  return { user, token };
}

function extract(token: string, body: Record<string, unknown>) {
  return postExtract(
    new Request(`${API}/extract`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ postingUrl: "https://careers.acme.test/jobs/1", text: POSTING, ...body }),
    }),
  );
}

const model = vi.mocked(ai.requestJobExtraction);
const usage = (userId: string) => prisma.aiUsage.findFirst({ where: { userId } });

describe("extension: Improve with AI", () => {
  beforeEach(async () => {
    await resetDatabase();
    vi.mocked(ai.aiSettings).mockReturnValue(settings);
    vi.mocked(ai.isAiConfigured).mockReturnValue(true);
    model
      .mockReset()
      .mockResolvedValue({ output: answer, stopReason: "end_turn", inputTokens: 1200, outputTokens: 180 });
  });
  afterEach(() => vi.restoreAllMocks());

  it("is off without an AI key, and needs the user's opt-in", async () => {
    vi.mocked(ai.aiSettings).mockReturnValue(null);
    vi.mocked(ai.isAiConfigured).mockReturnValue(false);
    const { token } = await connectedUser();
    expect((await extract(token, {})).status).toBe(503);
    const me = await (
      await getMe(new Request(`${API}/me`, { headers: { authorization: `Bearer ${token}` } }))
    ).json();
    expect(me.features).toEqual({ ai: { available: false, enabled: false } });

    vi.mocked(ai.aiSettings).mockReturnValue(settings);
    const notOptedIn = await connectedUser({ optIn: false });
    expect((await extract(notOptedIn.token, {})).status).toBe(403);
    expect(model).not.toHaveBeenCalled();
  });

  it("returns checked suggestions for the missing fields only and records usage", async () => {
    const { user, token } = await connectedUser();
    const consent = await prisma.userPreferences.findUniqueOrThrow({ where: { userId: user.id } });
    expect(consent).toMatchObject({ aiSuggestions: true });
    expect(consent.aiConsentAt).toBeInstanceOf(Date);

    const response = await extract(token, { filledFields: ["title", "companyName"] });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      cached: false,
      remainingToday: 2,
      suggestions: {
        location: "Pasig, Metro Manila",
        workArrangement: "HYBRID",
        employmentType: "FULL_TIME",
        salaryMin: "50000",
        salaryMax: "65000",
        currency: "PHP",
        salaryPeriod: "MONTHLY",
        requiredSkills: ["Go", "PostgreSQL"],
        contactName: "Maria Santos", // the invalid email is dropped, the name kept
      },
    });
    // The posting text reaches the model wrapped as data.
    expect(model.mock.calls[0]![0]).toContain(`<page_text>\nWe are hiring`);
    expect(await usage(user.id)).toMatchObject({ requests: 1, inputTokens: 1200, outputTokens: 180 });
  });

  it("serves the same posting from the cache without using the quota or the model", async () => {
    const { user, token } = await connectedUser();
    await extract(token, {});
    const again = await (await extract(token, { filledFields: ["salaryMin"] })).json();
    expect(again.cached).toBe(true);
    expect(again.suggestions).not.toHaveProperty("currency"); // a filled amount drops the AI's whole salary
    expect(model).toHaveBeenCalledTimes(1);
    expect((await usage(user.id))?.requests).toBe(1);
    const cache = await prisma.aiExtractionCache.findFirstOrThrow({ where: { userId: user.id } });
    expect(JSON.stringify(cache)).not.toContain(SECRET_PHRASE);
  });

  it("asks again for a different page title, and drops a cached deadline that has passed", async () => {
    const { user, token } = await connectedUser();
    await extract(token, { pageTitle: "Backend Developer | Acme" });
    const retitled = await (await extract(token, { pageTitle: "Senior Backend Developer" })).json();
    expect(retitled.cached).toBe(false);
    expect(model).toHaveBeenCalledTimes(2);

    // Cache rows whose "apply by tomorrow" deadline is now in the past.
    for (const row of await prisma.aiExtractionCache.findMany({ where: { userId: user.id } })) {
      const result = { ...(row.result as object), deadline: "2000-01-01" };
      await prisma.aiExtractionCache.update({ where: { id: row.id }, data: { result } });
    }
    const again = await (await extract(token, { pageTitle: "Senior Backend Developer" })).json();
    expect(again.cached).toBe(true);
    expect(again.suggestions).toMatchObject({ title: "Backend Developer" });
    expect(again.suggestions).not.toHaveProperty("deadline");
  });

  it("stops at the daily and monthly limits", async () => {
    vi.mocked(ai.aiSettings).mockReturnValue({ ...settings, dailyRequestsPerUser: 1 });
    const { token } = await connectedUser();
    expect((await extract(token, {})).status).toBe(200);
    expect((await extract(token, { text: `${POSTING} Second posting.` })).status).toBe(429);

    vi.mocked(ai.aiSettings).mockReturnValue({ ...settings, monthlyRequestLimit: 1 });
    const other = await connectedUser();
    expect((await extract(other.token, {})).status).toBe(503);
    expect(model).toHaveBeenCalledTimes(1);
  });

  it("gives the request back on a provider error, and counts a refusal", async () => {
    const { user, token } = await connectedUser();
    model.mockRejectedValueOnce(new ai.AiProviderError("busy", "overloaded"));
    expect((await extract(token, {})).status).toBe(503);
    expect((await usage(user.id))?.requests).toBe(0);

    model.mockResolvedValueOnce({ output: null, stopReason: "refusal", inputTokens: 900, outputTokens: 5 });
    expect((await extract(token, {})).status).toBe(422);
    expect((await usage(user.id))?.requests).toBe(1);
  });

  it("rejects short text and never logs the posting", async () => {
    const { token } = await connectedUser();
    const written: string[] = [];
    for (const stream of [process.stdout, process.stderr]) {
      vi.spyOn(stream, "write").mockImplementation((chunk: string | Uint8Array) => {
        written.push(String(chunk));
        return true;
      });
    }
    expect((await extract(token, { text: "Too short." })).status).toBe(400);
    model.mockRejectedValueOnce(new ai.AiProviderError("config", "invalid x-api-key"));
    await extract(token, {});
    await extract(token, {});
    expect(written.join("")).not.toContain(SECRET_PHRASE);
    expect(written.join("")).toContain("ai suggestions: answered");
  });
});
