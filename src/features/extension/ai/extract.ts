import "server-only";
import { createHash } from "node:crypto";
import type { ExtensionExtractRequest, ExtensionExtractResult } from "@jobtrack/shared/extension-api";
import { normalizePostingUrl } from "@/features/opportunities/normalize";
import type { Workspace } from "@/features/workspace/data";
import { todayInTimeZone } from "@/lib/dates";
import { aiSettings, AiProviderError, requestJobExtraction } from "@/lib/integrations/anthropic/client";
import { errorMessage, logger } from "@/lib/logger";
import { buildUserMessage, PROMPT_VERSION } from "./prompt";
import {
  cacheSuggestions,
  readCachedSuggestions,
  recordTokens,
  refundRequest,
  requestsOn,
  requestsThisMonth,
  reserveRequest,
} from "./quota";
import { toSuggestions, withoutFilled } from "./suggestions";

export type ExtractOutcome =
  { ok: true; result: ExtensionExtractResult } | { ok: false; status: 403 | 422 | 429 | 503; error: string };

type Input = Required<Pick<ExtensionExtractRequest, "text">> &
  Omit<ExtensionExtractRequest, "text" | "filledFields"> & {
    filledFields: NonNullable<ExtensionExtractRequest["filledFields"]>;
  };

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** Same posting text and link, model and prompt -> same suggestions (form contents aren't part of it). */
const cacheKeyOf = (model: string, input: Input) =>
  sha256([PROMPT_VERSION, model, normalizePostingUrl(input.postingUrl) ?? "", sha256(input.text)].join("|"));

const fail = (status: 403 | 422 | 429 | 503, error: string): ExtractOutcome => ({ ok: false, status, error });

/**
 * "Improve with AI" for one posting: checks the switch and the user's
 * opt-in, serves a cached answer for free, enforces the monthly and daily
 * limits, asks the model and returns only checked suggestions for fields the
 * form is missing. Logs IDs and counts only, never the posting text.
 */
export async function suggestJobFields(
  { user, preferences }: Workspace,
  input: Input,
  signal?: AbortSignal,
): Promise<ExtractOutcome> {
  const env = aiSettings();
  if (!env) return fail(503, "AI suggestions aren't available on this JobTrack server.");
  if (!preferences.aiSuggestions) {
    return fail(403, "Turn on AI suggestions in JobTrack under Settings → Browser extension first.");
  }
  const today = todayInTimeZone(preferences.timezone);
  const cacheKey = cacheKeyOf(env.model, input);
  const cached = await readCachedSuggestions(user.id, cacheKey);
  if (cached) {
    const remainingToday = Math.max(0, env.dailyRequestsPerUser - (await requestsOn(user.id, today)));
    return {
      ok: true,
      result: { suggestions: withoutFilled(cached, input.filledFields), cached: true, remainingToday },
    };
  }
  if ((await requestsThisMonth(today)) >= env.monthlyRequestLimit) {
    return fail(503, "AI suggestions are paused on this server until next month.");
  }
  const used = await reserveRequest(user.id, today, env.dailyRequestsPerUser);
  if (used === null) return fail(429, "You've used today's AI suggestions. They reset at midnight.");

  const message = buildUserMessage({
    today,
    postingUrl: input.postingUrl,
    pageTitle: input.pageTitle,
    text: input.text,
  });
  let response;
  try {
    response = await requestJobExtraction(message, signal);
  } catch (error) {
    await refundRequest(user.id, today);
    if (!(error instanceof AiProviderError)) throw error;
    logger.warn("ai suggestions: provider error", {
      userId: user.id,
      kind: error.kind,
      error: errorMessage(error),
    });
    return error.kind === "config"
      ? fail(503, "AI suggestions aren't available right now.")
      : fail(503, "The AI service is busy. Try again in a minute.");
  }
  await recordTokens(user.id, today, response.inputTokens, response.outputTokens);
  logger.info("ai suggestions: answered", {
    userId: user.id,
    stopReason: response.stopReason,
    // Nested: the logger redacts keys that contain "token".
    usage: { input: response.inputTokens, output: response.outputTokens },
  });
  if (!response.output) return fail(422, "Couldn't suggest details for this page. Fill them in yourself.");

  const suggestions = toSuggestions(response.output, today);
  await cacheSuggestions(user.id, cacheKey, suggestions);
  const remainingToday = Math.max(0, env.dailyRequestsPerUser - used);
  return {
    ok: true,
    result: { suggestions: withoutFilled(suggestions, input.filledFields), cached: false, remainingToday },
  };
}
