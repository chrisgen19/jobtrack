import { BarChart3, Briefcase, Clock, Target, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, HorizontalBars } from "@/features/analytics/components/bar-chart";
import { firstApplicationDate, getAnalytics } from "@/features/analytics/data";
import { ExportButton } from "@/features/export/components/export-button";
import { requireWorkspace } from "@/features/workspace/data";
import { addDaysToDateOnly, formatDateOnly, isValidDateOnly, todayInTimeZone } from "@/lib/dates";
import { APPLICATION_OUTCOME_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Analytics" };

const PRESETS = [
  { id: "30d", label: "Last 30 days", days: 30 },
  { id: "90d", label: "Last 90 days", days: 90 },
  { id: "12m", label: "Last 12 months", days: 365 },
  { id: "all", label: "All time", days: null },
] as const;

function percent(value: number | null): string {
  return value === null ? "–" : `${Math.round(value * 100)}%`;
}

export default function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  return (
    <>
      <PageHeader
        eyebrow="Job search insights"
        title="Your progress, in perspective"
        description="Understand what's working and where the opportunities are."
        actions={<ExportButton label="Export data" />}
      />
      <Suspense fallback={<Skeleton className="h-[640px] rounded-2xl" />}>
        <Analytics searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Analytics({ searchParams }: { searchParams: PageProps<"/analytics">["searchParams"] }) {
  const [query, { preferences }] = await Promise.all([searchParams, requireWorkspace()]);
  const today = todayInTimeZone(preferences.timezone);
  const presetId = PRESETS.some((preset) => preset.id === query.range) ? (query.range as string) : "90d";
  const preset = PRESETS.find((item) => item.id === presetId)!;
  const customFrom = typeof query.from === "string" && isValidDateOnly(query.from) ? query.from : null;
  const customTo = typeof query.to === "string" && isValidDateOnly(query.to) ? query.to : null;

  let from: string;
  let to = today;
  if (customFrom && customTo && customFrom <= customTo) {
    from = customFrom;
    to = customTo;
  } else if (preset.days === null) {
    from = (await firstApplicationDate()) ?? addDaysToDateOnly(today, -89);
  } else {
    from = addDaysToDateOnly(today, -(preset.days - 1));
  }
  const spanDays = (Date.parse(to) - Date.parse(from)) / 86_400_000;
  const granularity =
    query.by === "week" || query.by === "month" ? query.by : spanDays > 120 ? "month" : "week";
  const report = await getAnalytics(from, to, granularity);
  const custom = Boolean(customFrom && customTo);

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Date range" className="flex flex-wrap gap-2">
          {PRESETS.map((item) => (
            <Link
              key={item.id}
              href={`/analytics?range=${item.id}`}
              scroll={false}
              aria-current={!custom && item.id === presetId ? "page" : undefined}
              className={cn(
                "rounded-[9px] border border-[#e4eae3] bg-white px-3 py-2 text-[11px] font-bold text-[#73827a]",
                !custom && item.id === presetId && "border-brand bg-brand text-white",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <form action="/analytics" className="flex flex-wrap items-end gap-2 text-[11px] text-[#657c6b]">
          <label className="flex flex-col gap-1 font-bold">
            From
            <input
              type="date"
              name="from"
              defaultValue={from}
              max={today}
              className="h-9 rounded-[9px] border border-line bg-white px-2 font-normal text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 font-bold">
            To
            <input
              type="date"
              name="to"
              defaultValue={to}
              max={today}
              className="h-9 rounded-[9px] border border-line bg-white px-2 font-normal text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 font-bold">
            Group by
            <select
              name="by"
              defaultValue={granularity}
              className="h-9 rounded-[9px] border border-line bg-white px-2 font-normal text-ink"
            >
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          </label>
          <button
            type="submit"
            className="h-9 rounded-[9px] border border-[#e0e8e0] bg-white px-3 font-bold text-[#314b3c] hover:bg-[#f3f7f3]"
          >
            Apply
          </button>
        </form>
      </div>

      <p className="mb-4 text-[11px] text-faint">
        Applications submitted {formatDateOnly(from)} – {formatDateOnly(to)}. Rates count each application
        once, however many interviews or offer revisions it had.
      </p>

      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:gap-3.5 xl:grid-cols-4">
        <MetricCard
          icon={Briefcase}
          label="Applications sent"
          value={report.submitted}
          footnote={`${report.active} open · ${report.closed} closed`}
        />
        <MetricCard
          icon={Users}
          tone="purple"
          label="Interview invitation rate"
          value={percent(report.interviewRate)}
          footnote={`${report.interviewed} of ${report.submitted} applications`}
        />
        <MetricCard
          icon={Target}
          tone="orange"
          label="Offer rate"
          value={percent(report.offerRate)}
          footnote={`${report.offered} of ${report.submitted} applications`}
        />
        <MetricCard
          icon={Clock}
          tone="blue"
          label="Median response time"
          value={report.medianResponseDays === null ? "–" : `${report.medianResponseDays}d`}
          footnote={`${report.responsesRecorded} response${report.responsesRecorded === 1 ? "" : "s"} recorded`}
        />
      </div>

      {report.submitted === 0 ? (
        <Panel>
          <EmptyState
            icon={BarChart3}
            title="No applications in this range"
            description={
              report.savedNotApplied > 0
                ? `You have ${report.savedNotApplied} saved job(s) you haven't applied to yet. Analytics start once you record applications.`
                : "Record applications to see trends, conversion and source effectiveness."
            }
          />
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <Panel className="min-h-[320px] p-6">
            <h2 className="text-[15px] font-bold tracking-[-0.4px]">Applications over time</h2>
            <p className="mt-1 text-[11px] text-faint">Submitted per {granularity}</p>
            <BarChart
              label={`Applications submitted per ${granularity}`}
              data={report.trend.map((bucket) => ({
                key: bucket.start,
                label: bucket.label,
                value: bucket.count,
              }))}
            />
          </Panel>
          <Panel className="min-h-[320px] p-6">
            <h2 className="text-[15px] font-bold tracking-[-0.4px]">Application conversion</h2>
            <p className="mt-1 text-[11px] text-faint">
              Distinct applications reaching each milestone (furthest stage, interviews and offers)
            </p>
            <HorizontalBars
              rows={report.funnel.map((step) => ({ label: step.label, value: step.count }))}
              total={report.submitted}
            />
          </Panel>
          <Panel className="p-6">
            <h2 className="text-[15px] font-bold tracking-[-0.4px]">Where you found jobs</h2>
            <p className="mt-1 text-[11px] text-faint">Most effective sources by interview rate</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-left text-xs">
                <thead>
                  <tr className="text-[10px] font-bold tracking-[0.5px] text-[#a7b1aa] uppercase">
                    <th scope="col" className="border-b border-line-soft py-2">
                      Source
                    </th>
                    <th scope="col" className="border-b border-line-soft py-2 text-right">
                      Applied
                    </th>
                    <th scope="col" className="border-b border-line-soft py-2 text-right">
                      Interview rate
                    </th>
                    <th scope="col" className="border-b border-line-soft py-2 text-right">
                      Offer rate
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.sources.map((row) => (
                    <tr key={row.source} className="border-b border-[#eef1ed] text-[#74847a] last:border-0">
                      <td className="py-3">{row.source}</td>
                      <td className="py-3 text-right font-bold text-[#365643]">{row.submitted}</td>
                      <td className="py-3 text-right">
                        {percent(row.interviewRate)} <span className="text-faint">({row.interviewed})</span>
                      </td>
                      <td className="py-3 text-right">
                        {percent(row.offerRate)} <span className="text-faint">({row.offers})</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel className="p-6">
            <h2 className="text-[15px] font-bold tracking-[-0.4px]">Open applications by stage</h2>
            <p className="mt-1 text-[11px] text-faint">Current stage of applications still in progress</p>
            {report.byStage.length ? (
              <HorizontalBars
                rows={report.byStage.map((row) => ({ label: row.name, value: row.count }))}
                total={report.active}
              />
            ) : (
              <p className="mt-4 text-xs text-faint">No open applications in this range.</p>
            )}
            {report.outcomes.length ? (
              <>
                <h3 className="mt-6 mb-2 text-[11px] font-extrabold tracking-[1px] text-[#87998c] uppercase">
                  Closed outcomes
                </h3>
                <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-[#74847a]">
                  {report.outcomes.map((row) => (
                    <li key={row.outcome}>
                      {APPLICATION_OUTCOME_LABEL[row.outcome]} <b className="text-[#365643]">{row.count}</b>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </Panel>
          <Panel className="p-6 lg:col-span-2">
            <h2 className="text-[15px] font-bold tracking-[-0.4px]">A note about your numbers</h2>
            <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-4 text-xs leading-relaxed text-[#88968b]">
              <li>
                The cohort is every application submitted in the selected range. Recent applications may not
                have had time to hear back yet, so rates for an open cohort can still rise.
              </li>
              <li>
                Closed applications are included, so rejected attempts still count toward how far you got.
              </li>
              <li>
                Response time only uses responses you recorded with &ldquo;Record employer response&rdquo;;
                unrecorded ones are treated as unknown, never guessed.
              </li>
              <li>Salaries are never compared across currencies or pay periods.</li>
            </ul>
          </Panel>
        </div>
      )}
    </>
  );
}
