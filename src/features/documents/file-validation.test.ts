import { describe, expect, it } from "vitest";
import { DOCX_MIME, PDF_MIME, sanitizeFilename, validateDocumentFile } from "./file-validation";

const pdf = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF");
const docx = Buffer.concat([
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.from("....[Content_Types].xml....word/document.xml...."),
]);
const MB = 1024 * 1024;

describe("validateDocumentFile", () => {
  it("accepts real PDF and DOCX files", () => {
    expect(
      validateDocumentFile({ filename: "Resume v3.pdf", declaredType: PDF_MIME, bytes: pdf, maxBytes: MB }),
    ).toMatchObject({ ok: true, extension: "pdf" });
    expect(
      validateDocumentFile({ filename: "letter.DOCX", declaredType: DOCX_MIME, bytes: docx, maxBytes: MB }),
    ).toMatchObject({ ok: true, extension: "docx" });
  });

  it("rejects renamed files, other types, empty and oversized files", () => {
    const html = Buffer.from("<html><script>alert(1)</script></html>");
    expect(
      validateDocumentFile({ filename: "evil.pdf", declaredType: PDF_MIME, bytes: html, maxBytes: MB }).ok,
    ).toBe(false);
    expect(
      validateDocumentFile({ filename: "evil.docx", declaredType: DOCX_MIME, bytes: pdf, maxBytes: MB }).ok,
    ).toBe(false);
    expect(
      validateDocumentFile({
        filename: "run.exe",
        declaredType: "application/octet-stream",
        bytes: pdf,
        maxBytes: MB,
      }).ok,
    ).toBe(false);
    expect(
      validateDocumentFile({ filename: "a.pdf", declaredType: "text/html", bytes: pdf, maxBytes: MB }).ok,
    ).toBe(false);
    expect(
      validateDocumentFile({
        filename: "a.pdf",
        declaredType: PDF_MIME,
        bytes: Buffer.alloc(0),
        maxBytes: MB,
      }).ok,
    ).toBe(false);
    expect(
      validateDocumentFile({
        filename: "a.pdf",
        declaredType: PDF_MIME,
        bytes: Buffer.concat([pdf, Buffer.alloc(MB)]),
        maxBytes: MB,
      }).ok,
    ).toBe(false);
  });

  it("sanitizes filenames", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("C:\\Users\\me\\CV.pdf")).toBe("CV.pdf");
    expect(sanitizeFilename("a\u0000b.pdf")).toBe("ab.pdf");
  });
});
