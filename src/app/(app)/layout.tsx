import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { UserMenu } from "@/components/layout/user-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { countDueTasks } from "@/features/tasks/data";
import { requireUser } from "@/lib/auth/session";

/**
 * Authenticated workspace layout. The chrome is static; anything that reads
 * the session streams in behind its own Suspense boundary.
 */
export default function WorkspaceLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell
      navBadges={{
        "/tasks": (
          <Suspense fallback={null}>
            <DueTaskCount />
          </Suspense>
        ),
      }}
      sidebarFooter={
        <Suspense fallback={<Skeleton className="mx-2 mt-4 h-10 rounded-lg" />}>
          <SidebarProfile />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}

async function SidebarProfile() {
  const user = await requireUser();
  return <UserMenu name={user.name} email={user.email} />;
}

async function DueTaskCount() {
  const count = await countDueTasks();
  if (count === 0) return null;
  return (
    <span
      className="rounded-[7px] bg-[#e9eeea] px-1.5 py-0.5 text-[10px] text-[#5c7165]"
      aria-label={`${count} tasks due`}
    >
      {count}
    </span>
  );
}
