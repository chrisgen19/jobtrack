"use client";

import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteOpportunityAction, setOpportunityArchivedAction } from "../actions";

interface JobActionsProps {
  opportunityId: string;
  title: string;
  archived: boolean;
  applicationCount: number;
}

export function JobActions({ opportunityId, title, archived, applicationCount }: JobActionsProps) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [, startTransition] = useTransition();

  function toggleArchive() {
    startTransition(async () => {
      const result = await setOpportunityArchivedAction({ opportunityId, archived: !archived });
      if (result.ok) toast.success(archived ? "Job restored" : "Job archived");
      else toast.error(result.error);
    });
  }

  return (
    <>
      <Button asChild variant="outline">
        <Link href={`/jobs/${opportunityId}/edit`}>
          <Pencil aria-hidden /> Edit
        </Link>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="More actions">
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={toggleArchive}>
            {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
            {archived ? "Restore from archive" : "Archive job"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
            <Trash2 aria-hidden /> Delete permanently
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete "${title}"?`}
        destructive
        confirmLabel="Delete job"
        description={
          <>
            This permanently removes the job
            {applicationCount > 0
              ? `, its ${applicationCount} application attempt${applicationCount === 1 ? "" : "s"}, interviews, offers, tasks and history`
              : " and its history"}
            . Uploaded documents stay in your library. Archive the job instead if you might need it later.
          </>
        }
        onConfirm={async () => {
          const result = await deleteOpportunityAction(opportunityId);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Job deleted");
          setConfirmDelete(false);
          router.replace("/jobs");
        }}
      />
    </>
  );
}
