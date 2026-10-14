"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormField, SelectInput } from "@/components/shared/form-controls";
import { Button } from "@/components/ui/button";
import type { GoogleCalendar } from "@/lib/integrations/google/client";
import {
  disconnectCalendarAction,
  removeSyncedEventsAction,
  retryFailedCalendarSyncsAction,
  setCalendarDestinationAction,
} from "../actions";

export function DestinationPicker({ calendars, current }: { calendars: GoogleCalendar[]; current: string }) {
  const [value, setValue] = useState(current);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap items-end gap-2">
      <FormField id="destination" label="Publish to calendar" className="min-w-[240px] flex-1">
        <SelectInput
          id="destination"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          options={calendars.map((calendar) => ({
            value: calendar.id,
            label: calendar.primary ? `${calendar.summary} (primary)` : calendar.summary,
          }))}
        />
      </FormField>
      <Button
        variant="outline"
        className="h-10"
        disabled={pending || value === current}
        onClick={() =>
          startTransition(async () => {
            const result = await setCalendarDestinationAction({ calendarId: value });
            if (result.ok) toast.success("Destination updated. Existing events will move shortly.");
            else toast.error(result.error);
          })
        }
      >
        Save
      </Button>
    </div>
  );
}

export function CalendarActions({ failed, synced }: { failed: number; synced: number }) {
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<"remove" | "disconnect" | null>(null);
  return (
    <div className="flex flex-wrap gap-2">
      {failed > 0 ? (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await retryFailedCalendarSyncsAction();
              if (result.ok) toast.success(`Retrying ${result.data} event(s)`);
              else toast.error(result.error);
            })
          }
        >
          Retry failed syncs
        </Button>
      ) : null}
      {synced > 0 ? (
        <Button variant="outline" disabled={pending} onClick={() => setConfirm("remove")}>
          Remove JobTrack events from Google
        </Button>
      ) : null}
      <Button variant="destructive" disabled={pending} onClick={() => setConfirm("disconnect")}>
        Disconnect
      </Button>
      <ConfirmDialog
        open={confirm === "remove"}
        onOpenChange={(open) => (open ? undefined : setConfirm(null))}
        title="Remove synced events?"
        confirmLabel="Remove events"
        description="Every event JobTrack created in your Google Calendar will be deleted. Your interviews in JobTrack are not affected. Future changes will publish again while connected."
        onConfirm={async () => {
          const result = await removeSyncedEventsAction();
          if (result.ok) toast.success("Removing events from Google Calendar");
          else toast.error(result.error);
          setConfirm(null);
        }}
      />
      <ConfirmDialog
        open={confirm === "disconnect"}
        onOpenChange={(open) => (open ? undefined : setConfirm(null))}
        title="Disconnect Google Calendar?"
        destructive
        confirmLabel="Disconnect"
        description="JobTrack stops publishing, revokes its Google access and deletes the stored credentials. Events already in your calendar stay there; remove them first if you don't want them."
        onConfirm={async () => {
          const result = await disconnectCalendarAction();
          if (result.ok) toast.success("Google Calendar disconnected");
          else toast.error(result.error);
          setConfirm(null);
        }}
      />
    </div>
  );
}
