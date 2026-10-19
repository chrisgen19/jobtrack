import "server-only";
import { z } from "zod";
import { aiExtractionSchema, SYSTEM_PROMPT, type AiExtraction } from "@/features/extension/ai/prompt";
import { aiEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Minimal Gemini Interactions API client over fetch, for "Improve with AI".
 * https://ai.google.dev/api/interactions-api
 */

const INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

/**
 * Asked once when the main model is overloaded or rate limited. In a
 * 2026-10-20 benchmark it answered every call in about 3 s while the Flash
 * models were returning 503s, with near-equal accuracy.
 */
export const FALLBACK_MODEL = "gemini-3.5-flash-lite";

/** Overloaded (503) and rate limited (429): this model can't take it now, another one might. */
const FALLBACK_STATUSES = new Set([429, 503]);

/** The structured output is a few hundred tokens; this leaves room (thinking included) without risking a runaway. */
const MAX_OUTPUT_TOKENS = 2_000;

/** The answer's JSON Schema; Gemini takes a subset of JSON Schema, without the `$schema` keyword. */
const OUTPUT_SCHEMA = (() => {
  const schema: Record<string, unknown> = z.toJSONSchema(aiExtractionSchema);
  delete schema.$schema;
  return schema;
})();

/**
 * A provider failure, sorted by what the caller should do: "busy" (rate
 * limit, overload, network: try again later), "timeout" (no answer within
 * AI_TIMEOUT_MS), "config" (bad or revoked key, unknown model, billing: an
 * operator problem) or "rejected" (the request itself was refused, e.g. too
 * long). `status` is Gemini's HTTP status, when it answered.
 */
export class AiProviderError extends Error {
  constructor(
    readonly kind: "busy" | "timeout" | "config" | "rejected",
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}

export type ExtractionResult = {
  /** null when the model stopped early (status other than completed) or its output didn't match the schema. */
  output: AiExtraction | null;
  stopReason: string | null;
  inputTokens: number;
  outputTokens: number;
  /** The model that answered: the configured one, or FALLBACK_MODEL. */
  model: string;
};

type Interaction = {
  status?: string;
  steps?: { type?: string; content?: { type?: string; text?: string }[] }[];
  usage?: { total_input_tokens?: number; total_output_tokens?: number; total_thought_tokens?: number };
};

/** Model, limits and key for AI suggestions, or null when this server has no AI key (the off switch). */
export const aiSettings = () => aiEnv();

/** Whether this server has an AI key. */
export const isAiConfigured = (): boolean => aiSettings() !== null;

/** Error codes that need an operator (key, model, billing) rather than a retry. */
const CONFIG_CODES = new Set([
  "authentication",
  "permission_denied",
  "model_not_found",
  "payment_required",
  "failed_precondition",
]);

async function providerError(response: Response): Promise<AiProviderError> {
  const body = (await response.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
  const code = body.error?.code ?? `http_${response.status}`;
  const message = `${code}: ${body.error?.message ?? `Gemini API error ${response.status}`}`;
  const { status } = response;
  if (status === 429 || status === 408 || status >= 500) return new AiProviderError("busy", message, status);
  if ([401, 402, 403, 404].includes(status) || CONFIG_CODES.has(code)) {
    return new AiProviderError("config", message, status);
  }
  return new AiProviderError("rejected", message, status);
}

/** The model's text from its output steps (thought steps are skipped). */
const outputText = (interaction: Interaction): string =>
  (interaction.steps ?? [])
    .filter((step) => step.type === "model_output")
    .flatMap((step) => step.content ?? [])
    .map((block) => (block.type === "text" ? (block.text ?? "") : ""))
    .join("");

function parseOutput(text: string): AiExtraction | null {
  try {
    const parsed = aiExtractionSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

type Attempt = { apiKey: string; userMessage: string; deadline: AbortSignal; signal?: AbortSignal };

/**
 * One call to `model`. Flash-Lite models think at "minimal" (field extraction
 * needs little reasoning); others at "low", the lowest level every Flash and
 * Pro model accepts.
 */
async function interact(
  model: string,
  { apiKey, userMessage, deadline, signal }: Attempt,
): Promise<ExtractionResult> {
  let interaction: Interaction;
  try {
    const response = await fetch(INTERACTIONS_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        model,
        system_instruction: SYSTEM_PROMPT,
        input: userMessage,
        store: false,
        generation_config: {
          max_output_tokens: MAX_OUTPUT_TOKENS,
          thinking_level: model.includes("flash-lite") ? "minimal" : "low",
        },
        response_format: { type: "text", mime_type: "application/json", schema: OUTPUT_SCHEMA },
      }),
      signal: AbortSignal.any([deadline, ...(signal ? [signal] : [])]),
    });
    if (!response.ok) throw await providerError(response);
    interaction = (await response.json()) as Interaction;
  } catch (error) {
    // The caller gave up (client went away): not a provider problem.
    if (error instanceof AiProviderError || signal?.aborted) throw error;
    const message = error instanceof Error ? error.message : "Gemini request failed.";
    throw new AiProviderError(deadline.aborted ? "timeout" : "busy", message);
  }

  const usage = interaction.usage ?? {};
  const status = interaction.status ?? null;
  const output = status === "completed" ? parseOutput(outputText(interaction)) : null;
  return {
    output,
    stopReason: status === "completed" && !output ? "unparsable" : status,
    inputTokens: usage.total_input_tokens ?? 0,
    // Thinking tokens are billed as output.
    outputTokens: (usage.total_output_tokens ?? 0) + (usage.total_thought_tokens ?? 0),
    model,
  };
}

/**
 * Asks the model for the posting's fields as structured JSON. No tools are
 * offered, so injected text in the posting can only change suggestions the
 * user reviews, and `store: false` keeps Google from storing the interaction
 * for later retrieval. When the model is overloaded or rate limited, asks
 * FALLBACK_MODEL once, within the same AI_TIMEOUT_MS deadline.
 */
export async function requestJobExtraction(
  userMessage: string,
  signal?: AbortSignal,
): Promise<ExtractionResult> {
  const env = aiSettings();
  if (!env) throw new AiProviderError("config", "GEMINI_API_KEY is not set.");
  const attempt = { apiKey: env.apiKey, userMessage, deadline: AbortSignal.timeout(env.timeoutMs), signal };
  try {
    return await interact(env.model, attempt);
  } catch (error) {
    if (!(error instanceof AiProviderError) || !FALLBACK_STATUSES.has(error.status ?? 0)) throw error;
    logger.warn("ai suggestions: model unavailable, asking the fallback", {
      model: env.model,
      fallback: FALLBACK_MODEL,
      error: error.message,
    });
    return interact(FALLBACK_MODEL, attempt);
  }
}
