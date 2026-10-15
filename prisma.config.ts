import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // process.env (not Prisma's env()) so `prisma generate` works in CI and
  // Docker builds where DATABASE_URL is not set.
  datasource: { url: process.env.DATABASE_URL },
});
