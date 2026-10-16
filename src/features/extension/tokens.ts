import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { EXTENSION_TOKEN_PREFIX } from "@jobtrack/shared/extension-api";
import { loadWorkspace, type Workspace } from "@/features/workspace/data";
import { NotFoundError } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

/** Connected extensions kept per user; connecting again past this revokes the oldest. */
export const MAX_ACTIVE_EXTENSION_TOKENS = 10;

/** last_used_at is refreshed at most this often per token. */
const LAST_USED_RESOLUTION_MS = 5 * 60 * 1000;

const TOKEN_PATTERN = new RegExp(`^${EXTENSION_TOKEN_PREFIX}[A-Za-z0-9_-]{43}$`);

/** SHA-256 (hex) of a token; tokens have 256 random bits, so no slow hash is needed. */
export const hashExtensionToken = (token: string): string => createHash("sha256").update(token).digest("hex");

/**
 * Creates a token for the user and returns its ID and plaintext; the
 * plaintext is never stored or logged. Revokes the oldest active tokens past the per-user cap.
 */
export async function issueExtensionToken(
  userId: string,
  name: string,
): Promise<{ id: string; token: string }> {
  const token = `${EXTENSION_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
  const id = await prisma.$transaction(async (tx) => {
    const created = await tx.extensionToken.create({
      data: { userId, name, tokenHash: hashExtensionToken(token) },
      select: { id: true },
    });
    const stale = await tx.extensionToken.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: "desc" },
      skip: MAX_ACTIVE_EXTENSION_TOKENS,
      select: { id: true },
    });
    if (stale.length) {
      await tx.extensionToken.updateMany({
        where: { userId, id: { in: stale.map((row) => row.id) } },
        data: { revokedAt: new Date() },
      });
    }
    return created.id;
  });
  return { id, token };
}

export type ExtensionAuth =
  | { status: "ok"; tokenId: string; workspace: Workspace }
  | { status: "unauthorized" }
  | { status: "not_onboarded" };

/**
 * Resolves `Authorization: Bearer jt_ext_...` to the token owner's workspace.
 * Cookies are ignored: the extension API accepts only extension tokens.
 */
export async function authenticateExtensionRequest(
  request: Request,
  now = new Date(),
): Promise<ExtensionAuth> {
  const match = /^Bearer (\S+)$/.exec(request.headers.get("authorization") ?? "");
  const token = match?.[1];
  if (!token || !TOKEN_PATTERN.test(token)) return { status: "unauthorized" };

  const row = await prisma.extensionToken.findUnique({
    where: { tokenHash: hashExtensionToken(token) },
    select: {
      id: true,
      revokedAt: true,
      lastUsedAt: true,
      user: { select: { id: true, name: true, email: true, emailVerified: true, image: true } },
    },
  });
  if (!row || row.revokedAt) return { status: "unauthorized" };

  const workspace = await loadWorkspace({ ...row.user, image: row.user.image ?? null });
  if (!workspace) return { status: "not_onboarded" };

  if (!row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() > LAST_USED_RESOLUTION_MS) {
    await prisma.extensionToken.update({ where: { id: row.id }, data: { lastUsedAt: now } });
  }
  return { status: "ok", tokenId: row.id, workspace };
}

export type ExtensionTokenRow = {
  id: string;
  name: string;
  createdAt: Date;
  lastUsedAt: Date | null;
};

/** The signed-in user's active (not revoked) extension connections, newest first. */
export async function listExtensionTokens(): Promise<ExtensionTokenRow[]> {
  const user = await requireUser();
  return prisma.extensionToken.findMany({
    where: { userId: user.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, createdAt: true, lastUsedAt: true },
  });
}

/** Revokes one of the signed-in user's tokens. */
export async function revokeExtensionToken(tokenId: string): Promise<void> {
  const user = await requireUser();
  await revokeExtensionTokenForUser(user.id, tokenId);
}

/** Revokes a token owned by `userId` (also used by the extension's own Disconnect). */
export async function revokeExtensionTokenForUser(userId: string, tokenId: string): Promise<void> {
  const { count } = await prisma.extensionToken.updateMany({
    where: { id: tokenId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (count === 0) throw new NotFoundError("Extension connection");
}
