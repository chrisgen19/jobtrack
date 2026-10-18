/** Safe readers for untrusted JSON from pages (JSON-LD, embedded app state). */

export type Node = Record<string, unknown>;

export const isNode = (value: unknown): value is Node =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];

export const str = (value: unknown): string =>
  typeof value === "string" || typeof value === "number" ? String(value) : "";

/** Nested value by path, or undefined when any step is missing. */
export function at(value: unknown, ...path: string[]): unknown {
  let current = value;
  for (const key of path) {
    if (!isNode(current)) return undefined;
    current = current[key];
  }
  return current;
}

/**
 * Value of the first key starting with `prefix`. Apollo caches store fields
 * with their arguments in the key, e.g. `content2({"zone":"asia-6"})`.
 */
export function byPrefix(node: unknown, prefix: string): unknown {
  if (!isNode(node)) return undefined;
  const key = Object.keys(node).find((name) => name === prefix || name.startsWith(`${prefix}(`));
  return key === undefined ? undefined : node[key];
}

/** The YYYY-MM-DD at the start of an ISO date or timestamp, or "". */
export const dateOf = (value: unknown): string => str(value).match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? "";

/** Parses JSON, or null when it is malformed. */
export function parseJson(text: string | undefined): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
