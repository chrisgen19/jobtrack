import type { NextRequest } from "next/server";
import { z } from "zod";
import { findDuplicateCandidates } from "@/features/opportunities/data";
import { getCurrentUser } from "@/lib/auth/session";

const querySchema = z.object({
  title: z.string().max(160).optional(),
  company: z.string().max(120).optional(),
  url: z.string().max(2048).optional(),
  exclude: z.uuid().optional(),
});

/** Advisory duplicate hints for the job form (owner-scoped, read-only). */
export async function GET(request: NextRequest) {
  if (!(await getCurrentUser())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return Response.json({ error: "Invalid query" }, { status: 400 });
  const candidates = await findDuplicateCandidates({
    title: parsed.data.title,
    companyName: parsed.data.company,
    postingUrl: parsed.data.url,
    excludeId: parsed.data.exclude,
  });
  return Response.json({ candidates }, { headers: { "cache-control": "private, no-store" } });
}
