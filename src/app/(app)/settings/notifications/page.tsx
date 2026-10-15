import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { NotificationPreferencesForm } from "@/features/notifications/components/notification-preferences-form";
import { SettingsCard } from "@/features/settings/components/settings-card";
import { hasConnectedCalendar } from "@/features/integrations/data";
import { requireWorkspace } from "@/features/workspace/data";
import { isEmailConfigured } from "@/lib/integrations/email";

export const metadata: Metadata = { title: "Notification settings" };

export default function NotificationSettingsPage() {
  return (
    <SettingsCard
      title="Reminders & notifications"
      description="Choose how you'd like to receive updates. Changes apply to reminders that haven't been sent yet."
    >
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <Preferences />
      </Suspense>
    </SettingsCard>
  );
}

async function Preferences() {
  const { user, preferences } = await requireWorkspace();
  const connected = await hasConnectedCalendar();
  return (
    <NotificationPreferencesForm
      values={preferences}
      emailVerified={user.emailVerified}
      emailConfigured={isEmailConfigured()}
      calendarConnected={connected}
    />
  );
}
