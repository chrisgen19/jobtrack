"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { fieldAria, FormField, SelectInput, TextArea, TextInput } from "@/components/shared/form-controls";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/features/auth/components/auth-card";
import type { ActionResult } from "@/lib/action-result";
import { enumOptions, INTERVIEW_MODE_LABEL, INTERVIEW_TYPE_LABEL } from "@/lib/labels";
import {
  DURATION_OPTIONS,
  interviewFormSchema,
  REMINDER_OPTIONS,
  type InterviewFormInput,
  type InterviewFormOutput,
} from "../schemas";

export type ContactChoice = { id: string; name: string; title: string | null };

interface InterviewFormProps {
  defaultValues: InterviewFormInput;
  timeZones: string[];
  contacts: ContactChoice[];
  /** Edit mode: ask for a reschedule reason when the time changes. */
  originalSchedule?: { date?: string; startTime?: string; durationMinutes?: number; timezone: string };
  /** Completed interview: its recorded time, shown read-only instead of the schedule fields. */
  lockedSchedule?: string;
  submitLabel: string;
  onSubmit: (values: InterviewFormOutput) => Promise<ActionResult | ActionResult<unknown>>;
  onCancel: () => void;
}

export function InterviewForm({
  defaultValues,
  timeZones,
  contacts,
  originalSchedule,
  lockedSchedule,
  submitLabel,
  onSubmit,
  onCancel,
}: InterviewFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<InterviewFormInput, unknown, InterviewFormOutput>({
    resolver: zodResolver(interviewFormSchema),
    defaultValues,
  });
  const { errors, isSubmitting } = form.formState;
  const [date, startTime, durationMinutes, timezone] = useWatch({
    control: form.control,
    name: ["date", "startTime", "durationMinutes", "timezone"],
  });
  const scheduleChanged =
    originalSchedule !== undefined &&
    (String(date ?? "") !== (originalSchedule.date ?? "") ||
      String(startTime ?? "") !== (originalSchedule.startTime ?? "") ||
      String(durationMinutes ?? "") !== String(originalSchedule.durationMinutes ?? "") ||
      timezone !== originalSchedule.timezone);
  const err = (name: keyof InterviewFormInput) => errors[name]?.message as string | undefined;

  async function submit(values: InterviewFormOutput) {
    setServerError(null);
    const result = await onSubmit(values);
    if (!result.ok) {
      setServerError(result.error);
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages?.[0]) form.setError(field as keyof InterviewFormInput, { message: messages[0] });
      }
    }
  }

  return (
    <form onSubmit={form.handleSubmit(submit)} noValidate className="grid gap-4 sm:grid-cols-2">
      {serverError ? (
        <div className="sm:col-span-2">
          <FormAlert>{serverError}</FormAlert>
        </div>
      ) : null}
      <FormField
        id="interview-title"
        label="Interview round"
        required
        error={err("title")}
        className="sm:col-span-2"
      >
        <TextInput
          placeholder="e.g. Technical Round 2"
          {...fieldAria("interview-title", err("title"))}
          {...form.register("title")}
        />
      </FormField>
      <FormField id="interview-type" label="Type">
        <SelectInput
          id="interview-type"
          options={enumOptions(INTERVIEW_TYPE_LABEL)}
          {...form.register("type")}
        />
      </FormField>
      <FormField id="interview-round" label="Round number" error={err("roundNumber")}>
        <TextInput id="interview-round" type="number" min={1} max={50} {...form.register("roundNumber")} />
      </FormField>
      {lockedSchedule ? (
        <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
          <p className="text-[11px] font-bold text-[#657c6b]">Schedule</p>
          <p className="text-[13px] text-[#304a3b]">{lockedSchedule}</p>
          <p className="text-[10px] leading-normal text-[#99a69d]">
            Completed interviews keep the time they were held.
          </p>
        </div>
      ) : (
        <>
          <FormField
            id="interview-date"
            label="Date"
            error={err("date")}
            hint="Leave empty if the time isn't set yet."
          >
            <TextInput
              type="date"
              {...fieldAria("interview-date", err("date"), true)}
              {...form.register("date")}
            />
          </FormField>
          <FormField id="interview-time" label="Start time" error={err("startTime")}>
            <TextInput
              type="time"
              {...fieldAria("interview-time", err("startTime"))}
              {...form.register("startTime")}
            />
          </FormField>
          <FormField id="interview-duration" label="Duration">
            <SelectInput
              id="interview-duration"
              placeholder="Not set"
              options={DURATION_OPTIONS}
              {...form.register("durationMinutes")}
            />
          </FormField>
          <FormField id="interview-timezone" label="Timezone" hint="The timezone the employer gave you.">
            <SelectInput
              id="interview-timezone"
              options={timeZones.map((zone) => ({ value: zone, label: zone.replaceAll("_", " ") }))}
              {...form.register("timezone")}
            />
          </FormField>
        </>
      )}
      {scheduleChanged ? (
        <FormField
          id="interview-reason"
          label="Reason for rescheduling"
          className="sm:col-span-2"
          hint="Saved in the reschedule history."
        >
          <TextInput
            id="interview-reason"
            placeholder="e.g. Recruiter moved it"
            {...form.register("rescheduleReason")}
          />
        </FormField>
      ) : null}
      <FormField id="interview-mode" label="Format">
        <SelectInput
          id="interview-mode"
          options={enumOptions(INTERVIEW_MODE_LABEL)}
          {...form.register("mode")}
        />
      </FormField>
      <FormField id="interview-reminder" label="Reminder">
        <SelectInput
          id="interview-reminder"
          options={REMINDER_OPTIONS}
          {...form.register("reminderMinutesBefore")}
        />
      </FormField>
      <FormField id="interview-link" label="Meeting link" error={err("meetingUrl")} className="sm:col-span-2">
        <TextInput
          type="url"
          placeholder="https://meet.google.com/..."
          {...fieldAria("interview-link", err("meetingUrl"))}
          {...form.register("meetingUrl")}
        />
      </FormField>
      <FormField id="interview-location" label="Location">
        <TextInput
          id="interview-location"
          placeholder="Office address or room"
          {...form.register("location")}
        />
      </FormField>
      <FormField id="interview-interviewers" label="Interviewers">
        <TextInput
          id="interview-interviewers"
          placeholder="e.g. Maya Chen, Engineering Manager"
          {...form.register("interviewers")}
        />
      </FormField>
      {contacts.length > 0 ? (
        <fieldset className="sm:col-span-2">
          <legend className="mb-1.5 text-[11px] font-bold text-[#657c6b]">Contacts attending</legend>
          <div className="flex flex-wrap gap-2">
            {contacts.map((contact) => (
              <label
                key={contact.id}
                className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs"
              >
                <input type="checkbox" value={contact.id} {...form.register("contactIds")} />
                {contact.name}
                {contact.title ? <span className="text-faint">· {contact.title}</span> : null}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <FormField id="interview-prep" label="Preparation notes" className="sm:col-span-2">
        <TextArea
          id="interview-prep"
          placeholder="Topics to review, questions to ask..."
          {...form.register("prepNotes")}
        />
      </FormField>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
