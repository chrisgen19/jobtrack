import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { beforeAccountDelete } from "@/features/account/deletion";
import { getAnalytics } from "@/features/analytics/data";
import { getApplicationDetail, listActivity, recordEmployerResponse } from "@/features/applications/data";
import {
  createContact,
  deleteContact,
  listCompanyContacts,
  listContacts,
  updateContact,
} from "@/features/contacts/data";
import { contactSchema } from "@/features/contacts/schemas";
import {
  attachDocument,
  deleteDocument,
  detachDocument,
  getDocumentForDownload,
  listApplicationDocuments,
  listDocumentFamilies,
  uploadDocument,
} from "@/features/documents/data";
import { getWorkspaceExport } from "@/features/export/data";
import { createInterview } from "@/features/interviews/data";
import { createInterviewSchema } from "@/features/interviews/schemas";
import { createOffer, decideOffer, listApplicationOffers } from "@/features/offers/data";
import { createOfferSchema } from "@/features/offers/schemas";
import { createOpportunity } from "@/features/opportunities/data";
import { quickAddSchema } from "@/features/opportunities/schemas";
import { completeOnboarding, updateRegionalPreferences } from "@/features/workspace/data";
import { setStorageForTests } from "@/lib/integrations/storage";
import { MAX_STORAGE_KEYS_PER_JOB } from "@/lib/jobs/types";
import { deleteUserFilesTask } from "@/worker/tasks/delete-user-files";
import { prisma } from "@/lib/prisma";
import { createTestUser, resetDatabase } from "../support/db";
import { createMemoryStorage } from "../support/memory-storage";
import { signInAs } from "../support/session";

vi.mock("@/lib/auth/session", async () => (await import("../support/session")).sessionMock);

const storage = createMemoryStorage();
setStorageForTests(storage);
afterAll(() => setStorageForTests(undefined));

const PDF = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF");

async function setup(name = "Tester", company = "Acme") {
  const user = await createTestUser(name);
  signInAs(user);
  await completeOnboarding({ timezone: "Asia/Manila", currency: "PHP" });
  const { applicationId } = await createOpportunity(
    quickAddSchema.parse({
      title: "Full-Stack Developer",
      companyName: company,
      alreadyApplied: true,
      appliedOn: "2026-10-01",
      source: "LinkedIn",
    }),
  );
  return { user, applicationId: applicationId! };
}

function upload(title: string, replacesId?: string) {
  return uploadDocument(
    { kind: "RESUME", title, replacesId },
    { filename: `${title}.pdf`, declaredType: "application/pdf", bytes: PDF },
  );
}

describe("documents", () => {
  beforeEach(async () => {
    await resetDatabase();
    storage.objects.clear();
    storage.failDeletes = false;
  });

  it("stores files privately under opaque keys and rejects disguised files", async () => {
    const { user } = await setup();
    const id = await upload("Resume");
    const row = await prisma.document.findUniqueOrThrow({ where: { id } });
    expect(row.storageKey).toMatch(new RegExp(`^users/${user.id}/[0-9a-f-]{36}$`));
    expect(row.storageKey).not.toContain("Resume");
    expect(row).toMatchObject({ status: "READY", mimeType: "application/pdf", versionLabel: "v1" });
    expect(row.sha256).toHaveLength(64);
    expect(storage.objects.get(row.storageKey)).toEqual(PDF);

    await expect(
      uploadDocument(
        { kind: "RESUME", title: "x" },
        { filename: "x.pdf", declaredType: "application/pdf", bytes: Buffer.from("<html>") },
      ),
    ).rejects.toThrow(/not a valid PDF/);
  });

  it("keeps the submitted version when a new version is uploaded", async () => {
    const { applicationId } = await setup();
    const v1 = await upload("Resume");
    await attachDocument({ applicationId, documentId: v1, purpose: "RESUME", wasSubmitted: true });
    const v2 = await upload("Resume", v1);

    const [family] = await listDocumentFamilies();
    expect(family!.versions.map((version) => version.versionLabel)).toEqual(["v2", "v1"]);
    expect(family!.latest.id).toBe(v2);
    const attached = await listApplicationDocuments(applicationId);
    expect(attached).toHaveLength(1);
    expect(attached[0]).toMatchObject({ documentId: v1, versionLabel: "v1", wasSubmitted: true });
    expect(attached[0]!.supersededAt).not.toBeNull();

    await detachDocument(applicationId, v1);
    expect(await listApplicationDocuments(applicationId)).toHaveLength(0);
    const events = await listActivity({ applicationId });
    expect(events.map((event) => event.type)).toEqual(
      expect.arrayContaining(["DOCUMENT_ATTACHED", "DOCUMENT_DETACHED"]),
    );
  });

  it("never lets another user download, attach or delete a document", async () => {
    await setup("Alice");
    const aliceDoc = await upload("Alice resume");
    const { applicationId: bobApplication } = await setup("Bob", "Beta");

    expect(await getDocumentForDownload(aliceDoc)).toBeNull();
    await expect(
      attachDocument({
        applicationId: bobApplication,
        documentId: aliceDoc,
        purpose: "RESUME",
        wasSubmitted: true,
      }),
    ).rejects.toThrow(/not found/i);
    await expect(deleteDocument(aliceDoc)).rejects.toThrow(/not found/i);
    expect(await listDocumentFamilies()).toHaveLength(0);
    expect(storage.objects.size).toBe(1);
  });

  it("deletes the object, and queues a retry when storage is unavailable", async () => {
    await setup();
    const first = await upload("One");
    await deleteDocument(first);
    expect(storage.objects.size).toBe(0);

    const second = await upload("Two");
    storage.failDeletes = true;
    await deleteDocument(second);
    expect(await prisma.document.count()).toBe(0);
    const jobs = await prisma.$queryRaw<
      { task_identifier: string }[]
    >`select task_identifier from graphile_worker.jobs`;
    expect(jobs.map((job) => job.task_identifier)).toContain("delete_user_files");
  });
});

describe("contacts", () => {
  beforeEach(resetDatabase);

  it("creates contacts under companies and links them to interviews only within the account", async () => {
    const { applicationId } = await setup("Alice");
    const contactId = await createContact(
      contactSchema.parse({
        companyName: "acme",
        name: "Maya Chen",
        title: "Recruiter",
        email: "maya@acme.test",
      }),
    );
    const application = await getApplicationDetail(applicationId);
    expect(await listCompanyContacts(application!.opportunity.companyId)).toEqual([
      { id: contactId, name: "Maya Chen", title: "Recruiter" },
    ]);

    await createInterview(
      createInterviewSchema.parse({
        applicationId,
        title: "Screen",
        timezone: "Asia/Manila",
        contactIds: [contactId],
      }),
    );
    expect((await listContacts())[0]!.interviewCount).toBe(1);

    await updateContact(contactId, contactSchema.parse({ companyName: "Acme", name: "Maya Chen-Lee" }));
    expect((await listContacts())[0]!.name).toBe("Maya Chen-Lee");

    const { applicationId: bobApplication } = await setup("Bob", "Beta");
    await expect(
      createInterview(
        createInterviewSchema.parse({
          applicationId: bobApplication,
          title: "Sneaky",
          timezone: "UTC",
          contactIds: [contactId],
        }),
      ),
    ).rejects.toThrow(/contacts was not found/);
    await expect(deleteContact(contactId)).rejects.toThrow(/not found/i);
  });
});

describe("offers", () => {
  beforeEach(resetDatabase);

  function offer(applicationId: string, baseSalary: string) {
    return createOfferSchema.parse({
      applicationId,
      positionTitle: "Full-Stack Developer",
      baseSalary,
      currency: "PHP",
      salaryPeriod: "MONTHLY",
      receivedOn: "2026-10-12",
    });
  }

  it("rejects a decision on a superseded revision (stale tab)", async () => {
    const { applicationId } = await setup();
    const first = await createOffer(offer(applicationId, "100000"));
    const second = await createOffer(offer(applicationId, "110000"));

    await expect(decideOffer(first, "ACCEPTED")).rejects.toThrow(/newer revision/i);
    expect(await prisma.application.findUniqueOrThrow({ where: { id: applicationId } })).toMatchObject({
      status: "ACTIVE",
      outcome: null,
    });
    expect(await prisma.offer.findUniqueOrThrow({ where: { id: first } })).toMatchObject({
      status: "RECEIVED",
    });

    await decideOffer(second, "ACCEPTED");
    expect(await prisma.application.findUniqueOrThrow({ where: { id: applicationId } })).toMatchObject({
      status: "CLOSED",
      outcome: "ACCEPTED",
    });
  });

  it("keeps revisions, moves to the offer stage and closes only that application on accept", async () => {
    const { applicationId } = await setup();
    const { applicationId: other } = await createOpportunity(
      quickAddSchema.parse({
        title: "Backend Developer",
        companyName: "Other Co",
        alreadyApplied: true,
        appliedOn: "2026-10-02",
      }),
    );

    await createOffer(offer(applicationId, "150000"));
    const revisedId = await createOffer(offer(applicationId, "165000.50"));
    const offers = await listApplicationOffers(applicationId);
    expect(offers.map((item) => [item.revisionNumber, item.baseSalary, item.status])).toEqual([
      [2, "165000.5", "NEGOTIATING"],
      [1, "150000", "RECEIVED"],
    ]);
    expect((await getApplicationDetail(applicationId))!.stage.category).toBe("OFFER");

    await decideOffer(revisedId, "ACCEPTED");
    expect(await getApplicationDetail(applicationId)).toMatchObject({
      status: "CLOSED",
      outcome: "ACCEPTED",
    });
    expect(await getApplicationDetail(other!)).toMatchObject({ status: "ACTIVE", outcome: null });
    await expect(decideOffer(revisedId, "DECLINED")).rejects.toThrow(/already has a decision/);
  });

  it("declining closes as offer declined and another user cannot decide", async () => {
    const { applicationId } = await setup("Alice");
    const offerId = await createOffer(offer(applicationId, "100000"));
    await setup("Bob", "Beta");
    await expect(decideOffer(offerId, "ACCEPTED")).rejects.toThrow(/not found/i);
    expect(await listApplicationOffers(applicationId)).toHaveLength(0);
  });
});

describe("analytics and export", () => {
  beforeEach(resetDatabase);

  it("counts distinct applications across interviews and offer revisions", async () => {
    const { applicationId } = await setup();
    await createOpportunity(
      quickAddSchema.parse({
        title: "Second",
        companyName: "Two",
        alreadyApplied: true,
        appliedOn: "2026-10-03",
        source: "Referral",
      }),
    );
    for (const title of ["Screen", "Tech 1", "Tech 2"]) {
      await createInterview(createInterviewSchema.parse({ applicationId, title, timezone: "UTC" }));
    }
    await createOffer(
      createOfferSchema.parse({
        applicationId,
        positionTitle: "Dev",
        currency: "PHP",
        receivedOn: "2026-10-10",
      }),
    );
    await createOffer(
      createOfferSchema.parse({
        applicationId,
        positionTitle: "Dev",
        currency: "PHP",
        receivedOn: "2026-10-12",
      }),
    );

    const report = await getAnalytics("2026-09-01", "2026-10-31", "week");
    expect(report.submitted).toBe(2);
    expect(report.interviewRate).toBe(0.5);
    expect(report.offerRate).toBe(0.5);
    expect(report.funnel.map((step) => step.count)).toEqual([2, 1, 1, 1]);
    expect(report.sources.map((row) => row.source).sort()).toEqual(["LinkedIn", "Referral"]);
  });

  it("measures response time in calendar days in the user's timezone", async () => {
    const { applicationId } = await setup();
    // West of UTC, a response entered for Oct 5 is stored as local noon = Oct 5 19:00 UTC.
    await updateRegionalPreferences({ timezone: "America/Los_Angeles", currency: "PHP", weekStartsOn: 1 });
    await recordEmployerResponse(applicationId, "2026-10-05");
    const report = await getAnalytics("2026-09-01", "2026-10-31", "week");
    expect(report.responsesRecorded).toBe(1);
    expect(report.medianResponseDays).toBe(4);
  });

  it("exports only the owner's data and no secrets", async () => {
    await setup("Alice");
    await upload("Alice resume");
    await setup("Bob", "Beta");
    const data = await getWorkspaceExport();
    const json = JSON.stringify(data);
    expect(data.opportunities).toHaveLength(1);
    expect(data.companies.map((company) => company.name)).toEqual(["Beta"]);
    expect(data.documents).toHaveLength(0);
    expect(json).not.toContain("storageKey");
    expect(json).not.toContain("password");
    expect(json).not.toContain("Alice");
  });
});

describe("account deletion file cleanup", () => {
  beforeEach(resetDatabase);

  it("queues file cleanup in batches the worker accepts", async () => {
    const { user } = await setup();
    const total = MAX_STORAGE_KEYS_PER_JOB * 2 + 500;
    await prisma.document.createMany({
      data: Array.from({ length: total }, (_, index) => ({
        userId: user.id,
        kind: "RESUME" as const,
        title: `Resume ${index}`,
        originalFilename: "resume.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1,
        storageKey: `users/${user.id}/${crypto.randomUUID()}`,
      })),
    });

    // Queued before the user row is deleted, so a crash afterwards cannot lose the keys.
    await beforeAccountDelete(user.id);

    // The public jobs view hides payloads, so read them from Graphile's own tables.
    const jobs = await prisma.$queryRaw<{ payload: { storageKeys: string[] } }[]>`
      select job.payload from graphile_worker._private_jobs job
      join graphile_worker._private_tasks task on task.id = job.task_id
      where task.identifier = 'delete_user_files'`;
    expect(jobs.map((job) => job.payload.storageKeys.length).sort((a, b) => b - a)).toEqual([
      MAX_STORAGE_KEYS_PER_JOB,
      MAX_STORAGE_KEYS_PER_JOB,
      500,
    ]);
    expect(new Set(jobs.flatMap((job) => job.payload.storageKeys)).size).toBe(total);
  });

  it("removes files only once no document references them, retrying until then", async () => {
    storage.failDeletes = false;
    const { user } = await setup();
    const documentId = await upload("Resume");
    const { storageKey } = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });
    const helpers = { job: { id: "test" } } as Parameters<typeof deleteUserFilesTask>[1];

    // Account deletion not committed (or failed): the file stays and the job retries.
    await expect(deleteUserFilesTask({ storageKeys: [storageKey] }, helpers)).rejects.toThrow(
      /still referenced/,
    );
    expect(storage.objects.has(storageKey)).toBe(true);

    await prisma.user.delete({ where: { id: user.id } });
    await deleteUserFilesTask({ storageKeys: [storageKey] }, helpers);
    expect(storage.objects.has(storageKey)).toBe(false);
  });
});
