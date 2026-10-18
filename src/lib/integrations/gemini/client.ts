import "server-only";
import { z } from "zod";
import { aiExtractionSchema, SYSTEM_PROMPT, type AiExtraction } from "@/features/extension/ai/prompt";
import { aiEnv } from "@/lib/env";

/**
 * Minimal Gemini Interactions API client over fetch, for "Improve with AI".
 * https://ai.google.dev/api/interactions-api
 */

const INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

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
 * limit, overload, timeout, network: try again later), "config" (bad or
 * revoked key, unknown model, billing: an operator problem) or "rejected"
 * (the request itself was refused, e.g. too long).
 */
export class AiProviderError extends Error {
  constructor(
    readonly kind: "busy" | "config" | "rejected",
    message: string,
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
  if (status === 429 || status === 408 || status >= 500) return new AiProviderError("busy", message);
  if ([401, 402, 403, 404].includes(status) || CONFIG_CODES.has(code)) {
    return new AiProviderError("config", message);
  }
  return new AiProviderError("rejected", message);
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

/**
 * Asks the model for the posting's fields as structured JSON. No tools are
 * offered, so injected text in the posting can only change suggestions the
 * user reviews, and `store: false` keeps Google from storing the interaction
 * for later retrieval. Flash-Lite models think at "minimal" (field extraction
 * needs little reasoning); others at "low", the lowest level every Flash and
 * Pro model accepts.
 */
export async function requestJobExtraction(
  userMessage: string,
  signal?: AbortSignal,
): Promise<ExtractionResult> {
  const env = aiSettings();
  if (!env) throw new AiProviderError("config", "GEMINI_API_KEY is not set.");
  let response: Response;
  try {
    response = await fetch(INTERACTIONS_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": env.apiKey },
      body: JSON.stringify({
        model: env.model,
        system_instruction: SYSTEM_PROMPT,
        input: userMessage,
        store: false,
        generation_config: {
          max_output_tokens: MAX_OUTPUT_TOKENS,
          thinking_level: env.model.includes("flash-lite") ? "minimal" : "low",
        },
        response_format: { type: "text", mime_type: "application/json", schema: OUTPUT_SCHEMA },
      }),
      signal: AbortSignal.any([AbortSignal.timeout(env.timeoutMs), ...(signal ? [signal] : [])]),
    });
  } catch (error) {
    // The caller gave up (client went away): not a provider problem.
    if (signal?.aborted) throw error;
    throw new AiProviderError("busy", error instanceof Error ? error.message : "Gemini request failed.");
  }
  if (!response.ok) throw await providerError(response);

  const interaction = (await response.json()) as Interaction;
  const usage = interaction.usage ?? {};
  const status = interaction.status ?? null;
  const output = status === "completed" ? parseOutput(outputText(interaction)) : null;
  return {
    output,
    stopReason: status === "completed" && !output ? "unparsable" : status,
    inputTokens: usage.total_input_tokens ?? 0,
    // Thinking tokens are billed as output.
    outputTokens: (usage.total_output_tokens ?? 0) + (usage.total_thought_tokens ?? 0),
  };
}
