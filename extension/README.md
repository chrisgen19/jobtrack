# Save to JobTrack (Chrome extension)

Saves the job posting you're viewing to your JobTrack workspace. Open the extension on a job page and it prefills a
review form, then saves only when you click **Save job**.

- **Prefill:** schema.org `JobPosting` data (LinkedIn, JobStreet, Indeed and most applicant tracking systems publish
  it), falling back to the page's meta tags and title. Text you highlight on the page becomes the description.
- **Duplicates:** warns when you already saved the same posting link, or the same title at the same company.
- **Already applied:** optionally records the application with its date and pipeline stage.
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
| `pnpm --filter @jobtrack/extension test`    | Vitest: page extraction and the connect handshake              |
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
| `activeTab`                  | Read the current page, only after the user opens the popup on it                      |
| `scripting`                  | Run the one-off reader on that page (no persistent content scripts)                   |
| `storage`                    | Keep the token (local) and the connect nonce and unsaved drafts (session)              |
| host `<WXT_JOBTRACK_URL>/*`  | Call the JobTrack API; no other site is reachable                                     |
| `externally_connectable`     | Let the JobTrack connect page, and no other site, hand over the token                 |

## Limitations

- Browser pages (`chrome://`, the Chrome Web Store) and some sites block extensions; the form then starts empty.
- Sites without `JobPosting` data give only a title and description guess; check the fields before saving.
- Chrome only for now (WXT can also build Firefox and Edge versions; not tested).
