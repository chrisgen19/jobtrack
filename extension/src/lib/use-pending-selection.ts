import { useCallback, useEffect, useState } from "react";
import { readSelection } from "./read-page";
import { pendingSelectionItem } from "./storage";

/** A menu click older than this is ignored (the panel may have opened much later). */
const MAX_AGE_MS = 60_000;

/**
 * Text picked with "Use selection as job description" for this tab, for the
 * side panel's form. `clear` consumes it so it's applied once.
 */
export function usePendingSelection(tabId: number | null): { text: string | null; clear: () => void } {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (tabId === null) return;
    let active = true;
    const apply = async (item: { tabId: number; text: string; at: number } | null) => {
      if (!item || item.tabId !== tabId || Date.now() - item.at > MAX_AGE_MS) return;
      // Same words but with line breaks, when the page still has the selection.
      const fromPage = (await readSelection(tabId))?.trim();
      const same = fromPage && fromPage.replace(/\s+/g, " ") === item.text.replace(/\s+/g, " ").trim();
      if (active) setText(same ? fromPage : item.text);
    };
    void pendingSelectionItem.getValue().then(apply);
    const unwatch = pendingSelectionItem.watch((item) => void apply(item));
    return () => {
      active = false;
      unwatch();
    };
  }, [tabId]);

  const clear = useCallback(() => {
    setText(null);
    void pendingSelectionItem.removeValue();
  }, []);

  return { text, clear };
}
