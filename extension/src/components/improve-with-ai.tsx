import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { browser } from "wxt/browser";
import {
  AI_SUGGESTABLE_FIELDS,
  type ExtensionAiSuggestions,
  type ExtensionMe,
} from "@jobtrack/shared/extension-api";
import { ApiError, suggestFields } from "@/lib/api";
import { jobtrackUrl } from "@/lib/config";
import type { DraftValues } from "@/lib/draft";
import { Button, Notice } from "./fields";

/** The server needs this much posting text to work from. */
export const MIN_AI_TEXT = 200;

const isFilled = (value: unknown) => (Array.isArray(value) ? value.length > 0 : Boolean(value));

/**
 * Suggestions for fields the form still has empty (a contact name also
 * switches on saving the contact). Run it on the values as they are when the
 * answer arrives, so whatever the user typed meanwhile is kept.
 */
export function suggestionPatch(
  values: DraftValues,
  suggestions: ExtensionAiSuggestions,
): Partial<DraftValues> {
  const patch: Partial<Record<keyof DraftValues, unknown>> = {};
  for (const [key, value] of Object.entries(suggestions) as [keyof DraftValues, unknown][]) {
    if (isFilled(value) && !isFilled(values[key])) patch[key] = value;
  }
  if (patch.contactName) patch.saveContact = true;
  return patch as Partial<DraftValues>;
}

/** The form fields a patch fills (saveContact is a switch, not a field). */
export const patchedFields = (patch: Partial<DraftValues>) =>
  (Object.keys(patch) as (keyof DraftValues)[]).filter((key) => key !== "saveContact");

type Props = {
  me: ExtensionMe;
  values: DraftValues;
  /** Fills the fields that are still empty and returns how many it filled. */
  onApply: (suggestions: ExtensionAiSuggestions) => number;
};

/**
 * "Improve with AI": sends the description (and the names of the fields
 * already filled, not their values) to JobTrack, which asks Gemini for the
 * missing ones. Opt-in in JobTrack's Settings; hidden when the server has no AI.
 */
export function ImproveWithAi({ me, values, onApply }: Props) {
  const ai = me.features?.ai;
  const [state, setState] = useState<{ busy: boolean; message?: string; tone?: "info" | "error" }>({
    busy: false,
  });
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  if (!ai?.available) return null;
  if (!ai.enabled) {
    return (
      <p className="text-[11px] leading-relaxed text-subtle">
        <Sparkles className="mr-1 inline size-3 text-brand" aria-hidden />
        Improve with AI is off.{" "}
        <button
          type="button"
          className="font-bold text-brand underline underline-offset-2"
          onClick={() => browser.tabs.create({ url: jobtrackUrl("/settings/extension") })}
        >
          Turn it on in JobTrack
        </button>
      </p>
    );
  }

  const tooShort = values.description.trim().length < MIN_AI_TEXT;
  async function improve() {
    abort.current?.abort();
    abort.current = new AbortController();
    setState({ busy: true });
    try {
      const result = await suggestFields(
        {
          postingUrl: values.postingUrl,
          pageTitle: values.title,
          text: values.description,
          filledFields: AI_SUGGESTABLE_FIELDS.filter((field) => isFilled(values[field])),
        },
        abort.current.signal,
      );
      const count = onApply(result.suggestions);
      setState({
        busy: false,
        message: count
          ? `Filled ${count} field${count === 1 ? "" : "s"} marked AI: check them. ${result.remainingToday} left today.`
          : "The description has no details the form is missing.",
      });
    } catch (error) {
      if (abort.current?.signal.aborted) return;
      setState({
        busy: false,
        tone: "error",
        message: error instanceof ApiError ? error.message : "Try again.",
      });
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Button variant="outline" className="py-1.5" disabled={state.busy || tooShort} onClick={improve}>
          <Sparkles className="size-3.5 text-brand" aria-hidden />
          {state.busy ? "Asking AI..." : "Improve with AI"}
        </Button>
        <span className="min-w-0 flex-1 text-[10px] leading-snug text-faint">
          {tooShort
            ? "Needs a longer description (select the posting text on the page)."
            : "Sends the description to Google Gemini via JobTrack."}
        </span>
      </div>
      {state.message ? <Notice tone={state.tone ?? "info"}>{state.message}</Notice> : null}
    </div>
  );
}
