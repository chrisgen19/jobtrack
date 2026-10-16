/**
 * JSON body reader for Route Handlers with a hard byte limit. The body is
 * read chunk by chunk and the stream cancelled once it passes the limit:
 * chunked requests carry no Content-Length, so checking the header alone
 * would still buffer the whole body. Next.js does not cap Route Handler
 * bodies on its own (proxyClientMaxBodySize only covers proxy.ts routes).
 */

export type JsonBodyResult = { ok: true; value: unknown } | { ok: false; status: 400 | 413 };

async function readLimitedText(request: Request, maxBytes: number): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** Parses the body as JSON; 413 when it exceeds `maxBytes`, 400 when it is not JSON. */
export async function readJsonBody(request: Request, maxBytes: number): Promise<JsonBodyResult> {
  // Fast path: reject a declared oversized body without reading it.
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) return { ok: false, status: 413 };
  const text = await readLimitedText(request, maxBytes);
  if (text === null) return { ok: false, status: 413 };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, status: 400 };
  }
}
