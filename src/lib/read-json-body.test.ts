import { describe, expect, it } from "vitest";
import { readJsonBody } from "./read-json-body";

const post = (body: BodyInit, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/x", { method: "POST", body, headers, duplex: "half" } as RequestInit);

describe("readJsonBody", () => {
  it("parses JSON within the limit", async () => {
    expect(await readJsonBody(post(JSON.stringify({ a: 1 })), 100)).toEqual({ ok: true, value: { a: 1 } });
  });

  it("rejects invalid JSON and declared oversized bodies", async () => {
    expect(await readJsonBody(post("{nope"), 100)).toEqual({ ok: false, status: 400 });
    expect(await readJsonBody(post("{}", { "content-length": "101" }), 100)).toEqual({
      ok: false,
      status: 413,
    });
  });

  it("cancels a chunked body without Content-Length once it passes the limit", async () => {
    let pulled = 0;
    // Endless stream: the test only finishes if the reader cancels it.
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(new Uint8Array(1024));
      },
    });
    expect(await readJsonBody(post(body), 4 * 1024)).toEqual({ ok: false, status: 413 });
    expect(pulled).toBeLessThan(10);
  });
});
