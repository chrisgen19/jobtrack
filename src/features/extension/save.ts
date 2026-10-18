import "server-only";
import { setCompanyWebsiteIfEmpty } from "@/features/companies/data";
import { createOrReuseContactInTx } from "@/features/contacts/data";
import { createOpportunityInTx } from "@/features/opportunities/data";
import { createTaskInTx } from "@/features/tasks/data";
import type { Workspace } from "@/features/workspace/data";
import { DomainError } from "@/lib/action-result";
import { todayInTimeZone } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import type { ExtensionSaveInput } from "./schemas";

export type ExtensionSaveOutcome = {
  id: string;
  applicationId: string | null;
  contactId: string | null;
  taskId: string | null;
};

/**
 * Saves a job reviewed in the extension, with its optional company website,
 * contact and to-do, in one transaction: an invalid to-do saves nothing.
 */
export async function saveExtensionJob(
  workspace: Workspace,
  input: ExtensionSaveInput,
): Promise<ExtensionSaveOutcome> {
  const { user, preferences } = workspace;
  if (input.followUp && input.followUp.dueDate < todayInTimeZone(preferences.timezone)) {
    throw new DomainError("Choose today or a later date for the to-do.");
  }
  return prisma.$transaction(async (tx) => {
    const job = await createOpportunityInTx(tx, workspace, input);
    if (input.companyWebsite) {
      await setCompanyWebsiteIfEmpty(tx, user.id, job.companyId, input.companyWebsite);
    }
    const contactId = input.contact
      ? await createOrReuseContactInTx(tx, user.id, job.companyId, input.contact)
      : null;
    const taskId = input.followUp
      ? await createTaskInTx(
          tx,
          { userId: user.id, timezone: preferences.timezone },
          {
            title:
              input.followUp.title ??
              (input.followUp.type === "APPLY"
                ? `Apply for ${input.title} at ${input.companyName.trim()}`
                : `Follow up on ${input.title} at ${input.companyName.trim()}`),
            type: input.followUp.type === "APPLY" ? "APPLICATION" : "FOLLOW_UP",
            priority: input.priority,
            dueDate: input.followUp.dueDate,
            opportunityId: job.id,
            reminderMinutesBefore: preferences.taskReminderMinutes,
          },
        )
      : null;
    return { id: job.id, applicationId: job.applicationId, contactId, taskId };
  });
}
