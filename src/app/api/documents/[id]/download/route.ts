import { getDocumentForDownload } from "@/features/documents/data";
import { getCurrentUser } from "@/lib/auth/session";
import { getStorage } from "@/lib/integrations/storage";
import { attachmentDisposition } from "@/lib/integrations/storage/s3";
import { rateLimit } from "@/lib/rate-limit";
import { uuid } from "@/lib/validations/common";

/**
 * Owner-only download. With R2/S3 this redirects to a presigned URL that
 * expires in 60 seconds; the local development driver streams the bytes.
 * Another user's ID returns 404 (no information about existence).
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/documents/[id]/download">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!rateLimit(`download:${user.id}`, 60, 60_000).allowed)
    return new Response("Too many requests", { status: 429 });

  const { id } = await params;
  if (!uuid.safeParse(id).success) return new Response("Not found", { status: 404 });
  const document = await getDocumentForDownload(id);
  if (!document) return new Response("Not found", { status: 404 });

  const storage = getStorage();
  const signed = await storage.signedDownloadUrl(
    document.storageKey,
    document.filename,
    document.mimeType,
    60,
  );
  if (signed) {
    return new Response(null, {
      status: 302,
      headers: { location: signed, "cache-control": "private, no-store" },
    });
  }
  const bytes = await storage.read(document.storageKey);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": document.mimeType,
      "content-disposition": attachmentDisposition(document.filename),
      "content-length": String(bytes.length),
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
