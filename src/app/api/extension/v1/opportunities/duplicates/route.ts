import { extensionDuplicateQuerySchema, type ExtensionDuplicates } from "@jobtrack/shared/extension-api";
import { extensionError, extensionJson, readJsonBody, withExtensionAuth } from "@/features/extension/api";
import { findDuplicateCandidatesForUser } from "@/features/opportunities/data";
import { appEnv } from "@/lib/env";

/**
 * Advisory duplicate hints before saving (owner-scoped, read-only). POST with
 * a JSON body so posting URLs never appear in request lines or access logs.
 */
export async function POST(request: Request) {
  return withExtensionAuth(request, async ({ workspace }) => {
    const body = await readJsonBody(request);
    if ("error" in body) return body.error;
    const parsed = extensionDuplicateQuerySchema.safeParse(body.value);
    if (!parsed.success) return extensionError(400, "Invalid duplicate query.");
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
