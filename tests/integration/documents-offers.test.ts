import { readFileSync } from "node:fs";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { beforeAccountDelete } from "@/features/account/deletion";
import { getAnalytics } from "@/features/analytics/data";
import {
  closeApplication,
  getApplicationDetail,
  listActivity,
  recordEmployerResponse,
  updateApplicationDetails,
} from "@/features/applications/data";
import { applicationDetailsSchema } from "@/features/applications/schemas";
import {
  createContact,
  deleteContact,
  listCompanyContacts,
  listContacts,
  updateContact,
} from "@/features/contacts/data";
import { contactSchema } from "@/features/contacts/schemas";
import { getDashboard } from "@/features/dashboard/data";
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
import {
  createOffer,
  decideOffer,
  listApplicationOffers,
  listOfferDeadlines,
  setOfferStatus,
} from "@/features/offers/data";
import { createOfferSchema } from "@/features/offers/schemas";
import { createOpportunity } from "@/features/opportunities/data";
import { quickAddSchema } from "@/features/opportunities/schemas";
import { completeOnboarding, updateRegionalPreferences } from "@/features/workspace/data";
import {
  addDaysToDateOnly,
  parseDateOnly,
  todayInTimeZone,
  toDateOnly,
  toDateOnlyOrNull,
  utcToZonedParts,
  zonedToUtc,
} from "@/lib/dates";
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

/** A migration's SQL statements, with comments removed (its SQL has no other semicolons). */
function migrationStatements(name: string): string[] {
  const sql = readFileSync(new URL(`../../prisma/migrations/${name}/migration.sql`, import.meta.url), "utf8");
  return sql
    .replace(/^--.*$/gm, "")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

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

  it("commits the file cleanup job with the metadata delete, before touching storage", async () => {
    await setup();
    const documentId = await upload("Resume");
    const { storageKey } = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });
    const queuedKeys = () => prisma.$queryRaw<{ payload: { storageKeys: string[] } }[]>`
      select job.payload from graphile_worker._private_jobs job
      join graphile_worker._private_tasks task on task.id = job.task_id
      where task.identifier = 'delete_user_files'`;

    // Simulate the process dying right after the commit: storage is never reached.
    const deleteObject = storage.delete;
    let seenAtDelete: string[] = [];
    storage.delete = async () => {
      seenAtDelete = (await queuedKeys()).flatMap((job) => job.payload.storageKeys);
      throw new Error("process crashed");
    };
    try {
      await deleteDocument(documentId);
    } finally {
      storage.delete = deleteObject;
    }
    expect(seenAtDelete).toEqual([storageKey]);
    expect(storage.objects.has(storageKey)).toBe(true);

    // The worker finishes the cleanup from the durable job.
    const helpers = { job: { id: "test" } } as Parameters<typeof deleteUserFilesTask>[1];
    await deleteUserFilesTask({ storageKeys: seenAtDelete }, helpers);
    expect(storage.objects.has(storageKey)).toBe(false);
  });

  it("keeps a newer version when the version it replaced is deleted", async () => {
    storage.failDeletes = false;
    const { user } = await setup();
    const first = await upload("Resume");
    const second = await upload("Resume", first);
    await deleteDocument(first);
    expect(await prisma.document.findUniqueOrThrow({ where: { id: second } })).toMatchObject({
      userId: user.id,
      replacesId: null,
    });
  });

  it("rejects a version link to another user's document at the database level", async () => {
    storage.failDeletes = false;
    await setup("Alice");
    const aliceDocument = await upload("Alice resume");
    const { user: bob } = await setup("Bob", "Beta");
    await expect(
      prisma.document.create({
        data: {
          userId: bob.id,
          kind: "RESUME",
          title: "Bob resume",
          originalFilename: "bob.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1,
          storageKey: `users/${bob.id}/${crypto.randomUUID()}`,
          replacesId: aliceDocument,
        },
      }),
    ).rejects.toThrow(/foreign key/i);
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

  function offer(applicationId: string, baseSalary: string, decisionDeadline?: string) {
    return createOfferSchema.parse({
      applicationId,
      positionTitle: "Full-Stack Developer",
      baseSalary,
      currency: "PHP",
      salaryPeriod: "MONTHLY",
      receivedOn: "2026-10-12",
      decisionDeadline,
    });
  }

  /**
   * Starts `action` while another transaction holds an uncommitted acceptance
   * of the offer, and commits that acceptance once `action` waits on its lock.
   */
  async function raceWithAcceptance(offerId: string, action: () => Promise<unknown>) {
    let pending!: Promise<unknown>;
    await prisma.$transaction(
      async (tx) => {
        await tx.offer.update({
          where: { id: offerId },
          data: { status: "ACCEPTED", decidedAt: new Date() },
        });
        pending = action();
        pending.catch(() => undefined);
        for (let attempt = 0; ; attempt += 1) {
          const [{ waiting }] = await prisma.$queryRaw<[{ waiting: number }]>`
            select count(*)::int as waiting from pg_stat_activity
            where datname = current_database() and wait_event_type = 'Lock'`;
          if (waiting > 0) break;
          if (attempt > 250) throw new Error("the competing request never waited on the offer lock");
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      },
      { timeout: 15_000 },
    );
    return pending;
  }

  it("never overwrites a concurrent decision with another status", async () => {
    const { applicationId } = await setup();
    const offerId = await createOffer(offer(applicationId, "100000"));

    await expect(raceWithAcceptance(offerId, () => setOfferStatus(offerId, "EXPIRED"))).rejects.toThrow(
      /already has a decision/,
    );
    expect(await prisma.offer.findUniqueOrThrow({ where: { id: offerId } })).toMatchObject({
      status: "ACCEPTED",
    });
    await expect(setOfferStatus(crypto.randomUUID(), "EXPIRED")).rejects.toThrow(/not found/i);
  });

  it("lets only one of two concurrent decisions win", async () => {
    const { applicationId } = await setup();
    const offerId = await createOffer(offer(applicationId, "100000"));

    await expect(raceWithAcceptance(offerId, () => decideOffer(offerId, "DECLINED"))).rejects.toThrow(
      /already has a decision/,
    );
    expect(await prisma.offer.findUniqueOrThrow({ where: { id: offerId } })).toMatchObject({
      status: "ACCEPTED",
    });
    expect(await prisma.application.findUniqueOrThrow({ where: { id: applicationId } })).toMatchObject({
      outcome: null,
    });
    const events = await listActivity({ applicationId });
    expect(events.map((event) => event.type)).not.toContain("OFFER_DECLINED");
  });

  it("stops treating a closed application's offer as pending, and lets a decision replace the closed outcome", async () => {
    const { user, applicationId } = await setup();
    const today = todayInTimeZone("Asia/Manila");
    const offerId = await createOffer(offer(applicationId, "100000", addDaysToDateOnly(today, 10)));
    const deadlines = () => listOfferDeadlines(today, addDaysToDateOnly(today, 30));
    const pendingReminders = () =>
      prisma.reminder.count({ where: { userId: user.id, offerId, status: "PENDING" } });
    expect((await getDashboard()).metrics.pendingOffers).toBe(1);
    expect(await deadlines()).toHaveLength(1);
    expect(await pendingReminders()).toBeGreaterThan(0);

    // Closed while the offer is still open: no longer pending anywhere.
    await closeApplication(applicationId, "REJECTED");
    expect((await getDashboard()).metrics).toMatchObject({ pendingOffers: 0, applicationsWithOffers: 1 });
    expect(await deadlines()).toHaveLength(0);
    expect(await pendingReminders()).toBe(0);

    // Accepting it afterwards replaces the contradicting outcome, and says so.
    await decideOffer(offerId, "ACCEPTED");
    expect(await prisma.application.findUniqueOrThrow({ where: { id: applicationId } })).toMatchObject({
      status: "CLOSED",
      outcome: "ACCEPTED",
    });
    const events = await listActivity({ applicationId });
    expect(events.map((event) => event.summary)).toContain("Closed: Accepted (was Rejected)");
  });

  it("shows only the latest revision's deadline on the calendar", async () => {
    const { applicationId } = await setup();
    const { applicationId: other } = await createOpportunity(
      quickAddSchema.parse({
        title: "Backend Developer",
        companyName: "Other Co",
        alreadyApplied: true,
        appliedOn: "2026-10-02",
      }),
    );
    await createOffer(offer(applicationId, "100000", "2026-10-20"));
    const revised = await createOffer(offer(applicationId, "110000", "2026-10-22"));
    const otherOffer = await createOffer(offer(other!, "90000", "2026-10-25"));

    const deadlines = () => listOfferDeadlines("2026-10-01", "2026-10-31");
    expect((await deadlines()).map((item) => [item.offerId, item.deadline])).toEqual(
      expect.arrayContaining([
        [revised, "2026-10-22"],
        [otherOffer, "2026-10-25"],
      ]),
    );
    expect(await deadlines()).toHaveLength(2);

    // Deciding the latest revision must not resurface the earlier, still "received" one.
    await decideOffer(revised, "ACCEPTED");
    expect((await deadlines()).map((item) => item.offerId)).toEqual([otherOffer]);
  });

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

  it("keeps the recorded response date when the timezone changes", async () => {
    const { applicationId } = await setup(); // applied on 2026-10-01
    await updateRegionalPreferences({ timezone: "America/Los_Angeles", currency: "PHP", weekStartsOn: 1 });
    await recordEmployerResponse(applicationId, "2026-10-05");
    // Moving 15 hours east used to turn the stored noon-in-Los-Angeles instant into Oct 6.
    await updateRegionalPreferences({ timezone: "Asia/Manila", currency: "PHP", weekStartsOn: 1 });

    expect((await getApplicationDetail(applicationId))!.firstResponseOn).toBe("2026-10-05");
    expect((await getAnalytics("2026-09-01", "2026-10-31", "week")).medianResponseDays).toBe(4);
    const editAppliedOn = (appliedOn: string) =>
      updateApplicationDetails(applicationDetailsSchema.parse({ applicationId, appliedOn }));
    await expect(editAppliedOn("2026-10-06")).rejects.toThrow(
      /after the employer's response \(Oct 5, 2026\)/,
    );
    await editAppliedOn("2026-10-05");
  });

  it("contract migration rebuilds every response from its latest event, then drops the old column", async () => {
    const { user, applicationId: corrected } = await setup(); // user now in Asia/Manila
    const another = async (title: string) =>
      (
        await createOpportunity(
          quickAddSchema.parse({ title, companyName: title, alreadyApplied: true, appliedOn: "2026-10-02" }),
        )
      ).applicationId!;
    const oldColumnOnly = await another("Old column only");
    const noResponse = await another("No response");
    const laNoon = zonedToUtc("2026-10-05", "12:00", "America/Los_Angeles"); // reads as Oct 6 in Manila
    const responseEvent = async (applicationId: string, respondedOn: string, createdAt: Date) => {
      const { opportunityId } = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
      await prisma.activityEvent.create({
        data: {
          userId: user.id,
          opportunityId,
          applicationId,
          type: "EMPLOYER_RESPONSE_RECEIVED",
          summary: "Employer responded",
          details: { respondedOn },
          occurredAt: createdAt,
          createdAt,
        },
      });
    };
    const oldColumnExists = async () =>
      (
        await prisma.$queryRaw<{ count: number }[]>`
          select count(*)::int as count from information_schema.columns
          where table_name = 'applications' and column_name = 'first_response_at'`
      )[0]!.count;

    // The expand-release state, rebuilt by hand: this database is already past the contract step.
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "applications" ADD COLUMN "first_response_at" timestamptz(3)`,
    );
    try {
      // Backfilled as Oct 4, then corrected to Oct 5 by the previous release during the deploy,
      // which only updated the old column and added an event.
      await prisma.application.update({
        where: { id: corrected },
        data: { firstResponseOn: parseDateOnly("2026-10-04") },
      });
      await prisma.$executeRaw`UPDATE "applications" SET "first_response_at" = ${laNoon} WHERE "id" = ${corrected}::uuid`;
      await responseEvent(corrected, "2026-10-04", new Date("2026-10-10T00:00:00Z"));
      await responseEvent(corrected, "2026-10-05", new Date("2026-10-11T00:00:00Z"));
      // Only the old column and no event (e.g. demo seed data).
      await prisma.$executeRaw`UPDATE "applications" SET "first_response_at" = ${laNoon} WHERE "id" = ${oldColumnOnly}::uuid`;
      // A stray event never brings back a response the application doesn't have.
      await responseEvent(noResponse, "2026-10-03", new Date("2026-10-10T00:00:00Z"));

      const statements = migrationStatements("20261015024025_drop_first_response_at");
      expect(statements).toHaveLength(4);
      for (const statement of statements) await prisma.$executeRawUnsafe(statement);
      expect(await oldColumnExists()).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe(`ALTER TABLE "applications" DROP COLUMN IF EXISTS "first_response_at"`);
    }

    const responseOn = async (id: string) =>
      toDateOnlyOrNull((await prisma.application.findUniqueOrThrow({ where: { id } })).firstResponseOn);
    expect(await responseOn(corrected)).toBe("2026-10-05"); // the latest entered date wins
    expect(await responseOn(oldColumnOnly)).toBe("2026-10-06"); // no event: what it showed
    expect(await responseOn(noResponse)).toBeNull();
  });

  it("shows the response event on its recorded date after a timezone change", async () => {
    const { applicationId } = await setup();
    await updateRegionalPreferences({ timezone: "America/Los_Angeles", currency: "PHP", weekStartsOn: 1 });
    await recordEmployerResponse(applicationId, "2026-10-05");
    await updateRegionalPreferences({ timezone: "Asia/Manila", currency: "PHP", weekStartsOn: 1 });

    const event = (await listActivity({ applicationId })).find(
      (item) => item.type === "EMPLOYER_RESPONSE_RECEIVED",
    )!;
    // The stored instant now falls on Oct 6 in Manila, so lists must show the recorded date instead.
    expect(utcToZonedParts(event.occurredAt, "Asia/Manila").date).toBe("2026-10-06");
    expect(event.displayDate).toBe("2026-10-05");
    const recent = (await getDashboard()).recentActivity.find(
      (item) => item.type === "EMPLOYER_RESPONSE_RECEIVED",
    )!;
    expect(recent.displayDate).toBe("2026-10-05");
    expect(
      (await listActivity({ applicationId })).find((item) => item.type === "APPLICATION_SUBMITTED")!
        .displayDate,
    ).toBeNull();
  });

  it("keeps the response date between the application date and today", async () => {
    const { applicationId } = await setup(); // applied on 2026-10-01
    const tomorrow = addDaysToDateOnly(todayInTimeZone("Asia/Manila"), 1);
    await expect(recordEmployerResponse(applicationId, "2026-09-30")).rejects.toThrow(
      /can't be before the application date/,
    );
    await expect(recordEmployerResponse(applicationId, tomorrow)).rejects.toThrow(/can't be in the future/);
    expect(
      (await prisma.application.findUniqueOrThrow({ where: { id: applicationId } })).firstResponseOn,
    ).toBeNull();

    await recordEmployerResponse(applicationId, "2026-10-05");
    const editAppliedOn = (appliedOn: string) =>
      updateApplicationDetails(applicationDetailsSchema.parse({ applicationId, appliedOn }));
    await expect(editAppliedOn("2026-10-06")).rejects.toThrow(/can't be after the employer's response/);
    expect(
      toDateOnly((await prisma.application.findUniqueOrThrow({ where: { id: applicationId } })).appliedOn),
    ).toBe("2026-10-01");

    await editAppliedOn("2026-10-05");
    const report = await getAnalytics("2026-09-01", "2026-10-31", "week");
    expect(report.medianResponseDays).toBe(0);
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

  async function queuedCleanupBatches(): Promise<string[][]> {
    // The public jobs view hides payloads, so read them from Graphile's own tables.
    const jobs = await prisma.$queryRaw<{ payload: { storageKeys: string[] } }[]>`
      select job.payload from graphile_worker._private_jobs job
      join graphile_worker._private_tasks task on task.id = job.task_id
      where task.identifier = 'delete_user_files'`;
    return jobs.map((job) => job.payload.storageKeys);
  }

  it("queues cleanup for every document the account delete removes, even uploads during it", async () => {
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

    await beforeAccountDelete(user.id);
    // An upload that commits after the hooks ran, before Better Auth deletes the user.
    const late = await upload("Late resume");
    const { storageKey: lateKey } = await prisma.document.findUniqueOrThrow({ where: { id: late } });

    await prisma.user.delete({ where: { id: user.id } });
    const batches = await queuedCleanupBatches();
    expect(batches.map((batch) => batch.length).sort((a, b) => b - a)).toEqual([
      MAX_STORAGE_KEYS_PER_JOB,
      MAX_STORAGE_KEYS_PER_JOB,
      501,
    ]);
    const keys = new Set(batches.flat());
    expect(keys.size).toBe(total + 1);
    expect(keys.has(lateKey)).toBe(true);
  });

  it("queues no file cleanup when the account delete rolls back", async () => {
    const { user } = await setup();
    await upload("Resume");
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.user.delete({ where: { id: user.id } });
        throw new Error("rolled back");
      }),
    ).rejects.toThrow("rolled back");
    expect(await queuedCleanupBatches()).toEqual([]);
    expect(await prisma.document.count()).toBe(1);
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
