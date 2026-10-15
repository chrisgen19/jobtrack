"use client";

import { Download, FileText, Paperclip, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/empty-state";
import { FormField, SelectInput } from "@/components/shared/form-controls";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { formatBytes } from "@/lib/format";
import { DOCUMENT_KIND_LABEL, enumOptions } from "@/lib/labels";
import { attachDocumentAction, detachDocumentAction } from "../actions";
import type { AttachedDocument, DocumentChoice } from "../data";

interface ApplicationDocumentsProps {
  applicationId: string;
  attached: AttachedDocument[];
  choices: DocumentChoice[];
}

export function ApplicationDocuments({ applicationId, attached, choices }: ApplicationDocumentsProps) {
  const available = choices.filter((choice) => !attached.some((doc) => doc.documentId === choice.id));
  const [documentId, setDocumentId] = useState("");
  const [purpose, setPurpose] = useState("RESUME");
  const [wasSubmitted, setWasSubmitted] = useState(true);
  const [pending, setPending] = useState(false);

  async function attach() {
    if (!documentId) return;
    setPending(true);
    const result = await attachDocumentAction({ applicationId, documentId, purpose, wasSubmitted });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Document attached");
    setDocumentId("");
  }

  return (
    <div>
      <h3 className="mb-3 text-[11px] font-extrabold tracking-[1px] text-[#87998c] uppercase">
        Attached documents
      </h3>
      {attached.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents attached"
          description="Attach the exact resume and cover letter versions you sent."
          className="py-6"
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {attached.map((doc) => (
            <li
              key={doc.documentId}
              className="flex items-center gap-3 rounded-[11px] border border-[#e8eee6] p-3"
            >
              <span
                className="grid size-9 flex-none place-items-center rounded-lg bg-[#e9f0fa] text-[#6181ab]"
                aria-hidden
              >
                <FileText className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <strong className="block truncate text-xs">
                  {doc.title} · {doc.versionLabel ?? "v1"}
                </strong>
                <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-[#8b9f92]">
                  {DOCUMENT_KIND_LABEL[doc.purpose]} · {formatBytes(doc.sizeBytes)}
                  {doc.wasSubmitted ? (
                    <StatusBadge label="Submitted" tone="green" />
                  ) : (
                    <StatusBadge label="Reference" />
                  )}
                  {doc.supersededAt ? <span className="text-[#a08562]">A newer version exists</span> : null}
                </span>
              </div>
              <Button asChild size="icon-sm" variant="ghost" aria-label={`Download ${doc.title}`}>
                <a href={`/api/documents/${doc.documentId}/download`}>
                  <Download aria-hidden />
                </a>
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Remove ${doc.title} from this application`}
                onClick={async () => {
                  const result = await detachDocumentAction({ applicationId, documentId: doc.documentId });
                  if (result.ok) toast.success("Document removed");
                  else toast.error(result.error);
                }}
              >
                <X aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 rounded-xl border border-line bg-surface-2 p-4">
        <h3 className="mb-3 text-xs font-bold">Attach a document</h3>
        {choices.length === 0 ? (
          <p className="text-[11px] text-subtle">
            Your library is empty.{" "}
            <Link href="/documents" className="font-bold text-brand hover:underline">
              Upload a resume first
            </Link>
            .
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto] sm:items-end">
            <FormField id="attach-document" label="Document version">
              <SelectInput
                id="attach-document"
                value={documentId}
                onChange={(event) => {
                  setDocumentId(event.target.value);
                  const kind = choices.find((choice) => choice.id === event.target.value)?.kind;
                  if (kind) setPurpose(kind);
                }}
                placeholder="Choose from your library"
                options={available.map((choice) => ({ value: choice.id, label: choice.label }))}
              />
            </FormField>
            <FormField id="attach-purpose" label="Used as">
              <SelectInput
                id="attach-purpose"
                value={purpose}
                onChange={(event) => setPurpose(event.target.value)}
                options={enumOptions(DOCUMENT_KIND_LABEL)}
              />
            </FormField>
            <Button onClick={attach} disabled={!documentId || pending} className="h-10">
              <Paperclip aria-hidden /> Attach
            </Button>
            <div className="flex items-center gap-2 sm:col-span-3">
              <Checkbox
                id="attach-submitted"
                checked={wasSubmitted}
                onCheckedChange={(checked) => setWasSubmitted(checked === true)}
              />
              <Label htmlFor="attach-submitted" className="text-xs font-medium text-subtle">
                This exact version was submitted with the application
              </Label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
