import { useState } from "react";
import type { DraftValues, FieldMark, FieldMarks } from "@/lib/draft";

type Key = keyof DraftValues;

/**
 * Which prefilled fields the form flags: "check" for guesses from the page,
 * "ai" for AI suggestions. A field's mark goes away once the user edits it.
 */
export function useFieldMarks(initial: FieldMarks) {
  const [marks, setMarks] = useState<ReadonlyMap<Key, FieldMark>>(
    () => new Map(Object.entries(initial) as [Key, FieldMark][]),
  );
  const clear = (key: Key) =>
    setMarks((current) => {
      if (!current.has(key)) return current;
      const next = new Map(current);
      next.delete(key);
      return next;
    });
  const markAi = (keys: Key[]) =>
    setMarks((current) => new Map([...current, ...keys.map((key) => [key, "ai"] as const)]));
  return { marks, clear, markAi };
}
