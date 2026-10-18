import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";
import { JOB_SITE_MATCHES } from "./src/lib/extract/sites/hosts";
import { OPEN_PANEL_COMMAND } from "./src/lib/messages";

/** Origin of the JobTrack server, from WXT_JOBTRACK_URL (.env files are loaded by WXT). */
function jobtrackOrigin(): string {
  const value = process.env.WXT_JOBTRACK_URL;
  if (!value) throw new Error("WXT_JOBTRACK_URL is required (copy extension/.env.example to .env).");
  const url = new URL(value);
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("WXT_JOBTRACK_URL must use https (http is allowed for localhost only).");
  }
  return url.origin;
}

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  // Explicit imports everywhere, like the web app.
  imports: false,
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: () => {
    const origin = jobtrackOrigin();
    const key = process.env.WXT_EXTENSION_KEY?.trim();
    return {
      name: "Save to JobTrack",
      description:
        "Save the job posting you're viewing to your JobTrack workspace after reviewing the details.",
      // activeTab: read the current page only after the user opens the popup on it, or uses the
      // context menu or the shortcut. WXT adds "sidePanel" for entrypoints/sidepanel.
      permissions: ["activeTab", "scripting", "storage", "contextMenus"],
      host_permissions: [`${origin}/*`],
      // Requested only from the "Auto-detect job sites" toggle (badge, reading without a click).
      optional_host_permissions: JOB_SITE_MATCHES,
      commands: {
        [OPEN_PANEL_COMMAND]: {
          suggested_key: { default: "Alt+Shift+J" },
          description: "Save the job on this page to JobTrack",
        },
      },
      externally_connectable: { matches: [`${origin}/*`] },
      action: { default_title: "Save to JobTrack" },
      ...(key ? { key } : {}),
    };
  },
});
