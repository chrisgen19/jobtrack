"use client";

import {
  CalendarClock,
  CalendarPlus,
  ExternalLink,
  MapPin,
  MoreHorizontal,
  Users,
  Video,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { InterviewResult, InterviewStatus } from "@/generated/prisma/enums";
import { StatusBadge } from "@/components/shared/badges";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { FormField, SelectInput, TextArea } from "@/components/shared/form-controls";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatInTimeZone, utcToZonedParts } from "@/lib/dates";
import {
  enumOptions,
  INTERVIEW_MODE_LABEL,
  INTERVIEW_RESULT_LABEL,
  INTERVIEW_STATUS_LABEL,
  INTERVIEW_TYPE_LABEL,
} from "@/lib/labels";
import {
  cancelInterviewAction,
  completeInterviewAction,
  createInterviewAction,
  deleteInterviewAction,
  recordInterviewResultAction,
  updateInterviewAction,
} from "../actions";
import type { InterviewDto } from "../data";
import { InterviewForm, type ContactChoice } from "./interview-form";

const STATUS_TONE: Record<InterviewStatus, "green" | "amber" | "neutral" | "blue" | "red"> = {
  SCHEDULED: "green",
  RESCHEDULED: "amber",
  UNSCHEDULED: "neutral",
  COMPLETED: "blue",
  CANCELLED: "red",
};

const RESULT_TONE: Record<InterviewResult, "neutral" | "amber" | "green" | "red"> = {
  PENDING: "neutral",
  AWAITING_FEEDBACK: "amber",
  PASSED: "green",
  FAILED: "red",
};

type DialogState =
  | { kind: "create" }
  | { kind: "edit" | "complete" | "result" | "cancel" | "delete"; interview: InterviewDto }
  | null;

interface InterviewListProps {
  applicationId: string;
  interviews: InterviewDto[];
  timezone: string;
  defaultReminderMinutes: number;
  timeZones: string[];
  contacts: ContactChoice[];
}

export function InterviewList({
  applicationId,
  interviews,
  timezone,
  defaultReminderMinutes,
  timeZones,
  contacts,
}: InterviewListProps) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const close = () => setDialog(null);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <strong className="text-[13px]">
          {interviews.length} interview round{interviews.length === 1 ? "" : "s"}
        </strong>
        <Button variant="outline" onClick={() => setDialog({ kind: "create" })}>
          <CalendarPlus aria-hidden /> Schedule interview
        </Button>
      </div>
      {interviews.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No interviews yet"
          description="Add every round here: screening, technical, final, or as many as the process needs."
          className="py-8"
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {interviews.map((interview) => (
            <InterviewCard
              key={interview.id}
              interview={interview}
              timezone={timezone}
              onAction={(kind) => setDialog({ kind, interview })}
            />
          ))}
        </ul>
      )}

      <Dialog
        open={dialog?.kind === "create" || dialog?.kind === "edit"}
        onOpenChange={(open) => (open ? undefined : close())}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle>{dialog?.kind === "edit" ? "Edit interview" : "Schedule an interview"}</DialogTitle>
            <DialogDescription className="text-xs">
              {dialog?.kind === "edit"
                ? "Changing the date or time keeps this interview and records the reschedule."
                : "Create as many interview rounds as you need."}
            </DialogDescription>
          </DialogHeader>
          {dialog?.kind === "create" ? (
            <InterviewForm
              timeZones={timeZones}
              contacts={contacts}
              submitLabel="Save interview"
              onCancel={close}
              defaultValues={{
                title: "",
                type: "TECHNICAL",
                mode: "VIDEO",
                timezone,
                roundNumber: String(interviews.length + 1),
                reminderMinutesBefore: String(defaultReminderMinutes),
                durationMinutes: "60",
                contactIds: [],
              }}
              onSubmit={async (values) => {
                const result = await createInterviewAction({ ...values, applicationId });
                if (result.ok) {
                  toast.success("Interview saved");
                  close();
                }
                return result;
              }}
            />
          ) : null}
          {dialog?.kind === "edit" ? (
            <EditInterview
              interview={dialog.interview}
              timeZones={timeZones}
              contacts={contacts}
              onDone={close}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <OutcomeDialog state={dialog} onClose={close} />

      <ConfirmDialog
        open={dialog?.kind === "cancel"}
        onOpenChange={(open) => (open ? undefined : close())}
        title="Cancel this interview?"
        confirmLabel="Cancel interview"
        description="It stays in your history as cancelled. Cancelling does not mark the application as rejected."
        onConfirm={async () => {
          if (dialog?.kind !== "cancel") return;
          const result = await cancelInterviewAction({ interviewId: dialog.interview.id });
          if (result.ok) {
            toast.success("Interview cancelled");
            close();
          } else toast.error(result.error);
        }}
      />
      <ConfirmDialog
        open={dialog?.kind === "delete"}
        onOpenChange={(open) => (open ? undefined : close())}
        title="Delete this interview?"
        destructive
        confirmLabel="Delete"
        description="The interview, its notes and reschedule history are removed. Use Cancel instead to keep a record."
        onConfirm={async () => {
          if (dialog?.kind !== "delete") return;
          const result = await deleteInterviewAction({ interviewId: dialog.interview.id });
          if (result.ok) {
            toast.success("Interview deleted");
            close();
          } else toast.error(result.error);
        }}
      />
    </div>
  );
}

function EditInterview({
  interview,
  timeZones,
  contacts,
  onDone,
}: {
  interview: InterviewDto;
  timeZones: string[];
  contacts: ContactChoice[];
  onDone: () => void;
}) {
  const parts = interview.startsAt ? utcToZonedParts(interview.startsAt, interview.timezone) : null;
  const duration =
    interview.startsAt && interview.endsAt
      ? Math.round((interview.endsAt.getTime() - interview.startsAt.getTime()) / 60_000)
      : undefined;
  const original = {
    date: parts?.date,
    startTime: parts?.time,
    durationMinutes: duration,
    timezone: interview.timezone,
  };
  return (
    <InterviewForm
      timeZones={timeZones}
      contacts={contacts}
      originalSchedule={original}
      submitLabel="Save changes"
      onCancel={onDone}
      defaultValues={{
        title: interview.title,
        type: interview.type,
        roundNumber: interview.roundNumber ? String(interview.roundNumber) : "",
        mode: interview.mode,
        meetingUrl: interview.meetingUrl ?? "",
        location: interview.location ?? "",
        interviewers: interview.interviewers ?? "",
        prepNotes: interview.prepNotes ?? "",
        reminderMinutesBefore:
          interview.reminderMinutesBefore === null ? "" : String(interview.reminderMinutesBefore),
        date: original.date ?? "",
        startTime: original.startTime ?? "",
        durationMinutes: duration ? String(duration) : "",
        timezone: interview.timezone,
        contactIds: interview.contacts.map((contact) => contact.id),
      }}
      onSubmit={async (values) => {
        const result = await updateInterviewAction({ ...values, interviewId: interview.id });
        if (result.ok) {
          toast.success("Interview updated");
          onDone();
        }
        return result;
      }}
    />
  );
}

function OutcomeDialog({ state, onClose }: { state: DialogState; onClose: () => void }) {
  const [pending, setPending] = useState(false);
  const open = state?.kind === "complete" || state?.kind === "result";
  const interview = open ? state.interview : null;
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="rounded-2xl sm:max-w-[480px]">
        {interview ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {state?.kind === "complete"
                  ? `Mark “${interview.title}” as completed`
                  : "Record interview result"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                The result is separate from the application stage and its final outcome.
              </DialogDescription>
            </DialogHeader>
            <form
              className="flex flex-col gap-4"
              onSubmit={async (event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                const payload = {
                  interviewId: interview.id,
                  result: data.get("result"),
                  feedback: data.get("feedback"),
                };
                setPending(true);
                const result =
                  state?.kind === "complete"
                    ? await completeInterviewAction(payload)
                    : await recordInterviewResultAction(payload);
                setPending(false);
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success(state?.kind === "complete" ? "Interview completed" : "Result saved");
                onClose();
              }}
            >
              <FormField id="interview-result" label="Result">
                <SelectInput
                  id="interview-result"
                  name="result"
                  defaultValue={interview.result === "PENDING" ? "AWAITING_FEEDBACK" : interview.result}
                  options={enumOptions(INTERVIEW_RESULT_LABEL)}
                />
              </FormField>
              <FormField id="interview-feedback" label="Feedback and notes">
                <TextArea
                  id="interview-feedback"
                  name="feedback"
                  defaultValue={interview.feedback ?? ""}
                  placeholder="How did it go? What did they ask?"
                />
              </FormField>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  Save
                </Button>
              </div>
            </form>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function scheduleLabel(interview: InterviewDto, timezone: string): string {
  if (!interview.startsAt) return "Time not set yet";
  const start = formatInTimeZone(interview.startsAt, timezone, "EEE, MMM d, yyyy · h:mm a");
  const end = interview.endsAt ? `–${formatInTimeZone(interview.endsAt, timezone, "h:mm a")}` : "";
  return `${start}${end}`;
}

function InterviewCard({
  interview,
  timezone,
  onAction,
}: {
  interview: InterviewDto;
  timezone: string;
  onAction: (kind: "edit" | "complete" | "result" | "cancel" | "delete") => void;
}) {
  const otherZone = interview.startsAt && interview.timezone !== timezone;
  const finished = interview.status === "COMPLETED" || interview.status === "CANCELLED";
  return (
    <li className="rounded-[11px] border border-[#e8eee6] p-4">
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <strong className="text-[13px]">{interview.title}</strong>
          <span className="mt-0.5 block text-[10px] text-[#8b9f92]">
            {INTERVIEW_TYPE_LABEL[interview.type]}
            {interview.roundNumber ? ` · Round ${interview.roundNumber}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <StatusBadge
            label={INTERVIEW_STATUS_LABEL[interview.status]}
            tone={STATUS_TONE[interview.status]}
          />
          {interview.result !== "PENDING" ? (
            <StatusBadge
              label={INTERVIEW_RESULT_LABEL[interview.result]}
              tone={RESULT_TONE[interview.result]}
            />
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${interview.title}`}>
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onAction("edit")}>
                {interview.status === "COMPLETED" ? "Edit details" : "Edit or reschedule"}
              </DropdownMenuItem>
              {!finished ? (
                <DropdownMenuItem onSelect={() => onAction("complete")}>Mark as completed</DropdownMenuItem>
              ) : null}
              {interview.status === "COMPLETED" ? (
                <DropdownMenuItem onSelect={() => onAction("result")}>Record result</DropdownMenuItem>
              ) : null}
              {!finished ? (
                <DropdownMenuItem onSelect={() => onAction("cancel")}>Cancel interview</DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => onAction("delete")}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <p className="text-[11px] font-semibold text-[#4f6658]">
        {scheduleLabel(interview, timezone)}
        {otherZone ? (
          <span className="ml-1 font-normal text-[#8b9f92]">
            ({formatInTimeZone(interview.startsAt!, interview.timezone, "h:mm a")}{" "}
            {interview.timezone.replaceAll("_", " ")})
          </span>
        ) : null}
      </p>
      <ul className="mt-2 flex flex-col gap-1 text-[11px] leading-relaxed text-[#88988c]">
        <li className="flex items-center gap-1.5">
          <Video className="size-3" aria-hidden /> {INTERVIEW_MODE_LABEL[interview.mode]}
          {interview.meetingUrl ? (
            <a
              href={interview.meetingUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"
            >
              Join link <ExternalLink className="size-3" aria-hidden />
            </a>
          ) : null}
        </li>
        {interview.location ? (
          <li className="flex items-center gap-1.5">
            <MapPin className="size-3" aria-hidden /> {interview.location}
          </li>
        ) : null}
        {interview.interviewers || interview.contacts.length ? (
          <li className="flex items-center gap-1.5">
            <Users className="size-3" aria-hidden />
            {[interview.interviewers, ...interview.contacts.map((contact) => contact.name)]
              .filter(Boolean)
              .join(", ")}
          </li>
        ) : null}
      </ul>
      {interview.prepNotes ? (
        <details className="mt-3 text-[11px] text-[#74877a]">
          <summary className="cursor-pointer font-bold text-[#657c6b]">Preparation notes</summary>
          <p className="mt-1.5 whitespace-pre-wrap">{interview.prepNotes}</p>
        </details>
      ) : null}
      {interview.feedback ? (
        <details className="mt-2 text-[11px] text-[#74877a]" open>
          <summary className="cursor-pointer font-bold text-[#657c6b]">Feedback</summary>
          <p className="mt-1.5 whitespace-pre-wrap">{interview.feedback}</p>
        </details>
      ) : null}
      {interview.reschedules.length > 0 ? (
        <details className="mt-2 text-[11px] text-[#74877a]">
          <summary className="cursor-pointer font-bold text-[#a08562]">
            Rescheduled {interview.reschedules.length} time{interview.reschedules.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-1.5 flex flex-col gap-1">
            {interview.reschedules.map((change) => (
              <li key={change.id}>
                {change.previousStartsAt
                  ? formatInTimeZone(change.previousStartsAt, timezone, "MMM d, h:mm a")
                  : "Unset"}{" "}
                →{" "}
                {change.newStartsAt
                  ? formatInTimeZone(change.newStartsAt, timezone, "MMM d, h:mm a")
                  : "Unset"}
                {change.reason ? ` · ${change.reason}` : ""}
                <span className="text-faint">
                  {" "}
                  (changed {formatInTimeZone(change.createdAt, timezone, "MMM d")})
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  );
}
