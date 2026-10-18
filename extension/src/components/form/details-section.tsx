import { Field, TextArea, TextInput } from "../fields";
import type { SectionProps } from "./section-props";

export function DetailsSection({ values, errors, set }: Omit<SectionProps, "guessed">) {
  return (
    <>
      <div className="grid grid-cols-[1fr_120px] gap-2.5">
        <Field id="postingUrl" label="Posting URL" error={errors.postingUrl}>
          <TextInput
            id="postingUrl"
            type="url"
            value={values.postingUrl}
            invalid={!!errors.postingUrl}
            onChange={(event) => set("postingUrl", event.target.value)}
          />
        </Field>
        <Field id="source" label="Source">
          <TextInput
            id="source"
            maxLength={60}
            value={values.source}
            onChange={(event) => set("source", event.target.value)}
          />
        </Field>
      </div>
      <Field id="description" label="Description" error={errors.description}>
        <TextArea
          id="description"
          rows={5}
          maxLength={20_000}
          value={values.description}
          onChange={(event) => set("description", event.target.value)}
        />
      </Field>
      <Field id="notes" label="Notes" error={errors.notes}>
        <TextArea
          id="notes"
          rows={2}
          maxLength={5_000}
          value={values.notes}
          onChange={(event) => set("notes", event.target.value)}
        />
      </Field>
    </>
  );
}
