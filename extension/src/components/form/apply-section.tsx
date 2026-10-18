import type { ExtensionMe } from "@jobtrack/shared/extension-api";
import { Field, Select, TextInput } from "../fields";
import type { SectionProps } from "./section-props";

export function ApplySection({
  values,
  errors,
  set,
  stages,
}: Omit<SectionProps, "guessed"> & { stages: ExtensionMe["stages"] }) {
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
        </div>
      ) : null}
    </div>
  );
}
