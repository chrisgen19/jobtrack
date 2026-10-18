import { afterEach, describe, expect, it, vi } from "vitest";
import { AiProviderError, requestJobExtraction } from "./client";

const settings = vi.hoisted(() => ({
  apiKey: "test-key",
  model: "gemini-3.8-flash",
  dailyRequestsPerUser: 25,
  monthlyRequestLimit: 3000,
  timeoutMs: 20_000,
}));
vi.mock("@/lib/env", () => ({ aiEnv: () => settings }));

const fetchMock = () => vi.spyOn(globalThis, "fetch");
const json = (body: unknown, status = 200) => Response.json(body, { status });
const answered = (text: string, status = "completed") => ({
  id: "int_1",
  status,
  steps: [
    { type: "thought", signature: "c2ln" },
    { type: "model_output", content: [{ type: "text", text }] },
  ],
  usage: { total_input_tokens: 10, total_output_tokens: 5, total_thought_tokens: 2 },
});

const extraction = {
  title: "Dev",
  companyName: null,
  location: null,
  workArrangement: null,
  employmentType: null,
  salaryMin: null,
  salaryMax: null,
  currency: null,
  salaryPeriod: null,
  salaryBasis: null,
  requiredSkills: [],
  deadline: null,
  referenceCode: null,
  companyWebsite: null,
  contactName: null,
  contactTitle: null,
  contactEmail: null,
  contactLinkedinUrl: null,
};

afterEach(() => vi.restoreAllMocks());

describe("requestJobExtraction", () => {
  it("asks the model at low thinking for JSON matching the schema, without storing it", async () => {
    const spy = fetchMock().mockResolvedValue(json(answered(JSON.stringify(extraction))));
    const result = await requestJobExtraction("<page_text>x</page_text>");
    expect(result).toEqual({ output: extraction, stopReason: "completed", inputTokens: 10, outputTokens: 7 });

    const [url, init] = spy.mock.calls[0]!;
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/interactions");
    expect(new Headers(init?.headers).get("x-goog-api-key")).toBe("test-key");
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      model: "gemini-3.8-flash",
      input: "<page_text>x</page_text>",
      store: false,
      generation_config: { max_output_tokens: 2000, thinking_level: "low" },
      response_format: { type: "text", mime_type: "application/json" },
    });
    expect(body.response_format.schema).toMatchObject({
      type: "object",
      properties: { title: { type: ["string", "null"] } },
    });
    expect(body.response_format.schema).not.toHaveProperty("$schema");
    expect(body).not.toHaveProperty("tools");
  });

  it("thinks at minimal on Flash-Lite models", async () => {
    settings.model = "gemini-3.5-flash-lite";
    try {
      const spy = fetchMock().mockResolvedValue(json(answered(JSON.stringify(extraction))));
      await requestJobExtraction("m");
      expect(JSON.parse(String(spy.mock.calls[0]![1]?.body)).generation_config.thinking_level).toBe(
        "minimal",
      );
    } finally {
      settings.model = "gemini-3.8-flash";
    }
  });

  it("treats a cut-off answer or output that isn't the schema as no answer", async () => {
    fetchMock().mockResolvedValueOnce(json(answered('{"title": "D', "incomplete")));
    expect(await requestJobExtraction("m")).toMatchObject({ output: null, stopReason: "incomplete" });
    fetchMock().mockResolvedValueOnce(json(answered('{"title": 42}')));
    expect(await requestJobExtraction("m")).toMatchObject({ output: null, stopReason: "unparsable" });
    fetchMock().mockResolvedValueOnce(json(answered("not json")));
    expect(await requestJobExtraction("m")).toMatchObject({ output: null, stopReason: "unparsable" });
  });

  it("sorts provider errors into busy, config and rejected", async () => {
    const error = (status: number, code: string) => json({ error: { code, message: "nope" } }, status);
    const cases: [Response, AiProviderError["kind"]][] = [
      [error(429, "rate_limit_exceeded"), "busy"],
      [error(503, "service_unavailable"), "busy"],
      [error(504, "deadline_exceeded"), "busy"],
      [error(401, "authentication"), "config"],
      [error(402, "payment_required"), "config"],
      [error(404, "model_not_found"), "config"],
      [error(400, "failed_precondition"), "config"],
      [error(400, "invalid_request"), "rejected"],
    ];
    for (const [response, kind] of cases) {
      fetchMock().mockResolvedValueOnce(response);
      await expect(requestJobExtraction("m")).rejects.toMatchObject({ name: "AiProviderError", kind });
    }
    fetchMock().mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(requestJobExtraction("m")).rejects.toMatchObject({ kind: "busy" });
  });

  it("rethrows when the caller aborts", async () => {
    const controller = new AbortController();
    controller.abort();
    fetchMock().mockRejectedValueOnce(new DOMException("aborted", "AbortError"));
    await expect(requestJobExtraction("m", controller.signal)).rejects.not.toBeInstanceOf(AiProviderError);
  });
});
