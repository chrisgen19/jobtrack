import { Download, FileJson } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteAccountForm } from "@/features/account/components/delete-account-form";
import { SettingsCard, SettingsRow } from "@/features/settings/components/settings-card";
import { requireWorkspace } from "@/features/workspace/data";

export const metadata: Metadata = { title: "Account & data" };

export default function AccountSettingsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <AccountSettings />
    </Suspense>
  );
}

async function AccountSettings() {
  const { user } = await requireWorkspace();
  return (
    <div className="grid gap-4">
      <SettingsCard title="Export your data" description="Your data belongs to you. Download it any time.">
        <SettingsRow
          title="Applications spreadsheet (CSV)"
          description="One row per application attempt, plus saved jobs. Opens in Excel or Google Sheets."
          action={
            <Button asChild variant="outline">
              <a href="/api/export/applications.csv" download>
                <Download aria-hidden /> CSV
              </a>
            </Button>
          }
        />
        <SettingsRow
          title="Full backup (JSON)"
          description="Jobs, applications, stages, interviews, tasks, offers, contacts, history and document details. Document files download from the library."
          action={
            <Button asChild variant="outline">
              <a href="/api/export/workspace.json" download>
                <FileJson aria-hidden /> JSON
              </a>
            </Button>
          }
        />
      </SettingsCard>
      <SettingsCard
        title="Delete account"
        description="Permanently deletes your account, every job, application, interview, task, offer and contact, and your uploaded files. Database backups taken before the deletion expire according to the retention policy in docs/BACKUP_AND_RECOVERY.md."
      >
        <DeleteAccountForm email={user.email} />
      </SettingsCard>
    </div>
  );
}
