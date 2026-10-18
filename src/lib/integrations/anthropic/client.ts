import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { aiExtractionSchema, SYSTEM_PROMPT, type AiExtraction } from "@/features/extension/ai/prompt";
import { aiEnv } from "@/lib/env";

/** The structured output is a few hundred tokens; this leaves room without risking a runaway. */
const MAX_OUTPUT_TOKENS = 2_000;

/**
 * A provider failure, sorted by what the caller should do: "busy" (rate
 * limit, overload, timeout, network: try again later), "config" (bad or
 * revoked key, unknown model: an operator problem) or "rejected" (the
 * request itself was refused, e.g. too long).
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
  /** null when the model refused or its output was cut off or didn't match the schema. */
  output: AiExtraction | null;
  stopReason: string | null;
  inputTokens: number;
  outputTokens: number;
};

let client: Anthropic | null = null;

function getClient(env: NonNullable<ReturnType<typeof aiEnv>>): Anthropic {
  // The key is passed explicitly so a developer's own `ant auth login`
  // profile can never switch the feature on for a server without a key.
  client ??= new Anthropic({ apiKey: env.apiKey, timeout: env.timeoutMs, maxRetries: 1 });
  return client;
}

/** Model, limits and key for AI suggestions, or null when this server has no AI key (the off switch). */
export const aiSettings = () => aiEnv();

/** Whether this server has an AI key. */
export const isAiConfigured = (): boolean => aiSettings() !== null;

/** Maps SDK errors to AiProviderError; anything else is rethrown. */
function providerError(error: unknown): never {
  if (
    error instanceof Anthropic.RateLimitError ||
    error instanceof Anthropic.InternalServerError ||
    error instanceof Anthropic.APIConnectionError
  ) {
    throw new AiProviderError("busy", error.message);
  }
  if (
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError ||
    error instanceof Anthropic.NotFoundError
  ) {
    throw new AiProviderError("config", error.message);
  }
  if (error instanceof Anthropic.APIError && error.status !== undefined) {
    throw new AiProviderError(error.status >= 500 ? "busy" : "rejected", error.message);
  }
  throw error;
}

/**
 * Asks the model for the posting's fields as structured output. No tools are
 * offered, so injected text in the posting can only change suggestions the
 * user reviews. Haiku runs with thinking off at low effort (field extraction
 * needs no reasoning); other models keep their default thinking at low effort.
 */
export async function requestJobExtraction(
  userMessage: string,
  signal?: AbortSignal,
): Promise<ExtractionResult> {
  const env = aiSettings();
  if (!env) throw new AiProviderError("config", "ANTHROPIC_API_KEY is not set.");
  try {
    const response = await getClient(env).messages.parse(
      {
        model: env.model,
        max_tokens: MAX_OUTPUT_TOKENS,
        ...(env.model.startsWith("claude-haiku") ? { thinking: { type: "disabled" as const } } : {}),
        output_config: { effort: "low", format: zodOutputFormat(aiExtractionSchema) },
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      },
      { signal },
    );
    const complete = response.stop_reason !== "refusal" && response.stop_reason !== "max_tokens";
    return {
      output: complete ? response.parsed_output : null,
      stopReason: response.stop_reason,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  } catch (error) {
    if (error instanceof Anthropic.APIUserAbortError) throw error;
    // The SDK's own structured-output check (output cut off, or not the schema): no usable answer.
    if (error instanceof Anthropic.AnthropicError && !(error instanceof Anthropic.APIError)) {
      return { output: null, stopReason: "unparsable", inputTokens: 0, outputTokens: 0 };
    }
    return providerError(error);
  }
}
