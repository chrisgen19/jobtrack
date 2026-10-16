import { z } from "zod";
import { findDuplicateCandidates } from "@/features/opportunities/data";
import { getCurrentUser } from "@/lib/auth/session";
import { readJsonBody } from "@/lib/read-json-body";
import { isSameOrigin } from "@/lib/same-origin";

const bodySchema = z.object({
  title: z.string().max(160).optional(),
  company: z.string().max(120).optional(),
  url: z.string().max(2048).optional(),
  exclude: z.uuid().optional(),
});

/** Comfortably above the largest valid body (about 2.5 KB). */
const MAX_BODY_BYTES = 16 * 1024;

/**
 * Advisory duplicate hints for the job form (owner-scoped, read-only). POST
 * with a JSON body so posting URLs never appear in request lines or access
 * logs; cookie-authenticated, so it also checks the Origin.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (!(await getCurrentUser())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) return Response.json({ error: "Invalid request" }, { status: body.status });
  const parsed = bodySchema.safeParse(body.value);
  if (!parsed.success) return Response.json({ error: "Invalid query" }, { status: 400 });
  const candidates = await findDuplicateCandidates({
    title: parsed.data.title,
    companyName: parsed.data.company,
    postingUrl: parsed.data.url,
    excludeId: parsed.data.exclude,
  });
  return Response.json({ candidates }, { headers: { "cache-control": "private, no-store" } });
}
