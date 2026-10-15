"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { FormField, SelectInput } from "@/components/shared/form-controls";
import { Button } from "@/components/ui/button";
import { updateRegionalPreferencesAction } from "@/features/workspace/actions";
import { COMMON_CURRENCIES } from "@/lib/money";

interface RegionalPreferencesFormProps {
  timezone: string;
  currency: string;
  weekStartsOn: number;
  timeZones: string[];
  currencies: string[];
}

export function RegionalPreferencesForm({
  timezone,
  currency,
  weekStartsOn,
  timeZones,
  currencies,
}: RegionalPreferencesFormProps) {
  const [state, formAction, pending] = useActionState(updateRegionalPreferencesAction, null);
  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;

  useEffect(() => {
    if (state?.ok) toast.success("Preferences saved");
    else if (state?.ok === false) toast.error(state.error);
  }, [state]);

  const ordered = [...COMMON_CURRENCIES, ...currencies.filter((code) => !COMMON_CURRENCIES.includes(code))];

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-3">
      <FormField
        id="pref-timezone"
        label="Timezone"
        error={fieldErrors?.timezone?.[0]}
        className="sm:col-span-3"
      >
        <SelectInput
          id="pref-timezone"
          name="timezone"
          defaultValue={timezone}
          options={timeZones.map((zone) => ({ value: zone, label: zone.replaceAll("_", " ") }))}
        />
      </FormField>
      <FormField id="pref-currency" label="Preferred currency" error={fieldErrors?.currency?.[0]}>
        <SelectInput
          id="pref-currency"
          name="currency"
          defaultValue={currency}
          options={ordered.map((code) => ({ value: code, label: code }))}
        />
      </FormField>
      <FormField id="pref-week" label="Week starts on">
        <SelectInput
          id="pref-week"
          name="weekStartsOn"
          defaultValue={String(weekStartsOn)}
          options={[
            { value: "0", label: "Sunday" },
            { value: "1", label: "Monday" },
          ]}
        />
      </FormField>
      <div className="flex items-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save preferences"}
        </Button>
      </div>
    </form>
  );
}
