import { useEffect, useState, type FormEvent } from "react";
import type { ExtensionMe, ExtensionSaveResult } from "@jobtrack/shared/extension-api";
import { ApiError, saveJob } from "@/lib/api";
import type { DraftValues, PageStatus, FieldMarks } from "@/lib/draft";
import { firstErrors, toPayload, validateDraft, type FieldErrors } from "@/lib/payload";
import { flushDraftSave, removeDraft, scheduleDraftSave } from "@/lib/drafts";
import { DuplicateWarning } from "./duplicate-warning";
import { Button, Notice } from "./fields";
import { ApplySection } from "./form/apply-section";
import { BasicsSection } from "./form/basics-section";
import { ContactSection } from "./form/contact-section";
import { DetailsSection } from "./form/details-section";
import { MoreSection } from "./form/more-section";
import { SalarySection } from "./form/salary-section";
import { ImproveWithAi } from "./improve-with-ai";
import { useApplySuggestions } from "./use-apply-suggestions";
import { useFieldMarks } from "./use-field-marks";

const STATUS_NOTICE: Record<PageStatus, string | null> = {
  found: null,
  partial:
    "Some details couldn't be read from this page, so fields may be missing. Check them before saving.",
  unreadable:
    "This page can't be read (browser pages and some sites block extensions). Fill in the details yourself.",
};

type Props = {
  me: ExtensionMe;
  initial: DraftValues;
  pageUrl: string | null;
  status: PageStatus;
  marks: FieldMarks;
  /** Text from the "Use selection as job description" menu item, applied as an edit (side panel). */
  incomingDescription?: string | null;
  onIncomingApplied?: () => void;
  onSaved: (result: ExtensionSaveResult, title: string) => void;
  onUnauthorized: (message: string) => void;
};

export function JobForm({
  me,
  initial,
  pageUrl,
  status,
  marks: initialMarks,
  incomingDescription,
  onIncomingApplied,
  onSaved,
  onUnauthorized,
}: Props) {
  const [values, setValues] = useState(initial);
  const { marks, clear, markAi } = useFieldMarks(initialMarks);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [edited, setEdited] = useState(false);

  // Keep this page's draft once the user changed something; untouched forms
  // are never stored, so opening the popup elsewhere can't replace a draft.
  // The fields still marked go with it, so reopening keeps their marks.
  useEffect(() => {
    if (pageUrl && edited) scheduleDraftSave(pageUrl, { values, marks: Object.fromEntries(marks) });
  }, [pageUrl, values, marks, edited]);

  // A menu selection arrives as a prop; apply it once, while rendering, then let the parent clear it.
  const [appliedIncoming, setAppliedIncoming] = useState<string | null>(null);
  if ((incomingDescription ?? null) !== appliedIncoming) {
    setAppliedIncoming(incomingDescription ?? null);
    if (incomingDescription) {
      setEdited(true);
      setValues((current) => ({ ...current, description: incomingDescription.slice(0, 20_000) }));
    }
  }
  useEffect(() => {
    if (appliedIncoming) onIncomingApplied?.();
  }, [appliedIncoming, onIncomingApplied]);

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
    clear(key);
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

  // AI suggestions fill empty fields and mark them; editing one clears its mark like any other.
  const applySuggestions = useApplySuggestions(values, setValues, (fields) => {
    setEdited(true);
    markAi(fields);
  });
  const sectionProps = { values, errors, marks, set };
  // Older servers (contract v0.1) don't send followUpDays and would drop these fields.
  const extras = me.followUpDays !== undefined;
  return (
    <form onSubmit={submit} noValidate className="flex flex-col">
      <div className="flex flex-col gap-2.5 px-4 py-3">
        {STATUS_NOTICE[status] ? <Notice>{STATUS_NOTICE[status]}</Notice> : null}
        <DuplicateWarning url={values.postingUrl} title={values.title} company={values.companyName} />
        <ImproveWithAi me={me} values={values} onApply={applySuggestions} />
        <BasicsSection {...sectionProps} />
        <SalarySection {...sectionProps} defaultCurrency={me.currency} />
        <DetailsSection {...sectionProps} />
        {extras ? <MoreSection {...sectionProps} /> : null}
        {extras ? <ContactSection {...sectionProps} /> : null}
        <ApplySection {...sectionProps} stages={me.stages} today={me.today} extras={extras} />
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
