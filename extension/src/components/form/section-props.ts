import type { DraftValues } from "@/lib/draft";

export type SectionProps = {
  values: DraftValues;
  errors: Partial<Record<keyof DraftValues, string>>;
  /** Prefilled fields that were inferred; cleared per field once the user edits it. */
  guessed: ReadonlySet<keyof DraftValues>;
  set: <K extends keyof DraftValues>(key: K, value: DraftValues[K]) => void;
};
