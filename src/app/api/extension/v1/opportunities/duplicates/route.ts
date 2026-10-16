import { z } from "zod";
import type { ExtensionDuplicates } from "@jobtrack/shared/extension-api";
import { extensionError, extensionJson, withExtensionAuth } from "@/features/extension/api";
import { findDuplicateCandidatesForUser } from "@/features/opportunities/data";
import { appEnv } from "@/lib/env";

const querySchema = z.object({
  title: z.string().max(160).optional(),
  company: z.string().max(120).optional(),
  url: z.string().max(2048).optional(),
});

/** Advisory duplicate hints before saving (owner-scoped, read-only). */
export async function GET(request: Request) {
  return withExtensionAuth(request, async ({ workspace }) => {
    const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) return extensionError(400, "Invalid query.");
    const candidates = await findDuplicateCandidatesForUser(workspace.user.id, {
      title: parsed.data.title,
      companyName: parsed.data.company,
      postingUrl: parsed.data.url,
    });
    const appUrl = appEnv().APP_URL;
    return extensionJson({
      candidates: candidates.map((candidate) => ({ ...candidate, url: `${appUrl}/jobs/${candidate.id}` })),
    } satisfies ExtensionDuplicates);
  });
}
