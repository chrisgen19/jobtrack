import Anthropic from "@anthropic-ai/sdk";
import { Messages } from "@anthropic-ai/sdk/resources/messages/messages";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AiProviderError, requestJobExtraction } from "./client";

vi.mock("@/lib/env", () => ({
  aiEnv: () => ({
    apiKey: "test-key",
    model: "claude-haiku-5-5",
    dailyRequestsPerUser: 25,
    monthlyRequestLimit: 3000,
    timeoutMs: 20_000,
  }),
}));

const parse = () => vi.spyOn(Messages.prototype, "parse");
const headers = new Headers();

afterEach(() => vi.restoreAllMocks());

describe("requestJobExtraction", () => {
  it("asks Haiku with thinking off, low effort and the structured output schema", async () => {
    const spy = parse().mockResolvedValue({
      stop_reason: "end_turn",
      parsed_output: { title: "Dev" },
      usage: { input_tokens: 10, output_tokens: 5 },
    } as never);
    const result = await requestJobExtraction("<page_text>x</page_text>");
    expect(result).toEqual({
      output: { title: "Dev" },
      stopReason: "end_turn",
      inputTokens: 10,
      outputTokens: 5,
    });
    const params = spy.mock.calls[0]![0] as unknown as Record<string, unknown>;
    expect(params).toMatchObject({
      model: "claude-haiku-5-5",
      thinking: { type: "disabled" },
      output_config: { effort: "low", format: { type: "json_schema" } },
    });
    expect(params).not.toHaveProperty("temperature");
    expect(params).not.toHaveProperty("tools");
  });

  it("treats a refusal, a cut-off answer or unparsable output as no answer", async () => {
    parse().mockResolvedValueOnce({
      stop_reason: "refusal",
      parsed_output: { title: "x" },
      usage: { input_tokens: 9, output_tokens: 1 },
    } as never);
    expect((await requestJobExtraction("m")).output).toBeNull();
    parse().mockRejectedValueOnce(new Anthropic.AnthropicError("Failed to parse structured output"));
    expect(await requestJobExtraction("m")).toMatchObject({ output: null, stopReason: "unparsable" });
  });

  it("sorts provider errors into busy, config and rejected", async () => {
    const cases: [Error, AiProviderError["kind"]][] = [
      [new Anthropic.RateLimitError(429, undefined, "slow down", headers), "busy"],
      [new Anthropic.InternalServerError(529, undefined, "overloaded", headers), "busy"],
      [new Anthropic.APIConnectionTimeoutError(), "busy"],
      [new Anthropic.AuthenticationError(401, undefined, "invalid x-api-key", headers), "config"],
      [new Anthropic.NotFoundError(404, undefined, "model not found", headers), "config"],
      [new Anthropic.BadRequestError(400, undefined, "prompt too long", headers), "rejected"],
    ];
    for (const [error, kind] of cases) {
      parse().mockRejectedValueOnce(error);
      await expect(requestJobExtraction("m")).rejects.toMatchObject({ name: "AiProviderError", kind });
    }
  });
});
