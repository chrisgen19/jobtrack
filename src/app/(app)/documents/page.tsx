import { FileText, Plus, Upload } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentFamilyCard } from "@/features/documents/components/document-family-card";
import { UploadDocumentDialog } from "@/features/documents/components/upload-document-dialog";
import { listDocumentFamilies } from "@/features/documents/data";
import { storageEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Documents" };

export default function DocumentsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[420px] rounded-2xl" />}>
      <Documents />
    </Suspense>
  );
}

async function Documents() {
  const families = await listDocumentFamilies();
  const maxMb = storageEnv().DOCUMENT_MAX_MB;
  return (
    <>
      <PageHeader
        eyebrow="Application materials"
        title="Your document library"
        description="Keep resumes and cover letters organized, versioned and linked to the applications you sent them to."
        actions={
          <UploadDocumentDialog
            maxMb={maxMb}
            trigger={
              <Button variant="outline">
                <Upload aria-hidden /> Add document
              </Button>
            }
          />
        }
      />
      {families.length === 0 ? (
        <Panel>
          <EmptyState
            icon={FileText}
            title="No documents yet"
            description="Upload your resume or a cover letter (PDF or DOCX). Files are private to your account."
            action={
              <UploadDocumentDialog
                maxMb={maxMb}
                trigger={
                  <Button>
                    <Plus aria-hidden /> Add a document
                  </Button>
                }
              />
            }
          />
        </Panel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {families.map((family) => (
            <DocumentFamilyCard key={family.latest.id} family={family} maxMb={maxMb} />
          ))}
          <UploadDocumentDialog
            maxMb={maxMb}
            trigger={
              <button
                type="button"
                className="flex min-h-[209px] items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-[#d3e4d7] bg-[#f5f9f5] text-xs font-bold text-[#6a9477] hover:bg-[#eef6ef]"
              >
                <Plus className="size-4" aria-hidden /> Add a document
              </button>
            }
          />
        </div>
      )}
    </>
  );
}
