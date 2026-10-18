import { useEffect, useState, type FormEvent } from "react";
import type { ExtensionMe, ExtensionSaveResult } from "@jobtrack/shared/extension-api";
import { ApiError, saveJob } from "@/lib/api";
import type { DraftValues, PageStatus } from "@/lib/draft";
import { firstErrors, toPayload, validateDraft, type FieldErrors } from "@/lib/payload";
import { flushDraftSave, removeDraft, scheduleDraftSave } from "@/lib/drafts";
import { DuplicateWarning } from "./duplicate-warning";
import { Button, Notice } from "./fields";
import { ApplySection } from "./form/apply-section";
import { BasicsSection } from "./form/basics-section";
import { DetailsSection } from "./form/details-section";
import { SalarySection } from "./form/salary-section";

const STATUS_NOTICE: Record<PageStatus, string | null> = {
  found: null,
  partial: "Some details couldn't be read from this page, so fields may be missing. Check them before saving.",
  unreadable:
    "This page can't be read (browser pages and some sites block extensions). Fill in the details yourself.",
};

type Props = {
  me: ExtensionMe;
  initial: DraftValues;
  pageUrl: string | null;
  status: PageStatus;
  guessed: (keyof DraftValues)[];
  onSaved: (result: ExtensionSaveResult, title: string) => void;
  onUnauthorized: (message: string) => void;
};

export function JobForm({ me, initial, pageUrl, status, guessed: initialGuessed, onSaved, onUnauthorized }: Props) {
  const [values, setValues] = useState(initial);
  const [guessed, setGuessed] = useState<ReadonlySet<keyof DraftValues>>(() => new Set(initialGuessed));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [edited, setEdited] = useState(false);

  // Keep this page's draft once the user changed something; untouched forms
  // are never stored, so opening the popup elsewhere can't replace a draft.
  useEffect(() => {
    if (pageUrl && edited) scheduleDraftSave(pageUrl, values);
  }, [pageUrl, values, edited]);

  // Writes are batched, so write the last edits when the popup closes or the form goes away.
  useEffect(() => {
    const flush = () => void flushDraftSave();
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  const set = <K extends keyof DraftValues>(key: K, value: DraftValues[K]) => {
    setEdited(true);
    setValues((current) => ({ ...current, [key]: value }));
    setGuessed((current) => {
      if (!current.has(key)) return current;
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const clientErrors = validateDraft(values);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;
    setSaving(true);
    try {
      const result = await saveJob(toPayload(values));
      if (pageUrl) await removeDraft(pageUrl);
      onSaved(result, values.title);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return onUnauthorized(error.message);
      setErrors(error instanceof ApiError ? firstErrors(error.fieldErrors) : {});
      setFormError(error instanceof Error ? error.message : "Saving failed. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const sectionProps = { values, errors, guessed, set };
  return (
    <form onSubmit={submit} noValidate className="flex flex-col">
      <div className="flex flex-col gap-2.5 px-4 py-3">
        {STATUS_NOTICE[status] ? <Notice>{STATUS_NOTICE[status]}</Notice> : null}
        <DuplicateWarning url={values.postingUrl} title={values.title} company={values.companyName} />
        <BasicsSection {...sectionProps} />
        <SalarySection {...sectionProps} defaultCurrency={me.currency} />
        <DetailsSection {...sectionProps} />
        <ApplySection {...sectionProps} stages={me.stages} />
        {formError ? <Notice tone="error">{formError}</Notice> : null}
      </div>
      <div className="sticky bottom-0 flex items-center gap-2 border-t border-line-soft bg-white px-4 py-3">
        <span className="min-w-0 flex-1 truncate text-[11px] text-faint">Saving to {me.user.email}</span>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save job"}
        </Button>
      </div>
    </form>
  );
}
