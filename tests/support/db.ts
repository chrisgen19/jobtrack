import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

/** Removes all rows from application tables (keeps the schema). */
export async function resetDatabase(): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    select tablename from pg_tables
    where schemaname = 'public' and tablename <> '_prisma_migrations'`;
  const list = tables.map(({ tablename }) => `"public"."${tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
  await prisma.$executeRawUnsafe(`DELETE FROM graphile_worker._private_jobs`);
}

/** Inserts a verified Better Auth user row directly. */
export async function createTestUser(name = "Test User") {
  const id = randomUUID().replaceAll("-", "");
  return prisma.user.create({
    data: { id, name, email: `${id}@example.test`, emailVerified: true },
    select: { id: true, name: true, email: true, emailVerified: true, image: true },
  });
}
