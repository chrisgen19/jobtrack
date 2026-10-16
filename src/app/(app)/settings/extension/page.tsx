import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ExtensionConnections } from "@/features/extension/components/extension-connections";
import { listExtensionTokens } from "@/features/extension/tokens";
import { SettingsCard } from "@/features/settings/components/settings-card";
import { requireWorkspace } from "@/features/workspace/data";
import { formatInTimeZone } from "@/lib/dates";

export const metadata: Metadata = { title: "Browser extension" };

export default function ExtensionSettingsPage() {
  return (
    <SettingsCard
      title="Browser extension"
      description="The JobTrack extension saves job postings from the page you're viewing. Each connected browser appears below; disconnecting one stops it immediately."
    >
      <Suspense fallback={<Skeleton className="h-24 rounded-xl" />}>
        <Connections />
      </Suspense>
      <p className="mt-4 rounded-[9px] bg-[#f4f7f2] px-3.5 py-3 text-[11px] leading-relaxed text-[#829082]">
        Privacy: the extension reads a page only when you open it on that page, and sends nothing until you
        review the details and click Save. It can save jobs and check for duplicates, but can&apos;t read the
        rest of your workspace.
      </p>
    </SettingsCard>
  );
}

async function Connections() {
  const [tokens, { preferences }] = await Promise.all([listExtensionTokens(), requireWorkspace()]);
  const format = (date: Date) => formatInTimeZone(date, preferences.timezone, "MMM d, yyyy");
  return (
    <ExtensionConnections
      connections={tokens.map((token) => ({
        id: token.id,
        name: token.name,
        connected: format(token.createdAt),
        lastUsed: token.lastUsedAt ? format(token.lastUsedAt) : "never",
      }))}
    />
  );
}
