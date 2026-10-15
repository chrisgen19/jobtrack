import { connection } from "next/server";
import { errorMessage, logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

/** Readiness probe: the app can reach PostgreSQL and migrations are applied. */
export async function GET() {
  await connection();
  try {
    await prisma.$queryRaw`select 1 from "user_preferences" limit 1`;
    return Response.json({ status: "ready" }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    logger.error("readiness check failed", { error: errorMessage(error) });
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
