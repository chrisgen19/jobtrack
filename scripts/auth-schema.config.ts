// Schema-only Better Auth config for the CLI (`pnpm auth:generate`).
// Mirrors the options in src/lib/auth/auth.ts that affect database tables
// (email/password, database rate-limit storage, plugins). The adapter gets a
// stub client because the CLI only reads the config; it never queries.
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

export const auth = betterAuth({
  database: prismaAdapter({} as never, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  rateLimit: { enabled: true, storage: "database" },
  plugins: [nextCookies()],
});
