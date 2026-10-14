import { getWorkspaceExport } from "@/features/export/data";
import { getCurrentUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";

/** Owner-only JSON backup of the whole workspace (decimals as strings). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!rateLimit(`export:${user.id}`, 10, 10 * 60_000).allowed)
    return new Response("Too many requests", { status: 429 });
  const data = await getWorkspaceExport();
  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="jobtrack-backup-${date}.json"`,
      "cache-control": "private, no-store",
    },
  });
}
