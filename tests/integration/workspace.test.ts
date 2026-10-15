import { beforeEach, describe, expect, it, vi } from "vitest";
import { completeOnboarding, requireWorkspace } from "@/features/workspace/data";
import { prisma } from "@/lib/prisma";
import { createTestUser, resetDatabase } from "../support/db";
import { signInAs } from "../support/session";

vi.mock("@/lib/auth/session", async () => (await import("../support/session")).sessionMock);

describe("onboarding", () => {
  beforeEach(resetDatabase);

  it("creates preferences and the six default stages in one idempotent step", async () => {
    const user = await createTestUser();
    signInAs(user);

    await expect(requireWorkspace()).rejects.toThrow(/NEXT_REDIRECT/);

    await completeOnboarding({ timezone: "Asia/Manila", currency: "PHP" });
    await completeOnboarding({ timezone: "Australia/Perth", currency: "AUD" });

    const pipelines = await prisma.pipeline.findMany({
      where: { userId: user.id },
      include: { stages: { orderBy: { position: "asc" } } },
    });
    expect(pipelines).toHaveLength(1);
    expect(pipelines[0]!.stages.map((stage) => stage.name)).toEqual([
      "Applied",
      "Recruiter Screening",
      "Assessment",
      "Technical Interview",
      "Final Interview",
      "Job Offer",
    ]);

    const workspace = await requireWorkspace();
    expect(workspace.preferences).toMatchObject({
      timezone: "Australia/Perth",
      currency: "AUD",
      emailReminders: false,
      inAppReminders: true,
    });
  });

  it("allows only one default pipeline per user (partial unique index)", async () => {
    const user = await createTestUser();
    signInAs(user);
    await completeOnboarding({ timezone: "UTC", currency: "USD" });
    await expect(
      prisma.pipeline.create({ data: { userId: user.id, name: "Second", isDefault: true } }),
    ).rejects.toThrow();
    await expect(
      prisma.pipeline.create({ data: { userId: user.id, name: "Extra", isDefault: false } }),
    ).resolves.toBeTruthy();
  });
});

describe("database tenancy constraints", () => {
  beforeEach(resetDatabase);

  it("rejects an opportunity that points at another user's company", async () => {
    const alice = await createTestUser("Alice");
    const bob = await createTestUser("Bob");
    const company = await prisma.company.create({
      data: { userId: alice.id, name: "Acme", normalizedName: "acme" },
    });

    await expect(
      prisma.jobOpportunity.create({ data: { userId: bob.id, companyId: company.id, title: "Engineer" } }),
    ).rejects.toThrow();
  });

  it("rejects an application whose stage belongs to a different pipeline or user", async () => {
    const alice = await createTestUser("Alice");
    const bob = await createTestUser("Bob");
    signInAs(alice);
    await completeOnboarding({ timezone: "UTC", currency: "USD" });
    signInAs(bob);
    await completeOnboarding({ timezone: "UTC", currency: "USD" });

    const bobCompany = await prisma.company.create({
      data: { userId: bob.id, name: "Beta", normalizedName: "beta" },
    });
    const bobJob = await prisma.jobOpportunity.create({
      data: { userId: bob.id, companyId: bobCompany.id, title: "Dev" },
    });
    const bobPipeline = await prisma.pipeline.findFirstOrThrow({ where: { userId: bob.id } });
    const aliceStage = await prisma.pipelineStage.findFirstOrThrow({ where: { userId: alice.id } });

    await expect(
      prisma.application.create({
        data: {
          userId: bob.id,
          opportunityId: bobJob.id,
          pipelineId: bobPipeline.id,
          stageId: aliceStage.id,
          attemptNumber: 1,
          appliedOn: new Date("2026-10-14T00:00:00Z"),
        },
      }),
    ).rejects.toThrow();
  });

  it("enforces the closed-application invariant with a CHECK constraint", async () => {
    const user = await createTestUser();
    signInAs(user);
    await completeOnboarding({ timezone: "UTC", currency: "USD" });
    const company = await prisma.company.create({
      data: { userId: user.id, name: "Acme", normalizedName: "acme" },
    });
    const job = await prisma.jobOpportunity.create({
      data: { userId: user.id, companyId: company.id, title: "Dev" },
    });
    const stage = await prisma.pipelineStage.findFirstOrThrow({ where: { userId: user.id } });

    await expect(
      prisma.application.create({
        data: {
          userId: user.id,
          opportunityId: job.id,
          pipelineId: stage.pipelineId,
          stageId: stage.id,
          attemptNumber: 1,
          appliedOn: new Date("2026-10-14T00:00:00Z"),
          status: "CLOSED",
        },
      }),
    ).rejects.toThrow();
  });
});
