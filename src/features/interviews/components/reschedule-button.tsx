"use client";

import { CalendarClock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { FormField, SelectInput, TextInput } from "@/components/shared/form-controls";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { utcToZonedParts } from "@/lib/dates";
import { rescheduleInterviewAction } from "../actions";
import { DURATION_OPTIONS } from "../schemas";

interface RescheduleButtonProps {
  interviewId: string;
  title: string;
  startsAt: Date | null;
  endsAt: Date | null;
  timezone: string;
  timeZones: string[];
}

/** Moves an interview to a new time; history is kept on the same record. */
export function RescheduleButton({
  interviewId,
  title,
  startsAt,
  endsAt,
  timezone,
  timeZones,
}: RescheduleButtonProps) {
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, setPending] = useState(false);
  const parts = startsAt ? utcToZonedParts(startsAt, timezone) : null;
  const duration =
    startsAt && endsAt ? String(Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000)) : "";

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <CalendarClock aria-hidden /> Reschedule
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Reschedule {title}</DialogTitle>
            <DialogDescription className="text-xs">
              The previous time is kept in the interview history.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={async (event) => {
              event.preventDefault();
              const data = Object.fromEntries(new FormData(event.currentTarget));
              setPending(true);
              const result = await rescheduleInterviewAction({ ...data, interviewId });
              setPending(false);
              if (!result.ok) {
                setErrors(result.fieldErrors ?? {});
                toast.error(result.error);
                return;
              }
              toast.success("Interview rescheduled");
              setOpen(false);
            }}
          >
            <FormField id="re-date" label="New date" error={errors.date?.[0]}>
              <TextInput id="re-date" name="date" type="date" defaultValue={parts?.date} required />
            </FormField>
            <FormField id="re-time" label="Start time" error={errors.startTime?.[0]}>
              <TextInput id="re-time" name="startTime" type="time" defaultValue={parts?.time} required />
            </FormField>
            <FormField id="re-duration" label="Duration">
              <SelectInput
                id="re-duration"
                name="durationMinutes"
                defaultValue={duration}
                placeholder="Not set"
                options={DURATION_OPTIONS}
              />
            </FormField>
            <FormField id="re-timezone" label="Timezone">
              <SelectInput
                id="re-timezone"
                name="timezone"
                defaultValue={timezone}
                options={timeZones.map((zone) => ({ value: zone, label: zone.replaceAll("_", " ") }))}
              />
            </FormField>
            <FormField id="re-reason" label="Reason (optional)" className="sm:col-span-2">
              <TextInput id="re-reason" name="reason" maxLength={300} />
            </FormField>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving..." : "Reschedule"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
