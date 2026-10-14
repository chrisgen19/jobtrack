"use client";

import {
  CircleSlash,
  MessageSquareReply,
  MoreHorizontal,
  Pause,
  Play,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ApplicationStatus } from "@/generated/prisma/enums";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormField, SelectInput, TextArea, TextInput } from "@/components/shared/form-controls";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { APPLICATION_OUTCOME_LABEL, enumOptions } from "@/lib/labels";
import {
  closeApplicationAction,
  deleteApplicationAction,
  pauseApplicationAction,
  recordEmployerResponseAction,
  reopenApplicationAction,
  resumeApplicationAction,
} from "../actions";

interface StatusControlsProps {
  applicationId: string;
  status: ApplicationStatus;
  attemptNumber: number;
  today: string;
}

export function StatusControls({ applicationId, status, attemptNumber, today }: StatusControlsProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [dialog, setDialog] = useState<"close" | "response" | "delete" | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(success);
      else toast.error(result.error ?? "Something went wrong.");
    });
  }

  return (
    <>
      {status === "CLOSED" ? (
        <Button
          variant="outline"
          onClick={() => run(() => reopenApplicationAction({ applicationId }), "Application reopened")}
        >
          <RotateCcw aria-hidden /> Reopen
        </Button>
      ) : (
        <Button variant="outline" onClick={() => setDialog("close")}>
          <CircleSlash aria-hidden /> Close application
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="More application actions">
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {status === "ACTIVE" ? (
            <DropdownMenuItem
              onSelect={() => run(() => pauseApplicationAction({ applicationId }), "Application paused")}
            >
              <Pause aria-hidden /> Pause
            </DropdownMenuItem>
          ) : null}
          {status === "PAUSED" ? (
            <DropdownMenuItem
              onSelect={() => run(() => resumeApplicationAction({ applicationId }), "Application resumed")}
            >
              <Play aria-hidden /> Resume
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => setDialog("response")}>
            <MessageSquareReply aria-hidden /> Record employer response
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
            <Trash2 aria-hidden /> Delete this attempt
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CloseDialog
        open={dialog === "close"}
        onOpenChange={(open) => setDialog(open ? "close" : null)}
        applicationId={applicationId}
      />
      <ResponseDialog
        open={dialog === "response"}
        onOpenChange={(open) => setDialog(open ? "response" : null)}
        applicationId={applicationId}
        today={today}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(open) => setDialog(open ? "delete" : null)}
        title={`Delete attempt ${attemptNumber}?`}
        destructive
        confirmLabel="Delete attempt"
        description="Its interviews, offers, tasks, document links and history will be removed. The saved job and other attempts stay."
        onConfirm={async () => {
          const result = await deleteApplicationAction({ applicationId });
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Attempt deleted");
          setDialog(null);
          router.replace(`/jobs/${result.data.opportunityId}`);
        }}
      />
    </>
  );
}

function CloseDialog({
  open,
  onOpenChange,
  applicationId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Close this application</DialogTitle>
          <DialogDescription className="text-xs">
            Choose the final outcome. Nothing is closed automatically; you can reopen it later.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            setPending(true);
            const result = await closeApplicationAction({
              applicationId,
              outcome: data.get("outcome"),
              note: data.get("note"),
            });
            setPending(false);
            if (!result.ok) {
              setError(result.fieldErrors?.outcome?.[0] ?? result.error);
              return;
            }
            toast.success("Application closed");
            onOpenChange(false);
          }}
        >
          <FormField id="outcome" label="Outcome" required error={error ?? undefined}>
            <SelectInput
              id="outcome"
              name="outcome"
              placeholder="Choose an outcome"
              options={enumOptions(APPLICATION_OUTCOME_LABEL)}
              required
            />
          </FormField>
          <FormField id="close-note" label="Note (optional)">
            <TextArea id="close-note" name="note" className="min-h-[60px]" placeholder="What happened?" />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Closing..." : "Close application"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResponseDialog({
  open,
  onOpenChange,
  applicationId,
  today,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  today: string;
}) {
  const [pending, setPending] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Employer response</DialogTitle>
          <DialogDescription className="text-xs">
            When did the employer first respond? This powers your response-time analytics.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            setPending(true);
            const result = await recordEmployerResponseAction({
              applicationId,
              respondedOn: data.get("respondedOn"),
            });
            setPending(false);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success("Response recorded");
            onOpenChange(false);
          }}
        >
          <FormField id="respondedOn" label="Response date">
            <TextInput
              id="respondedOn"
              name="respondedOn"
              type="date"
              defaultValue={today}
              max={today}
              required
            />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
