import type { ExtensionMe } from "@jobtrack/shared/extension-api";
import type { DraftValues } from "@/lib/draft";
import { APPLICATION_METHOD_LABEL, options } from "@/lib/labels";
import { Field, Select, TextInput } from "../fields";
import { FollowUpSection } from "./follow-up-section";
import type { SectionProps } from "./section-props";

type Props = Omit<SectionProps, "guessed"> & {
  stages: ExtensionMe["stages"];
  today: string;
  /** The server accepts the application method and a to-do (contract v0.2). */
  extras: boolean;
};

/** "I already applied" with date, stage and method; otherwise an optional to-do. */
export function ApplySection({ values, errors, set, stages, today, extras }: Props) {
  return (
    <div className="flex flex-col gap-2.5 rounded-[10px] bg-surface-2 p-3">
      <label className="flex items-center gap-2 text-xs font-bold text-ink">
        <input
          type="checkbox"
          className="size-4 accent-brand"
          checked={values.alreadyApplied}
          onChange={(event) => set("alreadyApplied", event.target.checked)}
        />
        I already applied
      </label>
      {values.alreadyApplied ? (
        <div className="grid grid-cols-2 gap-2.5">
          <Field id="appliedOn" label="Applied on" error={errors.appliedOn}>
            <TextInput
              id="appliedOn"
              type="date"
              max={today}
              value={values.appliedOn}
              invalid={!!errors.appliedOn}
              onChange={(event) => set("appliedOn", event.target.value)}
            />
          </Field>
          <Field id="stageId" label="Stage" error={errors.stageId}>
            <Select
              id="stageId"
              options={stages.map((stage) => ({ value: stage.id, label: stage.name }))}
              value={values.stageId}
              onChange={(event) => set("stageId", event.target.value)}
            />
          </Field>
          {extras ? (
            <Field id="method" label="Applied via" className="col-span-2">
              <Select
                id="method"
                options={options(APPLICATION_METHOD_LABEL)}
                value={values.method}
                onChange={(event) => set("method", event.target.value as DraftValues["method"])}
              />
            </Field>
          ) : null}
        </div>
      ) : extras ? (
        <FollowUpSection values={values} errors={errors} set={set} today={today} />
      ) : null}
    </div>
  );
}
