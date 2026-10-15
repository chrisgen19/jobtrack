import { History } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { Panel, PanelHeader } from "@/components/shared/panel";
import { formatDateOnly, formatInTimeZone } from "@/lib/dates";
import type { ActivityItem } from "../data";

export function RecentActivity({ items, timezone }: { items: ActivityItem[]; timezone: string }) {
  return (
    <Panel className="pb-4">
      <PanelHeader title="Recent activity" description="The latest changes across your search" />
      {items.length === 0 ? (
        <EmptyState
          icon={History}
          title="No activity yet"
          description="Saving jobs, applying and moving stages will show up here."
          className="py-8"
        />
      ) : (
        <ol className="ml-7 border-l-[1.5px] border-[#dfe9df] pr-4 pl-5 sm:ml-9 sm:pr-6">
          {items.map((item) => (
            <li key={item.id} className="relative mb-4 last:mb-1">
              <span
                className="absolute top-1 -left-[26px] size-2.5 rounded-full border-[3px] border-white bg-[#94c2a8] outline outline-1 outline-[#deede0]"
                aria-hidden
              />
              <Link
                href={
                  item.applicationId
                    ? `/applications/${item.applicationId}?tab=timeline`
                    : `/jobs/${item.opportunityId}`
                }
                className="hover:underline"
              >
                <strong className="text-xs">{item.summary}</strong>
              </Link>
              <span className="mt-1 block text-[10px] text-[#9ba79d]">
                {item.company} ·{" "}
                {item.displayDate
                  ? formatDateOnly(item.displayDate, "MMM d")
                  : formatInTimeZone(item.occurredAt, timezone, "MMM d, h:mm a")}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
