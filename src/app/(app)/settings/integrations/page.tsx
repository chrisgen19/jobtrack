import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { StatusBadge } from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FormAlert } from "@/features/auth/components/auth-card";
import { CalendarActions, DestinationPicker } from "@/features/integrations/components/calendar-controls";
import { getCalendarIntegration, listDestinationCalendars } from "@/features/integrations/data";
import { SettingsCard } from "@/features/settings/components/settings-card";
import { requireWorkspace } from "@/features/workspace/data";
import { formatInTimeZone } from "@/lib/dates";

export const metadata: Metadata = { title: "Integrations" };

const ERRORS: Record<string, string> = {
  denied: "You declined access in Google. Nothing was connected.",
  invalid_state: "That connection attempt expired or didn't match your session. Please try again.",
  not_configured: "Google Calendar isn't configured on this server yet.",
  no_refresh_token:
    "Google didn't grant offline access. Remove JobTrack under your Google Account → Security → Third-party access, then connect again.",
  google: "Google returned an error. Please try again.",
};

export default function IntegrationsPage({ searchParams }: PageProps<"/settings/integrations">) {
  return (
    <SettingsCard
      title="Connected calendars"
      description="Publish your interviews (and optionally tasks) to Google Calendar. Syncing is one-way: JobTrack is the source of truth, and edits made in Google are not imported."
    >
      <Suspense fallback={<Skeleton className="h-48 rounded-xl" />}>
        <Integration searchParams={searchParams} />
      </Suspense>
    </SettingsCard>
  );
}

async function Integration({
  searchParams,
}: {
  searchParams: PageProps<"/settings/integrations">["searchParams"];
}) {
  const [query, integration, { preferences }] = await Promise.all([
    searchParams,
    getCalendarIntegration(),
    requireWorkspace(),
  ]);
  const error = typeof query.error === "string" ? ERRORS[query.error] : undefined;
  const { connection } = integration;
  const destination = connection?.status === "CONNECTED" ? await listDestinationCalendars() : null;

  return (
    <div className="flex flex-col gap-4">
      {query.connected === "1" ? (
        <FormAlert tone="success">
          Google Calendar connected. Your upcoming interviews are being published.
        </FormAlert>
      ) : null}
      {error ? <FormAlert>{error}</FormAlert> : null}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#e8eee8] p-4">
        <span
          className="grid size-[37px] place-items-center rounded-[10px] bg-[#e6f0f9] text-[#568ab5]"
          aria-hidden
        >
          <CalendarDays className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <strong className="text-xs">Google Calendar</strong>
          <span className="mt-1 block text-[10px] text-[#9ca8a0]">
            {!integration.configured && !connection
              ? "Not configured on this server"
              : connection
                ? `${connection.accountEmail ?? "Connected account"} · ${connection.calendarName ?? connection.calendarId}`
                : "Not connected"}
          </span>
        </div>
        {connection ? (
          <StatusBadge
            label={
              connection.status === "CONNECTED"
                ? "Connected"
                : connection.status === "NEEDS_REAUTH"
                  ? "Reconnect needed"
                  : "Error"
            }
            tone={connection.status === "CONNECTED" ? "green" : "red"}
          />
        ) : null}
        {integration.configured && (!connection || connection.status !== "CONNECTED") ? (
          <Button asChild>
            <a href="/api/integrations/google/connect">{connection ? "Reconnect" : "Connect"}</a>
          </Button>
        ) : null}
      </div>

      {!integration.configured && !connection ? (
        <p className="rounded-[9px] bg-[#f4f7f2] px-3.5 py-3 text-[11px] leading-relaxed text-[#829082]">
          The server administrator needs to set <code>GOOGLE_CLIENT_ID</code> and{" "}
          <code>GOOGLE_CLIENT_SECRET</code> (see docs/DEPLOYMENT_COOLIFY.md). Everything else in JobTrack
          works without it.
        </p>
      ) : null}

      {connection ? (
        <>
          <dl className="grid grid-cols-2 gap-3 text-[11px] sm:grid-cols-4">
            <div>
              <dt className="text-faint">Synced events</dt>
              <dd className="mt-1 text-sm font-bold">{connection.synced}</dd>
            </div>
            <div>
              <dt className="text-faint">Waiting</dt>
              <dd className="mt-1 text-sm font-bold">{connection.pending}</dd>
            </div>
            <div>
              <dt className="text-faint">Failed</dt>
              <dd className="mt-1 text-sm font-bold text-[#b4534b]">{connection.failed}</dd>
            </div>
            <div>
              <dt className="text-faint">Last sync</dt>
              <dd className="mt-1 text-xs font-bold">
                {connection.lastSyncedAt
                  ? formatInTimeZone(connection.lastSyncedAt, preferences.timezone, "MMM d, h:mm a")
                  : "Not yet"}
              </dd>
            </div>
          </dl>
          {connection.lastError ? (
            <p className="text-[11px] text-[#b4534b]">Last error: {connection.lastError}</p>
          ) : null}
          {destination?.calendars.length ? (
            <DestinationPicker calendars={destination.calendars} current={connection.calendarId} />
          ) : null}
          {destination?.error ? <p className="text-[11px] text-[#a08562]">{destination.error}</p> : null}
          <CalendarActions failed={connection.failed} synced={connection.synced} />
        </>
      ) : null}

      <p className="rounded-[9px] bg-[#f4f7f2] px-3.5 py-3 text-[11px] leading-relaxed text-[#829082]">
        Privacy: JobTrack asks only for permission to manage events and list your calendars; it never reads
        your other events or invites anyone. If the destination calendar is shared, people with access can see
        interview titles and companies.
      </p>
    </div>
  );
}
