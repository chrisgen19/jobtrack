"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { FormField, SelectInput, TextInput } from "@/components/shared/form-controls";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { FormAlert } from "@/features/auth/components/auth-card";
import { updateNotificationPreferencesAction } from "../actions";

const LEAD_OPTIONS = [
  { value: "0", label: "At the time" },
  { value: "15", label: "15 minutes before" },
  { value: "30", label: "30 minutes before" },
  { value: "60", label: "1 hour before" },
  { value: "120", label: "2 hours before" },
  { value: "1440", label: "1 day before" },
  { value: "2880", label: "2 days before" },
];

type Values = {
  inAppReminders: boolean;
  emailReminders: boolean;
  interviewReminderMinutes: number;
  taskReminderMinutes: number;
  offerDeadlineReminders: boolean;
  suggestFollowUps: boolean;
  followUpDays: number;
  calendarSyncTasks: boolean;
};

interface Props {
  values: Values;
  emailVerified: boolean;
  emailConfigured: boolean;
  calendarConnected: boolean;
}

function ToggleRow({
  name,
  label,
  description,
  defaultChecked,
  disabled,
}: {
  name: keyof Values;
  label: string;
  description: string;
  defaultChecked: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-[#edf0eb] py-4">
      <div className="min-w-0">
        <label htmlFor={`pref-${name}`} className="text-xs font-bold">
          {label}
        </label>
        <span className="mt-1 block text-[11px] text-[#98a69c]">{description}</span>
      </div>
      <Switch id={`pref-${name}`} name={name} defaultChecked={defaultChecked} disabled={disabled} />
    </div>
  );
}

export function NotificationPreferencesForm({
  values,
  emailVerified,
  emailConfigured,
  calendarConnected,
}: Props) {
  const [state, formAction, pending] = useActionState(updateNotificationPreferencesAction, null);

  useEffect(() => {
    if (state?.ok) toast.success("Notification settings saved");
  }, [state]);

  return (
    <form action={formAction}>
      {state?.ok === false ? <FormAlert>{state.error}</FormAlert> : null}
      <ToggleRow
        name="inAppReminders"
        label="In-app notifications"
        description="Reminders in your JobTrack inbox (bell icon)."
        defaultChecked={values.inAppReminders}
      />
      <ToggleRow
        name="emailReminders"
        label="Email reminders"
        description={
          !emailVerified
            ? "Verify your email address to turn this on."
            : emailConfigured
              ? "Sent to your account email. Off unless you opt in."
              : "Email delivery is not configured on this server yet; nothing will be sent until it is."
        }
        defaultChecked={values.emailReminders}
        disabled={!emailVerified}
      />
      <div className="grid gap-4 border-t border-[#edf0eb] py-4 sm:grid-cols-2">
        <FormField id="pref-interview" label="Default interview reminder">
          <SelectInput
            id="pref-interview"
            name="interviewReminderMinutes"
            defaultValue={String(values.interviewReminderMinutes)}
            options={LEAD_OPTIONS}
          />
        </FormField>
        <FormField id="pref-task" label="Default task reminder">
          <SelectInput
            id="pref-task"
            name="taskReminderMinutes"
            defaultValue={String(values.taskReminderMinutes)}
            options={LEAD_OPTIONS}
          />
        </FormField>
      </div>
      <ToggleRow
        name="offerDeadlineReminders"
        label="Offer deadline reminders"
        description="A reminder at 9:00 AM the day before an offer decision is due."
        defaultChecked={values.offerDeadlineReminders}
      />
      <ToggleRow
        name="suggestFollowUps"
        label="Suggest follow-up tasks"
        description="After applying or an interview, JobTrack suggests a task you can edit or dismiss. Nothing is ever sent to employers."
        defaultChecked={values.suggestFollowUps}
      />
      <div className="border-t border-[#edf0eb] py-4">
        <FormField id="pref-followup" label="Suggest a follow-up this many days after applying">
          <TextInput
            id="pref-followup"
            name="followUpDays"
            type="number"
            min={1}
            max={60}
            defaultValue={values.followUpDays}
            className="max-w-[120px]"
          />
        </FormField>
      </div>
      <ToggleRow
        name="calendarSyncTasks"
        label="Publish tasks to Google Calendar"
        description={
          calendarConnected
            ? "Open tasks with a due date appear in your connected calendar."
            : "Connect Google Calendar under Integrations first."
        }
        defaultChecked={values.calendarSyncTasks}
      />
      <Button type="submit" disabled={pending} className="mt-2">
        {pending ? "Saving..." : "Save notification settings"}
      </Button>
    </form>
  );
}
