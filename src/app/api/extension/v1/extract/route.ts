import { extensionExtractRequestSchema, fieldErrorsFrom } from "@jobtrack/shared/extension-api";
import { suggestJobFields } from "@/features/extension/ai/extract";
import {
  extensionError,
  extensionJson,
  readExtensionJson,
  withExtensionAuth,
} from "@/features/extension/api";
import { rateLimit } from "@/lib/rate-limit";

/** AI calls per token per minute (on top of the general extension limit and the daily quota). */
const AI_REQUESTS_PER_MINUTE = 10;
/** 30,000 characters of non-Latin text can pass 100 KB as UTF-8. */
const MAX_BODY_BYTES = 200_000;

/**
 * "Improve with AI": suggestions for the fields the extension's form is
 * missing, from the posting's text. Opt-in per user; nothing is saved here.
 * Closing the popup aborts the model call (request.signal).
 */
export async function POST(request: Request) {
  return withExtensionAuth(request, async ({ workspace, tokenId }) => {
    const limit = rateLimit(`extension-ai:${tokenId}`, AI_REQUESTS_PER_MINUTE, 60_000);
    if (!limit.allowed) {
      return extensionJson({ error: "Too many AI requests. Try again in a moment." }, 429, {
        "retry-after": String(limit.retryAfterSeconds),
      });
    }
    const body = await readExtensionJson(request, MAX_BODY_BYTES);
    if ("error" in body) return body.error;
    const parsed = extensionExtractRequestSchema.safeParse(body.value);
    if (!parsed.success) {
      return extensionError(400, "Please check the request.", fieldErrorsFrom(parsed.error));
    }
    const outcome = await suggestJobFields(workspace, parsed.data, request.signal);
    return outcome.ok ? extensionJson(outcome.result) : extensionError(outcome.status, outcome.error);
  });
}
