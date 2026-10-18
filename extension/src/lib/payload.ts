import {
  extensionJobDraftSchema,
  fieldErrorsFrom,
  type ExtensionJobDraft,
} from "@jobtrack/shared/extension-api";
import type { DraftValues } from "./draft";

export type FieldErrors = Partial<Record<keyof DraftValues, string>>;

/**
 * API payload from the form. Application fields are sent only when "already
 * applied" is on, the contact only when "save as contact" is, and the to-do
 * only for a job not applied to yet.
 */
export function toPayload(values: DraftValues): ExtensionJobDraft {
  const {
    alreadyApplied,
    appliedOn,
    stageId,
    method,
    saveContact,
    contactName,
    contactTitle,
    contactEmail,
    contactLinkedinUrl,
    contactKind,
    addFollowUp,
    followUpType,
    followUpDate,
    ...job
  } = values;
  return {
    ...job,
    ...(alreadyApplied ? { alreadyApplied, appliedOn, stageId, method } : {}),
    ...(saveContact
      ? {
          contact: {
            name: contactName,
            title: contactTitle,
            email: contactEmail,
            linkedinUrl: contactLinkedinUrl,
            kind: contactKind,
          },
        }
      : {}),
    ...(addFollowUp && !alreadyApplied ? { followUp: { type: followUpType, dueDate: followUpDate } } : {}),
  };
}

/** Form field for an error on a nested payload path ("contact.email"), or on the object itself. */
const NESTED_FIELD: Record<string, keyof DraftValues> = {
  contact: "contactName",
  "contact.name": "contactName",
  "contact.title": "contactTitle",
  "contact.email": "contactEmail",
  "contact.linkedinUrl": "contactLinkedinUrl",
  "contact.kind": "contactKind",
  followUp: "followUpDate",
  "followUp.type": "followUpType",
  "followUp.dueDate": "followUpDate",
};

/** First message per form field from the API's (or the client check's) fieldErrors. */
export function firstErrors(fieldErrors: Record<string, string[] | undefined> | undefined): FieldErrors {
  const output: FieldErrors = {};
  for (const [key, messages] of Object.entries(fieldErrors ?? {})) {
    // "requiredSkills.3" (one list item) belongs to the list's field.
    const path = key.replace(/\.\d+$/, "");
    const field = NESTED_FIELD[path] ?? (path as keyof DraftValues);
    if (messages?.[0] && !output[field]) output[field] = messages[0];
  }
  return output;
}

/** Client-side check with the shared contract before calling the API. */
export function validateDraft(values: DraftValues): FieldErrors {
  const parsed = extensionJobDraftSchema.safeParse(toPayload(values));
  if (parsed.success) return {};
  return firstErrors(fieldErrorsFrom(parsed.error));
}
