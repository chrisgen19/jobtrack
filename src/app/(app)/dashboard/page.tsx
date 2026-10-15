import { Briefcase, CalendarDays, Clock, Target } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboard } from "@/features/dashboard/data";
import { FocusTasks } from "@/features/dashboard/components/focus-tasks";
import { InterviewAgenda } from "@/features/dashboard/components/interview-agenda";
import { NeedsAttention } from "@/features/dashboard/components/needs-attention";
import { PipelineOverviewPanel } from "@/features/dashboard/components/pipeline-overview";
import { RecentActivity } from "@/features/dashboard/components/recent-activity";
import { WatchList } from "@/features/dashboard/components/watch-list";
import { TaskList } from "@/features/tasks/components/task-list";
import { formatDateOnly } from "@/lib/dates";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const data = await getDashboard();
  const { metrics } = data;
  return (
    <>
      <PageHeader
        eyebrow={formatDateOnly(data.today, "EEEE, MMMM d, yyyy")}
        title="A clearer path to your next role."
        description="Here's your job search at a glance. Stay focused on what matters next."
      />
      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:gap-3.5 xl:grid-cols-4">
        <MetricCard
          icon={Briefcase}
          label="Active applications"
          value={metrics.activeApplications}
          footnote={
            <>
              <b>{metrics.savedJobs} saved</b> · {metrics.pausedApplications} paused
            </>
          }
        />
        <MetricCard
          icon={CalendarDays}
          tone="purple"
          label="Upcoming interviews"
          value={metrics.upcomingInterviews}
          footnote={
            <>
              <b>{metrics.interviewsThisWeek} this week</b> · Keep preparing
            </>
          }
        />
        <MetricCard
          icon={Clock}
          tone="orange"
          label="Follow-ups due"
          value={metrics.followUpsDue}
          footnote={
            metrics.overdueTasks > 0 ? (
              <span className="font-bold text-[#be7255]">
                {metrics.overdueTasks} overdue · needs attention
              </span>
            ) : (
              "Nothing overdue"
            )
          }
        />
        <MetricCard
          icon={Target}
          tone="blue"
          label="Offers received"
          value={metrics.applicationsWithOffers}
          footnote={
            metrics.pendingOffers > 0 ? (
              <>
                <b>{metrics.pendingOffers} awaiting decision</b>
              </>
            ) : (
              "Keep going"
            )
          }
        />
      </div>

      <NeedsAttention data={data} />

      <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1.62fr)_minmax(295px,1fr)]">
        <PipelineOverviewPanel pipeline={data.pipeline} />
        <InterviewAgenda interviews={data.upcomingInterviews} timezone={data.timezone} />
      </div>

      <div className="mb-5 grid items-start gap-4 lg:grid-cols-[minmax(0,1.62fr)_minmax(295px,1fr)]">
        <WatchList applications={data.watchList} />
        <FocusTasks count={data.focusTasks.length}>
          <TaskList tasks={data.focusTasks} timezone={data.timezone} today={data.today} compact />
        </FocusTasks>
      </div>

      <RecentActivity items={data.recentActivity} timezone={data.timezone} />
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard">
      <Skeleton className="mb-3 h-4 w-48" />
      <Skeleton className="mb-8 h-9 w-80 max-w-full" />
      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-[143px] rounded-2xl" />
        ))}
      </div>
      <Skeleton className="mb-5 h-40 rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}
