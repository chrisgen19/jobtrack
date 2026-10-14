"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { TextArea } from "@/components/shared/form-controls";
import { Button } from "@/components/ui/button";
import { addApplicationNoteAction } from "../actions";

export function NoteForm({ applicationId }: { applicationId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  return (
    <form
      ref={formRef}
      className="mb-5 flex flex-col gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const note = new FormData(event.currentTarget).get("note");
        setPending(true);
        const result = await addApplicationNoteAction({ applicationId, note });
        setPending(false);
        if (!result.ok) {
          toast.error(result.fieldErrors?.note?.[0] ?? result.error);
          return;
        }
        formRef.current?.reset();
        toast.success("Note added to the timeline");
      }}
    >
      <label htmlFor="timeline-note" className="sr-only">
        Add a note
      </label>
      <TextArea
        id="timeline-note"
        name="note"
        className="min-h-[60px]"
        placeholder="Add a note to the timeline (call summary, recruiter feedback...)"
        maxLength={2000}
      />
      <Button type="submit" variant="outline" disabled={pending} className="self-end">
        {pending ? "Adding..." : "Add note"}
      </Button>
    </form>
  );
}
