"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import { FormField, SelectInput } from "@/components/shared/form-controls";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/features/auth/components/auth-card";
import { COMMON_CURRENCIES } from "@/lib/money";
import { completeOnboardingAction } from "../actions";

function subscribeNoop() {
  return () => {};
}

function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

interface OnboardingFormProps {
  timeZones: string[];
  currencies: string[];
}

export function OnboardingForm({ timeZones, currencies }: OnboardingFormProps) {
  const [state, formAction, pending] = useActionState(completeOnboardingAction, null);
  const [chosenTimezone, setChosenTimezone] = useState<string | null>(null);
  // The browser's timezone is the default; the server render uses UTC.
  const detected = useSyncExternalStore(subscribeNoop, browserTimeZone, () => null);
  const timezone = chosenTimezone ?? (detected && timeZones.includes(detected) ? detected : "UTC");

  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;
  const otherCurrencies = currencies.filter((code) => !COMMON_CURRENCIES.includes(code));

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state?.ok === false && !fieldErrors ? <FormAlert>{state.error}</FormAlert> : null}
      <FormField
        id="timezone"
        label="Your timezone"
        hint="Interviews, deadlines and reminders are shown in this timezone."
        error={fieldErrors?.timezone?.[0]}
      >
        <SelectInput
          id="timezone"
          name="timezone"
          value={timezone}
          onChange={(event) => setChosenTimezone(event.target.value)}
          options={timeZones.map((zone) => ({ value: zone, label: zone.replaceAll("_", " ") }))}
        />
      </FormField>
      <FormField
        id="currency"
        label="Preferred currency"
        hint="Used as the default for salaries and offers. You can still record any currency per job."
        error={fieldErrors?.currency?.[0]}
      >
        <SelectInput
          id="currency"
          name="currency"
          defaultValue="PHP"
          options={[...COMMON_CURRENCIES, ...otherCurrencies].map((code) => ({ value: code, label: code }))}
        />
      </FormField>
      <div className="rounded-xl bg-[#f4f7f2] px-3.5 py-3 text-[11px] leading-relaxed text-[#829082]">
        We&apos;ll create your hiring pipeline with six default stages: Applied, Recruiter Screening,
        Assessment, Technical Interview, Final Interview and Job Offer. You can rename, reorder or add stages
        any time.
      </div>
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Setting up..." : "Create my workspace"}
      </Button>
    </form>
  );
}
