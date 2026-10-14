import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ChangePasswordForm } from "@/features/settings/components/change-password-form";
import { ProfileForm } from "@/features/settings/components/profile-form";
import { RegionalPreferencesForm } from "@/features/settings/components/regional-preferences-form";
import { SettingsCard } from "@/features/settings/components/settings-card";
import { requireWorkspace } from "@/features/workspace/data";
import { supportedTimeZones } from "@/lib/dates";
import { supportedCurrencies } from "@/lib/money";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <ProfileSettings />
    </Suspense>
  );
}

async function ProfileSettings() {
  const { user, preferences } = await requireWorkspace();
  return (
    <div className="grid gap-4">
      <SettingsCard title="Profile" description="How you appear in JobTrack and in reminder emails.">
        <ProfileForm name={user.name} email={user.email} />
      </SettingsCard>
      <SettingsCard
        title="Timezone & currency"
        description="Dates, interviews and reminders display in your timezone. Your currency is the default for new salaries and offers."
      >
        <RegionalPreferencesForm
          timezone={preferences.timezone}
          currency={preferences.currency}
          weekStartsOn={preferences.weekStartsOn}
          timeZones={supportedTimeZones()}
          currencies={supportedCurrencies()}
        />
      </SettingsCard>
      <SettingsCard
        title="Security"
        description="Changing your password signs you out on every other device."
      >
        <ChangePasswordForm />
      </SettingsCard>
    </div>
  );
}
