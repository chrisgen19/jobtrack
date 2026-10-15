import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyToOpportunity,
  changeApplicationStage,
  closeApplication,
  getApplicationDetail,
  getBoard,
  listActivity,
  reopenApplication,
} from "@/features/applications/data";
import {
  createOpportunity,
  deleteOpportunity,
  findDuplicateCandidates,
  getOpportunityDetail,
  listOpportunities,
} from "@/features/opportunities/data";
import { quickAddSchema } from "@/features/opportunities/schemas";
import { deleteStage, getPipelineStages, updateStage } from "@/features/pipelines/data";
import { completeOnboarding } from "@/features/workspace/data";
import { prisma } from "@/lib/prisma";
import { createTestUser, resetDatabase } from "../support/db";
import { signInAs } from "../support/session";

vi.mock("@/lib/auth/session", async () => (await import("../support/session")).sessionMock);

async function onboardedUser(name = "Tester") {
  const user = await createTestUser(name);
  signInAs(user);
  await completeOnboarding({ timezone: "Asia/Manila", currency: "PHP" });
  return user;
}

function job(input: Record<string, unknown>) {
  return quickAddSchema.parse({ title: "Full-Stack Developer", companyName: "Acme Labs", ...input });
}

describe("opportunities and applications", () => {
  beforeEach(resetDatabase);

  it("saves a job with only title and company, then applies and reapplies", async () => {
    await onboardedUser();
    const { id, applicationId } = await createOpportunity(job({}));
    expect(applicationId).toBeNull();

    const saved = await getOpportunityDetail(id);
    expect(saved).toMatchObject({
      title: "Full-Stack Developer",
      companyName: "Acme Labs",
      applications: [],
    });

    const first = await applyToOpportunity({ opportunityId: id, appliedOn: "2026-01-10" });
    await closeApplication(first, "REJECTED");
    const second = await applyToOpportunity({ opportunityId: id, appliedOn: "2026-09-02" });

    const detail = await getOpportunityDetail(id);
    expect(
      detail!.applications.map((application) => [application.attemptNumber, application.status]),
    ).toEqual([
      [2, "ACTIVE"],
      [1, "CLOSED"],
    ]);
    expect(detail!.applications[0]!.id).toBe(second);
    expect(detail!.applications[1]!.appliedOn).toBe("2026-01-10");
  });

  it("stores salary as exact decimals and keeps the currency", async () => {
    await onboardedUser();
    const { id } = await createOpportunity(
      job({ salaryMin: "150,000.50", salaryMax: "185000", currency: "aud", salaryPeriod: "ANNUALLY" }),
    );
    const detail = await getOpportunityDetail(id);
    expect(detail!.salary).toEqual({ min: "150000.5", max: "185000", currency: "AUD", period: "ANNUALLY" });
  });

  it("creates the application and a suggested follow-up when saved as already applied", async () => {
    const user = await onboardedUser();
    const { id, applicationId } = await createOpportunity(
      job({ alreadyApplied: true, appliedOn: "2026-10-01" }),
    );
    expect(applicationId).not.toBeNull();

    const tasks = await prisma.task.findMany({ where: { userId: user.id } });
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      status: "SUGGESTED",
      type: "FOLLOW_UP",
      applicationId,
      opportunityId: id,
    });

    const events = await listActivity({ opportunityId: id });
    expect(events.map((event) => event.type).sort()).toEqual(["APPLICATION_SUBMITTED", "OPPORTUNITY_SAVED"]);
  });

  it("records stage changes atomically with name snapshots that survive renames", async () => {
    await onboardedUser();
    const { applicationId } = await createOpportunity(job({ alreadyApplied: true, appliedOn: "2026-10-01" }));
    const stages = await getPipelineStages();
    const technical = stages.find((stage) => stage.name === "Technical Interview")!;

    expect(await changeApplicationStage(applicationId!, technical.id)).toBe(true);
    expect(await changeApplicationStage(applicationId!, technical.id)).toBe(false);
    await updateStage(technical.id, "Tech Round", "#5da3a7");

    const events = await listActivity({ applicationId: applicationId! });
    const stageEvent = events.find((event) => event.type === "STAGE_CHANGED")!;
    expect(stageEvent.summary).toBe("Moved from Applied to Technical Interview");
    const detail = await getApplicationDetail(applicationId!);
    expect(detail!.stage.name).toBe("Tech Round");
  });

  it("requires an explicit outcome to close and clears it on reopen", async () => {
    await onboardedUser();
    const { applicationId } = await createOpportunity(job({ alreadyApplied: true, appliedOn: "2026-10-01" }));
    await closeApplication(applicationId!, "NO_RESPONSE");
    let detail = await getApplicationDetail(applicationId!);
    expect(detail).toMatchObject({ status: "CLOSED", outcome: "NO_RESPONSE" });
    expect(detail!.closedAt).not.toBeNull();

    await expect(changeApplicationStage(applicationId!, detail!.stages[1]!.id)).rejects.toThrow(/Reopen/);

    await reopenApplication(applicationId!);
    detail = await getApplicationDetail(applicationId!);
    expect(detail).toMatchObject({ status: "ACTIVE", outcome: null, closedAt: null });
  });

  it("refuses to delete an in-use stage without a target, then moves applications", async () => {
    await onboardedUser();
    const { applicationId } = await createOpportunity(job({ alreadyApplied: true, appliedOn: "2026-10-01" }));
    const [applied, screening] = await getPipelineStages();

    await expect(deleteStage(applied!.id)).rejects.toThrow(/Choose a stage/);
    await deleteStage(applied!.id, screening!.id);

    const detail = await getApplicationDetail(applicationId!);
    expect(detail!.stage.id).toBe(screening!.id);
    const events = await listActivity({ applicationId: applicationId! });
    expect(
      events.some((event) => event.type === "STAGE_CHANGED" && event.summary.includes("Recruiter Screening")),
    ).toBe(true);
    expect((await getPipelineStages()).map((stage) => stage.position)).toEqual([0, 1, 2, 3, 4]);
  });

  it("logs the move of a closed application when its stage is deleted, keeping it closed", async () => {
    await onboardedUser();
    const { applicationId } = await createOpportunity(job({ alreadyApplied: true, appliedOn: "2026-10-01" }));
    await closeApplication(applicationId!, "REJECTED");
    const [applied, screening] = await getPipelineStages();

    await deleteStage(applied!.id, screening!.id);

    const detail = await getApplicationDetail(applicationId!);
    expect(detail).toMatchObject({ status: "CLOSED", outcome: "REJECTED" });
    expect(detail!.stage.id).toBe(screening!.id);
    const events = await listActivity({ applicationId: applicationId! });
    expect(events.filter((event) => event.type === "STAGE_CHANGED").map((event) => event.summary)).toEqual([
      "Moved from Applied to Recruiter Screening",
    ]);
    // Users still have to reopen before moving it themselves.
    const other = (await getPipelineStages()).find((stage) => stage.id !== screening!.id)!;
    await expect(changeApplicationStage(applicationId!, other.id)).rejects.toThrow(/Reopen/);
  });

  it("warns about duplicates without blocking a second save", async () => {
    await onboardedUser();
    await createOpportunity(job({ postingUrl: "https://www.acme.test/jobs/123?utm=x" }));
    const second = await createOpportunity(job({}));
    const byUrl = await findDuplicateCandidates({ postingUrl: "https://acme.test/jobs/123/" });
    expect(byUrl).toHaveLength(1);
    const byTitle = await findDuplicateCandidates({
      title: "full-stack developer",
      companyName: " ACME labs ",
      excludeId: second.id,
    });
    expect(byTitle).toHaveLength(1);
  });

  it("filters the jobs list by view, stage and search", async () => {
    await onboardedUser();
    await createOpportunity(job({ title: "Saved Role" }));
    const { applicationId } = await createOpportunity(
      job({ title: "Applied Role", alreadyApplied: true, appliedOn: "2026-10-01" }),
    );
    const stages = await getPipelineStages();

    expect((await listOpportunities({ view: "saved" })).rows.map((row) => row.title)).toEqual(["Saved Role"]);
    expect((await listOpportunities({ view: "active" })).rows.map((row) => row.title)).toEqual([
      "Applied Role",
    ]);
    expect((await listOpportunities({ view: "all", stage: stages[0]!.id })).rows).toHaveLength(1);
    expect((await listOpportunities({ view: "all", q: "saved" })).rows).toHaveLength(1);

    await closeApplication(applicationId!, "WITHDRAWN");
    expect((await listOpportunities({ view: "closed" })).rows.map((row) => row.title)).toEqual([
      "Applied Role",
    ]);

    const board = await getBoard();
    expect(board.saved.map((card) => card.title)).toEqual(["Saved Role"]);
    expect(board.columns.flatMap((column) => column.cards)).toHaveLength(0);
  });
});

describe("cross-user isolation", () => {
  beforeEach(resetDatabase);

  it("never exposes or mutates another user's job or application", async () => {
    await onboardedUser("Alice");
    const { id, applicationId } = await createOpportunity(
      job({ alreadyApplied: true, appliedOn: "2026-10-01" }),
    );

    await onboardedUser("Bob");
    const bobStages = await getPipelineStages();

    expect(await getOpportunityDetail(id)).toBeNull();
    expect(await getApplicationDetail(applicationId!)).toBeNull();
    expect((await listOpportunities({ view: "all" })).rows).toHaveLength(0);
    expect(await listActivity({ opportunityId: id })).toHaveLength(0);
    await expect(changeApplicationStage(applicationId!, bobStages[1]!.id)).rejects.toThrow(/not found/i);
    await expect(applyToOpportunity({ opportunityId: id, appliedOn: "2026-10-02" })).rejects.toThrow(
      /not found/i,
    );
    await expect(closeApplication(applicationId!, "REJECTED")).rejects.toThrow(/not found/i);
    await expect(deleteOpportunity(id)).rejects.toThrow(/not found/i);
    expect(
      await findDuplicateCandidates({ title: "Full-Stack Developer", companyName: "Acme Labs" }),
    ).toHaveLength(0);

    expect(await prisma.application.count({ where: { id: applicationId!, status: "ACTIVE" } })).toBe(1);
  });

  it("cannot move an application into another user's stage", async () => {
    await onboardedUser("Alice");
    const { applicationId } = await createOpportunity(job({ alreadyApplied: true, appliedOn: "2026-10-01" }));
    await onboardedUser("Bob");
    const bobStage = (await getPipelineStages())[2]!;

    // Even with Alice's session, Bob's stage is rejected.
    const alice = await prisma.user.findFirstOrThrow({ where: { name: "Alice" } });
    signInAs(alice);
    await expect(changeApplicationStage(applicationId!, bobStage.id)).rejects.toThrow(
      /not part of this application's pipeline/,
    );
  });
});
