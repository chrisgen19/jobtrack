import { withExtensionAuth } from "@/features/extension/api";
import { revokeExtensionTokenForUser } from "@/features/extension/tokens";

/** "Disconnect" in the extension: revokes the token that made the request. */
export async function DELETE(request: Request) {
  return withExtensionAuth(request, async ({ tokenId, workspace }) => {
    await revokeExtensionTokenForUser(workspace.user.id, tokenId);
    return new Response(null, { status: 204, headers: { "cache-control": "private, no-store" } });
  });
}
