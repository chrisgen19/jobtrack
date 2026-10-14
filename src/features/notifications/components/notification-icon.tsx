import { BellRing, CalendarClock, CalendarX, ListChecks, Target } from "lucide-react";
import type { NotificationType } from "@/generated/prisma/enums";

const ICONS = {
  INTERVIEW_REMINDER: CalendarClock,
  TASK_REMINDER: ListChecks,
  OFFER_DEADLINE: Target,
  CALENDAR_SYNC_ERROR: CalendarX,
  SYSTEM: BellRing,
} satisfies Record<NotificationType, unknown>;

export function NotificationIcon({ type }: { type: NotificationType }) {
  const Icon = ICONS[type];
  return (
    <span
      className="grid size-7 flex-none place-items-center rounded-[9px] bg-[#edf5ef] text-brand"
      aria-hidden
    >
      <Icon className="size-3.5" />
    </span>
  );
}
