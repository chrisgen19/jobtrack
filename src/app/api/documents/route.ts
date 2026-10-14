import { z } from "zod";
import { maxUploadBytes, uploadDocument } from "@/features/documents/data";
import { documentMetaSchema } from "@/features/documents/schemas";
import { DomainError } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth/session";
import { errorMessage, logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { revalidateWorkspace } from "@/lib/revalidate";

/**
 * Private document upload (multipart/form-data). The server reads the file,
 * checks size, extension, MIME type and magic bytes, then stores it in the
 * private bucket. Bytes never touch the public directory.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const limit = rateLimit(`upload:${user.id}`, 20, 10 * 60_000);
  if (!limit.allowed) {
    return Response.json(
      { error: "Too many uploads. Try again shortly." },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > maxUploadBytes() + 64 * 1024) {
    return Response.json({ error: "File is too large." }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid upload." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Choose a file to upload." }, { status: 400 });
  if (file.size > maxUploadBytes()) return Response.json({ error: "File is too large." }, { status: 413 });

  const meta = documentMetaSchema.safeParse({
    kind: form.get("kind"),
    title: form.get("title") || file.name.replace(/\.[^.]+$/, ""),
    versionLabel: form.get("versionLabel"),
    notes: form.get("notes"),
    replacesId: form.get("replacesId"),
  });
  if (!meta.success) {
    return Response.json(
      { error: "Check the document details.", fieldErrors: z.flattenError(meta.error).fieldErrors },
      { status: 400 },
    );
  }

  try {
    const id = await uploadDocument(meta.data, {
      filename: file.name,
      declaredType: file.type,
      bytes: Buffer.from(await file.arrayBuffer()),
    });
    revalidateWorkspace();
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    if (error instanceof DomainError) return Response.json({ error: error.message }, { status: 400 });
    logger.error("document upload failed", { userId: user.id, error: errorMessage(error) });
    return Response.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
