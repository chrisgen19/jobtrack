import { useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { JOB_SITE_MATCHES } from "@/lib/extract/sites/hosts";

const ORIGINS = { origins: JOB_SITE_MATCHES };

/**
 * Turns the optional job-site host permissions on or off. With them the
 * toolbar badge marks job pages and the side panel reads those sites as
 * you switch tabs or jobs, without pressing the shortcut first.
 */
export function AutoDetectToggle() {
  const [granted, setGranted] = useState<boolean | null>(null);

  useEffect(() => {
    const check = () =>
      void browser.permissions
        .contains(ORIGINS)
        .then(setGranted)
        .catch(() => setGranted(false));
    check();
    browser.permissions.onAdded.addListener(check);
    browser.permissions.onRemoved.addListener(check);
    return () => {
      browser.permissions.onAdded.removeListener(check);
      browser.permissions.onRemoved.removeListener(check);
    };
  }, []);

  function toggle() {
    // request() must run inside the click (no await before it), or Chrome refuses it.
    const change = granted ? browser.permissions.remove(ORIGINS) : browser.permissions.request(ORIGINS);
    void change.catch(() => undefined);
  }

  if (granted === null) return null;
  return (
    <div className="flex items-center gap-2 border-t border-line-soft px-4 py-2.5">
      <p className="min-w-0 flex-1 text-[11px] leading-snug text-subtle">
        <span className="font-bold text-ink">Auto-detect job sites</span>
        <br />
        {granted
          ? "On: job pages on LinkedIn, JobStreet, Indeed and others are marked and read as you browse."
          : "Mark job pages and read them as you browse LinkedIn, JobStreet, Indeed and others."}
      </p>
      <button
        type="button"
        role="switch"
        aria-checked={granted}
        aria-label="Auto-detect job sites"
        onClick={toggle}
        className={`relative h-5 w-9 flex-none rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-none ${granted ? "bg-brand" : "bg-line"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform ${granted ? "translate-x-4" : ""}`}
        />
      </button>
    </div>
  );
}
