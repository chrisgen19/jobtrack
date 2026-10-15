/**
 * Upload validation: only PDF and DOCX, checked by extension, declared MIME
 * type AND file signature (magic bytes), so a renamed executable or HTML
 * file is rejected even if the browser lies about its type.
 */

export const PDF_MIME = "application/pdf";
export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type FileCheck =
  { ok: true; mimeType: string; extension: "pdf" | "docx" } | { ok: false; error: string };

function looksLikePdf(bytes: Buffer): boolean {
  return bytes.subarray(0, 5).toString("latin1") === "%PDF-";
}

/** DOCX is a ZIP whose entries include word/document.xml. */
function looksLikeDocx(bytes: Buffer): boolean {
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  return (
    isZip &&
    bytes.includes(Buffer.from("word/document.xml", "latin1")) &&
    bytes.includes(Buffer.from("[Content_Types].xml", "latin1"))
  );
}

export function validateDocumentFile(params: {
  filename: string;
  declaredType: string;
  bytes: Buffer;
  maxBytes: number;
}): FileCheck {
  const { filename, declaredType, bytes, maxBytes } = params;
  if (bytes.length === 0) return { ok: false, error: "The file is empty." };
  if (bytes.length > maxBytes)
    return { ok: false, error: `Files can be at most ${Math.round(maxBytes / 1024 / 1024)} MB.` };
  const extension = filename.toLowerCase().split(".").pop();
  if (extension === "pdf") {
    if (declaredType && declaredType !== PDF_MIME && declaredType !== "application/octet-stream") {
      return { ok: false, error: "This file does not look like a PDF." };
    }
    if (!looksLikePdf(bytes)) return { ok: false, error: "This file is not a valid PDF." };
    return { ok: true, mimeType: PDF_MIME, extension: "pdf" };
  }
  if (extension === "docx") {
    if (
      declaredType &&
      declaredType !== DOCX_MIME &&
      declaredType !== "application/octet-stream" &&
      declaredType !== "application/zip"
    ) {
      return { ok: false, error: "This file does not look like a Word document." };
    }
    if (!looksLikeDocx(bytes)) return { ok: false, error: "This file is not a valid DOCX document." };
    return { ok: true, mimeType: DOCX_MIME, extension: "docx" };
  }
  return { ok: false, error: "Only PDF and DOCX files are supported." };
}

/** Strips paths and control characters; keeps the original name readable. */
export function sanitizeFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "document";
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 200);
  return cleaned || "document";
}
