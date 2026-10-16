import { defineConfig } from "vitest/config";
import { WxtVitest } from "wxt/testing/vitest-plugin";

export default defineConfig({
  // Fake browser APIs, WXT aliases and import.meta.env from wxt.config.ts / .env.
  plugins: [WxtVitest()],
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
