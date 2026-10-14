import { connection } from "next/server";

/** Liveness probe: the Node.js process is up and serving requests. */
export async function GET() {
  await connection();
  return Response.json({ status: "ok" }, { headers: { "cache-control": "no-store" } });
}
