import type { DraftValues } from "@/lib/draft";
import { FOLLOW_UP_TYPE_LABEL, options } from "@/lib/labels";
import { Field, Select, TextInput } from "../fields";
import type { SectionProps } from "./section-props";

/**
 * A to-do for a job not applied to yet (JobTrack reminds you before it's
 * due). Applied jobs get the follow-up suggestion from Settings instead.
 */
export function FollowUpSection({
  values,
  errors,
  set,
  today,
}: Omit<SectionProps, "guessed"> & { today: string }) {
  return (
    <div className="flex flex-col gap-2.5">
      <label className="flex items-center gap-2 text-xs font-bold text-ink">
        <input
          type="checkbox"
          className="size-4 accent-brand"
          checked={values.addFollowUp}
          onChange={(event) => set("addFollowUp", event.target.checked)}
        />
        Add a to-do
      </label>
      {values.addFollowUp ? (
        <div className="grid grid-cols-2 gap-2.5">
          <Field id="followUpType" label="To-do">
            <Select
              id="followUpType"
              options={options(FOLLOW_UP_TYPE_LABEL)}
              value={values.followUpType}
              onChange={(event) => set("followUpType", event.target.value as DraftValues["followUpType"])}
            />
          </Field>
          <Field id="followUpDate" label="Date" error={errors.followUpDate}>
            <TextInput
              id="followUpDate"
              type="date"
              min={today}
              value={values.followUpDate}
              invalid={!!errors.followUpDate}
              onChange={(event) => set("followUpDate", event.target.value)}
            />
          </Field>
        </div>
      ) : null}
    </div>
  );
}
