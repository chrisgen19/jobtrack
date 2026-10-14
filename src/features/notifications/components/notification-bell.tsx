"use client";

import { ArrowRight, Bell } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { markAllNotificationsReadAction, markNotificationReadAction } from "../actions";
import type { NotificationItem } from "../data";
import { NotificationIcon } from "./notification-icon";

const timeFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function NotificationBell({ items, unread }: { items: NotificationItem[]; unread: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function openItem(item: NotificationItem) {
    setOpen(false);
    if (!item.readAt) await markNotificationReadAction({ notificationId: item.id, read: true });
    if (item.link) router.push(item.link);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
          className="relative"
        >
          <Bell className="size-5" aria-hidden />
          {unread > 0 ? (
            <span
              className="absolute top-2 right-2 size-1.5 rounded-full bg-[#e17861] ring-2 ring-white"
              aria-hidden
            />
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(325px,calc(100vw-22px))] overflow-hidden rounded-[14px] p-0"
      >
        <div className="flex items-center justify-between border-b border-[#eef2ed] px-4 py-3.5 text-[13px] font-bold">
          Notifications
          {unread > 0 ? (
            <button
              type="button"
              className="text-[11px] font-bold text-brand hover:underline"
              onClick={() => void markAllNotificationsReadAction()}
            >
              Mark all read
            </button>
          ) : null}
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-subtle">
            You&apos;re all caught up. Reminders will appear here.
          </p>
        ) : (
          <ul className="max-h-[360px] overflow-y-auto">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => void openItem(item)}
                  className={cn(
                    "flex w-full gap-2.5 border-b border-[#f0f2ef] px-4 py-3 text-left hover:bg-[#f9fcf8]",
                    !item.readAt && "bg-[#fbfdf8]",
                  )}
                >
                  <NotificationIcon type={item.type} />
                  <span className="min-w-0">
                    <strong className={cn("block text-[11px]", !item.readAt && "text-ink")}>
                      {item.title}
                    </strong>
                    {item.body ? (
                      <span className="mt-1 block truncate text-[10px] text-[#99a79c]">{item.body}</span>
                    ) : null}
                    <span className="mt-1 block text-[10px] text-faint">
                      {timeFormat.format(item.createdAt)}
                    </span>
                  </span>
                  {!item.readAt ? (
                    <span
                      className="mt-1 ml-auto size-1.5 flex-none rounded-full bg-brand"
                      aria-label="Unread"
                    />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="px-4 py-2.5 text-center">
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-brand hover:underline"
          >
            View all <ArrowRight className="size-3" aria-hidden />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
