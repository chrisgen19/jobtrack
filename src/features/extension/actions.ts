"use server";

import { extensionConnectParamsSchema } from "@jobtrack/shared/extension-api";
import { fail, runAction, validationFailure, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { extensionEnv } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { revalidateWorkspace } from "@/lib/revalidate";
import { uuid } from "@/lib/validations/common";
import { requireWorkspace } from "@/features/workspace/data";
import { issueExtensionToken, revokeExtensionToken } from "./tokens";

/**
 * Issues an extension token after the user approved the connect page. The
 * token goes back to this page only, which hands it to the extension ID in
 * the allowlist; any other extension ID is refused.
 */
export async function approveExtensionConnectAction(
  input: unknown,
): Promise<ActionResult<{ token: string; tokenId: string }>> {
  const { user } = await requireWorkspace();
  const parsed = extensionConnectParamsSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  if (!extensionEnv().EXTENSION_IDS.includes(parsed.data.ext)) {
    return fail("This extension isn't allowed to connect to this JobTrack server.");
  }
  if (!rateLimit(`extension-connect:${user.id}`, 5, 10 * 60_000).allowed) {
    return fail("Too many connection attempts. Try again in a few minutes.");
  }
  const { id, token } = await issueExtensionToken(user.id, "Chrome extension");
  return { ok: true, data: { token, tokenId: id } };
}

export async function revokeExtensionTokenAction(tokenId: string): Promise<ActionResult> {
  await requireUser();
  const id = uuid.safeParse(tokenId);
  if (!id.success) return validationFailure(id.error);
  const result = await runAction(() => revokeExtensionToken(id.data));
  if (result.ok) revalidateWorkspace();
  return result;
}
