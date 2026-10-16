# Chrome Web Store Listing: Save to JobTrack

> Last Updated: 2026-10-16. Status: not submitted (distributed as an unpacked build for now).

## Store Listing

**Extension Name:** Save to JobTrack

**Short Description:** Save the job posting you're viewing to your JobTrack workspace, after reviewing the details.

**Detailed Description:**

Save to JobTrack adds job postings to your JobTrack job search tracker without copying and pasting.

Open the extension on a job posting and it fills in the job title, company, location, work setup, employment type, salary and description for you. Highlight part of the page first to use that text as the description. Review and edit everything, mark it as already applied if you have, and click Save job. The extension warns you when you already saved the same posting.

How to use it:

1. Click Connect to JobTrack and approve the connection in your JobTrack account.
2. Open a job posting on any site.
3. Click the extension, check the details and click Save job.

Privacy: the extension reads a page only when you open it on that page, and sends nothing until you click Save job. It talks only to your JobTrack server. You can disconnect it any time from the extension or from JobTrack's settings.

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

| Permission                           | Type             | Justification                                                                                                                   |
| ------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `activeTab`                          | permissions      | Reads the job posting on the current tab, only after the user opens the extension on it, to prefill the save form.              |
| `scripting`                          | permissions      | Runs a one-time reader on that tab to collect the posting's title, company and description; nothing stays injected in the page. |
| `storage`                            | permissions      | Keeps the user's connection token on the device, plus the unsaved form for the current page until the browser closes.           |
| `https://<jobtrack server>/*`        | host_permissions | Sends the job the user chose to save to their own JobTrack account. No other site is contacted.                                 |
| `externally_connectable` (same host) | manifest         | Lets the user's JobTrack account page hand the connection token to the extension after the user approves it.                    |

## Privacy & Data Use

**Does the extension collect user data?** Yes, only what the user saves.

| Data Type                    | Collected? | Transmitted Off-Device? | Purpose                                 | Shared with Third Parties? |
| ---------------------------- | ---------- | ----------------------- | --------------------------------------- | -------------------------- |
| Personally identifiable info | No         | No                      |                                         | No                         |
| Authentication info          | Yes        | Yes (to JobTrack only)  | Connection token that authorizes saving | No                         |
| Website content              | Yes        | Yes (to JobTrack only)  | Job details the user reviewed and saved | No                         |
| Web history                  | Yes        | Yes (to JobTrack only)  | The saved posting's URL                 | No                         |
| Other categories             | No         | No                      |                                         | No                         |

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
