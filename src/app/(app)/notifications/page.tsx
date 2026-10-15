import { BellRing } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { StatusBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Panel, PanelHeader } from "@/components/shared/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { NotificationList } from "@/features/notifications/components/notification-list";
import { listNotifications, listReminderLog } from "@/features/notifications/data";
import { requireWorkspace } from "@/features/workspace/data";
import { formatInTimeZone } from "@/lib/dates";

export const metadata: Metadata = { title: "Notifications" };

const STATUS_TONE = {
  PENDING: "blue",
  SENT: "green",
  CANCELLED: "neutral",
  SKIPPED: "neutral",
  FAILED: "red",
} as const;

export default function NotificationsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Stay informed"
        title="Notifications"
        description="Reminders for interviews, tasks and offer deadlines."
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Notifications />
      </Suspense>
    </>
  );
}

async function Notifications() {
  const [items, log, { preferences }] = await Promise.all([
    listNotifications(),
    listReminderLog(),
    requireWorkspace(),
  ]);
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,1fr)]">
      <Panel className="pb-2">
        <PanelHeader title="Inbox" description="In-app reminders and account alerts" />
        {items.length === 0 ? (
          <EmptyState
            icon={BellRing}
            title="No notifications yet"
            description="Reminders appear here when they are due."
          />
        ) : (
          <NotificationList items={items} />
        )}
      </Panel>
      <Panel className="pb-3">
        <PanelHeader title="Reminder log" description="What was scheduled and how it was delivered" />
        {log.length === 0 ? (
          <p className="px-5 pb-4 text-xs text-faint sm:px-6">
            Reminders are created when you schedule interviews or set task due dates.
          </p>
        ) : (
          <ul>
            {log.map((reminder) => (
              <li key={reminder.id} className="border-t border-[#f1f3f0] px-5 py-3 sm:px-6">
                <div className="flex items-center justify-between gap-2">
                  <strong className="truncate text-xs">{reminder.label}</strong>
                  <StatusBadge label={reminder.status.toLowerCase()} tone={STATUS_TONE[reminder.status]} />
                </div>
                <span className="mt-1 block text-[10px] text-[#9aa69d]">
                  {reminder.channel === "EMAIL" ? "Email" : "In-app"} ·{" "}
                  {formatInTimeZone(reminder.remindAt, preferences.timezone, "MMM d, h:mm a")}
                  {reminder.lastError && reminder.status !== "SENT" ? ` · ${reminder.lastError}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
