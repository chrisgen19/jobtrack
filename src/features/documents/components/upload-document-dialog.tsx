"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { DocumentKind } from "@/generated/prisma/enums";
import { FormField, SelectInput, TextArea, TextInput } from "@/components/shared/form-controls";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormAlert } from "@/features/auth/components/auth-card";
import { DOCUMENT_KIND_LABEL, enumOptions } from "@/lib/labels";

interface UploadDocumentDialogProps {
  trigger: ReactNode;
  maxMb: number;
  /** Replace mode: upload a new version of this document. */
  replace?: { id: string; title: string; kind: DocumentKind; versionLabel: string | null };
}

export function UploadDocumentDialog({ trigger, maxMb, replace }: UploadDocumentDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="rounded-2xl sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{replace ? `Upload a new version of ${replace.title}` : "Add a document"}</DialogTitle>
          <DialogDescription className="text-xs">
            PDF or DOCX, up to {maxMb} MB. Files are stored privately and only you can download them.
            {replace ? " The current version stays attached to applications that used it." : ""}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            if (replace) data.set("replacesId", replace.id);
            setPending(true);
            setError(null);
            try {
              const response = await fetch("/api/documents", { method: "POST", body: data });
              const body = (await response.json().catch(() => ({}))) as { error?: string };
              if (!response.ok) {
                setError(body.error ?? "Upload failed.");
                return;
              }
              toast.success(replace ? "New version uploaded" : "Document uploaded");
              setOpen(false);
              router.refresh();
            } finally {
              setPending(false);
            }
          }}
        >
          {error ? (
            <div className="sm:col-span-2">
              <FormAlert>{error}</FormAlert>
            </div>
          ) : null}
          <FormField id="doc-file" label="File" required className="sm:col-span-2">
            <input
              id="doc-file"
              name="file"
              type="file"
              required
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="rounded-[9px] border border-dashed border-[#d3e4d7] bg-[#f5f9f5] p-3 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-bold"
            />
          </FormField>
          <FormField id="doc-title" label="Name" className="sm:col-span-2" hint="Defaults to the file name.">
            <TextInput
              id="doc-title"
              name="title"
              defaultValue={replace?.title}
              maxLength={120}
              placeholder="e.g. Full-Stack Developer Resume"
            />
          </FormField>
          <FormField id="doc-kind" label="Type">
            <SelectInput
              id="doc-kind"
              name="kind"
              defaultValue={replace?.kind ?? "RESUME"}
              options={enumOptions(DOCUMENT_KIND_LABEL)}
            />
          </FormField>
          <FormField
            id="doc-version"
            label="Version label"
            hint={replace ? "Leave empty to number it automatically." : "e.g. v1, Frontend focus"}
          >
            <TextInput id="doc-version" name="versionLabel" maxLength={40} />
          </FormField>
          <FormField id="doc-notes" label="Notes" className="sm:col-span-2">
            <TextArea id="doc-notes" name="notes" className="min-h-[60px]" maxLength={1000} />
          </FormField>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              <Upload aria-hidden /> {pending ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
