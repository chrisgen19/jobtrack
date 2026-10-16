import { z } from "zod";
import {
  extensionDuplicatesSchema,
  extensionErrorSchema,
  extensionMeSchema,
  extensionSaveResultSchema,
  type ExtensionError,
  type ExtensionJobDraft,
} from "@jobtrack/shared/extension-api";
import { jobtrackUrl } from "./config";
import { tokenItem } from "./storage";

export class ApiError extends Error {
  override name = "ApiError";
  constructor(
    readonly status: number,
    message: string,
    readonly fieldErrors?: ExtensionError["fieldErrors"],
  ) {
    super(message);
  }
}

/** Calls the JobTrack extension API with the stored token; a 401 forgets the token. */
async function call<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
  const token = await tokenItem.getValue();
  if (!token) throw new ApiError(401, "Connect the extension to JobTrack first.");
  let response: Response;
  try {
    response = await fetch(jobtrackUrl(`/api/extension/v1${path}`), {
      ...init,
      credentials: "omit",
      headers: { ...init.headers, authorization: `Bearer ${token}` },
    });
  } catch {
    throw new ApiError(0, "Couldn't reach JobTrack. Check your connection and try again.");
  }
  if (response.status === 401) await tokenItem.removeValue();
  if (!response.ok) {
    const body = extensionErrorSchema.safeParse(await response.json().catch(() => null));
    const message = body.success ? body.data.error : `JobTrack returned an error (${response.status}).`;
    throw new ApiError(response.status, message, body.success ? body.data.fieldErrors : undefined);
  }
  return schema.parse(response.status === 204 ? undefined : await response.json());
}

export const getMe = () => call("/me", extensionMeSchema);

export const findDuplicates = (query: { url?: string; title?: string; company?: string }) =>
  call(
    `/opportunities/duplicates?${new URLSearchParams(Object.entries(query).filter(([, value]) => value))}`,
    extensionDuplicatesSchema,
  );

export const saveJob = (draft: ExtensionJobDraft) =>
  call("/opportunities", extensionSaveResultSchema, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(draft),
  });

/** Revokes the token on the server (best effort) and forgets it locally. */
export async function disconnect(): Promise<void> {
  try {
    await call("/token", z.undefined(), { method: "DELETE" });
  } catch {
    // Already revoked or offline: forgetting it locally is what matters.
  } finally {
    await tokenItem.removeValue();
  }
}
