import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@/generated/prisma/client";
import { databaseEnv } from "@/lib/env";

/**
 * Shared Prisma client: one bounded connection pool per process (web or
 * worker). Created lazily so `next build` can import this module without a
 * database URL. Feature code must reach Prisma through its data layer
 * (`src/features/<domain>/data.ts`), never from components.
 */
export function createPrismaClient(): PrismaClient {
  const { DATABASE_URL, DATABASE_POOL_MAX } = databaseEnv();
  const adapter = new PrismaPg({
    connectionString: DATABASE_URL,
    max: DATABASE_POOL_MAX,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { __jobtrackPrisma?: PrismaClient };

function getClient(): PrismaClient {
  globalForPrisma.__jobtrackPrisma ??= createPrismaClient();
  return globalForPrisma.__jobtrackPrisma;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getClient();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

/** Client passed to interactive `$transaction` callbacks. */
export type TransactionClient = Prisma.TransactionClient;

/** Either the root client or a transaction client. */
export type DbClient = PrismaClient | TransactionClient;
