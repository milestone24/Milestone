import { extractText, getDocumentProxy } from "unpdf";
import { PdfPasswordProtectedError } from "@server/services/pdf-text/errors";

function isPasswordProtectedPdfError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; message?: string };
  if (e.name === "PasswordException") return true;
  const msg = String(e.message ?? "").toLowerCase();
  return (
    msg.includes("password") ||
    (msg.includes("encrypt") && msg.includes("pdf"))
  );
}

/**
 * Full native text from **all** PDF pages via PDF.js (unpdf).
 * @throws {PdfPasswordProtectedError} If the file is encrypted / needs a password.
 */
export async function extractPdfNativeText(buffer: Buffer): Promise<{
  fullTranscript: string;
  totalPages: number;
}> {
  const data = new Uint8Array(buffer);
  try {
    const doc = await getDocumentProxy(data);
    const { totalPages, text } = await extractText(doc, { mergePages: true });
    return { fullTranscript: text, totalPages };
  } catch (err) {
    if (isPasswordProtectedPdfError(err)) {
      throw new PdfPasswordProtectedError();
    }
    throw err;
  }
}
