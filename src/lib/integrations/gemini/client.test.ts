import { afterEach, describe, expect, it, vi } from "vitest";
import { AiProviderError, FALLBACK_MODEL, requestJobExtraction } from "./client";

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
const providerError = (status: number, code: string) => json({ error: { code, message: "nope" } }, status);
/** A fetch that never answers, only rejects when its signal aborts. */
const hang = (_url: unknown, init?: RequestInit) =>
  new Promise<Response>((_, reject) =>
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason)),
  );
const sentBody = (spy: ReturnType<typeof fetchMock>, call: number) =>
  JSON.parse(String(spy.mock.calls[call]![1]?.body)) as {
    model: string;
    generation_config: { thinking_level: string };
  };
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
    expect(result).toEqual({
      output: extraction,
      stopReason: "completed",
      inputTokens: 10,
      outputTokens: 7,
      model: "gemini-3.8-flash",
    });

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
    const cases: [number, string, AiProviderError["kind"]][] = [
      [429, "rate_limit_exceeded", "busy"],
      [503, "service_unavailable", "busy"],
      [504, "deadline_exceeded", "busy"],
      [401, "authentication", "config"],
      [402, "payment_required", "config"],
      [404, "model_not_found", "config"],
      [400, "failed_precondition", "config"],
      [400, "invalid_request", "rejected"],
    ];
    for (const [status, code, kind] of cases) {
      // A fresh response per call: 429 and 503 are asked again on the fallback model.
      fetchMock().mockImplementation(async () => providerError(status, code));
      await expect(requestJobExtraction("m")).rejects.toMatchObject({
        name: "AiProviderError",
        kind,
        status,
      });
    }
    fetchMock().mockRejectedValue(new TypeError("fetch failed"));
    await expect(requestJobExtraction("m")).rejects.toMatchObject({ kind: "busy" });
  });

  it("asks the fallback model once when the model is overloaded or rate limited", async () => {
    for (const [status, code] of [
      [503, "service_unavailable"],
      [429, "rate_limit_exceeded"],
    ] as const) {
      const spy = fetchMock();
      spy
        .mockClear()
        .mockResolvedValueOnce(providerError(status, code))
        .mockResolvedValueOnce(json(answered(JSON.stringify(extraction))));
      expect(await requestJobExtraction("m")).toMatchObject({ output: extraction, model: FALLBACK_MODEL });
      expect(spy).toHaveBeenCalledTimes(2);
      expect(sentBody(spy, 0).model).toBe("gemini-3.8-flash");
      expect(sentBody(spy, 1)).toMatchObject({
        model: "gemini-3.5-flash-lite",
        generation_config: { thinking_level: "minimal" },
      });
    }
  });

  it("doesn't fall back on other errors, and reports the fallback's own failure", async () => {
    const spy = fetchMock();
    for (const [status, code] of [
      [500, "internal"],
      [504, "deadline_exceeded"],
      [401, "authentication"],
      [400, "invalid_request"],
    ] as const) {
      spy.mockClear().mockImplementation(async () => providerError(status, code));
      await expect(requestJobExtraction("m")).rejects.toMatchObject({ status });
      expect(spy).toHaveBeenCalledTimes(1);
    }

    spy
      .mockClear()
      .mockResolvedValueOnce(providerError(503, "service_unavailable"))
      .mockResolvedValueOnce(providerError(404, "model_not_found"));
    await expect(requestJobExtraction("m")).rejects.toMatchObject({ kind: "config", status: 404 });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("doesn't ask the fallback when it is the configured model", async () => {
    settings.model = FALLBACK_MODEL;
    try {
      const spy = fetchMock();
      for (const [status, code] of [
        [503, "service_unavailable"],
        [429, "rate_limit_exceeded"],
      ] as const) {
        spy.mockClear().mockImplementation(async () => providerError(status, code));
        await expect(requestJobExtraction("m")).rejects.toMatchObject({ kind: "busy", status });
        expect(spy).toHaveBeenCalledTimes(1);
      }
    } finally {
      settings.model = "gemini-3.8-flash";
    }
  });

  it("reports a timeout as its own kind, with one deadline across both models", async () => {
    settings.timeoutMs = 50;
    try {
      const spy = fetchMock().mockImplementation(hang);
      await expect(requestJobExtraction("m")).rejects.toMatchObject({
        name: "AiProviderError",
        kind: "timeout",
      });
      expect(spy).toHaveBeenCalledTimes(1); // a timeout isn't asked again

      spy
        .mockClear()
        .mockResolvedValueOnce(providerError(503, "service_unavailable"))
        .mockImplementation(hang);
      const started = performance.now();
      await expect(requestJobExtraction("m")).rejects.toMatchObject({ kind: "timeout" });
      expect(spy).toHaveBeenCalledTimes(2);
      expect(performance.now() - started).toBeLessThan(1_000);
    } finally {
      settings.timeoutMs = 20_000;
    }
  });

  it("rethrows when the caller aborts", async () => {
    const controller = new AbortController();
    controller.abort();
    fetchMock().mockRejectedValueOnce(new DOMException("aborted", "AbortError"));
    await expect(requestJobExtraction("m", controller.signal)).rejects.not.toBeInstanceOf(AiProviderError);
  });
});
