import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { ExtensionAiSuggestions } from "@jobtrack/shared/extension-api";
import type { DraftValues } from "@/lib/draft";
import { patchedFields, suggestionPatch } from "./improve-with-ai";

/**
 * Applies AI suggestions to the form as it is when the answer arrives, not as
 * it was when the user asked: a field typed into while the request ran keeps
 * the user's value. Returns an apply function that reports how many fields it
 * filled; `onFilled` gets their names (to mark them).
 */
export function useApplySuggestions(
  values: DraftValues,
  setValues: Dispatch<SetStateAction<DraftValues>>,
  onFilled: (fields: (keyof DraftValues)[]) => void,
) {
  const latest = useRef(values);
  useEffect(() => {
    latest.current = values;
  }, [values]);

  return (suggestions: ExtensionAiSuggestions) => {
    const fields = patchedFields(suggestionPatch(latest.current, suggestions));
    if (!fields.length) return 0;
    // Checked again against the state React applies it to, so an edit not yet rendered still wins.
    setValues((current) => ({ ...current, ...suggestionPatch(current, suggestions) }));
    onFilled(fields);
    return fields.length;
  };
}
