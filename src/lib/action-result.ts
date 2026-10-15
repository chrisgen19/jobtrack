import { z } from "zod";

/**
 * Result returned by every Server Action. Expected failures (validation,
 * not found, business rules) are values; only unexpected errors throw.
 */
export type ActionResult<T = undefined> =
  | ({ ok: true } & ([T] extends [undefined | void] ? { data?: undefined } : { data: T }))
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

export function ok(): ActionResult;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T) {
  return data === undefined ? { ok: true } : { ok: true, data };
}

export function fail(error: string, fieldErrors?: Record<string, string[] | undefined>) {
  return { ok: false as const, error, fieldErrors };
}

export function validationFailure(error: z.ZodError) {
  return fail(
    "Please check the highlighted fields.",
    z.flattenError(error).fieldErrors as Record<string, string[]>,
  );
}

/** Thrown by data-layer functions for expected, user-facing failures. */
export class DomainError extends Error {
  override name = "DomainError";
}

/** Thrown when a record is missing or belongs to another user. */
export class NotFoundError extends DomainError {
  override name = "NotFoundError";
  constructor(entity = "Record") {
    super(`${entity} not found.`);
  }
}

/**
 * Runs a data-layer mutation and turns DomainErrors into a failed result.
 * Anything else is rethrown so Next.js error handling sees it.
 */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return (data === undefined ? { ok: true } : { ok: true, data }) as ActionResult<T>;
  } catch (error) {
    if (error instanceof DomainError) return fail(error.message);
    throw error;
  }
}

/** FormData -> plain object (last value wins; use getAll for lists). */
export function formDataToObject(formData: FormData): Record<string, FormDataEntryValue> {
  const output: Record<string, FormDataEntryValue> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("$ACTION")) output[key] = value;
  }
  return output;
}
