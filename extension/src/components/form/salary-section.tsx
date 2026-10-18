import type { DraftValues } from "@/lib/draft";
import { options, SALARY_PERIOD_LABEL } from "@/lib/labels";
import { Field, Select, TextInput } from "../fields";
import type { SectionProps } from "./section-props";

export function SalarySection({
  values,
  errors,
  guessed,
  set,
  defaultCurrency,
}: SectionProps & { defaultCurrency: string }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <Field id="salaryMin" label="Salary min" error={errors.salaryMin} guessed={guessed.has("salaryMin")}>
        <TextInput
          id="salaryMin"
          inputMode="decimal"
          value={values.salaryMin}
          invalid={!!errors.salaryMin}
          onChange={(event) => set("salaryMin", event.target.value)}
        />
      </Field>
      <Field id="salaryMax" label="Salary max" error={errors.salaryMax} guessed={guessed.has("salaryMax")}>
        <TextInput
          id="salaryMax"
          inputMode="decimal"
          value={values.salaryMax}
          invalid={!!errors.salaryMax}
          onChange={(event) => set("salaryMax", event.target.value)}
        />
      </Field>
      <Field id="currency" label="Currency" error={errors.currency} guessed={guessed.has("currency")}>
        <TextInput
          id="currency"
          maxLength={3}
          placeholder={defaultCurrency}
          value={values.currency}
          invalid={!!errors.currency}
          onChange={(event) => set("currency", event.target.value.toUpperCase())}
        />
      </Field>
      <Field
        id="salaryPeriod"
        label="Pay period"
        error={errors.salaryPeriod}
        guessed={guessed.has("salaryPeriod")}
      >
        <Select
          id="salaryPeriod"
          placeholder="Not set"
          options={options(SALARY_PERIOD_LABEL)}
          value={values.salaryPeriod}
          invalid={!!errors.salaryPeriod}
          onChange={(event) => set("salaryPeriod", event.target.value as DraftValues["salaryPeriod"])}
        />
      </Field>
    </div>
  );
}
