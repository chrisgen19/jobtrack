import { APPLICATION_CSV_HEADERS, getApplicationCsvRows } from "@/features/export/data";
import { getCurrentUser } from "@/lib/auth/session";
import { toCsv } from "@/lib/csv";

/** Owner-only CSV of jobs and application attempts. */
export async function GET() {
  if (!(await getCurrentUser())) return new Response("Unauthorized", { status: 401 });
  const csv = toCsv(APPLICATION_CSV_HEADERS, await getApplicationCsvRows());
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="jobtrack-applications-${date}.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
