import { defineConfig, devices } from "@playwright/test";
import { testEnv } from "./tests/support/test-env";

/**
 * End-to-end tests run the standalone production build on port 3100 and a
 * real worker process, both against the `jobtrack_test` database.
 * `pnpm build` is part of the web server command, so this takes ~1 min.
 *
 * Playwright starts the web server before global setup, so migrations run in
 * the server command: the readiness URL needs the schema to exist.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: testEnv.APP_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: process.env.E2E_SKIP_BUILD
      ? "pnpm db:deploy && node .next/standalone/server.js"
      : "pnpm db:deploy && pnpm build && node .next/standalone/server.js",
    url: `${testEnv.APP_URL}/api/health/ready`,
    env: { ...testEnv, PORT: "3100", HOSTNAME: "127.0.0.1" },
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
  },
});
