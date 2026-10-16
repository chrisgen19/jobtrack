import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getMe } from "@/app/api/extension/v1/me/route";
import { GET as getDuplicates } from "@/app/api/extension/v1/opportunities/duplicates/route";
import { POST as postOpportunity } from "@/app/api/extension/v1/opportunities/route";
import { DELETE as deleteToken } from "@/app/api/extension/v1/token/route";
import { approveExtensionConnectAction, revokeExtensionTokenAction } from "@/features/extension/actions";
import { hashExtensionToken, issueExtensionToken, listExtensionTokens } from "@/features/extension/tokens";
import { getOpportunityDetail } from "@/features/opportunities/data";
import { completeOnboarding } from "@/features/workspace/data";
import { prisma } from "@/lib/prisma";
import { createTestUser, resetDatabase } from "../support/db";
import { signInAs, signOut } from "../support/session";

vi.mock("@/lib/auth/session", async () => (await import("../support/session")).sessionMock);
vi.mock("@/lib/revalidate", () => ({ revalidateWorkspace: vi.fn() }));

const API = "http://localhost:3100/api/extension/v1";
const EXTENSION_ID = "a".repeat(32);
const STATE = "state-nonce-0123456789";

async function onboardedUser(name = "Tester") {
  const user = await createTestUser(name);
  signInAs(user);
  await completeOnboarding({ timezone: "Asia/Manila", currency: "PHP" });
  return user;
}

/** An onboarded user with an extension token; the session is cleared afterwards. */
async function connectedUser(name = "Tester") {
  const user = await onboardedUser(name);
  const { id, token } = await issueExtensionToken(user.id, "Chrome extension");
  signOut();
  return { user, tokenId: id, token };
}

function request(path: string, token?: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);
  return new Request(`${API}${path}`, { ...init, headers });
}

function saveRequest(token: string, body: unknown) {
  return request("/opportunities", token, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function duplicatesRequest(token: string, query: Record<string, string>) {
  return request(`/opportunities/duplicates?${new URLSearchParams(query)}`, token);
}

describe("extension connect and tokens", () => {
  beforeEach(resetDatabase);

  it("issues a token only for allowlisted extension IDs and stores just its hash", async () => {
    await onboardedUser();
    const refused = await approveExtensionConnectAction({ ext: "b".repeat(32), state: STATE });
    expect(refused.ok).toBe(false);

    const approved = await approveExtensionConnectAction({ ext: EXTENSION_ID, state: STATE });
    if (!approved.ok) throw new Error(approved.error);
    expect(approved.data.token).toMatch(/^jt_ext_[A-Za-z0-9_-]{43}$/);

    const row = await prisma.extensionToken.findUniqueOrThrow({ where: { id: approved.data.tokenId } });
    expect(row.tokenHash).toBe(hashExtensionToken(approved.data.token));
    expect(JSON.stringify(row)).not.toContain(approved.data.token);
    expect(await listExtensionTokens()).toHaveLength(1);
  });

  it("rejects requests without a valid bearer token, even with a session", async () => {
    const { user } = await connectedUser();
    signInAs(user);
    expect((await getMe(request("/me"))).status).toBe(401);
    expect((await getMe(request("/me", "jt_ext_not-a-real-token"))).status).toBe(401);
    expect((await getMe(request("/me", `jt_ext_${"x".repeat(43)}`))).status).toBe(401);
  });

  it("stops accepting a token once it is revoked in Settings or by the extension", async () => {
    const { user, tokenId, token } = await connectedUser();
    const me = await getMe(request("/me", token));
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ user: { name: "Tester" }, currency: "PHP" });

    signInAs(user);
    expect((await revokeExtensionTokenAction(tokenId)).ok).toBe(true);
    expect((await getMe(request("/me", token))).status).toBe(401);

    const second = await issueExtensionToken(user.id, "Chrome extension");
    expect((await deleteToken(request("/token", second.token, { method: "DELETE" }))).status).toBe(204);
    expect((await getMe(request("/me", second.token))).status).toBe(401);
  });

  it("does not let one user revoke another user's token", async () => {
    const owner = await connectedUser("Owner");
    await onboardedUser("Intruder");
    expect((await revokeExtensionTokenAction(owner.tokenId)).ok).toBe(false);
    expect((await getMe(request("/me", owner.token))).status).toBe(200);
  });
});

describe("extension API", () => {
  beforeEach(resetDatabase);

  it("saves a reviewed job with an activity event", async () => {
    const { user, token } = await connectedUser();
    const response = await postOpportunity(
      saveRequest(token, {
        title: "Frontend Engineer",
        companyName: "Globex",
        postingUrl: "https://jobs.example.com/frontend-engineer?utm_source=x",
        source: "LinkedIn",
        workArrangement: "REMOTE",
        employmentType: "",
        salaryMin: "90000",
        salaryMax: "120000",
        salaryPeriod: "MONTHLY",
      }),
    );
    expect(response.status).toBe(201);
    const saved = (await response.json()) as { id: string; applicationId: string | null; url: string };
    expect(saved.applicationId).toBeNull();
    expect(saved.url).toBe(`http://localhost:3100/jobs/${saved.id}`);

    signInAs(user);
    expect(await getOpportunityDetail(saved.id)).toMatchObject({
      title: "Frontend Engineer",
      companyName: "Globex",
      workArrangement: "REMOTE",
      salary: { min: "90000", max: "120000", currency: "PHP", period: "MONTHLY" },
    });
    const events = await prisma.activityEvent.findMany({ where: { userId: user.id } });
    expect(events.map((event) => event.type)).toContain("OPPORTUNITY_SAVED");
  });

  it("records the application when the job was already applied to", async () => {
    const { user, token } = await connectedUser();
    const me = (await (await getMe(request("/me", token))).json()) as { stages: { id: string }[] };
    const response = await postOpportunity(
      saveRequest(token, {
        title: "Backend Engineer",
        companyName: "Initech",
        alreadyApplied: true,
        appliedOn: "2026-10-01",
        stageId: me.stages[0]!.id,
      }),
    );
    expect(response.status).toBe(201);
    const saved = (await response.json()) as { applicationId: string | null };
    expect(saved.applicationId).not.toBeNull();
    const application = await prisma.application.findUniqueOrThrow({ where: { id: saved.applicationId! } });
    expect(application.userId).toBe(user.id);
  });

  it("returns field errors for invalid drafts and refuses another user's stage", async () => {
    const { token } = await connectedUser("Owner");
    const missing = await postOpportunity(saveRequest(token, { title: "", companyName: "Acme" }));
    expect(missing.status).toBe(400);
    expect(((await missing.json()) as { fieldErrors: Record<string, unknown> }).fieldErrors).toHaveProperty(
      "title",
    );

    const other = await connectedUser("Other");
    const otherStages = (await (await getMe(request("/me", other.token))).json()) as {
      stages: { id: string }[];
    };
    const foreignStage = await postOpportunity(
      saveRequest(token, {
        title: "Engineer",
        companyName: "Acme",
        alreadyApplied: true,
        appliedOn: "2026-10-01",
        stageId: otherStages.stages[0]!.id,
      }),
    );
    expect(foreignStage.status).toBe(422);
    expect(await prisma.application.count()).toBe(0);
  });

  it("finds duplicates only among the token owner's jobs", async () => {
    const owner = await connectedUser("Owner");
    const other = await connectedUser("Other");
    const job = { title: "Data Analyst", companyName: "Umbrella", postingUrl: "https://example.com/jobs/42" };
    expect((await postOpportunity(saveRequest(owner.token, job))).status).toBe(201);

    const ownHits = await getDuplicates(
      duplicatesRequest(owner.token, { url: "https://example.com/jobs/42?ref=feed" }),
    );
    expect(((await ownHits.json()) as { candidates: unknown[] }).candidates).toHaveLength(1);

    const otherHits = await getDuplicates(
      duplicatesRequest(other.token, { url: job.postingUrl, title: job.title, company: job.companyName }),
    );
    expect(((await otherHits.json()) as { candidates: unknown[] }).candidates).toHaveLength(0);
  });

  it("rejects oversized bodies", async () => {
    const { token } = await connectedUser();
    const response = await postOpportunity(
      saveRequest(token, { title: "Engineer", companyName: "Acme", description: "x".repeat(120_000) }),
    );
    expect(response.status).toBe(413);
  });
});
