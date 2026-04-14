import { getDocumentProxy } from "unpdf";
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

type PdfDocumentProxy = Awaited<ReturnType<typeof getDocumentProxy>>;

/**
 * Mirrors unpdf's mergePages:true merge step so transcript length / heuristics stay aligned.
 * @see unpdf extractText merge branch
 */
function mergePageTextsForOcr(pageTexts: string[]): string {
  return pageTexts.join("\n").replace(/\s+/g, " ");
}

async function extractTextFromPdfDocument(
  pdf: PdfDocumentProxy,
  signal: AbortSignal | undefined
): Promise<{ fullTranscript: string; totalPages: number }> {
  const numPages = pdf.numPages;
  const pageTexts: string[] = [];
  for (let pageNumber = 1; pageNumber <= numPages; pageNumber++) {
    signal?.throwIfAborted();
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .filter((item) => {
        const row = item as { str?: string | null };
        return row.str != null;
      })
      .map((item) => {
        const row = item as { str: string; hasEOL?: boolean };
        return row.str + (row.hasEOL ? "\n" : "");
      })
      .join("");
    pageTexts.push(text);
  }
  return {
    fullTranscript: mergePageTextsForOcr(pageTexts),
    totalPages: numPages,
  };
}

export type ExtractPdfNativeTextOptions = {
  /** Checked before opening the PDF and between pages — cooperative shutdown. */
  abortSignal?: AbortSignal;
};

/**
 * Full native text from **all** PDF pages via PDF.js (unpdf), **page-by-page** so
 * {@link AbortSignal} can preempt work between pages (unpdf's default `extractText`
 * uses `Promise.all` across pages and does not consult a signal).
 *
 * @throws {PdfPasswordProtectedError} If the file is encrypted / needs a password.
 */
export async function extractPdfNativeText(
  buffer: Buffer,
  options?: ExtractPdfNativeTextOptions
): Promise<{
  fullTranscript: string;
  totalPages: number;
}> {
  const data = new Uint8Array(buffer);
  const signal = options?.abortSignal;
  let pdf: PdfDocumentProxy | undefined;

  try {
    signal?.throwIfAborted();
    try {
      pdf = await getDocumentProxy(data);
    } catch (err) {
      if (isPasswordProtectedPdfError(err)) {
        throw new PdfPasswordProtectedError();
      }
      throw err;
    }

    signal?.throwIfAborted();
    return await extractTextFromPdfDocument(pdf, signal);
  } finally {
    if (pdf) {
      try {
        await pdf.destroy();
      } catch {
        // best-effort release of PDF.js worker / document
      }
    }
  }
}
