import { execSync } from "node:child_process";
import { testEnv } from "./test-env";

/** Applies Prisma migrations and the Graphile Worker schema to the test DB. */
export default function setup(): void {
  const env = { ...process.env, ...testEnv };
  execSync("pnpm exec prisma migrate deploy", { env, stdio: "pipe" });
  execSync("pnpm exec graphile-worker --schema-only", { env, stdio: "pipe" });
}
