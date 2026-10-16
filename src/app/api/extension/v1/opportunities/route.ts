import { z } from "zod";
import { extensionJobDraftSchema, type ExtensionSaveResult } from "@jobtrack/shared/extension-api";
import {
  extensionError,
  extensionJson,
  readExtensionJson,
  withExtensionAuth,
} from "@/features/extension/api";
import { createOpportunityForWorkspace } from "@/features/opportunities/data";
import { quickAddSchema } from "@/features/opportunities/schemas";
import { runAction } from "@/lib/action-result";
import { appEnv } from "@/lib/env";
import { revalidateWorkspace } from "@/lib/revalidate";

type FieldErrors = Record<string, string[] | undefined>;

/**
 * Saves a job the user reviewed in the extension. The draft is validated
 * again with the same schema as Quick Add, so both paths store identical data.
 */
export async function POST(request: Request) {
  return withExtensionAuth(request, async ({ workspace }) => {
    const body = await readExtensionJson(request);
    if ("error" in body) return body.error;

    const draft = extensionJobDraftSchema.safeParse(body.value);
    if (!draft.success) {
      return extensionError(
        400,
        "Please check the highlighted fields.",
        z.flattenError(draft.error).fieldErrors as FieldErrors,
      );
    }
    const parsed = quickAddSchema.safeParse(draft.data);
    if (!parsed.success) {
      return extensionError(
        400,
        "Please check the highlighted fields.",
        z.flattenError(parsed.error).fieldErrors as FieldErrors,
      );
    }

    const result = await runAction(() => createOpportunityForWorkspace(workspace, parsed.data));
    if (!result.ok) return extensionError(422, result.error);
    revalidateWorkspace();
    return extensionJson(
      {
        id: result.data.id,
        applicationId: result.data.applicationId,
        url: `${appEnv().APP_URL}/jobs/${result.data.id}`,
      } satisfies ExtensionSaveResult,
      201,
    );
  });
}
