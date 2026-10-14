import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { DocumentKind, DocumentStatus } from "@/generated/prisma/enums";
import { recordActivity } from "@/features/activity/record";
import { requireWorkspace } from "@/features/workspace/data";
import { DomainError, NotFoundError } from "@/lib/action-result";
import { storageEnv } from "@/lib/env";
import { getStorage } from "@/lib/integrations/storage";
import { enqueueJob } from "@/lib/jobs/queue";
import { DOCUMENT_KIND_LABEL } from "@/lib/labels";
import { errorMessage, logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { sanitizeFilename, validateDocumentFile } from "./file-validation";
import type { DocumentMetaInput } from "./schemas";

export function maxUploadBytes(): number {
  return storageEnv().DOCUMENT_MAX_MB * 1024 * 1024;
}

/**
 * Validates and stores an uploaded file privately, then records its
 * metadata. Object keys never contain names or emails. When `replacesId`
 * is set, the new upload becomes the next version and the old one is kept
 * (so applications still point at the exact file that was submitted).
 */
export async function uploadDocument(
  meta: DocumentMetaInput,
  file: { filename: string; declaredType: string; bytes: Buffer },
): Promise<string> {
  const { user } = await requireWorkspace();
  const check = validateDocumentFile({ ...file, maxBytes: maxUploadBytes() });
  if (!check.ok) throw new DomainError(check.error);

  let versionLabel = meta.versionLabel ?? null;
  if (meta.replacesId) {
    const previous = await prisma.document.findFirst({
      where: { id: meta.replacesId, userId: user.id },
      select: { id: true, versionLabel: true },
    });
    if (!previous) throw new NotFoundError("Document");
    versionLabel ??= nextVersionLabel(previous.versionLabel);
  }

  const storageKey = `users/${user.id}/${randomUUID()}`;
  const storage = getStorage();
  await storage.put(storageKey, file.bytes, check.mimeType);

  try {
    return await prisma.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: {
          userId: user.id,
          kind: meta.kind,
          title: meta.title,
          versionLabel: versionLabel ?? "v1",
          originalFilename: sanitizeFilename(file.filename),
          mimeType: check.mimeType,
          sizeBytes: file.bytes.length,
          sha256: createHash("sha256").update(file.bytes).digest("hex"),
          storageKey,
          status: "READY",
          notes: meta.notes ?? null,
          replacesId: meta.replacesId ?? null,
        },
        select: { id: true },
      });
      if (meta.replacesId) {
        await tx.document.updateMany({
          where: { id: meta.replacesId, userId: user.id },
          data: { supersededAt: new Date() },
        });
      }
      return document.id;
    });
  } catch (error) {
    // The metadata write failed: do not leave an orphaned object behind.
    await storage.delete(storageKey).catch(() => undefined);
    throw error;
  }
}

/** "v3" -> "v4"; anything else -> "<label> (new)". */
export function nextVersionLabel(previous: string | null): string {
  const match = /^v(\d+)$/i.exec(previous ?? "v1");
  return match ? `v${Number(match[1]) + 1}` : `${previous} (new)`;
}

export type DownloadTarget = { storageKey: string; filename: string; mimeType: string };

/** Owner-scoped lookup for the download route. Blocked files are never served. */
export async function getDocumentForDownload(documentId: string): Promise<DownloadTarget | null> {
  const { user } = await requireWorkspace();
  const document = await prisma.document.findFirst({
    where: { id: documentId, userId: user.id, status: "READY" },
    select: { storageKey: true, originalFilename: true, mimeType: true },
  });
  return document
    ? { storageKey: document.storageKey, filename: document.originalFilename, mimeType: document.mimeType }
    : null;
}

/**
 * Deletes a document version: metadata (and its application links) first,
 * then the stored bytes. If the object store is unavailable, deletion is
 * retried by the worker so no private file is left behind.
 */
export async function deleteDocument(documentId: string): Promise<void> {
  const { user } = await requireWorkspace();
  const document = await prisma.document.findFirst({
    where: { id: documentId, userId: user.id },
    select: {
      id: true,
      storageKey: true,
      title: true,
      applications: { select: { applicationId: true, application: { select: { opportunityId: true } } } },
    },
  });
  if (!document) throw new NotFoundError("Document");

  await prisma.$transaction(async (tx) => {
    for (const link of document.applications) {
      await recordActivity(tx, {
        userId: user.id,
        opportunityId: link.application.opportunityId,
        applicationId: link.applicationId,
        type: "DOCUMENT_DETACHED",
        summary: `Removed ${document.title} (document deleted)`,
        details: { documentId: document.id },
      });
    }
    await tx.document.delete({ where: { id: document.id } });
  });

  try {
    await getStorage().delete(document.storageKey);
  } catch (error) {
    logger.warn("document object delete failed; queued retry", { documentId, error: errorMessage(error) });
    await enqueueJob(
      prisma,
      "delete_user_files",
      { storageKeys: [document.storageKey] },
      { maxAttempts: 20 },
    );
  }
}

export async function attachDocument(input: {
  applicationId: string;
  documentId: string;
  purpose: DocumentKind;
  wasSubmitted: boolean;
}): Promise<void> {
  const { user } = await requireWorkspace();
  await prisma.$transaction(async (tx) => {
    const [application, document] = await Promise.all([
      tx.application.findFirst({
        where: { id: input.applicationId, userId: user.id },
        select: { id: true, opportunityId: true },
      }),
      tx.document.findFirst({
        where: { id: input.documentId, userId: user.id, status: "READY" },
        select: { id: true, title: true, versionLabel: true },
      }),
    ]);
    if (!application) throw new NotFoundError("Application");
    if (!document) throw new NotFoundError("Document");
    await tx.applicationDocument.upsert({
      where: {
        userId_applicationId_documentId: {
          userId: user.id,
          applicationId: application.id,
          documentId: document.id,
        },
      },
      create: {
        userId: user.id,
        applicationId: application.id,
        documentId: document.id,
        purpose: input.purpose,
        wasSubmitted: input.wasSubmitted,
      },
      update: { purpose: input.purpose, wasSubmitted: input.wasSubmitted },
    });
    await recordActivity(tx, {
      userId: user.id,
      opportunityId: application.opportunityId,
      applicationId: application.id,
      type: "DOCUMENT_ATTACHED",
      summary: `${input.wasSubmitted ? "Submitted" : "Attached"} ${DOCUMENT_KIND_LABEL[input.purpose].toLowerCase()}: ${document.title} (${document.versionLabel ?? "v1"})`,
      details: { documentId: document.id, purpose: input.purpose, wasSubmitted: input.wasSubmitted },
    });
  });
}

export async function detachDocument(applicationId: string, documentId: string): Promise<void> {
  const { user } = await requireWorkspace();
  await prisma.$transaction(async (tx) => {
    const link = await tx.applicationDocument.findFirst({
      where: { userId: user.id, applicationId, documentId },
      select: { application: { select: { opportunityId: true } }, document: { select: { title: true } } },
    });
    if (!link) throw new NotFoundError("Attachment");
    await tx.applicationDocument.delete({
      where: { userId_applicationId_documentId: { userId: user.id, applicationId, documentId } },
    });
    await recordActivity(tx, {
      userId: user.id,
      opportunityId: link.application.opportunityId,
      applicationId,
      type: "DOCUMENT_DETACHED",
      summary: `Removed ${link.document.title} from this application`,
      details: { documentId },
    });
  });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export type DocumentVersion = {
  id: string;
  kind: DocumentKind;
  title: string;
  versionLabel: string | null;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  notes: string | null;
  createdAt: Date;
  supersededAt: Date | null;
  usedIn: { applicationId: string; label: string; wasSubmitted: boolean }[];
};

export type DocumentFamily = { latest: DocumentVersion; versions: DocumentVersion[] };

const versionSelect = {
  id: true,
  kind: true,
  title: true,
  versionLabel: true,
  originalFilename: true,
  mimeType: true,
  sizeBytes: true,
  status: true,
  notes: true,
  createdAt: true,
  supersededAt: true,
  replacesId: true,
  applications: {
    select: {
      applicationId: true,
      wasSubmitted: true,
      application: {
        select: {
          attemptNumber: true,
          opportunity: { select: { title: true, company: { select: { name: true } } } },
        },
      },
    },
  },
} as const;

/** Library view: each family of versions (newest first) with where it was used. */
export async function listDocumentFamilies(): Promise<DocumentFamily[]> {
  const { user } = await requireWorkspace();
  const rows = await prisma.document.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: versionSelect,
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const rootOf = (id: string): string => {
    let current = byId.get(id);
    const seen = new Set<string>();
    while (current?.replacesId && byId.has(current.replacesId) && !seen.has(current.id)) {
      seen.add(current.id);
      current = byId.get(current.replacesId);
    }
    return current?.id ?? id;
  };
  const families = new Map<string, DocumentVersion[]>();
  for (const row of rows) {
    const { replacesId: _replacesId, applications, ...version } = row;
    const dto: DocumentVersion = {
      ...version,
      usedIn: applications.map((link) => ({
        applicationId: link.applicationId,
        wasSubmitted: link.wasSubmitted,
        label: `${link.application.opportunity.title} · ${link.application.opportunity.company.name}${link.application.attemptNumber > 1 ? ` (attempt ${link.application.attemptNumber})` : ""}`,
      })),
    };
    const root = rootOf(row.id);
    families.set(root, [...(families.get(root) ?? []), dto]);
  }
  return [...families.values()].map((versions) => ({ latest: versions[0]!, versions }));
}

export type AttachedDocument = {
  documentId: string;
  title: string;
  versionLabel: string | null;
  kind: DocumentKind;
  purpose: DocumentKind;
  wasSubmitted: boolean;
  originalFilename: string;
  sizeBytes: number;
  attachedAt: Date;
  supersededAt: Date | null;
};

export async function listApplicationDocuments(applicationId: string): Promise<AttachedDocument[]> {
  const { user } = await requireWorkspace();
  const rows = await prisma.applicationDocument.findMany({
    where: { userId: user.id, applicationId },
    orderBy: { attachedAt: "asc" },
    select: {
      documentId: true,
      purpose: true,
      wasSubmitted: true,
      attachedAt: true,
      document: {
        select: {
          title: true,
          versionLabel: true,
          kind: true,
          originalFilename: true,
          sizeBytes: true,
          supersededAt: true,
        },
      },
    },
  });
  return rows.map(({ document, ...link }) => ({ ...link, ...document }));
}

export type DocumentChoice = { id: string; label: string; kind: DocumentKind };

/** Current (non-superseded) ready documents for the attach picker. */
export async function listDocumentChoices(): Promise<DocumentChoice[]> {
  const { user } = await requireWorkspace();
  const rows = await prisma.document.findMany({
    where: { userId: user.id, status: "READY" },
    orderBy: [{ supersededAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
    select: { id: true, title: true, versionLabel: true, kind: true, supersededAt: true },
  });
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    label: `${row.title} · ${row.versionLabel ?? "v1"}${row.supersededAt ? " (older version)" : ""}`,
  }));
}
