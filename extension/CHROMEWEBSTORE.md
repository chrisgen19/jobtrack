# Chrome Web Store Listing: Save to JobTrack

> Last Updated: 2026-10-18 (side panel, context menu, shortcut, optional job-site access; contacts and to-dos; optional AI suggestions). Status: not submitted (distributed as an unpacked build for now).

## Store Listing

**Extension Name:** Save to JobTrack

**Short Description:** Save the job posting you're viewing to your JobTrack workspace, after reviewing the details.

**Detailed Description:**

Save to JobTrack adds job postings to your JobTrack job search tracker without copying and pasting.

Open the extension on a job posting and it fills in the job title, company, location, work setup, employment type, salary, description, skills, deadline and reference code for you. Highlight part of the page first to use that text as the description. Review and edit everything, add tags, save the recruiter as a contact, add an "apply by" or follow-up to-do, or mark it as already applied, and click Save job. The extension warns you when you already saved the same posting.

Keep the form open beside the page in Chrome's side panel: press Alt+Shift+J or right-click and choose "Save job to JobTrack". On LinkedIn, JobStreet and Indeed search pages the panel follows the job you click. Right-click selected text to use it as the description.

How to use it:

1. Click Connect to JobTrack and approve the connection in your JobTrack account.
2. Open a job posting on any site.
3. Click the extension (or press Alt+Shift+J), check the details and click Save job.

Optional: turn on "Improve with AI" in JobTrack's settings to fill details the page didn't give from the posting's text. The text is sent to Google (Gemini API) through your JobTrack server only when you click the button; suggestions are marked "AI" for you to check.

Optional: turn on "Auto-detect job sites" to mark job pages on LinkedIn, JobStreet, Indeed and other supported sites with a badge, and have the side panel read them as you browse.

Privacy: the extension reads a page only when you open it on that page (toolbar button, shortcut or right-click), or, if you turn on auto-detect, job pages on the supported job sites while the side panel is open. Posting text goes to Google (Gemini API) only when you have turned on Improve with AI and click it. It then checks the posting's link, title and company against your saved jobs, and saves nothing until you click Save job. It talks only to your JobTrack server. You can disconnect it any time from the extension or from JobTrack's settings.

**Category:** Productivity

**Single Purpose:** Saves the job posting on the current page to the user's JobTrack account.

**Primary Language:** English

## Graphics & Assets

| Asset                          | Dimensions          | Status         | Filename              |
| ------------------------------ | ------------------- | -------------- | --------------------- |
| Store Icon [REQUIRED]          | 128×128 PNG         | ✅ Ready       | `public/icon/128.png` |
| Screenshot 1 [REQUIRED]        | 1280×800 or 640×400 | ⬜ Not created |                       |
| Screenshot 2 [RECOMMENDED]     | 1280×800 or 640×400 | ⬜ Not created |                       |
| Small Promo Tile [RECOMMENDED] | 440×280             | ⬜ Not created |                       |

### Screenshot Notes

1. A job posting with the popup open and the form prefilled.
2. The duplicate warning on a posting that was already saved.
3. The JobTrack "Connect the extension" approval page.

## Permissions Justification

| Permission                                                                                              | Type                      | Justification                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `activeTab`                                                                                             | permissions               | Reads the job posting on the current tab, only after the user opens the extension on it, to prefill the save form.                                                                                                                          |
| `scripting`                                                                                             | permissions               | Runs a reader on that tab to collect the posting's title, company and description. While the side panel is open, a small watcher also reports when the user clicks another job in a split-view search page; it stops when the panel closes. |
| `contextMenus`                                                                                          | permissions               | "Save job to JobTrack" and "Use selection as job description" on the right-click menu.                                                                                                                                                      |
| `sidePanel`                                                                                             | permissions               | Shows the save form beside the page and follows the job the user selects.                                                                                                                                                                   |
| `commands` (Alt+Shift+J)                                                                                | manifest                  | Keyboard shortcut that opens the save form for the current page.                                                                                                                                                                            |
| Job sites (LinkedIn, JobStreet/SEEK, Indeed, Kalibrr, OnlineJobs.ph, Greenhouse, Lever, Ashby, Workday) | optional_host_permissions | Requested only when the user turns on "Auto-detect job sites": marks job pages with a badge (the URL is checked on the device) and lets the side panel read them without a click first.                                                     |
| `storage`                                                                                               | permissions               | Keeps the user's connection token on the device, plus unsaved forms for recently viewed postings until the browser closes.                                                                                                                  |
| `https://<jobtrack server>/*`                                                                           | host_permissions          | Sends the job the user chose to save to their own JobTrack account. No other site is contacted.                                                                                                                                             |
| `externally_connectable` (same host)                                                                    | manifest                  | Lets the user's JobTrack account page hand the connection token to the extension after the user approves it.                                                                                                                                |

## Privacy & Data Use

**Does the extension collect user data?** Yes: the job details it reads from the page (sent to the user's own JobTrack server for the duplicate check and, on Save, to store the job) and the user's name and email (received from JobTrack and shown in the popup).

| Data Type                    | Collected? | Transmitted Off-Device?                                | Purpose                                                                                                                                                                                                                                                        | Shared with Third Parties?                     |
| ---------------------------- | ---------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Personally identifiable info | Yes        | Yes (to JobTrack only, on Save)                        | The user's JobTrack name and email (received, shown, not stored by the extension). If the user saves a contact: the recruiter's name, title, email and LinkedIn link from the posting, stored in their JobTrack account                                        | No                                             |
| Authentication info          | Yes        | Yes (to JobTrack only)                                 | Connection token that authorizes saving                                                                                                                                                                                                                        | No                                             |
| Website content              | Yes        | Yes (to JobTrack; to Google only with Improve with AI) | Job details from the open page: checked for duplicates when the popup opens, stored only on Save. If the user turned on Improve with AI and clicks it, the posting's description and link go through JobTrack to Google (Gemini API) to suggest missing fields | Yes, Google, only for Improve with AI (opt-in) |
| Web history                  | Yes        | Yes (to JobTrack only)                                 | The open posting's URL: duplicate check, and saved with the job on Save. With auto-detect on, supported job sites' tab URLs are checked on the device for the badge and never sent                                                                             | No                                             |
| Other categories             | No         | No                                                     |                                                                                                                                                                                                                                                                | No                                             |

- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

**Privacy Policy URL:** TODO: publish JobTrack's privacy policy (also an R2 launch gate in `docs/BACKLOG.md`).

## Distribution

**Visibility:** not decided (unlisted is likely first). **Regions:** all.

## Developer Info

**Publisher Name:** TODO · **Contact Email:** TODO · **Support URL:** TODO · **Homepage URL:** TODO

## Version History

| Version | Date       | Changes                                                        | Status |
| ------- | ---------- | -------------------------------------------------------------- | ------ |
| 0.1.0   | 2026-10-16 | First version: prefill from the page, review, save, duplicates | Draft  |

## Review Notes

### Known Issues / Limitations

- Build with `WXT_EXTENSION_KEY` empty for the store; then add the store-assigned ID to the server's `EXTENSION_IDS`.
- Reviewers need a JobTrack account on the configured server to test the connect flow; provide test credentials.
