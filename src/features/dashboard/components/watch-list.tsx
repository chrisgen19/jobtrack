import { ArrowRight, Briefcase } from "lucide-react";
import Link from "next/link";
import { PriorityBadge, StageBadge } from "@/components/shared/badges";
import { CompanyLogo } from "@/components/shared/company-logo";
import { EmptyState } from "@/components/shared/empty-state";
import { Panel, PanelHeader } from "@/components/shared/panel";
import type { WatchedApplication } from "../data";

export function WatchList({ applications }: { applications: WatchedApplication[] }) {
  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        title="Applications to watch"
        description="Your most important active opportunities"
        action={
          <Link
            href="/jobs"
            className="flex items-center gap-1 text-[11px] font-bold text-brand hover:underline"
          >
            All jobs <ArrowRight className="size-3" aria-hidden />
          </Link>
        }
      />
      {applications.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No active applications yet"
          description="Save a job and mark it as applied to start tracking its progress."
          action={
            <Link href="/jobs" className="text-xs font-bold text-brand hover:underline">
              Go to your jobs
            </Link>
          }
          className="py-8"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-[#fcfdfb] text-[10px] font-bold tracking-[0.5px] text-[#a7b1aa] uppercase">
                <th className="border-b border-line-soft px-4 py-3 sm:px-6">Role / company</th>
                <th className="border-b border-line-soft px-3 py-3">Stage</th>
                <th className="border-b border-line-soft px-3 py-3 sm:px-6">Priority</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((application) => (
                <tr
                  key={application.id}
                  className="border-b border-line-soft last:border-0 hover:bg-[#f9fbf8]"
                >
                  <td className="px-4 py-3 sm:px-6">
                    <Link
                      href={`/applications/${application.id}`}
                      className="flex min-w-0 items-center gap-2.5"
                    >
                      <CompanyLogo name={application.company} />
                      <span className="min-w-0">
                        <strong className="block max-w-[140px] truncate text-xs sm:max-w-[260px]">
                          {application.role}
                        </strong>
                        <small className="mt-1 block max-w-[120px] truncate text-[10px] text-[#9aa69d] sm:max-w-[250px]">
                          {application.company}
                        </small>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <StageBadge name={application.stageName} category={application.stageCategory} />
                  </td>
                  <td className="px-3 py-3 sm:px-6">
                    <PriorityBadge priority={application.priority} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
