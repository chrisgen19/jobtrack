import { PageHeader } from "@/components/shared/page-header";
import { SettingsNav } from "@/features/settings/components/settings-nav";

export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return (
    <>
      <PageHeader
        eyebrow="Make it yours"
        title="Workspace settings"
        description="Customize how JobTrack supports your search."
      />
      <SettingsNav />
      {children}
    </>
  );
}
