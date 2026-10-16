import type { Metadata } from "next";
import { Suspense } from "react";
import { extensionConnectParamsSchema } from "@jobtrack/shared/extension-api";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { FormAlert } from "@/features/auth/components/auth-card";
import { ConnectExtension } from "@/features/extension/components/connect-extension";
import { SettingsCard } from "@/features/settings/components/settings-card";
import { requireWorkspace } from "@/features/workspace/data";

export const metadata: Metadata = { title: "Connect extension" };

export default function ConnectExtensionPage({ searchParams }: PageProps<"/extension/connect">) {
  return (
    <>
      <PageHeader
        eyebrow="Browser extension"
        title="Connect the extension"
        description="Save job postings from any site straight into JobTrack."
      />
      <div className="max-w-xl">
        <SettingsCard title="Allow access?">
          <Suspense fallback={<Skeleton className="h-40 rounded-xl" />}>
            <Connect searchParams={searchParams} />
          </Suspense>
        </SettingsCard>
      </div>
    </>
  );
}

async function Connect({ searchParams }: { searchParams: PageProps<"/extension/connect">["searchParams"] }) {
  const [query] = await Promise.all([searchParams, requireWorkspace()]);
  const params = extensionConnectParamsSchema.safeParse(query);
  if (!params.success) {
    return (
      <FormAlert>
        This connection link is incomplete or has expired. Open the JobTrack extension and click Connect
        again.
      </FormAlert>
    );
  }
  return <ConnectExtension ext={params.data.ext} state={params.data.state} />;
}
