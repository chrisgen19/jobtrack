"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { FormAlert } from "@/features/auth/components/auth-card";
import { updateAiSuggestionsAction } from "../actions";

interface Props {
  enabled: boolean;
  /** The server has an AI key; without one the switch stays off. */
  available: boolean;
}

/** Opt-in for "Improve with AI", with what it sends where. */
export function AiSuggestionsForm({ enabled, available }: Props) {
  const [state, formAction, pending] = useActionState(updateAiSuggestionsAction, null);

  useEffect(() => {
    if (state?.ok) toast.success("AI suggestions setting saved");
  }, [state]);

  return (
    <form action={formAction} className="mt-5 border-t border-[#edf0eb] pt-4">
      {state?.ok === false ? <FormAlert>{state.error}</FormAlert> : null}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <label htmlFor="pref-aiSuggestions" className="text-xs font-bold">
            Improve with AI
          </label>
          <span className="mt-1 block text-[11px] leading-relaxed text-[#98a69c]">
            {available
              ? "When you click Improve with AI in the extension, the posting's text and link are sent from your JobTrack server to Anthropic (Claude) to suggest the fields the page didn't give. Suggestions are labelled, and nothing is saved until you review it."
              : "Not set up on this JobTrack server."}
          </span>
        </div>
        <Switch
          id="pref-aiSuggestions"
          name="aiSuggestions"
          defaultChecked={available && enabled}
          disabled={!available}
        />
      </div>
      {available ? (
        <Button type="submit" variant="outline" disabled={pending} className="mt-3">
          {pending ? "Saving..." : "Save"}
        </Button>
      ) : null}
    </form>
  );
}
