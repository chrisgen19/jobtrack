/**
 * Environment for Vitest and Playwright. Uses the separate `jobtrack_test`
 * database created by docker/postgres-init (never the development DB).
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://jobtrack:jobtrack@localhost:5436/jobtrack_test";

export const testEnv: Record<string, string> = {
  DATABASE_URL: TEST_DATABASE_URL,
  DATABASE_POOL_MAX: "5",
  APP_URL: "http://localhost:3100",
  BETTER_AUTH_URL: "http://localhost:3100",
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-123456",
  AUTH_REQUIRE_EMAIL_VERIFICATION: "true",
  // E2E registers several users from one IP within a minute.
  AUTH_RATE_LIMIT: "off",
  TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  STORAGE_DRIVER: "local",
  // The E2E server is a production build; allow the local driver there only.
  UNSAFE_ALLOW_LOCAL_STORAGE: "true",
  RESEND_API_KEY: "",
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",
  // Any well-formed Chrome extension ID; the connect tests use it as the allowlisted one.
  EXTENSION_IDS: "a".repeat(32),
};
