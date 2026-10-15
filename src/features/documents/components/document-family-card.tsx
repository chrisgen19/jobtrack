"use client";

import { ArrowRight, Download, FileText, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/badges";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatBytes } from "@/lib/format";
import { DOCUMENT_KIND_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { deleteDocumentAction } from "../actions";
import type { DocumentFamily, DocumentVersion } from "../data";
import { UploadDocumentDialog } from "./upload-document-dialog";

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export function DocumentFamilyCard({ family, maxMb }: { family: DocumentFamily; maxMb: number }) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<DocumentVersion | null>(null);
  const { latest, versions } = family;
  const usage = new Set(versions.flatMap((version) => version.usedIn.map((use) => use.applicationId))).size;

  return (
    <Panel className="flex min-h-[209px] flex-col gap-3.5 p-6">
      <span
        className={cn(
          "grid size-[45px] place-items-center rounded-xl",
          latest.kind === "COVER_LETTER" ? "bg-[#f4ebf8] text-[#a37cb8]" : "bg-[#e9f0fa] text-[#6181ab]",
        )}
        aria-hidden
      >
        <FileText className="size-6" />
      </span>
      <div className="min-w-0">
        <h2 className="mb-1 truncate text-[13px] font-bold">{latest.title}</h2>
        <p className="text-[11px] text-[#99a59c]">
          {DOCUMENT_KIND_LABEL[latest.kind]} · {formatBytes(latest.sizeBytes)} · Added{" "}
          {dateFormat.format(latest.createdAt)}
        </p>
        <div className="mt-2 flex items-center gap-1.5">
          <StatusBadge label={latest.versionLabel ?? "v1"} tone="blue" />
          {versions.length > 1 ? (
            <span className="text-[10px] text-faint">{versions.length} versions</span>
          ) : null}
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-[#edf1eb] pt-3 text-[10px] text-[#97a29a]">
        <span>
          Used in {usage} application{usage === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1 text-[11px] font-bold text-brand hover:underline"
        >
          Details <ArrowRight className="size-3" aria-hidden />
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{latest.title}</DialogTitle>
            <DialogDescription className="text-xs">
              Every version is kept so you can see exactly what you sent to each application.
            </DialogDescription>
          </DialogHeader>
          <ul className="flex flex-col gap-3">
            {versions.map((version) => (
              <li key={version.id} className="rounded-[11px] border border-[#e8eee6] p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <strong className="text-xs">{version.versionLabel ?? "v1"}</strong>
                    {version.id === latest.id ? (
                      <StatusBadge label="Current" tone="green" className="ml-2" />
                    ) : null}
                    <span className="mt-1 block truncate text-[10px] text-[#8b9f92]">
                      {version.originalFilename} · {formatBytes(version.sizeBytes)} ·{" "}
                      {dateFormat.format(version.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button asChild size="sm" variant="outline">
                      <a href={`/api/documents/${version.id}/download`}>
                        <Download aria-hidden /> Download
                      </a>
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Delete ${version.versionLabel ?? "version"}`}
                      onClick={() => setDeleting(version)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                </div>
                {version.usedIn.length > 0 ? (
                  <ul className="mt-2 flex flex-col gap-0.5 text-[11px] text-[#74877a]">
                    {version.usedIn.map((use) => (
                      <li key={use.applicationId}>
                        <Link
                          href={`/applications/${use.applicationId}?tab=documents`}
                          className="hover:underline"
                        >
                          {use.wasSubmitted ? "Submitted to" : "Attached to"} {use.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="flex justify-end">
            <UploadDocumentDialog
              maxMb={maxMb}
              replace={{
                id: latest.id,
                title: latest.title,
                kind: latest.kind,
                versionLabel: latest.versionLabel,
              }}
              trigger={
                <Button>
                  <RefreshCw aria-hidden /> Upload new version
                </Button>
              }
            />
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(next) => (next ? undefined : setDeleting(null))}
        title={`Delete ${deleting?.title ?? ""} ${deleting?.versionLabel ?? ""}?`}
        destructive
        confirmLabel="Delete file"
        description={
          deleting && deleting.usedIn.length > 0
            ? `This version is linked to ${deleting.usedIn.length} application(s). Deleting it removes the file and those historical references.`
            : "The file is permanently removed from your private storage."
        }
        onConfirm={async () => {
          if (!deleting) return;
          const result = await deleteDocumentAction({ documentId: deleting.id });
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Document deleted");
          setDeleting(null);
          if (versions.length === 1) setOpen(false);
        }}
      />
    </Panel>
  );
}
