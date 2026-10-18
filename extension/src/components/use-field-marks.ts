import { useState } from "react";
import type { DraftValues } from "@/lib/draft";
import type { FieldMark } from "./fields";

type Key = keyof DraftValues;

/**
 * Which prefilled fields the form flags: "check" for guesses from the page,
 * "ai" for AI suggestions. A field's mark goes away once the user edits it.
 */
export function useFieldMarks(guessed: Key[]) {
  const [marks, setMarks] = useState<ReadonlyMap<Key, FieldMark>>(
    () => new Map(guessed.map((key) => [key, "check"])),
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
