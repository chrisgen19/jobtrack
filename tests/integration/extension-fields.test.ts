import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getMe } from "@/app/api/extension/v1/me/route";
import { POST as postOpportunity } from "@/app/api/extension/v1/opportunities/route";
import { issueExtensionToken } from "@/features/extension/tokens";
import { completeOnboarding } from "@/features/workspace/data";
import { prisma } from "@/lib/prisma";
import { createTestUser, resetDatabase } from "../support/db";
import { signInAs, signOut } from "../support/session";

vi.mock("@/lib/auth/session", async () => (await import("../support/session")).sessionMock);
vi.mock("@/lib/revalidate", () => ({ revalidateWorkspace: vi.fn() }));

const API = "http://localhost:3100/api/extension/v1";

async function connectedUser(name = "Tester") {
  const user = await createTestUser(name);
  signInAs(user);
  await completeOnboarding({ timezone: "Asia/Manila", currency: "PHP" });
  const { token } = await issueExtensionToken(user.id, "Chrome extension");
  signOut();
  return { user, token };
}

function save(token: string, body: unknown) {
  return postOpportunity(
    new Request(`${API}/opportunities`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

type Saved = { id: string; applicationId: string | null; contactId: string | null; taskId: string | null };

describe("extension save: v0.2 fields", () => {
  beforeEach(resetDatabase);

  it("stores skills, tags, deadline, reference code, salary basis and the company website", async () => {
    const { user, token } = await connectedUser();
    const response = await save(token, {
      title: "Frontend Engineer",
      companyName: "Globex",
      referenceCode: "R36786",
      salaryMin: "90000",
      salaryPeriod: "MONTHLY",
      salaryBasis: "GROSS",
      requiredSkills: ["React", "TypeScript", "React"],
      tags: ["remote-first"],
      deadline: "2026-11-15",
      companyWebsite: "https://globex.example",
    });
    expect(response.status).toBe(201);
    const saved = (await response.json()) as Saved;
    expect(saved).toMatchObject({ contactId: null, taskId: null });

    const job = await prisma.jobOpportunity.findUniqueOrThrow({
      where: { id: saved.id },
      include: { company: true, tags: { include: { tag: true } } },
    });
    expect(job).toMatchObject({
      referenceCode: "R36786",
      salaryBasis: "GROSS",
      requiredSkills: ["React", "TypeScript"],
      company: { website: "https://globex.example" },
    });
    expect(job.deadline?.toISOString().slice(0, 10)).toBe("2026-11-15");
    expect(job.tags.map((item) => item.tag.name)).toEqual(["remote-first"]);
    expect(job.userId).toBe(user.id);
  });

  it("still accepts a v0.1 draft, and never overwrites a company website", async () => {
    const { user, token } = await connectedUser();
    expect((await save(token, { title: "Analyst", companyName: "Initech" })).status).toBe(201);
    await prisma.company.updateMany({
      where: { userId: user.id },
      data: { website: "https://mine.example" },
    });
    await save(token, {
      title: "Analyst II",
      companyName: "Initech",
      companyWebsite: "https://other.example",
    });
    const company = await prisma.company.findFirstOrThrow({ where: { userId: user.id } });
    expect(company.website).toBe("https://mine.example");
  });

  it("adds the contact to the company and reuses it by LinkedIn profile, per user", async () => {
    const owner = await connectedUser("Owner");
    const other = await connectedUser("Other");
    const contact = {
      name: "Maria Santos",
      title: "Talent Acquisition",
      linkedinUrl: "https://www.linkedin.com/in/maria-santos",
    };
    const first = (await (
      await save(owner.token, { title: "A", companyName: "Acme", contact })
    ).json()) as Saved;
    const again = (await (
      await save(owner.token, {
        title: "B",
        companyName: "ACME",
        contact: { ...contact, name: "Maria S.", email: "maria@acme.example" },
      })
    ).json()) as Saved;
    const foreign = (await (
      await save(other.token, { title: "A", companyName: "Acme", contact })
    ).json()) as Saved;

    expect(again.contactId).toBe(first.contactId);
    expect(foreign.contactId).not.toBe(first.contactId);
    const row = await prisma.contact.findUniqueOrThrow({ where: { id: first.contactId! } });
    // The first name stays; the missing email is filled in.
    expect(row).toMatchObject({ name: "Maria Santos", email: "maria@acme.example", kind: "RECRUITER" });
    expect(await prisma.contact.count({ where: { userId: owner.user.id } })).toBe(1);
  });

  it("creates the to-do at 09:00 in the user's timezone with a reminder", async () => {
    const { token } = await connectedUser();
    const response = await save(token, {
      title: "Data Engineer",
      companyName: "Umbrella",
      followUp: { type: "APPLY", dueDate: "2099-03-10" },
    });
    expect(response.status).toBe(201);
    const saved = (await response.json()) as Saved;
    const task = await prisma.task.findUniqueOrThrow({ where: { id: saved.taskId! } });
    expect(task).toMatchObject({
      opportunityId: saved.id,
      applicationId: null,
      title: "Apply for Data Engineer at Umbrella",
      type: "APPLICATION",
      status: "OPEN",
      reminderMinutesBefore: 60,
    });
    expect(task.dueAt?.toISOString()).toBe("2099-03-10T01:00:00.000Z"); // 09:00 Asia/Manila
  });

  it("rejects a past to-do, or a to-do on an applied job, and saves nothing", async () => {
    const { token } = await connectedUser();
    const me = (await (
      await getMe(new Request(`${API}/me`, { headers: { authorization: `Bearer ${token}` } }))
    ).json()) as {
      stages: { id: string }[];
      followUpDays: number;
    };
    expect(me.followUpDays).toBe(7);

    const past = await save(token, {
      title: "Engineer",
      companyName: "Acme",
      followUp: { type: "FOLLOW_UP", dueDate: "2020-01-01" },
    });
    expect(past.status).toBe(422);

    const applied = await save(token, {
      title: "Engineer",
      companyName: "Acme",
      alreadyApplied: true,
      appliedOn: "2026-10-01",
      stageId: me.stages[0]!.id,
      followUp: { type: "FOLLOW_UP", dueDate: "2099-01-01" },
    });
    expect(applied.status).toBe(400);
    expect(((await applied.json()) as { fieldErrors: Record<string, unknown> }).fieldErrors).toHaveProperty(
      "followUp",
    );

    const badContact = await save(token, {
      title: "Engineer",
      companyName: "Acme",
      contact: { name: "Jo", email: "not-an-email" },
    });
    expect(badContact.status).toBe(400);
    // Nested errors keep their path, so the extension can mark the right field.
    expect(
      ((await badContact.json()) as { fieldErrors: Record<string, unknown> }).fieldErrors,
    ).toHaveProperty(["contact.email"]);
    expect(await prisma.jobOpportunity.count()).toBe(0);
    expect(await prisma.task.count()).toBe(0);
  });
});
