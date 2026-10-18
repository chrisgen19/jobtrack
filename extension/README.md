# Save to JobTrack (Chrome extension)

Saves the job posting you're viewing to your JobTrack workspace. Open the extension on a job page and it prefills a
review form, then saves only when you click **Save job**.

- **Prefill**, most trusted source first:
  1. A site adapter. It reads the page's own data or known elements on LinkedIn, JobStreet/SEEK/JobsDB, Indeed,
     Kalibrr, OnlineJobs.ph, Greenhouse, Ashby, Lever and Workday.
  2. schema.org `JobPosting` data.
  3. The page's meta tags, title and main text block.
  4. Guesses from that text: pay lines, "hybrid work setup", "fully remote".

  Fields that were guessed show a **check** marker until you edit them. Text you highlight on the page becomes the
  description.
- **Side panel:** press **Alt+Shift+J**, right-click the page and choose **Save job to JobTrack**, or use the panel
  button in the popup. The panel stays open beside the page, follows the tab you switch to, and on split-view search
  pages follows the job you click.
- **Right-click selected text** → **Use selection as job description**.
- **Auto-detect job sites** (toggle under the form, off by default): grants the optional job-site permissions, so
  job pages get a **JOB** badge and the side panel reads them without pressing the shortcut first.
- **Split views:** on LinkedIn (`currentJobId`), JobStreet (`jobId`) and Indeed (`vjk`) search pages, the selected job
  is read, and the saved link points to that job, not to the search.
- **Duplicates:** warns when you already saved the same posting link, or the same title at the same company.
- **Already applied:** optionally records the application with its date, pipeline stage and how you applied.
- **More details:**
  - Skills, tags, deadline, reference code, pay basis (gross/net) and the company's website.
  - The website is set on the company only when it has none.
  - JSON-LD `validThrough` fills the deadline marked **check**, since it is often the listing's expiry.
- **Contact:** saves the recruiter or hiring manager as a contact of the company.
  - LinkedIn's hiring-team card is read when signed in, best effort.
  - Otherwise an email in the description is offered.
  - A contact already at that company with the same LinkedIn profile or email is reused.
- **To-do** (jobs not applied to yet): "Apply by" or "Follow up on" a date, defaulting to the deadline or your
  follow-up days. It has a reminder like any JobTrack task.
- Servers older than this extension (contract v0.1, no `followUpDays` in `/me`) hide these sections, since they would
  drop the fields.
- Unsaved edits are kept per page (the 20 most recently edited) until the browser closes, so closing the popup by
  accident, or opening it on another posting in between, loses nothing.

Built with [WXT](https://wxt.dev) (Manifest V3), React and Tailwind CSS v4. It shares the API contract with the web
app through `packages/shared` (`@jobtrack/shared/extension-api`).

## Setup

```bash
pnpm install                      # from the repo root (installs every workspace package)
cp extension/.env.example extension/.env
pnpm --filter @jobtrack/extension typecheck   # also generates extension/.wxt (types for the editor)
```

`extension/.env`:

| Variable            | Meaning                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------ |
| `WXT_JOBTRACK_URL`  | JobTrack server origin. `https` required except for `localhost`.                           |
| `WXT_EXTENSION_KEY` | Public key that pins the unpacked extension ID. Leave empty for Chrome Web Store uploads. |

The committed dev key gives the ID `pdpigjppeaoehfopmcgfdofienlhjjmh`. The web app only hands tokens to IDs in its
`EXTENSION_IDS` environment variable, so add that ID to the web app's `.env`:

```bash
EXTENSION_IDS=pdpigjppeaoehfopmcgfdofienlhjjmh
```

`pnpm --filter @jobtrack/extension extension-id` prints the ID for the current key, and `... extension-id --generate`
creates a new key pair.

## Develop, build, load

| Command (repo root)                         | What it does                                                   |
| ------------------------------------------- | -------------------------------------------------------------- |
| `pnpm ext:dev`                              | Dev build with reload (WXT opens Chrome with it when it finds a Chrome install) |
| `pnpm ext:build`                            | Production build in `extension/.output/chrome-mv3`             |
| `pnpm ext:zip`                              | Zip for the Chrome Web Store in `extension/.output`            |
| `pnpm --filter @jobtrack/extension test`    | Vitest: parsers, site adapters, page reader (happy-dom), connect handshake |
| `pnpm --filter @jobtrack/extension typecheck` | `wxt prepare` + `tsc`                                        |

Load the build in Chrome: `chrome://extensions` → enable **Developer mode** → **Load unpacked** → choose
`extension/.output/chrome-mv3`. Rebuild and click the reload icon on the card after changes.

Icons are generated from the brand mark with `node extension/scripts/generate-icons.mjs` (run from `extension/`).

## How connecting works

1. **Connect to JobTrack** in the popup stores a random nonce and opens `<server>/extension/connect?ext=<id>&state=<nonce>`.
2. The signed-in user approves. The server checks the ID against `EXTENSION_IDS` and issues a token
   (`jt_ext_` + 256 random bits). Only its SHA-256 hash is stored, in `extension_tokens`.
3. The page passes the token to that extension ID with `chrome.runtime.sendMessage` (allowed by
   `externally_connectable` for the server origin only). The background worker accepts it only from the configured
   origin and only with the pending nonce, once, within 10 minutes. If delivery fails, the page revokes the token.
4. The popup calls `/api/extension/v1/*` with `Authorization: Bearer <token>`. The token can save jobs, check for
   duplicates and read the user's name, email, currency and pipeline stages, nothing else. Session cookies are never sent
   (`credentials: "omit"`) or accepted there.

Users see and revoke connections under **Settings → Browser extension**. **Disconnect** in the popup revokes the
token on the server too. A revoked token returns 401 and the popup asks to connect again.

## Permissions

| Permission                   | Why                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| `activeTab`                  | Read the current page, only after the user opens the popup, presses the shortcut or uses the context menu on it |
| `scripting`                  | Run the reader on that page; while the side panel is open, a URL watcher (no persistent content scripts) |
| `storage`                    | Keep the token (local) and the connect nonce, unsaved drafts and a picked selection (session) |
| `contextMenus`               | "Save job to JobTrack" and "Use selection as job description"                          |
| `sidePanel`                  | The review form beside the page (added by WXT for `entrypoints/sidepanel`)             |
| `commands`                   | Alt+Shift+J opens the side panel (change it at `chrome://extensions/shortcuts`)        |
| optional: job-site hosts     | Only after "Auto-detect job sites": the badge, and reading those sites without a click (`src/lib/extract/sites/hosts.ts`) |
| host `<WXT_JOBTRACK_URL>/*`  | Call the JobTrack API; no other site is reachable                                     |
| `externally_connectable`     | Let the JobTrack connect page, and no other site, hand over the token                 |

## Limitations

- Browser pages (`chrome://`, the Chrome Web Store) and some sites block extensions; the form then starts empty.
- Sites without an adapter or `JobPosting` data give a title, the main text block and guesses; check the fields
  before saving.
- Adapters depend on each site's markup and page data. LinkedIn's signed-in class names change often, and Indeed's
  selectors are untested (it blocks automated browsers); misses fall back to the generic reader.

## Side panel and access

Opening the side panel by itself grants no access to the page. Chrome grants `activeTab` for the toolbar button, the
context menu and the shortcut. So without auto-detect, the panel shows **Read this page** with the user's shortcut
for tabs it can't read yet.

- **Who opens the panel:** the background worker (`lib/background/panel-triggers.ts`). It calls `sidePanel.open()`
  first in the event handler, while the click still counts as a user gesture, then tells an open panel to read the
  tab again. The popup's side panel button does the same.
- **Following the tab:** `lib/use-panel-tab.ts` follows the panel window's active tab. It re-reads when the job
  changes (`pageKeyFor`): the injected watcher (`lib/extract/watch-url.ts`) reports split-view clicks.
- **Keeping edits:** each job keeps its own unsaved draft.

## How extraction works

`lib/read-page.ts` runs two reads in the tab:

1. **The DOM reader** (`collectPageSnapshot`, isolated world). It takes the site adapter's selectors as plain
   `executeScript` args.
2. **The probe** (MAIN world), if the adapter has one. It reads the page's own state (SEEK's Apollo cache, Greenhouse's
   Remix data, Ashby's `__appData`). It returns only the job's fields as JSON (at most 500 KB, 1.5 s timeout).

Both functions are serialized by Chrome, so they stay self-contained. All selectors and paths ship in the package:
nothing is fetched or evaluated remotely.

`lib/extract/build-draft.ts` merges the layers (`merge.ts`). Adapters live in `lib/extract/sites/`, and parsers for
salary, work setup and employment type in `lib/extract/parse/`.
- Chrome only for now (WXT can also build Firefox and Edge versions; not tested).
