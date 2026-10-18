import type { DraftValues } from "@/lib/draft";
import type { FieldMark } from "../fields";

export type SectionProps = {
  values: DraftValues;
  errors: Partial<Record<keyof DraftValues, string>>;
  /** Prefilled fields to check: guessed from the page, or suggested by AI; cleared once the user edits one. */
  marks: ReadonlyMap<keyof DraftValues, FieldMark>;
  set: <K extends keyof DraftValues>(key: K, value: DraftValues[K]) => void;
};
