"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { markAllNotificationsReadAction, markNotificationReadAction } from "../actions";
import type { NotificationItem } from "../data";
import { NotificationIcon } from "./notification-icon";

const timeFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function NotificationList({ items }: { items: NotificationItem[] }) {
  const router = useRouter();
  const unread = items.filter((item) => !item.readAt).length;
  return (
    <div>
      <div className="flex items-center justify-between px-5 pb-3 sm:px-6">
        <span className="text-[11px] text-faint">{unread} unread</span>
        {unread > 0 ? (
          <Button variant="outline" size="sm" onClick={() => void markAllNotificationsReadAction()}>
            Mark all as read
          </Button>
        ) : null}
      </div>
      <ul>
        {items.map((item) => (
          <li
            key={item.id}
            className={cn(
              "flex items-start gap-3 border-t border-[#f1f3f0] px-5 py-3.5 sm:px-6",
              !item.readAt && "bg-[#fbfdf8]",
            )}
          >
            <NotificationIcon type={item.type} />
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={async () => {
                if (!item.readAt) await markNotificationReadAction({ notificationId: item.id, read: true });
                if (item.link) router.push(item.link);
              }}
            >
              <strong className="block text-xs">{item.title}</strong>
              {item.body ? <span className="mt-1 block text-[11px] text-[#8e9d92]">{item.body}</span> : null}
              <span className="mt-1 block text-[10px] text-faint">{timeFormat.format(item.createdAt)}</span>
            </button>
            <button
              type="button"
              className="text-[10px] font-bold whitespace-nowrap text-brand hover:underline"
              onClick={() => void markNotificationReadAction({ notificationId: item.id, read: !item.readAt })}
            >
              {item.readAt ? "Mark unread" : "Mark read"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
