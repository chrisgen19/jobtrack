import type { DraftValues } from "../draft";

/** Where a layer of prefilled values came from, most trusted first in mergeLayers(). */
export type FieldSource = "site" | "json-ld" | "page" | "text";

/**
 * Values read by one extractor. `guessed` lists fields inferred rather than
 * stated (a pay period from the amount, remote from the description); the
 * form marks those so the user checks them.
 */
export type Layer = {
  source: FieldSource;
  values: Partial<DraftValues>;
  guessed?: (keyof DraftValues)[];
};

/**
 * What collectPageSnapshot() reads besides the defaults, as plain data so it
 * can cross into the page with executeScript `args` (no code is sent).
 */
export type DomPlan = {
  /** Name -> CSS selector; the text of every match (up to 20). */
  text?: Record<string, string>;
  /** Name -> CSS selector; the HTML of the first match. */
  html?: Record<string, string>;
  /** Name -> CSS selector; the http(s) link (href) of the first match. */
  links?: Record<string, string>;
  /** Label texts (any case) whose next element holds the value, e.g. "TYPE OF WORK". */
  labels?: string[];
  /** Ids of script elements whose text to read, e.g. "__NEXT_DATA__". */
  scriptIds?: string[];
};
