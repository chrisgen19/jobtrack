import { z } from "zod";
import { DocumentKind } from "@/generated/prisma/enums";
import { formBoolean, optionalText, optionalUuid, requiredText, uuid } from "@/lib/validations/common";

export const documentMetaSchema = z.object({
  kind: z.enum(DocumentKind, { error: "Choose a document type." }),
  title: requiredText("Document name", 120),
  versionLabel: optionalText(40),
  notes: optionalText(1_000),
  replacesId: optionalUuid,
});

export const attachDocumentSchema = z.object({
  applicationId: uuid,
  documentId: uuid,
  purpose: z.enum(DocumentKind),
  wasSubmitted: formBoolean,
});

export const detachDocumentSchema = z.object({ applicationId: uuid, documentId: uuid });

export const deleteDocumentSchema = z.object({ documentId: uuid });

export type DocumentMetaInput = z.output<typeof documentMetaSchema>;
