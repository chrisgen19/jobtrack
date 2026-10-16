import { z } from "zod";
import { extensionJobDraftSchema, type ExtensionJobDraft } from "@jobtrack/shared/extension-api";
import type { DraftValues } from "./draft";

export type FieldErrors = Partial<Record<keyof DraftValues, string>>;

/** API payload from the form; application fields are sent only when "already applied" is on. */
export function toPayload(values: DraftValues): ExtensionJobDraft {
  const { alreadyApplied, appliedOn, stageId, ...job } = values;
  return alreadyApplied ? { ...job, alreadyApplied, appliedOn, stageId } : job;
}

/** First message per field from a Zod error or the API's fieldErrors. */
export function firstErrors(fieldErrors: Record<string, string[] | undefined> | undefined): FieldErrors {
  const output: FieldErrors = {};
  for (const [key, messages] of Object.entries(fieldErrors ?? {})) {
    if (messages?.[0]) output[key as keyof DraftValues] = messages[0];
  }
  return output;
}

/** Client-side check with the shared contract before calling the API. */
export function validateDraft(values: DraftValues): FieldErrors {
  const parsed = extensionJobDraftSchema.safeParse(toPayload(values));
  if (parsed.success) return {};
  return firstErrors(z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>);
}
