import {
  extensionJobDraftSchema,
  fieldErrorsFrom,
  type ExtensionSaveResult,
} from "@jobtrack/shared/extension-api";
import {
  extensionError,
  extensionJson,
  readExtensionJson,
  withExtensionAuth,
} from "@/features/extension/api";
import { saveExtensionJob } from "@/features/extension/save";
import { extensionSaveSchema } from "@/features/extension/schemas";
import { runAction } from "@/lib/action-result";
import { appEnv } from "@/lib/env";
import { revalidateWorkspace } from "@/lib/revalidate";

/**
 * Saves a job the user reviewed in the extension. The draft is validated
 * again with Quick Add's schema (extended with the contact and to-do), so both
 * paths store identical job data.
 */
export async function POST(request: Request) {
  return withExtensionAuth(request, async ({ workspace }) => {
    const body = await readExtensionJson(request);
    if ("error" in body) return body.error;

    const draft = extensionJobDraftSchema.safeParse(body.value);
    if (!draft.success) {
      return extensionError(400, "Please check the highlighted fields.", fieldErrorsFrom(draft.error));
    }
    const parsed = extensionSaveSchema.safeParse(draft.data);
    if (!parsed.success) {
      return extensionError(400, "Please check the highlighted fields.", fieldErrorsFrom(parsed.error));
    }

    const result = await runAction(() => saveExtensionJob(workspace, parsed.data));
    if (!result.ok) return extensionError(422, result.error);
    revalidateWorkspace();
    return extensionJson(
      {
        id: result.data.id,
        applicationId: result.data.applicationId,
        contactId: result.data.contactId,
        taskId: result.data.taskId,
        url: `${appEnv().APP_URL}/jobs/${result.data.id}`,
      } satisfies ExtensionSaveResult,
      201,
    );
  });
}
